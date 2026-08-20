/**
 * Which notes a rubber-band selection catches.
 *
 * Split out of the piano roll so the rule can be tested without a DOM and
 * without a mouse. The rule itself is the interesting part: a band selects
 * every note it *touches*, not only notes that begin inside it.
 */

export interface MarqueeNote {
    id: string;
    pitch: number;
    startBeat: number;
    duration: number;
}

export interface MarqueeBox {
    startBeat: number;
    endBeat: number;
    lowPitch: number;
    highPitch: number;
}

/**
 * Normalise a drag into a box, whichever corner it started from.
 *
 * Pitch runs the opposite way to screen Y, so the caller converts first and
 * this just orders the pair.
 */
export function marqueeBox(
    a: { beat: number; pitch: number },
    b: { beat: number; pitch: number },
): MarqueeBox {
    return {
        startBeat: Math.min(a.beat, b.beat),
        endBeat: Math.max(a.beat, b.beat),
        lowPitch: Math.min(a.pitch, b.pitch),
        highPitch: Math.max(a.pitch, b.pitch),
    };
}

/**
 * Notes the band overlaps.
 *
 * Overlap, not containment. Selecting only notes whose *start* falls inside
 * the band makes a long held note impossible to catch: you can drag across the
 * middle of it all day and never touch its beginning.
 *
 * The beat comparison is a half-open interval, so a band ending exactly where
 * a note begins does not drag that note in.
 */
export function notesInMarquee<T extends MarqueeNote>(notes: readonly T[], box: MarqueeBox): T[] {
    return notes.filter(n =>
        n.pitch >= box.lowPitch &&
        n.pitch <= box.highPitch &&
        n.startBeat < box.endBeat &&
        n.startBeat + n.duration > box.startBeat);
}

/** Below this a press is a click, not a drag — measured on both axes. */
export const MARQUEE_MIN_DRAG_PX = 4;

/**
 * Whether a press should be treated as a drag.
 *
 * Both axes count. Measuring width alone made a straight-down drag — the
 * natural way to grab a chord — read as a click, which cleared the selection
 * instead of making one.
 */
export function isMarqueeDrag(dx: number, dy: number, threshold = MARQUEE_MIN_DRAG_PX): boolean {
    return Math.abs(dx) >= threshold || Math.abs(dy) >= threshold;
}
