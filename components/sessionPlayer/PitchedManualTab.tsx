"use client"

/**
 * Manual view for the Bass and Keyboard Players.
 *
 * The manual: "When editing the Keyboard Player and Bass Player, a single row
 * is available. When editing Drummer, multiple rows are available for different
 * kit pieces." The Keyboard Player gets two here rather than one, because it
 * has two hands and they are separately mutable everywhere else in the editor —
 * one row could not say "left hand on the beat, right hand off it".
 *
 * Each step is a sixteenth, so sixteen steps is a bar. Longer patterns are
 * divided into pages, with an overview above the first row.
 */
import React, { useRef, useState } from 'react'
import { MoreHorizontal, ChevronDown } from 'lucide-react'
import { Popover, MenuItem, MenuHeading } from './controls'
import { MANUAL_PAGE_STEPS, emptyManualPattern, type ManualPattern } from '@/lib/sessionRhythm'
import type { SessionPlayerKind } from '@/lib/sessionStyles'

const LENGTHS = [
    { steps: 16, label: '1 Bar' },
    { steps: 32, label: '2 Bars' },
    { steps: 48, label: '3 Bars' },
    { steps: 64, label: '4 Bars' },
]

/** The rows each player types on. */
const ROWS: Record<Exclude<SessionPlayerKind, 'drummer'>, Array<{ id: string; label: string }>> = {
    bass: [{ id: 'bass', label: 'Bass' }],
    keyboard: [{ id: 'right', label: 'Right Hand' }, { id: 'left', label: 'Left Hand' }],
}

