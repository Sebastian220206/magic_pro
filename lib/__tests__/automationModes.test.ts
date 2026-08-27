import {
    playsBackNow, recordsNow, applyTouch, isWriteMode,
    thinPoints, mergePass, IDLE_TOUCH,
    type AutomationTouchState,
} from '../automationModes';

const held: AutomationTouchState = { touching: true, latched: false };
const latched: AutomationTouchState = { touching: false, latched: true };

describe('automation mode rules', () => {
    it('Off ignores the lane entirely', () => {
        expect(playsBackNow('off')).toBe(false);
        expect(recordsNow('off')).toBe(false);
        expect(playsBackNow('off', held)).toBe(false);
    });

    it('Read plays back and never writes', () => {
        expect(playsBackNow('read')).toBe(true);
        expect(recordsNow('read')).toBe(false);
        // Moving a fader in Read must not record — that is Touch's job.
        expect(recordsNow('read', held)).toBe(false);
    });

    it('Touch swaps playback for recording only while held', () => {
        expect(playsBackNow('touch')).toBe(true);
        expect(recordsNow('touch')).toBe(false);

        expect(playsBackNow('touch', held)).toBe(false);
        expect(recordsNow('touch', held)).toBe(true);
    });

    it('Latch keeps writing after release, until stop', () => {
        expect(playsBackNow('latch')).toBe(true);
        expect(recordsNow('latch')).toBe(false);

        // Released, but still armed — this is the whole difference from Touch.
        expect(playsBackNow('latch', latched)).toBe(false);
        expect(recordsNow('latch', latched)).toBe(true);
    });

    it('Write records throughout and never plays back', () => {
        // Reading the lane while replacing it would fight the fader.
        expect(playsBackNow('write')).toBe(false);
        expect(recordsNow('write')).toBe(true);
        expect(recordsNow('write', held)).toBe(true);
    });

    it('nothing records with the transport stopped', () => {
        // A fader moved while parked is setting the mix, not automating it.
        for (const mode of ['read', 'touch', 'latch', 'write', 'off'] as const) {
            expect(recordsNow(mode, held, false)).toBe(false);
        }
    });

    it('playback and recording are never both on for one parameter', () => {
        const states = [IDLE_TOUCH, held, latched];
        for (const mode of ['off', 'read', 'touch', 'latch', 'write'] as const) {
            for (const state of states) {
                expect(playsBackNow(mode, state) && recordsNow(mode, state)).toBe(false);
            }
        }
    });
});

describe('touch bookkeeping', () => {
    it('Latch arms on the first touch and stays armed through release', () => {
        let state = applyTouch('latch', IDLE_TOUCH, true);
        expect(state).toEqual({ touching: true, latched: true });
        state = applyTouch('latch', state, false);
        expect(state).toEqual({ touching: false, latched: true });
    });

    it('Touch forgets the grip on release', () => {
        let state = applyTouch('touch', IDLE_TOUCH, true);
        expect(state.touching).toBe(true);
        state = applyTouch('touch', state, false);
        expect(state).toEqual({ touching: false, latched: false });
    });

    it('names the modes that write', () => {
        expect(isWriteMode('touch')).toBe(true);
        expect(isWriteMode('latch')).toBe(true);
        expect(isWriteMode('write')).toBe(true);
        expect(isWriteMode('read')).toBe(false);
        expect(isWriteMode('off')).toBe(false);
    });
});

describe('thinning a recorded pass', () => {
    it('collapses a straight run to its endpoints', () => {
        // 60 frames a second of a steady ramp is hundreds of collinear points.
        const ramp = Array.from({ length: 50 }, (_, i) => ({ time: i, value: i * 0.02 }));
        expect(thinPoints(ramp)).toHaveLength(2);
    });

    it('keeps the corners of a shape', () => {
        const points = [
            { time: 0, value: 0 }, { time: 1, value: 0.5 }, { time: 2, value: 1 },
            { time: 3, value: 0.5 }, { time: 4, value: 0 },
        ];
        const thinned = thinPoints(points);
        expect(thinned).toHaveLength(3);
        expect(thinned[1]).toEqual({ time: 2, value: 1 });
    });

    it('leaves a pass too short to thin alone', () => {
        expect(thinPoints([])).toEqual([]);
        expect(thinPoints([{ time: 0, value: 1 }])).toHaveLength(1);
        expect(thinPoints([{ time: 0, value: 1 }, { time: 1, value: 0 }])).toHaveLength(2);
    });

    it('never drops the first or last point', () => {
        const ramp = Array.from({ length: 30 }, (_, i) => ({ time: i, value: i }));
        const thinned = thinPoints(ramp);
        expect(thinned[0]).toEqual(ramp[0]);
        expect(thinned[thinned.length - 1]).toEqual(ramp[ramp.length - 1]);
    });
});

describe('merging a pass into an existing lane', () => {
    const existing = [
        { time: 0, value: 0 }, { time: 4, value: 1 },
        { time: 8, value: 0 }, { time: 16, value: 1 },
    ];

    it('replaces only the stretch the pass covered', () => {
        const recorded = [{ time: 4, value: 0.25 }, { time: 8, value: 0.75 }];
        const merged = mergePass(existing, recorded);
        // The point at 0 and the one at 16 are outside the pass and survive.
        expect(merged[0]).toEqual({ time: 0, value: 0 });
        expect(merged[merged.length - 1]).toEqual({ time: 16, value: 1 });
        // The two inside it are gone, replaced by the pass.
        expect(merged.filter(p => p.time === 4 && p.value === 1)).toHaveLength(0);
        expect(merged.filter(p => p.time === 8 && p.value === 0)).toHaveLength(0);
    });

    it('comes back sorted by time', () => {
        const merged = mergePass(existing, [{ time: 5, value: 0.5 }, { time: 6, value: 0.6 }]);
        for (let i = 1; i < merged.length; i++) {
            expect(merged[i].time).toBeGreaterThanOrEqual(merged[i - 1].time);
        }
    });

    it('leaves the lane alone when the pass recorded nothing', () => {
        expect(mergePass(existing, [])).toEqual(existing);
    });

    it('writes into an empty lane', () => {
        const recorded = [{ time: 2, value: 0.3 }, { time: 3, value: 0.4 }];
        expect(mergePass([], recorded)).toEqual(recorded);
    });
});
