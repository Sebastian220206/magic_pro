#!/usr/bin/env node
/**
 * generate-midi-loops.mjs
 * Build the loop library as MIDI rather than audio.
 *
 * ## Why MIDI
 *
 * The obvious way to stock a loop library is to ship WAV files. That was
 * rejected for three reasons:
 *
 *   - **Licence.** Most "free loop" packs permit use *in your music* but forbid
 *     redistribution *inside a product*. Bundling them into a DAW sold through
 *     Stripe is exactly the prohibited case, and the distinction is easy to miss.
 *     Generated MIDI has no such question.
 *   - **Size.** A few hundred audio loops is a few hundred megabytes against a
 *     5 GB monthly egress budget. This whole library is a few hundred kilobytes
 *     of JSON.
 *   - **It is better.** An audio loop is a photograph. A MIDI loop opens in the
 *     piano roll: transpose it, change the instrument, delete the note you do
 *     not like. The app already ships a 287-preset General MIDI bank, so these
 *     play through real instruments rather than the sine-and-noise synthesis
 *     the previous 22 loops used.
 *
 * ## Determinism
 *
 * The output is committed, so it must be reproducible: a seeded PRNG, never
 * `Math.random`. Re-running with the same seed produces a byte-identical file,
 * which keeps the diff meaningful when the generator changes.
 *
 * Usage:
 *   node scripts/generate-midi-loops.mjs
 *   node scripts/generate-midi-loops.mjs --seed 42
 */

import { writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'midiLoops.json');

// ── determinism ────────────────────────────────────────────────────────────

