/**
 * The chord model the Bass Player and Keyboard Player read.
 *
 * Each test names the mistake it forbids, because most of these are rules that
 * look obvious and are easy to write backwards: which chord wins an overlap,
 * what happens where no chord is written, and whether a progression walks up
 * the keyboard until it falls off the end.
 */
import {
    parseChord, formatChord, chordTones, chordAt, tonicOf, harmonyFor,
    progressionChords, voiceChord, pitchAtOrAbove, PROGRESSIONS,
    CHORD_QUALITIES, type Chord,
} from '@/lib/chords';

const chord = (over: Partial<Chord> = {}): Chord => ({
    id: 'c', start: 0, duration: 4, root: 0, quality: 'maj', bass: null, ...over,
});

describe('reading and writing chord symbols', () => {
    it('reads the spellings people actually type', () => {
        expect(parseChord('C')).toEqual({ root: 0, quality: 'maj', bass: null });
        expect(parseChord('Am')).toEqual({ root: 9, quality: 'min', bass: null });
        expect(parseChord('Bb')).toEqual({ root: 10, quality: 'maj', bass: null });
        expect(parseChord('F#m7')).toEqual({ root: 6, quality: 'min7', bass: null });
        expect(parseChord('Gsus4')).toEqual({ root: 7, quality: 'sus4', bass: null });
        expect(parseChord('Dmaj7')).toEqual({ root: 2, quality: 'maj7', bass: null });
    });

    it('treats Cmin7, Cm7 and C-7 as the same chord', () => {
        const a = parseChord('Cmin7');
        expect(parseChord('Cm7')).toEqual(a);
        expect(parseChord('C-7')).toEqual(a);
    });

    it('reads a slash bass', () => {
        expect(parseChord('C/E')).toEqual({ root: 0, quality: 'maj', bass: 4 });
        expect(parseChord('Am7/G')).toEqual({ root: 9, quality: 'min7', bass: 7 });
    });

    /*
     * A typo must be refused, not guessed at. Falling back to a major triad
     * would turn "Cmimor" into a chord that plays and sounds wrong, which is
     * far harder to notice than one the editor declines to accept.
     */
    it('refuses what it cannot read rather than guessing a major triad', () => {
        expect(parseChord('Cmimor')).toBeNull();
        expect(parseChord('H')).toBeNull();
        expect(parseChord('')).toBeNull();
        expect(parseChord('C/H')).toBeNull();
        expect(parseChord('  ')).toBeNull();
    });

    it('writes back what it read, for every quality it knows', () => {
        for (const quality of CHORD_QUALITIES) {
            const text = formatChord({ root: 0, quality, bass: null });
            expect(parseChord(text)).toEqual({ root: 0, quality, bass: null });
        }
    });

    it('does not write a slash when the bass is the root', () => {
        expect(formatChord({ root: 0, quality: 'maj', bass: 0 })).toBe('C');
        expect(formatChord({ root: 0, quality: 'maj', bass: 4 })).toBe('C/E');
    });
});

describe('the notes a chord contains', () => {
    it('spells the common triads and sevenths', () => {
        expect(chordTones({ root: 0, quality: 'maj' })).toEqual([0, 4, 7]);
        expect(chordTones({ root: 9, quality: 'min' })).toEqual([9, 0, 4]);
        expect(chordTones({ root: 7, quality: '7' })).toEqual([7, 11, 2, 5]);
    });

    it('wraps past the octave rather than running off the top', () => {
        // A ninth is 14 semitones up; as a pitch class it must come back to 2.
        expect(chordTones({ root: 0, quality: '9' })).toContain(2);
        expect(chordTones({ root: 0, quality: '9' }).every(pc => pc >= 0 && pc < 12)).toBe(true);
    });
});

describe('which chord is sounding', () => {
    const chords = [
        chord({ id: 'a', start: 0, duration: 4, root: 0 }),
        chord({ id: 'b', start: 4, duration: 4, root: 7 }),
    ];

    it('finds the chord covering a beat', () => {
        expect(chordAt(chords, 0)?.id).toBe('a');
        expect(chordAt(chords, 3.9)?.id).toBe('a');
        expect(chordAt(chords, 4)?.id).toBe('b');
    });

    /*
     * A chord's own end belongs to the next chord, not to it. Written the other
     * way, every chord change sounds both chords for one beat.
     */
    it('ends a chord where the next one starts', () => {
        expect(chordAt(chords, 8)).toBeNull();
        expect(chordAt([chord({ start: 0, duration: 4 })], 4)).toBeNull();
    });

    it('gives an overlap to the one written later', () => {
        const overlapping = [
            chord({ id: 'under', start: 0, duration: 8, root: 0 }),
            chord({ id: 'over', start: 4, duration: 4, root: 5 }),
        ];
        expect(chordAt(overlapping, 5)?.id).toBe('over');
    });
});

describe('the key signature as a fallback', () => {
    it('reads a key signature the store actually holds', () => {
        expect(tonicOf('C major')).toEqual({ root: 0, quality: 'maj' });
        expect(tonicOf('A minor')).toEqual({ root: 9, quality: 'min' });
        expect(tonicOf('F# major')).toEqual({ root: 6, quality: 'maj' });
        expect(tonicOf('Eb minor')).toEqual({ root: 3, quality: 'min' });
    });

    it('falls back to C major rather than throwing on nonsense', () => {
        expect(tonicOf(undefined)).toEqual({ root: 0, quality: 'maj' });
        expect(tonicOf('')).toEqual({ root: 0, quality: 'maj' });
        expect(tonicOf('not a key')).toEqual({ root: 0, quality: 'maj' });
    });
});

