/**
 * The Edit menu's channel-strip selection commands.
 *
 * Most of that menu is "select every strip that is …", and each one is a plain
 * filter over the track list. Keeping them here means the menu is a thin list
 * of labels over tested functions, and — the part that matters for matching
 * the reference — a command can be greyed out when it would select nothing,
 * the way Logic dims "Select Instrument Channel Strips" in a project with no
 * instruments.
 */

export interface SelectableTrack {
    id: string;
    type?: string;
    muted?: boolean;
    soloed?: boolean;
    color?: string;
    isStack?: boolean;
    stackType?: string;
    parentId?: string;
}

export type StripKind = 'audio' | 'instrument' | 'summingStack' | 'auxiliary' | 'output' | 'midi';

const KIND_MATCHERS: Record<StripKind, (t: SelectableTrack) => boolean> = {
    audio: t => t.type === 'audio',
    // A software instrument, a drummer and a plain MIDI track all feed an
    // instrument channel; an external MIDI track does not, it feeds a port.
    instrument: t => t.type === 'software-instrument' || t.type === 'midi' || t.type === 'drummer',
    summingStack: t => !!t.isStack && t.stackType === 'Summing',
    auxiliary: t => t.type === 'bus',
    output: t => t.type === 'output',
    midi: t => t.type === 'external-midi',
};

/** Ids of every strip of one kind. */
export function selectByKind(tracks: readonly SelectableTrack[], kind: StripKind): string[] {
    return tracks.filter(KIND_MATCHERS[kind]).map(t => t.id);
}

/** Whether a kind exists at all, so the menu row can be dimmed when it does not. */
export function hasKind(tracks: readonly SelectableTrack[], kind: StripKind): boolean {
    return tracks.some(KIND_MATCHERS[kind]);
}

/** Ids of every muted strip. */
export function selectMuted(tracks: readonly SelectableTrack[]): string[] {
    return tracks.filter(t => t.muted).map(t => t.id);
}

/**
 * Ids of every strip sharing the reference strip's colour.
 *
 * Needs one strip selected to take the colour from, which is why Logic dims
 * this command until something is selected.
 */
export function selectSameColor(
    tracks: readonly SelectableTrack[],
    referenceId: string | null | undefined,
): string[] {
    const reference = tracks.find(t => t.id === referenceId);
    if (!reference?.color) return [];
    return tracks.filter(t => t.color === reference.color).map(t => t.id);
}

/** Everything that is not currently selected. */
export function invertSelection(
    tracks: readonly SelectableTrack[],
    selected: readonly string[],
): string[] {
    const current = new Set(selected);
    return tracks.filter(t => !current.has(t.id)).map(t => t.id);
}

/** Every strip, for Select All. */
export function selectAll(tracks: readonly SelectableTrack[]): string[] {
    return tracks.map(t => t.id);
}
