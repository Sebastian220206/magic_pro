/**
 * vocalEditing.ts
 * The editing pass a lead vocal gets after comping: tuning, aligning the
 * doubles to it, and cleaning up breaths and mouth clicks.
 *
 * All pure functions over sample data, so they can be tested without an
 * AudioContext and reused offline (a destructive edit) or in a render.
 *
 * Deliberately monophonic. These techniques rely on a single periodic source;
 * applied to a chord they produce artefacts rather than a result.
 */

// ── Pitch detection ────────────────────────────────────────────────────────

/** Lowest and highest fundamental worth searching for in a sung vocal. */
const MIN_HZ = 65;    // ~C2
const MAX_HZ = 1200;  // ~D6
/** Below this, YIN's dip is trusted; above it the frame is called unvoiced. */
const YIN_THRESHOLD = 0.15;

export interface PitchReading {
    /** Fundamental in Hz, or 0 when the frame is unvoiced. */
    hz: number;
    /** 0-1. How periodic the frame is; low means noise or silence. */
    confidence: number;
}

/**
 * Fundamental frequency of one frame, by the YIN difference function.
 *
 * Autocorrelation alone octave-errors on vocals — the half-period peak is often
 * as strong as the true one. YIN's cumulative mean normalisation is what
 * suppresses that, which is why it is worth the extra pass.
 */
export function detectPitch(
    frame: Float32Array,
    sampleRate: number,
): PitchReading {
    const maxTau = Math.min(Math.floor(sampleRate / MIN_HZ), frame.length >> 1);
    const minTau = Math.max(2, Math.floor(sampleRate / MAX_HZ));
    if (maxTau <= minTau) return { hz: 0, confidence: 0 };

    // Squared difference at each lag.
    const diff = new Float32Array(maxTau + 1);
    for (let tau = minTau; tau <= maxTau; tau++) {
        let sum = 0;
        const limit = frame.length - tau;
        for (let i = 0; i < limit; i++) {
            const d = frame[i] - frame[i + tau];
            sum += d * d;
        }
        diff[tau] = sum;
    }

    // Cumulative mean normalisation: a lag only counts as a dip if it is
    // better than every shorter lag, which is what kills the octave error.
    const normalised = new Float32Array(maxTau + 1);
    normalised[0] = 1;
    let running = 0;
    for (let tau = minTau; tau <= maxTau; tau++) {
        running += diff[tau];
        normalised[tau] = running > 0 ? (diff[tau] * (tau - minTau + 1)) / running : 1;
    }

    // First dip under the threshold wins; otherwise take the global minimum.
    let best = -1;
    for (let tau = minTau; tau <= maxTau; tau++) {
        if (normalised[tau] < YIN_THRESHOLD) {
            while (tau + 1 <= maxTau && normalised[tau + 1] < normalised[tau]) tau++;
            best = tau;
            break;
        }
    }
    if (best < 0) {
        let lowest = Infinity;
        for (let tau = minTau; tau <= maxTau; tau++) {
            if (normalised[tau] < lowest) { lowest = normalised[tau]; best = tau; }
        }
        if (best < 0 || lowest > 0.6) return { hz: 0, confidence: 0 };
    }

    // Parabolic interpolation around the dip for sub-sample accuracy.
    let tau = best;
    if (best > minTau && best < maxTau) {
        const a = normalised[best - 1], b = normalised[best], c = normalised[best + 1];
        const denom = 2 * (2 * b - a - c);
        if (denom !== 0) tau = best + (c - a) / denom;
    }

    const hz = sampleRate / tau;
    if (!Number.isFinite(hz) || hz < MIN_HZ || hz > MAX_HZ) return { hz: 0, confidence: 0 };
    return { hz, confidence: Math.max(0, Math.min(1, 1 - normalised[best])) };
}

// ── Scales and correction targets ──────────────────────────────────────────

/** Semitone offsets from the tonic, per scale. */
export const SCALES: Record<string, number[]> = {
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
    pentatonicMinor: [0, 3, 5, 7, 10],
};

