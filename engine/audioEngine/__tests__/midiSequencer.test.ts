/**
 * Timing tests for MIDI note scheduling.
 *
 * Regression coverage for the bug where MIDI clips never played back: the
 * transport triggered only the notes sounding under the playhead at the instant
 * play was pressed, and nothing advanced MIDI afterwards.
 */

import {
    collectMidiNoteEvents,
    type MidiSchedulingWindow,
    type SequencerClip,
} from '@/engine/audioEngine/midiSequencer';

const TEMPO = 120; // 2 beats per second — 1 beat = 0.5s
const beatsToSeconds = (beats: number) => (beats / TEMPO) * 60;

function makeWindow(overrides: Partial<MidiSchedulingWindow> = {}): MidiSchedulingWindow {
    return {
        transportStartTime: 100,
        currentTime: 100,
        windowStartBeat: 0,
        windowEndBeat: 1,
        ...overrides,
    };
}

function makeOptions(overrides: Partial<Parameters<typeof collectMidiNoteEvents>[2]> = {}) {
    return {
        beatsToSeconds,
        isTrackAudible: () => true,
        alreadyScheduled: new Set<string>(),
        ...overrides,
    };
}

const fourOnTheFloor: SequencerClip = {
    id: 'clip-1',
    trackId: 'track-1',
    type: 'midi',
    startBeat: 0,
    duration: 4,
    notes: [
        { id: 'n0', pitch: 60, velocity: 100, start: 0, duration: 0.5 },
        { id: 'n1', pitch: 62, velocity: 100, start: 1, duration: 0.5 },
        { id: 'n2', pitch: 64, velocity: 100, start: 2, duration: 0.5 },
        { id: 'n3', pitch: 65, velocity: 100, start: 3, duration: 0.5 },
    ],
};

describe('collectMidiNoteEvents — window selection', () => {
    test('schedules only the notes starting inside the window', () => {
        const events = collectMidiNoteEvents(
            [fourOnTheFloor],
            makeWindow({ windowStartBeat: 0, windowEndBeat: 1 }),
            makeOptions(),
        );

        expect(events).toHaveLength(1);
        expect(events[0].pitch).toBe(60);
    });

    test('a later window picks up the later notes', () => {
        const events = collectMidiNoteEvents(
            [fourOnTheFloor],
            makeWindow({ windowStartBeat: 2, windowEndBeat: 3, currentTime: 101 }),
            makeOptions(),
        );

        expect(events.map(e => e.pitch)).toEqual([64]);
    });

    test('every note fires exactly once across a full transport run', () => {
        // This is the regression: previously only the note under the playhead
        // at press time ever sounded.
        const alreadyScheduled = new Set<string>();
        const collected: number[] = [];

        // Walk the timeline in 0.25-beat windows, as the tick loop would.
        for (let beat = 0; beat < 4; beat += 0.25) {
            const events = collectMidiNoteEvents(
                [fourOnTheFloor],
                makeWindow({
                    windowStartBeat: beat,
                    windowEndBeat: beat + 0.25,
                    currentTime: 100 + beatsToSeconds(beat),
                }),
                makeOptions({ alreadyScheduled }),
            );
            collected.push(...events.map(e => e.pitch));
        }

        expect(collected).toEqual([60, 62, 64, 65]);
    });
});

describe('collectMidiNoteEvents — timing', () => {
    test('converts beats to absolute AudioContext times', () => {
        const events = collectMidiNoteEvents(
            [fourOnTheFloor],
            makeWindow({ windowStartBeat: 1, windowEndBeat: 2, currentTime: 100 }),
            makeOptions(),
        );

        // Beat 1 at 120bpm = 0.5s after transport start (t=100).
        expect(events[0].startTime).toBeCloseTo(100.5, 6);
        // 0.5-beat note = 0.25s long.
        expect(events[0].stopTime).toBeCloseTo(100.75, 6);
    });

    test('respects the clip position on the timeline', () => {
        const offsetClip: SequencerClip = {
            ...fourOnTheFloor,
            id: 'clip-2',
            startBeat: 8,
            notes: [{ id: 'x', pitch: 60, velocity: 100, start: 0, duration: 1 }],
        };

        const events = collectMidiNoteEvents(
            [offsetClip],
            makeWindow({ windowStartBeat: 8, windowEndBeat: 9, currentTime: 100 }),
            makeOptions(),
        );

        // Beat 8 = 4s after transport start.
        expect(events[0].startTime).toBeCloseTo(104, 6);
    });

    test('never schedules into the past', () => {
        const events = collectMidiNoteEvents(
            [fourOnTheFloor],
            // Transport is at t=140 but beat 0 maps to t=100 — well behind.
            makeWindow({ windowStartBeat: 0, windowEndBeat: 1, currentTime: 140 }),
            makeOptions(),
        );

        events.forEach(event => {
            expect(event.startTime).toBeGreaterThanOrEqual(140);
        });
    });

    test('starts a held note immediately when the transport seeks into it', () => {
        const heldNote: SequencerClip = {
            id: 'clip-held',
            trackId: 'track-1',
            type: 'midi',
            startBeat: 0,
            duration: 8,
            notes: [{ id: 'long', pitch: 48, velocity: 90, start: 0, duration: 8 }],
        };

        // Window opens at beat 4 — halfway through the note.
        const events = collectMidiNoteEvents(
            [heldNote],
            makeWindow({ windowStartBeat: 4, windowEndBeat: 4.25, currentTime: 102 }),
            makeOptions(),
        );

        expect(events).toHaveLength(1);
        expect(events[0].startTime).toBe(102);          // immediately
        expect(events[0].stopTime).toBeCloseTo(104, 6); // still ends at beat 8
    });

    test('does not re-trigger a held note on subsequent windows', () => {
        const heldNote: SequencerClip = {
            id: 'clip-held',
            trackId: 'track-1',
            type: 'midi',
            startBeat: 0,
            duration: 8,
            notes: [{ id: 'long', pitch: 48, velocity: 90, start: 0, duration: 8 }],
        };
        const alreadyScheduled = new Set<string>();

        const first = collectMidiNoteEvents(
            [heldNote],
            makeWindow({ windowStartBeat: 4, windowEndBeat: 4.25, currentTime: 102 }),
            makeOptions({ alreadyScheduled }),
        );
        const second = collectMidiNoteEvents(
            [heldNote],
            makeWindow({ windowStartBeat: 4.25, windowEndBeat: 4.5, currentTime: 102.125 }),
            makeOptions({ alreadyScheduled }),
        );

        expect(first).toHaveLength(1);
        expect(second).toHaveLength(0);
    });
});

