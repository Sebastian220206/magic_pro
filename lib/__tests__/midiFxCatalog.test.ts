/**
 * The MIDI FX slot's catalogue.
 *
 * All nine entries process notes: the Arpeggiator, Chord Trigger and
 * Scripter that already existed in `engine/midi/fx`, plus the Modifier,
 * Modulator, Note Repeater, Randomizer, Transposer and Velocity Processor
 * written to go with their editors. `engine/midi/fx/chain.ts` reaches all of
 * them.
 *
 * The list names every effect you would expect to find, so the shape of the
 * menu matches what a Logic user is looking for, but only the entries that can
 * change a note are selectable. Anything else has to carry a reason, which is
 * what these pin: no silent no-ops.
 */

import { MIDI_FX_CATALOG, searchMidiFx, midiFxById } from '../midiFxCatalog';
import { hasProcessor } from '@/engine/midi/fx/chain';

describe('the catalogue', () => {
    it('lists the effects the slot offers, in order', () => {
        expect(MIDI_FX_CATALOG.map(e => e.name)).toEqual([
            'Arpeggiator', 'Chord Trigger', 'Modifier', 'Modulator',
            'Note Repeater', 'Randomizer', 'Scripter', 'Transposer',
            'Velocity Processor',
        ]);
    });

    it('offers every effect that has a processor behind it', () => {
        // All nine are reachable from the slot and change a note.
        for (const id of [
            'arpeggiator', 'chordTrigger', 'modifier', 'modulator',
            'noteRepeater', 'randomizer', 'scripter', 'transposer',
            'velocityProcessor',
        ]) {
            expect(midiFxById(id)?.available).toBe(true);
        }
    });

    it('agrees with the chain about which effects can be built', () => {
        // The catalogue's `available` flag and `hasProcessor` are two claims
        // about the same fact. A menu row that inserts an effect the chain
        // cannot build is the silent no-op this list exists to prevent.
        for (const entry of MIDI_FX_CATALOG) {
            expect(hasProcessor(entry.id)).toBe(entry.available);
        }
    });

    it('gives every unavailable entry a reason', () => {
        // An entry that cannot do its job and does not say why is exactly the
        // decorative control this list exists to avoid.
        for (const entry of MIDI_FX_CATALOG) {
            if (entry.available) continue;
            expect(entry.reason && entry.reason.length > 0).toBe(true);
        }
    });

    it('carries no stale reason on an entry that now works', () => {
        // The Arpeggiator and Scripter each shipped with a reason naming what
        // they were waiting for — a transport clock and a script editor. Both
        // arrived. A reason left behind on a working effect is worse than no
        // reason at all, because the tooltip contradicts the menu.
        for (const entry of MIDI_FX_CATALOG) {
            if (!entry.available) continue;
            expect(entry.reason).toBeUndefined();
        }
    });

    it('has no unavailable entries left', () => {
        // The Modulator and Note Repeater each shipped with a "Not
        // implemented" reason. Both arrived; an unavailable row left behind
        // would be a menu entry that can never be chosen.
        for (const entry of MIDI_FX_CATALOG) {
            expect(entry.available).toBe(true);
        }
    });

    it('has unique ids', () => {
        const ids = MIDI_FX_CATALOG.map(e => e.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('search', () => {
    it('shows everything for an empty query', () => {
        expect(searchMidiFx('')).toHaveLength(MIDI_FX_CATALOG.length);
        expect(searchMidiFx('   ')).toHaveLength(MIDI_FX_CATALOG.length);
    });

    it('matches anywhere in the name, not just the start', () => {
        expect(searchMidiFx('peat').map(e => e.id)).toEqual(['noteRepeater']);
    });

    it('ignores case and spacing', () => {
        expect(searchMidiFx('CHORDTRIGGER').map(e => e.id)).toEqual(['chordTrigger']);
        expect(searchMidiFx('vel proc').map(e => e.id)).toEqual(['velocityProcessor']);
    });

    it('can return several', () => {
        expect(searchMidiFx('mod').map(e => e.id)).toEqual(['modifier', 'modulator']);
    });

    it('returns nothing rather than everything when nothing matches', () => {
        expect(searchMidiFx('reverb')).toHaveLength(0);
    });
});

describe('lookup', () => {
    it('finds an entry by id', () => {
        expect(midiFxById('scripter')?.name).toBe('Scripter');
    });

    it('is undefined for an empty slot', () => {
        expect(midiFxById(null)).toBeUndefined();
        expect(midiFxById(undefined)).toBeUndefined();
        expect(midiFxById('nope')).toBeUndefined();
    });
});
