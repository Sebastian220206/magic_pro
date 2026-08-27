/**
 * Which sub-tabs each Settings page has, and which one it opens on.
 *
 * This lived as a nested ternary inside `PreferencesDialog`, which meant the
 * store — the thing that actually sets `settingsActiveSubTab` — had no way to
 * know that "Audio" starts at "Devices". It defaulted to `''` instead, which
 * matches no panel, so choosing Audio from the menu bar opened a page with a
 * row of sub-tabs above an empty body.
 */

export const SETTINGS_SUB_TABS: Record<string, string[]> = {
    General: ['Project Handling', 'Editing', 'Cycle', 'Catch', 'Notifications', 'Accessibility'],
    Audio: ['Devices', 'General', 'Sampler', 'Editing', 'I/O Assignments', 'File Editor', 'MP3'],
    MIDI: ['General', 'Reset Messages', 'Sync', 'Inputs'],
    'Control Surfaces': ['General', 'Help Tags', 'MIDI Controllers'],
    View: ['General', 'Tracks', 'Mixer', 'Editors'],
};

/** Pages with no sub-tabs still render one, so the bar is never empty. */
const SINGLE = ['General'];

export function subTabsFor(tab: string): string[] {
    return SETTINGS_SUB_TABS[tab] ?? SINGLE;
}

/** The sub-tab a page opens on when none was asked for. */
export function firstSubTab(tab: string): string {
    return subTabsFor(tab)[0];
}

/**
 * The sub-tab to render, given what is stored.
 *
 * Existing projects persist `''`, and a page switch can leave a sub-tab that
 * belongs to the page you came from. Both would render nothing, so both fall
 * back to the page's first sub-tab rather than to a blank body.
 */
export function resolveSubTab(tab: string, stored: string | undefined): string {
    const available = subTabsFor(tab);
    return stored && available.includes(stored) ? stored : available[0];
}
