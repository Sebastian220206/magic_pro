/**
 * The drum lanes the step sequencer shows, and how they are coloured.
 *
 * Pitches are General MIDI percussion, which is the map the SoundFont bank-128
 * kits and the built-in drum machine both already use — so a step written here
 * plays the sound its label promises, on either engine.
 *
 * Lanes are grouped, and a group shares one hue. Reading a 16x14 grid depends
 * far more on telling kick from hat at a glance than on every row being
 * individually identifiable.
 */

export interface DrumGroup {
    id: string;
    label: string;
    /** Neon palette hue for the whole group. */
    color: string;
    lanes: { pitch: number; name: string }[];
}

export const DRUM_GROUPS: DrumGroup[] = [
    {
        id: 'kick',
        label: 'Kick',
        color: '#ec4899',
        lanes: [
            { pitch: 36, name: 'Kick 1' },
            { pitch: 35, name: 'Kick 2' },
        ],
    },
    {
        id: 'snare',
        label: 'Snare',
        color: '#fb923c',
        lanes: [
            { pitch: 38, name: 'Snare 1' },
            { pitch: 40, name: 'Snare 2' },
            { pitch: 37, name: 'Rim' },
        ],
    },
    {
        id: 'clap',
        label: 'Clap',
        color: '#a78bfa',
        lanes: [
            { pitch: 39, name: 'Clap' },
            { pitch: 54, name: 'Tambourine' },
        ],
    },
    {
        id: 'hat',
        label: 'Hi-Hat',
        color: '#22d3ee',
        lanes: [
            { pitch: 42, name: 'Hi-Hat Closed' },
            { pitch: 44, name: 'Hi-Hat Pedal' },
            { pitch: 46, name: 'Hi-Hat Open' },
        ],
    },
    {
        id: 'tom',
        label: 'Toms',
        color: '#4ade80',
        lanes: [
            { pitch: 50, name: 'Tom High' },
            { pitch: 47, name: 'Tom Mid' },
            { pitch: 43, name: 'Tom Low' },
        ],
    },
    {
        id: 'cymbal',
        label: 'Cymbals',
        color: '#e879f9',
        lanes: [
            { pitch: 49, name: 'Crash' },
            { pitch: 51, name: 'Ride' },
        ],
    },
    {
        id: 'perc',
        label: 'Percussion',
        color: '#fbbf24',
        lanes: [
            { pitch: 56, name: 'Cowbell' },
            { pitch: 75, name: 'Claves' },
        ],
    },
];

export interface DrumLane {
    pitch: number;
    name: string;
    color: string;
    groupId: string;
    /** True on the first lane of a group, so the grid can rule a line above it. */
    startsGroup: boolean;
}

/** The groups flattened into the row order the sequencer draws. */
export const DRUM_LANES: DrumLane[] = DRUM_GROUPS.flatMap(group =>
    group.lanes.map((lane, i) => ({
        pitch: lane.pitch,
        name: lane.name,
        color: group.color,
        groupId: group.id,
        startsGroup: i === 0,
    }))
);

/** Lane for a pitch, or undefined if that pitch is not on the drum map. */
export function laneForPitch(pitch: number): DrumLane | undefined {
    return DRUM_LANES.find(l => l.pitch === pitch);
}

/** Step resolutions the grid offers, as a fraction of a beat. */
export const STEP_RESOLUTIONS = {
    '1/4': 1,
    '1/8': 0.5,
    '1/16': 0.25,
    '1/32': 0.125,
} as const;

export type StepResolution = keyof typeof STEP_RESOLUTIONS;
