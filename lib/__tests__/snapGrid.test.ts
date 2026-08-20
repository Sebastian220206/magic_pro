/**
 * The Snap menu is only worth having if the grid it names is the grid the
 * editor uses. These pin the arithmetic behind each row of that menu.
 *
 * Before this existed the piano roll had a read-only "Snap: On" label, one
 * fixed division, and `snapBeatToGrid` floored the position — so every note
 * nudged drifted earlier rather than landing on the nearest line.
 */

import {
    divisionBeats,
    divisionLabel,
    snapGridBeats,
    snapBeat,
    snapDelta,
    applySnappedMove,
    snapModeLabel,
    SNAP_DIVISIONS,
    SNAP_TRIPLETS,
    TICK_BEATS,
    type SnapSettings,
} from '../snapGrid';

const base: SnapSettings = {
    mode: 'division', division: 16, triplet: false, beatsPerBar: 4, pixelsPerBeat: 80,
};
const at = (over: Partial<SnapSettings>): SnapSettings => ({ ...base, ...over });

describe('note values', () => {
    it.each([
        [1, 4], [2, 2], [4, 1], [8, 0.5], [16, 0.25], [32, 0.125], [64, 0.0625],
    ])('1/%i is %f beats', (division, beats) => {
        expect(divisionBeats(division)).toBeCloseTo(beats, 6);
    });

    it('a triplet fits three in the space of two', () => {
        // Three 1/8 triplets occupy one quarter note, i.e. one beat.
        expect(divisionBeats(8, true) * 3).toBeCloseTo(1, 6);
        expect(divisionBeats(4, true) * 3).toBeCloseTo(2, 6);
    });

    it('labels match the menu', () => {
        expect(divisionLabel(16)).toBe('1/16');
        expect(divisionLabel(8, true)).toBe('1/8 T');
    });

    it('refuses to divide by zero', () => {
        expect(divisionBeats(0)).toBe(1);
        expect(divisionBeats(-4)).toBe(1);
        expect(divisionBeats(NaN)).toBe(1);
    });
});

describe('grid size per mode', () => {
    it('bar follows the time signature', () => {
        expect(snapGridBeats(at({ mode: 'bar' }))).toBe(4);
        expect(snapGridBeats(at({ mode: 'bar', beatsPerBar: 3 }))).toBe(3);
        // A malformed signature falls back to 4/4 rather than collapsing the
        // grid, which would make every snap a no-op.
        expect(snapGridBeats(at({ mode: 'bar', beatsPerBar: 0 }))).toBe(4);
        expect(snapGridBeats(at({ mode: 'bar', beatsPerBar: NaN }))).toBe(4);
    });

    it('beat is one beat, ticks are the storage resolution', () => {
        expect(snapGridBeats(at({ mode: 'beat' }))).toBe(1);
        expect(snapGridBeats(at({ mode: 'ticks' }))).toBeCloseTo(TICK_BEATS, 10);
    });

    it('frames fall back to ticks rather than inventing a rate', () => {
        // The project carries no video frame rate, which is why the menu shows
        // this row disabled. Snapping to a guessed rate would be worse.
        expect(snapGridBeats(at({ mode: 'frames' }))).toBeCloseTo(TICK_BEATS, 10);
    });

    it('division uses the chosen value', () => {
        expect(snapGridBeats(at({ division: 4 }))).toBe(1);
        expect(snapGridBeats(at({ division: 8, triplet: true }))).toBeCloseTo(1 / 3, 6);
    });
});

describe('smart mode', () => {
    it('coarsens as the view zooms out', () => {
        const wide = snapGridBeats(at({ mode: 'smart', pixelsPerBeat: 8 }));
        const tight = snapGridBeats(at({ mode: 'smart', pixelsPerBeat: 400 }));
        expect(wide).toBeGreaterThan(tight);
    });

    it('never returns a grid too fine to hit with a mouse', () => {
        for (const ppb of [4, 20, 80, 200, 1000]) {
            const grid = snapGridBeats(at({ mode: 'smart', pixelsPerBeat: ppb }));
            expect(grid).toBeGreaterThan(0);
            // Either it clears the readability threshold, or the view is so
            // far out that even the coarsest value cannot — and there is
            // nothing coarser to fall back to.
            const coarsest = divisionBeats(SNAP_DIVISIONS[0]);
            expect(grid * ppb >= 24 || grid === coarsest).toBe(true);
        }
    });

    it('works with no zoom information at all', () => {
        expect(snapGridBeats({ ...base, mode: 'smart', pixelsPerBeat: undefined })).toBeGreaterThan(0);
    });
});

describe('snapping a position', () => {
    it('rounds to the nearest line, not down to the previous one', () => {
        // Flooring made every nudged note drift earlier.
        expect(snapBeat(0.24, at({ division: 4 }))).toBe(0);
        expect(snapBeat(0.76, at({ division: 4 }))).toBe(1);
        expect(snapBeat(1.9, at({ division: 4 }))).toBe(2);
    });

    it('never lands before the start of the timeline', () => {
        expect(snapBeat(-3, at({ mode: 'bar' }))).toBe(0);
    });

    it('leaves a position alone on the tick grid', () => {
        const beat = 1.3333;
        expect(snapBeat(beat, at({ mode: 'ticks' }))).toBeCloseTo(beat, 3);
    });
});

describe('absolute versus relative', () => {
    const settings = at({ mode: 'bar' });

    it('absolute pulls a note onto the gridline', () => {
        // A note played 0.2 late, dragged a little: it lands on the bar.
        expect(applySnappedMove(4.2, 0.3, settings, false)).toBe(4);
    });

    it('relative keeps the feel and moves in whole steps', () => {
        // The same note keeps its 0.2 of lateness and moves exactly one bar.
        expect(applySnappedMove(4.2, 3.6, settings, true)).toBeCloseTo(8.2, 6);
        // A movement smaller than half a step does not move it at all.
        expect(applySnappedMove(4.2, 1, settings, true)).toBeCloseTo(4.2, 6);
    });

    it('relative cannot drag a note before the start', () => {
        expect(applySnappedMove(1, -40, settings, true)).toBe(0);
    });

    it('snapDelta rounds the movement, not the destination', () => {
        expect(snapDelta(2.4, settings)).toBe(4);
        expect(snapDelta(-2.4, settings)).toBe(-4);
        expect(snapDelta(0.5, settings)).toBe(0);
    });
});

describe('what the trigger shows', () => {
    it('names the mode, or the value when the mode is Division', () => {
        expect(snapModeLabel(at({ mode: 'smart' }))).toBe('Smart');
        expect(snapModeLabel(at({ mode: 'bar' }))).toBe('Bar');
        expect(snapModeLabel(at({ mode: 'ticks' }))).toBe('Ticks');
        expect(snapModeLabel(at({ mode: 'division', division: 16 }))).toBe('1/16');
        expect(snapModeLabel(at({ mode: 'division', division: 8, triplet: true }))).toBe('1/8 T');
    });

    it('has a label for every row the menu offers', () => {
        for (const d of SNAP_DIVISIONS) expect(divisionLabel(d)).toMatch(/^1\/\d+$/);
        for (const d of SNAP_TRIPLETS) expect(divisionLabel(d, true)).toMatch(/^1\/\d+ T$/);
    });
});
