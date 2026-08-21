/**
 * Where a clip sits on the timeline.
 *
 * Clips carry their position as `startBeat`, `start`, or both, depending on
 * which part of the app made them. The audio scheduler read only `startBeat`,
 * so a recorded clip — which carried `start` — produced
 * `undefined + duration = NaN`. The window test compared NaN, came out false,
 * and every take was filtered out before it could be scheduled: recording
 * captured real audio and played back silence.
 *
 * The second half of the same bug: the scheduler fell back to 0 rather than to
 * `start`, so a take recorded at bar 5 would have played from bar 1.
 */

import { clipStartBeatOf } from '../scheduler';

describe('clip start beat', () => {
    it('prefers startBeat when a clip carries it', () => {
        expect(clipStartBeatOf({ startBeat: 8, start: 2 })).toBe(8);
    });

    it('falls back to start, not to zero', () => {
        // Falling back to zero is what would drop a take recorded at bar 5
        // onto bar 1.
        expect(clipStartBeatOf({ start: 8 })).toBe(8);
    });

    it('is zero only when a clip carries neither', () => {
        expect(clipStartBeatOf({})).toBe(0);
    });

    it('never returns a value that poisons an arithmetic comparison', () => {
        // `undefined + duration` is NaN, and every comparison against NaN is
        // false — which is how the clip vanished silently rather than erroring.
        for (const clip of [
            {}, { startBeat: undefined }, { start: undefined },
            { startBeat: NaN }, { start: NaN },
            { startBeat: Infinity }, { start: Infinity },
        ]) {
            const beat = clipStartBeatOf(clip as never);
            expect(Number.isFinite(beat)).toBe(true);
            expect(Number.isFinite(beat + 4)).toBe(true);
        }
    });

    it('keeps a legitimate zero', () => {
        expect(clipStartBeatOf({ startBeat: 0, start: 9 })).toBe(0);
    });
});