/** mulberry32 — small, fast, and good enough for choosing between patterns. */
function makeRandom(seed) {
    let a = seed >>> 0;
    return function random() {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ── music theory ───────────────────────────────────────────────────────────

/** Semitones above the tonic, by scale degree. */
const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

/** Chord qualities as semitone offsets from the chord root. */
const CHORDS = {
    maj: [0, 4, 7],
    min: [0, 3, 7],
    maj7: [0, 4, 7, 11],
    min7: [0, 3, 7, 10],
    dom7: [0, 4, 7, 10],
    sus4: [0, 5, 7],
};

/**
 * A progression is a list of [scaleDegree, quality] pairs, one per bar.
 *
 * Degrees are zero-based indices into the scale, so 0 is the tonic. Writing
 * them this way rather than as absolute notes means one progression works in
 * any key.
 */
const PROGRESSIONS = {
    // I–V–vi–IV and its rotations: the backbone of pop.
    pop: [
        [[0, 'maj'], [4, 'maj'], [5, 'min'], [3, 'maj']],
        [[5, 'min'], [3, 'maj'], [0, 'maj'], [4, 'maj']],
        [[0, 'maj'], [3, 'maj'], [4, 'maj'], [0, 'maj']],
    ],
    // Sevenths throughout — the harmonic colour lo-fi is built on.
    lofi: [
        [[1, 'min7'], [4, 'dom7'], [0, 'maj7'], [5, 'min7']],
        [[0, 'maj7'], [5, 'min7'], [1, 'min7'], [4, 'dom7']],
        [[3, 'maj7'], [2, 'min7'], [1, 'min7'], [0, 'maj7']],
    ],
    // Minor and modal; house leans on i–VI–III–VII.
    house: [
        [[0, 'min'], [5, 'maj'], [2, 'maj'], [6, 'maj']],
        [[0, 'min7'], [3, 'min7'], [0, 'min7'], [4, 'min7']],
    ],
    hiphop: [
        [[0, 'min7'], [3, 'min7']],
        [[0, 'min'], [5, 'maj'], [6, 'maj'], [0, 'min']],
    ],
    trap: [
        [[0, 'min'], [5, 'maj'], [2, 'maj'], [6, 'maj']],
        [[0, 'min'], [0, 'min'], [3, 'min'], [4, 'min']],
    ],
    jazz: [
        [[1, 'min7'], [4, 'dom7'], [0, 'maj7'], [0, 'maj7']],
        [[0, 'maj7'], [5, 'min7'], [1, 'min7'], [4, 'dom7']],
    ],
    rock: [
        [[0, 'maj'], [3, 'maj'], [4, 'maj'], [3, 'maj']],
        [[0, 'maj'], [6, 'maj'], [3, 'maj'], [0, 'maj']],
    ],
    edm: [
        [[5, 'min'], [3, 'maj'], [0, 'maj'], [4, 'maj']],
        [[0, 'min'], [6, 'maj'], [5, 'maj'], [6, 'maj']],
    ],
};

/**
 * General MIDI drum map. Shared by the SoundFont's bank-128 kits and the
 * built-in drum machine, which uses the same numbers.
 */
const DRUM = {
    kick: 36, snare: 38, rim: 37, clap: 39, closedHat: 42,
    pedalHat: 44, openHat: 46, lowTom: 45, midTom: 47, highTom: 50,
    crash: 49, ride: 51, shaker: 70, tamb: 54,
};

/** GM program numbers, by role. */
const PROGRAM = {
    piano: 0, rhodes: 4, clav: 7, vibes: 11, organ: 18,
    nylonGuitar: 24, cleanGuitar: 27, mutedGuitar: 28, overdrive: 29,
    fingerBass: 33, pickBass: 34, fretless: 35, slapBass: 36, synthBass: 38,
    strings: 48, ensemble: 50, choir: 52, brass: 61, sax: 65,
    squareLead: 80, sawLead: 81, warmPad: 89, sweepPad: 95,
};

// ── grids ──────────────────────────────────────────────────────────────────

/**
 * A drum pattern is 16 sixteenth-note steps per bar.
 *
 * `x` is a hit, `-` a rest, `o` an accent. Writing them as strings keeps the
 * rhythm readable at a glance, which matters far more here than compactness.
 */
const DRUM_PATTERNS = {
    house: [
        { name: 'Four on the Floor', kick: 'x---x---x---x---', snare: '----x-------x---', hat: '--x---x---x---x-' },
        { name: 'Deep House Groove', kick: 'x---x---x---x---', clap: '----x-------x---', hat: '--x-x-x-x-x-x-x-' },
        { name: 'Tech House Shuffle', kick: 'x---x---x---x-x-', snare: '----x-------x---', hat: '--x--x-x--x--x-x' },
    ],
    hiphop: [
        { name: 'Boom Bap', kick: 'x-----x-x-------', snare: '----x-------x---', hat: 'x-x-x-x-x-x-x-x-' },
        { name: 'Laid Back', kick: 'x-------x--x----', snare: '----x-------x---', hat: 'x-x-x-x-x-x-x-x-' },
        { name: 'Head Nod', kick: 'x--x--x---x-----', snare: '----x-------x---', hat: '--x---x---x---x-' },
    ],
    lofi: [
        { name: 'Dusty Swing', kick: 'x-------x-------', snare: '----x-------x---', hat: 'x--x--x--x--x--x' },
        { name: 'Sleepy Groove', kick: 'x-----x---------', rim: '----x-------x---', hat: '--x---x---x---x-' },
    ],
    trap: [
        { name: 'Trap Roll', kick: 'x-----x---x-----', snare: '--------x-------', hat: 'xxxxxxxxxxxxxxxx' },
        { name: 'Triplet Hats', kick: 'x-------x---x---', clap: '--------x-------', hat: 'x-xx-xx-x-xx-xx-' },
        { name: 'Sparse 808', kick: 'x---------x-----', snare: '--------x-------', hat: 'x-x-x-x-x-x-x-x-' },
    ],
    pop: [
        { name: 'Straight Pop', kick: 'x-------x-------', snare: '----x-------x---', hat: 'x-x-x-x-x-x-x-x-' },
        { name: 'Pop Drive', kick: 'x---x---x---x---', snare: '----x-------x---', hat: 'x-x-x-x-x-x-x-x-' },
    ],
    rock: [
        { name: 'Rock Standard', kick: 'x-------x-------', snare: '----x-------x---', hat: 'x-x-x-x-x-x-x-x-' },
        { name: 'Driving Rock', kick: 'x--x----x--x----', snare: '----x-------x---', hat: 'xxxxxxxxxxxxxxxx' },
    ],
    jazz: [
        { name: 'Swing Ride', kick: 'x-------x-------', snare: '----x-------x---', ride: 'x--x-xx--x-xx--x' },
        { name: 'Brush Comp', kick: 'x---------------', snare: '--x---x---x---x-', ride: 'x--x-xx--x-xx--x' },
    ],
    edm: [
        { name: 'Festival Kick', kick: 'x---x---x---x---', clap: '----x-------x---', hat: '--x---x---x---x-' },
        { name: 'Build Groove', kick: 'x---x---x---x---', snare: '------------x---', hat: 'xxxxxxxxxxxxxxxx' },
    ],
};

/** Bass rhythms, as sixteenth-step grids. */
const BASS_RHYTHMS = {
    house: ['x---x---x---x---', 'x-x-x-x-x-x-x-x-'],
    hiphop: ['x-------x---x---', 'x-----x---x-----'],
    lofi: ['x-------x-------', 'x-----x---------'],
    trap: ['x---------------', 'x-------x-x-----'],
    pop: ['x-------x-------', 'x---x---x---x---'],
    rock: ['x-x-x-x-x-x-x-x-', 'x---x---x---x---'],
    jazz: ['x---x---x---x---', 'x-x-x-x-x-x-x-x-'],
    edm: ['x---x---x---x---', 'x-x-x-x-x-x-x-x-'],
};

// ── genres ─────────────────────────────────────────────────────────────────

const GENRES = [
    { id: 'house', name: 'House', bpm: 124, scale: 'minor', keys: ['A', 'F', 'G'], bassProgram: PROGRAM.synthBass, chordPrograms: [PROGRAM.rhodes, PROGRAM.warmPad, PROGRAM.organ], leadPrograms: [PROGRAM.sawLead, PROGRAM.squareLead] },
    { id: 'hiphop', name: 'Hip-Hop', bpm: 90, scale: 'minor', keys: ['C', 'D', 'F'], bassProgram: PROGRAM.fingerBass, chordPrograms: [PROGRAM.rhodes, PROGRAM.piano, PROGRAM.vibes], leadPrograms: [PROGRAM.squareLead, PROGRAM.cleanGuitar] },
    { id: 'lofi', name: 'Lo-fi', bpm: 78, scale: 'major', keys: ['C', 'F', 'Bb'], bassProgram: PROGRAM.fingerBass, chordPrograms: [PROGRAM.rhodes, PROGRAM.piano, PROGRAM.vibes], leadPrograms: [PROGRAM.nylonGuitar, PROGRAM.vibes] },
    { id: 'trap', name: 'Trap', bpm: 140, scale: 'minor', keys: ['F', 'G', 'C'], bassProgram: PROGRAM.synthBass, chordPrograms: [PROGRAM.warmPad, PROGRAM.sweepPad], leadPrograms: [PROGRAM.squareLead, PROGRAM.sawLead] },
    { id: 'pop', name: 'Pop', bpm: 116, scale: 'major', keys: ['C', 'G', 'D'], bassProgram: PROGRAM.pickBass, chordPrograms: [PROGRAM.piano, PROGRAM.strings, PROGRAM.warmPad], leadPrograms: [PROGRAM.sawLead, PROGRAM.ensemble] },
    { id: 'rock', name: 'Rock', bpm: 128, scale: 'mixolydian', keys: ['E', 'A', 'D'], bassProgram: PROGRAM.pickBass, chordPrograms: [PROGRAM.overdrive, PROGRAM.cleanGuitar, PROGRAM.organ], leadPrograms: [PROGRAM.overdrive, PROGRAM.cleanGuitar] },
    { id: 'jazz', name: 'Jazz', bpm: 120, scale: 'dorian', keys: ['F', 'Bb', 'C'], bassProgram: PROGRAM.fretless, chordPrograms: [PROGRAM.piano, PROGRAM.rhodes, PROGRAM.vibes], leadPrograms: [PROGRAM.sax, PROGRAM.vibes] },
    { id: 'edm', name: 'EDM', bpm: 128, scale: 'minor', keys: ['A', 'F', 'G'], bassProgram: PROGRAM.synthBass, chordPrograms: [PROGRAM.sawLead, PROGRAM.sweepPad], leadPrograms: [PROGRAM.sawLead, PROGRAM.squareLead] },
];

const NOTE_NAMES = { C: 0, 'C#': 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };

// ── building blocks ────────────────────────────────────────────────────────

/** A note as a compact tuple: [pitch, velocity, startBeat, durationBeats]. */
function note(pitch, velocity, start, duration) {
    return [pitch, velocity, round(start), round(duration)];
}

/** Two decimals is finer than any grid here, and keeps the JSON small. */
function round(n) {
    return Math.round(n * 100) / 100;
}

/** Semitone offset of a scale degree, wrapping octaves as it passes 7. */
function degreeToSemitone(scale, degree) {
    const steps = SCALES[scale];
    const octave = Math.floor(degree / steps.length);
    return steps[((degree % steps.length) + steps.length) % steps.length] + octave * 12;
}

/** Turn a 16-step grid string into beat positions. */
function stepsToBeats(grid, bar = 0) {
    const beats = [];
    for (let i = 0; i < grid.length; i++) {
        if (grid[i] !== '-') beats.push(bar * 4 + (i / 4));
    }
    return beats;
}

// ── generators ─────────────────────────────────────────────────────────────

function buildDrumLoop(genre, pattern, bars, random) {
    const notes = [];
    const lanes = [
        ['kick', DRUM.kick, 118],
        ['snare', DRUM.snare, 108],
        ['clap', DRUM.clap, 106],
        ['rim', DRUM.rim, 92],
        ['hat', DRUM.closedHat, 78],
        ['ride', DRUM.ride, 84],
    ];

    for (let bar = 0; bar < bars; bar++) {
        for (const [lane, pitch, baseVelocity] of lanes) {
            const grid = pattern[lane];
            if (!grid) continue;

            for (const beat of stepsToBeats(grid, bar)) {
                // A few units of velocity jitter stops a 16th-note hat line
                // sounding like a machine gun.
                const jitter = Math.round((random() - 0.5) * 14);
                notes.push(note(pitch, clampVelocity(baseVelocity + jitter), beat, 0.25));
            }
        }

        // A crash on the downbeat of the first bar gives the loop an edge to
        // start from when it is dropped in cold.
        if (bar === 0 && genre.id !== 'jazz' && genre.id !== 'lofi') {
            notes.push(note(DRUM.crash, 96, 0, 1));
        }
    }

    return notes;
}

function buildBassLoop(genre, progression, rhythm, bars, random) {
    const notes = [];
    const rootPitch = 36; // C2 — bass register

    for (let bar = 0; bar < bars; bar++) {
        const [degree] = progression[bar % progression.length];
        const chordRoot = rootPitch + degreeToSemitone(genre.scale, degree);

        for (const beat of stepsToBeats(rhythm, bar)) {
            // Mostly the root; an occasional octave or fifth keeps a repeated
            // bassline from sitting completely still.
            const roll = random();
            const interval = roll > 0.88 ? 12 : roll > 0.78 ? 7 : 0;
            notes.push(note(chordRoot + interval, clampVelocity(104 + Math.round((random() - 0.5) * 12)), beat, 0.4));
        }
    }

    return notes;
}

function buildChordLoop(genre, progression, bars, random) {
    const notes = [];
    const rootPitch = 60; // C4

    for (let bar = 0; bar < bars; bar++) {
        const [degree, quality] = progression[bar % progression.length];
        const chordRoot = rootPitch + degreeToSemitone(genre.scale, degree);
        const intervals = CHORDS[quality] ?? CHORDS.maj;

        intervals.forEach((interval, voice) => {
            // Drop the root an octave: a triad played in close position at C4
            // is muddy, and spreading it is what a keyboard player would do.
            const pitch = chordRoot + interval - (voice === 0 ? 12 : 0);
            // A few milliseconds of spread per voice reads as a strum rather
            // than a block chord.
            const spread = voice * 0.02;
            notes.push(note(pitch, clampVelocity(84 + Math.round((random() - 0.5) * 10)), bar * 4 + spread, 3.8));
        });
    }

    return notes;
}

function buildArpLoop(genre, progression, bars, random) {
    const notes = [];
    const rootPitch = 60;
    const step = 0.25; // sixteenths

    for (let bar = 0; bar < bars; bar++) {
        const [degree, quality] = progression[bar % progression.length];
        const chordRoot = rootPitch + degreeToSemitone(genre.scale, degree);
        const intervals = CHORDS[quality] ?? CHORDS.maj;

        // Up over two octaves, then back — the standard arpeggiator shape.
        const shape = [...intervals, ...intervals.map(i => i + 12)];
        const sequence = [...shape, ...shape.slice(0, -1).reverse()];

        for (let i = 0; i < 16; i++) {
            const interval = sequence[i % sequence.length];
            notes.push(note(
                chordRoot + interval,
                clampVelocity(76 + (i % 4 === 0 ? 14 : 0) + Math.round((random() - 0.5) * 8)),
                bar * 4 + i * step,
                step * 0.9,
            ));
        }
    }

    return notes;
}

function buildMelodyLoop(genre, progression, bars, random) {
    const notes = [];
    const rootPitch = 72; // C5 — above the chords
    // Longer notes on strong beats, shorter in between.
    const rhythms = [[0, 1], [1, 0.5], [1.5, 0.5], [2, 1], [3, 1]];

    for (let bar = 0; bar < bars; bar++) {
        const [degree, quality] = progression[bar % progression.length];
        const intervals = CHORDS[quality] ?? CHORDS.maj;

        for (const [offset, duration] of rhythms) {
            // Rest sometimes — a melody that never breathes sounds written by
            // a machine, which it is.
            if (random() < 0.22) continue;

            /*
             * Two thirds of the time land on a tone of the current chord; the
             * rest of the time step to another degree of the scale. Chord
             * tones are what make it sound deliberate, scale tones are what
             * stop it sounding like an arpeggio.
             *
             * Both are measured from the chord's root, not the key's — an
             * earlier version added the chord-tone interval to the scale
             * degree and then multiplied the scale-tone branch by zero, so
             * every non-chord note came out as the same repeated root.
             */
            const chordRoot = degreeToSemitone(genre.scale, degree);
            const offsetFromRoot = random() < 0.65
                ? intervals[Math.floor(random() * intervals.length)]
                : degreeToSemitone(genre.scale, degree + 1 + Math.floor(random() * 4)) - chordRoot;

            notes.push(note(
                rootPitch + chordRoot + offsetFromRoot,
                clampVelocity(88 + Math.round((random() - 0.5) * 16)),
                bar * 4 + offset,
                duration * 0.9,
            ));
        }
    }

    return notes;
}

function clampVelocity(v) {
    return Math.max(1, Math.min(127, Math.round(v)));
}

// ── assembly ───────────────────────────────────────────────────────────────

function pick(list, random) {
    return list[Math.floor(random() * list.length)];
}

function buildLibrary(seed) {
    const random = makeRandom(seed);
    const loops = [];

    for (const genre of GENRES) {
        const patterns = DRUM_PATTERNS[genre.id] ?? [];
        const progressions = PROGRESSIONS[genre.id] ?? PROGRESSIONS.pop;
        const rhythms = BASS_RHYTHMS[genre.id] ?? BASS_RHYTHMS.pop;

        // Drums — every pattern, at two and four bars.
        patterns.forEach((pattern, i) => {
            for (const bars of [2, 4]) {
                loops.push({
                    id: `${genre.id}_drums_${i + 1}_${bars}b`,
                    name: `${pattern.name} ${bars} Bar`,
                    category: 'drums',
                    genre: genre.name,
                    instrument: 'Drum Kit',
                    bpm: genre.bpm,
                    beats: bars * 4,
                    drums: true,
                    notes: buildDrumLoop(genre, pattern, bars, random),
                });
            }
        });

        // Bass.
        progressions.forEach((progression, p) => {
            rhythms.forEach((rhythm, r) => {
                const key = pick(genre.keys, random);
                loops.push({
                    id: `${genre.id}_bass_${p + 1}${r + 1}`,
                    name: `${genre.name} Bass ${p + 1}.${r + 1}`,
                    category: 'bass',
                    genre: genre.name,
                    instrument: 'Bass',
                    bpm: genre.bpm,
                    key,
                    beats: 16,
                    program: genre.bassProgram,
                    notes: transposeToKey(buildBassLoop(genre, progression, rhythm, 4, random), key),
                });
            });
        });

        // Chords, arpeggios and melodies.
        progressions.forEach((progression, p) => {
            const key = pick(genre.keys, random);

            for (const program of genre.chordPrograms) {
                loops.push({
                    id: `${genre.id}_chords_${p + 1}_${program}`,
                    name: `${genre.name} Chords ${p + 1}`,
                    category: 'melodic',
                    genre: genre.name,
                    instrument: programName(program),
                    bpm: genre.bpm,
                    key,
                    beats: 16,
                    program,
                    notes: transposeToKey(buildChordLoop(genre, progression, 4, random), key),
                });
            }

            loops.push({
                id: `${genre.id}_arp_${p + 1}`,
                name: `${genre.name} Arp ${p + 1}`,
                category: 'melodic',
                genre: genre.name,
                instrument: programName(genre.chordPrograms[0]),
                bpm: genre.bpm,
                key,
                beats: 16,
                program: genre.chordPrograms[0],
                notes: transposeToKey(buildArpLoop(genre, progression, 4, random), key),
            });

            for (const program of genre.leadPrograms) {
                loops.push({
                    id: `${genre.id}_lead_${p + 1}_${program}`,
                    name: `${genre.name} Melody ${p + 1}`,
                    category: 'melodic',
                    genre: genre.name,
                    instrument: programName(program),
                    bpm: genre.bpm,
                    key,
                    beats: 16,
                    program,
                    notes: transposeToKey(buildMelodyLoop(genre, progression, 4, random), key),
                });
            }
        });
    }

    return loops;
}

/** Shift every pitch so the loop sits in the named key rather than in C. */
function transposeToKey(notes, key) {
    const semitones = NOTE_NAMES[key] ?? 0;
    if (semitones === 0) return notes;
    return notes.map(([pitch, velocity, start, duration]) =>
        [pitch + semitones, velocity, start, duration]);
}

const PROGRAM_NAMES = Object.fromEntries(
    Object.entries(PROGRAM).map(([name, number]) => [number, humanise(name)]));

function humanise(camel) {
    return camel.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
}

function programName(program) {
    return PROGRAM_NAMES[program] ?? `Program ${program}`;
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
    const seedArg = process.argv.indexOf('--seed');
    const seed = seedArg >= 0 ? Number(process.argv[seedArg + 1]) : 20260808;

    const loops = buildLibrary(seed);

    const byCategory = loops.reduce((acc, l) => {
        acc[l.category] = (acc[l.category] ?? 0) + 1;
        return acc;
    }, {});
    const noteCount = loops.reduce((n, l) => n + l.notes.length, 0);

    const payload = {
        // Recorded so a regenerated file can be reproduced exactly.
        seed,
        generator: 'scripts/generate-midi-loops.mjs',
        note: 'Notes are [pitch, velocity, startBeat, durationBeats].',
        loops,
    };

    await writeFile(OUT, JSON.stringify(payload, null, 1) + '\n', 'utf8');

    console.log(`\nWrote data/midiLoops.json`);
    console.log(`  seed     : ${seed}`);
    console.log(`  loops    : ${loops.length}`);
    for (const [category, n] of Object.entries(byCategory)) {
        console.log(`    ${category.padEnd(9)} ${n}`);
    }
    console.log(`  genres   : ${new Set(loops.map(l => l.genre)).size}`);
    console.log(`  notes    : ${noteCount}`);
    console.log(`  size     : ${(JSON.stringify(payload).length / 1024).toFixed(0)} kB\n`);
    return 0;
}

main().then(code => process.exit(code)).catch(error => {
    console.error(error);
    process.exit(1);
});
