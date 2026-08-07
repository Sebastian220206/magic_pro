import { TempoMap, DEFAULT_TEMPO } from '@/engine/audioEngine/tempoMap';

describe('TempoMap — constant tempo', () => {
    test('defaults to 120 BPM when empty', () => {
        const map = new TempoMap([]);
        expect(map.tempoAt(0)).toBe(DEFAULT_TEMPO);
        expect(map.beatToSeconds(2)).toBeCloseTo(1, 9); // 2 beats @120 = 1s
    });

    test('converts beats to seconds', () => {
        const map = new TempoMap([{ time: 0, value: 120 }]);
        expect(map.beatToSeconds(0)).toBe(0);
        expect(map.beatToSeconds(4)).toBeCloseTo(2, 9);
    });

    test('converts seconds to beats', () => {
        const map = new TempoMap([{ time: 0, value: 120 }]);
        expect(map.secondsToBeat(2)).toBeCloseTo(4, 9);
    });

    test('round-trips', () => {
        const map = new TempoMap([{ time: 0, value: 137 }]);
        for (const beat of [0, 1, 7.25, 100]) {
            expect(map.secondsToBeat(map.beatToSeconds(beat))).toBeCloseTo(beat, 6);
        }
    });

    test('synthesises a beat-0 point when the track starts later', () => {
        const map = new TempoMap([{ time: 8, value: 90 }]);
        expect(map.tempoAt(0)).toBe(90);
    });
});

describe('TempoMap — jump changes', () => {
    // 120 BPM for 4 beats (2s), then 60 BPM.
    const map = new TempoMap([
        { time: 0, value: 120, type: 'jump' },
        { time: 4, value: 60, type: 'jump' },
    ]);

    test('reports the tempo in force at a beat', () => {
        expect(map.tempoAt(0)).toBe(120);
        expect(map.tempoAt(3.99)).toBe(120);
        expect(map.tempoAt(4)).toBe(60);
        expect(map.tempoAt(99)).toBe(60);
    });

    test('accumulates time across the change', () => {
        expect(map.beatToSeconds(4)).toBeCloseTo(2, 9);
        // 4 more beats at 60 BPM = 4s, total 6s.
        expect(map.beatToSeconds(8)).toBeCloseTo(6, 9);
    });

    test('inverts across the change', () => {
        expect(map.secondsToBeat(2)).toBeCloseTo(4, 9);
        expect(map.secondsToBeat(6)).toBeCloseTo(8, 9);
    });

    test('round-trips either side of the boundary', () => {
        for (const beat of [0, 2, 4, 4.5, 10, 33.3]) {
            expect(map.secondsToBeat(map.beatToSeconds(beat))).toBeCloseTo(beat, 6);
        }
    });

    test('a doubling of tempo halves elapsed time for the same beats', () => {
        const slow = new TempoMap([{ time: 0, value: 60 }]);
        const fast = new TempoMap([{ time: 0, value: 120 }]);
        expect(slow.beatToSeconds(8)).toBeCloseTo(fast.beatToSeconds(8) * 2, 9);
    });
});

describe('TempoMap — ramps', () => {
    // Linear ramp 60 -> 120 BPM across 8 beats.
    const map = new TempoMap([
        { time: 0, value: 60, type: 'ramp' },
        { time: 8, value: 120, type: 'jump' },
    ]);

    test('interpolates tempo through the ramp', () => {
        expect(map.tempoAt(0)).toBeCloseTo(60, 9);
        expect(map.tempoAt(4)).toBeCloseTo(90, 9);
        expect(map.tempoAt(8)).toBeCloseTo(120, 9);
    });

    test('takes less time than the slow tempo and more than the fast one', () => {
        const seconds = map.beatToSeconds(8);
        const atSlow = (8 / 60) * 60;  // 8s
        const atFast = (8 / 120) * 60; // 4s
        expect(seconds).toBeLessThan(atSlow);
        expect(seconds).toBeGreaterThan(atFast);
    });

    test('matches the analytic integral', () => {
        // 60 * B * ln(end/start) / (end - start)
        const expected = (60 * 8 * Math.log(120 / 60)) / (120 - 60);
        expect(map.beatToSeconds(8)).toBeCloseTo(expected, 9);
    });

    test('round-trips through the ramp', () => {
        for (const beat of [0, 1, 4, 7.5, 8, 12]) {
            expect(map.secondsToBeat(map.beatToSeconds(beat))).toBeCloseTo(beat, 6);
        }
    });
});

describe('TempoMap — robustness', () => {
    test('sorts unordered points', () => {
        const map = new TempoMap([
            { time: 8, value: 60 },
            { time: 0, value: 120 },
        ]);
        expect(map.tempoAt(0)).toBe(120);
        expect(map.tempoAt(8)).toBe(60);
    });

    test('ignores malformed points', () => {
        const map = new TempoMap([
            { time: 0, value: 120 },
            { time: NaN, value: 90 },
            { time: 4, value: Number('nope') },
        ] as never);
        expect(map.tempoAt(4)).toBe(120);
    });

    test('clamps absurd tempi rather than dividing by zero', () => {
        const map = new TempoMap([{ time: 0, value: 0 }]);
        expect(Number.isFinite(map.beatToSeconds(4))).toBe(true);
        expect(map.beatToSeconds(4)).toBeGreaterThan(0);
    });

    test('negative positions clamp to the start', () => {
        const map = new TempoMap([{ time: 0, value: 120 }]);
        expect(map.beatToSeconds(-5)).toBe(0);
        expect(map.secondsToBeat(-5)).toBe(0);
    });

    test('reports whether the timeline is a single tempo', () => {
        expect(new TempoMap([{ time: 0, value: 120 }]).isConstant()).toBe(true);
        expect(new TempoMap([
            { time: 0, value: 120 },
            { time: 4, value: 90 },
        ]).isConstant()).toBe(false);
    });
});
