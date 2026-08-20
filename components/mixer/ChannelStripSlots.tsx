'use client';

/**
 * The slots the Logic channel strip has and ours did not.
 *
 * Working through the mixer chapter's strip diagram, four controls were absent
 * altogether — Channel Mode, Automation Mode, the VCA slot and the track
 * identity row — and two were drawn but inert. Each of these writes real state
 * and is read by something; where a control cannot be made to do its job yet,
 * it says so in its tooltip rather than pretending.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import type { Track } from '@/models/Track';
import { useProjectStore } from '@/store/projectStore';

/* ─── A small menu, portalled so a strip cannot clip it ──────────────────── */

function SlotMenu({ open, anchor, onClose, children }: {
    open: boolean;
    anchor: HTMLElement | null;
    onClose: () => void;
    children: React.ReactNode;
}) {
    const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

    useEffect(() => {
        if (!open || !anchor) { setPos(null); return; }
        const r = anchor.getBoundingClientRect();
        const width = 150;
        const height = 190;
        setPos({
            left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
            // The mixer sits at the bottom of the window, so these almost
            // always open upwards.
            top: r.bottom + height > window.innerHeight ? Math.max(8, r.top - height) : r.bottom + 2,
        });
    }, [open, anchor]);

    useEffect(() => {
        if (!open) return;
        const down = (e: MouseEvent) => {
            const t = e.target as HTMLElement | null;
            if (t?.closest?.('[data-slot-menu]') || (anchor && anchor.contains(t as Node))) return;
            onClose();
        };
        const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('mousedown', down);
        window.addEventListener('keydown', key);
        return () => {
            window.removeEventListener('mousedown', down);
            window.removeEventListener('keydown', key);
        };
    }, [open, anchor, onClose]);

    if (!open || !pos || typeof document === 'undefined') return null;
    return createPortal(
        <div
            data-slot-menu
            role="menu"
            className="fixed z-[7100] w-[150px] py-1 rounded-md bg-studio-raised border border-studio-line-strong shadow-[0_16px_40px_rgba(0,0,0,0.7)]"
            style={{ left: pos.left, top: pos.top }}
        >
            {children}
        </div>,
        document.body,
    );
}

function MenuRow({ label, checked, disabled, title, onSelect }: {
    label: string; checked?: boolean; disabled?: boolean; title?: string; onSelect?: () => void;
}) {
    return (
        <button
            type="button"
            role="menuitem"
            disabled={disabled}
            title={title}
            onClick={onSelect}
            className={`w-full h-6 pl-6 pr-2 flex items-center text-left text-[11px] relative transition-colors ${disabled
                ? 'text-studio-text-dim/40 cursor-default'
                : 'text-studio-text hover:bg-accent-cyan hover:text-black'}`}
        >
            {checked && <Check className="w-3 h-3 absolute left-1.5" strokeWidth={3} />}
            {label}
        </button>
    );
}

/* ─── Channel Mode ──────────────────────────────────────────────────────── */

const MODE_GLYPH: Record<string, string> = {
    mono: '◯', stereo: '◎', left: '◐', right: '◑',
};

/**
 * Mono / stereo / left / right, as the guide's Format button.
 *
 * Click switches between mono and stereo; the menu offers the single-side
 * formats. The level meter follows: one column for anything but stereo, which
 * is the whole reason the button sits next to it.
 */
export function ChannelModeButton({ track }: { track: Track }) {
    const updateTrack = useProjectStore(s => s.updateTrack);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLButtonElement>(null);
    const mode = track.channelMode ?? 'stereo';

    const set = (next: NonNullable<Track['channelMode']>) => {
        updateTrack(track.id, { channelMode: next });
        setOpen(false);
    };

    return (
        <>
            <button
                ref={ref}
                type="button"
                data-channel-mode
                title={`Channel mode: ${mode} — click to switch, hold for all formats`}
                aria-label="Channel mode"
                onClick={(e) => {
                    e.stopPropagation();
                    set(mode === 'stereo' ? 'mono' : 'stereo');
                }}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
                className="h-5 w-7 shrink-0 rounded-sm bg-black/40 border border-studio-line text-[10px] leading-none text-studio-text-mid hover:text-accent-cyan hover:border-accent-cyan/50 transition-colors"
            >
                {MODE_GLYPH[mode]}
            </button>
            <SlotMenu open={open} anchor={ref.current} onClose={() => setOpen(false)}>
                {(['mono', 'stereo', 'left', 'right'] as const).map(m => (
                    <MenuRow key={m} label={m[0].toUpperCase() + m.slice(1)} checked={mode === m} onSelect={() => set(m)} />
                ))}
            </SlotMenu>
        </>
    );
}

