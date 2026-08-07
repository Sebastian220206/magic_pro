/**
 * offlineLoudness.ts
 * Loudness analysis of a finished buffer, per ITU-R BS.1770-4 / EBU R128.
 *
 * The two existing meters (`engine/metering/loudnessMeter.ts` and
 * `engine/audioEngine/loudnessMeter.ts`) are realtime: they wrap an
 * `AnalyserNode` and push updates to the UI. Neither can answer the question a
 * mastering pass actually asks — "what is this bounced file's integrated LUFS
 * and true peak?" — because that needs the whole signal, offline, in one go.
 */

/** Target a delivery has to satisfy. */
export interface LoudnessTargetSpec {
    /** Integrated loudness, LUFS. */
    lufsTarget: number;
    /** Highest permitted true peak, dBTP. */
    truePeakCeiling: number;
    /** Allowed distance from the target, LU. */
    tolerance?: number;
}

export interface LoudnessAnalysis {
    /** Gated integrated loudness over the whole programme, LUFS. */
    integratedLufs: number;
    /** Loudest 3-second window, LUFS. */
    shortTermMaxLufs: number;
    /** Inter-sample peak, dBTP. */
    truePeakDb: number;
    /** Sample peak, dBFS — always ≤ true peak. */
    samplePeakDb: number;
    /** Loudness range, LU. */
    loudnessRangeLu: number;
    compliesWith: (target: LoudnessTargetSpec) => boolean;
}

/** Common delivery targets. */
export const LOUDNESS_TARGETS = {
    spotify: { lufsTarget: -14, truePeakCeiling: -1 },
    appleMusic: { lufsTarget: -16, truePeakCeiling: -1 },
    youtube: { lufsTarget: -14, truePeakCeiling: -1 },
    broadcastR128: { lufsTarget: -23, truePeakCeiling: -1 },
} as const satisfies Record<string, LoudnessTargetSpec>;

const SILENCE_LUFS = -Infinity;
const ABSOLUTE_GATE_LUFS = -70;
const RELATIVE_GATE_LU = -10;
/** Loudness range gates lower and on short-term blocks (EBU Tech 3342). */
const LRA_RELATIVE_GATE_LU = -20;
const SHORT_TERM_HOP_SECONDS = 1;
const BLOCK_SECONDS = 0.4;
const BLOCK_OVERLAP = 0.75;      // 75% overlap, so a new block every 100 ms
const SHORT_TERM_SECONDS = 3;

/** Per-channel weights from BS.1770 (surround channels count for more). */
function channelWeight(index: number, channelCount: number): number {
    // Stereo and mono: all channels weight 1. Surround gives the rears +1.5 dB.
    if (channelCount <= 2) return 1;
    return index >= 3 ? 1.41 : 1;
}

interface Biquad { b0: number; b1: number; b2: number; a1: number; a2: number }

/**
 * The two stages of the K-weighting filter, as specified at 48 kHz and
 * re-derived for other rates so the curve keeps its shape.
 */
function kWeightingStages(sampleRate: number): [Biquad, Biquad] {
    // Stage 1: high-shelf, +4 dB above ~1.5 kHz.
    const f0 = 1681.974450955533;
    const G = 3.999843853973347;
    const Q = 0.7071752369554196;

    const K = Math.tan(Math.PI * f0 / sampleRate);
    const Vh = Math.pow(10, G / 20);
    const Vb = Math.pow(Vh, 0.4996667741545416);
    const den = 1 + K / Q + K * K;

    const shelf: Biquad = {
        b0: (Vh + Vb * K / Q + K * K) / den,
        b1: 2 * (K * K - Vh) / den,
        b2: (Vh - Vb * K / Q + K * K) / den,
        a1: 2 * (K * K - 1) / den,
        a2: (1 - K / Q + K * K) / den,
    };

    // Stage 2: high-pass at ~38 Hz.
    const f0h = 38.13547087602444;
    const Qh = 0.5003270373238773;
    const Kh = Math.tan(Math.PI * f0h / sampleRate);
    const denH = 1 + Kh / Qh + Kh * Kh;

    const highPass: Biquad = {
        b0: 1,
        b1: -2,
        b2: 1,
        a1: 2 * (Kh * Kh - 1) / denH,
        a2: (1 - Kh / Qh + Kh * Kh) / denH,
    };

    return [shelf, highPass];
}