export const hzToMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);
export const midiToHz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** Nearest in-scale MIDI note to a (possibly fractional) pitch. */
export function snapToScale(midi: number, tonic: number, scale: number[]): number {
    if (scale.length === 0) return midi;

    let best = midi;
    let bestDistance = Infinity;
    // Search the octave either side so a note near a boundary snaps correctly.
    const baseOctave = Math.floor((midi - tonic) / 12);
    for (let octave = baseOctave - 1; octave <= baseOctave + 1; octave++) {
        for (const degree of scale) {
            const candidate = tonic + octave * 12 + degree;
            const distance = Math.abs(candidate - midi);
            if (distance < bestDistance) { bestDistance = distance; best = candidate; }
        }
    }
    return best;
}

export interface TuningOptions {
    sampleRate: number;
    /** Tonic as a MIDI pitch class, 0 = C. */
    tonic?: number;
    scale?: number[];
    /**
     * 0 = untouched, 1 = pinned to the grid. Around 0.8 is the usual setting:
     * it fixes the centre of a note while leaving the scoop into it.
     */
    strength?: number;
    /**
     * Seconds the correction takes to reach full strength after a pitch change.
     * This is what preserves scoops and slides — correcting instantly is what
     * makes a vocal sound robotic.
     */
    retuneSeconds?: number;
    /** Frames below this confidence are left alone. */
    minConfidence?: number;
}

export interface PitchCurvePoint {
    /** Sample index of the frame's centre. */
    at: number;
    detectedHz: number;
    targetHz: number;
    confidence: number;
    /** Correction actually applied, in semitones. */
    correctionSemitones: number;
}

const FRAME_SECONDS = 0.045;
const HOP_SECONDS = 0.010;

/**
 * Measure a vocal's pitch over time and work out the correction to apply.
 *
 * Returned separately from the resynthesis so the curve can be drawn, edited or
 * inspected — which is how tuning is actually done, rather than as a black box.
 */
export function analysePitchCurve(
    samples: Float32Array,
    options: TuningOptions,
): PitchCurvePoint[] {
    const { sampleRate } = options;
    const tonic = options.tonic ?? 0;
    const scale = options.scale ?? SCALES.chromatic;
    const strength = Math.max(0, Math.min(1, options.strength ?? 0.8));
    const minConfidence = options.minConfidence ?? 0.4;
    const retuneSeconds = Math.max(0, options.retuneSeconds ?? 0.06);

    const frameLength = Math.max(64, Math.round(FRAME_SECONDS * sampleRate));
    const hop = Math.max(1, Math.round(HOP_SECONDS * sampleRate));

    const curve: PitchCurvePoint[] = [];
    let previousTarget = 0;
    /** How far the retune ramp has progressed since the last note change. */
    let settled = 0;

    for (let start = 0; start + frameLength <= samples.length; start += hop) {
        const frame = samples.subarray(start, start + frameLength);
        const { hz, confidence } = detectPitch(frame, sampleRate);
        const at = start + (frameLength >> 1);

        if (hz <= 0 || confidence < minConfidence) {
            curve.push({ at, detectedHz: 0, targetHz: 0, confidence, correctionSemitones: 0 });
            settled = 0;
            continue;
        }

        const midi = hzToMidi(hz);
        const snapped = snapToScale(midi, tonic, scale);

        // A new target restarts the ramp, so the slide into a note survives.
        if (previousTarget !== snapped) { settled = 0; previousTarget = snapped; }
        settled = retuneSeconds > 0
            ? Math.min(1, settled + HOP_SECONDS / retuneSeconds)
            : 1;

        const correction = (snapped - midi) * strength * settled;
        curve.push({
            at,
            detectedHz: hz,
            targetHz: midiToHz(midi + correction),
            confidence,
            correctionSemitones: correction,
        });
    }

    return curve;
}

