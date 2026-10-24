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

/**
 * Heights are what the row's contents actually need, plus room to breathe.
 *
 * They were set tight enough that the Audio FX slot could not show its own
 * chips: three inserts and the add button needed 60-odd pixels in a 46 pixel
 * row, and with nothing clipping the row the names spilled over the Sends slot
 * below. Where a row holds a list, the height is a whole number of items.
 */
const CHIP = 15;

export const STRIP_ROWS: readonly StripRow[] = [
    { key: 'setting', label: 'Setting', height: 30 },
    { key: 'gainReduction', label: 'Gain Reduction', height: 18 },
    { key: 'eq', label: 'EQ', height: 46 },
    { key: 'midiFx', label: 'MIDI FX', height: 22 },
    { key: 'input', label: 'Input', height: 22 },
    // Three inserts and the add button, which is the common case before a
    // chain needs scrolling.
    { key: 'audioFx', label: 'Audio FX', height: CHIP * 4 + 6 },
    { key: 'sends', label: 'Sends', height: CHIP * 3 + 6 },
    { key: 'output', label: 'Output', height: 26 },
    { key: 'group', label: 'Group', height: 26 },
    { key: 'automation', label: 'Automation', height: 22 },
    // The track icon sits in an unlabelled row, as in Logic.
    { key: 'icon', label: '', height: 32 },
    { key: 'pan', label: 'Pan', height: 48 },
    { key: 'vca', label: 'VCA', height: 20 },
    { key: 'db', label: 'dB', height: 20 },
    // Takes the remaining height so the console fills the panel.
    { key: 'fader', label: '', height: null },
    { key: 'recordMonitor', label: '', height: 24 },
    { key: 'muteSolo', label: '', height: 22 },
    { key: 'name', label: '', height: 22 },
] as const;

/** One insert or send chip. Rows sized in whole chips use this. */
export const CHIP_HEIGHT = CHIP;

/** Total of the fixed rows, so the fader row can be given the remainder. */
export const FIXED_ROWS_HEIGHT = STRIP_ROWS.reduce(
    (total, row) => total + (row.height ?? 0), 0,
);

/**
 * Width of one channel strip, and of the legend column beside them.
 *
 * 76 was too narrow for its own contents: the Output slot rendered as
 * "STERE...", the dB field and its peak reading were pushed into each other,
 * and an insert named "Sidechain Comp" could not be read at all. Logic's strip
 * is about this wide for the same reason.
 */
export const STRIP_WIDTH = 104;
/** Wide enough for "Gain Reduction", the longest label in the column. */
export const LEGEND_WIDTH = 104;

/**
 * Shortest the fader row may be squeezed to.
 *
 * Below this the meter stops being readable and the scale printed down the
 * legend no longer lines up with anything useful.
 */
export const MIN_FADER_HEIGHT = 150;

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
    if (isVca) return '#4080c0';
    if (isMaster) return '#808080';
    switch (type) {
        case 'software-instrument':
        case 'midi':
        case 'drummer':
        case 'external-midi':
            return '#2ca05a'; // Logic Pro Instrument Green
        case 'audio':
            return '#2670b8'; // Logic Pro Audio Blue
        case 'bus':
        case 'folder':
            return '#c07820'; // Logic Pro Aux/Bus Amber
        case 'output':
            return '#b03045'; // Logic Pro Output Crimson
        default:
            return '#5a5c60';
    }
}

/** Height of the mixer's own toolbar, above the console. */
export const MIXER_HEADER_HEIGHT = 36;

/** The EBU R128 readout pinned under the console. */
export const MIXER_FOOTER_HEIGHT = 26;

/**
 * Shortest the mixer panel may be.
 *
 * Derived rather than typed in: a hardcoded 640 stopped matching the moment a
 * row height changed, and the fader row — the one that absorbs the slack —
 * silently took the difference. Every fixed band above and below the console
 * counts, including the loudness footer, which the first version of this sum
 * forgot and so left the fader 45px shorter than intended.
 */
export const MIXER_MIN_HEIGHT =
    FIXED_ROWS_HEIGHT + MIN_FADER_HEIGHT + MIXER_HEADER_HEIGHT + MIXER_FOOTER_HEIGHT;
