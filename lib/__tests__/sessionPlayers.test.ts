/**
 * The Bass Player and the Keyboard Player.
 *
 * Both are a shared rhythm plus a rule for choosing notes from the chord under
 * it, so these tests are mostly about the second half: does the part actually
 * follow the harmony, and does each control change the notes in the direction
 * its label claims?
 *
 * Every test names the mistake it forbids.
 */
import {
    generateBassLine, DEFAULT_BASS_SETTINGS, BASS_LOW_E, BASS_LOW_B, BASS_HIGH,
    type BassSettings,
} from '@/lib/bassPlayer';
import {
    generateKeyboardPart, DEFAULT_KEYBOARD_SETTINGS, KEYS_LOW, KEYS_HIGH,
    type KeyboardSettings,
} from '@/lib/keyboardPlayer';
import { resolveTempoMode, rhythmPreview, RHYTHM_PATTERN_COUNT } from '@/lib/sessionRhythm';
import { parseChord, type Chord } from '@/lib/chords';

const bass = (over: Partial<BassSettings> = {}): BassSettings =>
    ({ ...DEFAULT_BASS_SETTINGS, ...over });
const keys = (over: Partial<KeyboardSettings> = {}): KeyboardSettings =>
    ({ ...DEFAULT_KEYBOARD_SETTINGS, ...over });

const ctx = { bars: 4, beatsPerBar: 4, keySignature: 'C major' };

/** C – G – Am – F, one per bar. */
const PROGRESSION: Chord[] = ['C', 'G', 'Am', 'F'].map((sym, i) => ({
    id: `c${i}`, start: i * 4, duration: 4, ...parseChord(sym)!,
}));

const pcOf = (pitch: number) => ((pitch % 12) + 12) % 12;

/*
 * Which chord a note belongs to.
 *
 * The generators pick the harmony from where a note is *written* and then let
 * Humanize move it a few milliseconds; binning by where it is played puts a
 * note that rushed a downbeat into the previous bar and reads a correct part
 * as a wrong one. The tolerance is the width of that wander.
 */
const chordOf = (start: number) => PROGRESSION[Math.min(3, Math.floor((start + 0.1) / 4))];

describe('the Bass Player follows the harmony', () => {
    /*
     * The whole point of the player. A line that ignores the chords is a line
     * that plays one shape transposed nowhere, and it is the single easiest
     * thing to get wrong while every control still appears to work.
     */
    it('lands on each chord\'s own root when the chord changes', () => {
        const notes = generateBassLine(bass(), { ...ctx, regionChords: PROGRESSION });
        for (const chord of PROGRESSION) {
            const onChange = notes.find(n => Math.abs(n.start - chord.start) < 0.16);
            expect(onChange).toBeDefined();
            expect(pcOf(onChange!.pitch)).toBe(chord.root);
        }
    });

    it('plays the key tonic when the region has no chords at all', () => {
        const notes = generateBassLine(bass(), { ...ctx, keySignature: 'A minor' });
        expect(notes.length).toBeGreaterThan(0);
        expect(pcOf(notes[0].pitch)).toBe(9);
    });

    it('uses only chord tones on Root Only', () => {
        const notes = generateBassLine(bass({ melody: 'root-only' }), { ...ctx, regionChords: PROGRESSION });
        for (const n of notes) {
            expect(pcOf(n.pitch)).toBe(chordOf(n.start).root);
        }
    });

    it('reaches beyond the root once other chord tones are allowed', () => {
        const rootOnly = generateBassLine(bass({ melody: 'root-only', complexity: 1 }),
            { ...ctx, regionChords: PROGRESSION });
        const chordTones = generateBassLine(bass({ melody: 'chord-tones', complexity: 1 }),
            { ...ctx, regionChords: PROGRESSION });
        expect(new Set(chordTones.map(n => pcOf(n.pitch))).size)
            .toBeGreaterThan(new Set(rootOnly.map(n => pcOf(n.pitch))).size);
    });
});

