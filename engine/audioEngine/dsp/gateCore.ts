/**
 * gateCore.ts
 * A downward gate with hysteresis, hold and a floor.
 *
 * A gate is not a fast compressor: below the threshold it closes to a floor
 * rather than turning down proportionally, it waits out short dips (hold)
 * instead of chattering, and it opens and closes at different levels
 * (hysteresis) so a decaying tail does not machine-gun. All three behaviours
 * need per-sample envelope state, which is why this is an AudioWorklet and
 * not a `DynamicsCompressorNode` preset.
 *
 * **One implementation.** The DSP below is serialised into the worklet with
 * `Function.prototype.toString()`, the same technique `sidechainCompressorCore`
 * documents. Every function here must therefore be **self-contained** — no
 * references to module scope, which does not exist inside an
 * `AudioWorkletGlobalScope`. The small helpers are duplicated from the
 * sidechain core on purpose; sharing them would break the serialisation.
 */

/** Node registration name, shared by the loader and the processor. */
export const GATE_PROCESSOR = 'magic-gate';

export interface GateParams {
    /** Level that opens the gate, dBFS. */
    thresholdDb: number;
    attackMs: number;
    /** Time the gate stays open after the signal drops, ms. */
    holdMs: number;
    releaseMs: number;
    /** Output level while closed, dBFS. */
    floorDb: number;
}

export const DEFAULT_GATE_PARAMS: GateParams = {
    thresholdDb: -24,
    attackMs: 1,
    holdMs: 50,
    releaseMs: 150,
    floorDb: -80,
};

/** Gap between the opening and closing thresholds, dB. Mirrored as a literal
 * inside `processGateBlock`, which cannot see module scope when serialised. */
export const GATE_HYSTERESIS_DB = 2;

// ── Pure DSP (serialised into the worklet verbatim) ────────────────────────

export function gateSmoothingCoefficient(timeMs: number, sampleRate: number): number {
    if (!(timeMs > 0) || !(sampleRate > 0)) return 0;
    return Math.exp(-1 / ((timeMs / 1000) * sampleRate));
}

export function gateDbToAmplitude(db: number): number {
    return Math.pow(10, db / 20);
}

export interface GateState {
    /** Peak-following envelope, linear amplitude. */
    env: number;
    /** Samples of hold remaining. */
    holdLeft: number;
    /** Currently applied gain, linear amplitude. */
    gain: number;
    open: boolean;
}

export function createGateState(): GateState {
    return { env: 0, holdLeft: 0, gain: 0, open: false };
}

/**
 * Process one block.
 *
 * The detector is linked: it follows the loudest channel and one gain rides
 * every channel, so a loud left cannot leave a quiet right gated.
 *
 * Returns whether the gate is open at the end of the block, for metering.
 */
export function processGateBlock(
    state: GateState,
    main: Float32Array[],
    output: Float32Array[],
    params: GateParams,
    sampleRate: number,
): boolean {
    const channels = Math.min(main.length, output.length);
    if (channels === 0) return state.open;
    const frames = Math.min(main[0].length, output[0].length);

    const thresh = gateDbToAmplitude(params.thresholdDb);
    // Hysteresis is a literal, not the exported constant: this function is
    // serialised into the worklet, where module scope does not exist.
    const closeAt = gateDbToAmplitude(params.thresholdDb - 2);
    const floorLin = gateDbToAmplitude(params.floorDb);
    const attackCoef = gateSmoothingCoefficient(params.attackMs, sampleRate);
    const releaseCoef = gateSmoothingCoefficient(params.releaseMs, sampleRate);
    const holdSamples = Math.max(0, Math.round((params.holdMs / 1000) * sampleRate));

    for (let i = 0; i < frames; i++) {
        let peak = 0;
        for (let c = 0; c < channels; c++) {
            const value = Math.abs(main[c][i]);
            if (value > peak) peak = value;
        }

        const coef = peak > state.env ? attackCoef : releaseCoef;
        state.env = peak + coef * (state.env - peak);

        if (state.open) {
            if (state.env < closeAt) {
                // Hold first: a drummer's ghost notes must not flap the gate.
                if (state.holdLeft > 0) state.holdLeft--;
                else state.open = false;
            } else {
                state.holdLeft = holdSamples;
            }
        } else if (state.env > thresh) {
            state.open = true;
            state.holdLeft = holdSamples;
        }

        const target = state.open ? 1 : floorLin;
        const gCoef = target > state.gain ? attackCoef : releaseCoef;
        state.gain = target + gCoef * (state.gain - target);

        for (let c = 0; c < channels; c++) {
            output[c][i] = main[c][i] * state.gain;
        }
    }

    return state.open;
}

// ── Worklet source ─────────────────────────────────────────────────────────

const GATE_SHELL = `
const PARAM_DESCRIPTORS = [
    { name: 'thresholdDb', defaultValue: -24, minValue: -60, maxValue: 0,   automationRate: 'k-rate' },
    { name: 'attackMs',    defaultValue: 1,   minValue: 0.01, maxValue: 100, automationRate: 'k-rate' },
    { name: 'holdMs',      defaultValue: 50,  minValue: 0,    maxValue: 500, automationRate: 'k-rate' },
    { name: 'releaseMs',   defaultValue: 150, minValue: 10,   maxValue: 1000, automationRate: 'k-rate' },
    { name: 'floorDb',     defaultValue: -80, minValue: -80,  maxValue: 0,   automationRate: 'k-rate' },
];

class GateProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() { return PARAM_DESCRIPTORS; }

    constructor() {
        super();
        this.state = createGateState();
        this.wasOpen = false;
    }

    process(inputs, outputs, parameters) {
        const main = inputs[0];
        const output = outputs[0];
        if (!main || main.length === 0 || !output || output.length === 0) return true;

        const read = (name, fallback) => {
            const array = parameters[name];
            return (array && array.length > 0) ? array[0] : fallback;
        };

        const open = processGateBlock(this.state, main, output, {
            thresholdDb: read('thresholdDb', -24),
            attackMs: read('attackMs', 1),
            holdMs: read('holdMs', 50),
            releaseMs: read('releaseMs', 150),
            floorDb: read('floorDb', -80),
        }, sampleRate);

        // Report transitions only — a meter needs the edge, not the level.
        if (open !== this.wasOpen) {
            this.wasOpen = open;
            this.port.postMessage({ type: 'gate', open });
        }

        return true;
    }
}

registerProcessor('${GATE_PROCESSOR}', GateProcessor);
`;

/**
 * The complete worklet module source.
 *
 * The DSP is serialised from the exported functions, so the code running on
 * the audio thread is the same code the tests exercise.
 */
export function buildGateWorkletSource(): string {
    return [
        gateSmoothingCoefficient.toString(),
        gateDbToAmplitude.toString(),
        createGateState.toString(),
        processGateBlock.toString(),
        GATE_SHELL,
    ].join('\n\n');
}