/**
 * Resynthesise `samples` with the pitch curve applied, by TD-PSOLA.
 *
 * Grains one pitch period long are windowed and relaid at the corrected
 * period, so the formants stay where they were — which is why this sounds like
 * the singer and a plain resample does not.
 */
export function applyPitchCurve(
    samples: Float32Array,
    curve: PitchCurvePoint[],
    sampleRate: number,
): Float32Array {
    const out = new Float32Array(samples.length);
    if (curve.length === 0) { out.set(samples); return out; }

    /** The curve point governing a given sample. */
    const pointAt = (index: number): PitchCurvePoint => {
        // The curve is evenly spaced, so this is a divide rather than a search.
        const hop = Math.max(1, Math.round(HOP_SECONDS * sampleRate));
        const i = Math.max(0, Math.min(curve.length - 1, Math.round((index - curve[0].at) / hop)));
        return curve[i];
    };

    // Walk the *output*, and for each synthesis mark read the analysis grain
    // sitting at the same absolute time. Advancing read and write pointers at
    // their own rates instead would time-stretch the take rather than retune
    // it — the grains would drift apart and the duration would change.
    let writePosition = 0;

    while (writePosition < out.length) {
        const point = pointAt(Math.round(writePosition));

        // Unvoiced or uncorrected: copy through untouched. PSOLA on a
        // consonant smears it, and there is nothing to correct anyway.
        if (point.detectedHz <= 0 || Math.abs(point.correctionSemitones) < 1e-4) {
            const step = Math.max(1, Math.round(sampleRate * HOP_SECONDS));
            const end = Math.min(out.length, writePosition + step);
            for (let i = writePosition; i < end; i++) out[i] += samples[i];
            writePosition = end;
            continue;
        }

        const inPeriod = sampleRate / point.detectedHz;
        const ratio = point.targetHz / point.detectedHz;
        // Raising the pitch packs synthesis marks closer together, which
        // repeats analysis grains; lowering it spreads them and skips some.
        const outPeriod = Math.max(1, inPeriod / ratio);

        // Analysis centre at the same time as the synthesis mark, snapped to
        // the input's own period grid so grains stay pitch-synchronous.
        const centre = Math.round(writePosition / inPeriod) * inPeriod;
        const grain = Math.round(inPeriod * 2);
        const from = Math.max(0, Math.round(centre) - (grain >> 1));
        const to = Math.min(samples.length, from + grain);
        if (to <= from) break;

        for (let i = from; i < to; i++) {
            const target = Math.round(writePosition) + (i - Math.round(centre));
            if (target < 0 || target >= out.length) continue;
            const phase = (i - from) / Math.max(1, to - from - 1);
            out[target] += samples[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * phase));
        }

        writePosition += outPeriod;
    }

    // Overlap-add doubles the level where grains meet; normalise if it clipped.
    let peak = 0;
    for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
    if (peak > 1) for (let i = 0; i < out.length; i++) out[i] /= peak;

    return out;
}

/** Detect, correct and resynthesise in one call. */
export function tuneVocal(samples: Float32Array, options: TuningOptions): Float32Array {
    return applyPitchCurve(samples, analysePitchCurve(samples, options), options.sampleRate);
}

// ── Transient alignment ────────────────────────────────────────────────────

/** Onset positions, in samples. */
export function detectTransients(
    samples: Float32Array,
    sampleRate: number,
    sensitivity = 1.5,
): number[] {
    const window = Math.max(16, Math.round(0.005 * sampleRate));
    const envelope: number[] = [];
    for (let start = 0; start + window <= samples.length; start += window) {
        let sum = 0;
        for (let i = start; i < start + window; i++) sum += samples[i] * samples[i];
        envelope.push(Math.sqrt(sum / window));
    }
    if (envelope.length < 3) return [];

    // Onsets are rises in the envelope that beat the running average.
    const rises = envelope.map((v, i) => (i === 0 ? 0 : Math.max(0, v - envelope[i - 1])));
    const mean = rises.reduce((a, b) => a + b, 0) / rises.length;
    if (mean <= 0) return [];

    const onsets: number[] = [];
    const minGap = Math.round(0.03 * sampleRate / window);
    let lastIndex = -Infinity;
    for (let i = 1; i < rises.length; i++) {
        if (rises[i] > mean * sensitivity && i - lastIndex > minGap) {
            onsets.push(i * window);
            lastIndex = i;
        }
    }
    return onsets;
}

