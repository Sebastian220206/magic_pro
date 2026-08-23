/**
 * What the Audio > MP3 settings actually control.
 *
 * The panel offered eight controls and the encoder read none of them —
 * `bounceEngine.convertToMP3` had `const bitRate = 192` typed into it. The bit
 * rate and the mono downmix are genuinely selectable, so they are wired here;
 * the rest are not reachable through the encoder this app bundles and are
 * marked as such rather than left looking adjustable.
 */

export const MP3_MONO_BITRATES = ['32 kbit/s', '64 kbit/s', '80 kbit/s', '96 kbit/s', '128 kbit/s', '160 kbit/s'];
export const MP3_STEREO_BITRATES = ['96 kbit/s', '128 kbit/s', '160 kbit/s', '192 kbit/s', '256 kbit/s', '320 kbit/s'];
export const MP3_STEREO_MODES = ['Stereo', 'Joint Stereo', 'Mono'];
export const MP3_QUALITIES = ['Low', 'Medium', 'High', 'Highest'];

export interface Mp3Settings {
    bitRateMono?: string;
    bitRateStereo?: string;
    stereoMode?: string;
    filterBelow10Hz?: boolean;
    useVBR?: boolean;
    quality?: string;
    useBestEncoding?: boolean;
}

/** `"192 kbit/s"` → `192`. Falls back rather than handing the encoder a NaN. */
export function parseBitRate(label: string | undefined, fallback: number): number {
    const kbps = parseInt(String(label ?? ''), 10);
    return Number.isFinite(kbps) && kbps > 0 ? kbps : fallback;
}

/** How many channels the file should carry, given the settings and source. */
export function encodedChannelCount(settings: Mp3Settings, sourceChannels: number): number {
    if (settings.stereoMode === 'Mono') return 1;
    return sourceChannels > 1 ? 2 : 1;
}

/** The kbit/s to encode at — the mono figure for a mono file, else stereo. */
export function bitRateFor(settings: Mp3Settings, sourceChannels: number): number {
    return encodedChannelCount(settings, sourceChannels) === 1
        ? parseBitRate(settings.bitRateMono, 128)
        : parseBitRate(settings.bitRateStereo, 192);
}

/**
 * Remove content below 10 Hz, in place.
 *
 * Subsonic energy is inaudible but still costs bits and can push the encoder
 * into clipping, which is why the option exists. A one-pole high-pass is
 * enough for a 10 Hz corner and does not need a filter graph.
 */
export function filterSubsonic(samples: Float32Array, sampleRate: number, cornerHz = 10): void {
    if (!(sampleRate > 0) || samples.length === 0) return;
    // Standard one-pole high-pass difference equation.
    const rc = 1 / (2 * Math.PI * cornerHz);
    const dt = 1 / sampleRate;
    const alpha = rc / (rc + dt);
    let previousInput = samples[0];
    let previousOutput = 0;
    for (let i = 0; i < samples.length; i++) {
        const input = samples[i];
        previousOutput = alpha * (previousOutput + input - previousInput);
        previousInput = input;
        samples[i] = previousOutput;
    }
}

