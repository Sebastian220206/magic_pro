import {
    generateDrummerPattern,
    patternPreview,
    barHasFill,
    DEFAULT_DRUMMER_SETTINGS,
    DRUM,
    PATTERN_COUNT,
    type DrummerSettings,
} from '@/lib/drummerPattern';

/**
 * The Session Player's knobs had nothing behind them: `drummer` was a track
 * type, the scheduler treated it as a plain instrument, and the only drummer
 * regions in the app had their notes typed out by hand in the templates.
 * These tests are what stops each control being decorative.
 */
const settings = (over: Partial<DrummerSettings> = {}): DrummerSettings =>
    ({ ...DEFAULT_DRUMMER_SETTINGS, ...over });

const gen = (over: Partial<DrummerSettings> = {}, bars = 2) =>
    generateDrummerPattern(settings(over), { bars });

const pitches = (notes: { pitch: number }[]) => new Set(notes.map(n => n.pitch));

describe('it produces a playable bar', () => {
    it('returns notes at General MIDI drum pitches', () => {
        const notes = gen();
        expect(notes.length).toBeGreaterThan(0);
        for (const n of notes) {
            expect(n.pitch).toBeGreaterThanOrEqual(35);
            expect(n.pitch).toBeLessThanOrEqual(81);
            expect(n.velocity).toBeGreaterThan(0);
            expect(n.velocity).toBeLessThanOrEqual(1);
            expect(n.duration).toBeGreaterThan(0);
            expect(Number.isFinite(n.start)).toBe(true);
        }
    });

    it('sorts them in time', () => {
        const starts = gen({}, 4).map(n => n.start);
        expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    });

    it('keeps every note inside the region', () => {
        const bars = 3;
        const notes = generateDrummerPattern(settings({ fillAmount: 0 }), { bars });
        for (const n of notes) {
            expect(n.start).toBeGreaterThanOrEqual(0);
            expect(n.start).toBeLessThan(bars * 4);
        }
    });

    it('gives nothing for a region with no bars', () => {
        expect(generateDrummerPattern(settings(), { bars: 0 })).toEqual([]);
    });

    /** A knob that reshuffles the whole bar on every render is unusable. */
    it('is deterministic — the same settings give the same take', () => {
        expect(gen({ seed: 7 })).toEqual(gen({ seed: 7 }));
    });

    it('and a different seed gives a different one', () => {
        expect(gen({ seed: 1, humanize: 0.8 }))
            .not.toEqual(gen({ seed: 2, humanize: 0.8 }));
    });
});

/**
 * Complexity is encoded as a threshold per step rather than a probability, so
 * turning it up can only add notes — never move or remove the ones already
 * playing. That is what makes the control feel like a drummer playing more
 * rather than a different drummer.
 */
describe('complexity only ever adds', () => {
    it('plays more notes the further it is turned up', () => {
        const counts = [0, 0.25, 0.5, 0.75, 1]
            .map(complexity => gen({ complexity, humanize: 0, ghostNotes: 0, fillAmount: 0 }).length);
        for (let i = 1; i < counts.length; i++) {
            expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
        }
        expect(counts.at(-1)).toBeGreaterThan(counts[0]);
    });

    it('never moves a note that was already playing', () => {
        const key = (n: { pitch: number; start: number }) => `${n.pitch}@${n.start.toFixed(4)}`;
        const sparse = gen({ complexity: 0.2, humanize: 0, ghostNotes: 0, fillAmount: 0 }).map(key);
        const dense = new Set(gen({ complexity: 0.9, humanize: 0, ghostNotes: 0, fillAmount: 0 }).map(key));
        for (const k of sparse) expect(dense.has(k)).toBe(true);
    });

    it('still plays the skeleton at zero', () => {
        const notes = gen({ complexity: 0, fillAmount: 0, ghostNotes: 0 });
        expect(pitches(notes).has(DRUM.kick)).toBe(true);
        expect(pitches(notes).has(DRUM.snare)).toBe(true);
    });
});

describe('intensity and dynamics shape the velocities', () => {
    it('hits harder as intensity comes up', () => {
        const avg = (v: number) => {
            const notes = gen({ intensity: v, humanize: 0 });
            return notes.reduce((s, n) => s + n.velocity, 0) / notes.length;
        };
        expect(avg(0.9)).toBeGreaterThan(avg(0.2));
    });

    it('flattens every hit to the same weight at dynamics zero', () => {
        const notes = gen({ dynamics: 0, humanize: 0, ghostNotes: 0, fillAmount: 0 });
        const first = notes[0].velocity;
        for (const n of notes) expect(n.velocity).toBeCloseTo(first, 6);
    });

    it('and spreads them out as dynamics comes up', () => {
        const notes = gen({ dynamics: 1, humanize: 0, ghostNotes: 0, fillAmount: 0 });
        const vs = notes.map(n => n.velocity);
        expect(Math.max(...vs) - Math.min(...vs)).toBeGreaterThan(0.1);
    });
});

