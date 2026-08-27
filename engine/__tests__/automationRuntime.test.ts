/**
 * The runtime that made automation audible.
 *
 * Lanes were data with no runtime — `automationValueAt` was called by one test
 * and the mixer's mode button wrote a field nothing read. These assertions
 * cover the frame loop: what plays back, what records, and what a pass leaves
 * behind.
 */

import { automationRuntime, valueAt, type AutomatedTrack } from '../automationRuntime';

const track = (over: Partial<AutomatedTrack> = {}): AutomatedTrack => ({
    id: 't1',
    automationMode: 'read',
    automation: [{ parameter: 'volume', points: [
        { time: 0, value: 0.2 },
        { time: 8, value: 1.0 },
    ] }],
    ...over,
});

beforeEach(() => {
    // The runtime is a singleton; a pass left open by one test would leak.
    automationRuntime.commitPasses([]);
    automationRuntime.invalidate();
});

describe('reading a lane', () => {
    it('interpolates between points', () => {
        const points = [{ time: 0, value: 0 }, { time: 10, value: 1 }];
        expect(valueAt(points, 5)).toBeCloseTo(0.5);
        expect(valueAt(points, 2.5)).toBeCloseTo(0.25);
    });

    it('holds the end values outside the lane', () => {
        const points = [{ time: 4, value: 0.3 }, { time: 8, value: 0.9 }];
        expect(valueAt(points, 0)).toBe(0.3);
        expect(valueAt(points, 100)).toBe(0.9);
    });

    it('has nothing to say about an empty lane', () => {
        expect(valueAt([], 4)).toBeUndefined();
        expect(valueAt(undefined, 4)).toBeUndefined();
    });

    it('survives two points sharing a time', () => {
        const points = [{ time: 2, value: 0.1 }, { time: 2, value: 0.9 }];
        expect(Number.isFinite(valueAt(points, 2) as number)).toBe(true);
    });
});

describe('playback', () => {
    it('drives the parameter in Read', () => {
        const { playback } = automationRuntime.tick([track()], 4, true);
        expect(playback).toHaveLength(1);
        expect(playback[0].parameter).toBe('volume');
        expect(playback[0].value).toBeCloseTo(0.6);
    });

    it('does nothing in Off', () => {
        expect(automationRuntime.tick([track({ automationMode: 'off' })], 4, true).playback).toHaveLength(0);
    });

    it('does not repeat an unchanged value every frame', () => {
        // Re-applying the same value 60 times a second restarts the engine's
        // parameter ramps continuously.
        expect(automationRuntime.tick([track()], 4, true).playback).toHaveLength(1);
        expect(automationRuntime.tick([track()], 4, true).playback).toHaveLength(0);
        expect(automationRuntime.tick([track()], 6, true).playback).toHaveLength(1);
    });

    it('re-applies after a seek invalidates the cache', () => {
        automationRuntime.tick([track()], 4, true);
        automationRuntime.invalidate();
        expect(automationRuntime.tick([track()], 4, true).playback).toHaveLength(1);
    });

    it('skips a track with no lanes', () => {
        expect(automationRuntime.tick([track({ automation: [] })], 4, true).playback).toHaveLength(0);
    });
});

describe('recording a pass', () => {
    it('Write records instead of playing back', () => {
        const t = track({ automationMode: 'write' });
        automationRuntime.beginTouch('t1', 'volume', 'write', 0.5);
        automationRuntime.updateTouch('t1', 'volume', 0.5);

        const { playback } = automationRuntime.tick([t], 2, true);
        expect(playback).toHaveLength(0);
        expect(automationRuntime.isRecording()).toBe(true);
    });

    it('Touch records only while the control is held', () => {
        const t = track({ automationMode: 'touch' });

        // Not touching: the lane plays.
        expect(automationRuntime.tick([t], 2, true).playback).toHaveLength(1);

        automationRuntime.beginTouch('t1', 'volume', 'touch', 0.42);
        expect(automationRuntime.tick([t], 3, true).playback).toHaveLength(0);

        automationRuntime.endTouch('t1', 'volume', 'touch');
        expect(automationRuntime.tick([t], 4, true).playback).toHaveLength(1);
    });

    it('Latch keeps recording after release', () => {
        const t = track({ automationMode: 'latch' });
        automationRuntime.beginTouch('t1', 'volume', 'latch', 0.7);
        automationRuntime.tick([t], 2, true);
        automationRuntime.endTouch('t1', 'volume', 'latch');

        // Released, but the pass is still open — playback stays off.
        expect(automationRuntime.tick([t], 3, true).playback).toHaveLength(0);
    });

    it('records nothing with the transport stopped', () => {
        const t = track({ automationMode: 'write' });
        automationRuntime.beginTouch('t1', 'volume', 'write', 0.5);
        automationRuntime.tick([t], 2, false);
        expect(automationRuntime.commitPasses([t])).toHaveLength(0);
    });

    it('commits the pass merged over the stretch it covered', () => {
        const t = track({ automationMode: 'write' });
        automationRuntime.beginTouch('t1', 'volume', 'write', 0.5);
        for (let beat = 2; beat <= 6; beat += 1) {
            automationRuntime.updateTouch('t1', 'volume', 0.5);
            automationRuntime.tick([t], beat, true);
        }

        const committed = automationRuntime.commitPasses([t]);
        expect(committed).toHaveLength(1);
        expect(committed[0].parameter).toBe('volume');

        const points = committed[0].points;
        // The original point at 0 is before the pass and survives; the one at
        // 8 is after it and survives too.
        expect(points[0]).toEqual({ time: 0, value: 0.2 });
        expect(points[points.length - 1]).toEqual({ time: 8, value: 1.0 });
        // The steady run between them thinned to its endpoints.
        expect(points.filter(p => p.value === 0.5).length).toBeLessThanOrEqual(2);
    });

    it('committing clears the pass, so stopping twice writes once', () => {
        const t = track({ automationMode: 'write' });
        automationRuntime.beginTouch('t1', 'volume', 'write', 0.5);
        automationRuntime.updateTouch('t1', 'volume', 0.5);
        automationRuntime.tick([t], 2, true);

        expect(automationRuntime.commitPasses([t])).toHaveLength(1);
        expect(automationRuntime.commitPasses([t])).toHaveLength(0);
        expect(automationRuntime.isRecording()).toBe(false);
    });

    it('writes into a lane the track does not have yet', () => {
        const t = track({ automationMode: 'write', automation: [{ parameter: 'pan', points: [] }] });
        automationRuntime.beginTouch('t1', 'pan', 'write', -0.5);
        automationRuntime.updateTouch('t1', 'pan', -0.5);
        automationRuntime.tick([t], 1, true);

        const committed = automationRuntime.commitPasses([t]);
        expect(committed[0].parameter).toBe('pan');
        expect(committed[0].points[0].value).toBeCloseTo(-0.5);
    });
});
