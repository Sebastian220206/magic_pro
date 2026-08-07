/**
 * The sidechain compressor's DSP.
 *
 * This is the code that runs on the audio thread — `buildSidechainWorkletSource`
 * serialises these exact functions into the worklet — so testing it here tests
 * what ships.
 */

import {
    compressorGainDb,
    smoothingCoefficient,
    amplitudeToDb,
    dbToAmplitude,
    processCompressorBlock,
    createCompressorState,
    buildSidechainWorkletSource,
    SIDECHAIN_COMPRESSOR_PROCESSOR,
    DEFAULT_SIDECHAIN_PARAMS,
    type SidechainCompressorParams,
} from '../sidechainCompressorCore';

const SR = 48000;

const params = (over: Partial<SidechainCompressorParams> = {}): SidechainCompressorParams =>
    ({ ...DEFAULT_SIDECHAIN_PARAMS, ...over });

/** A block of constant amplitude. */
const block = (amp: number, frames = 128) =>
    [new Float32Array(frames).fill(amp), new Float32Array(frames).fill(amp)];

const empty = (frames = 128) =>
    [new Float32Array(frames), new Float32Array(frames)];

/** Run `blocks` blocks and return the final output block plus the envelope. */
function run(
    mainAmp: number,
    keyAmp: number,
    p: SidechainCompressorParams,
    blocks = 1,
    frames = 128,
) {
    const state = createCompressorState(2, Math.round((p.lookaheadMs / 1000) * SR));
    let out = empty(frames);
    for (let i = 0; i < blocks; i++) {
        out = empty(frames);
        processCompressorBlock(state, block(mainAmp, frames), block(keyAmp, frames), out, p, SR);
    }
    return { out, state };
}

// ── Static curve ───────────────────────────────────────────────────────────

describe('compressorGainDb', () => {
    it('leaves a signal below the knee untouched', () => {
        expect(compressorGainDb(-40, -24, 4, 0)).toBe(0);
        expect(compressorGainDb(-30, -24, 4, 6)).toBe(0);   // -30 is below -24-3
    });

    it('applies the ratio above the knee', () => {
        // 12 dB over at 4:1 leaves 3 dB over, so 9 dB of reduction.
        expect(compressorGainDb(-12, -24, 4, 0)).toBeCloseTo(-9, 6);
        // 10 dB over at 2:1 leaves 5 dB, so 5 dB of reduction.
        expect(compressorGainDb(-14, -24, 2, 0)).toBeCloseTo(-5, 6);
    });

    it('approaches a limiter at a high ratio', () => {
        const reduction = compressorGainDb(-4, -24, 20, 0);
        expect(reduction).toBeCloseTo(-19, 0);
    });

    it('does nothing at 1:1 or below', () => {
        expect(compressorGainDb(0, -24, 1, 6)).toBe(0);
        expect(compressorGainDb(0, -24, 0.5, 6)).toBe(0);
    });

    it('is continuous across a soft knee', () => {
        const knee = 6, threshold = -24, ratio = 4;
        // Sample either side of both knee edges; no step should appear.
        const at = (db: number) => compressorGainDb(db, threshold, ratio, knee);
        const lower = threshold - knee / 2;
        const upper = threshold + knee / 2;

        expect(Math.abs(at(lower - 0.01) - at(lower + 0.01))).toBeLessThan(0.05);
        expect(Math.abs(at(upper - 0.01) - at(upper + 0.01))).toBeLessThan(0.05);
    });

    it('reduces more inside a soft knee than a hard one would', () => {
        // Just under the threshold: a hard knee does nothing, a soft knee is
        // already easing in.
        expect(compressorGainDb(-25, -24, 4, 6)).toBeLessThan(0);
        expect(compressorGainDb(-25, -24, 4, 0)).toBe(0);
    });

    it('is monotonic — a louder input never reduces less', () => {
        let previous = 0;
        for (let db = -60; db <= 0; db += 0.5) {
            const reduction = compressorGainDb(db, -24, 4, 6);
            expect(reduction).toBeLessThanOrEqual(previous + 1e-9);
            previous = reduction;
        }
    });

    it('survives a non-finite level', () => {
        expect(compressorGainDb(-Infinity, -24, 4, 6)).toBe(0);
        expect(compressorGainDb(NaN, -24, 4, 6)).toBe(0);
    });
});