describe('swing and feel move the notes in time', () => {
    it('leaves everything on the grid at zero swing', () => {
        const notes = gen({ swing: 0, humanize: 0, feel: 0, ghostNotes: 0, fillAmount: 0 });
        for (const n of notes) {
            expect(Math.abs(n.start * 4 - Math.round(n.start * 4))).toBeLessThan(1e-6);
        }
    });

    it('pushes the off-beats late as swing comes up', () => {
        const straight = gen({ swing: 0, humanize: 0, ghostNotes: 0, fillAmount: 0 });
        const swung = gen({ swing: 0.8, humanize: 0, ghostNotes: 0, fillAmount: 0 });
        const moved = swung.filter((n, i) => Math.abs(n.start - straight[i].start) > 1e-6);
        expect(moved.length).toBeGreaterThan(0);
        // Later, never earlier — swing delays, it does not rush.
        for (let i = 0; i < swung.length; i++) {
            expect(swung[i].start).toBeGreaterThanOrEqual(straight[i].start - 1e-9);
        }
    });

    it('leaves the downbeats alone', () => {
        const swung = gen({ swing: 1, humanize: 0, ghostNotes: 0, fillAmount: 0 });
        const downbeat = swung.find(n => n.pitch === DRUM.kick);
        expect(downbeat?.start).toBeCloseTo(0, 6);
    });

    it('pulls behind the beat and pushes ahead of it', () => {
        const opts = { humanize: 0, swing: 0, ghostNotes: 0, fillAmount: 0 };
        const behind = gen({ ...opts, feel: -1 });
        const ahead = gen({ ...opts, feel: 1 });
        const straight = gen({ ...opts, feel: 0 });

        // Not the first hit: a note cannot start before the region, so the
        // downbeat is clamped at zero and pulling cannot move it.
        const i = straight.findIndex(n => n.start > 0.5);
        expect(i).toBeGreaterThan(-1);
        expect(behind[i].start).toBeLessThan(straight[i].start);
        expect(ahead[i].start).toBeGreaterThan(straight[i].start);
    });

    it('never pulls a note out of the front of the region', () => {
        const notes = gen({ feel: -1, humanize: 1, swing: 0 });
        for (const n of notes) expect(n.start).toBeGreaterThanOrEqual(0);
    });
});

describe('the pieces decide what is on the kit', () => {
    it('drops a piece entirely when it is switched off', () => {
        const noKick = gen({ pieces: { ...DEFAULT_DRUMMER_SETTINGS.pieces, kick: false } });
        expect(pitches(noKick).has(DRUM.kick)).toBe(false);

        const noSnare = gen({
            pieces: { ...DEFAULT_DRUMMER_SETTINGS.pieces, snare: false },
            fillAmount: 0,
        });
        expect(pitches(noSnare).has(DRUM.snare)).toBe(false);
    });

    /** A drummer plays the ride or the hat, never both at once. */
    it('swaps the hat for the ride rather than playing both', () => {
        const ride = gen({ pieces: { ...DEFAULT_DRUMMER_SETTINGS.pieces, ride: true } });
        const p = pitches(ride);
        expect(p.has(DRUM.closedHat)).toBe(false);
        expect(p.has(DRUM.ride) || p.has(DRUM.rideBell)).toBe(true);
    });

    it('adds percussion only when it is both enabled and chosen', () => {
        const on = gen({
            pieces: { ...DEFAULT_DRUMMER_SETTINGS.pieces, percussion: true },
            percussion: 'tambourine',
        });
        expect(pitches(on).has(DRUM.tambourine)).toBe(true);

        const off = gen({
            pieces: { ...DEFAULT_DRUMMER_SETTINGS.pieces, percussion: true },
            percussion: 'off',
        });
        expect(pitches(off).has(DRUM.tambourine)).toBe(false);
    });

    it('uses the side stick when the snare is set to rim', () => {
        const rim = gen({ snare: 'rim', fillAmount: 0 });
        expect(pitches(rim).has(DRUM.sideStick)).toBe(true);
        expect(pitches(rim).has(DRUM.snare)).toBe(false);
    });

    it('opens the hat only where the mode asks it to', () => {
        expect(pitches(gen({ hiHat: 'closed' })).has(DRUM.openHat)).toBe(false);
        expect(pitches(gen({ hiHat: 'open', complexity: 1 })).has(DRUM.openHat)).toBe(true);
    });
});

