import {
    generateDrummerPattern,
    patternPreview,
    barHasFill,
    resolveTempoMode,
    onsetsToSteps,
    emptyManualPattern,
    DRUMMER_NATIVE_TEMPO,
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


/* ────────────────────────────────────────────────────────────────────────────
 * The rest of what the Session Player Editor offers.
 *
 * Everything below was a control the manual describes and this generator had
 * no answer for, so the panel could not have offered it without the knob being
 * decorative.
 * ────────────────────────────────────────────────────────────────────────── */

describe('tempo mode', () => {
    it('takes an explicit choice literally', () => {
        expect(resolveTempoMode('half-time', 60)).toBe('half-time');
        expect(resolveTempoMode('double-time', 200)).toBe('double-time');
        expect(resolveTempoMode('standard', 200)).toBe('standard');
    });

    it('drops to half-time when the project runs far above the style tempo', () => {
        expect(resolveTempoMode('automatic', DRUMMER_NATIVE_TEMPO * 2)).toBe('half-time');
    });

    it('doubles up when it runs far below', () => {
        expect(resolveTempoMode('automatic', 60)).toBe('double-time');
    });

    it('leaves it alone at the tempo the patterns are written for', () => {
        expect(resolveTempoMode('automatic', DRUMMER_NATIVE_TEMPO)).toBe('standard');
    });

    it('survives a nonsense tempo rather than dividing by it', () => {
        expect(resolveTempoMode('automatic', 0)).toBe('standard');
        expect(resolveTempoMode('automatic', NaN)).toBe('standard');
    });

    it('half-time spreads the same bar over twice the ground', () => {
        const straight = generateDrummerPattern(settings({ tempoMode: 'standard' }), { bars: 4 });
        const half = generateDrummerPattern(settings({ tempoMode: 'half-time' }), { bars: 4 });
        expect(half.length).toBeLessThan(straight.length);
        // Falsify by ignoring tempoMode: the two become identical.
        expect(half.length).toBeGreaterThan(0);
    });

    it('double-time fits twice as much into the same region', () => {
        const straight = generateDrummerPattern(settings({ tempoMode: 'standard' }), { bars: 4 });
        const double = generateDrummerPattern(settings({ tempoMode: 'double-time' }), { bars: 4 });
        expect(double.length).toBeGreaterThan(straight.length);
    });

    it('never writes a note past the end of the region', () => {
        for (const mode of ['standard', 'half-time', 'double-time'] as const) {
            const notes = generateDrummerPattern(settings({ tempoMode: mode }), { bars: 3 });
            for (const n of notes) expect(n.start).toBeLessThan(12);
        }
    });
});

describe('the cymbal row has its own pattern', () => {
    /*
     * One `variation` for the whole kit made the second row of the panel a copy
     * of the first, and the manual is explicit that the Drummer has several
     * Patterns buttons for the various kit pieces.
     */
    const hats = (over: Partial<DrummerSettings>) =>
        generateDrummerPattern(settings(over), { bars: 1 })
            .filter(n => n.pitch === DRUM.closedHat || n.pitch === DRUM.openHat)
            .map(n => Math.round(n.start * 1000));
    const kicks = (over: Partial<DrummerSettings>) =>
        generateDrummerPattern(settings(over), { bars: 1 })
            .filter(n => n.pitch === DRUM.kick)
            .map(n => Math.round(n.start * 1000));

    it('changing the cymbal pattern changes the hats', () => {
        expect(hats({ cymbalVariation: 1 })).not.toEqual(hats({ cymbalVariation: 8 }));
    });

    it('and leaves the kick where it was', () => {
        expect(kicks({ cymbalVariation: 1 })).toEqual(kicks({ cymbalVariation: 8 }));
    });

    it('changing the kick pattern leaves the hats where they were', () => {
        expect(hats({ variation: 1, cymbalVariation: 4 }))
            .toEqual(hats({ variation: 8, cymbalVariation: 4 }));
    });
});

describe('phrase variation', () => {
    const barOf = (notes: ReturnType<typeof generateDrummerPattern>, bar: number) =>
        notes.filter(n => n.start >= bar * 4 && n.start < (bar + 1) * 4)
            .map(n => `${n.pitch}@${Math.round((n.start - bar * 4) * 100)}`);

    it('at zero, every bar plays the same', () => {
        const notes = generateDrummerPattern(
            settings({ phraseVariation: 0, humanize: 0, fillAmount: 0, ghostNotes: 0 }), { bars: 4 });
        expect(barOf(notes, 1)).toEqual(barOf(notes, 2));
    });

    it('turned up, the bars stop being identical', () => {
        const notes = generateDrummerPattern(
            settings({ phraseVariation: 1, humanize: 0, fillAmount: 0, ghostNotes: 0, complexity: 0.5 }),
            { bars: 8 });
        const bars = [0, 1, 2, 3, 4, 5, 6, 7].map(b => barOf(notes, b).join('|'));
        expect(new Set(bars).size).toBeGreaterThan(1);
    });

    it('is deterministic — the same seed gives the same variation', () => {
        const a = generateDrummerPattern(settings({ phraseVariation: 1 }), { bars: 4 });
        const b = generateDrummerPattern(settings({ phraseVariation: 1 }), { bars: 4 });
        expect(a).toEqual(b);
    });
});

describe('a hand-typed pattern', () => {
    const manual = () => {
        const m = emptyManualPattern(16);
        m.rows.kick![0] = true;
        m.rows.kick![8] = true;
        m.rows.snare![4] = true;
        return m;
    };

    it('plays only the steps that were typed in', () => {
        const notes = generateDrummerPattern(
            settings({ manual: manual(), humanize: 0, swing: 0 }), { bars: 1 });
        const kicks = notes.filter(n => n.pitch === DRUM.kick).map(n => n.start);
        expect(kicks).toEqual([0, 2]);
    });

    it('ignores the generated pattern entirely', () => {
        const withManual = generateDrummerPattern(
            settings({ manual: manual(), variation: 8, complexity: 1, humanize: 0 }), { bars: 1 });
        // Variation 8 is the densest of the eight; three typed steps is not it.
        expect(withManual.length).toBe(3);
    });

    it('a muted row is silent without being cleared', () => {
        const m = manual();
        m.muted.kick = true;
        const notes = generateDrummerPattern(settings({ manual: m, humanize: 0 }), { bars: 1 });
        expect(notes.some(n => n.pitch === DRUM.kick)).toBe(false);
        expect(m.rows.kick![0]).toBe(true);
    });

    it('a piece switched off in the kit stays off in Manual view', () => {
        const notes = generateDrummerPattern(settings({
            manual: manual(), humanize: 0,
            pieces: { ...DEFAULT_DRUMMER_SETTINGS.pieces, kick: false },
        }), { bars: 1 });
        expect(notes.some(n => n.pitch === DRUM.kick)).toBe(false);
    });

    it('repeats across the region, so a one-bar grid fills four bars', () => {
        const one = generateDrummerPattern(settings({ manual: manual(), humanize: 0 }), { bars: 1 });
        const four = generateDrummerPattern(settings({ manual: manual(), humanize: 0 }), { bars: 4 });
        expect(four.length).toBe(one.length * 4);
    });

    it('a two-bar grid is not simply the first bar twice', () => {
        const m = emptyManualPattern(32);
        m.rows.kick![0] = true;
        m.rows.kick![20] = true;
        const notes = generateDrummerPattern(settings({ manual: m, humanize: 0, swing: 0 }), { bars: 2 });
        expect(notes.map(n => n.start)).toEqual([0, 5]);
    });

    it('writes nothing past the end of the region', () => {
        const notes = generateDrummerPattern(settings({ manual: manual() }), { bars: 2 });
        for (const n of notes) expect(n.start).toBeLessThan(8);
    });

    it('an empty grid is silence, not a fallback to the generated pattern', () => {
        const notes = generateDrummerPattern(
            settings({ manual: emptyManualPattern(16) }), { bars: 4 });
        expect(notes).toEqual([]);
    });
});

describe('following the rhythm of another track', () => {
    it('quantises onsets to sixteenths', () => {
        const steps = onsetsToSteps([0, 0.26, 1.0], { beatsPerBar: 4, bars: 1 });
        expect([...steps].sort((a, b) => a - b)).toEqual([0, 1, 4]);
    });

    it('drops anything past the end of the region', () => {
        const steps = onsetsToSteps([0, 99], { beatsPerBar: 4, bars: 1 });
        expect([...steps]).toEqual([0]);
    });

    it('ignores nonsense rather than emitting NaN steps', () => {
        const steps = onsetsToSteps([NaN, -1, Infinity, 0.5], { beatsPerBar: 4, bars: 1 });
        expect([...steps]).toEqual([2]);
    });

    it('puts a kick where the followed track lands and the pattern does not', () => {
        const base = settings({ variation: 1, complexity: 0, humanize: 0, swing: 0, ghostNotes: 0, phraseVariation: 0 });
        const without = generateDrummerPattern(base, { bars: 1 })
            .filter(n => n.pitch === DRUM.kick).map(n => n.start);
        const with_ = generateDrummerPattern(
            { ...base, followTrackId: 'guitar' },
            { bars: 1, followOnsets: [1.5] },
        ).filter(n => n.pitch === DRUM.kick).map(n => n.start);

        expect(without).not.toContain(1.5);
        expect(with_).toContain(1.5);
    });

    it('does nothing unless a track is actually chosen', () => {
        const base = settings({ humanize: 0, phraseVariation: 0 });
        const a = generateDrummerPattern(base, { bars: 1, followOnsets: [1.5, 2.5] });
        const b = generateDrummerPattern(base, { bars: 1 });
        expect(a).toEqual(b);
    });
});

describe('kit piece choices reach the notes', () => {
    const fillPitches = (over: Partial<DrummerSettings>) =>
        new Set(generateDrummerPattern(
            settings({ fillAmount: 1, fillComplexity: 1, ...over }), { bars: 2 })
            .map(n => n.pitch));

    it('the Cymbals choice decides what a fill lands on', () => {
        expect(fillPitches({ cymbals: 'crash' }).has(DRUM.crash)).toBe(true);
        expect(fillPitches({ cymbals: 'china' }).has(DRUM.china)).toBe(true);
        expect(fillPitches({ cymbals: 'china' }).has(DRUM.crash)).toBe(false);
    });

    it('the Toms choice decides which toms the fill runs across', () => {
        const high = fillPitches({ toms: 'high' });
        const low = fillPitches({ toms: 'low' });
        expect(high.has(DRUM.highTom)).toBe(true);
        expect(low.has(DRUM.highTom)).toBe(false);
        expect(low.has(DRUM.lowTom)).toBe(true);
    });
});
