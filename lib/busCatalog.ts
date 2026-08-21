/**
 * The project's bus numbers.
 *
 * A console has a fixed set of buses whether or not you have used them, and
 * assigning a send to an unused one is what brings its aux strip into being.
 * Our buses are tracks, so before this the Bus menu could only offer buses
 * that already existed — you had to go and make an aux track first, then come
 * back and send to it.
 *
 * The numbering here is the catalogue the menu shows; `ensureBusTrack` in the
 * store turns a chosen number into a real aux strip.
 */

/** How many buses the project has, matching the reference console. */
export const BUS_COUNT = 256;

/** How many are listed directly before the menu starts paging. */
export const BUSES_ON_FIRST_PAGE = 32;

/** How many each paged submenu holds. */
export const BUSES_PER_PAGE = 32;

export interface BusPage {
    /** First bus number in the page, 1-based. */
    from: number;
    /** Last bus number in the page, inclusive. */
    to: number;
    /** What the row reads: `33 - 64`. */
    label: string;
}

/** `Bus 7`. The name an aux strip takes when it is created. */
export function busName(busNumber: number): string {
    return `Bus ${busNumber}`;
}

/** The bus numbers listed directly on the menu's first level. */
export function firstPageBuses(): number[] {
    return Array.from({ length: BUSES_ON_FIRST_PAGE }, (_, i) => i + 1);
}

/**
 * The paged ranges below them.
 *
 * A flat list of 256 rows is unusable; the reference shows 32 and pages the
 * rest in blocks of 32.
 */
export function busPages(): BusPage[] {
    const pages: BusPage[] = [];
    for (let from = BUSES_ON_FIRST_PAGE + 1; from <= BUS_COUNT; from += BUSES_PER_PAGE) {
        const to = Math.min(from + BUSES_PER_PAGE - 1, BUS_COUNT);
        pages.push({ from, to, label: `${from} - ${to}` });
    }
    return pages;
}

/** Every bus number inside one page. */
export function busesInPage(page: BusPage): number[] {
    return Array.from({ length: page.to - page.from + 1 }, (_, i) => page.from + i);
}

/**
 * Read a bus number back off a track name.
 *
 * Returns null for an aux the user has renamed, which is fine: it keeps its
 * own name in the menu and is matched by id instead.
 */
export function busNumberFromName(name: string | undefined | null): number | null {
    const match = /^bus\s+(\d+)$/i.exec((name ?? '').trim());
    if (!match) return null;
    const value = Number(match[1]);
    return value >= 1 && value <= BUS_COUNT ? value : null;
}