describe('ghost notes', () => {
    it('adds quiet snare hits between the backbeats', () => {
        const without = gen({ ghostNotes: 0, humanize: 0, fillAmount: 0 });
        const with_ = gen({ ghostNotes: 1, humanize: 0, fillAmount: 0 });
        expect(with_.length).toBeGreaterThan(without.length);
    });

    it('and they are quieter than the backbeat they sit between', () => {
        const notes = gen({ ghostNotes: 1, humanize: 0, dynamics: 0.5, fillAmount: 0 });
        const snares = notes.filter(n => n.pitch === DRUM.snare);
        const loudest = Math.max(...snares.map(n => n.velocity));
        const quietest = Math.min(...snares.map(n => n.velocity));
        expect(quietest).toBeLessThan(loudest * 0.7);
    });
});

describe('fills land at the end of phrases', () => {
    it('never fills when the amount is zero', () => {
        for (let bar = 0; bar < 8; bar++) {
            expect(barHasFill(bar, settings({ fillAmount: 0 }), 8)).toBe(false);
        }
    });

    it('fills more often as the amount comes up', () => {
        const count = (fillAmount: number) =>
            Array.from({ length: 8 }, (_, bar) => barHasFill(bar, settings({ fillAmount }), 8))
                .filter(Boolean).length;
        expect(count(1)).toBeGreaterThan(count(0.5));
        expect(count(0.5)).toBeGreaterThan(count(0.2));
    });

    /** There is nothing to land on after the final bar. */
    it('never fills the last bar of the region', () => {
        expect(barHasFill(7, settings({ fillAmount: 1 }), 8)).toBe(false);
    });

    it('makes the fill busier as its complexity comes up', () => {
        const toms = (fillComplexity: number) =>
            generateDrummerPattern(settings({ fillAmount: 1, fillComplexity }), { bars: 2 })
                .filter(n => [DRUM.highTom, DRUM.midTom, DRUM.lowTom].includes(n.pitch as never)).length;
        expect(toms(1)).toBeGreaterThan(toms(0));
    });

    it('lands the fill on a crash', () => {
        const notes = generateDrummerPattern(settings({ fillAmount: 1 }), { bars: 2 });
        expect(pitches(notes).has(DRUM.crash)).toBe(true);
    });
});

describe('the variation rows the popover draws', () => {
    it('offers eight patterns', () => {
        expect(PATTERN_COUNT).toBe(8);
    });

    it('gives a sixteen-step outline for each', () => {
        for (let v = 1; v <= PATTERN_COUNT; v++) {
            expect(patternPreview(v, 0.5)).toHaveLength(16);
        }
    });

    it('shows more steps as complexity comes up', () => {
        const at = (c: number) => patternPreview(4, c).filter(Boolean).length;
        expect(at(1)).toBeGreaterThanOrEqual(at(0));
        expect(at(1)).toBeGreaterThan(at(0));
    });

    it('and the patterns genuinely differ from each other', () => {
        const shapes = new Set(
            Array.from({ length: PATTERN_COUNT }, (_, i) => patternPreview(i + 1, 1).join('')),
        );
        expect(shapes.size).toBeGreaterThan(5);
    });

    it('clamps a variation outside the range rather than throwing', () => {
        expect(() => patternPreview(0, 0.5)).not.toThrow();
        expect(() => patternPreview(99, 0.5)).not.toThrow();
        expect(gen({ variation: 99 }).length).toBeGreaterThan(0);
    });
});

describe('it survives nonsense settings', () => {
    it('does not emit NaN for broken numbers', () => {
        const notes = gen({
            complexity: NaN, intensity: NaN, swing: NaN,
            ghostNotes: NaN, dynamics: NaN, humanize: NaN, feel: NaN,
        });
        for (const n of notes) {
            expect(Number.isFinite(n.start)).toBe(true);
            expect(Number.isFinite(n.velocity)).toBe(true);
        }
    });

    it('handles a time signature other than four four', () => {
        const notes = generateDrummerPattern(settings({ fillAmount: 0 }), { bars: 2, beatsPerBar: 3 });
        expect(notes.length).toBeGreaterThan(0);
        for (const n of notes) expect(n.start).toBeLessThan(6);
    });
});
