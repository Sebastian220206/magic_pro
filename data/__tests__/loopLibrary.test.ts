/**
 * The loop library.
 *
 * Most of these check *musical* properties rather than data shape, because the
 * loops are generated and a generator fails quietly. A bug here does not throw
 * — it ships two hundred loops that are silent, atonal, or all the same note.
 * One such bug did exactly that: every non-chord tone in the melodies came out
 * as the same repeated root, because a branch was multiplied by zero.
 */

import {
    loopLibrary,
    getLoopById,
    getLoopsByCategory,
    getLoopsByGenre,
    type LoopAsset,
} from '../loopLibrary';

const midiLoops = loopLibrary.filter(l => l.notes?.length);
const sampledLoops = loopLibrary.filter(l => l.path);

/** Standard General MIDI percussion notes. */
const GM_DRUM_MAP = new Set([
    35, 36, 37, 38, 39, 40, 41, 42, 44, 45, 46, 47, 49, 50, 51, 54, 70,
]);

describe('library composition', () => {
    it('is large enough to be worth browsing', () => {
        expect(loopLibrary.length).toBeGreaterThanOrEqual(150);
    });

    it('covers at least six genres', () => {
        const genres = new Set(loopLibrary.map(l => l.genre));
        expect(genres.size).toBeGreaterThanOrEqual(6);
    });

    it('has drums, bass and melodic content in every generated genre', () => {
        const genres = new Set(midiLoops.map(l => l.genre));

        for (const genre of genres) {
            const categories = new Set(
                midiLoops.filter(l => l.genre === genre).map(l => l.category));

            // A genre with no drums, or no bass, is not a usable starting point.
            expect([...categories].sort()).toEqual(['bass', 'drums', 'melodic']);
        }
    });

    it('has unique ids', () => {
        const ids = loopLibrary.map(l => l.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('keeps both sampled and generated loops', () => {
        // The sampled ones are recordings and should not be displaced by
        // synthesised approximations of the same thing.
        expect(sampledLoops.length).toBeGreaterThan(0);
        expect(midiLoops.length).toBeGreaterThan(0);
    });
});

describe('every loop is playable', () => {
    it('has either notes or an audio path, never neither', () => {
        const orphans = loopLibrary.filter(l => !l.notes?.length && !l.path);

        // A loop with no content renders in the browser and does nothing when
        // clicked, which reads as a broken app rather than a missing file.
        expect(orphans.map(l => l.id)).toEqual([]);
    });

    it('declares a positive tempo and length', () => {
        for (const loop of loopLibrary) {
            expect(loop.bpm).toBeGreaterThan(0);
            expect(loop.beats).toBeGreaterThan(0);
            expect(loop.duration).toBeGreaterThan(0);
        }
    });

    it('has a duration consistent with its beats and tempo', () => {
        for (const loop of midiLoops) {
            const expected = (loop.beats * 60) / loop.bpm;
            // The browser shows this; if it disagrees with the note data the
            // loop looks the wrong length before it is even played.
            expect(loop.duration).toBeCloseTo(expected, 4);
        }
    });
});

describe('MIDI note data', () => {
    it('stays inside the MIDI range', () => {
        for (const loop of midiLoops) {
            for (const note of loop.notes!) {
                expect(note.pitch).toBeGreaterThanOrEqual(0);
                expect(note.pitch).toBeLessThanOrEqual(127);
                expect(note.velocity).toBeGreaterThanOrEqual(1);
                expect(note.velocity).toBeLessThanOrEqual(127);
            }
        }
    });

    it('has no zero-length or negatively-positioned notes', () => {
        for (const loop of midiLoops) {
            for (const note of loop.notes!) {
                expect(note.start).toBeGreaterThanOrEqual(0);
                expect(note.duration).toBeGreaterThan(0);
            }
        }
    });

    it('keeps every note inside the loop it belongs to', () => {
        for (const loop of midiLoops) {
            for (const note of loop.notes!) {
                // A note starting past the loop end never sounds, because the
                // clip is trimmed to `beats`.
                expect(note.start).toBeLessThan(loop.beats);
            }
        }
    });

    it('never stacks the same pitch at the same instant', () => {
        for (const loop of midiLoops) {
            const seen = new Set<string>();
            for (const note of loop.notes!) {
                const key = `${note.pitch}@${note.start}`;
                // Two identical notes at one moment double the level and, on a
                // sampler with an exclusive class, choke each other.
                expect(seen.has(key)).toBe(false);
                seen.add(key);
            }
        }
    });
});

describe('drum loops', () => {
    const drumLoops = midiLoops.filter(l => l.drums);

    it('exist', () => {
        expect(drumLoops.length).toBeGreaterThan(10);
    });

    it('only use General MIDI percussion notes', () => {
        for (const loop of drumLoops) {
            for (const note of loop.notes!) {
                // Both the SoundFont's bank-128 kits and the built-in drum
                // machine key off these numbers. Anything else is silence.
                expect(GM_DRUM_MAP.has(note.pitch)).toBe(true);
            }
        }
    });

    it('always includes a kick', () => {
        for (const loop of drumLoops) {
            const hasKick = loop.notes!.some(n => n.pitch === 36 || n.pitch === 35);
            expect(hasKick).toBe(true);
        }
    });

    it('is categorised as drums, not melodic', () => {
        for (const loop of drumLoops) {
            expect(loop.category).toBe('drums');
        }
    });
});

describe('pitched loops', () => {
    const pitched = midiLoops.filter(l => !l.drums);

    it('are not flagged as drums', () => {
        for (const loop of pitched) {
            expect(loop.drums).toBeFalsy();
        }
    });

    it('carry a General MIDI program so the track can pick an instrument', () => {
        for (const loop of pitched) {
            expect(loop.program).toBeGreaterThanOrEqual(0);
            expect(loop.program).toBeLessThanOrEqual(127);
        }
    });

    it('declare a key', () => {
        for (const loop of pitched) {
            expect(loop.key).toBeTruthy();
        }
    });

    it('sit in a sensible register for their role', () => {
        for (const loop of pitched.filter(l => l.category === 'bass')) {
            const highest = Math.max(...loop.notes!.map(n => n.pitch));
            // A "bass" loop up at C5 is mislabelled, and would fight whatever
            // is playing the melody.
            expect(highest).toBeLessThan(72);
        }
    });

    it('use more than one pitch', () => {
        // The bug this exists for: a melody generator that returned the chord
        // root for every non-chord tone produced loops on a single note. They
        // looked fine in the data and were musically useless.
        for (const loop of pitched.filter(l => l.category === 'melodic')) {
            const distinct = new Set(loop.notes!.map(n => n.pitch)).size;
            expect(distinct).toBeGreaterThan(1);
        }
    });
});

describe('lookup helpers', () => {
    it('finds a loop by id', () => {
        const first = loopLibrary[0];
        expect(getLoopById(first.id)).toBe(first);
    });

    it('returns undefined for an unknown id', () => {
        expect(getLoopById('no-such-loop')).toBeUndefined();
    });

    it('filters by category', () => {
        for (const category of ['drums', 'bass', 'melodic'] as LoopAsset['category'][]) {
            const found = getLoopsByCategory(category);
            expect(found.length).toBeGreaterThan(0);
            expect(found.every(l => l.category === category)).toBe(true);
        }
    });

    it('filters by genre, ignoring case', () => {
        const genre = midiLoops[0].genre;
        expect(getLoopsByGenre(genre.toUpperCase()).length).toBeGreaterThan(0);
    });
});