function applyBiquad(input: Float32Array, f: Biquad): Float32Array {
    const out = new Float32Array(input.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < input.length; i++) {
        const x0 = input[i];
        const y0 = f.b0 * x0 + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
        out[i] = y0;
        x2 = x1; x1 = x0;
        y2 = y1; y1 = y0;
    }
    return out;
}

/** Mean square of one block, already K-weighted and channel-summed. */
function blockLoudness(
    weighted: Float32Array[],
    channelCount: number,
    start: number,
    length: number,
): number {
    let sum = 0;
    for (let c = 0; c < weighted.length; c++) {
        const data = weighted[c];
        const weight = channelWeight(c, channelCount);
        let channelSum = 0;
        const end = Math.min(start + length, data.length);
        for (let i = start; i < end; i++) channelSum += data[i] * data[i];
        sum += weight * (channelSum / length);
    }
    return sum > 0 ? -0.691 + 10 * Math.log10(sum) : SILENCE_LUFS;
}

/** Oversampling factor for true-peak detection, per BS.1770-4 Annex 2. */
const TRUE_PEAK_OVERSAMPLE = 4;
/** Taps per phase. 12 gives a stopband deep enough for a −1 dBTP decision. */
const TRUE_PEAK_TAPS = 12;

/**
 * Polyphase interpolation filter for true-peak detection.
 *
 * A windowed-sinc low-pass at Nyquist/`factor`, split into `factor` phases so
 * each output sample costs one dot product. Linear interpolation — which this
 * used to do — reads *below* the real inter-sample peak, because a straight
 * line between two samples cannot rise above either of them. That makes a
 * limiter look compliant when it is clipping the D/A.
 */
function buildPolyphase(factor: number, taps: number): Float32Array[] {
    const length = factor * taps;
    const centre = (length - 1) / 2;
    const kernel = new Float32Array(length);

    for (let i = 0; i < length; i++) {
        const x = (i - centre) / factor;
        // sinc
        const sinc = Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
        // Blackman-Harris window keeps the stopband well below the decision.
        const w = (2 * Math.PI * i) / (length - 1);
        const window =
            0.35875
            - 0.48829 * Math.cos(w)
            + 0.14128 * Math.cos(2 * w)
            - 0.01168 * Math.cos(3 * w);
        kernel[i] = sinc * window;
    }

    const phases: Float32Array[] = [];
    for (let phase = 0; phase < factor; phase++) {
        const branch = new Float32Array(taps);
        let sum = 0;
        for (let t = 0; t < taps; t++) {
            branch[t] = kernel[t * factor + phase];
            sum += branch[t];
        }
        // Normalise each phase to unity gain so a DC-ish signal is not scaled.
        if (sum !== 0) for (let t = 0; t < taps; t++) branch[t] /= sum;
        phases.push(branch);
    }
    return phases;
}

const POLYPHASE = buildPolyphase(TRUE_PEAK_OVERSAMPLE, TRUE_PEAK_TAPS);

/**
 * Inter-sample peak, by 4× polyphase oversampling.
 *
 * Samples outside the signal read as zero, which is what a decoder would see.
 */
function truePeak(channels: Float32Array[]): number {
    const taps = TRUE_PEAK_TAPS;
    let peak = 0;

    for (const data of channels) {
        for (let i = 0; i < data.length; i++) {
            // The sample itself always counts, oversampling or not.
            const here = Math.abs(data[i]);
            if (here > peak) peak = here;

            for (const branch of POLYPHASE) {
                let acc = 0;
                for (let t = 0; t < taps; t++) {
                    const index = i + t - (taps >> 1);
                    if (index >= 0 && index < data.length) acc += branch[t] * data[index];
                }
                const magnitude = Math.abs(acc);
                if (magnitude > peak) peak = magnitude;
            }
        }
    }
    return peak;
}

const toDb = (linear: number) => linear > 0 ? 20 * Math.log10(linear) : -Infinity;

/**
 * Measure a rendered buffer.
 *
 * `channels` is one Float32Array per channel. Returns integrated loudness with
 * the BS.1770 two-stage gate applied, plus short-term maximum, loudness range
 * and true peak.
 */
