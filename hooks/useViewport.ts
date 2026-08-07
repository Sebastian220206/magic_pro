"use client";

import { useEffect, useState } from "react";

/**
 * useViewport.ts
 * Screen size and orientation, as one source of truth.
 *
 * The studio is a dense desktop layout — before this, nothing in it responded
 * to viewport size at all. Rather than scatter Tailwind breakpoints through
 * components whose spacing is measured in single pixels, the few places that
 * genuinely need to behave differently read this.
 *
 * Media queries rather than `window.innerWidth` on resize: they fire only when
 * the answer changes, not on every frame of a rotation animation.
 */

/**
 * Below this, the studio's chrome does not fit and has to be trimmed.
 *
 * 900px rather than a phone width: a landscape phone is ~844px wide, and that
 * is precisely the case this exists for. Small tablets in portrait land here
 * too, which is correct — they are just as short of room.
 */
const COMPACT_MAX_WIDTH = 900;

/**
 * Below this the viewport is too short for the studio's stacked control rows
 * even in landscape, so they collapse further. A landscape phone is ~390-430px
 * tall.
 */
const SHORT_MAX_HEIGHT = 500;

export interface Viewport {
    /** Small screen — trim chrome, enlarge touch targets. */
    compact: boolean;
    /** Taller than wide. */
    portrait: boolean;
    /** Very little vertical room, e.g. a phone held sideways. */
    short: boolean;
    /**
     * Coarse pointer — finger rather than mouse.
     *
     * Separate from `compact` on purpose: a touchscreen laptop is not compact,
     * and a small browser window on a desktop is compact without being touch.
     */
    touch: boolean;
    /**
     * False until the queries have been read.
     *
     * `window.matchMedia` does not exist during server rendering, so the first
     * paint has to assume the desktop layout. Anything that would be disruptive
     * to show and then immediately replace — a rotate-your-device gate, say —
     * should wait for this rather than flashing.
     */
    ready: boolean;
}

/**
 * What every consumer sees before the queries have been read.
 *
 * Exported so the contract can be asserted: it must describe a desktop, and
 * `ready` must be false, or a server render and its first client paint would
 * disagree.
 */
export const INITIAL_VIEWPORT: Viewport = {
    compact: false,
    portrait: false,
    short: false,
    touch: false,
    ready: false,
};

export function useViewport(): Viewport {
    const [viewport, setViewport] = useState<Viewport>(INITIAL_VIEWPORT);

    useEffect(() => {
        const queries = {
            compact: window.matchMedia(`(max-width: ${COMPACT_MAX_WIDTH}px)`),
            portrait: window.matchMedia("(orientation: portrait)"),
            short: window.matchMedia(`(max-height: ${SHORT_MAX_HEIGHT}px)`),
            touch: window.matchMedia("(pointer: coarse)"),
        };

        const read = () => setViewport({
            compact: queries.compact.matches,
            portrait: queries.portrait.matches,
            short: queries.short.matches,
            touch: queries.touch.matches,
            ready: true,
        });

        read();

        for (const query of Object.values(queries)) {
            query.addEventListener("change", read);
        }
        return () => {
            for (const query of Object.values(queries)) {
                query.removeEventListener("change", read);
            }
        };
    }, []);

    return viewport;
}
