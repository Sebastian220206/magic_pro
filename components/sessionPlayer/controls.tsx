"use client"

/**
 * The controls every Session Player panel is built from.
 *
 * They lived inside `SessionPlayer.tsx` while there was one player. There are
 * three now — Drummer, Bass Player, Keyboard Player — and each has its own
 * Main and Details panels, so a second and third copy of a knob is exactly the
 * kind of drift this codebase keeps having to undo.
 */
import React, { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Lock, Unlock } from 'lucide-react'

/**
 * A menu or picker that opens upward, out of the panel.
 *
 * The editor is the bottom of the window, so these open upward — and an
 * absolutely positioned child opening upward is painted under the timeline
 * whatever its z-index, because an ancestor establishes the stacking context.
 * Fixed coordinates off the trigger escape that.
 */
export function Popover({ open, anchorRef, width, onClose, children, ...rest }: {
    open: boolean
    anchorRef: React.RefObject<HTMLElement | null>
    width: number
    onClose: () => void
    children: React.ReactNode
} & Record<string, unknown>) {
    const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
    const boxRef = useRef<HTMLDivElement>(null)

    useLayoutEffect(() => {
        if (!open) { setPos(null); return }
        const r = anchorRef.current?.getBoundingClientRect()
        if (!r) return
        const height = boxRef.current?.offsetHeight ?? 260
        setPos({
            left: Math.max(8, Math.min(window.innerWidth - width - 8, r.left - 8)),
            top: Math.max(8, r.top - height - 8),
        })
    }, [open, anchorRef, width])

    useLayoutEffect(() => {
        if (!open) return
        const away = (e: MouseEvent) => {
            if (boxRef.current?.contains(e.target as Node)) return
            if (anchorRef.current?.contains(e.target as Node)) return
            onClose()
        }
        // Deferred: the click that opened this menu is still propagating.
        const id = window.setTimeout(() => window.addEventListener('mousedown', away), 0)
        return () => { window.clearTimeout(id); window.removeEventListener('mousedown', away) }
    }, [open, anchorRef, onClose])

    if (!open || typeof document === 'undefined') return null
    return createPortal(
        <div
            ref={boxRef}
            style={{ position: 'fixed', left: pos?.left ?? -9999, top: pos?.top ?? -9999, width }}
            className="z-[9000] max-h-[70vh] overflow-y-auto rounded-lg border border-studio-line-strong bg-studio-panel/97 p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-md daw-scrollbar-thin"
            {...rest}
        >
            {children}
        </div>,
        document.body,
    )
}

