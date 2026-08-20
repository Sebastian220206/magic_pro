/**
 * Snap resolution for the piano roll.
 *
 * Logic's Snap menu is two independent choices that read as one list: a *mode*
 * (Smart, Bar, Beat, Division, Ticks, Frames) and, when the mode is Division,
 * a *value* (1/1 … 1/64, straight or triplet). Keeping the arithmetic here
 * rather than in the menu means the grid the user picks is the grid the editor
 * actually uses, and that it can be tested without a DOM.
 */

/** How a position is rounded. */
export type SnapMode = 'smart' | 'bar' | 'beat' | 'division' | 'ticks' | 'frames';

export interface SnapSettings {
    mode: SnapMode;
    /** Denominator of the note value: 4 means 1/4. Used by `division`. */
    division: number;
    /** Three in the space of two. */
    triplet: boolean;
    /** Beats per bar, from the project's time signature. */
    beatsPerBar: number;
    /**
     * Horizontal zoom in pixels per beat. Only `smart` reads it — that is the
     * whole point of Smart: the grid follows how much detail is on screen.
     */
    pixelsPerBeat?: number;
}

/** Straight note values offered by the menu, coarsest first. */
export const SNAP_DIVISIONS = [1, 2, 4, 8, 16, 32, 64] as const;

/** Triplet values. Logic offers no 1/1 triplet, and neither do we. */
export const SNAP_TRIPLETS = [2, 4, 8, 16, 32, 64] as const;

/** One tick at 960 PPQN, the resolution the rest of the editor stores at. */
export const TICK_BEATS = 1 / 960;

/**
 * Smart picks the finest grid that still leaves room to see, so the same drag
 * lands on bars when zoomed out and on sixteenths when zoomed in. The
 * threshold is the narrowest gridline spacing that stays usable with a mouse.
 */
const SMART_MIN_PIXELS = 24;
const SMART_DEFAULT_PIXELS_PER_BEAT = 80;

/** Length of one note value in beats, where a beat is a quarter note. */
export function divisionBeats(division: number, triplet = false): number {
    if (!Number.isFinite(division) || division <= 0) return 1;
    const straight = 4 / division;
    return triplet ? straight * (2 / 3) : straight;
}

/** Human label, matching the menu: `1/8`, `1/8 T`. */
export function divisionLabel(division: number, triplet = false): string {
    return triplet ? `1/${division} T` : `1/${division}`;
}

/**
 * The grid spacing a set of settings resolves to, in beats.
 *
 * `frames` has no musical length — it needs a video frame rate the project
 * does not carry — so it falls back to ticks rather than silently snapping to
 * something wrong. The menu shows it disabled for the same reason.
 */
export function snapGridBeats(settings: SnapSettings): number {
    const bar = Math.max(1, settings.beatsPerBar || 4);

    switch (settings.mode) {
        case 'bar':
            return bar;
        case 'beat':
            return 1;
        case 'ticks':
        case 'frames':
            return TICK_BEATS;
        case 'smart': {
            const ppb = settings.pixelsPerBeat ?? SMART_DEFAULT_PIXELS_PER_BEAT;
            // Finest first: we want the smallest grid that still has room to
            // be seen and hit. Walking coarsest-first returns 1/1 at every
            // zoom, because the widest value always clears the threshold.
            for (let i = SNAP_DIVISIONS.length - 1; i >= 0; i--) {
                const beats = divisionBeats(SNAP_DIVISIONS[i]);
                if (beats * ppb >= SMART_MIN_PIXELS) return beats;
            }
            // Zoomed out so far that even a whole bar is a few pixels; the
            // coarsest value is the best available.
            return divisionBeats(SNAP_DIVISIONS[0]);
        }
        case 'division':
        default:
            return divisionBeats(settings.division, settings.triplet);
    }
}

/**
 * Round a position onto the grid — Logic's "Snap Notes to Absolute Value".
 *
 * Nearest, not floor. Flooring makes every note you nudge drift earlier, which
 * is what the editor used to do.
 */
export function snapBeat(beat: number, settings: SnapSettings): number {
    const grid = snapGridBeats(settings);
    if (!(grid > 0)) return beat;
    return Math.max(0, Math.round(beat / grid) * grid);
}

/**
 * Round a *movement* onto the grid — "Snap Notes to Relative Value".
 *
 * The note keeps whatever offset it already had from the gridline and moves in
 * whole grid steps. That is what lets you shift a deliberately late-played
 * phrase by exactly a bar without flattening its feel onto the grid.
 */
export function snapDelta(deltaBeats: number, settings: SnapSettings): number {
    const grid = snapGridBeats(settings);
    if (!(grid > 0)) return deltaBeats;
    return Math.round(deltaBeats / grid) * grid;
}

/**
 * Apply a movement to a position, honouring the absolute/relative choice.
 *
 * `relative` keeps the note's distance from the grid; absolute lands it on the
 * line. Both are reachable from the menu, and this is the one place that has
 * to know the difference.
 */
export function applySnappedMove(
    startBeat: number,
    deltaBeats: number,
    settings: SnapSettings,
    relative: boolean,
): number {
    return relative
        ? Math.max(0, startBeat + snapDelta(deltaBeats, settings))
        : snapBeat(startBeat + deltaBeats, settings);
}

/** What the trigger shows next to the power button. */
export function snapModeLabel(settings: SnapSettings): string {
    switch (settings.mode) {
        case 'smart': return 'Smart';
        case 'bar': return 'Bar';
        case 'beat': return 'Beat';
        case 'ticks': return 'Ticks';
        case 'frames': return 'Frames';
        case 'division':
        default:
            return divisionLabel(settings.division, settings.triplet);
    }
}
