/**
 * Chords: the harmony the Bass Player and Keyboard Player follow.
 *
 * Both of those players are, at bottom, a rhythm plus a rule for choosing
 * notes from a chord. Without chords they have nothing to play, which is why
 * this had to exist before either of them — the same reason the drum generator
 * had to exist before the Session Player's knobs.
 *
 * Pure arithmetic, no DOM and no store: a chord is a root, a quality and a
 * span of beats, and everything else here is a function of those.
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** The spellings people type, mapped to pitch classes. */
const NOTE_TO_PC: Readonly<Record<string, number>> = {
    C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, 'E#': 5,
    F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10,
    B: 11, Cb: 11, 'B#': 0,
};

export type ChordQuality =
    | 'maj' | 'min' | 'dim' | 'aug'
    | 'sus2' | 'sus4'
    | '6' | 'min6'
    | '7' | 'maj7' | 'min7' | 'm7b5' | 'dim7'
    | '9' | 'maj9' | 'min9';

/**
 * The intervals above the root, in semitones.
 *
 * Written out rather than derived so a test can state one outright, and so an
 * unusual quality cannot silently fall back to a major triad.
 */
const INTERVALS: Readonly<Record<ChordQuality, readonly number[]>> = {
    maj: [0, 4, 7],
    min: [0, 3, 7],
    dim: [0, 3, 6],
    aug: [0, 4, 8],
    sus2: [0, 2, 7],
    sus4: [0, 5, 7],
    '6': [0, 4, 7, 9],
    min6: [0, 3, 7, 9],
    '7': [0, 4, 7, 10],
    maj7: [0, 4, 7, 11],
    min7: [0, 3, 7, 10],
    m7b5: [0, 3, 6, 10],
    dim7: [0, 3, 6, 9],
    '9': [0, 4, 7, 10, 14],
    maj9: [0, 4, 7, 11, 14],
    min9: [0, 3, 7, 10, 14],
};

/** How each quality is written after the root. */
const SUFFIX: Readonly<Record<ChordQuality, string>> = {
    maj: '', min: 'm', dim: 'dim', aug: 'aug',
    sus2: 'sus2', sus4: 'sus4',
    '6': '6', min6: 'm6',
    '7': '7', maj7: 'maj7', min7: 'm7', m7b5: 'm7b5', dim7: 'dim7',
    '9': '9', maj9: 'maj9', min9: 'm9',
};

export const CHORD_QUALITIES = Object.keys(INTERVALS) as ChordQuality[];

export interface Chord {
    id: string;
    /** Beats from the start of whatever holds it — the project, or a region. */
    start: number;
    /** Length in beats. */
    duration: number;
    /** Pitch class, 0 = C. */
    root: number;
    quality: ChordQuality;
    /** A different note in the bass, as in C/E. Pitch class, or null. */
    bass?: number | null;
}

/** The intervals of a chord, above its root. */
export function chordIntervals(quality: ChordQuality): readonly number[] {
    return INTERVALS[quality] ?? INTERVALS.maj;
}

/** The pitch classes a chord contains. */
export function chordTones(chord: Pick<Chord, 'root' | 'quality'>): number[] {
    return [...new Set(chordIntervals(chord.quality).map(i => (chord.root + i) % 12))];
}

/** A chord as it is written. */
export function formatChord(chord: Pick<Chord, 'root' | 'quality' | 'bass'>): string {
    const name = NOTE_NAMES[((chord.root % 12) + 12) % 12] + SUFFIX[chord.quality];
    if (chord.bass === null || chord.bass === undefined) return name;
    if (chord.bass === chord.root % 12) return name;
    return `${name}/${NOTE_NAMES[((chord.bass % 12) + 12) % 12]}`;
}

/**
 * Read a chord symbol.
 *
 * Deliberately forgiving about how a quality is written — `Cmin7`, `Cm7` and
 * `C-7` are the same chord and people type all three — but it returns null
 * rather than guessing when it cannot tell, so a typo becomes a chord that is
 * refused rather than a wrong chord that plays.
 */
