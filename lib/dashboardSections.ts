/**
 * The dashboard's sidebar, and what is actually behind each entry.
 *
 * A `ProjectChooser` component already existed with this exact layout and was
 * rendered nowhere. Its content was fiction: `recentProjects` held two
 * hardcoded entries ("Neon Sunset", "Acoustic Idea") that were not the user's
 * projects, `demoProjects` listed "Beck - Morning" and
 * "Billie Eilish - Ocean Eyes" under ids no project has, and its six project
 * templates (Hip Hop, Electronic, Songwriter, Orchestral, Multi-Track, Music
 * For Picture) had no relationship to the five templates the app can actually
 * build. Wiring it up would have shipped a screen where most things did
 * nothing and the rest opened projects that do not exist.
 *
 * So each section here declares what backs it, and the two with nothing behind
 * them say so instead of pretending.
 */

export type DashboardSectionId =
    | 'new'
    | 'recent'
    | 'liveLoops'
    | 'tutorials'
    | 'demos'
    | 'templates'
    | 'account';

export interface DashboardSection {
    id: DashboardSectionId;
    label: string;
    /** Heading shown above the content pane. */
    heading: string;
    /**
     * Why this section cannot show anything yet. Present means the entry is
     * dimmed and carries this as its reason — never silently empty.
     */
    unavailable?: string;
}

export const DASHBOARD_SECTIONS: DashboardSection[] = [
    {
        id: 'new',
        label: 'New Project',
        heading: 'Choose a Project',
    },
    {
        id: 'recent',
        label: 'Recent',
        heading: 'Recent Projects',
    },
    {
        id: 'liveLoops',
        label: 'Live Loops Grids',
        heading: 'Live Loops Grids',
        // The grid itself is real and renders in the studio, but a project does
        // not record whether it is a Live Loops project, so there is nothing to
        // list here. Start one from New Project instead.
        unavailable:
            'Projects are not marked as Live Loops yet, so there is nothing to list. ' +
            'Start one from New Project — the grid opens with it.',
    },
    {
        id: 'tutorials',
        label: 'Tutorials',
        heading: 'Tutorials',
    },
    {
        id: 'demos',
        label: 'Demo Projects',
        heading: 'Demo Projects',
        // There are no demo projects. The three that used to be listed were
        // invented, and their ids resolved to nothing.
        unavailable:
            'No demo projects ship with the app yet. The templates under ' +
            'Project Templates are the nearest thing — each one plays as soon as it opens.',
    },
    {
        id: 'templates',
        label: 'Project Templates',
        heading: 'Project Templates',
    },
    {
        id: 'account',
        label: 'Account',
        heading: 'Account',
    },
];

/** Whether a section can show anything. */
export function isSectionAvailable(id: DashboardSectionId): boolean {
    return !DASHBOARD_SECTIONS.find(s => s.id === id)?.unavailable;
}

/** The first section that can actually show something. */
export function defaultSection(): DashboardSectionId {
    return DASHBOARD_SECTIONS.find(s => !s.unavailable)?.id ?? 'new';
}

export function sectionById(id: DashboardSectionId): DashboardSection | undefined {
    return DASHBOARD_SECTIONS.find(s => s.id === id);
}
