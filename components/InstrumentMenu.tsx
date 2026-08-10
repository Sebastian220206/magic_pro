"use client"

/**
 * Cascading instrument picker.
 *
 * The interaction is the one a Logic user expects: a flat list of categories
 * that open panels to the side, the current choice ticked, and an emphasised
 * action at the top. The styling is the studio's, not Apple's.
 *
 * Submenus flip to the left of their parent when they would otherwise leave
 * the viewport. The menu opens inside an 900px dialog that is itself centred,
 * so a three-deep chain to the right runs out of room on a laptop.
 */

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, ChevronDown } from 'lucide-react';
import {
    buildInstrumentMenu,
    choiceLabel,
    sameChoice,
    type InstrumentChoice,
    type MenuNode,
} from '@/lib/instrumentCatalog';

interface Props {
    value: InstrumentChoice;
    onChange: (choice: InstrumentChoice) => void;
    /** Tint for the focus ring and the selected row, so the menu matches the track. */
    accent?: string;
}

const PANEL =
    'rounded-md border border-studio-line-strong bg-studio-raised/95 backdrop-blur-xl ' +
    'shadow-[0_20px_60px_rgba(0,0,0,0.75)] py-1 overflow-y-auto overflow-x-hidden custom-scrollbar-v';

const ROW =
    'w-full flex items-center gap-2 px-3 py-[5px] text-left text-[12px] leading-tight ' +
    'transition-colors outline-none';

/** A single level. Renders its own children recursively. */
function MenuLevel({
    nodes, value, onPick, accent, depth, maxHeight,
}: {
    nodes: MenuNode[];
    value: InstrumentChoice;
    onPick: (c: InstrumentChoice) => void;
    accent: string;
    depth: number;
    maxHeight: number;
}) {
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    return (
        <div ref={panelRef} className={PANEL} style={{ minWidth: depth === 0 ? 250 : 210, maxHeight }}>
            {nodes.map((node, i) => {
                if (node.kind === 'separator') {
                    return <div key={`sep-${i}`} className="h-px bg-white/10 my-1 mx-2" />;
                }

                if (node.kind === 'item') {
                    const selected = sameChoice(node.choice, value);
                    return (
                        <button
                            key={node.label + i}
                            type="button"
                            onMouseEnter={() => setOpenIndex(null)}
                            onClick={() => onPick(node.choice)}
                            className={`${ROW} ${node.emphasis ? 'font-bold' : 'font-medium'} group`}
                            style={{ color: selected ? accent : 'var(--studio-text)' }}
                            onMouseOver={e => { e.currentTarget.style.backgroundColor = `${accent}22`; }}
                            onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                            <span className="w-3 shrink-0">
                                {selected && <Check className="w-3 h-3" strokeWidth={3.5} />}
                            </span>
                            <span className="truncate">{node.label}</span>
                        </button>
                    );
                }

                return (
                    <SubmenuRow
                        key={node.label + i}
                        node={node}
                        open={openIndex === i}
                        onOpen={() => setOpenIndex(i)}
                        onToggle={() => setOpenIndex(openIndex === i ? null : i)}
                        value={value}
                        onPick={onPick}
                        accent={accent}
                        depth={depth}
                        maxHeight={maxHeight}
                    />
                );
            })}
        </div>
    );
}

/** Width a submenu is assumed to need when deciding which side to open on. */
const SUBMENU_WIDTH = 220;

/**
 * A category row and its submenu.
 *
 * The submenu is portalled to <body> rather than nested inside the row. Its
 * parent panel scrolls, and a scroll container clips on both axes — so a
 * nested submenu was drawn *inside* the parent, on top of the labels it was
 * supposed to sit beside.
 */