describe('the Bass Player stays on the instrument', () => {
    it('never plays below the lowest note it is given', () => {
        for (const lowest of [BASS_LOW_E, BASS_LOW_B, 40]) {
            const notes = generateBassLine(
                bass({ lowestNote: lowest, complexity: 1, octaves: 'more', melody: 'passing' }),
                { ...ctx, regionChords: PROGRESSION });
            expect(notes.length).toBeGreaterThan(0);
            for (const n of notes) expect(n.pitch).toBeGreaterThanOrEqual(lowest);
        }
    });

    it('never plays above the top of its range', () => {
        const notes = generateBassLine(bass({ octaves: 'more', complexity: 1 }),
            { ...ctx, regionChords: PROGRESSION });
        for (const n of notes) expect(n.pitch).toBeLessThanOrEqual(BASS_HIGH);
    });

    /*
     * Without Align Root, a progression rising by a fourth each bar walks the
     * line up the neck until it leaves the range. This is the test that forbids
     * that regression once the option is on.
     */
    it('with Align Root on, does not climb across a long progression', () => {
        const rising: Chord[] = Array.from({ length: 8 }, (_, i) => ({
            id: `r${i}`, start: i * 4, duration: 4, root: (i * 5) % 12, quality: 'maj' as const, bass: null,
        }));
        const notes = generateBassLine(bass({ alignRoot: true }),
            { bars: 8, beatsPerBar: 4, regionChords: rising });
        const first = notes.slice(0, 4).reduce((a, n) => a + n.pitch, 0) / 4;
        const last = notes.slice(-4).reduce((a, n) => a + n.pitch, 0) / 4;
        expect(Math.abs(last - first)).toBeLessThan(12);
    });
});

describe('the Bass Player\'s own controls', () => {
    it('Dead Notes adds quiet, very short notes', () => {
        const plain = generateBassLine(bass({ deadNotes: 0 }), { ...ctx, regionChords: PROGRESSION });
        const dead = generateBassLine(bass({ deadNotes: 1 }), { ...ctx, regionChords: PROGRESSION });
        expect(dead.length).toBeGreaterThan(plain.length);
        const added = dead.length - plain.length;
        expect(dead.filter(n => n.duration <= 0.07).length).toBeGreaterThanOrEqual(added);
    });

    it('Slides puts a short note a step below, just before the target', () => {
        const plain = generateBassLine(bass({ slides: 0 }), { ...ctx, regionChords: PROGRESSION });
        const slid = generateBassLine(bass({ slides: 1 }), { ...ctx, regionChords: PROGRESSION });
        expect(slid.length).toBeGreaterThan(plain.length);
        // Every added note is immediately followed by one a semitone or two up.
        const leadIns = slid.filter(n =>
            slid.some(m => m.start > n.start && m.start - n.start < 0.16 && m.pitch - n.pitch >= 1 && m.pitch - n.pitch <= 2));
        expect(leadIns.length).toBeGreaterThan(0);
    });

    it('Pickup Hits adds quiet notes on the second and fourth beats', () => {
        const plain = generateBassLine(bass({ pickupHits: false }), { ...ctx, regionChords: PROGRESSION });
        const hits = generateBassLine(bass({ pickupHits: true }), { ...ctx, regionChords: PROGRESSION });
        expect(hits.length).toBeGreaterThan(plain.length);
        const onTwoOrFour = hits.filter(n => Math.abs(n.start % 4 - 1) < 0.2 || Math.abs(n.start % 4 - 3) < 0.2);
        expect(onTwoOrFour.length).toBeGreaterThan(0);
    });

    it('Mute Offset shortens the notes rather than doing nothing', () => {
        const open = generateBassLine(bass({ muteOffset: 0 }), { ...ctx, regionChords: PROGRESSION });
        const muted = generateBassLine(bass({ muteOffset: 1 }), { ...ctx, regionChords: PROGRESSION });
        const mean = (ns: typeof open) => ns.reduce((a, n) => a + n.duration, 0) / ns.length;
        expect(mean(muted)).toBeLessThan(mean(open));
    });

    it('Phrasing caps how long a note can be', () => {
        const shortNotes = generateBassLine(bass({ phrasing: 'short' }), { ...ctx, regionChords: PROGRESSION });
        const longNotes = generateBassLine(bass({ phrasing: 'long', variation: 1 }), { ...ctx, regionChords: PROGRESSION });
        expect(Math.max(...shortNotes.map(n => n.duration))).toBeLessThanOrEqual(0.36);
        expect(Math.max(...longNotes.map(n => n.duration))).toBeGreaterThan(0.36);
    });
});

