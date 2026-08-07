/**
 * sidechainCompressorCore.ts
 * A feed-forward compressor whose detector can be keyed from a second input.
 *
 * Web Audio's `DynamicsCompressorNode` has one input, so the kick-ducks-the-sub
 * move that this genre is built on was previously faked with an envelope
 * follower driving the target's fader — control-rate, and it moved the fader
 * rather than compressing. This is the real thing: an `AudioWorkletProcessor`
 * with a second input, computing gain reduction per sample.
 *
 * **One implementation.** The DSP below is serialised into the worklet with
 * `Function.prototype.toString()` (the same technique `@webaudiomodules/sdk`
 * uses for `addFunctionModule`, already used by `wamHost.ts`). Writing a
 * separate `.js` under `public/worklets/` would fork the maths between the
 * shipped processor and anything tested, and the two would drift.
 *
 * Every function here must therefore be **self-contained** — no references to
 * module scope, which does not exist inside an `AudioWorkletGlobalScope`.
 */

/** Node registration name, shared by the loader and the processor. */
export const SIDECHAIN_COMPRESSOR_PROCESSOR = 'magic-sidechain-compressor';

export interface SidechainCompressorParams {
    /** Level above which reduction begins, dBFS. */
    thresholdDb: number;
    /** 1 = no compression. 4 means 4 dB in, 1 dB out above the threshold. */
    ratio: number;
    attackMs: number;
    releaseMs: number;
    /** Width of the soft knee, dB. 0 is a hard knee. */
    kneeDb: number;
    /** Output gain applied after compression, dB. */
    makeupDb: number;
    /** 0 = dry, 1 = fully compressed. Below 1 is parallel compression. */
    mix: number;
    /**
     * Delays the main signal so reduction is already in place when a transient
     * arrives. Costs latency, which is reported for delay compensation.
     */
    lookaheadMs: number;
}

export const DEFAULT_SIDECHAIN_PARAMS: SidechainCompressorParams = {
    thresholdDb: -24,
    ratio: 4,
    attackMs: 5,
    releaseMs: 120,
    kneeDb: 6,
    makeupDb: 0,
    mix: 1,
    lookaheadMs: 0,
};

// ── Pure DSP (serialised into the worklet verbatim) ────────────────────────

/**
 * Static compressor curve: gain reduction in dB (≤ 0) for an input level.
 *
 * Soft knee per Reiss & McPherson: below the knee the signal passes untouched,
 * inside it the ratio is interpolated quadratically, above it the full ratio
 * applies. A hard knee (`kneeDb` 0) is the same expression with the middle
 * branch collapsed.
 */
export function compressorGainDb(
    levelDb: number,
    thresholdDb: number,
    ratio: number,
    kneeDb: number,
): number {
    if (!Number.isFinite(levelDb)) return 0;
    if (ratio <= 1) return 0;

    const over = levelDb - thresholdDb;
    const knee = Math.max(0, kneeDb);

    if (over <= -knee / 2) return 0;

    if (knee > 0 && over < knee / 2) {
        const x = over + knee / 2;
        // Quadratic blend from 1:1 to the full ratio across the knee.
        return ((1 / ratio - 1) * x * x) / (2 * knee);
    }

    return over * (1 / ratio - 1);
}

/**
 * One-pole smoothing coefficient for a time constant.
 *
 * Returns 0 for a zero time so the envelope jumps immediately, rather than
 * producing a NaN from a division by zero.
 */
export function smoothingCoefficient(timeMs: number, sampleRate: number): number {
    if (!(timeMs > 0) || !(sampleRate > 0)) return 0;
    return Math.exp(-1 / ((timeMs / 1000) * sampleRate));
}

const DB_FLOOR = -120;

/** Linear amplitude to dBFS, floored so silence does not produce -Infinity. */
export function amplitudeToDb(amplitude: number): number {
    const magnitude = Math.abs(amplitude);
    return magnitude > 1e-6 ? 20 * Math.log10(magnitude) : DB_FLOOR;
}