describe('collectMidiNoteEvents — clip boundaries', () => {
    test('clips a note that overhangs the end of its region', () => {
        const overhang: SequencerClip = {
            id: 'clip-overhang',
            trackId: 'track-1',
            type: 'midi',
            startBeat: 0,
            duration: 2,
            notes: [{ id: 'long', pitch: 60, velocity: 100, start: 1, duration: 8 }],
        };

        const events = collectMidiNoteEvents(
            [overhang],
            makeWindow({ windowStartBeat: 1, windowEndBeat: 2 }),
            makeOptions(),
        );

        // Note is cut at beat 2 (=1s), not allowed to ring to beat 9.
        expect(events[0].stopTime).toBeCloseTo(101, 6);
    });

    test('ignores notes starting past the end of the region', () => {
        const stray: SequencerClip = {
            id: 'clip-stray',
            trackId: 'track-1',
            type: 'midi',
            startBeat: 0,
            duration: 2,
            notes: [{ id: 'past', pitch: 60, velocity: 100, start: 4, duration: 1 }],
        };

        const events = collectMidiNoteEvents(
            [stray],
            makeWindow({ windowStartBeat: 4, windowEndBeat: 5 }),
            makeOptions(),
        );

        expect(events).toHaveLength(0);
    });
});

describe('collectMidiNoteEvents — mix state', () => {
    test('skips muted clips', () => {
        const events = collectMidiNoteEvents(
            [{ ...fourOnTheFloor, muted: true }],
            makeWindow({ windowStartBeat: 0, windowEndBeat: 4 }),
            makeOptions(),
        );

        expect(events).toHaveLength(0);
    });

    test('skips inaudible tracks (muted, or another track soloed)', () => {
        const events = collectMidiNoteEvents(
            [fourOnTheFloor],
            makeWindow({ windowStartBeat: 0, windowEndBeat: 4 }),
            makeOptions({ isTrackAudible: () => false }),
        );

        expect(events).toHaveLength(0);
    });

    test('ignores audio clips entirely', () => {
        const audioClip: SequencerClip = {
            ...fourOnTheFloor,
            id: 'audio-1',
            type: 'audio',
        };

        const events = collectMidiNoteEvents(
            [audioClip],
            makeWindow({ windowStartBeat: 0, windowEndBeat: 4 }),
            makeOptions(),
        );

        expect(events).toHaveLength(0);
    });
});

describe('collectMidiNoteEvents — transforms', () => {
    test('applies clip and track transpose', () => {
        const events = collectMidiNoteEvents(
            [{ ...fourOnTheFloor, transpose: 12 }],
            makeWindow({ windowStartBeat: 0, windowEndBeat: 1 }),
            makeOptions({ trackTranspose: () => -1 }),
        );

        expect(events[0].pitch).toBe(60 + 12 - 1);
    });

    test('applies velocity offset and keeps it in MIDI range', () => {
        const events = collectMidiNoteEvents(
            [{ ...fourOnTheFloor, velocityOffset: 100 }],
            makeWindow({ windowStartBeat: 0, windowEndBeat: 1 }),
            makeOptions(),
        );

        expect(events[0].velocity).toBe(127);
    });

    test('clamps pitch to the MIDI range', () => {
        const events = collectMidiNoteEvents(
            [{ ...fourOnTheFloor, transpose: 96 }],
            makeWindow({ windowStartBeat: 0, windowEndBeat: 1 }),
            makeOptions(),
        );

        expect(events[0].pitch).toBe(127);
    });

    test('resolves the instrument from the track when the clip has none', () => {
        const events = collectMidiNoteEvents(
            [fourOnTheFloor],
            makeWindow({ windowStartBeat: 0, windowEndBeat: 1 }),
            makeOptions({ trackInstrument: () => 'Steinway Piano' }),
        );

        expect(events[0].instrument).toBe('Steinway Piano');
    });
});
