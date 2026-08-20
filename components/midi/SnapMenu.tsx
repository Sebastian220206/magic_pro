'use client';

/**
 * The piano roll's Snap control: a power toggle, the current grid, and the menu.
 *
 * Modelled on Logic's, which reads as one long list but is really three
 * independent choices — the mode, the note value, and whether notes snap to an
 * absolute gridline or move in relative steps. Ticks mirror that structure so
 * the checks tell you what is actually in force.
 *
 * Portalled to <body>, like the other studio menus: the toolbar it hangs from
 * establishes a stacking context, and no z-index escapes one. Rendered inline,
 * this menu is drawn underneath the grid.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Power, ChevronsUpDown, Check, ChevronRight } from 'lucide-react';
import {
    SNAP_DIVISIONS,
    SNAP_TRIPLETS,
    divisionLabel,
    snapModeLabel,
    type SnapMode,
} from '@/lib/snapGrid';

interface SnapMenuProps {
    snap: boolean;
    mode: SnapMode;
    division: number;
    triplet: boolean;
    relative: boolean;
    onToggleSnap: () => void;
    onSelectMode: (mode: SnapMode) => void;
    onSelectDivision: (division: number, triplet: boolean) => void;
    onSelectRelative: (relative: boolean) => void;
}

const MODES: { mode: SnapMode; label: string; enabled: boolean; note?: string }[] = [
    { mode: 'smart', label: 'Smart', enabled: true },
    { mode: 'bar', label: 'Bar', enabled: true },
    { mode: 'beat', label: 'Beat', enabled: true },
    { mode: 'division', label: 'Division', enabled: true },
    { mode: 'ticks', label: 'Ticks', enabled: true },
    // Frames need a video frame rate the project does not carry. Logic greys
    // this out without a movie too; showing it enabled would snap to something
    // arbitrary and call it frames.
    { mode: 'frames', label: 'Frames', enabled: false, note: 'needs a movie' },
];

const ROW = 'w-full h-[26px] pl-7 pr-3 flex items-center justify-between text-left text-[12px] transition-colors';
const ENABLED = 'text-studio-text hover:bg-accent-cyan hover:text-black';
const DISABLED = 'text-studio-text-dim/50 cursor-default';

function Row({ label, checked, selected, disabled, shortcut, trailing, onSelect, title }: {
    label: string;
    checked?: boolean;
    selected?: boolean;
    disabled?: boolean;
    shortcut?: string;
    trailing?: React.ReactNode;
    onSelect?: () => void;
    title?: string;
}) {
    return (
        <button
            type="button"
            role="menuitem"
            disabled={disabled}
            title={title}
            onClick={disabled ? undefined : onSelect}
            className={`${ROW} relative ${disabled ? DISABLED : ENABLED} ${selected ? 'bg-accent-cyan text-black font-medium' : ''}`}
        >
            {checked && (
                <Check className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2" strokeWidth={3} />
            )}
            <span className="truncate">{label}</span>
            {shortcut && <span className="ml-6 text-[11px] opacity-60 tabular-nums">{shortcut}</span>}
            {trailing}
        </button>
    );
}

const Divider = () => <div className="h-px my-1 bg-studio-line-strong" />;

export function SnapMenu({
    snap, mode, division, triplet, relative,
    onToggleSnap, onSelectMode, onSelectDivision, onSelectRelative,
}: SnapMenuProps) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ left: number; top: number; maxHeight: number } | null>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const place = useCallback(() => {
        const r = triggerRef.current?.getBoundingClientRect();
        if (!r) return;
        const width = 260;
        const margin = 8;
        // Measured, not guessed. The list is long enough that a hardcoded
        // height puts it in the wrong place as soon as a row is added.
        const wanted = menuRef.current?.scrollHeight ?? 0;
        const below = window.innerHeight - r.bottom - margin;
        const above = r.top - margin;
        // Open downwards unless there is genuinely more room the other way.
        const dropUp = wanted > below && above > below;
        const maxHeight = Math.max(160, Math.min(wanted || below, dropUp ? above : below));

        setPos({
            left: Math.max(margin, Math.min(r.left, window.innerWidth - width - margin)),
            top: dropUp ? Math.max(margin, r.top - maxHeight - 4) : r.bottom + 4,
            maxHeight,
        });
    }, []);

    // Twice: once to mount at a rough position, then again now the real height
    // is known. Without the second pass a long menu opens misplaced.
    useLayoutEffect(() => { if (open) place(); }, [open, place]);
    useLayoutEffect(() => {
        if (!open) return;
        const id = requestAnimationFrame(place);
        return () => cancelAnimationFrame(id);
    }, [open, place]);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            const t = e.target as HTMLElement | null;
            if (t?.closest?.('[data-snap-menu]')) return;
            if (triggerRef.current?.contains(t as Node)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        const reposition = () => place();
        window.addEventListener('mousedown', onDown);
        window.addEventListener('keydown', onKey);
        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, true);
        return () => {
            window.removeEventListener('mousedown', onDown);
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', reposition);
            window.removeEventListener('scroll', reposition, true);
        };
    }, [open, place]);

    const pick = (fn: () => void) => () => { fn(); setOpen(false); };
    const label = snapModeLabel({ mode, division, triplet, beatsPerBar: 4 });

    return (
        <div className="flex items-center gap-1.5 text-[11px]" ref={triggerRef}>
            <span className="text-studio-text-dim">Snap:</span>

            {/* The power button toggles snapping without opening the menu, so
                the most common action is one click. */}
            <button
                type="button"
                onClick={onToggleSnap}
                title={snap ? 'Snapping on (⌘G)' : 'Snapping off (⌘G)'}
                aria-pressed={snap}
                aria-label="Snap to Grid"
                className={`w-6 h-[22px] rounded-sm flex items-center justify-center transition-all border ${snap
                    ? 'bg-accent-cyan text-black border-accent-cyan shadow-[0_0_8px_var(--accent-cyan-glow)]'
                    : 'bg-studio-control text-studio-text-dim border-studio-line hover:text-studio-text'}`}
            >
                <Power className="w-3 h-3" strokeWidth={3} />
            </button>

            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                aria-haspopup="menu"
                aria-expanded={open}
                title="Snap grid"
                className={`h-[22px] pl-2.5 pr-1.5 rounded-sm flex items-center gap-2 border transition-colors ${open
                    ? 'bg-studio-raised border-accent-cyan/40 text-studio-text'
                    : 'bg-studio-control border-studio-line text-studio-text hover:border-studio-line-strong'}
                    ${snap ? '' : 'opacity-50'}`}
            >
                <span className="font-medium min-w-[46px] text-left">{label}</span>
                <ChevronsUpDown className="w-3 h-3 text-studio-text-dim" />
            </button>

            {open && pos && typeof document !== 'undefined' && createPortal(
                <div
                    ref={menuRef}
                    data-snap-menu
                    role="menu"
                    aria-label="Snap"
                    // Opaque on purpose: a translucent panel over the grid makes
                    // the ticks unreadable and stops it reading as a menu.
                    className="fixed z-[7100] w-[260px] py-1 rounded-md bg-studio-raised border border-studio-line-strong shadow-[0_20px_50px_rgba(0,0,0,0.75)] overflow-y-auto custom-scrollbar-v"
                    style={{ left: pos.left, top: pos.top, maxHeight: pos.maxHeight }}
                >
                    <Row
                        label="Snap to Grid"
                        checked={snap}
                        shortcut="⌘G"
                        onSelect={pick(onToggleSnap)}
                    />
                    <Divider />

                    {MODES.map(m => (
                        <Row
                            key={m.mode}
                            label={m.label}
                            checked={mode === m.mode}
                            disabled={!m.enabled}
                            title={m.note}
                            onSelect={pick(() => onSelectMode(m.mode))}
                        />
                    ))}
                    <Divider />

                    {SNAP_DIVISIONS.map(d => (
                        <Row
                            key={`straight-${d}`}
                            label={divisionLabel(d)}
                            checked={mode === 'division' && !triplet && division === d}
                            onSelect={pick(() => onSelectDivision(d, false))}
                        />
                    ))}
                    <Divider />

                    {SNAP_TRIPLETS.map(d => (
                        <Row
                            key={`triplet-${d}`}
                            label={divisionLabel(d, true)}
                            checked={mode === 'division' && triplet && division === d}
                            onSelect={pick(() => onSelectDivision(d, true))}
                        />
                    ))}
                    <Divider />

                    {/* Logic borrows the Quantize value here. Ours follows the
                        editor's quantize grid, which is the same idea. */}
                    <Row
                        label="As Time Quantize"
                        onSelect={pick(() => onSelectMode('division'))}
                    />
                    <Divider />

                    <Row
                        label="Snap Notes to Absolute Value"
                        checked={!relative}
                        onSelect={pick(() => onSelectRelative(false))}
                    />
                    <Row
                        label="Snap Notes to Relative Value"
                        checked={relative}
                        onSelect={pick(() => onSelectRelative(true))}
                    />
                    <Divider />

                    {/* Both disabled rather than absent: automation lanes are
                        not editable from the piano roll, so an enabled control
                        here would do nothing. */}
                    <Row
                        label="Snap Automation"
                        disabled
                        title="Automation is edited in the arrange area"
                        trailing={<ChevronRight className="w-3 h-3 opacity-40" />}
                    />
                    <Row
                        label="Automation Snap Offset..."
                        disabled
                        title="Automation is edited in the arrange area"
                    />
                </div>,
                document.body,
            )}
        </div>
    );
}
