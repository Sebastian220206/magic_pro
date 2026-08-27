import { subTabsFor, firstSubTab, resolveSubTab, SETTINGS_SUB_TABS } from '../settingsTabs';

describe('Settings sub-tabs', () => {
    it('opens each page on its first sub-tab', () => {
        expect(firstSubTab('Audio')).toBe('Devices');
        expect(firstSubTab('General')).toBe('Project Handling');
        expect(firstSubTab('MIDI')).toBe('General');
    });

    it('gives a page with no sub-tabs one anyway, so the bar is never empty', () => {
        expect(subTabsFor('Recording')).toEqual(['General']);
        expect(firstSubTab('Movie')).toBe('General');
    });

    it('falls back rather than rendering nothing for a stored empty string', () => {
        // Every project persists `''` here, and every panel renders on an exact
        // match — which is what left the Audio page blank.
        expect(resolveSubTab('Audio', '')).toBe('Devices');
        expect(resolveSubTab('Audio', undefined)).toBe('Devices');
    });

    it('does not carry a sub-tab across to a page that has no such tab', () => {
        // "Devices" belongs to Audio; General has no panel for it.
        expect(resolveSubTab('General', 'Devices')).toBe('Project Handling');
        expect(resolveSubTab('View', 'I/O Assignments')).toBe('General');
    });

    it('keeps a sub-tab the page does have', () => {
        expect(resolveSubTab('Audio', 'MP3')).toBe('MP3');
        // Several pages share a sub-tab name; it must not be treated as stale.
        expect(resolveSubTab('Audio', 'General')).toBe('General');
        expect(resolveSubTab('View', 'Mixer')).toBe('Mixer');
    });

    it('lists MP3, which had a panel and no way to reach it', () => {
        expect(SETTINGS_SUB_TABS.Audio).toContain('MP3');
    });

    it('every listed sub-tab is unique within its page', () => {
        for (const [page, tabs] of Object.entries(SETTINGS_SUB_TABS)) {
            expect(new Set(tabs).size).toBe(tabs.length);
            expect(tabs.length).toBeGreaterThan(0);
            expect(page.length).toBeGreaterThan(0);
        }
    });
});
