"use client"

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RotateCcw, Lock, Unlock } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import {
    generateDrummerPattern,
    patternPreview,
    DEFAULT_DRUMMER_SETTINGS,
    PATTERN_COUNT,
    type DrummerSettings,
    type DrumPiece,
} from '@/lib/drummerPattern'
import type { Clip } from '@/models/Clip'

/**
 * The Session Player.
 *
 * Opens from the Editors button on a drummer track, where a software
 * instrument gets the piano roll.
 *
 * Every control here writes into `lib/drummerPattern` and regenerates the
 * region's notes, which the `DrumMachine` then plays. That is the whole point
 * of building the generator first: a panel of fifteen knobs with nothing behind
 * them is the exact thing this codebase keeps having to remove.
 */

const PIECES: Array<{ id: DrumPiece; label: string; glyph: string }> = [
    { id: 'hat', label: 'Hi-Hat', glyph: '⌒' },
    { id: 'ride', label: 'Ride', glyph: '◠' },
    { id: 'percussion', label: 'Percussion', glyph: '▯' },
    { id: 'kick', label: 'Kick', glyph: '◉' },
    { id: 'snare', label: 'Snare', glyph: '▤' },
    { id: 'toms', label: 'Toms', glyph: '◍' },
]

/** The row of pieces that share the top grid, and the row that shares the lower one. */
const TOP_ROW: DrumPiece[] = ['hat', 'ride', 'percussion']
const BOTTOM_ROW: DrumPiece[] = ['kick', 'snare', 'toms']

export function SessionPlayer() {
    const tracks = useProjectStore(s => s.tracks)
    const clips = useProjectStore(s => s.clips)
    const focusedTrackId = useProjectStore(s => s.focusedTrackId)
    const selectedClipIds = useProjectStore(s => s.selectedClipIds)
    const updateClip = useProjectStore(s => s.updateClip)
    const timeSignature = useProjectStore(s => s.timeSignature)

    const [tab, setTab] = useState<'main' | 'details' | 'manual'>('main')
    const [variationOpen, setVariationOpen] = useState(false)

    /*
     * The region being edited: a selected one if it belongs to a drummer track,
     * otherwise the first region on the focused drummer track. The same rule
     * the piano roll uses for choosing what it is looking at.
     */
    const target = useMemo(() => {
        const drummerTracks = new Set(tracks.filter(t => t.type === 'drummer').map(t => t.id))
        const selected = clips.find(c => selectedClipIds?.includes(c.id) && drummerTracks.has(c.trackId))
        if (selected) return selected
        return clips.find(c => c.trackId === focusedTrackId && drummerTracks.has(c.trackId))
            ?? clips.find(c => drummerTracks.has(c.trackId))
    }, [tracks, clips, selectedClipIds, focusedTrackId])

    const track = tracks.find(t => t.id === target?.trackId)
    const settings: DrummerSettings = target?.drummerSettings ?? DEFAULT_DRUMMER_SETTINGS

    const beatsPerBar = Number(timeSignature?.split('/')[0]) || 4

    /** Write the settings and the notes they produce back onto the region. */
    const apply = useCallback((next: Partial<DrummerSettings>) => {
        if (!target) return
        const merged: DrummerSettings = { ...settings, ...next }
        const bars = Math.max(1, Math.round((target.duration || beatsPerBar) / beatsPerBar))
        const notes = generateDrummerPattern(merged, { bars, beatsPerBar }).map((n, i) => ({
            id: `drum-${target.id}-${i}`,
            pitch: n.pitch,
            start: n.start,
            duration: n.duration,
            velocity: Math.round(n.velocity * 127),
        }))
        updateClip(target.id, { drummerSettings: merged, notes } as Partial<Clip>)
    }, [target, settings, beatsPerBar, updateClip])

    if (!target) {
        return (
            <div data-session-player className="flex h-full items-center justify-center px-8 text-center">
                <p className="max-w-sm text-[13px] leading-relaxed text-studio-text-dim">
                    The Session Player edits a drummer region. Add one to a drummer track — draw
                    it in the timeline — and it will open here.
                </p>
            </div>
        )
    }

    return (
        <div data-session-player className="flex h-full flex-col overflow-hidden bg-studio-panel">
            {/* ── Title bar ─────────────────────────────────────────────── */}
            <header className="flex h-8 shrink-0 items-center justify-between border-b border-studio-line px-3">
                <div className="flex items-center gap-2 text-[11px] text-studio-text-dim">
                    <span className="font-bold uppercase tracking-wider">Preset</span>
                    <span data-session-preset className="text-amber-300">{track?.name ?? 'Drummer'}</span>
                </div>
                <h2 className="text-[12px] font-bold">Session Player</h2>
                <div className="flex items-center gap-1">
                    {(['main', 'details', 'manual'] as const).map(id => (
                        <button
                            key={id}
                            data-session-tab={id}
                            disabled={id === 'manual'}
                            title={id === 'manual'
                                ? 'Hand-editing the pattern is not built yet — open the region in the piano roll to edit its notes directly'
                                : undefined}
                            onClick={() => id !== 'manual' && setTab(id)}
                            className={`rounded px-2.5 py-0.5 text-[11px] font-semibold capitalize transition-colors ${id === 'manual'
                                ? 'cursor-default text-studio-text-dim/40'
                                : tab === id
                                    ? 'bg-white/10 text-white'
                                    : 'text-studio-text-dim hover:text-white'}`}
                        >
                            {id}
                        </button>
                    ))}
                </div>
            </header>

            <div className="flex min-h-0 flex-1 items-stretch gap-4 overflow-x-auto overflow-y-hidden p-4 daw-scrollbar-thin">
                {/* ── The kit, and the two big faders ───────────────────── */}
                <section className="flex shrink-0 items-end gap-4">
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] text-studio-text-dim">Acoustic Drummer</span>
                        <span className="text-[12px] font-semibold text-amber-300">{track?.name ?? 'Drummer'}</span>
                        <KitGraphic />
                        <button
                            data-session-reseed
                            title="Play it again — the same settings, a different take"
                            aria-label="New take"
                            onClick={() => apply({ seed: (settings.seed % 997) + 1 })}
                            className="mt-1 rounded border border-studio-line bg-studio-control px-2 py-1 text-studio-text-dim transition-colors hover:text-white"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    <Fader label="Complexity" id="complexity" value={settings.complexity}
                        onChange={v => apply({ complexity: v })} />
                    <Fader label="Intensity" id="intensity" value={settings.intensity}
                        onChange={v => apply({ intensity: v })} />
                </section>

                {tab === 'main' ? (
                    <MainTab
                        settings={settings}
                        variationOpen={variationOpen}
                        setVariationOpen={setVariationOpen}
                        apply={apply}
                    />
                ) : (
                    <DetailsTab settings={settings} apply={apply} />
                )}
            </div>
        </div>
    )
}

