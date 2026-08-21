'use client';

/**
 * The mixer's Edit, Options and View menus.
 *
 * These were three `<div>`s with a chevron and no click handler — the most
 * visible unfinished thing in the mixer. They now open real menus in the shape
 * of the reference, with checkmarks, shortcuts and separators.
 *
 * A row that cannot do its job is dimmed and carries a reason, and the reasons
 * distinguish "this project has none of those" — the way Logic dims Select
 * Instrument Channel Strips with no instruments — from "we have not built it".
 * Neither ever silently does nothing.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import {
    selectAll, selectByKind, hasKind, selectMuted, selectSameColor, invertSelection,
    type StripKind,
} from '@/lib/channelStripSelection';

export interface MenuItem {
    /** A horizontal rule between groups. */
    separator?: true;
    label?: string;
    shortcut?: string;
    checked?: boolean;
    disabled?: boolean;
    /** Why it is dimmed. Shown as the row's tooltip. */
    reason?: string;
    /** Drawn with a submenu arrow. */
    hasSubmenu?: boolean;
    onSelect?: () => void;
}

const MENU_WIDTH = 300;

/* ─── The dropdown itself ───────────────────────────────────────────────── */

function Dropdown({ label, items, testId }: { label: string; items: MenuItem[]; testId: string }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ left: number; top: number; maxHeight: number } | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const place = useCallback(() => {
        const r = triggerRef.current?.getBoundingClientRect();
        if (!r) return;
        const margin = 8;
        const wanted = menuRef.current?.scrollHeight ?? 420;
        const below = window.innerHeight - r.bottom - margin;
        const above = r.top - margin;
        // The mixer header sits low in the window, so these usually open up.
        const dropUp = wanted > below && above > below;
        const maxHeight = Math.max(200, Math.min(wanted, dropUp ? above : below));
        setPos({
            left: Math.max(margin, Math.min(r.left, window.innerWidth - MENU_WIDTH - margin)),
            top: dropUp ? Math.max(margin, r.top - maxHeight - 4) : r.bottom + 4,
            maxHeight,
        });
    }, []);

    // Twice: once to mount, then again once the real height is known.
    useLayoutEffect(() => { if (open) place(); }, [open, place]);
    useLayoutEffect(() => {
        if (!open) return;
        const id = requestAnimationFrame(place);
        return () => cancelAnimationFrame(id);
    }, [open, place]);

    useEffect(() => {
        if (!open) return;
        const down = (e: MouseEvent) => {
            const t = e.target as HTMLElement | null;
            if (t?.closest?.('[data-mixer-menu]')) return;
            if (triggerRef.current?.contains(t as Node)) return;
            setOpen(false);
        };
        const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('mousedown', down);
        window.addEventListener('keydown', key);
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => {
            window.removeEventListener('mousedown', down);
            window.removeEventListener('keydown', key);
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
        };
    }, [open, place]);

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                data-mixer-menu-trigger={testId}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
                className={`flex items-center gap-1.5 rounded px-2.5 h-7 border transition-all group ${open
                    ? 'bg-studio-control border-[var(--accent-cyan)] shadow-[0_0_8px_var(--accent-cyan-glow)]'
                    : 'bg-studio-void border-[var(--accent-cyan)]/40 hover:border-[var(--accent-cyan)]'}`}
            >
                <span className={`text-[10px] font-black uppercase tracking-tighter ${open ? 'text-[var(--accent-cyan)]' : 'text-studio-text-mid group-hover:text-[var(--accent-cyan)]'}`}>
                    {label}
                </span>
                <ChevronDown className="w-3 h-3 text-studio-text-dim" />
            </button>

            {open && pos && typeof document !== 'undefined' && createPortal(
                <div
                    ref={menuRef}
                    data-mixer-menu={testId}
                    role="menu"
                    aria-label={label}
                    style={{ left: pos.left, top: pos.top, width: MENU_WIDTH, maxHeight: pos.maxHeight }}
                    className="fixed z-[7200] py-1 rounded-lg bg-studio-raised border border-studio-line-strong shadow-[0_20px_50px_rgba(0,0,0,0.75)] overflow-y-auto custom-scrollbar-v"
                >
                    {items.map((item, i) => item.separator ? (
                        <div key={`sep-${i}`} className="h-px my-1 bg-studio-line-strong" />
                    ) : (
                        <button
                            key={item.label}
                            type="button"
                            role="menuitem"
                            disabled={item.disabled}
                            title={item.reason}
                            onClick={() => { item.onSelect?.(); setOpen(false); }}
                            className={`w-full h-[26px] pl-7 pr-3 flex items-center justify-between text-left text-[12px] relative transition-colors ${item.disabled
                                ? 'text-studio-text-dim/40 cursor-default'
                                : 'text-studio-text hover:bg-accent-cyan hover:text-black'}`}
                        >
                            {item.checked && <Check className="w-3 h-3 absolute left-2" strokeWidth={3} />}
                            <span className="truncate">{item.label}</span>
                            <span className="flex items-center gap-1 shrink-0 ml-4">
                                {item.shortcut && (
                                    <span className="text-[11px] opacity-50 tabular-nums">{item.shortcut}</span>
                                )}
                                {item.hasSubmenu && <ChevronRight className="w-3 h-3 opacity-40" />}
                            </span>
                        </button>
                    ))}
                </div>,
                document.body,
            )}
        </>
    );
}

