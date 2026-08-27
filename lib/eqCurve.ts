/**
 * The maths the EQ display needs, kept out of the component so it can be
 * tested without a canvas.
 *
 * Frequency is drawn logarithmically because hearing is: the octave from 100
 * to 200 Hz occupies as much of the display as the one from 5k to 10k.
 */

export const EQ_MIN_HZ = 20;
export const EQ_MAX_HZ = 20000;
/** The display's vertical range, in dB either side of flat. */
export const EQ_DB_RANGE = 18;

/** Where a frequency sits across a display of the given width. */
export function freqToX(hz: number, width: number): number {
    const clamped = Math.max(EQ_MIN_HZ, Math.min(EQ_MAX_HZ, hz));
    return (Math.log10(clamped / EQ_MIN_HZ) / Math.log10(EQ_MAX_HZ / EQ_MIN_HZ)) * width;
}

/** The frequency under a horizontal position. Inverse of `freqToX`. */
export function xToFreq(x: number, width: number): number {
    const fraction = width > 0 ? Math.max(0, Math.min(1, x / width)) : 0;
    return EQ_MIN_HZ * Math.pow(EQ_MAX_HZ / EQ_MIN_HZ, fraction);
}

/** Where a gain sits down a display of the given height. */
export function dbToY(db: number, height: number): number {
    const clamped = Math.max(-EQ_DB_RANGE, Math.min(EQ_DB_RANGE, db));
    return height / 2 - (clamped / EQ_DB_RANGE) * (height / 2);
}

/** The gain at a vertical position. Inverse of `dbToY`. */
export function yToDb(y: number, height: number): number {
    if (height <= 0) return 0;
    return ((height / 2 - y) / (height / 2)) * EQ_DB_RANGE;
}

/** The gridlines and labels down the frequency axis. */
export const FREQ_GRID = [
    { hz: 50, label: '50' },
    { hz: 100, label: '100' },
    { hz: 200, label: '200' },
    { hz: 500, label: '500' },
    { hz: 1000, label: '1k' },
    { hz: 2000, label: '2k' },
    { hz: 5000, label: '5k' },
    { hz: 10000, label: '10k' },
] as const;

/** The gridlines down the gain axis. */
export const DB_GRID = [18, 12, 6, 0, -6, -12, -18] as const;

/** Colour per band, matching the spectrum left to right. */
export const BAND_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#06b6d4', '#3b82f6', '#a855f7', '#ec4899',
] as const;

/** A frequency written the way an engineer says it. */
export function formatHz(hz: number): string {
    if (!Number.isFinite(hz)) return '—';
    if (hz >= 10000) return `${(hz / 1000).toFixed(0)}kHz`;
    if (hz >= 1000) return `${(hz / 1000).toFixed(1)}kHz`;
    return `${Math.round(hz)}Hz`;
}

export function formatDb(db: number): string {
    if (!Number.isFinite(db)) return '—';
    return `${db >= 0 ? '+' : ''}${db.toFixed(1)}dB`;
}

/**
 * Which band node is under a point, or null.
 *
 * Nodes are found by pixel distance rather than by frequency distance: two
 * bands an octave apart are far away at the bottom of the display and close
 * together at the top, and the mouse only knows about pixels.
 */
export function bandAtPoint(
    bands: { frequency: number; gain: number; enabled: boolean }[],
    x: number,
    y: number,
    width: number,
    height: number,
    radius = 12,
): number | null {
    let best: number | null = null;
    let bestDistance = radius;
    bands.forEach((band, index) => {
        const dx = freqToX(band.frequency, width) - x;
        const dy = dbToY(band.gain, height) - y;
        const distance = Math.hypot(dx, dy);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = index;
        }
    });
    return best;
}

/**
 * The colour a spectrum bin is drawn in.
 *
 * The reference tints the analyser across the spectrum so a peak can be
 * matched to the band that will treat it without reading the axis.
 */
export function spectrumColor(hz: number): string {
    const fraction = Math.max(0, Math.min(1, freqToX(hz, 1)));
    const index = Math.min(BAND_COLORS.length - 1, Math.floor(fraction * BAND_COLORS.length));
    return BAND_COLORS[index];
}
