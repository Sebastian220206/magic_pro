/**
 * liveMidiInput.ts
 * Application-level wiring for playing a connected MIDI keyboard.
 *
 * Connects the raw message stream from `AudioEngineAdapter` to the note router,
 * resolving the target track from project state. Started once at boot so the
 * keyboard works regardless of which panels happen to be open.
 */

import { audioEngine } from '../AudioEngineAdapter';
import { MidiInputRouter } from './midiInputRouter';

interface TrackLike {
    id: string;
    type?: string;
    recordEnabled?: boolean;
}

interface ProjectStateLike {
    tracks: TrackLike[];
    focusedTrackId: string | null;
    globalSettings?: { midi?: { inputs?: { name: string; enabled: boolean }[] } };
}

export interface LiveMidiInputOptions {
    getState: () => ProjectStateLike;
    /** Map a device id to its name, so the enabled flag can be looked up. */
    getDeviceName?: (inputId: string) => string | undefined;
}

/** Tracks that can host MIDI notes. */
const INSTRUMENT_TRACK_TYPES = new Set(['midi', 'software-instrument', 'drummer', 'external-midi']);

/**
 * Which track should receive played notes.
 *
 * Record-armed wins (that is what the user is about to record onto), then the
 * focused track, then the first instrument track so a keyboard still makes a
 * sound in a project where nothing has been selected yet.
 */
export function resolveTargetTrack(state: ProjectStateLike): string | null {
    const tracks = state.tracks ?? [];

    const armed = tracks.find(t => t.recordEnabled);
    if (armed) return armed.id;

    if (state.focusedTrackId && tracks.some(t => t.id === state.focusedTrackId)) {
        return state.focusedTrackId;
    }

    const instrument = tracks.find(t => INSTRUMENT_TRACK_TYPES.has(t.type ?? ''));
    return instrument?.id ?? tracks[0]?.id ?? null;
}

let router: MidiInputRouter | null = null;
let detach: (() => void) | null = null;

/**
 * Subscribers to the held-note set.
 *
 * Kept at module level rather than on the router so a consumer can subscribe
 * before boot has created it — otherwise the piano roll's highlight silently
 * does nothing whenever it mounts first.
 */
const activeNoteListeners = new Set<(notes: Set<number>) => void>();
let lastActiveNotes: Set<number> = new Set();

/** The router, for consumers that need it directly. */
export function getMidiInputRouter(): MidiInputRouter | null {
    return router;
}

/**
 * Observe the notes currently held on a MIDI keyboard.
 *
 * Safe to call at any point in the app's lifecycle; the listener receives the
 * current set immediately and every change thereafter.
 */
export function subscribeToActiveNotes(listener: (notes: Set<number>) => void): () => void {
    activeNoteListeners.add(listener);
    listener(lastActiveNotes);
    return () => { activeNoteListeners.delete(listener); };
}

function publishActiveNotes(notes: Set<number>): void {
    lastActiveNotes = notes;
    activeNoteListeners.forEach(listener => {
        try {
            listener(notes);
        } catch (error) {
            console.error('[MidiInput] active-note listener failed:', error);
        }
    });
}

/**
 * Begin routing MIDI input to instruments. Idempotent; returns a disposer.
 */
export function startLiveMidiInput(options: LiveMidiInputOptions): () => void {
    if (router && detach) return detach;

    router = new MidiInputRouter({
        resolveTargetTrack: () => resolveTargetTrack(options.getState()),
        isDeviceEnabled: (inputId) => {
            const name = options.getDeviceName?.(inputId);
            // Unknown devices are allowed: a device the user has never seen in
            // settings should still play rather than be silently ignored.
            if (!name) return true;
            const inputs = options.getState().globalSettings?.midi?.inputs ?? [];
            const entry = inputs.find(i => i.name === name);
            return entry ? entry.enabled : true;
        },
        triggerNote: (trackId, pitch, velocity) => audioEngine.triggerNote(trackId, pitch, velocity),
        releaseNote: (trackId, pitch) => audioEngine.releaseNote(trackId, pitch),
    });

    const unsubscribeNotes = router.subscribe(publishActiveNotes);

    const unsubscribe = audioEngine.addMidiListener(({ message, inputId }) => {
        router?.handleMessage(message.data, inputId);
    });

    detach = () => {
        router?.allNotesOff();
        unsubscribeNotes();
        unsubscribe();
        router = null;
        detach = null;
        publishActiveNotes(new Set());
    };

    return detach;
}
