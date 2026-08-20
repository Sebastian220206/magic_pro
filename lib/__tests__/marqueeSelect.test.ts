/**
 * Rubber-band selection in the piano roll.
 *
 * The feature was written but could never work: the mousemove and mouseup
 * handlers were added to `window` at mousedown, capturing a closure in which
 * `lassoSelection` was still null, so both bailed on their first line. The
 * band never drew, nothing was ever selected, and mouseup returned before
 * removing its own listeners, leaking a pair per attempt.
 *
 * These cover the rule the fixed version applies. The stale-closure part is
 * structural and is verified in a browser instead.
 */

import {
    marqueeBox,
    notesInMarquee,
    isMarqueeDrag,
    MARQUEE_MIN_DRAG_PX,
    type MarqueeNote,
} from '../marqueeSelect';

const note = (id: string, pitch: number, startBeat: number, duration: number): MarqueeNote =>
    ({ id, pitch, startBeat, duration });

const chord: MarqueeNote[] = [
    note('c', 60, 0, 1),
    note('e', 64, 0, 1),
    note('g', 67, 0, 1),
    note('held', 55, 0, 16),   // one long note running under everything
    note('late', 72, 8, 1),
];

const ids = (ns: MarqueeNote[]) => ns.map(n => n.id).sort();

describe('normalising the drag', () => {
    it('gives the same box whichever corner it started from', () => {
        const a = marqueeBox({ beat: 4, pitch: 70 }, { beat: 1, pitch: 50 });
        const b = marqueeBox({ beat: 1, pitch: 50 }, { beat: 4, pitch: 70 });
        expect(a).toEqual(b);
        expect(a).toEqual({ startBeat: 1, endBeat: 4, lowPitch: 50, highPitch: 70 });
    });
});

describe('what the band catches', () => {
    it('selects notes inside it', () => {
        const box = marqueeBox({ beat: 0, pitch: 58 }, { beat: 2, pitch: 70 });
        expect(ids(notesInMarquee(chord, box))).toEqual(['c', 'e', 'g']);
    });

    it('catches a long note it merely crosses', () => {
        // The band sits in the middle of the held note, nowhere near its start.
        const box = marqueeBox({ beat: 6, pitch: 54 }, { beat: 7, pitch: 56 });
        // Selecting only notes that *begin* inside the band made this
        // impossible: you could drag across the note all day and never
        // touch its beginning.
        expect(ids(notesInMarquee(chord, box))).toEqual(['held']);
    });

    it('ignores notes outside the pitch range', () => {
        const box = marqueeBox({ beat: 0, pitch: 60 }, { beat: 2, pitch: 62 });
        expect(ids(notesInMarquee(chord, box))).toEqual(['c']);
    });

    it('ignores notes outside the beat range', () => {
        const box = marqueeBox({ beat: 20, pitch: 0 }, { beat: 24, pitch: 127 });
        expect(notesInMarquee(chord, box)).toEqual([]);
    });

    it('does not drag in a note that merely touches the far edge', () => {
        // Band ends exactly where 'late' begins.
        const box = marqueeBox({ beat: 6, pitch: 70 }, { beat: 8, pitch: 74 });
        expect(notesInMarquee(chord, box)).toEqual([]);
        // A hair further and it is caught.
        const wider = marqueeBox({ beat: 6, pitch: 70 }, { beat: 8.01, pitch: 74 });
        expect(ids(notesInMarquee(chord, wider))).toEqual(['late']);
    });

    it('a zero-width band down a column catches that column', () => {
        // Dragging straight down over a chord: the band has no width at all,
        // and every note sounding at that instant is still caught, because
        // overlap is measured against the note's whole length.
        const box = marqueeBox({ beat: 0.5, pitch: 58 }, { beat: 0.5, pitch: 70 });
        expect(ids(notesInMarquee(chord, box))).toEqual(['c', 'e', 'g']);
    });

    it('handles an empty clip', () => {
        expect(notesInMarquee([], marqueeBox({ beat: 0, pitch: 0 }, { beat: 8, pitch: 127 }))).toEqual([]);
    });
});

describe('telling a drag from a click', () => {
    it('treats a small wobble as a click', () => {
        expect(isMarqueeDrag(0, 0)).toBe(false);
        expect(isMarqueeDrag(2, 2)).toBe(false);
    });

    it('counts vertical movement, not just horizontal', () => {
        // A drag straight down is how you grab a chord. Measuring width alone
        // read it as a click and cleared the selection instead of making one.
        expect(isMarqueeDrag(0, 40)).toBe(true);
        expect(isMarqueeDrag(40, 0)).toBe(true);
    });

    it('is direction-agnostic', () => {
        expect(isMarqueeDrag(-40, 0)).toBe(true);
        expect(isMarqueeDrag(0, -40)).toBe(true);
    });

    it('triggers exactly at the threshold', () => {
        expect(isMarqueeDrag(MARQUEE_MIN_DRAG_PX, 0)).toBe(true);
        expect(isMarqueeDrag(MARQUEE_MIN_DRAG_PX - 1, 0)).toBe(false);
    });
});