/** Float samples in −1..1 to the signed 16-bit the encoder takes. */
export function toInt16(source: Float32Array, out: Int16Array, offset: number, length: number): void {
    for (let i = 0; i < length; i++) {
        const sample = Math.max(-1, Math.min(1, source[offset + i] ?? 0));
        out[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
}

/** Average the channels down to one, for the Mono stereo mode. */
export function downmixToMono(channels: Float32Array[]): Float32Array {
    if (channels.length === 1) return channels[0];
    const mono = new Float32Array(channels[0].length);
    for (let i = 0; i < mono.length; i++) {
        let sum = 0;
        for (const channel of channels) sum += channel[i] ?? 0;
        mono[i] = sum / channels.length;
    }
    return mono;
}

/** Which MP3 settings this build can honour, and why the others cannot be. */
export const MP3_UNSUPPORTED: Record<string, string> = {
    useVBR: 'The bundled encoder writes constant bit rate only',
    quality: 'The bundled encoder has no quality setting; bit rate is the control',
    useBestEncoding: 'The bundled encoder has one encoding path',
    jointStereo: 'The bundled encoder chooses stereo coding itself',
};

/**
 * Load the encoder, working around a bug in the published lamejs package.
 *
 * lamejs 1.2.1's npm entry point reads `MPEGMode`, `Lame` and `BitStream` as
 * globals that only its concatenated browser bundle ever defines, so a plain
 * `require('lamejs')` throws `ReferenceError: MPEGMode is not defined`. That is
 * why `bounceEngine.convertToMP3` had always fallen into its catch and returned
 * a WAV under an `.mp3` name: the encoder never loaded at all.
 *
 * Requiring the three modules onto the global first is enough to make the entry
 * point work, in Node and in the bundler alike.
 */
let cachedLamejs: any = null;
function loadLamejs(): any {
    if (cachedLamejs) return cachedLamejs;
    try {
        const globals = globalThis as any;
        if (!globals.MPEGMode) globals.MPEGMode = require('lamejs/src/js/MPEGMode.js');
        if (!globals.Lame) globals.Lame = require('lamejs/src/js/Lame.js');
        if (!globals.BitStream) globals.BitStream = require('lamejs/src/js/BitStream.js');
        const lamejs = require('lamejs');
        if (typeof lamejs?.Mp3Encoder !== 'function') return null;
        cachedLamejs = lamejs;
        return lamejs;
    } catch {
        return null;
    }
}

/**
 * Encode an AudioBuffer's channels to MP3.
 *
 * Takes plain arrays rather than an AudioBuffer so it runs under a test without
 * a Web Audio context. Returns null when the encoder is unavailable, leaving
 * the caller to fall back to WAV rather than hand back a mislabelled file.
 */
export function encodeMp3(
    channels: Float32Array[],
    sampleRate: number,
    settings: Mp3Settings = {},
): Uint8Array<ArrayBuffer> | null {
    if (channels.length === 0 || channels[0].length === 0) return null;

    const lamejs = loadLamejs();
    if (!lamejs) return null;

    const outChannels = encodedChannelCount(settings, channels.length);
    const source = outChannels === 1 ? [downmixToMono(channels)] : channels.slice(0, 2);

    if (settings.filterBelow10Hz) {
        // Copy first: the caller's buffer is the rendered master and may still
        // be handed to the WAV encoder or the loudness analysis afterwards.
        for (let c = 0; c < source.length; c++) {
            const copy = Float32Array.from(source[c]);
            filterSubsonic(copy, sampleRate);
            source[c] = copy;
        }
    }

    const encoder = new lamejs.Mp3Encoder(outChannels, sampleRate, bitRateFor(settings, channels.length));
    // lamejs returns Int8Array; `Uint8Array.set` reinterprets the bytes.
    const chunks: (Uint8Array | Int8Array)[] = [];

    // 1152 samples is one MP3 frame; anything else makes the encoder rebuffer.
    const blockSize = 1152;
    const total = source[0].length;
    const left = new Int16Array(blockSize);
    const right = outChannels > 1 ? new Int16Array(blockSize) : left;

    for (let i = 0; i < total; i += blockSize) {
        const length = Math.min(blockSize, total - i);
        const leftBlock = length === blockSize ? left : new Int16Array(length);
        toInt16(source[0], leftBlock, i, length);

        let encoded: Int8Array;
        if (outChannels > 1) {
            const rightBlock = length === blockSize ? right : new Int16Array(length);
            toInt16(source[1], rightBlock, i, length);
            encoded = encoder.encodeBuffer(leftBlock, rightBlock);
        } else {
            encoded = encoder.encodeBuffer(leftBlock);
        }
        if (encoded.length > 0) chunks.push(encoded);
    }

    const tail = encoder.flush();
    if (tail.length > 0) chunks.push(tail);
    if (chunks.length === 0) return null;

    const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    // Backed by a plain ArrayBuffer, not the SharedArrayBuffer the default
    // `Uint8Array` type allows — `Blob` will not take the shared form.
    const out = new Uint8Array(new ArrayBuffer(size));
    let offset = 0;
    for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
    }
    return out;
}
