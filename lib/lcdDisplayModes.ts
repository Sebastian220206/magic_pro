/**
 * The transport display's modes, in one place.
 *
 * The list was written out three times — the store's union, the LCD's own menu
 * buttons, and a `<select>` in the control bar customiser — and it had already
 * drifted. The customiser offered "Beats & Project (Large)" and
 * "Beats & Time (Large)", neither of which is in the union; choosing either
 * passed an unhandled string through `as any` into the store, and the display
 * fell through to its `default` branch. Two menu entries that silently did
 * something other than what they said.
 */

export const LCD_DISPLAY_MODES = [
    'Beats & Project',
    'Beats & Time',
    'Beats',
    'Time',
    'Timecode',
    'Custom',
] as const;

export type LcdDisplayMode = typeof LCD_DISPLAY_MODES[number];

export const DEFAULT_LCD_DISPLAY_MODE: LcdDisplayMode = 'Beats & Project';

/**
 * Whether a value names a mode this app has.
 *
 * Worth checking on the way in: projects saved before this list was corrected
 * still hold "Beats & Project (Large)" on disk.
 */
export function isLcdDisplayMode(value: unknown): value is LcdDisplayMode {
    return typeof value === 'string' && (LCD_DISPLAY_MODES as readonly string[]).includes(value);
}

/** The stored mode, or the default when it is one of the retired spellings. */
export function resolveLcdDisplayMode(value: unknown): LcdDisplayMode {
    return isLcdDisplayMode(value) ? value : DEFAULT_LCD_DISPLAY_MODE;
}
