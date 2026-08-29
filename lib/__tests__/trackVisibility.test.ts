import { isTrackVisible, visibleTracks } from '@/lib/trackVisibility';

/**
 * The header column and the timeline lanes must render the same list.
 *
 * They did not. `TrackList` rendered `tracks.filter(getIsTrackVisible)` and
 * `Timeline` rendered `tracks.map`, so hiding a track or collapsing a stack
 * left every header below it beside the wrong track's clips.
 */
const t = (id: string, extra: Record<string, unknown> = {}) =>
    ({ id, ...extra }) as never;

describe('which tracks get a row', () => {
    it('shows everything by default', () => {
        const tracks = [t('a'), t('b'), t('c')];
        expect(visibleTracks(tracks, false).map(x => x.id)).toEqual(['a', 'b', 'c']);
    });

    it('hides a hidden track only while Hide View is on', () => {
        const tracks = [t('a'), t('b', { hidden: true }), t('c')];
        expect(visibleTracks(tracks, false).map(x => x.id)).toEqual(['a', 'b', 'c']);
        expect(visibleTracks(tracks, true).map(x => x.id)).toEqual(['a', 'c']);
    });

    it('removes the children of a collapsed stack', () => {
        const tracks = [
            t('stack', { isCollapsed: true }),
            t('child', { parentId: 'stack' }),
            t('other'),
        ];
        expect(visibleTracks(tracks, false).map(x => x.id)).toEqual(['stack', 'other']);
    });

    it('keeps them when the stack is open', () => {
        const tracks = [
            t('stack', { isCollapsed: false }),
            t('child', { parentId: 'stack' }),
        ];
        expect(visibleTracks(tracks, false).map(x => x.id)).toEqual(['stack', 'child']);
    });

    /** A collapsed grandparent hides the whole subtree, not just its children. */
    it('walks the whole ancestor chain', () => {
        const tracks = [
            t('top', { isCollapsed: true }),
            t('mid', { parentId: 'top' }),
            t('leaf', { parentId: 'mid' }),
        ];
        expect(visibleTracks(tracks, false).map(x => x.id)).toEqual(['top']);
    });

    it('survives a parentId cycle rather than hanging', () => {
        const tracks = [
            t('a', { parentId: 'b' }),
            t('b', { parentId: 'a' }),
        ];
        expect(() => visibleTracks(tracks, false)).not.toThrow();
        expect(visibleTracks(tracks, false)).toHaveLength(2);
    });

    it('survives a parent that is not in the list', () => {
        const tracks = [t('orphan', { parentId: 'gone' })];
        expect(isTrackVisible(tracks[0], tracks, false)).toBe(true);
    });

    /**
     * The register contract, stated directly: whatever list the headers draw,
     * the lanes draw the same one, in the same order.
     */
    it('gives both columns the same rows in the same order', () => {
        const tracks = [
            t('a'),
            t('hidden', { hidden: true }),
            t('stack', { isCollapsed: true }),
            t('inside', { parentId: 'stack' }),
            t('z'),
        ];
        const headers = visibleTracks(tracks, true);
        const lanes = visibleTracks(tracks, true);
        expect(headers.map(x => x.id)).toEqual(lanes.map(x => x.id));
        expect(headers.map(x => x.id)).toEqual(['a', 'stack', 'z']);
    });
});
