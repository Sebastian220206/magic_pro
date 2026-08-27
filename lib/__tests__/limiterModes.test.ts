import {
    LIMITER_MODES, LIMITER_MODE_PROFILES, limiterProfile,
    limiterKnee, clipCurve, effectiveRelease,
} from '../limiterModes';

describe('limiter modes', () => {
    it('offers the two the panel shows', () => {
        expect(LIMITER_MODES.map(m => m.id)).toEqual(['legacy', 'precision']);
        for (const mode of LIMITER_MODES) {
            expect(LIMITER_MODE_PROFILES[mode.id]).toBeDefined();
            expect(mode.hint.length).toBeGreaterThan(10);
        }
    });

    it('makes Precision the one that actually holds the ceiling', () => {
        // Without the clipper a DynamicsCompressorNode at 20:1 is not a
        // brickwall, so this is the whole difference between the two.
        expect(LIMITER_MODE_PROFILES.precision.clip).toBe(true);
        expect(LIMITER_MODE_PROFILES.legacy.clip).toBe(false);
        expect(LIMITER_MODE_PROFILES.precision.attack)
            .toBeLessThan(LIMITER_MODE_PROFILES.legacy.attack);
    });

    it('falls back rather than returning undefined for an unknown mode', () => {
        expect(limiterProfile('nonsense')).toBe(LIMITER_MODE_PROFILES.legacy);
    });
});

describe('soft knee', () => {
    it('rounds the corner when on and squares it when off', () => {
        expect(limiterKnee(true)).toBeGreaterThan(0);
        expect(limiterKnee(false)).toBe(0);
    });
});

describe('the clipper curve', () => {
    it('passes anything below the ceiling straight through', () => {
        const curve = clipCurve(0);
        // The middle of the curve is the middle of the input range.
        expect(curve[curve.length / 2]).toBeCloseTo(0, 2);
        expect(curve[0]).toBeCloseTo(-1, 2);
        expect(curve[curve.length - 1]).toBeCloseTo(1, 2);
    });

    it('flattens at the ceiling', () => {
        const curve = clipCurve(-6);
        const ceiling = Math.pow(10, -6 / 20);
        for (const value of curve) {
            expect(Math.abs(value)).toBeLessThanOrEqual(ceiling + 1e-6);
        }
        // And it does reach it, rather than just being quiet.
        expect(Math.max(...Array.from(curve))).toBeCloseTo(ceiling, 3);
    });

    it('never lets a positive ceiling exceed full scale', () => {
        // A +1 dB Output Level must not ask the shaper for more than 1.0.
        const curve = clipCurve(1);
        expect(Math.max(...Array.from(curve))).toBeLessThanOrEqual(1);
    });

    it('is monotonic, so it shapes rather than folds', () => {
        const curve = clipCurve(-3);
        for (let i = 1; i < curve.length; i++) {
            expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1] - 1e-9);
        }
    });
});

describe('release', () => {
    it('is shorter in Precision than in Legacy at the same setting', () => {
        expect(effectiveRelease(0.5, 'precision')).toBeLessThan(effectiveRelease(0.5, 'legacy'));
    });

    it('stays inside what the node accepts', () => {
        expect(effectiveRelease(0, 'legacy')).toBeGreaterThanOrEqual(0.002);
        expect(effectiveRelease(100, 'legacy')).toBeLessThanOrEqual(2);
    });

    it('falls back rather than passing NaN to an AudioParam', () => {
        // Writing a non-finite value to an AudioParam throws and takes the
        // whole render down.
        expect(Number.isFinite(effectiveRelease(Number.NaN, 'legacy'))).toBe(true);
    });
});
