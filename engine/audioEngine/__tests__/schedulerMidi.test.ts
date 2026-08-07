/**
 * Integration coverage for MIDI sequencing inside AdvancedScheduler.
 *
 * The pure timing arithmetic lives in midiSequencer.test.ts. These tests check
 * the wiring: that the scheduler actually drives its MidiSink as the transport
 * advances, and that it clears notes when the timeline mapping changes.
 */

import { advancedScheduler } from '../scheduler';
import type { MidiNoteEvent, MidiSink } from '../midiSequencer';

jest.mock('../audioContext', () => ({
    audioContextManager: {
        getContext: jest.fn(),
        getCurrentTime: jest.fn().mockReturnValue(0),
    },
}));

jest.mock('../bufferCache', () => ({
    bufferCacheManager: {
        getBuffer: jest.fn(),
        addBuffer: jest.fn(),
    },
}));

jest.mock('../routingEngine', () => ({
    routingEngine: {
        trackNodes: new Map(),
        soloedTracks: new Set(),
        createTrack: jest.fn(),
    },
}));

class RecordingSink implements MidiSink {
    notes: MidiNoteEvent[] = [];
    allNotesOffCalls = 0;

    scheduleNote(event: MidiNoteEvent): void {
        this.notes.push(event);
    }

    allNotesOff(): void {
        this.allNotesOffCalls += 1;
    }

    pitches(): number[] {
        return this.notes.map(n => n.pitch);
    }
}

const midiClip = {
    id: 'clip-1',
    name: 'Melody',
    trackId: 'track-1',
    type: 'midi',
    startBeat: 0,
    duration: 4,
    pitchShift: 0,
    timeStretch: 1,
    volume: 1,
    pan: 0,
    muted: false,
    loop: false,
    notes: [
        { id: 'a', pitch: 60, velocity: 100, start: 0, duration: 0.5 },
        { id: 'b', pitch: 62, velocity: 100, start: 1, duration: 0.5 },
        { id: 'c', pitch: 64, velocity: 100, start: 2, duration: 0.5 },
        { id: 'd', pitch: 65, velocity: 100, start: 3, duration: 0.5 },
    ],
};

const track = { id: 'track-1', name: 'Piano', instrument: 'piano' };

describe('AdvancedScheduler — MIDI sequencing', () => {
    let scheduler: any;
    let sink: RecordingSink;
    let mockCtx: any;

    beforeEach(() => {
        scheduler = new (advancedScheduler.constructor as any)({
            lookaheadTime: 100,
            scheduleInterval: 25,
        });
        sink = new RecordingSink();
        scheduler.setMidiSink(sink);

        mockCtx = { currentTime: 0, destination: {} };
        require('../audioContext').audioContextManager.getContext.mockReturnValue(mockCtx);

        scheduler['tempo'] = 120; // 1 beat = 0.5s
        scheduler['startTime'] = 0;
        scheduler['isPlaying'] = true;
    });

    /** Advance the audio clock and run one scheduling pass. */
    const tickAt = (seconds: number) => {
        mockCtx.currentTime = seconds;
        scheduler['scheduleMidiNotes'](
            [midiClip],
            [track],
            scheduler['getSchedulingWindow'](mockCtx),
            mockCtx,
        );
    };

    test('sequences every note as the transport advances', () => {
        // Regression: MIDI previously fired only at the instant play was pressed.
        for (let t = 0; t < 2.0; t += 0.05) {
            tickAt(t);
        }

        expect(sink.pitches()).toEqual([60, 62, 64, 65]);
    });

    test('does not schedule a note twice across overlapping windows', () => {
        // The lookahead window overlaps heavily between ticks.
        for (let t = 0; t < 2.0; t += 0.01) {
            tickAt(t);
        }

        expect(sink.notes).toHaveLength(4);
    });

    test('schedules notes at the correct absolute times', () => {
        for (let t = 0; t < 2.0; t += 0.05) {
            tickAt(t);
        }

        const [first, second] = sink.notes;
        expect(first.startTime).toBeCloseTo(0, 2);   // beat 0
        expect(second.startTime).toBeCloseTo(0.5, 2); // beat 1 at 120bpm
    });

    test('passes the track instrument through to the sink', () => {
        tickAt(0);
        expect(sink.notes[0].instrument).toBe('piano');
    });

    test('does nothing when no sink is installed', () => {
        scheduler.setMidiSink(null);
        expect(() => tickAt(0)).not.toThrow();
        expect(sink.notes).toHaveLength(0);
    });

    test('stopping the transport silences sounding notes', () => {
        tickAt(0);
        scheduler.stopPlayback();

        expect(sink.allNotesOffCalls).toBeGreaterThan(0);
    });

    test('seeking clears scheduling memory so notes can fire again', () => {
        for (let t = 0; t < 2.0; t += 0.05) tickAt(t);
        expect(sink.notes).toHaveLength(4);

        scheduler['isPlaying'] = true;
        scheduler.seekTo(0);
        expect(sink.allNotesOffCalls).toBeGreaterThan(0);

        // After the seek the same notes are eligible again.
        scheduler['startTime'] = 2.0;
        for (let t = 2.0; t < 4.0; t += 0.05) tickAt(t);

        expect(sink.notes.length).toBeGreaterThan(4);
    });

    test('a tempo change re-arms scheduling with the new timing', () => {
        for (let t = 0; t < 2.0; t += 0.05) tickAt(t);
        const before = sink.allNotesOffCalls;

        scheduler.setTempo(140);

        expect(sink.allNotesOffCalls).toBeGreaterThan(before);
    });
});

describe('AdvancedScheduler — tick loop', () => {
    let scheduler: any;
    let sink: RecordingSink;
    let mockCtx: any;

    beforeEach(() => {
        jest.useFakeTimers();
        scheduler = new (advancedScheduler.constructor as any)({
            lookaheadTime: 100,
            scheduleInterval: 25,
        });
        sink = new RecordingSink();
        scheduler.setMidiSink(sink);

        mockCtx = { currentTime: 0, destination: {} };
        require('../audioContext').audioContextManager.getContext.mockReturnValue(mockCtx);
    });

    afterEach(() => {
        scheduler.dispose();
        jest.useRealTimers();
    });

    test('keeps scheduling after the initial lookahead window', async () => {
        // Regression: createTimerWorker() used `import.meta` inside a Function
        // constructor, which always threw, so startSchedulingLoop() bailed out
        // and no tick ever fired. Only the first window was ever scheduled —
        // fatal for MIDI, where every note needs its own scheduling pass.
        await scheduler.startPlayback([midiClip], [track], 0, 120);

        // The first pass covers beat 0 only (100ms lookahead = 0.2 beats).
        expect(sink.pitches()).toEqual([60]);

        // Advance the audio clock and let the loop tick.
        for (let step = 1; step <= 40; step++) {
            mockCtx.currentTime = step * 0.05;
            jest.advanceTimersByTime(25);
        }

        // Without a running loop this would still be just [60].
        expect(sink.pitches()).toEqual([60, 62, 64, 65]);
    });

    test('stopping the transport halts the loop', async () => {
        await scheduler.startPlayback([midiClip], [track], 0, 120);
        scheduler.stopPlayback();

        const countAfterStop = sink.notes.length;

        for (let step = 1; step <= 40; step++) {
            mockCtx.currentTime = step * 0.05;
            jest.advanceTimersByTime(25);
        }

        expect(sink.notes).toHaveLength(countAfterStop);
    });
});