function SubmenuRow({
    node, open, onOpen, onToggle, value, onPick, accent, depth, maxHeight,
}: {
    node: Extract<MenuNode, { kind: 'submenu' }>;
    open: boolean;
    onOpen: () => void;
    onToggle: () => void;
    value: InstrumentChoice;
    onPick: (c: InstrumentChoice) => void;
    accent: string;
    depth: number;
    maxHeight: number;
}) {
    const rowRef = useRef<HTMLButtonElement>(null);
    const portalRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

    useLayoutEffect(() => {
        if (!open) { setPos(null); return; }
        const r = rowRef.current?.getBoundingClientRect();
        if (!r) return;
        const flip = r.right + SUBMENU_WIDTH > window.innerWidth - 8;
        setPos({
            left: flip ? Math.max(8, r.left - SUBMENU_WIDTH - 2) : r.right + 2,
            // Align the submenu's first row with the row that opened it.
            top: r.top - 4,
        });
    }, [open]);

    /*
     * Pull the submenu back inside the viewport once its real height is known.
     *
     * A category near the bottom of a long list would otherwise open a panel
     * that starts 40px from the bottom edge and shows one row. Measuring in a
     * layout effect means the correction lands before paint, so there is no
     * visible jump.
     */
    useLayoutEffect(() => {
        if (!open || !pos) return;
        const el = portalRef.current;
        if (!el) return;
        const height = el.getBoundingClientRect().height;
        const maxTop = window.innerHeight - height - 8;
        if (pos.top > maxTop) setPos({ ...pos, top: Math.max(8, maxTop) });
    }, [open, pos]);

    return (
        <>
            <button
                ref={rowRef}
                type="button"
                onMouseEnter={onOpen}
                onFocus={onOpen}
                onClick={onToggle}
                className={`${ROW} font-medium justify-between text-studio-text`}
                style={{ backgroundColor: open ? `${accent}22` : 'transparent' }}
            >
                <span className="flex items-center gap-2 min-w-0">
                    <span className="w-3 shrink-0" />
                    <span className="truncate">{node.label}</span>
                </span>
                <ChevronRight
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ color: open ? accent : 'var(--studio-text-dim)' }}
                />
            </button>

            {open && pos && typeof document !== 'undefined' && createPortal(
                <div ref={portalRef} data-instrument-menu className="fixed z-[7100]" style={{ left: pos.left, top: pos.top }}>
                    <MenuLevel
                        nodes={node.children}
                        value={value}
                        onPick={onPick}
                        accent={accent}
                        depth={depth + 1}
                        maxHeight={Math.min(window.innerHeight - 16, 440)}
                    />
                </div>,
                document.body
            )}
        </>
    );
}

/**
 * Where the root panel sits, in viewport coordinates.
 *
 * Exactly one of `top` / `bottom` is set. Dropping upwards has to be anchored
 * on the panel's bottom edge, since its height is not known until it renders.
 */
interface Anchor { left: number; top?: number; bottom?: number; width: number; maxHeight: number }

export function InstrumentMenu({ value, onChange, accent = '#22d3ee' }: Props) {
    const [open, setOpen] = useState(false);
    const [anchor, setAnchor] = useState<Anchor | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    // The menu is built from static data, so once is enough.
    const nodesRef = useRef<MenuNode[] | null>(null);
    if (nodesRef.current === null) nodesRef.current = buildInstrumentMenu();

    const close = useCallback(() => setOpen(false), []);

    /**
     * Measure the trigger and decide whether the panel hangs below it or above.
     *
     * The panel is portalled to <body>, because the dialog's content area
     * scrolls and would otherwise clip the menu to about four rows — which is
     * exactly what it did before.
     */
    const place = useCallback(() => {
        const el = triggerRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const below = window.innerHeight - r.bottom - 12;
        const above = r.top - 12;
        const dropUp = below < 220 && above > below;
        setAnchor({
            left: r.left,
            ...(dropUp
                ? { bottom: window.innerHeight - r.top + 4 }
                : { top: r.bottom + 4 }),
            width: r.width,
            maxHeight: Math.max(160, dropUp ? above : below),
        });
    }, []);

    useLayoutEffect(() => { if (open) place(); }, [open, place]);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            const t = e.target as Element | null;
            if (t && rootRef.current?.contains(t)) return;
            // Submenus are separate portals, so a single containment check
            // would treat a click on one as a click outside and close the menu
            // on mousedown — before the click could ever reach the item.
            if (t?.closest?.('[data-instrument-menu]')) return;
            close();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.stopPropagation(); close(); }
        };
        document.addEventListener('mousedown', onDown);
        // Capture, so Escape closes the menu without also closing the dialog
        // the menu is sitting in.
        document.addEventListener('keydown', onKey, true);
        // The panel is fixed-positioned, so it has to follow the trigger if
        // anything moves underneath it.
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey, true);
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
        };
    }, [open, close, place]);

    return (
        <div ref={rootRef} className="relative">
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={open}
                className="w-full flex items-center justify-between gap-2 rounded border bg-studio-control px-3 py-1.5 text-[13px] font-bold text-studio-text outline-none transition-colors"
                style={{ borderColor: open ? accent : 'var(--studio-line)' }}
            >
                <span className="truncate">{choiceLabel(value)}</span>
                <span className="rounded p-0.5 shrink-0" style={{ backgroundColor: accent }}>
                    <ChevronDown className="w-3.5 h-3.5 text-[#04070b]" strokeWidth={3} />
                </span>
            </button>

            {open && anchor && typeof document !== 'undefined' && createPortal(
                <div
                    ref={menuRef}
                    data-instrument-menu
                    className="fixed z-[7100]"
                    style={{
                        left: anchor.left,
                        top: anchor.top,
                        bottom: anchor.bottom,
                        minWidth: anchor.width,
                    }}
                >
                    <MenuLevel
                        nodes={nodesRef.current}
                        value={value}
                        onPick={(c) => { onChange(c); close(); }}
                        accent={accent}
                        depth={0}
                        maxHeight={anchor.maxHeight}
                    />
                </div>,
                document.body
            )}
        </div>
    );
}