describe('the Keyboard Player', () => {
    it('plays the notes of the chord under it', () => {
        const notes = generateKeyboardPart(keys({ leftHand: false }), { ...ctx, regionChords: PROGRESSION });
        expect(notes.length).toBeGreaterThan(0);
        for (const n of notes) {
            const chord = chordOf(n.start);
            const tones = [chord.root, (chord.root + (chord.quality === 'min' ? 3 : 4)) % 12, (chord.root + 7) % 12];
            // Grace notes are deliberately outside the chord; there are none here.
            expect(tones).toContain(pcOf(n.pitch));
        }
    });

    it('keeps both hands inside the keyboard', () => {
        const notes = generateKeyboardPart(
            keys({ complexity: 1, rightVoicing: 'full-chord', rightMovement: 'wide', leftVoicing: 'root-fifth-octave' }),
            { ...ctx, regionChords: PROGRESSION });
        for (const n of notes) {
            expect(n.pitch).toBeGreaterThanOrEqual(KEYS_LOW);
            expect(n.pitch).toBeLessThanOrEqual(KEYS_HIGH);
        }
    });

    /*
     * The manual is explicit that the hands are not independent: muting the
     * left changes how the right voices. A right hand that keeps playing
     * rootless voicings over silence sounds like a missing track.
     */
    it('the right hand carries more of the chord when the left is muted', () => {
        const both = generateKeyboardPart(keys({ leftHand: true }), { ...ctx, regionChords: PROGRESSION });
        const rightOnly = generateKeyboardPart(keys({ leftHand: false }), { ...ctx, regionChords: PROGRESSION });
        const rightNotesOf = (ns: typeof both) => ns.filter(n => n.pitch >= 55);
        const perHit = (ns: typeof both) => {
            const starts = new Set(ns.map(n => Math.round(n.start * 8)));
            return ns.length / Math.max(1, starts.size);
        };
        expect(perHit(rightNotesOf(rightOnly))).toBeGreaterThan(perHit(rightNotesOf(both)));
    });

    it('muting the right hand leaves only the left', () => {
        const both = generateKeyboardPart(keys(), { ...ctx, regionChords: PROGRESSION });
        const noRight = generateKeyboardPart(keys({ rightHand: false }), { ...ctx, regionChords: PROGRESSION });
        expect(noRight.length).toBeLessThan(both.length);
        expect(noRight.every(n => n.pitch < 60)).toBe(true);
    });

    /*
     * Muting the left hand does not simply subtract notes — the right hand
     * picks up the root, so the count can go *up*. A test asserting "fewer
     * notes" would forbid exactly the behaviour the manual asks for.
     */
    it('muting the left hand leaves the root covered rather than silent', () => {
        const noLeft = generateKeyboardPart(keys({ leftHand: false }), { ...ctx, regionChords: PROGRESSION });
        expect(noLeft.length).toBeGreaterThan(0);
        for (const chord of PROGRESSION) {
            const here = noLeft.filter(n => chordOf(n.start) === chord);
            const lowest = Math.min(...here.map(n => n.pitch));
            expect(pcOf(lowest)).toBe(chord.root);
        }
    });

    it('Left-Hand Voicing changes how many notes the left hand plays', () => {
        const count = (v: KeyboardSettings['leftVoicing']) =>
            generateKeyboardPart(keys({ rightHand: false, leftVoicing: v }), { ...ctx, regionChords: PROGRESSION }).length;
        expect(count('root-only')).toBeLessThan(count('root-fifth'));
        expect(count('root-fifth')).toBeLessThan(count('root-fifth-octave'));
    });

    /*
     * Broken plays the same notes as Root, Fifth & Octave — what makes it a
     * separate option is that they are rhythmically separate. Played together
     * it would be a second name for the same voicing.
     */
    it('Broken spreads the left hand\'s notes in time', () => {
        const together = generateKeyboardPart(keys({ rightHand: false, leftVoicing: 'root-fifth-octave' }),
            { ...ctx, regionChords: PROGRESSION });
        const broken = generateKeyboardPart(keys({ rightHand: false, leftVoicing: 'broken' }),
            { ...ctx, regionChords: PROGRESSION });
        const distinctStarts = (ns: typeof broken) => new Set(ns.map(n => Math.round(n.start * 16))).size;
        expect(distinctStarts(broken)).toBeGreaterThan(distinctStarts(together));
    });

    it('Left-Hand Style changes how often the left hand plays', () => {
        const count = (style: KeyboardSettings['leftStyle']) =>
            generateKeyboardPart(keys({ rightHand: false, leftStyle: style }), { ...ctx, regionChords: PROGRESSION }).length;
        expect(count('sustain-only')).toBeLessThan(count('moderate'));
        expect(count('moderate')).toBeLessThan(count('steady-8ths'));
    });

    it('Grace Notes adds a short note just before the beat', () => {
        const plain = generateKeyboardPart(keys({ graceNotes: 0 }), { ...ctx, regionChords: PROGRESSION });
        const graced = generateKeyboardPart(keys({ graceNotes: 1 }), { ...ctx, regionChords: PROGRESSION });
        expect(graced.length).toBeGreaterThan(plain.length);
        expect(graced.some(n => n.duration <= 0.09)).toBe(true);
    });

    it('Phrasing changes how long the right hand holds', () => {
        const mean = (s: KeyboardSettings['phrasing']) => {
            const ns = generateKeyboardPart(keys({ leftHand: false, phrasing: s }), { ...ctx, regionChords: PROGRESSION });
            return ns.reduce((a, n) => a + n.duration, 0) / ns.length;
        };
        expect(mean('staccato')).toBeLessThan(mean('mixed'));
        expect(mean('mixed')).toBeLessThan(mean('legato'));
    });
});

