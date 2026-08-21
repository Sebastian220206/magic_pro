/**
 * The MIDI FX slot's catalogue.
 *
 * `engine/midi/fx` holds working Arpeggiator, Chord Trigger and Scripter
 * processors — roughly 1,200 lines nothing imported, so there was no way to
 * reach any of them from the app. The slot itself was a dead label.
 *
 * The list names every effect you would expect to find, so the shape of the
 * menu matches what a Logic user is looking for, but only the entries that can
 * change a note are selectable. Anything else has to carry a reason, which is
 * what these pin: no silent no-ops.
 */

import { MIDI_FX_CATALOG, searchMidiFx, midiFxById } from '../midiFxCatalog';

describe('the catalogue', () => {
    it('lists the effects the slot offers, in order', () => {
        expect(MIDI_FX_CATALOG.map(e => e.name)).toEqual([
            'Arpeggiator', 'Chord Trigger', 'Modifier', 'Modulator',
            'Note Repeater', 'Randomizer', 'Scripter', 'Transposer',
            'Velocity Processor',
        ]);
    });

    it('offers Chord Trigger, which is wired end to end', () => {
        expect(midiFxById('chordTrigger')?.available).toBe(true);
    });

    it('gives every unavailable entry a reason', () => {
        // An entry that cannot do its job and does not say why is exactly the
        // decorative control this list exists to avoid.
        for (const entry of MIDI_FX_CATALOG) {
            if (entry.available) continue;
            expect(entry.reason && entry.reason.length > 0).toBe(true);
        }
    });

    it('distinguishes "written but not hosted" from "not implemented"', () => {
        // Arpeggiator and Scripter exist and work; they are waiting on a clock
        // and an editor. Saying "not implemented" would send someone to write
        // code that is already there.
        expect(midiFxById('arpeggiator')?.reason).toMatch(/transport clock/i);
        expect(midiFxById('scripter')?.reason).toMatch(/script editor/i);
        expect(midiFxById('modifier')?.reason).toBe('Not implemented');
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
