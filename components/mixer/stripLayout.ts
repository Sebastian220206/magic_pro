/**
 * The channel strip's row grid.
 *
 * Every strip and the legend column on the left render the *same* rows at the
 * same heights. That is the whole trick behind a console layout: the labels
 * down the left only mean anything if the row they name is at the same height
 * on every strip beside them.
 *
 * An earlier attempt put the slots in a scrolling column, which made alignment
 * impossible and forced the legend to be dropped. Nothing here scrolls; the
 * fader row absorbs whatever height is left over, so the strip fits whatever
 * the mixer has been sized to.
 */

export interface StripRow {
    key: string;
    /** Shown in the legend column. Empty for rows Logic leaves unlabelled. */
    label: string;
    /** Fixed height in pixels, or `null` for the row that takes up the slack. */
    height: number | null;
}

export const STRIP_ROWS: readonly StripRow[] = [
    { key: 'setting', label: 'Setting', height: 28 },
    { key: 'gainReduction', label: 'Gain Reduction', height: 14 },
    { key: 'eq', label: 'EQ', height: 34 },
    { key: 'midiFx', label: 'MIDI FX', height: 18 },
    { key: 'input', label: 'Input', height: 18 },
    { key: 'audioFx', label: 'Audio FX', height: 46 },
    { key: 'sends', label: 'Sends', height: 34 },
    { key: 'output', label: 'Output', height: 24 },
    { key: 'group', label: 'Group', height: 24 },
    { key: 'automation', label: 'Automation', height: 20 },
    // The track icon sits in an unlabelled row, as in Logic.
    { key: 'icon', label: '', height: 26 },
    { key: 'pan', label: 'Pan', height: 42 },
    { key: 'vca', label: 'VCA', height: 18 },
    { key: 'db', label: 'dB', height: 18 },
    // Takes the remaining height so the console fills the panel.
    { key: 'fader', label: '', height: null },
    { key: 'recordMonitor', label: '', height: 22 },
    { key: 'muteSolo', label: '', height: 20 },
    { key: 'name', label: '', height: 20 },
] as const;

/** Total of the fixed rows, so the fader row can be given the remainder. */
export const FIXED_ROWS_HEIGHT = STRIP_ROWS.reduce(
    (total, row) => total + (row.height ?? 0), 0,
);

/** Width of one channel strip, and of the legend column beside them. */
export const STRIP_WIDTH = 76;
export const LEGEND_WIDTH = 92;

/**
 * Fader scale in dB, drawn once down the left of the first strip.
 *
 * Logic prints the marks on the console rather than on each fader, so the
 * numbers are read across the whole row of meters at once.
 */
export const FADER_SCALE = [0, 3, 6, 9, 12, 15, 18, 21, 24, 30, 35, 40, 50, 60] as const;

/**
 * Strip tint by channel type, matching the colours down the bottom of the
 * reference: instruments green, audio blue, aux amber, output pink, master and
 * VCA violet.
 */
export function stripTint(type: string | undefined, isMaster?: boolean, isVca?: boolean): string {
    if (isVca || isMaster) return '#a78bfa';
    switch (type) {
        case 'software-instrument':
        case 'midi':
        case 'drummer':
        case 'external-midi':
            return '#4ade80';
        case 'audio':
            return '#38bdf8';
        case 'bus':
        case 'folder':
            return '#fbbf24';
        case 'output':
            return '#ec4899';
        default:
            return '#94a3b8';
    }
}
