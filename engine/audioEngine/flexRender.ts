/**
 * flexRender.ts
 * Applies Flex Time and Flex Pitch to a clip's audio.
 *
 * `engine/audio/FlexTime.ts` and `FlexPitch.ts` contain working DSP — WSOLA
 * time-stretching and YIN pitch detection — but nothing called them, so the
 * `flexEnabled` / `flexTimeFactor` / `flexPitchOffset` fields on a clip had no
 * effect on playback.
 *
 * Stretching is expensive, so results are cached against the settings that
 * produced them and only recomputed when those change.
 */

import { FlexTimeProcessor } from '../audio/FlexTime';

export interface FlexSettings {
    flexEnabled?: boolean;
    flexMode?: 'off' | 'time' | 'pitch' | 'time+pitch';
    /** >1 stretches (slower), <1 compresses (faster). */
    flexTimeFactor?: number;
    /** Semitones. */
    flexPitchOffset?: number;
}

/** True when a clip asks for any flex processing at all. */
export function isFlexActive(settings: FlexSettings): boolean {
    if (!settings.flexEnabled) return false;
    if (settings.flexMode === 'off' || !settings.flexMode) return false;

    const stretch = settings.flexTimeFactor ?? 1;
    const pitch = settings.flexPitchOffset ?? 0;

    const wantsTime = settings.flexMode !== 'pitch' && Math.abs(stretch - 1) > 0.001;
    const wantsPitch = settings.flexMode !== 'time' && Math.abs(pitch) > 0.01;

    return wantsTime || wantsPitch;
}

/** Stable key describing the processing a clip currently asks for. */
export function flexCacheKey(clipId: string, settings: FlexSettings): string {
    const stretch = (settings.flexTimeFactor ?? 1).toFixed(4);
    const pitch = (settings.flexPitchOffset ?? 0).toFixed(3);
    return `flex:${clipId}:${settings.flexMode ?? 'off'}:${stretch}:${pitch}`;
}

/** Semitones to a linear resampling ratio. */
export function semitonesToRatio(semitones: number): number {
    return Math.pow(2, semitones / 12);
}

/**
 * Resample a channel by `ratio`, changing both length and pitch.
 *
 * Linear interpolation is adequate here because it runs in series with WSOLA,
 * whose windowing dominates the error budget.
 */
export function resample(input: Float32Array, ratio: number): Float32Array {
    if (!Number.isFinite(ratio) || ratio <= 0) return input.slice();
    if (Math.abs(ratio - 1) < 0.0001) return input.slice();

    const outputLength = Math.max(1, Math.round(input.length / ratio));
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
        const source = i * ratio;
        const index = Math.floor(source);
        const frac = source - index;
        const a = input[index] ?? 0;
        const b = input[index + 1] ?? a;
        output[i] = a + (b - a) * frac;
    }

    return output;
}

/**
 * Process one channel according to the clip's flex settings.
 *
 * Pitch shifting is stretch-then-resample: WSOLA changes duration at constant
 * pitch, resampling then changes pitch and undoes the duration change, leaving
 * a pitch shift at the original length.
 */
export function processChannel(
    input: Float32Array,
    sampleRate: number,
    settings: FlexSettings,
): Float32Array {
    const mode = settings.flexMode ?? 'off';
    const stretch = settings.flexTimeFactor ?? 1;
    const semitones = settings.flexPitchOffset ?? 0;

    let output = input;

    const wantsPitch = mode !== 'time' && Math.abs(semitones) > 0.01;
    const wantsTime = mode !== 'pitch' && Math.abs(stretch - 1) > 0.001;

    if (wantsPitch) {
        const ratio = semitonesToRatio(semitones);
        // Stretch by the pitch ratio first so resampling returns to length.
        output = FlexTimeProcessor.wsolaStretch(output, sampleRate, ratio);
        output = resample(output, ratio);
    }

    if (wantsTime) {
        output = FlexTimeProcessor.wsolaStretch(output, sampleRate, stretch);
    }

    return output;
}

/**
 * Produce a flex-processed copy of `source`, or the source itself when no
 * processing is requested.
 *
 * `createBuffer` is injected so this can be exercised without a real
 * AudioContext.
 */
export function renderFlexBuffer(
    source: AudioBuffer,
    settings: FlexSettings,
    createBuffer: (channels: number, length: number, sampleRate: number) => AudioBuffer,
): AudioBuffer {
    if (!isFlexActive(settings)) return source;

    const channels: Float32Array[] = [];
    for (let c = 0; c < source.numberOfChannels; c++) {
        channels.push(processChannel(source.getChannelData(c), source.sampleRate, settings));
    }

    const length = channels.reduce((max, ch) => Math.max(max, ch.length), 0);
    if (length === 0) return source;

    const output = createBuffer(source.numberOfChannels, length, source.sampleRate);
    for (let c = 0; c < channels.length; c++) {
        output.getChannelData(c).set(channels[c]);
    }

    return output;
}
