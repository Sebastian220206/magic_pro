/**
 * The MIDI effects the mixer's MIDI FX slot offers.
 *
 * All nine process notes. `engine/midi/fx` holds the Arpeggiator, Chord
 * Trigger and Scripter — roughly 1,200 lines that nothing imported — plus the
 * Modifier, Modulator, Note Repeater, Randomizer, Transposer and Velocity
 * Processor written to go with their editors. `engine/midi/fx/chain.ts` is
 * what reaches all of them.
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
    // Driven by the scheduler's `transportTick`, which `store/projectStore.ts`
    // subscribes to. The event was already being emitted and thrown away.
    { id: 'arpeggiator', name: 'Arpeggiator', available: true },
    { id: 'chordTrigger', name: 'Chord Trigger', available: true },
    { id: 'modifier', name: 'Modifier', available: true },
    { id: 'modulator', name: 'Modulator', available: true },
    { id: 'noteRepeater', name: 'Note Repeater', available: true },
    { id: 'randomizer', name: 'Randomizer', available: true },
    { id: 'scripter', name: 'Scripter', available: true },
    { id: 'transposer', name: 'Transposer', available: true },
    { id: 'velocityProcessor', name: 'Velocity Processor', available: true },
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
