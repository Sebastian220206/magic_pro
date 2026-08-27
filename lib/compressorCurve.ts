/**
 * What a compressor does to a level, as maths rather than as audio.
 *
 * The editor's Graph view draws this, and the Meter view reads against it. It
 * lives here so both can be tested without a `DynamicsCompressorNode` — jsdom
 * has no Web Audio, and a transfer curve is the one part of a compressor that
 * can be checked by arithmetic.
 */

/** The character models the editor offers, in the order it shows them. */
export const COMPRESSOR_MODELS = [
    { id: 'platinum', label: 'Platinum Digital', family: 'VCA' },
    { id: 'studio-vca', label: 'Studio VCA', family: 'VCA' },
    { id: 'studio-fet', label: 'Studio FET', family: 'FET' },
    { id: 'classic-vca', label: 'Classic VCA', family: 'VCA' },
    { id: 'vintage-vca', label: 'Vintage VCA', family: 'VCA' },
    { id: 'vintage-fet', label: 'Vintage FET', family: 'FET' },
    { id: 'vintage-opto', label: 'Vintage Opto', family: 'Opto' },
] as const;

export type CompressorModelId = typeof COMPRESSOR_MODELS[number]['id'];

/**
 * How each model behaves.
 *
 * `attackScale` and `releaseScale` multiply the times the user dials in, which
 * is what makes an Opto feel slow and a FET feel instant at the same knob
 * setting. `drive` feeds the saturation stage. `kneeBias` is added to the knee,
 * so the vintage models round the corner more than the digital one.
 */
export const MODEL_PROFILES: Readonly<Record<CompressorModelId, {
    attackScale: number;
    releaseScale: number;
    kneeBias: number;
    drive: number;
}>> = {
    'platinum': { attackScale: 1.0, releaseScale: 1.0, kneeBias: 0, drive: 0 },
    'studio-vca': { attackScale: 1.0, releaseScale: 1.1, kneeBias: 2, drive: 0.1 },
    'studio-fet': { attackScale: 0.35, releaseScale: 0.8, kneeBias: -2, drive: 0.35 },
    'classic-vca': { attackScale: 1.3, releaseScale: 1.3, kneeBias: 3, drive: 0.2 },
    'vintage-vca': { attackScale: 1.6, releaseScale: 1.5, kneeBias: 5, drive: 0.3 },
    'vintage-fet': { attackScale: 0.25, releaseScale: 0.7, kneeBias: -3, drive: 0.5 },
    'vintage-opto': { attackScale: 3.0, releaseScale: 3.5, kneeBias: 9, drive: 0.25 },
};

export function modelProfile(id: string) {
    return MODEL_PROFILES[id as CompressorModelId] ?? MODEL_PROFILES.platinum;
}

/**
 * The output level for a given input level, in dB.
 *
 * Below the knee the signal passes; above it the excess is divided by the
 * ratio. Inside the knee the two meet on a quadratic, which is what "soft
 * knee" means — the same curve `DynamicsCompressorNode` uses, so the graph
 * and the audio agree.
 */
export function compressLevel(
    inputDb: number,
    threshold: number,
    ratio: number,
    knee: number,
): number {
    if (!Number.isFinite(inputDb)) return -60;
    const safeRatio = Math.max(1, ratio);
    const half = Math.max(0, knee) / 2;

    if (inputDb < threshold - half) return inputDb;
    if (inputDb > threshold + half) {
        return threshold + (inputDb - threshold) / safeRatio;
    }
    if (half === 0) return threshold + (inputDb - threshold) / safeRatio;

    // Quadratic blend across the knee.
    const over = inputDb - threshold + half;
    return inputDb + ((1 / safeRatio - 1) * over * over) / (2 * knee);
}

/** How much a level is pulled down, as a positive number of dB. */
export function gainReductionAt(
    inputDb: number,
    threshold: number,
    ratio: number,
    knee: number,
): number {
    return Math.max(0, inputDb - compressLevel(inputDb, threshold, ratio, knee));
}

/**
 * A brickwall above the limiter threshold.
 *
 * Applied after the compressor, so the graph shows what actually leaves.
 */
export function limitLevel(outputDb: number, threshold: number, enabled: boolean): number {
    if (!enabled) return outputDb;
    return Math.min(outputDb, threshold);
}

/** The makeup gain each Auto Gain setting asks for, in dB. */
export type AutoGainMode = 'off' | '0db' | '-12db';

export function autoMakeupDb(
    mode: AutoGainMode,
    threshold: number,
    ratio: number,
    knee: number,
): number {
    if (mode === 'off') return 0;
    // Bring the loudest passage back to the target: how far 0 dBFS falls is
    // how far the output has to come back up.
    const lossAtFullScale = gainReductionAt(0, threshold, ratio, knee);
    const target = mode === '0db' ? 0 : -12;
    return Math.max(-24, Math.min(24, lossAtFullScale + target));
}

/** Points for the transfer graph, from -60 dBFS to 0. */
export function transferCurve(
    threshold: number,
    ratio: number,
    knee: number,
    makeup: number,
    limiter: { enabled: boolean; threshold: number },
    steps = 121,
): { inputDb: number; outputDb: number }[] {
    const points: { inputDb: number; outputDb: number }[] = [];
    for (let i = 0; i < steps; i++) {
        const inputDb = -60 + (60 * i) / (steps - 1);
        const compressed = compressLevel(inputDb, threshold, ratio, knee) + makeup;
        points.push({ inputDb, outputDb: limitLevel(compressed, limiter.threshold, limiter.enabled) });
    }
    return points;
}

/** A linear amplitude as dBFS, with a floor so silence does not read -Infinity. */
export function amplitudeToDb(amplitude: number, floor = -60): number {
    if (!(amplitude > 0)) return floor;
    return Math.max(floor, 20 * Math.log10(amplitude));
}

/** Where a dB value sits on a meter running `floor`..`ceiling`. 0-1. */
export function meterFraction(db: number, floor = -60, ceiling = 6): number {
    if (!Number.isFinite(db)) return 0;
    return Math.max(0, Math.min(1, (db - floor) / (ceiling - floor)));
}
