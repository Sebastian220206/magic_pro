import { Clip } from '@/models/Clip';

export interface SplitResult {
    newClips: Clip[];
    modifiedClip: Clip | null;
}

export function splitClipAtBeat(
    clip: Clip,
    splitBeat: number
): SplitResult {
    if (splitBeat <= clip.start || splitBeat >= clip.start + clip.duration) {
        return { newClips: [], modifiedClip: null };
    }

    const leftDuration = splitBeat - clip.start;
    const rightDuration = clip.start + clip.duration - splitBeat;

    // Skip if resulting clip would be too short
    if (leftDuration < 0.01 || rightDuration < 0.01) {
        return { newClips: [], modifiedClip: null };
    }

    const modifiedClip: Clip = {
        ...clip,
        duration: leftDuration
    };

    const rightClip: Clip = {
        ...clip,
        id: `${clip.id}-split-${Date.now()}`,
        start: splitBeat,
        duration: rightDuration,
        name: `${clip.name} (split)`,
        offset: (clip.offset || 0) + leftDuration
    };

    return { newClips: [rightClip], modifiedClip };
}

export function splitClipsAtMarqueeBounds(
    clips: Clip[],
    startBeat: number,
    endBeat: number
): { clipsToAdd: Clip[]; clipsToModify: Clip[] } {
    const clipsToAdd: Clip[] = [];
    const clipsToModify: Clip[] = [];

    clips.forEach(clip => {
        const clipStart = clip.start;
        const clipEnd = clip.start + clip.duration;

        const overlapStart = Math.max(clipStart, startBeat);
        const overlapEnd = Math.min(clipEnd, endBeat);

        if (overlapStart >= overlapEnd) return;

        // Split at the left boundary
        if (overlapStart > clipStart) {
            const leftResult = splitClipAtBeat(clip, overlapStart);
            if (leftResult.modifiedClip) {
                clipsToModify.push(leftResult.modifiedClip);
                clipsToAdd.push(...leftResult.newClips);
            }
        }

        // Split at the right boundary
        const clipRef = overlapStart > clipStart ? clipsToAdd[clipsToAdd.length - 1] : clip;
        if (clipRef && overlapEnd < clipRef.start + clipRef.duration) {
            const rightResult = splitClipAtBeat(clipRef, overlapEnd);
            if (rightResult.modifiedClip) {
                if (overlapStart > clipStart) {
                    // Update the already-modified clip from left split
                    const idx = clipsToModify.findIndex(c => c.id === clip.id);
                    if (idx >= 0) {
                        clipsToModify[idx] = rightResult.modifiedClip;
                    }
                } else {
                    clipsToModify.push(rightResult.modifiedClip);
                }
                clipsToAdd.push(...rightResult.newClips);
            }
        }
    });

    return { clipsToAdd, clipsToModify };
}

export function deleteClipsInRange(
    clips: Clip[],
    startBeat: number,
    endBeat: number,
    trackIds: string[]
): Clip[] {
    return clips.filter(clip => {
        if (!trackIds.includes(clip.trackId)) return true;
        const clipStart = clip.start;
        const clipEnd = clip.start + clip.duration;
        const overlapStart = Math.max(clipStart, startBeat);
        const overlapEnd = Math.min(clipEnd, endBeat);
        return overlapStart >= overlapEnd;
    });
}

export function moveClipsInRange(
    clips: Clip[],
    startBeat: number,
    endBeat: number,
    trackIds: string[],
    offsetBeats: number
): Clip[] {
    return clips.map(clip => {
        if (!trackIds.includes(clip.trackId)) return clip;
        const clipStart = clip.start;
        const clipEnd = clip.start + clip.duration;
        const overlapStart = Math.max(clipStart, startBeat);
        const overlapEnd = Math.min(clipEnd, endBeat);
        if (overlapStart < overlapEnd) {
            return { ...clip, start: clip.start + offsetBeats };
        }
        return clip;
    });
}

export function selectClipsInRange(
    clips: Clip[],
    startBeat: number,
    endBeat: number,
    trackIds: string[]
): string[] {
    return clips
        .filter(clip => {
            if (!trackIds.includes(clip.trackId)) return false;
            const clipEnd = clip.start + clip.duration;
            return clip.start < endBeat && clipEnd > startBeat;
        })
        .map(clip => clip.id);
}

export function selectLanesInRange(
    tracks: { id: string; subTracks?: { id: string }[] }[],
    trackIds: string[]
): string[] {
    return tracks
        .filter(t => trackIds.includes(t.id))
        .flatMap(t => t.subTracks?.map(st => st.id) || []);
}

export function getMarqueeRangeClippedCopy(clips: Clip[], startBeat: number, endBeat: number, trackIds: string[]): Clip[] {
    return clips
        .filter(clip => trackIds.includes(clip.trackId) && clip.start < endBeat && clip.start + clip.duration > startBeat)
        .map(clip => {
            const newStart = Math.max(clip.start, startBeat);
            const newEnd = Math.min(clip.start + clip.duration, endBeat);
            return {
                ...clip,
                id: `${clip.id}-copy-${Date.now()}`,
                start: newStart,
                duration: newEnd - newStart,
                offset: (clip.offset || 0) + (newStart - clip.start)
            };
        });
}

export function deleteTimeInRange(
    clips: Clip[],
    startBeat: number,
    endBeat: number,
    trackIds: string[]
): Clip[] {
    const deletedTime = endBeat - startBeat;
    return clips.map(clip => {
        if (!trackIds.includes(clip.trackId)) return clip;
        const clipEnd = clip.start + clip.duration;
        if (clipEnd <= startBeat) return clip;
        if (clip.start >= endBeat) {
            return { ...clip, start: clip.start - deletedTime };
        }
        if (clip.start >= startBeat && clipEnd <= endBeat) {
            return null;
        }
        if (clip.start >= startBeat) {
            return { ...clip, start: startBeat, duration: clipEnd - endBeat };
        }
        if (clipEnd <= endBeat) {
            return { ...clip, duration: clip.start + clip.duration - startBeat };
        }
        return { ...clip, duration: clip.duration - deletedTime };
    }).filter(Boolean) as Clip[];
}

export function insertTimeAtBeat(
    clips: Clip[],
    atBeat: number,
    duration: number,
    trackIds: string[]
): Clip[] {
    return clips.map(clip => {
        if (!trackIds.includes(clip.trackId)) return clip;
        if (clip.start >= atBeat) {
            return { ...clip, start: clip.start + duration };
        }
        return clip;
    });
}

export function setLoopToMarquee(
    startBeat: number,
    endBeat: number
): { locatorLeft: number; locatorRight: number } {
    return {
        locatorLeft: startBeat,
        locatorRight: endBeat
    };
}

export function playMarqueeRange(
    startBeat: number,
    endBeat: number,
    currentPlayhead: number,
    isPlaying: boolean
): { playhead: number; shouldPlay: boolean } {
    if (currentPlayhead < startBeat || currentPlayhead > endBeat || !isPlaying) {
        return { playhead: startBeat, shouldPlay: true };
    }
    return { playhead: currentPlayhead, shouldPlay: isPlaying };
}