describe('what all three players share', () => {
    it('Complexity only ever adds notes, never moves the ones already playing', () => {
        let previous = 0;
        for (const complexity of [0, 0.25, 0.5, 0.75, 1]) {
            const notes = generateBassLine(bass({ complexity, humanize: 0, phraseVariation: 0 }),
                { ...ctx, regionChords: PROGRESSION });
            expect(notes.length).toBeGreaterThanOrEqual(previous);
            previous = notes.length;
        }
    });

    it('Intensity changes how hard the notes are played', () => {
        const mean = (i: number) => {
            const ns = generateBassLine(bass({ intensity: i }), { ...ctx, regionChords: PROGRESSION });
            return ns.reduce((a, n) => a + n.velocity, 0) / ns.length;
        };
        expect(mean(1)).toBeGreaterThan(mean(0.1));
    });

    it('Swing pushes the offbeats late, never early', () => {
        /* Complexity at the top first: at the default only the even
         * sixteenths play, and swing correctly does not move those. */
        const opts = { leftHand: false, humanize: 0, variation: 8, complexity: 1, phraseVariation: 0 } as const;
        const straight = generateKeyboardPart(keys({ ...opts, swing: 0 }),
            { ...ctx, regionChords: PROGRESSION });
        const swung = generateKeyboardPart(keys({ ...opts, swing: 1 }),
            { ...ctx, regionChords: PROGRESSION });
        expect(swung.map(n => n.start)).not.toEqual(straight.map(n => n.start));
        for (let i = 0; i < Math.min(straight.length, swung.length); i++) {
            expect(swung[i].start).toBeGreaterThanOrEqual(straight[i].start - 1e-9);
        }
    });

    it('Feel pulls the part behind the beat or pushes it ahead', () => {
        const at = (feel: number) => generateBassLine(bass({ feel, humanize: 0 }),
            { ...ctx, regionChords: PROGRESSION }).map(n => n.start);
        const behind = at(-1); const ahead = at(1); const straight = at(0);
        const i = straight.findIndex(s => s > 0.5);
        expect(behind[i]).toBeGreaterThan(straight[i]);
        expect(ahead[i]).toBeLessThan(straight[i]);
    });

    /*
     * Nothing may be pulled out of the front of the region: a note at a
     * negative beat is a note the sequencer never plays.
     */
    it('never writes a note before the region starts', () => {
        for (const feel of [-1, 0, 1]) {
            const b = generateBassLine(bass({ feel, slides: 1 }), { ...ctx, regionChords: PROGRESSION });
            const k = generateKeyboardPart(keys({ feel, graceNotes: 1 }), { ...ctx, regionChords: PROGRESSION });
            for (const n of [...b, ...k]) expect(n.start).toBeGreaterThanOrEqual(0);
        }
    });

    it('never writes a note past the end of the region', () => {
        const b = generateBassLine(bass({ complexity: 1, fillAmount: 1 }), { ...ctx, regionChords: PROGRESSION });
        const k = generateKeyboardPart(keys({ complexity: 1, fillAmount: 1 }), { ...ctx, regionChords: PROGRESSION });
        for (const n of [...b, ...k]) expect(n.start).toBeLessThan(16);
    });

    /*
     * Seeded, not `Math.random`. Otherwise every re-render is a different take,
     * nudging one knob reshuffles the rest, and none of these tests can exist.
     */
    it('gives the same performance for the same settings', () => {
        const once = generateBassLine(bass({ humanize: 1 }), { ...ctx, regionChords: PROGRESSION });
        const twice = generateBassLine(bass({ humanize: 1 }), { ...ctx, regionChords: PROGRESSION });
        expect(twice).toEqual(once);
    });

    it('gives a different take for a different seed', () => {
        const a = generateBassLine(bass({ seed: 1, humanize: 0.5 }), { ...ctx, regionChords: PROGRESSION });
        const b = generateBassLine(bass({ seed: 2, humanize: 0.5 }), { ...ctx, regionChords: PROGRESSION });
        expect(b).not.toEqual(a);
    });

    it('returns nothing for a region with no bars', () => {
        expect(generateBassLine(bass(), { bars: 0 })).toEqual([]);
        expect(generateKeyboardPart(keys(), { bars: 0 })).toEqual([]);
    });
});