/* ─── Automation Mode ───────────────────────────────────────────────────── */

const AUTOMATION_MODES = [
    { id: 'off', label: 'Off', works: true },
    { id: 'read', label: 'Read', works: true },
    { id: 'touch', label: 'Touch', works: false },
    { id: 'latch', label: 'Latch', works: false },
    { id: 'write', label: 'Write', works: false },
] as const;

/**
 * Off / Read / Touch / Latch / Write.
 *
 * The strip showed a fixed green "Read" that was a `<div>` — no menu, no
 * state, nothing read it. Off and Read change playback; the three write modes
 * need automation recording, which does not exist yet, so they are shown
 * disabled with a reason instead of quietly doing nothing.
 */
export function AutomationModeButton({ track }: { track: Track }) {
    const updateTrack = useProjectStore(s => s.updateTrack);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLButtonElement>(null);
    const mode = track.automationMode ?? 'read';
    const current = AUTOMATION_MODES.find(m => m.id === mode) ?? AUTOMATION_MODES[1];

    return (
        <>
            <button
                ref={ref}
                type="button"
                data-automation-mode
                title="Automation mode"
                aria-label="Automation mode"
                onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
                className={`h-6 w-full rounded-sm border text-[9px] font-black uppercase transition-colors ${mode === 'off'
                    ? 'bg-black/60 border-studio-line text-studio-text-dim'
                    : 'bg-black/60 border-accent-cyan/30 text-[#63ed63] hover:border-accent-cyan'}`}
            >
                {current.label}
            </button>
            <SlotMenu open={open} anchor={ref.current} onClose={() => setOpen(false)}>
                {AUTOMATION_MODES.map(m => (
                    <MenuRow
                        key={m.id}
                        label={m.label}
                        checked={mode === m.id}
                        disabled={!m.works}
                        title={m.works ? undefined : 'Needs automation recording, which this DAW does not have yet'}
                        onSelect={() => { updateTrack(track.id, { automationMode: m.id }); setOpen(false); }}
                    />
                ))}
            </SlotMenu>
        </>
    );
}

/* ─── VCA slot ──────────────────────────────────────────────────────────── */

/**
 * Assigns the strip to a VCA fader.
 *
 * The VCA strips existed at the end of the mixer but there was no way to put a
 * track in one from its own strip, which is where the guide puts the control.
 */
export function VcaSlot({ track }: { track: Track }) {
    const vcaFaders = useProjectStore(s => s.vcaFaders);
    const setVcaFaderTracks = useProjectStore(s => s.setVcaFaderTracks);
    const updateTrack = useProjectStore(s => s.updateTrack);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLButtonElement>(null);

    const current = vcaFaders.find(v => v.trackIds.includes(track.id));

    const assign = (vcaId: string | null) => {
        // Membership lives on the VCA, so leaving one means editing that list
        // too — otherwise a track shows in two groups at once.
        vcaFaders.forEach(v => {
            const has = v.trackIds.includes(track.id);
            if (v.id === vcaId && !has) setVcaFaderTracks(v.id, [...v.trackIds, track.id]);
            if (v.id !== vcaId && has) setVcaFaderTracks(v.id, v.trackIds.filter(id => id !== track.id));
        });
        updateTrack(track.id, { vcaId });
        setOpen(false);
    };

    return (
        <>
            <button
                ref={ref}
                type="button"
                data-vca-slot
                title="VCA group"
                aria-label="VCA group"
                onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
                className={`h-5 w-full rounded-sm border text-[8px] font-black uppercase truncate px-1 transition-colors ${current
                    ? 'bg-[#a78bfa]/15 border-[#a78bfa]/50 text-[#a78bfa]'
                    : 'bg-black/40 border-studio-line text-studio-text-dim hover:text-studio-text'}`}
            >
                {current ? current.name : 'No VCA'}
            </button>
            <SlotMenu open={open} anchor={ref.current} onClose={() => setOpen(false)}>
                <MenuRow label="No VCA" checked={!current} onSelect={() => assign(null)} />
                {vcaFaders.length === 0 && (
                    <MenuRow label="No VCA faders yet" disabled title="Create one with + VCA in the mixer" />
                )}
                {vcaFaders.map(v => (
                    <MenuRow key={v.id} label={v.name} checked={current?.id === v.id} onSelect={() => assign(v.id)} />
                ))}
            </SlotMenu>
        </>
    );
}