/**
 * Offset, in samples, that best lines `candidate` up with `reference`.
 *
 * Positive means the candidate should move later. Cross-correlation over a
 * bounded lag, so a double that was sung a little early or late snaps to the
 * lead without being time-stretched.
 */
export function alignmentOffset(
    reference: Float32Array,
    candidate: Float32Array,
    sampleRate: number,
    maxOffsetSeconds = 0.05,
): number {
    const maxLag = Math.round(maxOffsetSeconds * sampleRate);
    const length = Math.min(reference.length, candidate.length);
    if (length === 0 || maxLag === 0) return 0;

    // Correlate on the envelope rather than the waveform: two takes are never
    // phase-coherent, so raw sample correlation locks onto the wrong period.
    const window = Math.max(8, Math.round(0.002 * sampleRate));
    const envelopeOf = (data: Float32Array) => {
        const env: number[] = [];
        for (let start = 0; start + window <= length; start += window) {
            let sum = 0;
            for (let i = start; i < start + window; i++) sum += data[i] * data[i];
            env.push(Math.sqrt(sum / window));
        }
        return env;
    };

    const a = envelopeOf(reference);
    const b = envelopeOf(candidate);
    const lagWindows = Math.max(1, Math.round(maxLag / window));

    let bestLag = 0;
    let bestScore = -Infinity;
    for (let lag = -lagWindows; lag <= lagWindows; lag++) {
        let score = 0;
        let count = 0;
        for (let i = 0; i < a.length; i++) {
            const j = i + lag;
            if (j < 0 || j >= b.length) continue;
            score += a[i] * b[j];
            count++;
        }
        if (count === 0) continue;
        const normalised = score / count;
        if (normalised > bestScore) { bestScore = normalised; bestLag = lag; }
    }

    // `bestLag` is how far the candidate *lags* the reference. The caller wants
    // the correction to apply, which is the opposite sign — so a double sung
    // late comes back negative and `shiftSamples` pulls it earlier.
    return -bestLag * window;
}

/** Shift a take by `offset` samples, padding with silence. */
export function shiftSamples(samples: Float32Array, offset: number): Float32Array {
    const out = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
        const source = i - offset;
        if (source >= 0 && source < samples.length) out[i] = samples[source];
    }
    return out;
}

// ── Breath and click removal ───────────────────────────────────────────────

export interface BreathRegion {
    start: number;
    end: number;
    /** Mean level, so a UI can show which are worth attenuating. */
    levelDb: number;
}

/**
 * Find breaths: low-level, noise-like stretches between phrases.
 *
 * Level alone would catch quiet singing too, so this also requires a high
 * zero-crossing rate — breath is broadband noise, a sung note is periodic.
 */
export function detectBreaths(
    samples: Float32Array,
    sampleRate: number,
    thresholdDb = -38,
): BreathRegion[] {
    const window = Math.max(64, Math.round(0.02 * sampleRate));
    const threshold = Math.pow(10, thresholdDb / 20);
    const minLength = Math.round(0.06 * sampleRate);

    const regions: BreathRegion[] = [];
    let runStart = -1;
    let runEnergy = 0;
    let runWindows = 0;

    for (let start = 0; start + window <= samples.length; start += window) {
        let sum = 0;
        let crossings = 0;
        for (let i = start; i < start + window; i++) {
            sum += samples[i] * samples[i];
            if (i > start && (samples[i] >= 0) !== (samples[i - 1] >= 0)) crossings++;
        }
        const rms = Math.sqrt(sum / window);
        const zcr = crossings / window;

        // Quiet and noisy: a breath. Quiet and periodic: a soft sung note.
        const isBreath = rms > 0 && rms < threshold && zcr > 0.10;

        if (isBreath) {
            if (runStart < 0) { runStart = start; runEnergy = 0; runWindows = 0; }
            runEnergy += rms;
            runWindows++;
        } else if (runStart >= 0) {
            if (start - runStart >= minLength) {
                regions.push({
                    start: runStart,
                    end: start,
                    levelDb: 20 * Math.log10(Math.max(1e-9, runEnergy / runWindows)),
                });
            }
            runStart = -1;
        }
    }

    if (runStart >= 0 && samples.length - runStart >= minLength) {
        regions.push({
            start: runStart,
            end: samples.length,
            levelDb: 20 * Math.log10(Math.max(1e-9, runEnergy / Math.max(1, runWindows))),
        });
    }
    return regions;
}

