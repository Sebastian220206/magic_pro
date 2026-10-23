/**
 * expanderCore.ts
 * Downward expansion: signals below the threshold are pushed further down.
 *
 * A gate's sibling with manners — where a gate slams to a floor, an expander
 * turns down proportionally (2:1 halves the distance below the threshold in
 * dB, 10:1 nearly gates), so room tone breathes instead of chattering. Same
 * per-sample envelope requirement as the gate, hence the same AudioWorklet
 * home; see `gateCore.ts` for why the helpers below are duplicated rather
 * than shared.
 */

/** Node registration name, shared by the loader and the processor. */
export const EXPANDER_PROCESSOR = 'magic-expander';

export interface ExpanderParams {
    /** Level below which expansion begins, dBFS. */
    thresholdDb: number;
    /** 1 = no expansion, 2 = gentle, 10 = nearly a gate. */
    ratio: number;
    attackMs: number;
    releaseMs: number;
}

export const DEFAULT_EXPANDER_PARAMS: ExpanderParams = {
    thresholdDb: -24,
    ratio: 2,
    attackMs: 5,
    releaseMs: 120,
};

// ── Pure DSP (serialised into the worklet verbatim) ────────────────────────

export function expanderSmoothingCoefficient(timeMs: number, sampleRate: number): number {
    if (!(timeMs > 0) || !(sampleRate > 0)) return 0;
    return Math.exp(-1 / ((timeMs / 1000) * sampleRate));
}

export function expanderDbToAmplitude(db: number): number {
    return Math.pow(10, db / 20);
}

/**
 * Gain reduction in dB (≤ 0) for an input level.
 *
 * Below the threshold the output is pushed `ratio` times further below it:
 * with the threshold at −24 and a 3:1 ratio, −34 in comes out at −54. Above
 * the threshold (or at 1:1) the signal passes untouched.
 */
export function expanderReductionDb(
    levelDb: number,
    thresholdDb: number,
    ratio: number,
): number {
    if (!Number.isFinite(levelDb)) return 0;
    if (ratio <= 1) return 0;
    const over = levelDb - thresholdDb;
    if (over >= 0) return 0;
    return over * (ratio - 1);
}

export interface ExpanderState {
    /** Peak-following envelope, linear amplitude. */
    env: number;
    /** Currently applied gain, linear amplitude. */
    gain: number;
}

export function createExpanderState(): ExpanderState {
    return { env: 0, gain: 1 };
}

/**
 * Process one block.
 *
 * Linked stereo like the gate: the envelope follows the loudest channel and
 * one gain rides every channel.
 *
 * Returns the current reduction in dB (≤ 0), for metering.
 */
export function processExpanderBlock(
    state: ExpanderState,
    main: Float32Array[],
    output: Float32Array[],
    params: ExpanderParams,
    sampleRate: number,
): number {
    const channels = Math.min(main.length, output.length);
    if (channels === 0) return 0;
    const frames = Math.min(main[0].length, output[0].length);

    const attackCoef = expanderSmoothingCoefficient(params.attackMs, sampleRate);
    const releaseCoef = expanderSmoothingCoefficient(params.releaseMs, sampleRate);
    const ratio = Math.max(1, params.ratio);
    let reductionDb = 0;

    for (let i = 0; i < frames; i++) {
        let peak = 0;
        for (let c = 0; c < channels; c++) {
            const value = Math.abs(main[c][i]);
            if (value > peak) peak = value;
        }

        const coef = peak > state.env ? attackCoef : releaseCoef;
        state.env = peak + coef * (state.env - peak);

        const levelDb = state.env > 0.000001 ? 20 * Math.log10(state.env) : -120;
        const targetDb = expanderReductionDb(levelDb, params.thresholdDb, ratio);
        const target = expanderDbToAmplitude(targetDb);
        const gCoef = target < state.gain ? attackCoef : releaseCoef;
        state.gain = target + gCoef * (state.gain - target);
        reductionDb = targetDb;

        for (let c = 0; c < channels; c++) {
            output[c][i] = main[c][i] * state.gain;
        }
    }

    return reductionDb;
}

// ── Worklet source ─────────────────────────────────────────────────────────

const EXPANDER_SHELL = `
const PARAM_DESCRIPTORS = [
    { name: 'thresholdDb', defaultValue: -24, minValue: -60, maxValue: 0, automationRate: 'k-rate' },
    { name: 'ratio',       defaultValue: 2,   minValue: 1,   maxValue: 10, automationRate: 'k-rate' },
    { name: 'attackMs',    defaultValue: 5,   minValue: 0.01, maxValue: 100, automationRate: 'k-rate' },
    { name: 'releaseMs',   defaultValue: 120, minValue: 10,  maxValue: 1000, automationRate: 'k-rate' },
];

class ExpanderProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() { return PARAM_DESCRIPTORS; }

    constructor() {
        super();
        this.state = createExpanderState();
        this.framesSinceReport = 0;
        this.lastReduction = 0;
    }

    process(inputs, outputs, parameters) {
        const main = inputs[0];
        const output = outputs[0];
        if (!main || main.length === 0 || !output || output.length === 0) return true;

        const read = (name, fallback) => {
            const array = parameters[name];
            return (array && array.length > 0) ? array[0] : fallback;
        };

        const reduction = processExpanderBlock(this.state, main, output, {
            thresholdDb: read('thresholdDb', -24),
            ratio: read('ratio', 2),
            attackMs: read('attackMs', 5),
            releaseMs: read('releaseMs', 120),
        }, sampleRate);

        this.lastReduction = reduction;
        this.framesSinceReport += output[0].length;
        if (this.framesSinceReport >= 2048) {
            this.framesSinceReport = 0;
            this.port.postMessage({ type: 'reduction', db: this.lastReduction });
        }

        return true;
    }
}

registerProcessor('${EXPANDER_PROCESSOR}', ExpanderProcessor);
`;

/**
 * The complete worklet module source.
 *
 * The DSP is serialised from the exported functions, so the code running on
 * the audio thread is the same code the tests exercise.
 */
export function buildExpanderWorkletSource(): string {
    return [
        expanderSmoothingCoefficient.toString(),
        expanderDbToAmplitude.toString(),
        expanderReductionDb.toString(),
        createExpanderState.toString(),
        processExpanderBlock.toString(),
        EXPANDER_SHELL,
    ].join('\n\n');
}
