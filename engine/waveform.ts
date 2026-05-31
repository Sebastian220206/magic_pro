/**
 * waveform.ts — Professional DAW Waveform Engine
 *
 * Pipeline:
 *   AudioBuffer  →  extractPeaks()  →  WaveformPeaks
 *   WaveformPeaks  →  drawWaveform()  →  Canvas 2D
 *
 * Features:
 *  • Per-channel peak extraction (mono / stereo)
 *  • Vertical line rendering (min→max per bucket column)
 *  • Centre-line drawn for empty regions
 *  • Stereo layout: L channel top half, R channel bottom half
 *  • Batched path drawing — one beginPath() per channel for GPU efficiency
 *  • Low-GC hot path: no object allocation inside the draw loop
 *
 * For very large files (>30 min) move extractPeaks() to a Worker.
 */

// ─── Types ──────────────────────────────────────────────────────────────────────

/** Peak data for a single audio channel. */
export interface ChannelPeaks {
    /** Min sample amplitude per bucket. Values in [−1, 0]. */
    min: Float32Array;
    /** Max sample amplitude per bucket. Values in [0, 1]. */
    max: Float32Array;
}

/**
 * Stereo-aware waveform peak data ready for Canvas rendering.
 *
 * `channels[0]` = Left  (or only channel for mono)
 * `channels[1]` = Right (stereo only)
 */
export interface WaveformPeaks {
    channels: ChannelPeaks[];
    /** Number of buckets in each channel's min/max arrays. */
    resolution: number;
    /** Audio file duration in seconds. */
    durationSeconds: number;
    /** 1 (mono) or 2 (stereo). */
    numChannels: number;
}

// ─── Serialisable form (for Zustand / JSON) ──────────────────────────────────────

/** Plain-number version of WaveformPeaks for Zustand / localStorage. */
export interface SerializedWaveformPeaks {
    channels: Array<{ min: number[]; max: number[] }>;
    resolution: number;
    durationSeconds: number;
    numChannels: number;
}

export function serializePeaks(peaks: WaveformPeaks): SerializedWaveformPeaks {
    return {
        channels: peaks.channels.map(ch => ({
            min: Array.from(ch.min),
            max: Array.from(ch.max),
        })),
        resolution: peaks.resolution,
        durationSeconds: peaks.durationSeconds,
        numChannels: peaks.numChannels,
    };
}

export function deserializePeaks(s: SerializedWaveformPeaks): WaveformPeaks {
    return {
        channels: s.channels.map(ch => ({
            min: new Float32Array(ch.min),
            max: new Float32Array(ch.max),
        })),
        resolution: s.resolution,
        durationSeconds: s.durationSeconds,
        numChannels: s.numChannels,
    };
}

// ─── extractPeaks ────────────────────────────────────────────────────────────────

/**
 * Extract waveform peak data from an AudioBuffer.
 *
 * For stereo buffers this returns two separate ChannelPeaks objects so the
 * renderer can display L and R in separate halves.
 *
 * Algorithm per bucket:
 *   Find the first sample value, use it as the initial min AND max.
 *   Walk remaining samples in the bucket, tracking running min/max.
 *   Clamp to [−1, 1] to handle over-driven audio.
 *
 * @param buffer     Decoded AudioBuffer from the Web Audio API.
 * @param resolution Number of buckets (pixel columns). Default: 2000.
 */
export function extractPeaks(buffer: AudioBuffer, resolution = 2000): WaveformPeaks {
    const numChannels = Math.min(buffer.numberOfChannels, 2); // cap at stereo
    const totalSamples = buffer.length;
    const samplesPerBucket = totalSamples / resolution;

    const channels: ChannelPeaks[] = [];

    for (let c = 0; c < numChannels; c++) {
        const raw = buffer.getChannelData(c);
        const minArr = new Float32Array(resolution);
        const maxArr = new Float32Array(resolution);

        for (let bucket = 0; bucket < resolution; bucket++) {
            const start = Math.floor(bucket * samplesPerBucket);
            const end   = Math.min(Math.floor((bucket + 1) * samplesPerBucket), totalSamples);

            if (start >= totalSamples) {
                minArr[bucket] = 0;
                maxArr[bucket] = 0;
                continue;
            }

            // Seed with the first sample so we never compare against 0
            let bMin = raw[start];
            let bMax = raw[start];

            for (let i = start + 1; i < end; i++) {
                const s = raw[i];
                if (s < bMin) bMin = s;
                if (s > bMax) bMax = s;
            }

            // Clamp: over-driven samples can exceed ±1
            minArr[bucket] = bMin < -1 ? -1 : bMin;
            maxArr[bucket] = bMax >  1 ?  1 : bMax;
        }

        channels.push({ min: minArr, max: maxArr });
    }

    return { channels, resolution, durationSeconds: buffer.duration, numChannels };
}