export function parseChord(text: string): Pick<Chord, 'root' | 'quality' | 'bass'> | null {
    if (typeof text !== 'string') return null;
    const trimmed = text.trim();
    if (!trimmed) return null;

    const [main, bassPart] = trimmed.split('/');
    const m = /^([A-Ga-g])([#b]?)(.*)$/.exec(main.trim());
    if (!m) return null;

    const root = NOTE_TO_PC[m[1].toUpperCase() + m[2]];
    if (root === undefined) return null;

    const quality = readQuality(m[3].trim());
    if (quality === null) return null;

    let bass: number | null = null;
    if (bassPart !== undefined) {
        const bm = /^([A-Ga-g])([#b]?)$/.exec(bassPart.trim());
        if (!bm) return null;
        const pc = NOTE_TO_PC[bm[1].toUpperCase() + bm[2]];
        if (pc === undefined) return null;
        bass = pc;
    }
    return { root, quality, bass };
}

function readQuality(raw: string): ChordQuality | null {
    const q = raw.replace(/^-/, 'm').toLowerCase();
    if (q === '' || q === 'maj' || q === 'major' || q === 'M') return 'maj';
    if (q === 'm' || q === 'min' || q === 'minor') return 'min';
    if (q === 'dim' || q === 'o' || q === '°') return 'dim';
    if (q === 'aug' || q === '+') return 'aug';
    if (q === 'sus' || q === 'sus4') return 'sus4';
    if (q === 'sus2') return 'sus2';
    if (q === '6') return '6';
    if (q === 'm6' || q === 'min6') return 'min6';
    if (q === '7' || q === 'dom7') return '7';
    if (q === 'maj7' || q === 'ma7' || q === 'M7' || q === 'Δ' || q === 'δ') return 'maj7';
    if (q === 'm7' || q === 'min7') return 'min7';
    if (q === 'm7b5' || q === 'min7b5' || q === 'ø') return 'm7b5';
    if (q === 'dim7' || q === 'o7') return 'dim7';
    if (q === '9') return '9';
    if (q === 'maj9' || q === 'ma9') return 'maj9';
    if (q === 'm9' || q === 'min9') return 'min9';
    return null;
}

/**
 * The tonic of a key signature, for when no chord covers the moment.
 *
 * The manual: "If no chords exist on the Chord track at the position of the
 * Keyboard Player or Bass Player region, or as region chords, the players play
 * the tonic chord of the project's key signature." Silence would be the easy
 * answer and the wrong one — a player that stops when the chords run out reads
 * as broken rather than as unharmonised.
 */
export function tonicOf(keySignature: string | undefined | null): Pick<Chord, 'root' | 'quality'> {
    const text = (keySignature ?? 'C major').trim();
    const m = /^([A-Ga-g])([#b]?)\s*(major|minor|maj|min)?$/i.exec(text);
    const root = m ? NOTE_TO_PC[m[1].toUpperCase() + (m[2] ?? '')] ?? 0 : 0;
    const minor = m ? /^min/i.test(m[3] ?? 'major') : false;
    return { root, quality: minor ? 'min' : 'maj' };
}

/** The chord sounding at a beat, or null when none covers it. */
export function chordAt(chords: readonly Chord[], beat: number): Chord | null {
    if (!Array.isArray(chords) || !Number.isFinite(beat)) return null;
    let found: Chord | null = null;
    for (const c of chords) {
        if (!c || !Number.isFinite(c.start) || !Number.isFinite(c.duration)) continue;
        if (beat < c.start || beat >= c.start + c.duration) continue;
        // Later chords win, so an overlap sounds like the one written last.
        if (!found || c.start >= found.start) found = c;
    }
    return found;
}

/**
 * The harmony a region is playing, beat by beat.
 *
 * Region chords beat the Chord track, which beats the key's tonic — the
 * manual's order exactly. Returned as one entry per chord change rather than
 * per beat, so a generator can ask "what am I on, and how long for".
 */
export function harmonyFor({
    regionChords, chordTrack, regionStart, bars, beatsPerBar, keySignature,
}: {
    regionChords?: readonly Chord[] | null;
    chordTrack?: readonly Chord[] | null;
    regionStart: number;
    bars: number;
    beatsPerBar: number;
    keySignature?: string | null;
}): Chord[] {
    const total = Math.max(0, bars * beatsPerBar);
    const tonic = tonicOf(keySignature);

    /* Region chords are already relative to the region; the Chord track is not. */
    const local: Chord[] = (regionChords && regionChords.length)
        ? [...regionChords]
        : (chordTrack ?? [])
            .filter(c => c.start + c.duration > regionStart && c.start < regionStart + total)
            .map(c => ({ ...c, start: c.start - regionStart }));

    if (!local.length) {
        return [{ id: 'tonic', start: 0, duration: total, ...tonic, bass: null }];
    }

    local.sort((a, b) => a.start - b.start);

    // Clip to the region, and fill any gap before the first chord with the
    // tonic rather than leaving the player with nothing to play.
    const out: Chord[] = [];
    let cursor = 0;
    for (const c of local) {
        const start = Math.max(0, c.start);
        const end = Math.min(total, c.start + c.duration);
        if (end <= 0 || start >= total) continue;
        if (start > cursor) {
            out.push({ id: `gap-${cursor}`, start: cursor, duration: start - cursor, ...tonic, bass: null });
        }
        out.push({ ...c, start, duration: end - start });
        cursor = end;
    }
    if (cursor < total) {
        out.push({ id: `gap-${cursor}`, start: cursor, duration: total - cursor, ...tonic, bass: null });
    }
    return out;
}

/* ── Progressions ───────────────────────────────────────────────────────── */

/** Scale degrees, as a progression is written. */
const MAJOR_DEGREES: Array<[number, ChordQuality]> = [
    [0, 'maj'], [2, 'min'], [4, 'min'], [5, 'maj'], [7, 'maj'], [9, 'min'], [11, 'dim'],
];
const MINOR_DEGREES: Array<[number, ChordQuality]> = [
    [0, 'min'], [2, 'dim'], [3, 'maj'], [5, 'min'], [7, 'min'], [8, 'maj'], [10, 'maj'],
];

export interface Progression {
    name: string;
    /** Roman-numeral degrees, 1-based, one per bar. */
    degrees: number[];
}

export const PROGRESSIONS: readonly Progression[] = [
    { name: 'I – V – vi – IV', degrees: [1, 5, 6, 4] },
    { name: 'I – vi – IV – V', degrees: [1, 6, 4, 5] },
    { name: 'ii – V – I', degrees: [2, 5, 1, 1] },
    { name: 'I – IV – V – IV', degrees: [1, 4, 5, 4] },
    { name: 'vi – IV – I – V', degrees: [6, 4, 1, 5] },
    { name: 'I – iii – IV – V', degrees: [1, 3, 4, 5] },
    { name: 'Twelve Bar Blues', degrees: [1, 1, 1, 1, 4, 4, 1, 1, 5, 4, 1, 5] },
    { name: 'Tonic only', degrees: [1] },
];

/**
 * A progression written out as chords in a key, one per bar, looped to length.
 *
 * The manual offers "a set of chord progressions for the Session Players to
 * follow" as the quick way to give a region harmony; this is that set.
 */
export function progressionChords(
    progression: Progression,
    { keySignature, bars, beatsPerBar }: { keySignature?: string | null; bars: number; beatsPerBar: number },
): Chord[] {
    const tonic = tonicOf(keySignature);
    const table = tonic.quality === 'min' ? MINOR_DEGREES : MAJOR_DEGREES;
    const out: Chord[] = [];
    for (let bar = 0; bar < Math.max(1, bars); bar++) {
        const degree = progression.degrees[bar % progression.degrees.length];
        const [interval, quality] = table[(degree - 1) % table.length];
        out.push({
            id: `prog-${bar}`,
            start: bar * beatsPerBar,
            duration: beatsPerBar,
            root: (tonic.root + interval) % 12,
            quality,
            bass: null,
        });
    }
    return out;
}

/* ── Voicing ────────────────────────────────────────────────────────────── */

/**
 * Chord tones as MIDI pitches inside a range.
 *
 * `near` keeps a progression from leaping about: each chord is voiced close to
 * where the last one sat, which is what a player's hand does. Without it every
 * chord is spelled from its root upward and a I–V–vi–IV walks steadily up the
 * keyboard until it falls off.
 */
export function voiceChord(
    chord: Pick<Chord, 'root' | 'quality'>,
    { low, high, count, near }: { low: number; high: number; count?: number; near?: number | null },
): number[] {
    const tones = chordTones(chord);
    const wanted = Math.max(1, Math.min(count ?? tones.length, tones.length));
    const centre = near ?? Math.round((low + high) / 2);

    const pitches: number[] = [];
    for (const pc of tones.slice(0, wanted)) {
        // The octave of this pitch class nearest the centre, then pulled into
        // range rather than clamped flat onto the boundary.
        let pitch = pc + 12 * Math.round((centre - pc) / 12);
        while (pitch < low) pitch += 12;
        while (pitch > high) pitch -= 12;
        if (pitch < low) continue;
        pitches.push(pitch);
    }
    return [...new Set(pitches)].sort((a, b) => a - b);
}

/** The lowest pitch of a pitch class at or above a floor. */
export function pitchAtOrAbove(pitchClass: number, floor: number): number {
    const pc = ((pitchClass % 12) + 12) % 12;
    let pitch = pc + 12 * Math.floor(floor / 12);
    while (pitch < floor) pitch += 12;
    return pitch;
}