describe('Follow Rhythm Of a track', () => {
    const onsets = [0.5, 1.5, 2.5, 3.5];

    it('does nothing until a track is chosen', () => {
        const without = generateBassLine(bass(), { ...ctx, regionChords: PROGRESSION, followOnsets: onsets });
        const plain = generateBassLine(bass(), { ...ctx, regionChords: PROGRESSION });
        expect(without).toEqual(plain);
    });

    it('places notes where the followed track\'s notes fall', () => {
        const plain = generateBassLine(bass(), { ...ctx, regionChords: PROGRESSION });
        const following = generateBassLine(bass({ followTrackId: 'guitar' }),
            { ...ctx, regionChords: PROGRESSION, followOnsets: onsets });
        expect(following.length).toBeGreaterThan(plain.length);
        // 0.5 is an eighth the default pattern does not play; following adds it.
        expect(following.some(n => Math.abs(n.start - 0.5) < 0.05)).toBe(true);
    });
});

describe('Follow Rhythm Of chords', () => {
    /* A chord change on an off-beat the pattern happens to rest on. */
    const OFFSET: Chord[] = [
        { id: 'a', start: 0, duration: 2.5, root: 0, quality: 'maj', bass: null },
        { id: 'b', start: 2.5, duration: 13.5, root: 7, quality: 'maj', bass: null },
    ];

    it('puts a note on the chord change itself', () => {
        const off = generateBassLine(bass({ followChords: false }), { ...ctx, regionChords: OFFSET });
        const on = generateBassLine(bass({ followChords: true }), { ...ctx, regionChords: OFFSET });
        expect(on.length).toBeGreaterThan(off.length);
        expect(on.some(n => Math.abs(n.start - 2.5) < 0.05)).toBe(true);
        expect(off.some(n => Math.abs(n.start - 2.5) < 0.05)).toBe(false);
    });

    it("does the same in the keyboard's right hand", () => {
        const off = generateKeyboardPart(keys({ followChords: false, leftHand: false }),
            { ...ctx, regionChords: OFFSET });
        const on = generateKeyboardPart(keys({ followChords: true, leftHand: false }),
            { ...ctx, regionChords: OFFSET });
        expect(on.length).toBeGreaterThan(off.length);
        expect(on.some(n => Math.abs(n.start - 2.5) < 0.05)).toBe(true);
    });

    it('marks nothing when there is only one chord to mark', () => {
        const single = [{ id: 'a', start: 0, duration: 16, root: 0, quality: 'maj' as const, bass: null }];
        const off = generateBassLine(bass({ followChords: false }), { ...ctx, regionChords: single });
        const on = generateBassLine(bass({ followChords: true }), { ...ctx, regionChords: single });
        expect(on).toEqual(off);
    });
});

