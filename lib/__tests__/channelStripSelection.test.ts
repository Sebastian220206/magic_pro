/**
 * The Edit menu's channel-strip selection commands.
 *
 * Most of that menu is "select every strip that is …", and each is a filter
 * over the track list. These pin the filters, and — the part that makes the
 * menu match the reference — that a command reports when it would select
 * nothing, so the row can be dimmed the way Logic dims Select Instrument
 * Channel Strips in a project with no instruments.
 */

import {
    selectAll, selectByKind, hasKind, selectMuted, selectSameColor, invertSelection,
    type SelectableTrack,
} from '../channelStripSelection';

const tracks: SelectableTrack[] = [
    { id: 'a1', type: 'audio', color: '#38bdf8' },
    { id: 'a2', type: 'audio', color: '#38bdf8', muted: true },
    { id: 'i1', type: 'software-instrument', color: '#4ade80' },
    { id: 'i2', type: 'drummer', color: '#4ade80' },
    { id: 'm1', type: 'midi', color: '#4ade80' },
    { id: 'x1', type: 'external-midi', color: '#a78bfa' },
    { id: 'b1', type: 'bus', color: '#fbbf24', muted: true },
    { id: 'o1', type: 'output', color: '#ec4899' },
    { id: 's1', type: 'audio', isStack: true, stackType: 'Summing', color: '#fbbf24' },
];

describe('select by kind', () => {
    it('picks audio channels', () => {
        // The summing stack is an audio track too, and belongs here.
        expect(selectByKind(tracks, 'audio')).toEqual(['a1', 'a2', 's1']);
    });

    it('treats software instruments, drummers and MIDI tracks as instruments', () => {
        expect(selectByKind(tracks, 'instrument')).toEqual(['i1', 'i2', 'm1']);
    });

    it('keeps external MIDI separate from instrument channels', () => {
        // An external MIDI track feeds a port, not an instrument channel.
        expect(selectByKind(tracks, 'midi')).toEqual(['x1']);
        expect(selectByKind(tracks, 'instrument')).not.toContain('x1');
    });

    it('picks auxiliaries, outputs and summing stacks', () => {
        expect(selectByKind(tracks, 'auxiliary')).toEqual(['b1']);
        expect(selectByKind(tracks, 'output')).toEqual(['o1']);
        expect(selectByKind(tracks, 'summingStack')).toEqual(['s1']);
    });
});

describe('whether a kind exists', () => {
    it('reports what the project has', () => {
        expect(hasKind(tracks, 'instrument')).toBe(true);
        expect(hasKind(tracks, 'output')).toBe(true);
    });

    it('reports a kind the project lacks, so the row can be dimmed', () => {
        const audioOnly: SelectableTrack[] = [{ id: 'a', type: 'audio' }];
        expect(hasKind(audioOnly, 'instrument')).toBe(false);
        expect(hasKind(audioOnly, 'summingStack')).toBe(false);
        expect(hasKind([], 'audio')).toBe(false);
    });
});

describe('the condition-based commands', () => {
    it('selects muted strips', () => {
        expect(selectMuted(tracks)).toEqual(['a2', 'b1']);
    });

    it('selects strips sharing a colour with the focused one', () => {
        expect(selectSameColor(tracks, 'i1')).toEqual(['i1', 'i2', 'm1']);
    });

    it('selects nothing when there is no strip to take a colour from', () => {
        // Which is why the menu dims the row until something is selected.
        expect(selectSameColor(tracks, null)).toEqual([]);
        expect(selectSameColor(tracks, 'nope')).toEqual([]);
        expect(selectSameColor([{ id: 'x' }], 'x')).toEqual([]);
    });
});

describe('select all and invert', () => {
    it('selects everything', () => {
        expect(selectAll(tracks)).toHaveLength(tracks.length);
    });

    it('inverts a selection', () => {
        expect(invertSelection(tracks, ['a1', 'a2'])).not.toContain('a1');
        expect(invertSelection(tracks, ['a1', 'a2'])).toHaveLength(tracks.length - 2);
    });

    it('inverting nothing selects everything, and back again', () => {
        const all = invertSelection(tracks, []);
        expect(all).toHaveLength(tracks.length);
        expect(invertSelection(tracks, all)).toEqual([]);
    });
});