describe('smoothingCoefficient', () => {
    it('is 0 for an instant time, so the envelope jumps', () => {
        expect(smoothingCoefficient(0, SR)).toBe(0);
        expect(smoothingCoefficient(-5, SR)).toBe(0);
    });

    it('rises toward 1 as the time constant lengthens', () => {
        const fast = smoothingCoefficient(1, SR);
        const slow = smoothingCoefficient(200, SR);
        expect(fast).toBeGreaterThan(0);
        expect(slow).toBeGreaterThan(fast);
        expect(slow).toBeLessThan(1);
    });

    it('guards a zero sample rate', () => {
        expect(smoothingCoefficient(10, 0)).toBe(0);
    });
});

describe('dB conversion', () => {
    it('round-trips', () => {
        expect(amplitudeToDb(1)).toBeCloseTo(0, 6);
        expect(amplitudeToDb(0.5)).toBeCloseTo(-6.02, 1);
        expect(dbToAmplitude(amplitudeToDb(0.25))).toBeCloseTo(0.25, 6);
    });

    it('floors silence instead of returning -Infinity', () => {
        expect(amplitudeToDb(0)).toBe(-120);
        expect(Number.isFinite(amplitudeToDb(0))).toBe(true);
    });
});

// ── Block processing ───────────────────────────────────────────────────────

describe('processCompressorBlock', () => {
    it('ducks the main signal when the key is loud', () => {
        const { out } = run(0.5, 0.9, params({ attackMs: 0 }), 4);
        expect(out[0][127]).toBeLessThan(0.5);
        expect(out[0][127]).toBeGreaterThan(0);
    });

    it('leaves the main signal alone when the key is quiet', () => {
        const { out } = run(0.5, 0.0001, params({ attackMs: 0 }), 4);
        expect(out[0][127]).toBeCloseTo(0.5, 4);
    });

    it('ducks harder as the key gets louder', () => {
        const quiet = run(0.5, 0.2, params({ attackMs: 0 }), 8).out[0][127];
        const loud = run(0.5, 0.95, params({ attackMs: 0 }), 8).out[0][127];
        expect(loud).toBeLessThan(quiet);
    });

    it('is keyed by the sidechain, not by the main signal', () => {
        // Loud main, silent key: an ordinary compressor would reduce here.
        const state = createCompressorState(2, 0);
        const out = empty();
        processCompressorBlock(
            state, block(0.95), block(0.0001), out, params({ attackMs: 0 }), SR);

        expect(out[0][127]).toBeCloseTo(0.95, 3);
        expect(state.envelopeDb).toBeCloseTo(0, 3);
    });

    it('reaches deeper reduction over time with a slow attack', () => {
        const p = params({ attackMs: 50, ratio: 8, thresholdDb: -30 });
        const state = createCompressorState(2, 0);

        const first = empty();
        processCompressorBlock(state, block(0.5), block(0.9), first, p, SR);
        const afterOne = state.envelopeDb;

        for (let i = 0; i < 40; i++) {
            processCompressorBlock(state, block(0.5), block(0.9), empty(), p, SR);
        }
        expect(state.envelopeDb).toBeLessThan(afterOne);
    });

    it('recovers when the key stops', () => {
        const p = params({ attackMs: 0, releaseMs: 20 });
        const state = createCompressorState(2, 0);

        for (let i = 0; i < 4; i++) {
            processCompressorBlock(state, block(0.5), block(0.9), empty(), p, SR);
        }
        const ducked = state.envelopeDb;
        expect(ducked).toBeLessThan(-0.5);

        for (let i = 0; i < 60; i++) {
            processCompressorBlock(state, block(0.5), block(0), empty(), p, SR);
        }
        expect(state.envelopeDb).toBeGreaterThan(ducked);
        expect(state.envelopeDb).toBeCloseTo(0, 1);
    });

    it('attacks faster than it releases at typical settings', () => {
        const p = params({ attackMs: 1, releaseMs: 300, ratio: 8, thresholdDb: -30 });

        const attacking = createCompressorState(2, 0);
        processCompressorBlock(attacking, block(0.5), block(0.9), empty(), p, SR);
        const attackTravel = Math.abs(attacking.envelopeDb);

        const releasing = createCompressorState(2, 0);
        releasing.envelopeDb = attacking.envelopeDb;
        processCompressorBlock(releasing, block(0.5), block(0), empty(), p, SR);
        const releaseTravel = Math.abs(releasing.envelopeDb - attacking.envelopeDb);

        expect(attackTravel).toBeGreaterThan(releaseTravel);
    });

    it('applies makeup gain', () => {
        const plain = run(0.3, 0.0001, params({ attackMs: 0 }), 2).out[0][127];
        const boosted = run(0.3, 0.0001, params({ attackMs: 0, makeupDb: 6 }), 2).out[0][127];
        expect(boosted / plain).toBeCloseTo(2, 1);
    });

    it('passes the signal through untouched at mix 0', () => {
        const { out } = run(0.5, 0.95, params({ attackMs: 0, mix: 0 }), 4);
        expect(out[0][127]).toBeCloseTo(0.5, 6);
    });

    it('blends for parallel compression at mix 0.5', () => {
        const p = params({ attackMs: 0, ratio: 8, thresholdDb: -30 });
        const full = run(0.5, 0.95, { ...p, mix: 1 }, 4).out[0][127];
        const half = run(0.5, 0.95, { ...p, mix: 0.5 }, 4).out[0][127];

        expect(half).toBeGreaterThan(full);
        expect(half).toBeLessThan(0.5);
    });

    it('delays the signal by the lookahead', () => {
        const lookaheadMs = 1;
        const lookaheadSamples = Math.round((lookaheadMs / 1000) * SR);
        const p = params({ attackMs: 0, ratio: 1, lookaheadMs });

        const state = createCompressorState(2, lookaheadSamples);
        const frames = 256;

        // An impulse at the top of the block should emerge `lookahead` later.
        const main = empty(frames);
        main[0][0] = 1;
        main[1][0] = 1;

        const out = empty(frames);
        processCompressorBlock(state, main, empty(frames), out, p, SR);

        expect(out[0][0]).toBe(0);
        expect(out[0][lookaheadSamples]).toBeCloseTo(1, 6);
    });

    it('handles an empty block', () => {
        const state = createCompressorState(2, 0);
        expect(() => processCompressorBlock(
            state, [new Float32Array(0)], [new Float32Array(0)],
            [new Float32Array(0)], params(), SR,
        )).not.toThrow();
    });

    it('handles a mono main against a stereo key', () => {
        const state = createCompressorState(2, 0);
        const out = [new Float32Array(128)];
        expect(() => processCompressorBlock(
            state, [new Float32Array(128).fill(0.5)], block(0.9), out, params(), SR,
        )).not.toThrow();
        expect(out[0][127]).toBeGreaterThan(0);
    });

    it('never produces a non-finite sample', () => {
        const { out } = run(0.8, 1, params({ attackMs: 0, ratio: 20, makeupDb: 12 }), 8);
        expect(out[0].every(Number.isFinite)).toBe(true);
    });
});