describe('the Tempo mode', () => {
    it('takes an explicit choice literally', () => {
        expect(resolveTempoMode('standard', 200)).toBe('standard');
        expect(resolveTempoMode('half-time', 60)).toBe('half-time');
        expect(resolveTempoMode('double-time', 200)).toBe('double-time');
    });

    it('drops to half-time when the project runs far above the style', () => {
        expect(resolveTempoMode('automatic', 180)).toBe('half-time');
    });

    it('doubles up when the project runs far below it', () => {
        expect(resolveTempoMode('automatic', 60)).toBe('double-time');
    });

    it('leaves the middle of the range alone', () => {
        expect(resolveTempoMode('automatic', 110)).toBe('standard');
        expect(resolveTempoMode('automatic', 128)).toBe('standard');
    });

    it('survives a tempo it cannot read', () => {
        expect(resolveTempoMode('automatic', NaN)).toBe('standard');
        expect(resolveTempoMode('automatic', 0)).toBe('standard');
    });

    it('double-time plays more notes in the same region than half-time', () => {
        const half = generateBassLine(bass({ tempoMode: 'half-time' }), { ...ctx, regionChords: PROGRESSION });
        const double = generateBassLine(bass({ tempoMode: 'double-time' }), { ...ctx, regionChords: PROGRESSION });
        expect(double.length).toBeGreaterThan(half.length);
    });
});

describe('the pattern rows the Patterns dialog draws', () => {
    it('offers eight patterns', () => {
        expect(RHYTHM_PATTERN_COUNT).toBe(8);
    });

    it('draws sixteen steps for each', () => {
        for (let v = 1; v <= RHYTHM_PATTERN_COUNT; v++) {
            expect(rhythmPreview(v, 0.5)).toHaveLength(16);
        }
    });

    it('shows more steps as Complexity comes up', () => {
        const at = (c: number) => rhythmPreview(8, c).filter(Boolean).length;
        expect(at(1)).toBeGreaterThan(at(0));
    });

    it('clamps a pattern number that does not exist rather than throwing', () => {
        expect(rhythmPreview(0, 0.5)).toHaveLength(16);
        expect(rhythmPreview(99, 0.5)).toHaveLength(16);
    });
});

describe('a hand-typed pattern', () => {
    const manual = {
        length: 16,
        rows: { bass: Array.from({ length: 16 }, (_, i) => i % 4 === 0) },
        muted: {},
    };

    it('replaces the generated rhythm outright', () => {
        const notes = generateBassLine(bass({ manual, humanize: 0 }), { ...ctx, regionChords: PROGRESSION });
        expect(notes.length).toBe(16);
        for (const n of notes) expect(Math.abs(n.start % 1)).toBeLessThan(1e-6);
    });

    it('a muted row plays nothing', () => {
        const notes = generateBassLine(
            bass({ manual: { ...manual, muted: { bass: true } } }),
            { ...ctx, regionChords: PROGRESSION });
        expect(notes).toEqual([]);
    });

    it('a pattern shorter than the region repeats across it', () => {
        const notes = generateBassLine(
            bass({ manual: { length: 8, rows: { bass: [true, false, false, false, false, false, false, false] }, muted: {} }, humanize: 0 }),
            { ...ctx, regionChords: PROGRESSION });
        // Eight steps is half a bar, so one note every two beats across four bars.
        expect(notes).toHaveLength(8);
    });
});
