/**
 * The MIDI effects the mixer's MIDI FX slot offers.
 *
 * Three of these are real: `engine/midi/fx` holds working Arpeggiator, Chord
 * Trigger and Scripter processors, roughly 1,200 lines that nothing imported —
 * there was no way to reach them from the app at all. The rest are named here
 * because the slot should show the same list you would expect to find, and
 * each one that cannot do its job yet says why rather than inserting something
 * inert.
 */

export type MidiFxId =
    | 'arpeggiator' | 'chordTrigger' | 'modifier' | 'modulator' | 'noteRepeater'
    | 'randomizer' | 'scripter' | 'transposer' | 'velocityProcessor';

export interface MidiFxEntry {
    id: MidiFxId;
    name: string;
    /** False when choosing it could not change a note yet. */
    available: boolean;
    /** Shown as the row's tooltip when it is not available. */
    reason?: string;
}

export const MIDI_FX_CATALOG: readonly MidiFxEntry[] = [
    {
        id: 'arpeggiator', name: 'Arpeggiator', available: false,
        // The processor is written and tested; it needs a clock tick from the
        // scheduler, which nothing calls yet.
        reason: 'Written, but not yet driven by the transport clock',
    },
    { id: 'chordTrigger', name: 'Chord Trigger', available: true },
    { id: 'modifier', name: 'Modifier', available: false, reason: 'Not implemented' },
    { id: 'modulator', name: 'Modulator', available: false, reason: 'Not implemented' },
    { id: 'noteRepeater', name: 'Note Repeater', available: false, reason: 'Not implemented' },
    { id: 'randomizer', name: 'Randomizer', available: false, reason: 'Not implemented' },
    {
        id: 'scripter', name: 'Scripter', available: false,
        reason: 'Written, but has no script editor yet',
    },
    { id: 'transposer', name: 'Transposer', available: false, reason: 'Not implemented' },
    { id: 'velocityProcessor', name: 'Velocity Processor', available: false, reason: 'Not implemented' },
] as const;

/**
 * Filter the list by what has been typed into the search box.
 *
 * Every whitespace-separated term has to appear somewhere in the name, so
 * "vel proc" finds Velocity Processor. Matching the query as one string would
 * not: the space between the terms is not in the name at that point. The
 * spaces are also stripped from the name so "chordtrigger" still matches.
 */
export function searchMidiFx(query: string): readonly MidiFxEntry[] {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return MIDI_FX_CATALOG;

    return MIDI_FX_CATALOG.filter(entry => {
        const name = entry.name.toLowerCase();
        const squashed = name.replace(/\s+/g, '');
        return terms.every(term => name.includes(term) || squashed.includes(term));
    });
}

/** Look one up by id, for showing the inserted effect on the strip. */
export function midiFxById(id: string | undefined | null): MidiFxEntry | undefined {
    return MIDI_FX_CATALOG.find(entry => entry.id === id);
}
