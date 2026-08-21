/**
 * The project's bus numbering.
 *
 * A console has its buses whether or not you have used them, and choosing an
 * unused one is what brings its aux strip into being. Before this the Bus menu
 * could only offer auxes that already existed, so sending to a new bus meant
 * leaving the menu, making a track, and coming back.
 */

import {
    BUS_COUNT, BUSES_ON_FIRST_PAGE, BUSES_PER_PAGE,
    busName, firstPageBuses, busPages, busesInPage, busNumberFromName,
} from '../busCatalog';

describe('the first level of the menu', () => {
    it('lists the first 32 buses directly', () => {
        const first = firstPageBuses();
        expect(first).toHaveLength(BUSES_ON_FIRST_PAGE);
        expect(first[0]).toBe(1);
        expect(first[first.length - 1]).toBe(32);
    });
});

describe('the paged ranges', () => {
    const pages = busPages();

    it('starts where the direct list stops and ends at the last bus', () => {
        expect(pages[0].from).toBe(BUSES_ON_FIRST_PAGE + 1);
        expect(pages[pages.length - 1].to).toBe(BUS_COUNT);
    });

    it('labels them the way the reference does', () => {
        expect(pages[0].label).toBe('33 - 64');
        expect(pages[1].label).toBe('65 - 96');
        expect(pages[pages.length - 1].label).toBe('225 - 256');
    });

    it('covers every bus exactly once, with none missing', () => {
        const covered = [...firstPageBuses(), ...pages.flatMap(busesInPage)];
        expect(covered).toHaveLength(BUS_COUNT);
        expect(new Set(covered).size).toBe(BUS_COUNT);
        expect(Math.min(...covered)).toBe(1);
        expect(Math.max(...covered)).toBe(BUS_COUNT);
    });

    it('gives each page a full block', () => {
        for (const page of pages) {
            expect(busesInPage(page)).toHaveLength(BUSES_PER_PAGE);
        }
    });
});

describe('naming', () => {
    it('names a bus by its number', () => {
        expect(busName(7)).toBe('Bus 7');
        expect(busName(256)).toBe('Bus 256');
    });

    it('reads a number back off a generated name', () => {
        expect(busNumberFromName('Bus 7')).toBe(7);
        expect(busNumberFromName('  bus 12  ')).toBe(12);
    });

    it('returns null for a renamed aux, which keeps its own name', () => {
        expect(busNumberFromName('Vocal Reverb')).toBeNull();
        expect(busNumberFromName('')).toBeNull();
        expect(busNumberFromName(undefined)).toBeNull();
    });

    it('rejects a number outside the console', () => {
        expect(busNumberFromName('Bus 0')).toBeNull();
        expect(busNumberFromName('Bus 257')).toBeNull();
    });
});