/** One row of a menu. */
export function MenuItem({ label, onClick, checked, disabled, title, ...rest }: {
    label: string; onClick?: () => void; checked?: boolean; disabled?: boolean; title?: string
} & Record<string, unknown>) {
    return (
        <button
            disabled={disabled}
            title={title}
            onClick={onClick}
            className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] transition-colors ${disabled
                ? 'cursor-default text-studio-text-dim/40'
                : 'text-studio-text hover:bg-white/10 hover:text-white'}`}
            {...rest}
        >
            <span className="w-3 shrink-0">{checked && <Check className="h-3 w-3 text-amber-300" />}</span>
            {label}
        </button>
    )
}

/** A heading inside a menu. */
export function MenuHeading({ label }: { label: string }) {
    return (
        <div className="px-2 pb-0.5 pt-2 text-[9px] font-bold uppercase tracking-wider text-studio-text-dim/70">
            {label}
        </div>
    )
}

export function LockButton({ id, locked, onToggle, what }: {
    id: string; locked: boolean; onToggle: () => void; what: string
}) {
    const Icon = locked ? Lock : Unlock
    return (
        <button
            data-session-lock={id}
            aria-pressed={locked}
            aria-label={`Lock ${what}`}
            title={locked
                ? `${what} is pinned — changing preset will leave it alone`
                : `Pin ${what} so changing preset leaves it alone`}
            onClick={onToggle}
            className={`mt-3 rounded p-0.5 transition-colors ${locked ? 'text-amber-300' : 'text-studio-text-dim/40 hover:text-studio-text-dim'}`}
        >
            <Icon className="h-3 w-3" />
        </button>
    )
}

/** Drag vertically to change a 0..1 value. Shared by the fader and the knob. */
function useVerticalDrag(value: number, onChange: (v: number) => void, travel: number) {
    return (e: React.MouseEvent) => {
        e.preventDefault()
        const startY = e.clientY
        const startValue = value
        const move = (me: MouseEvent) => {
            const dy = startY - me.clientY
            onChange(Math.min(1, Math.max(0, startValue + dy / travel)))
        }
        const up = () => {
            window.removeEventListener('mousemove', move)
            window.removeEventListener('mouseup', up)
        }
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', up)
    }
}

const arrowKeys = (value: number, onChange: (v: number) => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(1, value + 0.05)) }
    if (e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(0, value - 0.05)) }
}

/** Vertical fader, dragged. */
export function Fader({ label, id, value, onChange }: {
    label: string; id: string; value: number; onChange: (v: number) => void
}) {
    const begin = useVerticalDrag(value, onChange, 120)
    return (
        <div className="flex h-full flex-col items-center justify-end gap-1.5">
            <span className="text-[10px] text-studio-text-dim">{label}</span>
            <div
                data-session-fader={id}
                role="slider"
                aria-label={label}
                aria-valuenow={Math.round(value * 100)}
                tabIndex={0}
                onMouseDown={begin}
                onKeyDown={arrowKeys(value, onChange)}
                className="relative h-24 w-6 cursor-ns-resize rounded-full outline-none focus-visible:ring-1 focus-visible:ring-accent-cyan"
            >
                <span className="absolute inset-x-[10px] inset-y-0 rounded-full bg-amber-400/70" />
                <span
                    className="absolute inset-x-0 h-2.5 rounded-sm border border-black/50 bg-studio-text-dim shadow"
                    style={{ bottom: `calc(${Math.round(value * 100)}% - 5px)` }}
                />
            </div>
        </div>
    )
}

/** Knob with the reference's yellow arc, dragged vertically. */
export function Knob({ label, id, value, onChange, title }: {
    label: string; id: string; value: number; onChange: (v: number) => void; title: string
}) {
    const begin = useVerticalDrag(value, onChange, 140)
    // 270 degrees of travel, starting at the seven o'clock position.
    const angle = -135 + value * 270
    const circumference = 2 * Math.PI * 15
    const arc = (value * 0.75) * circumference

    return (
        <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-studio-text-dim">{label}</span>
            <div
                data-session-knob={id}
                role="slider"
                aria-label={label}
                aria-valuenow={Math.round(value * 100)}
                tabIndex={0}
                title={title}
                onMouseDown={begin}
                onKeyDown={arrowKeys(value, onChange)}
                className="relative h-10 w-10 cursor-ns-resize rounded-full outline-none focus-visible:ring-1 focus-visible:ring-accent-cyan"
            >
                <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-[135deg]">
                    <circle cx="20" cy="20" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3"
                        strokeDasharray={`${0.75 * circumference} ${circumference}`} strokeLinecap="round" />
                    <circle cx="20" cy="20" r="15" fill="none" stroke="#fbbf24" strokeWidth="3"
                        strokeDasharray={`${arc} ${circumference}`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-[7px] rounded-full bg-studio-control shadow-inner" />
                <span
                    className="absolute left-1/2 top-[8px] h-[7px] w-[2px] origin-bottom rounded-full bg-white/80"
                    style={{ transform: `translateX(-50%) rotate(${angle}deg)`, transformOrigin: '50% 12px' }}
                />
            </div>
        </div>
    )
}

/**
 * A small labelled picker.
 *
 * Clicking cycles; the options are also listed in a menu, because cycling
 * through seven left-hand styles to reach the one you want is not a control,
 * it is a penalty.
 */
export function Picker({ label, id, value, options, onChange, format }: {
    label: string
    id: string
    value: string
    options: readonly string[]
    onChange: (v: string) => void
    format?: (v: string) => string
}) {
    const ref = useRef<HTMLButtonElement>(null)
    const [open, setOpen] = useState(false)
    const show = (v: string) => (format ? format(v) : v.replace(/-/g, ' '))

    return (
        <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] text-studio-text-dim">{label}</span>
            <button
                ref={ref}
                data-session-picker={id}
                aria-label={label}
                aria-haspopup="menu"
                title={`${label}: ${show(value)}`}
                onClick={e => {
                    // Alt-click cycles without opening, for a quick nudge.
                    if (e.altKey) { onChange(options[(options.indexOf(value) + 1) % options.length]); return }
                    setOpen(o => !o)
                }}
                className="max-w-[92px] truncate rounded px-1 text-[11px] font-semibold capitalize text-amber-300 transition-colors hover:text-amber-200"
            >
                {show(value)}
            </button>
            <Popover open={open} anchorRef={ref} width={168} onClose={() => setOpen(false)}
                data-session-picker-menu={id}>
                {options.map(o => (
                    <MenuItem
                        key={o}
                        data-session-picker-option={`${id}:${o}`}
                        label={show(o)}
                        checked={o === value}
                        onClick={() => { onChange(o); setOpen(false) }}
                    />
                ))}
            </Popover>
        </div>
    )
}

/** An on/off button that reads as on or off without a legend. */
export function Toggle({ id, label, on, onToggle, title }: {
    id: string; label: string; on: boolean; onToggle: () => void; title: string
}) {
    return (
        <button
            data-session-toggle={id}
            aria-pressed={on}
            aria-label={label}
            title={title}
            onClick={onToggle}
            className={`rounded border px-2 py-0.5 text-[10px] font-semibold transition-colors ${on
                ? 'border-amber-400/60 bg-amber-400/20 text-amber-300'
                : 'border-studio-line bg-studio-control text-studio-text-dim hover:text-studio-text'}`}
        >
            {label}
        </button>
    )
}

/**
 * A horizontal slider over a range of MIDI notes.
 *
 * Used for the Bass Player's Lowest Note and the Keyboard Player's hand
 * positions — all three are "where on the instrument", which a 0..1 knob
 * cannot say.
 */
export function NoteSlider({ id, label, value, low, high, onChange, title }: {
    id: string; label: string; value: number; low: number; high: number
    onChange: (v: number) => void; title: string
}) {
    const trackRef = useRef<HTMLDivElement>(null)
    const span = Math.max(1, high - low)
    const at = (clientX: number) => {
        const r = trackRef.current?.getBoundingClientRect()
        if (!r) return
        const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
        onChange(Math.round(low + ratio * span))
    }
    const begin = (e: React.MouseEvent) => {
        e.preventDefault()
        at(e.clientX)
        const move = (me: MouseEvent) => at(me.clientX)
        const up = () => {
            window.removeEventListener('mousemove', move)
            window.removeEventListener('mouseup', up)
        }
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', up)
    }

    return (
        <div className="flex w-full flex-col gap-1">
            <div className="flex items-baseline justify-between">
                <span className="text-[10px] text-studio-text-dim">{label}</span>
                <span className="text-[10px] font-semibold text-amber-300">{noteName(value)}</span>
            </div>
            <div
                ref={trackRef}
                data-session-note-slider={id}
                role="slider"
                aria-label={label}
                aria-valuenow={value}
                aria-valuemin={low}
                aria-valuemax={high}
                tabIndex={0}
                title={title}
                onMouseDown={begin}
                onKeyDown={e => {
                    if (e.key === 'ArrowRight') { e.preventDefault(); onChange(Math.min(high, value + 1)) }
                    if (e.key === 'ArrowLeft') { e.preventDefault(); onChange(Math.max(low, value - 1)) }
                }}
                className="relative h-2.5 w-full cursor-ew-resize rounded-full bg-black/40 outline-none focus-visible:ring-1 focus-visible:ring-accent-cyan"
            >
                <span
                    className="absolute top-1/2 h-3.5 w-1.5 -translate-y-1/2 rounded-sm bg-amber-400"
                    style={{ left: `calc(${((value - low) / span) * 100}% - 3px)` }}
                />
            </div>
        </div>
    )
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** A MIDI note as it is written, C3 = 60 as this project counts. */
export function noteName(pitch: number): string {
    const p = Math.round(pitch)
    return `${NAMES[((p % 12) + 12) % 12]}${Math.floor(p / 12) - 1}`
}
