/**
 * Which tracks appear in the arrangement.
 *
 * This lived inline in `TrackList`, and `Timeline` did not have it at all: the
 * header column rendered `tracks.filter(getIsTrackVisible)` while the lanes
 * rendered `tracks.map`. So the moment a track was hidden, or a stack was
 * collapsed, header *n* stopped lining up with lane *n* — every header below
 * the hidden one pointed at the wrong track's clips.
 *
 * One definition, used by both, so they cannot disagree.
 */

/** The little a visibility test needs to know about a track. */
export interface VisibilityTrack {
    id: string;
    hidden?: boolean;
    parentId?: string | null;
    isCollapsed?: boolean;
}

/**
 * Whether a track has a row of its own.
 *
 * A collapsed stack does not shorten its children's rows — it removes them, so
 * this walks the whole ancestor chain rather than checking the direct parent.
 * The walk is bounded against a `parentId` cycle, which would otherwise hang
 * the render rather than showing a broken layout.
 */
export function isTrackVisible<T extends VisibilityTrack>(
    track: T,
    tracks: readonly T[],
    hideViewActive: boolean,
): boolean {
    if (hideViewActive && track.hidden) return false;

    const seen = new Set<string>([track.id]);
    let parentId = track.parentId;

    while (parentId) {
        if (seen.has(parentId)) break;
        seen.add(parentId);
        const parent = tracks.find(t => t.id === parentId);
        if (!parent) break;
        if (parent.isCollapsed) return false;
        parentId = parent.parentId;
    }

    return true;
}

/** The tracks that get a row, in order — the list both columns must render. */
export function visibleTracks<T extends VisibilityTrack>(
    tracks: readonly T[],
    hideViewActive: boolean,
): T[] {
    return tracks.filter(t => isTrackVisible(t, tracks, hideViewActive));
}
