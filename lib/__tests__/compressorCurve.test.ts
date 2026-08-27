import {
    compressLevel, gainReductionAt, limitLevel, autoMakeupDb, transferCurve,
    amplitudeToDb, meterFraction, modelProfile,
    COMPRESSOR_MODELS, MODEL_PROFILES,
} from '../compressorCurve';

describe('the transfer curve', () => {
    it('passes anything below the threshold untouched', () => {
        expect(compressLevel(-40, -20, 4, 0)).toBe(-40);
        expect(gainReductionAt(-40, -20, 4, 0)).toBe(0);
    });

    it('divides the excess above the threshold by the ratio', () => {
        // 10 dB over a -20 threshold at 4:1 comes out 2.5 dB over.
        expect(compressLevel(-10, -20, 4, 0)).toBeCloseTo(-17.5);
        expect(gainReductionAt(-10, -20, 4, 0)).toBeCloseTo(7.5);
    });

    it('does nothing at all at 1:1', () => {
        for (const input of [-50, -20, -5, 0]) {
            expect(compressLevel(input, -30, 1, 0)).toBeCloseTo(input);
        }
    });

    it('approaches a brickwall at a very high ratio', () => {
        expect(compressLevel(0, -20, 1000, 0)).toBeCloseTo(-19.98, 1);
    });

    it('rounds the corner over the knee', () => {
        // Right at the threshold with a wide knee, some reduction has already
        // begun — that is what a soft knee means.
        const soft = gainReductionAt(-20, -20, 4, 12);
        const hard = gainReductionAt(-20, -20, 4, 0);
        expect(soft).toBeGreaterThan(0);
        expect(hard).toBe(0);
    });

    it('is continuous across the knee boundaries', () => {
        const knee = 10;
        const belowKnee = compressLevel(-25.01, -20, 4, knee);
        const atKneeStart = compressLevel(-25, -20, 4, knee);
        expect(Math.abs(belowKnee - atKneeStart)).toBeLessThan(0.02);

        const atKneeEnd = compressLevel(-15, -20, 4, knee);
        const aboveKnee = compressLevel(-14.99, -20, 4, knee);
        expect(Math.abs(atKneeEnd - aboveKnee)).toBeLessThan(0.02);
    });

    it('never reduces by a negative amount', () => {
        for (let input = -60; input <= 0; input += 3) {
            expect(gainReductionAt(input, -20, 4, 6)).toBeGreaterThanOrEqual(0);
        }
    });

    it('says a floor rather than NaN for a bad input', () => {
        expect(compressLevel(Number.NaN, -20, 4, 0)).toBe(-60);
    });
});

describe('the limiter', () => {
    it('does nothing when it is off', () => {
        expect(limitLevel(-2, -6, false)).toBe(-2);
    });

    it('stops anything above its threshold', () => {
        expect(limitLevel(-2, -6, true)).toBe(-6);
        expect(limitLevel(-12, -6, true)).toBe(-12);
    });
});

describe('auto gain', () => {
    it('adds nothing when it is off', () => {
        expect(autoMakeupDb('off', -20, 4, 0)).toBe(0);
    });

    it('brings full scale back to the target', () => {
        // 0 dBFS loses 15 dB at -20/4:1, so 0 dB target asks for 15 back.
        expect(autoMakeupDb('0db', -20, 4, 0)).toBeCloseTo(15);
        expect(autoMakeupDb('-12db', -20, 4, 0)).toBeCloseTo(3);
    });

    it('asks for more the harder the compression', () => {
        const gentle = autoMakeupDb('0db', -10, 2, 0);
        const heavy = autoMakeupDb('0db', -30, 10, 0);
        expect(heavy).toBeGreaterThan(gentle);
    });

    it('stays inside a sane range even at extreme settings', () => {
        expect(autoMakeupDb('0db', -60, 30, 0)).toBeLessThanOrEqual(24);
    });
});

describe('the graph', () => {
    it('runs from -60 dBFS to 0', () => {
        const points = transferCurve(-20, 4, 0, 0, { enabled: false, threshold: 0 });
        expect(points[0].inputDb).toBeCloseTo(-60);
        expect(points[points.length - 1].inputDb).toBeCloseTo(0);
    });

    it('never turns back on itself', () => {
        // More input must never produce less output, or the graph would
        // describe something no compressor does.
        const points = transferCurve(-24, 6, 8, 4, { enabled: false, threshold: 0 });
        for (let i = 1; i < points.length; i++) {
            expect(points[i].outputDb).toBeGreaterThanOrEqual(points[i - 1].outputDb - 1e-9);
        }
    });

    it('flattens where the limiter takes over', () => {
        const points = transferCurve(-30, 2, 0, 12, { enabled: true, threshold: -6 });
        expect(Math.max(...points.map(p => p.outputDb))).toBeCloseTo(-6);
    });
});

describe('meters', () => {
    it('reads full scale as 0 dB and silence as the floor', () => {
        expect(amplitudeToDb(1)).toBeCloseTo(0);
        expect(amplitudeToDb(0)).toBe(-60);
        expect(amplitudeToDb(0.5)).toBeCloseTo(-6.02, 1);
    });

    it('maps a level onto the meter without running off either end', () => {
        expect(meterFraction(-60)).toBe(0);
        expect(meterFraction(6)).toBe(1);
        expect(meterFraction(-100)).toBe(0);
        expect(meterFraction(20)).toBe(1);
        expect(meterFraction(Number.NaN)).toBe(0);
    });
});

describe('character models', () => {
    it('offers the seven the editor shows', () => {
        expect(COMPRESSOR_MODELS).toHaveLength(7);
        for (const model of COMPRESSOR_MODELS) {
            expect(MODEL_PROFILES[model.id]).toBeDefined();
        }
    });

    it('gives each one a distinct feel, not just a different name', () => {
        // If two models had identical profiles the choice would be cosmetic.
        const signatures = COMPRESSOR_MODELS.map(m => JSON.stringify(MODEL_PROFILES[m.id]));
        expect(new Set(signatures).size).toBe(signatures.length);
    });

    it('makes an Opto slower than a FET', () => {
        expect(MODEL_PROFILES['vintage-opto'].attackScale)
            .toBeGreaterThan(MODEL_PROFILES['vintage-fet'].attackScale);
        expect(MODEL_PROFILES['vintage-opto'].releaseScale)
            .toBeGreaterThan(MODEL_PROFILES['vintage-fet'].releaseScale);
    });

    it('falls back rather than returning undefined for an unknown model', () => {
        expect(modelProfile('nonsense')).toBe(MODEL_PROFILES.platinum);
    });
});