/* ── Main ───────────────────────────────────────────────────────────────── */

function MainTab({ settings, variationOpen, setVariationOpen, apply }: {
    settings: DrummerSettings
    variationOpen: boolean
    setVariationOpen: (v: boolean) => void
    apply: (next: Partial<DrummerSettings>) => void
}) {
    const steps = patternPreview(settings.variation, settings.complexity)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null)

    /*
     * Portalled, and positioned from the button's rect.
     *
     * The panel is the bottom of the window, so this list has to open upward —
     * and an absolutely positioned child opening upward is painted under the
     * timeline above it, whatever its z-index, because an ancestor establishes
     * the stacking context. Fixed coordinates off the button escape that. The
     * display menu in the transport bar hit exactly this.
     */
    useLayoutEffect(() => {
        if (!variationOpen) { setAnchor(null); return }
        const r = buttonRef.current?.getBoundingClientRect()
        if (!r) return
        const width = 320
        const height = 8 + PATTERN_COUNT * 30
        setAnchor({
            left: Math.max(8, Math.min(window.innerWidth - width - 8, r.left - 8)),
            top: Math.max(8, r.top - height - 8),
        })
    }, [variationOpen])

    return (
        <>
            <section className="relative flex min-w-[360px] flex-1 flex-col justify-center gap-4 rounded-lg border border-studio-line bg-studio-sunken px-4 py-3">
                {[TOP_ROW, BOTTOM_ROW].map((row, rowIndex) => (
                    <div key={rowIndex} className="flex items-center gap-3">
                        <div className="flex w-24 shrink-0 items-center gap-1.5">
                            {row.map(id => {
                                const piece = PIECES.find(p => p.id === id)!
                                const on = settings.pieces[id]
                                return (
                                    <button
                                        key={id}
                                        data-session-piece={id}
                                        aria-pressed={on}
                                        title={`${piece.label} — ${on ? 'playing' : 'silent'}`}
                                        aria-label={piece.label}
                                        onClick={() => apply({ pieces: { ...settings.pieces, [id]: !on } })}
                                        className={`flex h-6 w-6 items-center justify-center rounded text-[13px] transition-colors ${on
                                            ? 'bg-amber-400/20 text-amber-300'
                                            : 'text-studio-text-dim/40 hover:text-studio-text-dim'}`}
                                    >
                                        {piece.glyph}
                                    </button>
                                )
                            })}
                        </div>

                        {rowIndex === 0 && (
                            <button
                                ref={buttonRef}
                                data-session-variation
                                title="Choose a pattern"
                                onClick={() => setVariationOpen(!variationOpen)}
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-[#04070b]"
                            >
                                {settings.variation}
                            </button>
                        )}
                        {rowIndex === 1 && <span className="w-5 shrink-0" />}

                        {/* The sixteen steps of the bar this row plays. */}
                        <div data-session-steps={rowIndex} className="flex flex-1 items-center gap-[3px]">
                            {steps.map((on, i) => (
                                <span
                                    key={i}
                                    className={`h-1.5 flex-1 rounded-full transition-colors ${on
                                        ? i % 4 === 0 ? 'bg-amber-300' : 'bg-amber-400/70'
                                        : 'bg-white/10'}`}
                                />
                            ))}
                        </div>
                    </div>
                ))}

                {variationOpen && anchor && typeof document !== 'undefined' && createPortal(
                    <div
                        data-session-variations
                        style={{ position: 'fixed', left: anchor.left, top: anchor.top, width: 320 }}
                        className="z-[9000] rounded-lg border border-studio-line-strong bg-studio-panel/97 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-md"
                    >
                        {Array.from({ length: PATTERN_COUNT }, (_, i) => i + 1).map(v => (
                            <button
                                key={v}
                                data-session-variation-row={v}
                                onClick={() => { apply({ variation: v }); setVariationOpen(false) }}
                                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 transition-colors ${v === settings.variation ? 'bg-white/10' : 'hover:bg-white/5'}`}
                            >
                                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-studio-line text-[9px] text-studio-text-dim">
                                    {v}
                                </span>
                                <span className="flex flex-1 items-center gap-[2px]">
                                    {patternPreview(v, settings.complexity).map((on, i) => (
                                        <span key={i} className={`h-1 flex-1 rounded-full ${on ? 'bg-amber-300/80' : 'bg-white/10'}`} />
                                    ))}
                                </span>
                            </button>
                        ))}
                    </div>,
                    document.body,
                )}
            </section>

            <section className="flex shrink-0 items-center gap-5 rounded-lg border border-studio-line bg-studio-sunken px-5 py-3">
                <div className="flex flex-col gap-3">
                    <Knob label="Fill Amount" id="fillAmount" value={settings.fillAmount}
                        onChange={v => apply({ fillAmount: v })}
                        title="How often a phrase ends in a fill" />
                    <Knob label="Fill Complexity" id="fillComplexity" value={settings.fillComplexity}
                        onChange={v => apply({ fillComplexity: v })}
                        title="How busy those fills are" />
                </div>
                <div className="flex flex-col items-center gap-2">
                    <Knob label="Swing" id="swing" value={settings.swing}
                        onChange={v => apply({ swing: v })}
                        title="How far every second subdivision is pushed late" />
                    <button
                        data-session-swing-grid
                        title="Which subdivision the swing applies to"
                        onClick={() => apply({ swingGrid: settings.swingGrid === '8th' ? '16th' : '8th' })}
                        className="rounded border border-studio-line bg-studio-control px-2 py-0.5 text-[10px] font-semibold text-studio-text transition-colors hover:text-white"
                    >
                        {settings.swingGrid}
                    </button>
                </div>
            </section>
        </>
    )
}

/* ── Details ────────────────────────────────────────────────────────────── */

function DetailsTab({ settings, apply }: {
    settings: DrummerSettings
    apply: (next: Partial<DrummerSettings>) => void
}) {
    return (
        <section className="flex min-w-[520px] flex-1 items-center justify-around gap-6 rounded-lg border border-studio-line bg-studio-sunken px-6 py-3">
            <div className="flex flex-col items-center gap-3">
                <Knob label="Ghost Notes" id="ghostNotes" value={settings.ghostNotes}
                    onChange={v => apply({ ghostNotes: v })}
                    title="Quiet snare hits between the backbeats" />
                <div className="flex gap-4">
                    <Picker label="Snare" id="snare" value={settings.snare}
                        options={['center', 'rim']} onChange={v => apply({ snare: v as never })} />
                    <Picker label="Percussion" id="percussion" value={settings.percussion}
                        options={['off', 'tambourine', 'shaker']}
                        onChange={v => apply({ percussion: v as never })} />
                    <Picker label="Hi-Hat" id="hiHat" value={settings.hiHat}
                        options={['automatic', 'closed', 'open']}
                        onChange={v => apply({ hiHat: v as never })} />
                </div>
            </div>

            <div className="flex items-start gap-6">
                <div className="flex flex-col items-center gap-1">
                    <Knob label="Feel" id="feel" value={(settings.feel + 1) / 2}
                        onChange={v => apply({ feel: v * 2 - 1 })}
                        title="Behind the beat, or ahead of it" />
                    <div className="flex w-20 justify-between text-[9px] text-studio-text-dim">
                        <span>Pull</span><span>Push</span>
                    </div>
                </div>
                <div className="flex flex-col gap-3">
                    <Knob label="Dynamics" id="dynamics" value={settings.dynamics}
                        onChange={v => apply({ dynamics: v })}
                        title="The spread between the softest and hardest hits" />
                    <Knob label="Humanize" id="humanize" value={settings.humanize}
                        onChange={v => apply({ humanize: v })}
                        title="How much the timing and velocity wander" />
                </div>
            </div>
        </section>
    )
}

/* ── Controls ───────────────────────────────────────────────────────────── */

/** Vertical fader, dragged. */
function Fader({ label, id, value, onChange }: {
    label: string; id: string; value: number; onChange: (v: number) => void
}) {
    const begin = (e: React.MouseEvent) => {
        e.preventDefault()
        const startY = e.clientY
        const startValue = value
        const move = (me: MouseEvent) => {
            const dy = startY - me.clientY
            onChange(Math.min(1, Math.max(0, startValue + dy / 120)))
        }
        const up = () => {
            window.removeEventListener('mousemove', move)
            window.removeEventListener('mouseup', up)
        }
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', up)
    }

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
                onKeyDown={e => {
                    if (e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(1, value + 0.05)) }
                    if (e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(0, value - 0.05)) }
                }}
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
function Knob({ label, id, value, onChange, title }: {
    label: string; id: string; value: number; onChange: (v: number) => void; title: string
}) {
    const begin = (e: React.MouseEvent) => {
        e.preventDefault()
        const startY = e.clientY
        const startValue = value
        const move = (me: MouseEvent) => {
            const dy = startY - me.clientY
            onChange(Math.min(1, Math.max(0, startValue + dy / 140)))
        }
        const up = () => {
            window.removeEventListener('mousemove', move)
            window.removeEventListener('mouseup', up)
        }
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', up)
    }

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
                onKeyDown={e => {
                    if (e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(1, value + 0.05)) }
                    if (e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(0, value - 0.05)) }
                }}
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

/** A small labelled cycling picker, as the Details tab shows. */
function Picker({ label, id, value, options, onChange }: {
    label: string; id: string; value: string; options: string[]; onChange: (v: string) => void
}) {
    return (
        <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] text-studio-text-dim">{label}</span>
            <button
                data-session-picker={id}
                aria-label={label}
                title={`${label}: ${value}`}
                onClick={() => onChange(options[(options.indexOf(value) + 1) % options.length])}
                className="rounded px-1 text-[11px] font-semibold capitalize text-amber-300 transition-colors hover:text-amber-200"
            >
                {value}
            </button>
        </div>
    )
}

/** The kit, drawn rather than fetched — it is a label, not a photograph. */
function KitGraphic() {
    return (
        <svg viewBox="0 0 100 70" className="h-16 w-24" aria-hidden="true">
            <g fill="none" stroke="#fbbf24" strokeWidth="1.6" strokeLinejoin="round">
                <ellipse cx="20" cy="26" rx="13" ry="4" />
                <ellipse cx="80" cy="24" rx="12" ry="4" />
                <rect x="36" y="22" width="13" height="12" rx="1.5" />
                <rect x="52" y="22" width="13" height="12" rx="1.5" />
                <circle cx="50" cy="52" r="15" />
                <rect x="20" y="40" width="13" height="10" rx="1.5" />
                <path d="M20 30v14M80 28v18M50 37v0" />
            </g>
        </svg>
    )
}
