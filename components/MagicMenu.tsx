"use client"
import React, { useEffect, useRef, useState } from 'react';
import { useAppMenus } from '@/hooks/useAppMenus';
import { Check, ChevronRight } from 'lucide-react';

/**
 * Every menu, behind the M button.
 *
 * They were a row of names across the title bar — File, Edit, Track … Help —
 * that was collapsed to zero width until the "Magic Pro" title was clicked, so
 * on load the bar read as empty and the menus were unreachable unless you knew
 * to press a word that did not look like a control.
 *
 * Two columns rather than a flyout: the menu names on the left, the entries of
 * whichever is highlighted on the right. A flyout would have to decide which
 * side to open on near the screen edge, and a menu opening off-screen is the
 * failure this is meant to fix.
 */
export function MagicMenu({ anchor, onClose }: {
    /** Where the button that opened this sits, in viewport coordinates. */
    anchor: { left: number; bottom: number } | null;
    onClose: () => void;
}) {
    const menus = useAppMenus();
    const [active, setActive] = useState(0);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        // `mousedown` rather than `click`: the button that opened this is still
        // handling its own click, and a `click` listener would catch it and
        // shut the menu in the same gesture that opened it.
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    const current = menus[active];

    return (
        /*
         * Positioned against the viewport, not against the button.
         *
         * The transport bar it opens from is `overflow-y-hidden`, so an
         * absolutely positioned menu is clipped at the bar's own edge — it
         * rendered as a two-line sliver. Fixed coordinates from the button's
         * rect escape that.
         */
        <div
            ref={ref}
            data-magic-menu
            style={{ top: (anchor?.bottom ?? 0) + 4, left: anchor?.left ?? 0 }}
            className="fixed z-[300] flex rounded-md border border-studio-line-strong bg-studio-raised/97 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden"
        >
            {/* The menus */}
            <div className="w-[132px] py-1 border-r border-black/40 bg-black/20">
                {menus.map((menu, i) => (
                    <button
                        key={menu.name}
                        data-magic-menu-name={menu.name}
                        onMouseEnter={() => setActive(i)}
                        onFocus={() => setActive(i)}
                        className={`w-full text-left px-3 py-1 text-[12px] flex items-center justify-between transition-colors ${i === active
                            ? 'bg-accent-cyan text-[#04070b] font-semibold'
                            : 'text-studio-text hover:bg-white/5'}`}
                    >
                        <span>{menu.name}</span>
                        <ChevronRight className="w-3 h-3 opacity-50" />
                    </button>
                ))}
            </div>

            {/* Its entries */}
            <div className="min-w-[230px] py-1">
                {current?.entries.map((entry, idx) => (
                    entry.separator ? (
                        <div key={idx} className="h-px bg-black/30 my-1 mx-2" />
                    ) : entry.heading ? (
                        /* A readout, not a command — no hover, no "Not built yet". */
                        <div key={idx} data-magic-menu-heading={entry.label}
                            className="px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-studio-text-dim truncate">
                            {entry.label}
                        </div>
                    ) : (
                        <button
                            key={idx}
                            data-magic-menu-item={entry.label}
                            disabled={!entry.action}
                            title={entry.action ? undefined : 'Not built yet'}
                            onClick={() => {
                                if (!entry.action) return;
                                entry.action();
                                onClose();
                            }}
                            className={`w-full text-left px-4 py-1 text-[12px] flex items-center justify-between transition-colors ${entry.action
                                ? 'text-studio-text hover:bg-accent-cyan hover:text-[#04070b]'
                                : 'text-studio-text-dim/40 cursor-default'}`}
                        >
                            <span className="flex items-center gap-2 min-w-0">
                                {entry.checked !== undefined && (
                                    <Check className={`w-3 h-3 shrink-0 ${entry.checked ? 'opacity-100' : 'opacity-0'}`} />
                                )}
                                <span className="truncate">{entry.label}</span>
                            </span>
                            {entry.shortcut && (
                                <span className="text-[10px] opacity-60 ml-8">{entry.shortcut}</span>
                            )}
                        </button>
                    )
                ))}
            </div>
        </div>
    );
}