export function PitchedManualTab({ settings, kind, apply }: {
    settings: { manual: ManualPattern | null }
    kind: SessionPlayerKind
    apply: (next: { manual: ManualPattern | null }) => void
}) {
    const rows = ROWS[kind as 'bass' | 'keyboard'] ?? ROWS.bass
    const [page, setPage] = useState(0)
    const actionRef = useRef<HTMLButtonElement>(null)
    const lengthRef = useRef<HTMLButtonElement>(null)
    const [actionOpen, setActionOpen] = useState(false)
    const [lengthOpen, setLengthOpen] = useState(false)

    const pattern = settings.manual
    const length = pattern?.length ?? MANUAL_PAGE_STEPS
    const pages = Math.max(1, Math.ceil(length / MANUAL_PAGE_STEPS))
    const at = Math.min(page, pages - 1)

    /** Start a pattern the moment a step is clicked, as the manual describes. */
    const ensure = (): ManualPattern =>
        pattern ?? emptyManualPattern(rows.map(r => r.id), MANUAL_PAGE_STEPS)

    const toggleStep = (row: string, step: number) => {
        const base = ensure()
        const grid = [...(base.rows[row] ?? Array.from({ length: base.length }, () => false))]
        while (grid.length < base.length) grid.push(false)
        grid[step] = !grid[step]
        apply({ manual: { ...base, rows: { ...base.rows, [row]: grid } } })
    }

    const toggleMute = (row: string) => {
        const base = ensure()
        apply({ manual: { ...base, muted: { ...base.muted, [row]: !base.muted[row] } } })
    }

    const setLength = (steps: number) => {
        const base = ensure()
        const resized: Record<string, boolean[]> = {}
        for (const row of rows) {
            const old = base.rows[row.id] ?? []
            resized[row.id] = Array.from({ length: steps }, (_, i) => old[i] ?? false)
        }
        apply({ manual: { ...base, length: steps, rows: resized } })
        setPage(0)
        setLengthOpen(false)
    }

    return (
        <section className="flex md:min-w-[560px] flex-1 flex-col justify-center gap-3 rounded-lg border border-studio-line bg-studio-sunken px-4 py-3">
            <div className="flex items-center gap-3">
                <button
                    ref={lengthRef}
                    data-session-manual-length
                    title="How long the pattern is before it repeats"
                    onClick={() => setLengthOpen(o => !o)}
                    className="flex items-center gap-1 rounded border border-studio-line bg-studio-control px-2 py-0.5 text-[10px] font-semibold text-studio-text transition-colors hover:text-white"
                >
                    {LENGTHS.find(l => l.steps === length)?.label ?? `${length} steps`}
                    <ChevronDown className="h-3 w-3" />
                </button>

                {/* The page overview, when the pattern is longer than a bar. */}
                {pages > 1 && (
                    <div className="flex items-center gap-1">
                        {Array.from({ length: pages }, (_, p) => (
                            <button
                                key={p}
                                data-session-manual-page={p}
                                aria-pressed={p === at}
                                title={`Bar ${p + 1} of the pattern`}
                                onClick={() => setPage(p)}
                                className={`flex items-center gap-[2px] rounded px-1 py-0.5 transition-colors ${p === at ? 'bg-white/10' : 'hover:bg-white/5'}`}
                            >
                                {Array.from({ length: MANUAL_PAGE_STEPS }, (_, i) => {
                                    const on = rows.some(r =>
                                        pattern?.rows[r.id]?.[p * MANUAL_PAGE_STEPS + i])
                                    return (
                                        <span key={i}
                                            className={`h-1 w-[2px] rounded-full ${on ? 'bg-amber-300' : 'bg-white/15'}`} />
                                    )
                                })}
                            </button>
                        ))}
                    </div>
                )}

                <span className="flex-1" />

                {!pattern && (
                    <span className="text-[10px] text-studio-text-dim">
                        Click a step to start a pattern of your own
                    </span>
                )}

                <button
                    ref={actionRef}
                    data-session-manual-action
                    aria-label="Pattern actions"
                    title="Copy, paste and clear"
                    onClick={() => setActionOpen(o => !o)}
                    className="rounded p-0.5 text-studio-text-dim transition-colors hover:text-white"
                >
                    <MoreHorizontal className="h-4 w-4" />
                </button>
            </div>

            <div className="flex flex-col gap-1.5">
                {rows.map(row => {
                    const grid = pattern?.rows[row.id] ?? []
                    const muted = !!pattern?.muted[row.id]
                    return (
                        <div key={row.id} className="flex items-center gap-2">
                            <button
                                data-session-manual-mute={row.id}
                                aria-pressed={!muted}
                                title={`${row.label} — ${muted ? 'muted' : 'playing'}`}
                                onClick={() => toggleMute(row.id)}
                                className={`w-20 shrink-0 rounded px-1.5 py-1 text-left text-[10px] font-semibold transition-colors ${muted
                                    ? 'text-studio-text-dim/40'
                                    : 'text-amber-300'}`}
                            >
                                {row.label}
                            </button>
                            <div className="flex flex-1 items-center gap-[3px]">
                                {Array.from({ length: MANUAL_PAGE_STEPS }, (_, i) => {
                                    const step = at * MANUAL_PAGE_STEPS + i
                                    const on = !!grid[step]
                                    return (
                                        <button
                                            key={i}
                                            data-session-manual-step={`${row.id}:${step}`}
                                            aria-pressed={on}
                                            aria-label={`${row.label} step ${step + 1}`}
                                            onClick={() => toggleStep(row.id, step)}
                                            className={`h-6 flex-1 rounded-sm border transition-colors ${on
                                                ? muted
                                                    ? 'border-white/10 bg-white/20'
                                                    : 'border-amber-300 bg-amber-400'
                                                : i % 4 === 0
                                                    ? 'border-white/10 bg-white/[0.06] hover:bg-white/15'
                                                    : 'border-white/5 bg-black/30 hover:bg-white/10'}`}
                                        />
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>

            <Popover open={lengthOpen} anchorRef={lengthRef} width={140} onClose={() => setLengthOpen(false)}>
                {LENGTHS.map(l => (
                    <MenuItem
                        key={l.steps}
                        data-session-manual-length-row={l.steps}
                        label={l.label}
                        checked={l.steps === length}
                        onClick={() => setLength(l.steps)}
                    />
                ))}
            </Popover>

            <Popover open={actionOpen} anchorRef={actionRef} width={190} onClose={() => setActionOpen(false)}
                data-session-manual-actions>
                <MenuHeading label="Pattern" />
                <MenuItem
                    data-session-manual-copy
                    label="Copy Pattern"
                    disabled={!pattern}
                    onClick={() => { manualClipboard = pattern ? JSON.parse(JSON.stringify(pattern)) : null; setActionOpen(false) }}
                />
                <MenuItem
                    data-session-manual-paste
                    label="Paste Pattern"
                    disabled={!manualClipboard}
                    onClick={() => { if (manualClipboard) apply({ manual: JSON.parse(JSON.stringify(manualClipboard)) }); setActionOpen(false) }}
                />
                <MenuItem
                    data-session-manual-reset
                    label="Reset"
                    disabled={!pattern}
                    title="Clear the pattern and go back to the chosen one"
                    onClick={() => { apply({ manual: null }); setActionOpen(false) }}
                />
            </Popover>
        </section>
    )
}

/** Shared between regions, the way the manual's Copy Pattern is. */
let manualClipboard: ManualPattern | null = null
