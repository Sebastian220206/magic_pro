"use client"
import { useRouter } from 'next/navigation';
import { useProjectStore } from '@/store/projectStore';
import { useProjectFileActions } from './useProjectFileActions';

/**
 * Every menu the app has, and what each entry does.
 *
 * These lived inside `AppMenuBar`, which rendered them as a row of names
 * across the title bar — a row that was collapsed to zero width until the
 * "Magic Pro" title was clicked, so on load the bar looked empty. They are one
 * dropdown off the M button now, and this is the single definition both the
 * menu and anything else that needs it reads.
 */

export interface AppMenuEntry {
    label: string;
    shortcut?: string;
    separator?: boolean;
    action?: () => void;
}

export interface AppMenu {
    /** Shown in the list of menus. */
    name: string;
    entries: AppMenuEntry[];
}

export function useAppMenus(): AppMenu[] {
    const router = useRouter();
    const setShowSettingsDialog = useProjectStore(s => s.setShowSettingsDialog);
    const { commands: fileCommands } = useProjectFileActions();

    const menuDefs: Record<string, AppMenuEntry[]> = {
        logic: [
            { label: "About Magic Pro" },
            { separator: true } as any,
            { label: "Preferences - General...", action: () => setShowSettingsDialog(true, "General") },
            { label: "Preferences - Audio...", action: () => setShowSettingsDialog(true, "Audio") },
            { label: "Preferences - Recording...", action: () => setShowSettingsDialog(true, "Recording") },
            { label: "Preferences - MIDI...", action: () => setShowSettingsDialog(true, "MIDI") },
            { label: "Preferences - Display...", action: () => setShowSettingsDialog(true, "View") },
            { separator: true } as any,
            { label: "Quit Magic Pro" },
        ],
        /*
         * File.
         *
         * Was New, Open, Save, Save As and Export Audio — five labels, none of
         * which carried an action. The commands that do the work were written
         * out inside `ProjectManager`, the Alternatives popover, which made a
         * menu about project alternatives the only route to Export as WAV,
         * Bounce and Close Project. Both render from the same list now.
         */
        File: [
            { label: "New", shortcut: "Cmd+N", action: () => router.push('/dashboard') },
            { label: "Open...", shortcut: "Cmd+O", action: () => router.push('/dashboard') },
            { separator: true } as any,
            ...fileCommands.map(cmd => ({
                label: cmd.label,
                shortcut: cmd.shortcut,
                separator: cmd.separatorBefore,
                action: cmd.run,
            })).flatMap(entry => entry.separator
                ? [{ separator: true } as any, { ...entry, separator: undefined }]
                : [entry]),
        ],
        Edit: [
            { label: "Undo", shortcut: "Cmd+Z" },
            { label: "Redo", shortcut: "Cmd+Shift+Z" },
            { separator: true } as any,
            { label: "Cut", shortcut: "Cmd+X" },
            { label: "Copy", shortcut: "Cmd+C" },
            { label: "Paste", shortcut: "Cmd+V" },
            { label: "Delete", shortcut: "Delete" },
            { separator: true } as any,
            { label: "Select All", shortcut: "Cmd+A" },
        ],
        Track: [
            { label: "New Track...", shortcut: "Cmd+Opt+N" },
            { label: "Duplicate Track", shortcut: "Cmd+D" },
            { label: "Delete Track" },
            { separator: true } as any,
            { label: "Create Track Stack" },
        ],
        Navigate: [
            { label: "Go to Beginning", shortcut: "Return" },
            { label: "Go to End" },
            { label: "Go to Selection", shortcut: "Shift+Return" },
            { label: "Go to Locator" },
        ],
        Record: [
            { label: "Record", shortcut: "R" },
            { label: "Record with Count-In" },
            { label: "Autopunch Record" },
            { label: "Record Replace" },
        ],
        Setting: [
            { label: "General...", action: () => setShowSettingsDialog(true, "General") },
            { label: "Audio...", action: () => setShowSettingsDialog(true, "Audio") },
            { label: "Recording...", action: () => setShowSettingsDialog(true, "Recording") },
            { label: "MIDI...", action: () => setShowSettingsDialog(true, "MIDI") },
            { label: "Display...", action: () => setShowSettingsDialog(true, "View") },
        ],
        Mix: [
            { label: "Show Mixer", shortcut: "Cmd+M" },
            { label: "Show Channel EQ" },
            { label: "Show Dynamics" },
        ],
        View: [
            { label: "Show Editor" },
            { label: "Show Mixer" },
            { label: "Show Toolbar" },
            { separator: true } as any,
            { label: "Full Screen", shortcut: "Ctrl+Cmd+F" },
        ],
        Window: [
            { label: "Minimize", shortcut: "Cmd+M" },
            { label: "Zoom" },
            { separator: true } as any,
            { label: "Cycle Through Windows" },
        ],
        Help: [
            { label: "Logic Pro Help", shortcut: "Cmd+?" },
            { separator: true } as any,
            { label: "Keyboard Shortcuts..." },
            { separator: true } as any,
            { label: "About Magic Pro" },
        ],
    };

    /*
     * "Magic Pro" first, then the ten the title bar used to carry, in the
     * order it carried them. `logic` was reachable only by hovering the
     * "Magic Pro" title, which is the control this dropdown replaces — without
     * it here, About and the Preferences shortcuts would have no home.
     */
    const ORDER = [
        ['Magic Pro', 'logic'],
        ['File', 'File'],
        ['Edit', 'Edit'],
        ['Track', 'Track'],
        ['Navigate', 'Navigate'],
        ['Record', 'Record'],
        ['Setting', 'Setting'],
        ['Mix', 'Mix'],
        ['View', 'View'],
        ['Window', 'Window'],
        ['Help', 'Help'],
    ] as const;

    return ORDER
        .filter(([, key]) => menuDefs[key]?.length)
        .map(([name, key]) => ({ name, entries: menuDefs[key] }));
}
