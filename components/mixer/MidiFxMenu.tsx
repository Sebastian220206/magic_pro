'use client';

/**
 * The MIDI FX slot's menu.
 *
 * A search field, the effects, then Record MIDI to Track Here below a rule —
 * the same shape as Logic's. Portalled to <body>, because the slot lives
 * inside a channel strip and a menu rendered in place would be clipped by it.
 *
 * The list shows every effect you would expect to find, but only the ones that
 * can actually change a note are selectable. `engine/midi/fx` holds working
 * Arpeggiator, Chord Trigger and Scripter processors that nothing imported, so
 * this menu is the first way to reach any of them.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Check } from 'lucide-react';
import { searchMidiFx, midiFxById, type MidiFxId } from '@/lib/midiFxCatalog';

interface MidiFxMenuProps {
    /** Currently inserted effect, or null for an empty slot. */
    inserted: MidiFxId | null;
    /** Whether the track records the effect output rather than what was played. */
    recordOutput: boolean;
    onSelect: (id: MidiFxId | null) => void;
    onToggleRecordOutput: () => void;
    disabled?: boolean;
}

const MENU_WIDTH = 236;

export function MidiFxMenu({
    inserted, recordOutput, onSelect, onToggleRecordOutput, disabled,
}: MidiFxMenuProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [pos, setPos] = useState<{ left: number; top: number; maxHeight: number } | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const place = useCallback(() => {
        const r = triggerRef.current?.getBoundingClientRect();
        if (!r) return;
        const margin = 8;
        const wanted = menuRef.current?.scrollHeight ?? 340;
        const below = window.innerHeight - r.bottom - margin;
        const above = r.top - margin;
        // The mixer sits at the bottom of the window, so this nearly always
        // opens upwards.
        const dropUp = wanted > below && above > below;
        const maxHeight = Math.max(180, Math.min(wanted, dropUp ? above : below));
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
        searchRef.current?.focus();
        const down = (e: MouseEvent) => {
            const t = e.target as HTMLElement | null;
            if (t?.closest?.('[data-midi-fx-menu]')) return;
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

    const results = searchMidiFx(query);
    const current = midiFxById(inserted);

    const choose = (id: MidiFxId | null) => {
        onSelect(id);
        setOpen(false);
        setQuery('');
    };

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                data-midi-fx-slot
                disabled={disabled}
                title={current ? `MIDI FX: ${current.name}` : 'Insert a MIDI effect'}
                aria-label="MIDI FX slot"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
                className={`h-full w-full rounded-[2px] border flex items-center justify-center px-1 text-[8px] font-black uppercase truncate transition-colors ${disabled
                    ? 'bg-black/30 border-white/5 text-studio-text-dim/40 cursor-default'
                    : current
                        ? 'bg-[#c084fc]/20 border-[#c084fc]/60 text-[#c084fc] hover:border-[#c084fc]'
                        : 'bg-black/40 border-white/5 text-studio-text-dim hover:text-studio-text hover:border-studio-line'}`}
            >
                {current ? current.name : 'MIDI FX'}
            </button>

            {open && pos && typeof document !== 'undefined' && createPortal(
                <div
                    ref={menuRef}
                    data-midi-fx-menu
                    role="menu"
                    aria-label="MIDI FX"
                    style={{ left: pos.left, top: pos.top, width: MENU_WIDTH, maxHeight: pos.maxHeight }}
                    className="fixed z-[7100] rounded-lg bg-studio-raised border border-studio-line-strong shadow-[0_20px_50px_rgba(0,0,0,0.75)] overflow-hidden flex flex-col"
                >
                    {/* Search */}
                    <div className="p-2 shrink-0">
                        <div className="h-7 flex items-center gap-2 px-2 rounded-md bg-studio-sunken border border-studio-line focus-within:border-accent-cyan transition-colors">
                            <Search className="w-3.5 h-3.5 text-studio-text-dim shrink-0" />
                            <input
                                ref={searchRef}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    e.stopPropagation();
                                    // Enter takes the first result that can be used.
                                    if (e.key === 'Enter') {
                                        const first = results.find(r => r.available);
                                        if (first) choose(first.id);
                                    }
                                }}
                                placeholder="Search"
                                aria-label="Search MIDI effects"
                                className="flex-1 min-w-0 bg-transparent text-[12px] text-studio-text placeholder:text-studio-text-dim outline-none"
                            />
                        </div>
                    </div>

                    {/* Effects */}
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar-v pb-1">
                        {results.length === 0 && (
                            <div className="px-4 py-3 text-[12px] text-studio-text-dim">No effects match.</div>
                        )}
                        {results.map(entry => (
                            <button
                                key={entry.id}
                                type="button"
                                role="menuitem"
                                disabled={!entry.available}
                                title={entry.reason}
                                onClick={() => choose(entry.id === inserted ? null : entry.id)}
                                className={`w-full h-8 pl-8 pr-3 flex items-center justify-between text-left text-[13px] relative transition-colors ${entry.available
                                    ? 'text-studio-text hover:bg-accent-cyan hover:text-black'
                                    : 'text-studio-text-dim/45 cursor-default'}`}
                            >
                                {inserted === entry.id && (
                                    <Check className="w-3.5 h-3.5 absolute left-2.5" strokeWidth={3} />
                                )}
                                <span className="truncate">{entry.name}</span>
                            </button>
                        ))}
                    </div>

                    {/* Record MIDI to Track Here — whether the track records what
                        the effect produced or what was actually played. */}
                    <div className="shrink-0 border-t border-studio-line-strong">
                        <button
                            type="button"
                            role="menuitemcheckbox"
                            aria-checked={recordOutput}
                            data-record-midi-here
                            title="Record what this effect produces, rather than the notes you played"
                            onClick={() => { onToggleRecordOutput(); setOpen(false); }}
                            className="w-full h-9 pl-8 pr-3 flex items-center text-left text-[13px] relative text-studio-text hover:bg-accent-cyan hover:text-black transition-colors"
                        >
                            {recordOutput && <Check className="w-3.5 h-3.5 absolute left-2.5" strokeWidth={3} />}
                            Record MIDI to Track Here
                        </button>
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
}