export const dbToAmplitude = (db: number) => Math.pow(10, db / 20);

/**
 * Process one block.
 *
 * `state` carries the envelope and lookahead delay line between calls. Mutated
 * in place — this runs on the audio thread, where allocation is not free.
 *
 * `key` is the detector input: the sidechain when one is connected, otherwise
 * the main signal (which makes this an ordinary compressor).
 */
export function processCompressorBlock(
    state: CompressorState,
    main: Float32Array[],
    key: Float32Array[],
    output: Float32Array[],
    params: SidechainCompressorParams,
    sampleRate: number,
): void {
    const frames = main[0]?.length ?? 0;
    if (frames === 0) return;

    const attack = smoothingCoefficient(params.attackMs, sampleRate);
    const release = smoothingCoefficient(params.releaseMs, sampleRate);
    const makeup = Math.pow(10, params.makeupDb / 20);
    const mix = Math.max(0, Math.min(1, params.mix));

    const lookaheadSamples = Math.max(
        0, Math.round((params.lookaheadMs / 1000) * sampleRate));
    const useLookahead = lookaheadSamples > 0 && state.delayLine.length > 0;

    for (let i = 0; i < frames; i++) {
        // Detector: peak across the key's channels.
        let keyPeak = 0;
        for (let c = 0; c < key.length; c++) {
            const sample = key[c][i];
            const magnitude = sample < 0 ? -sample : sample;
            if (magnitude > keyPeak) keyPeak = magnitude;
        }

        const levelDb = keyPeak > 1e-6 ? 20 * Math.log10(keyPeak) : -120;
        const targetDb = compressorGainDb(
            levelDb, params.thresholdDb, params.ratio, params.kneeDb);

        // Branching smoother in the dB domain: more reduction uses the attack
        // coefficient, recovery uses release. Smoothing linear gain instead
        // would make the timing level-dependent.
        const coefficient = targetDb < state.envelopeDb ? attack : release;
        state.envelopeDb = coefficient === 0
            ? targetDb
            : coefficient * state.envelopeDb + (1 - coefficient) * targetDb;

        const gain = Math.pow(10, state.envelopeDb / 20) * makeup;

        for (let c = 0; c < output.length; c++) {
            const source = main[Math.min(c, main.length - 1)];
            let dry = source[i];

            if (useLookahead) {
                // Read the delayed sample first, then overwrite the slot: the
                // signal is delayed while the detector is not, so reduction is
                // already applied when the transient arrives.
                const line = state.delayLine[c];
                if (line) {
                    const readIndex = state.delayIndex;
                    const delayed = line[readIndex];
                    line[readIndex] = dry;
                    dry = delayed;
                }
            }

            output[c][i] = dry * gain * mix + dry * (1 - mix);
        }

        if (useLookahead) {
            state.delayIndex = (state.delayIndex + 1) % lookaheadSamples;
        }
    }
}

// ── State ──────────────────────────────────────────────────────────────────

export interface CompressorState {
    /** Current gain reduction, dB (≤ 0). */
    envelopeDb: number;
    delayLine: Float32Array[];
    delayIndex: number;
}

export function createCompressorState(
    channels = 2,
    lookaheadSamples = 0,
): CompressorState {
    return {
        envelopeDb: 0,
        delayLine: lookaheadSamples > 0
            ? Array.from({ length: channels }, () => new Float32Array(lookaheadSamples))
            : [],
        delayIndex: 0,
    };
}

// ── Worklet source ─────────────────────────────────────────────────────────