/**
 * Attenuate breaths rather than cutting them.
 *
 * A gap of digital silence where a breath was sounds worse than the breath —
 * so this ducks by a set amount and fades in and out of each region.
 */
export function attenuateBreaths(
    samples: Float32Array,
    regions: BreathRegion[],
    reductionDb = -12,
    sampleRate = 48000,
): Float32Array {
    const out = Float32Array.from(samples);
    const gain = Math.pow(10, reductionDb / 20);
    const fade = Math.max(1, Math.round(0.005 * sampleRate));

    for (const region of regions) {
        for (let i = Math.max(0, region.start); i < Math.min(out.length, region.end); i++) {
            const intoRegion = i - region.start;
            const toEnd = region.end - i;
            // Ramp in and out so the duck itself is not audible as a click.
            const ramp = Math.min(1, intoRegion / fade, toEnd / fade);
            out[i] *= 1 + (gain - 1) * Math.max(0, ramp);
        }
    }
    return out;
}

/**
 * Find mouth clicks: isolated single-sample-scale discontinuities.
 *
 * Detected on the second difference, which is large for a click and small for
 * even a fast transient.
 */
export function detectClicks(
    samples: Float32Array,
    sensitivity = 8,
): number[] {
    if (samples.length < 5) return [];

    const secondDiff = new Float32Array(samples.length);
    for (let i = 1; i < samples.length - 1; i++) {
        secondDiff[i] = Math.abs(samples[i + 1] - 2 * samples[i] + samples[i - 1]);
    }

    let sum = 0;
    for (let i = 0; i < secondDiff.length; i++) sum += secondDiff[i];
    const mean = sum / secondDiff.length;
    if (mean <= 0) return [];

    const clicks: number[] = [];
    let last = -Infinity;
    for (let i = 1; i < secondDiff.length - 1; i++) {
        if (secondDiff[i] > mean * sensitivity && i - last > 16) {
            clicks.push(i);
            last = i;
        }
    }
    return clicks;
}

/**
 * Repair clicks by interpolating across them.
 *
 * A short linear bridge between the samples either side is inaudible at click
 * scale and avoids the hole that muting leaves.
 */
export function repairClicks(
    samples: Float32Array,
    clicks: number[],
    widthSamples = 8,
): Float32Array {
    const out = Float32Array.from(samples);

    for (const at of clicks) {
        const from = Math.max(0, at - widthSamples);
        const to = Math.min(out.length - 1, at + widthSamples);
        if (to <= from) continue;

        const a = out[from];
        const b = out[to];
        for (let i = from + 1; i < to; i++) {
            out[i] = a + (b - a) * ((i - from) / (to - from));
        }
    }
    return out;
}

/** De-breath and de-click in one pass. */
export function cleanVocal(
    samples: Float32Array,
    sampleRate: number,
    options: { breathReductionDb?: number; breathThresholdDb?: number } = {},
): Float32Array {
    const breaths = detectBreaths(samples, sampleRate, options.breathThresholdDb);
    const ducked = attenuateBreaths(samples, breaths, options.breathReductionDb ?? -12, sampleRate);
    return repairClicks(ducked, detectClicks(ducked));
}
