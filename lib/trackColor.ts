/**
 * Track colours, normalised to the studio's neon range.
 *
 * ## Why not a lookup table
 *
 * Nothing in a project distinguishes a colour the user deliberately picked from
 * `ColorPalette` from one a template or `addTrack` assigned by default. A
 * straight old-hex → new-hex remap would therefore silently overwrite choices:
 * a user who set a track to deep red would find it green because deep red
 * happened to be a default somewhere.
 *
 * So the hue is preserved and only saturation and luminance are unified. A red
 * track stays red — it just becomes a neon red, at the same brightness as every
 * other track. That also means the function works on colours it has never seen,
 * including whatever a future picker offers.
 *
 * ## Why at render time
 *
 * Stored project data is untouched. The mapping is a presentation concern, it
 * needs no migration, it is reversible by deleting this file's call sites, and
 * an old project opened in an older build still looks the way it did.
 */

/** Saturation and lightness every track colour is normalised to. */
const NEON_SATURATION = 0.82;
const NEON_LIGHTNESS = 0.62;

/** Below this saturation a colour has no hue worth preserving. */
const ACHROMATIC_BELOW = 0.08;

/** Greys, whites and blacks have no hue, so they land on the studio accent. */
const ACCENT = '#22d3ee';

/**
 * The reference palette. Not used as a lookup — it is what
 * `NEON_SATURATION`/`NEON_LIGHTNESS` were tuned against, and what the default
 * assignments in `NewTrackDialog` and `projectStore` draw from.
 */
export const NEON_TRACK_PALETTE = [
    '#22d3ee', // cyan
    '#4ade80', // green
    '#fb923c', // amber
    '#ec4899', // pink
    '#a78bfa', // violet
    '#e879f9', // fuchsia
] as const;

function parseHex(hex: string): [number, number, number] | null {
    let h = hex.trim().replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length === 8) h = h.slice(0, 6); // drop an alpha suffix
    if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) return null;
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h: number;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
    const f = (n: number) => {
        const k = (n + h * 12) % 12;
        const a = s * Math.min(l, 1 - l);
        const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
        return Math.round(v * 255).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

/** Bounded so a long project cannot grow the cache without limit. */
const cache = new Map<string, string>();
const CACHE_LIMIT = 512;

/**
 * Snap `hex` into the neon range, preserving its hue.
 *
 * Called per track per frame in the timeline, so results are memoised. Returns
 * the accent for anything unparseable rather than throwing — a malformed colour
 * in stored data must not blank the arrangement.
 */
export function neonTrackColor(hex: string | null | undefined): string {
    if (!hex) return ACCENT;

    const hit = cache.get(hex);
    if (hit !== undefined) return hit;

    const rgb = parseHex(hex);
    let result: string;
    if (!rgb) {
        result = ACCENT;
    } else {
        const [h, s] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
        result = s < ACHROMATIC_BELOW ? ACCENT : hslToHex(h, NEON_SATURATION, NEON_LIGHTNESS);
    }

    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(hex, result);
    return result;
}

/** Relative luminance, per WCAG 2.1. */
function luminance(r: number, g: number, b: number): number {
    const f = (v: number) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Contrast ratio against the studio's darkest ground. */
const VOID_LUMINANCE = luminance(4, 7, 11);
const contrastOnVoid = (hex: string): number => {
    const [r, g, b] = parseHex(hex)!;
    const l = luminance(r, g, b);
    return (Math.max(l, VOID_LUMINANCE) + 0.05) / (Math.min(l, VOID_LUMINANCE) + 0.05);
};

/** WCAG AA for normal text. */
const AA_CONTRAST = 4.5;

const textCache = new Map<string, string>();

/**
 * The track colour, lifted until it is legible as *text*.
 *
 * A fixed HSL lightness gives a coherent family of fills but not a coherent
 * family of text: at L=62% a yellow clears 10:1 against the near-black ground
 * while a violet manages 4.26:1 and fails AA. Rather than raise the lightness
 * of every colour — which would blow out the greens and ambers — only the hues
 * that need it are lifted, and only when used for type.
 *
 * Use `neonTrackColor` for fills, stripes and waveforms; this for text.
 */
export function neonTrackTextColor(hex: string | null | undefined): string {
    const base = neonTrackColor(hex);
    const hit = textCache.get(base);
    if (hit !== undefined) return hit;

    let result = base;
    if (contrastOnVoid(base) < AA_CONTRAST) {
        const [h] = rgbToHsl(...(parseHex(base) as [number, number, number]));
        for (let l = NEON_LIGHTNESS; l <= 0.94; l += 0.02) {
            const candidate = hslToHex(h, NEON_SATURATION, l);
            if (contrastOnVoid(candidate) >= AA_CONTRAST) { result = candidate; break; }
            result = candidate;
        }
    }

    if (textCache.size >= CACHE_LIMIT) textCache.clear();
    textCache.set(base, result);
    return result;
}

/**
 * The same hue at a chosen alpha, for glows, fills and selection washes.
 * Kept here so callers never hand-write `rgba()` from a track colour and drift
 * out of the palette.
 */
export function neonTrackAlpha(hex: string | null | undefined, alpha: number): string {
    const rgb = parseHex(neonTrackColor(hex))!;
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/** A deterministic palette colour for an index — used when assigning defaults. */
export function neonTrackColorForIndex(index: number): string {
    return NEON_TRACK_PALETTE[((index % NEON_TRACK_PALETTE.length) + NEON_TRACK_PALETTE.length) % NEON_TRACK_PALETTE.length];
}