/* ─── Track identity row ────────────────────────────────────────────────── */

const TYPE_GLYPH: Record<string, string> = {
    audio: '🎙', midi: '🎹', 'software-instrument': '🎹', drummer: '🥁',
    'external-midi': '🎛', bus: '🚌', output: '🔊', folder: '📁', video: '🎬',
};

/**
 * Name, colour, number and icon — the strip's footer.
 *
 * The number was the literal `1` on every strip and the icon was picked from a
 * two-way guess, so neither told you which track you were looking at in a wide
 * mixer. Double-click renames, as the guide describes.
 */
export function TrackNameField({ track, index, isMaster, isSelected }: {
    track: Track | null; index: number; isMaster?: boolean; isSelected: boolean;
}) {
    const updateTrack = useProjectStore(s => s.updateTrack);
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

    const commit = () => {
        setEditing(false);
        const name = text.trim();
        if (track && name) updateTrack(track.id, { name });
    };

    return (
        <div
            className={`h-8 border-t border-black flex items-center px-2 gap-1.5 shrink-0 relative ${isSelected ? 'bg-accent-cyan/20' : 'bg-studio-sunken'}`}
            data-track-name-field
        >
            {isSelected && <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent-cyan shadow-[0_0_10px_rgba(14,165,233,0.8)]" />}

            {/* The track's own colour, so a strip can be found by eye. */}
            <span
                className="w-1 h-4 rounded-full shrink-0"
                style={{ background: isMaster ? 'var(--accent-cyan)' : (track?.color ?? '#888') }}
            />
            <span className="text-[9px] leading-none shrink-0" aria-hidden>
                {isMaster ? '🔊' : (TYPE_GLYPH[track?.type ?? 'audio'] ?? '🎚')}
            </span>

            {editing ? (
                <input
                    ref={inputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') commit();
                        if (e.key === 'Escape') setEditing(false);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Track name"
                    className="flex-1 min-w-0 h-5 px-1 bg-black text-[10px] font-black text-accent-cyan border border-accent-cyan rounded-[2px] outline-none"
                />
            ) : (
                <button
                    type="button"
                    onDoubleClick={(e) => {
                        if (isMaster || !track) return;
                        e.stopPropagation();
                        setText(track.name);
                        setEditing(true);
                    }}
                    title={isMaster ? 'Master' : 'Double-click to rename'}
                    className="flex-1 min-w-0 text-left text-[10px] font-black text-white/90 truncate uppercase tracking-tighter"
                >
                    {isMaster ? 'Master' : (track?.name || 'Track')}
                </button>
            )}

            {/* The real position in the track list, not a hardcoded 1. */}
            <span className="text-[9px] font-black text-studio-text-dim tabular-nums shrink-0">
                {isMaster ? '—' : String(index + 1).padStart(2, '0')}
            </span>
        </div>
    );
}

/* ─── Output-strip extras ───────────────────────────────────────────────── */

/**
 * Bounce and Dim, which the guide puts on output strips only.
 *
 * Bounce renders the mix to a file through the existing export path. Dim drops
 * the monitor level by a fixed amount so you can talk over the mix without
 * losing the fader position — it restores exactly what it took.
 */
export function OutputStripButtons({ dimmed, onToggleDim, onBounce }: {
    dimmed: boolean;
    onToggleDim: () => void;
    onBounce: () => void;
}) {
    return (
        <div className="flex gap-1 w-full px-2">
            <button
                type="button"
                data-bounce-button
                title="Bounce the mix to an audio file"
                aria-label="Bounce"
                onClick={(e) => { e.stopPropagation(); onBounce(); }}
                className="flex-1 h-4 rounded-[2px] border border-studio-line bg-studio-panel text-[8px] font-black text-studio-text-dim hover:text-accent-cyan hover:border-accent-cyan/50 transition-colors"
            >BNC</button>
            <button
                type="button"
                data-dim-button
                title="Dim the monitor level by 20 dB"
                aria-label="Dim"
                aria-pressed={dimmed}
                onClick={(e) => { e.stopPropagation(); onToggleDim(); }}
                className={`flex-1 h-4 rounded-[2px] border text-[8px] font-black transition-colors ${dimmed
                    ? 'bg-accent-cyan/25 border-accent-cyan text-accent-cyan'
                    : 'bg-studio-panel border-studio-line text-studio-text-dim hover:text-studio-text'}`}
            >DIM</button>
        </div>
    );
}
