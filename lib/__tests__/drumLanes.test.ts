import { DRUM_GROUPS, DRUM_LANES, laneForPitch, STEP_RESOLUTIONS } from '../drumLanes';

describe('the drum lane map', () => {
    it('gives every lane a distinct pitch', () => {
        const pitches = DRUM_LANES.map(l => l.pitch);
        expect(new Set(pitches).size).toBe(pitches.length);
    });

    /**
     * Pitches must be real General MIDI percussion notes: the SoundFont bank-128
     * kits and the drum machine both use that map, so a lane labelled "Kick"
     * pointing at the wrong pitch would play something else without erroring.
     */
    it('stays inside the General MIDI percussion range', () => {
        for (const lane of DRUM_LANES) {
            expect(lane.pitch).toBeGreaterThanOrEqual(35);
            expect(lane.pitch).toBeLessThanOrEqual(81);
        }
    });

    it('puts the standard drums on their standard pitches', () => {
        expect(laneForPitch(36)?.name).toBe('Kick 1');
        expect(laneForPitch(38)?.name).toBe('Snare 1');
        expect(laneForPitch(42)?.name).toBe('Hi-Hat Closed');
        expect(laneForPitch(46)?.name).toBe('Hi-Hat Open');
    });

    it('returns nothing for a pitch that is not on the map', () => {
        expect(laneForPitch(60)).toBeUndefined();
    });

    it('flattens the groups in order, marking each group boundary once', () => {
        expect(DRUM_LANES).toHaveLength(DRUM_GROUPS.reduce((n, g) => n + g.lanes.length, 0));
        expect(DRUM_LANES.filter(l => l.startsGroup)).toHaveLength(DRUM_GROUPS.length);
        for (const group of DRUM_GROUPS) {
            const first = DRUM_LANES.find(l => l.groupId === group.id);
            expect(first?.startsGroup).toBe(true);
        }
    });

    it('gives a group one colour, and each group a different one', () => {
        for (const group of DRUM_GROUPS) {
            const colours = new Set(DRUM_LANES.filter(l => l.groupId === group.id).map(l => l.color));
            expect(colours).toEqual(new Set([group.color]));
        }
        expect(new Set(DRUM_GROUPS.map(g => g.color)).size).toBe(DRUM_GROUPS.length);
    });

    it('uses six-digit hex colours, so alpha can be appended', () => {
        // The grid builds washes as `${color}1a`, which only works on #rrggbb.
        for (const g of DRUM_GROUPS) expect(g.color).toMatch(/^#[0-9a-f]{6}$/);
    });
});

describe('step resolutions', () => {
    it('are fractions of a beat, finest last', () => {
        const values = Object.values(STEP_RESOLUTIONS);
        expect(values).toEqual([1, 0.5, 0.25, 0.125]);
    });

    it('divide a 4/4 bar into whole steps', () => {
        for (const beats of Object.values(STEP_RESOLUTIONS)) {
            expect(Number.isInteger(4 / beats)).toBe(true);
        }
    });
});