/** Async wrapper — yields to the event loop first to avoid jank on large files. */
export async function extractPeaksAsync(
    buffer: AudioBuffer,
    resolution = 2000,
): Promise<WaveformPeaks> {
    return new Promise(resolve => setTimeout(() => resolve(extractPeaks(buffer, resolution)), 0));
}

// ─── Legacy aliases that existing code imported ──────────────────────────────────

/** @deprecated Use extractPeaks() */
export const generateWaveformPeaks = (b: AudioBuffer, r?: number) => extractPeaks(b, r);
/** @deprecated Use extractPeaksAsync() */
export const generateWaveformPeaksAsync = (b: AudioBuffer, r?: number) => extractPeaksAsync(b, r);

// ─── drawWaveform ────────────────────────────────────────────────────────────────

export interface DrawWaveformOptions {
    /** Canvas 2D context to draw on. */
    ctx: CanvasRenderingContext2D;

    /** Peak data from extractPeaks(). */
    peaks: WaveformPeaks | SerializedWaveformPeaks;

    // --- Layout ---
    /** X offset to start drawing (default 0). */
    x?: number;
    /** Y offset of the entire waveform block (default 0). */
    y?: number;
    /** Width in pixels to draw into (default: canvas.width − x). */
    width?: number;
    /** Total height in pixels (default: canvas.height − y). */
    height?: number;

    // --- Style ---
    /** Waveform fill/stroke colour. Default: '#4ade80'. */
    color?: string;
    /** Alpha 0‥1. Default: 1. */
    alpha?: number;
    /** Optional background fill before drawing. */
    background?: string;

    // --- Layout mode ---
    /**
     * 'mono'   → draw channel 0 centred in the full height.
     * 'stereo' → draw channel 0 in the top half, channel 1 in the bottom half.
     * 'auto'   → mono if numChannels === 1, stereo otherwise. (default)
     */
    layout?: 'mono' | 'stereo' | 'auto';

    /** Draw a faint centre line for empty regions. Default: true. */
    drawCentreLine?: boolean;
}

/**
 * Draw waveform peaks onto a Canvas 2D context using vertical line strokes.
 *
 * Each bucket is drawn as a single vertical line segment from min to max.
 * All lines for one channel are batched into a single canvas Path for
 * maximum throughput (one beginPath + one stroke per channel).
 */
export function drawWaveform(opts: DrawWaveformOptions): void {
    const { ctx, peaks } = opts;
    const canvas = ctx.canvas;

    const xOff    = opts.x      ?? 0;
    const yOff    = opts.y      ?? 0;
    const W       = opts.width  ?? (canvas.width  - xOff);
    const H       = opts.height ?? (canvas.height - yOff);
    const color   = opts.color  ?? '#4ade80';
    const alpha   = opts.alpha  ?? 1;
    const drawCL  = opts.drawCentreLine ?? true;

    // Background
    if (opts.background) {
        ctx.fillStyle = opts.background;
        ctx.fillRect(xOff, yOff, W, H);
    }

    const layout = opts.layout ?? 'auto';
    const numCh  = peaks.numChannels;
    const isStereo = layout === 'stereo' || (layout === 'auto' && numCh >= 2);

    ctx.save();
    ctx.globalAlpha = alpha;

    const channelsToDraw = isStereo
        ? peaks.channels.slice(0, 2)
        : [peaks.channels[0]];

    const chCount = channelsToDraw.length;

    channelsToDraw.forEach((ch, chIdx) => {
        const chH   = H / chCount;           // height of this channel's lane
        const chY   = yOff + chIdx * chH;    // top-left Y of this lane
        const midY  = chY + chH / 2;

        const { min, max } = ch;
        const res   = peaks.resolution;
        const colW  = W / res;

        // ── Centre line ─────────────────────────────────────────────────────────
        if (drawCL) {
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.globalAlpha = alpha * 0.2;
            ctx.lineWidth = 1;
            ctx.moveTo(xOff, midY);
            ctx.lineTo(xOff + W, midY);
            ctx.stroke();
            ctx.globalAlpha = alpha;
        }

        // ── Waveform lines (batched path) ────────────────────────────────────────
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth   = Math.max(1, colW - 0.5);

        for (let i = 0; i < res; i++) {
            const px = xOff + (i + 0.5) * colW;         // centre of this column
            // min is ≤ 0 → maps above centre; max is ≥ 0 → maps below centre
            const top    = midY + min[i] * (chH / 2);   // min is negative → subtract
            const bottom = midY + max[i] * (chH / 2);

            ctx.moveTo(px, top);
            ctx.lineTo(px, bottom);
        }

        ctx.stroke();
    });

    ctx.restore();
}

// ─── Legacy canvas options (kept for backwards compat) ───────────────────────────

/** @deprecated Use DrawWaveformOptions with the new drawWaveform() */
export interface DrawWaveformOptionsLegacy {
    ctx: CanvasRenderingContext2D;
    peaks: any;
    x?: number; y?: number; width?: number; height?: number;
    color?: string; background?: string;
}
