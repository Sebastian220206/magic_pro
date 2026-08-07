/**
 * midiInputRouter.ts
 * Turns incoming MIDI messages into notes on the armed track.
 *
 * This path did not exist. `AudioEngineAdapter` delivered MIDI messages to its
 * listeners, but the only listener was `GlobalKeyHandler`, which matches
 * messages against control-surface *command* assignments (play, stop, and so
 * on). Anything that wasn't a mapped command — every note a keyboard sends —
 * was discarded, so playing a connected keyboard produced no sound.
 *
 * The router also publishes the set of currently held notes, which the piano
 * roll uses to highlight keys as they are played.
 */

export type MidiMessageKind =
    | 'noteOn'
    | 'noteOff'
    | 'controlChange'
    | 'pitchBend'
    | 'other';

export interface ParsedMidiMessage {
    kind: MidiMessageKind;
    /** 0-15. */
    channel: number;
    note?: number;
    /** 0-127. */
    velocity?: number;
    controller?: number;
    value?: number;
}

const NOTE_OFF = 0x80;
const NOTE_ON = 0x90;
const CONTROL_CHANGE = 0xb0;
const PITCH_BEND = 0xe0;

/**
 * Decode a raw MIDI message.
 *
 * Note: a Note On with velocity 0 means Note Off. Most keyboards use it instead
 * of a real Note Off, so treating 0x90 as unconditionally "on" leaves every note
 * sounding forever.
 */
export function parseMidiMessage(data: ArrayLike<number> | null | undefined): ParsedMidiMessage {
    if (!data || data.length === 0) return { kind: 'other', channel: 0 };

    const status = data[0];
    const channel = status & 0x0f;
    const type = status & 0xf0;
    const d1 = data.length > 1 ? data[1] : 0;
    const d2 = data.length > 2 ? data[2] : 0;

    switch (type) {
        case NOTE_ON:
            return d2 > 0
                ? { kind: 'noteOn', channel, note: d1, velocity: d2 }
                : { kind: 'noteOff', channel, note: d1, velocity: 0 };
        case NOTE_OFF:
            return { kind: 'noteOff', channel, note: d1, velocity: d2 };
        case CONTROL_CHANGE:
            return { kind: 'controlChange', channel, controller: d1, value: d2 };
        case PITCH_BEND:
            return { kind: 'pitchBend', channel, value: ((d2 << 7) | d1) - 8192 };
        default:
            return { kind: 'other', channel };
    }
}

/** Everything the router needs from the rest of the app. */
export interface MidiRoutingContext {
    /** Track that should receive played notes, or null to drop them. */
    resolveTargetTrack: () => string | null;
    /** False when the user has unticked this device in settings. */
    isDeviceEnabled: (inputId: string) => boolean;
    triggerNote: (trackId: string, pitch: number, velocity: number) => void;
    releaseNote: (trackId: string, pitch: number) => void;
}

type ActiveNotesListener = (notes: Set<number>) => void;

export class MidiInputRouter {
    /** Held notes → the track they were started on, so note-off can't strand. */
    private held = new Map<number, string>();
    private listeners = new Set<ActiveNotesListener>();

    constructor(private context: MidiRoutingContext) { }

    setContext(context: MidiRoutingContext): void {
        this.context = context;
    }

    /** Currently held note numbers. */
    getActiveNotes(): Set<number> {
        return new Set(this.held.keys());
    }

    subscribe(listener: ActiveNotesListener): () => void {
        this.listeners.add(listener);
        listener(this.getActiveNotes());
        return () => { this.listeners.delete(listener); };
    }

    /**
     * Handle one incoming message.
     *
     * Returns the parsed message so callers (e.g. control-surface mapping) can
     * act on the same decode rather than re-parsing.
     */
    handleMessage(data: ArrayLike<number> | null | undefined, inputId = ''): ParsedMidiMessage {
        const parsed = parseMidiMessage(data);

        if (parsed.kind !== 'noteOn' && parsed.kind !== 'noteOff') return parsed;
        if (inputId && !this.context.isDeviceEnabled(inputId)) return parsed;

        const note = parsed.note ?? -1;
        if (note < 0 || note > 127) return parsed;

        if (parsed.kind === 'noteOn') {
            const trackId = this.context.resolveTargetTrack();
            if (!trackId) return parsed;

            // Re-pressing a held note restarts it rather than stacking voices.
            if (this.held.has(note)) {
                this.context.releaseNote(this.held.get(note)!, note);
            }

            this.held.set(note, trackId);
            this.context.triggerNote(trackId, note, parsed.velocity ?? 100);
            this.publish();
            return parsed;
        }

        // Note off — release on whichever track started the note, even if the
        // armed track has changed since.
        const startedOn = this.held.get(note);
        if (startedOn === undefined) return parsed;

        this.held.delete(note);
        this.context.releaseNote(startedOn, note);
        this.publish();
        return parsed;
    }

    /** Release everything. Used on panic / device disconnect / unmount. */
    allNotesOff(): void {
        for (const [note, trackId] of Array.from(this.held.entries())) {
            this.context.releaseNote(trackId, note);
        }
        this.held.clear();
        this.publish();
    }

    private publish(): void {
        const snapshot = this.getActiveNotes();
        this.listeners.forEach(listener => {
            try {
                listener(snapshot);
            } catch (error) {
                console.error('[MidiInput] listener failed:', error);
            }
        });
    }
}
