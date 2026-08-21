'use client';

/**
 * The Send slot's menu.
 *
 * One slot, one send — which is the shape of Logic's, and why the menu opens
 * with the send's own settings before the bus list. The three tap positions
 * are real: they change where the send comes off the channel, so a pre-fader
 * send genuinely keeps its level while the channel fader moves.
 *
 * The settings above the bus list are dimmed until a bus is chosen, because
 * until then there is nothing to configure — the same reason the reference
 * greys them on an empty slot.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, Search } from 'lucide-react';
import {
    busName as busNumberName, busPages, busesInPage, firstPageBuses, type BusPage,
} from '@/lib/busCatalog';

export type SendPosition = 'postPan' | 'postFader' | 'preFader';

export interface SendBusOption {
    id: string;
    name: string;
    /** Which numbered bus this aux is, when it is one. */
    busNumber?: number;
}

const POSITIONS: { id: SendPosition; label: string }[] = [
    { id: 'postPan', label: 'Post Pan' },
    { id: 'postFader', label: 'Post Fader' },
    { id: 'preFader', label: 'Pre Fader' },
];

const MENU_WIDTH = 220;

export function SendSlotMenu({
    busses, busId, position, level, busName, onPick, onPosition, onRemove, children,
}: {
    busses: readonly SendBusOption[];
    /** The bus this slot sends to, or null for an empty slot. */
    busId: string | null;
    position: SendPosition;
    level: number;
    busName: (id: string) => string;
    /** Chosen by bus number; the caller creates the aux if it does not exist. */
    onPick: (busNumber: number) => void;
    onPosition: (position: SendPosition) => void;
    onRemove: () => void;
    /** The slot face that opens the menu. */
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [showBuses, setShowBuses] = useState(false);
    /** Which paged range is open, or null while the first 32 are showing. */
    const [page, setPage] = useState<BusPage | null>(null);
    const [pos, setPos] = useState<{ left: number; top: number; maxHeight: number } | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const place = useCallback(() => {
        const r = triggerRef.current?.getBoundingClientRect();
        if (!r) return;
        const margin = 8;
        const wanted = menuRef.current?.scrollHeight ?? 260;
        const below = window.innerHeight - r.bottom - margin;
        const above = r.top - margin;
        // A channel strip sits low in the window, so this nearly always opens
        // upwards.
        const dropUp = wanted > below && above > below;
        const maxHeight = Math.max(160, Math.min(wanted, dropUp ? above : below));
        setPos({
            left: Math.max(margin, Math.min(r.left, window.innerWidth - MENU_WIDTH - margin)),
            top: dropUp ? Math.max(margin, r.top - maxHeight - 4) : r.bottom + 4,
            maxHeight,
        });
    }, []);

    useLayoutEffect(() => { if (open) place(); }, [open, place]);
    useLayoutEffect(() => {
        if (!open) return;
        const id = requestAnimationFrame(place);
        return () => cancelAnimationFrame(id);
    }, [open, place, showBuses, query]);

    useEffect(() => {
        if (!open) return;
        // The search field takes focus, as in the reference where the caret is
        // already in the box.
        searchRef.current?.focus();
        const down = (e: MouseEvent) => {
            const t = e.target as HTMLElement | null;
            if (t?.closest?.('[data-send-menu]')) return;
            if (triggerRef.current?.contains(t as Node)) return;
            setOpen(false);
        };
        const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('mousedown', down);
        window.addEventListener('keydown', key);
        return () => {
            window.removeEventListener('mousedown', down);
            window.removeEventListener('keydown', key);
        };
    }, [open]);

    const close = () => { setOpen(false); setQuery(''); setShowBuses(false); setPage(null); };

    /*
     * What each bus row shows: the aux's own name when it has one — a renamed
     * aux keeps its name — and `Bus N` otherwise. `used` marks buses that
     * already have a strip, so the list distinguishes what exists from what
     * would be created by choosing it.
     */
    const auxByNumber = new Map(
        busses.filter(b => b.busNumber !== undefined).map(b => [b.busNumber!, b]),
    );
    const labelFor = (n: number) => auxByNumber.get(n)?.name ?? busNumberName(n);
    const busRow = (n: number) => {
        const aux = auxByNumber.get(n);
        return (
            <button
                key={n}
                type="button"
                role="menuitem"
                data-bus-row={n}
                onClick={() => { onPick(n); close(); }}
                className={`w-full h-[24px] pl-4 pr-2 flex items-center justify-between text-left text-[12px] relative transition-colors ${busId && aux?.id === busId
                    ? 'text-accent-cyan'
                    : 'text-studio-text hover:bg-accent-cyan hover:text-black'}`}
            >
                {busId && aux?.id === busId && <Check className="w-3 h-3 absolute left-0" strokeWidth={3} />}
                <span className="truncate">{labelFor(n)}</span>
                {!aux && <span className="text-[10px] opacity-30 shrink-0 ml-2">new</span>}
            </button>
        );
    };

    const needle = query.trim().toLowerCase();
    // Typing jumps straight to the bus list; there is nothing else to search.
    const busListOpen = showBuses || needle.length > 0;

    const row = (label: string, opts: {
        checked?: boolean; disabled?: boolean; reason?: string;
        submenu?: boolean; onSelect?: () => void;
    } = {}) => (
        <button
            key={label}
            type="button"
            role="menuitem"
            disabled={opts.disabled}
            title={opts.reason}
            onClick={() => { opts.onSelect?.(); if (!opts.submenu) close(); }}
            className={`w-full h-[26px] pl-6 pr-2 flex items-center justify-between text-left text-[12px] relative transition-colors ${opts.disabled
                ? 'text-studio-text-dim/40 cursor-default'
                : 'text-studio-text hover:bg-accent-cyan hover:text-black'}`}
        >
            {opts.checked && <Check className="w-3 h-3 absolute left-1.5" strokeWidth={3} />}
            <span className="truncate">{label}</span>
            {opts.submenu && <ChevronRight className={`w-3 h-3 shrink-0 transition-transform ${busListOpen ? 'rotate-90' : ''}`} />}
        </button>
    );

    const hasSend = !!busId;

    // Matches a bus by its number or by a renamed aux's own name.
    const searchHits = needle
        ? [...firstPageBuses(), ...busPages().flatMap(busesInPage)]
            .filter(n => labelFor(n).toLowerCase().includes(needle))
            .slice(0, 40)
        : [];

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                data-send-slot
                aria-haspopup="menu"
                aria-expanded={open}
                title={hasSend ? `Send to ${busName(busId!)} — ${Math.round(level * 100)}%` : 'No send'}
                onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
                className="w-full h-full"
            >
                {children}
            </button>

            {open && pos && typeof document !== 'undefined' && createPortal(
                <div
                    ref={menuRef}
                    data-send-menu
                    role="menu"
                    aria-label="Send"
                    style={{ left: pos.left, top: pos.top, width: MENU_WIDTH, maxHeight: pos.maxHeight }}
                    className="fixed z-[7200] py-1 rounded-lg bg-studio-raised border border-studio-line-strong shadow-[0_20px_50px_rgba(0,0,0,0.75)] overflow-y-auto custom-scrollbar-v"
                >
                    <div className="px-1.5 pb-1">
                        <div className="flex items-center gap-1.5 h-7 px-2 rounded-md bg-black/50 border border-studio-line">
                            <Search className="w-3 h-3 text-studio-text-dim shrink-0" />
                            <input
                                ref={searchRef}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Enter' && searchHits[0] !== undefined) { onPick(searchHits[0]); close(); }
                                }}
                                placeholder="Search"
                                aria-label="Search buses"
                                className="flex-1 min-w-0 bg-transparent text-[12px] text-studio-text placeholder:text-studio-text-dim outline-none"
                            />
                        </div>
                    </div>

                    {row('Independent Pan', {
                        disabled: true,
                        // Would need a panner of its own in the send path and a
                        // second pan control to drive it.
                        reason: hasSend
                            ? 'Needs a separate pan control for the send'
                            : 'Choose a bus first',
                    })}

                    <div className="h-px my-1 bg-studio-line-strong" />

                    {POSITIONS.map(p => row(p.label, {
                        checked: hasSend && position === p.id,
                        disabled: !hasSend,
                        reason: hasSend ? undefined : 'Choose a bus first',
                        onSelect: () => onPosition(p.id),
                    }))}

                    <div className="h-px my-1 bg-studio-line-strong" />

                    {row('No Send', { checked: !hasSend, onSelect: onRemove })}

                    <div className="h-px my-1 bg-studio-line-strong" />

                    {row('Bus', {
                        submenu: true,
                        onSelect: () => { setShowBuses(v => !v); setPage(null); },
                    })}

                    {busListOpen && (
                        <div className="pl-2">
                            {needle ? (
                                // Searching looks across all of them at once;
                                // paging is only there to keep 256 rows usable.
                                searchHits.length === 0 ? (
                                    <div className="h-[26px] pl-4 flex items-center text-[12px] text-studio-text-dim/50">
                                        No matching bus
                                    </div>
                                ) : searchHits.map(busRow)
                            ) : page ? (
                                <>
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => setPage(null)}
                                        className="w-full h-[24px] pl-4 pr-2 flex items-center text-left text-[12px] text-studio-text-dim hover:text-accent-cyan"
                                    >
                                        <ChevronRight className="w-3 h-3 rotate-180 mr-1" />
                                        Back
                                    </button>
                                    {busesInPage(page).map(busRow)}
                                </>
                            ) : (
                                <>
                                    {firstPageBuses().map(busRow)}
                                    <div className="h-px my-1 bg-studio-line-strong" />
                                    {busPages().map(p => (
                                        <button
                                            key={p.label}
                                            type="button"
                                            role="menuitem"
                                            data-bus-page={p.label}
                                            onClick={() => setPage(p)}
                                            className="w-full h-[24px] pl-4 pr-2 flex items-center justify-between text-left text-[12px] text-studio-text hover:bg-accent-cyan hover:text-black transition-colors"
                                        >
                                            <span>{p.label}</span>
                                            <ChevronRight className="w-3 h-3 shrink-0" />
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>,
                document.body,
            )}
        </>
    );
}