/**
 * The processor shell.
 *
 * Deliberately a plain string rather than a stringified function: it is pure
 * boilerplate — parameter descriptors, input wiring, message plumbing — with no
 * DSP in it, so there is nothing here that can drift from the tested code. The
 * maths is concatenated in above it, serialised from the functions this module
 * exports and this file's tests exercise.
 *
 * `AudioWorkletProcessor`, `registerProcessor` and `sampleRate` are globals of
 * `AudioWorkletGlobalScope`.
 */
const PROCESSOR_SHELL = `
const PARAM_DESCRIPTORS = [
    { name: 'thresholdDb', defaultValue: -24,  minValue: -100, maxValue: 0,    automationRate: 'k-rate' },
    { name: 'ratio',       defaultValue: 4,    minValue: 1,    maxValue: 20,   automationRate: 'k-rate' },
    { name: 'attackMs',    defaultValue: 5,    minValue: 0,    maxValue: 500,  automationRate: 'k-rate' },
    { name: 'releaseMs',   defaultValue: 120,  minValue: 1,    maxValue: 5000, automationRate: 'k-rate' },
    { name: 'kneeDb',      defaultValue: 6,    minValue: 0,    maxValue: 40,   automationRate: 'k-rate' },
    { name: 'makeupDb',    defaultValue: 0,    minValue: -24,  maxValue: 24,   automationRate: 'k-rate' },
    { name: 'mix',         defaultValue: 1,    minValue: 0,    maxValue: 1,    automationRate: 'k-rate' },
];

class SidechainCompressorProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() { return PARAM_DESCRIPTORS; }

    constructor() {
        super();
        this.state = createCompressorState(2, 0);
        this.lookaheadMs = 0;
        this.framesSinceReport = 0;

        this.port.onmessage = (event) => {
            const data = event.data || {};
            if (data.type === 'lookahead') {
                this.lookaheadMs = Math.max(0, Math.min(50, data.lookaheadMs || 0));
                const samples = Math.round((this.lookaheadMs / 1000) * sampleRate);
                this.state = createCompressorState(2, samples);
            }
        };
    }

    process(inputs, outputs, parameters) {
        const main = inputs[0];
        const sidechain = inputs[1];
        const output = outputs[0];
        if (!main || main.length === 0 || !output || output.length === 0) return true;

        // With nothing patched into input 1, key off the main signal: the node
        // then behaves as an ordinary compressor rather than going silent.
        const key = (sidechain && sidechain.length > 0) ? sidechain : main;

        const read = (name, fallback) => {
            const array = parameters[name];
            return (array && array.length > 0) ? array[0] : fallback;
        };

        processCompressorBlock(this.state, main, key, output, {
            thresholdDb: read('thresholdDb', -24),
            ratio: read('ratio', 4),
            attackMs: read('attackMs', 5),
            releaseMs: read('releaseMs', 120),
            kneeDb: read('kneeDb', 6),
            makeupDb: read('makeupDb', 0),
            mix: read('mix', 1),
            lookaheadMs: this.lookaheadMs,
        }, sampleRate);

        // Report gain reduction ~20x a second, so a meter can follow it without
        // flooding the message port.
        this.framesSinceReport += output[0].length;
        if (this.framesSinceReport >= 2048) {
            this.framesSinceReport = 0;
            this.port.postMessage({ type: 'reduction', db: this.state.envelopeDb });
        }

        return true;
    }
}

registerProcessor('${SIDECHAIN_COMPRESSOR_PROCESSOR}', SidechainCompressorProcessor);
`;

/**
 * The complete worklet module source.
 *
 * The DSP is serialised from the exported functions, so the code running on the
 * audio thread is the same code the tests exercise. Type annotations are gone
 * by this point — both `tsc` and ts-jest erase them before `toString()` can see
 * them — so no post-processing is needed.
 */
export function buildSidechainWorkletSource(): string {
    return [
        compressorGainDb.toString(),
        smoothingCoefficient.toString(),
        processCompressorBlock.toString(),
        createCompressorState.toString(),
        PROCESSOR_SHELL,
    ].join('\n\n');
}