// ── Worklet source ─────────────────────────────────────────────────────────

describe('buildSidechainWorkletSource', () => {
    const source = buildSidechainWorkletSource();

    it('registers under the shared processor name', () => {
        expect(source).toContain(`registerProcessor('${SIDECHAIN_COMPRESSOR_PROCESSOR}'`);
    });

    it('carries the tested DSP rather than a copy of it', () => {
        for (const name of [
            'function compressorGainDb',
            'function smoothingCoefficient',
            'function processCompressorBlock',
            'function createCompressorState',
        ]) {
            expect(source).toContain(name);
        }
    });

    it('declares a second input by keying off inputs[1]', () => {
        expect(source).toContain('inputs[1]');
    });

    it('exposes the compressor controls as parameters', () => {
        for (const name of ['thresholdDb', 'ratio', 'attackMs', 'releaseMs', 'kneeDb', 'makeupDb', 'mix']) {
            expect(source).toContain(`'${name}'`);
        }
    });

    it('is free of TypeScript syntax that would not parse in a worklet', () => {
        // Annotations are erased before `toString()` sees them; if that ever
        // stops being true this catches it before the browser does.
        expect(source).not.toMatch(/:\s*Float32Array\[\]/);
        expect(source).not.toMatch(/\binterface\b/);
        expect(source).not.toMatch(/\bas never\b/);
    });

    it('parses as valid JavaScript', () => {
        // Compile without running: the worklet globals do not exist here.
        expect(() => new Function(`if (false) { ${source} }`)).not.toThrow();
    });
});
