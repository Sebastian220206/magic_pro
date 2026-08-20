/**
 * Channel-strip level arithmetic.
 *
 * The mixer showed a fader with no numbers anywhere: no dB value, no peak
 * readout, and no clipping indicator. You could not tell whether a strip was
 * hot without listening for distortion, and there was no way to type a level
 * in. This holds the conversions behind those readouts so they can be checked
 * without a DOM.
 *
 * Gain is stored as a linear multiplier, where 1.0 is unity — 0 dB. The fader
 * travels a little past unity so a quiet part can be pushed up.
 */

/** Loudest the fader goes: +1.6 dB or so, matching the existing range. */
export const MAX_GAIN = 1.2;

/** Anything at or below this reads as silence rather than a huge negative dB. */
export const SILENCE_DB = -60;

/** Above this the signal is clipping. */
export const CLIP_DB = 0;

/** Logic's bands: amber and yellow are safe, red is hot. */
export const HOT_DB = -6;

export type LevelBand = 'safe' | 'hot' | 'clip';

/** Linear gain to decibels, floored at silence so the readout stays finite. */
export function gainToDb(gain: number): number {
    if (!Number.isFinite(gain) || gain <= 0) return -Infinity;
    return 20 * Math.log10(gain);
}

/** Decibels back to linear gain. `-Infinity` is silence. */
export function dbToGain(db: number): number {
    if (!Number.isFinite(db)) return db > 0 ? MAX_GAIN : 0;
    return Math.pow(10, db / 20);
}

/**
 * How a level is written on a channel strip.
 *
 * Silence is a dash rather than `-Infinity dB`, and the sign is always shown
 * so a boost cannot be mistaken for a cut at a glance.
 */
export function formatDb(db: number, digits = 1): string {
    if (!Number.isFinite(db) || db <= SILENCE_DB) return '-∞';
    const rounded = Number(db.toFixed(digits));
    if (Object.is(rounded, -0)) return '0.0';
    return `${rounded > 0 ? '+' : ''}${rounded.toFixed(digits)}`;
}

/** The dB a fader position represents, for the readout under the pan knob. */
export function faderDbLabel(gain: number): string {
    return formatDb(gainToDb(gain));
}

/**
 * Parse what someone typed into the level field.
 *
 * Accepts `-6`, `-6.0 dB`, `+2`, and `-inf`. Returns null when it cannot be
 * read, so the caller can leave the fader alone rather than jumping to zero.
 */
export function parseDb(input: string): number | null {
    const text = input.trim().toLowerCase().replace(/db$/, '').trim();
    if (!text) return null;
    if (/^-\s*(inf|infinity|∞)$/.test(text)) return -Infinity;
    const value = Number(text.replace(/^\+/, ''));
    return Number.isFinite(value) ? value : null;
}

/** Clamp a typed dB value to what the fader can actually reach. */
export function clampGain(gain: number): number {
    if (!Number.isFinite(gain)) return gain > 0 ? MAX_GAIN : 0;
    return Math.max(0, Math.min(MAX_GAIN, gain));
}

/**
 * Which band a level falls in, for colouring the meter and the peak display.
 *
 * Clipping is at 0 dBFS and above; that is the only one worth alarming about,
 * and only on the output — an individual strip peaking is normal.
 */
export function levelBand(db: number): LevelBand {
    if (!Number.isFinite(db)) return 'safe';
    if (db >= CLIP_DB) return 'clip';
    if (db >= HOT_DB) return 'hot';
    return 'safe';
}

/** Running peak-hold, as the numeric display above each meter needs. */
export interface PeakState {
    /** Loudest dB seen since the last reset. */
    peakDb: number;
    /** True once the signal has reached 0 dBFS; latches until reset. */
    clipped: boolean;
}

export const initialPeak: PeakState = { peakDb: -Infinity, clipped: false };

/**
 * Fold a new reading into the running peak.
 *
 * The clip flag latches: a single overload during a take is exactly what the
 * indicator exists to tell you about, and it would be missed if the flag
 * followed the current level.
 */
export function updatePeak(state: PeakState, db: number): PeakState {
    if (!Number.isFinite(db)) return state;
    const peakDb = db > state.peakDb ? db : state.peakDb;
    const clipped = state.clipped || db >= CLIP_DB;
    if (peakDb === state.peakDb && clipped === state.clipped) return state;
    return { peakDb, clipped };
}

/**
 * Pan as Logic writes it: centre, or a number from 1 to 64 either side.
 *
 * Stored as -1..+1, shown as -64..+63 to match what the field accepts.
 */
export function formatPan(pan: number): string {
    if (!Number.isFinite(pan) || Math.abs(pan) < 0.005) return 'C';
    const value = Math.round(pan * 64);
    return value < 0 ? `L${Math.abs(value)}` : `R${Math.min(63, value)}`;
}

/** Parse a typed pan value, accepting `L20`, `R20`, `-20`, `20` and `C`. */
export function parsePan(input: string): number | null {
    const text = input.trim().toLowerCase();
    if (!text) return null;
    if (text === 'c' || text === 'center' || text === 'centre') return 0;
    const match = /^([lr])?\s*(-?\d+(?:\.\d+)?)$/.exec(text);
    if (!match) return null;
    let value = Number(match[2]);
    if (match[1] === 'l') value = -Math.abs(value);
    if (match[1] === 'r') value = Math.abs(value);
    if (!Number.isFinite(value)) return null;
    return Math.max(-1, Math.min(1, value / 64));
}