describe('the harmony a region plays', () => {
    const base = { regionStart: 0, bars: 2, beatsPerBar: 4, keySignature: 'C major' };

    /*
     * A player with no chords must play *something*. Silence where the harmony
     * runs out reads as a broken generator, not as an unharmonised bar — which
     * is why the manual specifies the key's tonic.
     */
    it('plays the key tonic where nothing is written', () => {
        const h = harmonyFor({ ...base });
        expect(h).toHaveLength(1);
        expect(h[0]).toMatchObject({ root: 0, quality: 'maj', start: 0, duration: 8 });
    });

    it('uses the key, not always C', () => {
        expect(harmonyFor({ ...base, keySignature: 'A minor' })[0])
            .toMatchObject({ root: 9, quality: 'min' });
    });

    it('prefers region chords over the chord track', () => {
        const h = harmonyFor({
            ...base,
            regionChords: [chord({ root: 5, duration: 8 })],
            chordTrack: [chord({ root: 7, duration: 8 })],
        });
        expect(h[0].root).toBe(5);
    });

    it('falls back to the chord track when the region has none', () => {
        const h = harmonyFor({ ...base, regionChords: [], chordTrack: [chord({ root: 7, duration: 8 })] });
        expect(h[0].root).toBe(7);
    });

    it('shifts chord-track chords into the region\'s own time', () => {
        const h = harmonyFor({
            ...base, regionStart: 16,
            chordTrack: [chord({ start: 16, duration: 8, root: 2 })],
        });
        expect(h[0]).toMatchObject({ root: 2, start: 0 });
    });

    it('fills a gap between chords with the tonic instead of leaving a hole', () => {
        const h = harmonyFor({ ...base, regionChords: [chord({ start: 4, duration: 4, root: 7 })] });
        expect(h.map(c => [c.start, c.duration, c.root])).toEqual([[0, 4, 0], [4, 4, 7]]);
    });

    it('covers every beat of the region, with no overlap', () => {
        const h = harmonyFor({ ...base, regionChords: [chord({ start: 2, duration: 2, root: 5 })] });
        let cursor = 0;
        for (const c of h) {
            expect(c.start).toBe(cursor);
            cursor += c.duration;
        }
        expect(cursor).toBe(8);
    });

    it('clips a chord that runs past the end of the region', () => {
        const h = harmonyFor({ ...base, regionChords: [chord({ start: 0, duration: 99, root: 3 })] });
        expect(h).toHaveLength(1);
        expect(h[0].duration).toBe(8);
    });
});

describe('progressions', () => {
    it('writes one chord per bar, looping to the region length', () => {
        const p = PROGRESSIONS.find(x => x.name === 'I – V – vi – IV')!;
        const chords = progressionChords(p, { keySignature: 'C major', bars: 6, beatsPerBar: 4 });
        expect(chords).toHaveLength(6);
        expect(chords.map(c => formatChord(c))).toEqual(['C', 'G', 'Am', 'F', 'C', 'G']);
    });

    it('is written in the project key, not always C', () => {
        const p = PROGRESSIONS.find(x => x.name === 'I – V – vi – IV')!;
        const chords = progressionChords(p, { keySignature: 'D major', bars: 4, beatsPerBar: 4 });
        expect(chords.map(c => formatChord(c))).toEqual(['D', 'A', 'Bm', 'G']);
    });

    it('uses minor degrees in a minor key', () => {
        const p = PROGRESSIONS.find(x => x.name === 'Tonic only')!;
        expect(formatChord(progressionChords(p, { keySignature: 'A minor', bars: 1, beatsPerBar: 4 })[0]))
            .toBe('Am');
    });
});

describe('voicing', () => {
    it('keeps every note inside the range it is given', () => {
        for (const root of [0, 3, 7, 11]) {
            const notes = voiceChord({ root, quality: 'maj7' }, { low: 55, high: 79 });
            expect(notes.length).toBeGreaterThan(0);
            for (const n of notes) {
                expect(n).toBeGreaterThanOrEqual(55);
                expect(n).toBeLessThanOrEqual(79);
            }
        }
    });

    /*
     * Without `near`, each chord is spelled from its own root upward, so a
     * I–V–vi–IV climbs an octave every four bars and eventually leaves the
     * range. This is the test that forbids that.
     */
    it('voices near where the last chord sat rather than climbing', () => {
        const range = { low: 55, high: 79 };
        let near: number | null = null;
        const centres: number[] = [];
        for (const root of [0, 7, 9, 5, 0, 7, 9, 5]) {
            const notes = voiceChord({ root, quality: 'maj' }, { ...range, near });
            const centre = notes.reduce((a, b) => a + b, 0) / notes.length;
            centres.push(centre);
            near = Math.round(centre);
        }
        const spread = Math.max(...centres) - Math.min(...centres);
        expect(spread).toBeLessThan(12);
    });

    it('takes only as many notes as asked for', () => {
        expect(voiceChord({ root: 0, quality: '9' }, { low: 48, high: 84, count: 3 })).toHaveLength(3);
    });

    it('never returns the same pitch twice', () => {
        const notes = voiceChord({ root: 0, quality: 'maj9' }, { low: 60, high: 72 });
        expect(new Set(notes).size).toBe(notes.length);
    });
});

describe('pitchAtOrAbove', () => {
    it('finds the lowest instance of a pitch class at or above a floor', () => {
        expect(pitchAtOrAbove(0, 40)).toBe(48);
        expect(pitchAtOrAbove(4, 40)).toBe(40);
        expect(pitchAtOrAbove(11, 40)).toBe(47);
    });

    it('handles a pitch class given outside 0..11', () => {
        expect(pitchAtOrAbove(14, 40)).toBe(50);
        expect(pitchAtOrAbove(-1, 40)).toBe(47);
    });
});
