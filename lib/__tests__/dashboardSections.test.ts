import {
    DASHBOARD_SECTIONS, defaultSection, isSectionAvailable, sectionById,
} from '@/lib/dashboardSections';

/**
 * The sidebar is a promise about what is behind each entry.
 *
 * A `ProjectChooser` with this layout already existed, rendered nowhere, and
 * its content was invented — recents that were nobody's projects, demos under
 * ids that resolved to nothing, and templates unrelated to the ones the app
 * can build. The rule here is that a section either shows something real or
 * carries a reason it cannot.
 */
describe('dashboard sections', () => {
    it('lists the categories in the order the reference shows them', () => {
        expect(DASHBOARD_SECTIONS.map(s => s.id)).toEqual([
            'new', 'recent', 'liveLoops', 'tutorials', 'demos', 'templates', 'account',
        ]);
    });

    it('puts Account after Project Templates, where it was asked for', () => {
        const ids = DASHBOARD_SECTIONS.map(s => s.id);
        expect(ids.indexOf('account')).toBe(ids.indexOf('templates') + 1);
    });

    it('gives every section a label and a heading', () => {
        for (const s of DASHBOARD_SECTIONS) {
            expect(s.label.length).toBeGreaterThan(0);
            expect(s.heading.length).toBeGreaterThan(0);
        }
    });

    it('names a reason for each section that cannot show anything', () => {
        const blocked = DASHBOARD_SECTIONS.filter(s => s.unavailable);
        expect(blocked.map(s => s.id).sort()).toEqual(['demos', 'liveLoops']);
        for (const s of blocked) {
            // A reason, not a shrug: long enough to say what and what instead.
            expect(s.unavailable!.length).toBeGreaterThan(40);
        }
    });

    it('reports availability from that reason', () => {
        expect(isSectionAvailable('templates')).toBe(true);
        expect(isSectionAvailable('demos')).toBe(false);
        expect(isSectionAvailable('liveLoops')).toBe(false);
    });

    it('opens on a section that can show something', () => {
        expect(isSectionAvailable(defaultSection())).toBe(true);
    });

    it('finds a section by id', () => {
        expect(sectionById('account')?.label).toBe('Account');
        expect(sectionById('nope' as never)).toBeUndefined();
    });
});
