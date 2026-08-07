/**
 * midiSequencer.ts
 * Turns MIDI clips into timed note events for the transport's lookahead window.
 *
 * This module is deliberately free of Web Audio and store dependencies: it is
 * pure arithmetic over beats and seconds, so the timing behaviour can be tested
 * directly. `AdvancedScheduler` calls it once per tick and hands the resulting
 * events to a `MidiSink` that owns the actual sound generation.
 *
 * Background: MIDI clips previously never played during transport. The store
 * called `audioEngine.playRegion()` once when play was pressed, which triggered
 * only the notes already sounding under the playhead at that instant; nothing
 * advanced MIDI after that. Audio clips rode the scheduler's lookahead loop and
 * played correctly, which is why the gap was easy to miss.
 */

export interface SequencedNote {
    id?: string;
    pitch: number;
    velocity: number;
    /** Beats, relative to the start of the owning clip. */
    start: number;
    /** Length in beats. */
    duration: number;
}

export interface SequencerClip {
    id: string;
    trackId: string;
    type: string;
    /** Timeline position in beats. `start` is the legacy alias. */
    startBeat?: number;
    start?: number;
    duration: number;
    muted?: boolean;
    notes?: SequencedNote[];
    /** Semitone offset applied to every note in the clip. */
    transpose?: number;
    /** Velocity offset applied to every note in the clip. */
    velocityOffset?: number;
    instrument?: string;
}

/** A note resolved to absolute AudioContext times, ready to hand to a sink. */
export interface MidiNoteEvent {
    /** Stable identity used to avoid scheduling the same note twice. */
    key: string;
    clipId: string;
    trackId: string;
    pitch: number;
    velocity: number;
    startTime: number;
    stopTime: number;
    instrument?: string;
}

export interface MidiSchedulingWindow {
    /** AudioContext time that corresponds to beat 0 of the timeline. */
    transportStartTime: number;
    /** AudioContext time right now — nothing may be scheduled before this. */
    currentTime: number;
    windowStartBeat: number;
    windowEndBeat: number;
}

export interface MidiSchedulingOptions {
    beatsToSeconds: (beats: number) => number;
    /** False when the track is muted, or another track is soloed. */
    isTrackAudible: (trackId: string) => boolean;
    /** Keys already scheduled; this call adds to it. */
    alreadyScheduled: Set<string>;
    trackInstrument?: (trackId: string) => string | undefined;
    trackTranspose?: (trackId: string) => number;
}

const MIN_PITCH = 0;
const MAX_PITCH = 127;
const MIN_VELOCITY = 1;
const MAX_VELOCITY = 127;

const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

/** Timeline position of a clip, tolerating the `start`/`startBeat` aliases. */
function clipStartBeat(clip: SequencerClip): number {
    const raw = clip.startBeat ?? clip.start ?? 0;
    return Number.isFinite(raw) ? raw : 0;
}

/**
 * Resolve every note that should begin inside the given window.
 *
 * Two cases produce an event:
 *   1. The note starts inside the window — the normal path.
 *   2. The note started before the window but is still sounding, and has not
 *      been scheduled yet. This happens when playback starts or seeks into the
 *      middle of a held note; the note begins immediately and is truncated.
 *
 * Notes are clipped to their clip's end, so a note extending past the region
 * boundary stops with the region rather than ringing on.
 */
export function collectMidiNoteEvents(
    clips: SequencerClip[],
    window: MidiSchedulingWindow,
    options: MidiSchedulingOptions,
): MidiNoteEvent[] {
    const {
        beatsToSeconds,
        isTrackAudible,
        alreadyScheduled,
        trackInstrument,
        trackTranspose,
    } = options;

    const events: MidiNoteEvent[] = [];

    for (const clip of clips) {
        if (clip.type !== 'midi') continue;
        if (clip.muted) continue;
        if (!clip.notes || clip.notes.length === 0) continue;
        if (!isTrackAudible(clip.trackId)) continue;

        const startBeat = clipStartBeat(clip);
        const clipDuration = Number.isFinite(clip.duration) ? clip.duration : 0;
        const clipEndBeat = startBeat + clipDuration;

        // A clip entirely behind the window has nothing left to contribute.
        if (clipEndBeat <= window.windowStartBeat) continue;
        if (startBeat > window.windowEndBeat) continue;

        const transpose = (clip.transpose ?? 0) + (trackTranspose?.(clip.trackId) ?? 0);
        const velocityOffset = clip.velocityOffset ?? 0;
        const instrument = clip.instrument ?? trackInstrument?.(clip.trackId);

        clip.notes.forEach((note, index) => {
            const noteStartBeat = startBeat + note.start;
            const noteEndBeat = Math.min(noteStartBeat + note.duration, clipEndBeat);

            // Zero or negative length after clipping — nothing to play.
            if (noteEndBeat <= noteStartBeat) return;

            const key = `${clip.id}:${note.id ?? index}:${noteStartBeat}`;
            if (alreadyScheduled.has(key)) return;

            const startsInWindow =
                noteStartBeat >= window.windowStartBeat &&
                noteStartBeat < window.windowEndBeat;

            // Case 2: already sounding when the transport arrived here.
            const soundingAtWindowStart =
                noteStartBeat < window.windowStartBeat &&
                noteEndBeat > window.windowStartBeat;

            if (!startsInWindow && !soundingAtWindowStart) return;

            const idealStart = window.transportStartTime + beatsToSeconds(noteStartBeat);
            const stopTime = window.transportStartTime + beatsToSeconds(noteEndBeat);

            // Never schedule into the past; Web Audio would fire it immediately
            // anyway, and an already-elapsed stop time would silence the note.
            const startTime = Math.max(idealStart, window.currentTime);
            if (stopTime <= startTime) return;

            alreadyScheduled.add(key);

            events.push({
                key,
                clipId: clip.id,
                trackId: clip.trackId,
                pitch: clamp(Math.round(note.pitch + transpose), MIN_PITCH, MAX_PITCH),
                velocity: clamp(Math.round(note.velocity + velocityOffset), MIN_VELOCITY, MAX_VELOCITY),
                startTime,
                stopTime,
                instrument,
            });
        });
    }

    // Deterministic order makes the output easy to assert on and lets sinks
    // assume earlier notes arrive first.
    events.sort((a, b) => a.startTime - b.startTime || a.pitch - b.pitch);

    return events;
}

/**
 * Receives scheduled notes. Implemented by `AudioEngineAdapter` against the
 * synth/soundfont/sampler engines; tests substitute a recording stub.
 */
export interface MidiSink {
    /** Play `pitch` on `trackId` from `startTime` until `stopTime` (AudioContext seconds). */
    scheduleNote(event: MidiNoteEvent): void;
    /** Silence everything currently sounding or scheduled — stop, seek, tempo change. */
    allNotesOff(): void;
}
