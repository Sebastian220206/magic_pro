/**
 * bitcrusherCore.ts
 * Sample-and-hold decimation plus amplitude quantisation.
 *
 * Two degradations in one box: `downsample` holds each sample for N in a row
 * (sample-rate reduction without a filter, so the aliasing is the point) and
 * `bits` rounds amplitudes to 2^bits levels. Both are per-sample state with
 * no native-node equivalent — a WaveShaper can quantise levels but cannot
 * hold time — hence the AudioWorklet.
 */

/** Node registration name, shared by the loader and the processor. */
export const BITCRUSHER_PROCESSOR = 'magic-bitcrusher';

export interface BitcrusherParams {
    /** Quantisation depth, 1–16. */
    bits: number;
    /** Hold length in samples, 1 = off. */
    downsample: number;
    /** 0 = dry, 1 = fully crushed. */
    mix: number;
}

export const DEFAULT_BITCRUSHER_PARAMS: BitcrusherParams = {
    bits: 12,
    downsample: 1,
    mix: 1,
};

// ── Pure DSP (serialised into the worklet verbatim) ────────────────────────

export function quantizeSample(value: number, bits: number): number {
    const depth = Math.max(1, Math.min(16, Math.round(bits)));
    const levels = Math.pow(2, depth) / 2;
    const clamped = Math.max(-1, Math.min(1, value));
    return Math.round(clamped * levels) / levels;
}

export interface BitcrusherState {
    held: number[];
    countdown: number[];
}

export function createBitcrusherState(channels = 2): BitcrusherState {
    return {
        held: Array.from({ length: channels }, () => 0),
        countdown: Array.from({ length: channels }, () => 0),
    };
}

/**
 * Process one block.
 *
 * Each channel holds its own sample-and-hold state, so a stereo signal keeps
 * its channel independence instead of smearing one side's timing onto the
 * other.
 */
export function processBitcrusherBlock(
    state: BitcrusherState,
    main: Float32Array[],
    output: Float32Array[],
    params: BitcrusherParams,
): void {
    const channels = Math.min(main.length, output.length);
    if (channels === 0) return;
    const frames = Math.min(main[0].length, output[0].length);
    const hold = Math.max(1, Math.round(params.downsample));
    const mix = Math.max(0, Math.min(1, params.mix));

    while (state.held.length < channels) {
        state.held.push(0);
        state.countdown.push(0);
    }

    for (let c = 0; c < channels; c++) {
        for (let i = 0; i < frames; i++) {
            if (state.countdown[c] <= 0) {
                state.countdown[c] = hold;
                state.held[c] = quantizeSample(main[c][i], params.bits);
            }
            state.countdown[c]--;
            output[c][i] = main[c][i] * (1 - mix) + state.held[c] * mix;
        }
    }
}

// ── Worklet source ─────────────────────────────────────────────────────────

const BITCRUSHER_SHELL = `
const PARAM_DESCRIPTORS = [
    { name: 'bits',       defaultValue: 12, minValue: 1, maxValue: 16, automationRate: 'k-rate' },
    { name: 'downsample', defaultValue: 1,  minValue: 1, maxValue: 32, automationRate: 'k-rate' },
    { name: 'mix',        defaultValue: 1,  minValue: 0, maxValue: 1,  automationRate: 'k-rate' },
];

class BitcrusherProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() { return PARAM_DESCRIPTORS; }

    constructor() {
        super();
        this.state = createBitcrusherState(2);
    }

    process(inputs, outputs, parameters) {
        const main = inputs[0];
        const output = outputs[0];
        if (!main || main.length === 0 || !output || output.length === 0) return true;

        const read = (name, fallback) => {
            const array = parameters[name];
            return (array && array.length > 0) ? array[0] : fallback;
        };

        processBitcrusherBlock(this.state, main, output, {
            bits: read('bits', 12),
            downsample: read('downsample', 1),
            mix: read('mix', 1),
        });

        return true;
    }
}

registerProcessor('${BITCRUSHER_PROCESSOR}', BitcrusherProcessor);
`;

/**
 * The complete worklet module source.
 *
 * The DSP is serialised from the exported functions, so the code running on
 * the audio thread is the same code the tests exercise.
 */
export function buildBitcrusherWorkletSource(): string {
    return [
        quantizeSample.toString(),
        createBitcrusherState.toString(),
        processBitcrusherBlock.toString(),
        BITCRUSHER_SHELL,
    ].join('\n\n');
}