export function analyseLoudness(
    channels: Float32Array[],
    sampleRate: number,
): LoudnessAnalysis {
    const empty: LoudnessAnalysis = {
        integratedLufs: SILENCE_LUFS,
        shortTermMaxLufs: SILENCE_LUFS,
        truePeakDb: -Infinity,
        samplePeakDb: -Infinity,
        loudnessRangeLu: 0,
        compliesWith: () => false,
    };
    if (channels.length === 0 || channels[0].length === 0 || !(sampleRate > 0)) return empty;

    const [shelf, highPass] = kWeightingStages(sampleRate);
    const weighted = channels.map(c => applyBiquad(applyBiquad(c, shelf), highPass));

    const blockLength = Math.max(1, Math.round(BLOCK_SECONDS * sampleRate));
    const hop = Math.max(1, Math.round(blockLength * (1 - BLOCK_OVERLAP)));
    const total = channels[0].length;

    const blocks: number[] = [];
    for (let start = 0; start + blockLength <= total; start += hop) {
        blocks.push(blockLoudness(weighted, channels.length, start, blockLength));
    }
    // A buffer shorter than one block still deserves a reading.
    if (blocks.length === 0) {
        blocks.push(blockLoudness(weighted, channels.length, 0, total));
    }

    /** Energy mean of a set of block loudnesses, back in LUFS. */
    const meanOf = (list: number[]) => {
        if (list.length === 0) return SILENCE_LUFS;
        const sum = list.reduce((acc, l) => acc + Math.pow(10, (l + 0.691) / 10), 0);
        return -0.691 + 10 * Math.log10(sum / list.length);
    };

    // Stage 1: drop anything below the absolute gate.
    const aboveAbsolute = blocks.filter(l => l > ABSOLUTE_GATE_LUFS);

    // Stage 2: drop anything more than 10 LU below that first mean.
    const relativeThreshold = meanOf(aboveAbsolute) + RELATIVE_GATE_LU;
    const gated = aboveAbsolute.filter(l => l > relativeThreshold);
    const integratedLufs = gated.length > 0 ? meanOf(gated) : meanOf(aboveAbsolute);

    // Short-term: 3-second windows, stepped every second per EBU Tech 3342.
    const shortLength = Math.max(1, Math.round(SHORT_TERM_SECONDS * sampleRate));
    const shortHop = Math.max(1, Math.round(sampleRate * SHORT_TERM_HOP_SECONDS));
    const shortBlocks: number[] = [];
    for (let start = 0; start + shortLength <= total; start += shortHop) {
        shortBlocks.push(blockLoudness(weighted, channels.length, start, shortLength));
    }
    if (shortBlocks.length === 0) {
        shortBlocks.push(blockLoudness(weighted, channels.length, 0, total));
    }

    const shortTermMaxLufs = Math.max(...shortBlocks);

    // Loudness range is a *different* measurement from integrated loudness: it
    // runs on short-term blocks and gates at −20 LU, not the −10 LU used above.
    // Reusing the integrated gate collapsed LRA to zero, because the quiet part
    // of a dynamic programme is exactly what that tighter gate discards.
    const lraAbsolute = shortBlocks.filter(l => l > ABSOLUTE_GATE_LUFS);
    const lraGated = lraAbsolute.filter(l => l > meanOf(lraAbsolute) + LRA_RELATIVE_GATE_LU);
    const sorted = [...lraGated].sort((a, b) => a - b);
    const percentile = (p: number) =>
        sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(sorted.length * p) - 1))];
    const loudnessRangeLu = sorted.length > 1
        ? Math.max(0, percentile(0.95) - percentile(0.1))
        : 0;

    const truePeakDb = toDb(truePeak(channels));
    const samplePeakDb = toDb(channels.reduce((peak, data) => {
        let local = peak;
        for (let i = 0; i < data.length; i++) local = Math.max(local, Math.abs(data[i]));
        return local;
    }, 0));

    return {
        integratedLufs,
        shortTermMaxLufs,
        truePeakDb,
        samplePeakDb,
        loudnessRangeLu,
        compliesWith: (target) => {
            const tolerance = target.tolerance ?? 1;
            const loudOk = Math.abs(integratedLufs - target.lufsTarget) <= tolerance;
            const peakOk = truePeakDb <= target.truePeakCeiling;
            return loudOk && peakOk;
        },
    };
}

/** Gain to bring `samples` to `targetRmsDb`, for matching a reference track. */
export function gainToMatchRms(samples: Float32Array, targetRmsDb: number): number {
    if (samples.length === 0) return 1;

    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / samples.length);
    if (rms <= 0) return 1;

    return Math.pow(10, targetRmsDb / 20) / rms;
}
