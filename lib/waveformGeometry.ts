/**
 * The shape of a waveform, as an SVG path.
 *
 * What this replaces drew 100 hairline strokes with `fill="none"` — a fixed
 * count whatever the clip's width, point-sampled with `idx = floor(i * step)`
 * so it kept one bucket in ten and threw the rest away. Two consequences: a
 * transient between the sampled buckets simply vanished, and the shape
 * *changed* as you zoomed, because a different tenth of the data was kept.
 * It also read `channels[0]` only, so a stereo clip showed the left channel.
 *
 * Pure geometry, no DOM, so the arithmetic can be tested without a browser.
 */

export interface PeakChannel {
    min: ArrayLike<number>;
    max: ArrayLike<number>;
}

export interface PeakSource {
    channels: ReadonlyArray<PeakChannel>;
    /** Deliberately unused — see `bucketCount`. */
    resolution?: number;
    durationSeconds?: number;
    numChannels?: number;
}

export interface EnvelopeOptions {
    /** Rendered width in CSS pixels. */
    width: number;
    /** Rendered height in CSS pixels. */
    height: number;
    /** Fraction of the source to draw, for a trimmed clip. Defaults to all. */
    window?: { from: number; to: number };
    /** Thinnest the body is allowed to get, so silence still draws a line. */
    minThickness?: number;
    /** Breathing room at the top and bottom. */
    padding?: number;
    /** Ceiling on vertices, so a very wide clip does not build a huge string. */
    maxPoints?: number;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * How many buckets the data actually has.
 *
 * From the array length, never from `peaks.resolution`. Nothing enforces that
 * the two agree — the recorder writes 1000 and the importer 2000, and a
 * mismatch would read past the end and put `NaN` into the path.
 */
function bucketCount(peaks: PeakSource): number {
    let len = Infinity;
    for (const ch of peaks.channels ?? []) {
        if (!ch?.min || !ch?.max) return 0;
        len = Math.min(len, ch.min.length, ch.max.length);
    }
    return Number.isFinite(len) ? len : 0;
}

/** Whether there is anything real to draw. */
export function hasPeaks(peaks: PeakSource | undefined | null): boolean {
    return !!peaks && (peaks.channels?.length ?? 0) > 0 && bucketCount(peaks) > 0;
}

/**
 * A filled envelope between the true minimum and maximum.
 *
 * Not mirrored: the top edge follows the real maximum and the bottom the real
 * minimum, so a lopsided or DC-offset signal draws lopsided. That asymmetry is
 * information — it is how a badly gain-staged take looks different from a
 * clean one.
 */
export function envelopePath(peaks: PeakSource, options: EnvelopeOptions): string {
    const {
        width, height,
        window: win,
        minThickness = 1,
        padding = 1,
        maxPoints = 2048,
    } = options;

    if (!(width > 0) || !(height > 0) || !hasPeaks(peaks)) return '';

    const total = bucketCount(peaks);
    const from = clamp(win?.from ?? 0, 0, 1);
    const to = clamp(win?.to ?? 1, 0, 1);
    const i0 = Math.floor(Math.min(from, to) * total);
    const i1 = Math.ceil(Math.max(from, to) * total);
    const span = Math.max(1, i1 - i0);

    // One column per pixel, never more columns than there are buckets: past
    // that the fill would be interpolating between two measured peaks, which is
    // honest, rather than inventing a stair-step that was never measured.
    const n = Math.max(2, Math.min(Math.round(width), span, maxPoints));

    const mid = height / 2;
    const amp = Math.max(0, height / 2 - padding);
    const half = minThickness / 2;

    const tops: number[] = new Array(n);
    const bots: number[] = new Array(n);
    const xs: number[] = new Array(n);

    for (let k = 0; k < n; k++) {
        const b0 = i0 + Math.floor((k * span) / n);
        const b1 = Math.max(b0 + 1, i0 + Math.floor(((k + 1) * span) / n));

        let lo = Infinity;
        let hi = -Infinity;
        // Every bucket in the column and every channel — aggregating rather
        // than sampling is what keeps a transient from disappearing, and
        // combining channels is what stops a stereo clip showing only its left.
        for (const ch of peaks.channels) {
            for (let b = b0; b < b1 && b < total; b++) {
                const cLo = Number(ch.min[b]);
                const cHi = Number(ch.max[b]);
                if (Number.isFinite(cLo)) lo = Math.min(lo, clamp(cLo, -1, 1));
                if (Number.isFinite(cHi)) hi = Math.max(hi, clamp(cHi, -1, 1));
            }
        }
        if (!Number.isFinite(lo) || !Number.isFinite(hi)) { lo = 0; hi = 0; }

        let top = mid - hi * amp;
        let bot = mid - lo * amp;

        // Keep a visible hairline through silence. Expanded about the pair's
        // own centre, not the lane's, so quiet-but-offset content stays put.
        if (bot - top < minThickness) {
            const centre = (top + bot) / 2;
            top = centre - half;
            bot = centre + half;
        }

        tops[k] = clamp(top, 0, height);
        bots[k] = clamp(bot, 0, height);
        // Span the full width: bucket centres would leave a half-column gap at
        // each end, which on a filled shape reads as a chip out of the corner.
        xs[k] = n === 1 ? width / 2 : (k * width) / (n - 1);
    }

    const r = (v: number) => Math.round(v * 100) / 100;

    let d = `M${r(xs[0])} ${r(tops[0])}`;
    for (let k = 1; k < n; k++) d += ` L${r(xs[k])} ${r(tops[k])}`;
    for (let k = n - 1; k >= 0; k--) d += ` L${r(xs[k])} ${r(bots[k])}`;
    return `${d} Z`;
}