/* ─── The three menus ───────────────────────────────────────────────────── */

export interface MixerViewOptions {
    showLegend: boolean;
    longFaders: boolean;
    autoscrollToSelection: boolean;
    followTrackStacks: boolean;
    sendsOnly: boolean;
}

export function MixerMenus({ view, onView }: {
    view: MixerViewOptions;
    onView: (patch: Partial<MixerViewOptions>) => void;
}) {
    const tracks = useProjectStore(s => s.tracks);
    const selectedTrackIds = useProjectStore(s => s.selectedTrackIds);
    const focusedTrackId = useProjectStore(s => s.focusedTrackId);
    const history = useProjectStore(s => s.history);
    const future = useProjectStore(s => s.future);

    const undo = useProjectStore(s => s.undo);
    const redo = useProjectStore(s => s.redo);
    const deleteTrack = useProjectStore(s => s.deleteTrack);
    const addTrack = useProjectStore(s => s.addTrack);
    const createVcaFader = useProjectStore(s => s.createVcaFader);
    const createTrackStack = useProjectStore(s => s.createTrackStack);
    const saveHistorySnapshot = useProjectStore(s => s.saveHistorySnapshot);

    const selected = selectedTrackIds ?? [];
    const setSelection = (ids: string[]) => useProjectStore.setState({
        selectedTrackIds: ids,
        focusedTrackId: ids[0] ?? null,
    });

    const NOT_BUILT = 'Not built yet';
    const kindRow = (label: string, kind: StripKind): MenuItem => ({
        label,
        // Dimmed when the project has none of that kind, as in the reference.
        disabled: !hasKind(tracks, kind),
        reason: hasKind(tracks, kind) ? undefined : 'This project has none',
        onSelect: () => setSelection(selectByKind(tracks, kind)),
    });

    const edit: MenuItem[] = [
        {
            label: (history?.length ?? 0) > 0 ? 'Undo' : "Can't Undo",
            shortcut: '⌘Z',
            disabled: (history?.length ?? 0) === 0,
            reason: (history?.length ?? 0) === 0 ? 'Nothing to undo' : undefined,
            onSelect: undo,
        },
        {
            label: (future?.length ?? 0) > 0 ? 'Redo' : "Can't Redo",
            shortcut: '⇧⌘Z',
            disabled: (future?.length ?? 0) === 0,
            reason: (future?.length ?? 0) === 0 ? 'Nothing to redo' : undefined,
            onSelect: redo,
        },
        { label: 'Undo History...', disabled: true, reason: NOT_BUILT },
        {
            label: 'Delete Undo History',
            disabled: (history?.length ?? 0) === 0,
            reason: (history?.length ?? 0) === 0 ? 'The history is already empty' : undefined,
            onSelect: () => useProjectStore.setState({ history: [], future: [] }),
        },
        { separator: true },
        // One undo stack covers the whole project, so a separate mixer stack
        // would have nothing to undo that the main one has not already taken.
        { label: 'Mixer Undo', disabled: true, reason: 'The mixer shares the project undo history' },
        { label: 'Mixer Redo', disabled: true, reason: 'The mixer shares the project undo history' },
        { label: 'Undo selected Channel Strips', disabled: true, reason: 'The mixer shares the project undo history' },
        { label: 'Redo selected Channel Strips', disabled: true, reason: 'The mixer shares the project undo history' },
        { label: 'Delete Mixer Undo History', disabled: true, reason: 'The mixer shares the project undo history' },
        { label: 'Include Mixer Undo Steps in Project Undo History', checked: true, disabled: true, reason: 'Always on: there is one undo history' },
        { separator: true },
        { label: 'Cut', shortcut: '⌘X', disabled: true, reason: NOT_BUILT },
        { label: 'Copy', shortcut: '⌘C', disabled: true, reason: NOT_BUILT },
        { label: 'Paste', shortcut: '⌘V', disabled: true, reason: NOT_BUILT },
        {
            label: 'Delete',
            shortcut: '⌫',
            disabled: selected.length === 0,
            reason: selected.length === 0 ? 'Select a channel strip first' : undefined,
            onSelect: () => {
                saveHistorySnapshot();
                selected.forEach(id => deleteTrack(id));
                setSelection([]);
            },
        },
        { separator: true },
        { label: 'Select All', shortcut: '⌘A', onSelect: () => setSelection(selectAll(tracks)) },
        {
            label: 'Deselect All',
            disabled: selected.length === 0,
            reason: selected.length === 0 ? 'Nothing is selected' : undefined,
            onSelect: () => setSelection([]),
        },
        { label: 'Invert Selection', onSelect: () => setSelection(invertSelection(tracks, selected)) },
        kindRow('Select Audio Channel Strips', 'audio'),
        kindRow('Select Instrument Channel Strips', 'instrument'),
        kindRow('Select Summing Stack Channel Strips', 'summingStack'),
        kindRow('Select Auxiliary Channel Strips', 'auxiliary'),
        kindRow('Select Output Channel Strips', 'output'),
        kindRow('Select MIDI Channel Strips', 'midi'),
        { separator: true },
        {
            label: 'Select Same-Colored Channel Strips',
            // Needs a strip to take the colour from.
            disabled: !focusedTrackId,
            reason: focusedTrackId ? undefined : 'Select a channel strip first',
            onSelect: () => setSelection(selectSameColor(tracks, focusedTrackId)),
        },
        {
            label: 'Select Muted Channel Strips',
            disabled: selectMuted(tracks).length === 0,
            reason: selectMuted(tracks).length === 0 ? 'Nothing is muted' : undefined,
            onSelect: () => setSelection(selectMuted(tracks)),
        },
        {
            label: 'Select Channel Strips with Same Panner Type',
            disabled: true,
            // Every strip has the same panner here, so this would select all.
            reason: 'Every strip uses the same panner',
        },
    ];

    const options: MenuItem[] = [
        {
            label: 'Create New Auxiliary Channel Strip',
            shortcut: '⌃N',
            onSelect: () => {
                saveHistorySnapshot();
                addTrack({ name: `Aux ${tracks.filter(t => t.type === 'bus').length + 1}`, type: 'bus', color: '#fbbf24' });
            },
        },
        {
            label: 'Create New VCA for Selected Channel Strips',
            disabled: selected.length === 0,
            reason: selected.length === 0 ? 'Select a channel strip first' : undefined,
            onSelect: () => createVcaFader(`VCA ${1}`, selected),
        },
        { label: 'Create Tracks for Selected Channel Strips', shortcut: '⌃T', disabled: true, reason: 'Every channel strip here already has a track' },
        {
            label: 'Create Track Stack for Selected Channel Strips',
            disabled: selected.length < 2,
            reason: selected.length < 2 ? 'Select two or more channel strips' : undefined,
            onSelect: () => createTrackStack(selected, 'Summing'),
        },
        {
            label: 'Flatten Stack',
            disabled: true,
            reason: NOT_BUILT,
        },
        { label: 'Send All MIDI Mixer Data', disabled: true, reason: 'Needs a control surface to send to' },
        { separator: true },
        { label: 'Enable Groups', shortcut: '⇧G', checked: true, disabled: true, reason: 'Groups are always active' },
        { label: 'I/O Labels...', disabled: true, reason: NOT_BUILT },
    ];

    const viewItems: MenuItem[] = [
        {
            label: view.showLegend ? 'Hide Legend' : 'Show Legend',
            shortcut: '⌥⇧I',
            onSelect: () => onView({ showLegend: !view.showLegend }),
        },
        { label: 'Link Control Surfaces', checked: true, disabled: true, reason: 'No control surface connected' },
        {
            label: 'Autoscroll to Selection',
            checked: view.autoscrollToSelection,
            onSelect: () => onView({ autoscrollToSelection: !view.autoscrollToSelection }),
        },
        { label: 'Scroll To', hasSubmenu: true, disabled: true, reason: NOT_BUILT },
        { separator: true },
        { label: 'Signal Flow Channel Strips', checked: true, disabled: true, reason: 'Always shown' },
        {
            label: 'Channels with Sends only',
            checked: view.sendsOnly,
            onSelect: () => onView({ sendsOnly: !view.sendsOnly }),
        },
        { label: 'Folder Tracks', checked: true, disabled: true, reason: 'Always shown' },
        { label: 'Other Tracks', disabled: true, reason: NOT_BUILT },
        { label: 'All Tracks with Same Channel Strip/Instrument', disabled: true, reason: NOT_BUILT },
        {
            label: 'Follow Track Stacks',
            checked: view.followTrackStacks,
            onSelect: () => onView({ followTrackStacks: !view.followTrackStacks }),
        },
        { label: 'Follow Hide', checked: true, disabled: true, reason: 'Hidden tracks are always hidden here' },
        { separator: true },
        {
            label: 'Long Faders',
            shortcut: '⌃⇧L',
            checked: view.longFaders,
            onSelect: () => onView({ longFaders: !view.longFaders }),
        },
        { label: 'Channel Strip Components', hasSubmenu: true, disabled: true, reason: NOT_BUILT },
        { label: 'MIDI Channel Strip Components', hasSubmenu: true, disabled: true, reason: NOT_BUILT },
        { label: 'Configure Channel Strip Components...', shortcut: '⌥X', disabled: true, reason: NOT_BUILT },
    ];

    return (
        <>
            <Dropdown label="Edit" items={edit} testId="edit" />
            <Dropdown label="Options" items={options} testId="options" />
            <Dropdown label="View" items={viewItems} testId="view" />
        </>
    );
}
