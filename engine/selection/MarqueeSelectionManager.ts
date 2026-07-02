import { MarqueeSelection } from '@/store/projectStore';

export interface ExtendedMarqueeSelection extends MarqueeSelection {
    state: 'idle' | 'selecting' | 'expanded';
    ghostSelection?: MarqueeSelection;
}

export function createMarqueeSelection(
    startBeat: number,
    endBeat: number,
    trackIds: string[],
    clipIds: string[],
    laneIds: string[]
): ExtendedMarqueeSelection {
    return {
        id: `marquee-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        startBeat,
        endBeat,
        trackIds,
        clipIds,
        laneIds,
        state: 'selecting'
    };
}

export function mergeMarqueeSelections(
    a: MarqueeSelection,
    b: MarqueeSelection
): { startBeat: number; endBeat: number; trackIds: string[]; clipIds: string[]; laneIds: string[] } {
    return {
        startBeat: Math.min(a.startBeat, b.startBeat),
        endBeat: Math.max(a.endBeat, b.endBeat),
        trackIds: [...new Set([...a.trackIds, ...b.trackIds])],
        clipIds: [...new Set([...a.clipIds, ...b.clipIds])],
        laneIds: [...new Set([...a.laneIds, ...b.laneIds])]
    };
}

export function isBeatInMarqueeRange(selection: MarqueeSelection, beat: number): boolean {
    return beat >= selection.startBeat && beat <= selection.endBeat;
}

export function isClipInMarqueeRange(selection: MarqueeSelection, clipStart: number, clipEnd: number): boolean {
    return clipStart < selection.endBeat && clipEnd > selection.startBeat;
}

export function getMarqueeDuration(selection: MarqueeSelection): number {
    return selection.endBeat - selection.startBeat;
}

export function marqueeSelectionEquals(a: MarqueeSelection | null, b: MarqueeSelection | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    return (
        a.startBeat === b.startBeat &&
        a.endBeat === b.endBeat &&
        a.trackIds.length === b.trackIds.length &&
        a.trackIds.every((id, i) => id === b.trackIds[i]) &&
        a.clipIds.length === b.clipIds.length &&
        a.clipIds.every((id, i) => id === b.clipIds[i])
    );
}
