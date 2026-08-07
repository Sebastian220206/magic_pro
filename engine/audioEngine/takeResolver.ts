/**
 * takeResolver.ts
 * Resolves take folders and comps to the audio that should actually play.
 *
 * A take folder is a clip containing several recorded takes. Playback has to
 * choose between them: either the selected take, or — when the user has comped
 * — a sequence of sections drawn from different takes.
 *
 * Nothing previously performed this resolution, so the scheduler tried to play
 * the folder itself. A folder carries no audio of its own, so take folders were
 * silent and comping had no effect.
 */

export interface ResolvableClip {
    id: string;
    trackId: string;
    type: string;
    start?: number;
    startBeat?: number;
    duration: number;
    muted?: boolean;
    sampleId?: string;
    fileUrl?: string;
    storageKey?: string;
    notes?: unknown[];

    isTakeFolder?: boolean;
    takes?: ResolvableClip[];
    activeTakeIndex?: number;
    comps?: { id: string; name: string; takeIndex: number }[];
    activeCompId?: string;
}

const beatOf = (clip: ResolvableClip) => clip.startBeat ?? clip.start ?? 0;

/**
 * Which take a folder should play.
 *
 * An active comp names a take explicitly; otherwise the selected take index is
 * used, falling back to the first.
 */
export function activeTakeOf(clip: ResolvableClip): ResolvableClip | null {
    if (!clip.isTakeFolder) return null;
    const takes = clip.takes ?? [];
    if (takes.length === 0) return null;

    if (clip.activeCompId) {
        const comp = clip.comps?.find(c => c.id === clip.activeCompId);
        if (comp && takes[comp.takeIndex]) return takes[comp.takeIndex];
    }

    const index = clip.activeTakeIndex ?? 0;
    return takes[index] ?? takes[0];
}

/**
 * Flatten a clip into what should be scheduled.
 *
 * A plain clip resolves to itself. A take folder resolves to its chosen take,
 * repositioned onto the folder's slot on the timeline so the take's own
 * recorded position does not shift playback.
 */
export function resolveClipForPlayback(clip: ResolvableClip): ResolvableClip | null {
    if (clip.muted) return null;
    if (!clip.isTakeFolder) return clip;

    const take = activeTakeOf(clip);
    if (!take) return null;

    return {
        ...take,
        // Keep the take's media, but the folder's placement and identity, so
        // scheduling and dedupe keys stay tied to the timeline slot.
        id: clip.id,
        trackId: clip.trackId,
        start: beatOf(clip),
        startBeat: beatOf(clip),
        duration: Math.min(take.duration, clip.duration) || clip.duration,
        isTakeFolder: false,
        takes: undefined,
        muted: false,
    };
}

/** Resolve a whole clip list, dropping anything that cannot play. */
export function resolveClipsForPlayback(clips: ResolvableClip[]): ResolvableClip[] {
    const resolved: ResolvableClip[] = [];
    for (const clip of clips) {
        const result = resolveClipForPlayback(clip);
        if (result) resolved.push(result);
    }
    return resolved;
}
