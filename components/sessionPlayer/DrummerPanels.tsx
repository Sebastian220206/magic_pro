"use client"

/**
 * The Drummer's own panels.
 *
 * Split out of `SessionPlayer.tsx` when the Bass and Keyboard Players arrived:
 * the shell is the same for all three — menu bar, region ruler, instrument,
 * Complexity and Intensity — and only these panels differ.
 */
import React, { useRef, useState } from 'react'
import { ChevronDown, MoreHorizontal } from 'lucide-react'
import { Knob, Picker, LockButton, Popover, MenuItem } from './controls'
import {
    patternPreview,
    PATTERN_COUNT,
    MANUAL_PAGE_STEPS,
    emptyManualPattern,
    resolveTempoMode,
    type DrummerSettings,
    type DrumPiece,
    type TempoMode,
    type ManualPattern,
} from '@/lib/drummerPattern'
import type { Track } from '@/models/Track'

const PIECES: Array<{ id: DrumPiece; label: string; glyph: string }> = [
    { id: 'hat', label: 'Hi-Hat', glyph: '⌒' },
    { id: 'ride', label: 'Ride', glyph: '◠' },
    { id: 'percussion', label: 'Percussion', glyph: '▯' },
    { id: 'kick', label: 'Kick', glyph: '◉' },
    { id: 'snare', label: 'Snare', glyph: '▤' },
    { id: 'toms', label: 'Toms', glyph: '◍' },
]

/** The row of pieces that share the cymbal pattern, and the row that shares the drum one. */
const TOP_ROW: DrumPiece[] = ['hat', 'ride', 'percussion']
const BOTTOM_ROW: DrumPiece[] = ['kick', 'snare', 'toms']

/** The order rows appear in Manual view, top to bottom, as on a kit. */
const MANUAL_ROWS: DrumPiece[] = ['hat', 'ride', 'percussion', 'toms', 'snare', 'kick']

const TEMPO_MODES: TempoMode[] = ['automatic', 'standard', 'half-time', 'double-time']

/**
 * Copied settings and patterns, for the manual's Copy/Paste.
 *
 * Session-scoped on purpose: this is a clipboard, not a document. Putting it in
 * the store would persist a transient into every save file.
 */
let settingsClipboard: Partial<DrummerSettings> | null = null
let patternClipboard: ManualPattern | null = null
let pageClipboard: Partial<Record<DrumPiece, boolean[]>> | null = null

export function MainTab({ settings, tracks, trackId, hasChords, apply }: {
    settings: DrummerSettings
    tracks: Array<{ id: string; name: string; type: string }>
    trackId?: string
    /** Whether there is any harmony to place emphasis on. */
    hasChords: boolean
    apply: (next: Partial<DrummerSettings>) => void
}) {
    const [openRow, setOpenRow] = useState<0 | 1 | null>(null)
    const topRef = useRef<HTMLButtonElement>(null)
    const bottomRef = useRef<HTMLButtonElement>(null)

    const rows = [
        { pieces: TOP_ROW, variation: settings.cymbalVariation, key: 'cymbalVariation' as const, ref: topRef },
        { pieces: BOTTOM_ROW, variation: settings.variation, key: 'variation' as const, ref: bottomRef },
    ]

    return (
        <>
            <section className="relative flex md:min-w-[380px] flex-1 flex-col justify-center gap-4 rounded-lg border border-studio-line bg-studio-sunken px-4 py-3">
                {rows.map((row, rowIndex) => {
                    /*
                     * Each row draws its own pattern. Both rows read one
                     * `variation` before, so the lower row was a copy of the
                     * upper one whatever the kit was doing — and the manual is
                     * explicit that the Drummer has a Patterns button per group
                     * of kit pieces.
                     */
                    const steps = patternPreview(row.variation, settings.complexity)
                    return (
                        <div key={rowIndex} className="flex items-center gap-3">
                            <div className="flex w-24 shrink-0 items-center gap-1.5">
                                {row.pieces.map(id => {
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

                            <button
                                ref={row.ref}
                                data-session-variation={rowIndex}
                                title={`Choose a pattern for the ${rowIndex === 0 ? 'cymbals' : 'drums'}`}
                                onClick={() => setOpenRow(openRow === rowIndex ? null : rowIndex as 0 | 1)}
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-[#04070b]"
                            >
                                {row.variation}
                            </button>

                            <div className="flex flex-1 flex-col gap-0.5">
                                <div data-session-steps={rowIndex} className="flex items-center gap-[3px]">
                                    {steps.map((on, i) => (
                                        <span
                                            key={i}
                                            className={`h-1.5 flex-1 rounded-full transition-colors ${on
                                                ? i % 4 === 0 ? 'bg-amber-300' : 'bg-amber-400/70'
                                                : 'bg-white/10'}`}
                                        />
                                    ))}
                                </div>
                                {rowIndex === 1 && settings.followTrackId && (
                                    <span data-session-follow-label className="text-[9px] text-amber-300/80">
                                        Follow: {tracks.find(t => t.id === settings.followTrackId)?.name ?? 'a track'}
                                    </span>
                                )}
                            </div>
                        </div>
                    )
                })}

                {rows.map((row, rowIndex) => (
                    <Popover
                        key={rowIndex}
                        open={openRow === rowIndex}
                        anchorRef={row.ref}
                        width={330}
                        onClose={() => setOpenRow(null)}
                        data-session-variations={rowIndex}
                    >
                        {Array.from({ length: PATTERN_COUNT }, (_, i) => i + 1).map(v => (
                            <button
                                key={v}
                                data-session-variation-row={v}
                                onClick={() => { apply({ [row.key]: v } as Partial<DrummerSettings>); setOpenRow(null) }}
                                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 transition-colors ${v === row.variation ? 'bg-white/10' : 'hover:bg-white/5'}`}
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

                        {/* ── Follow Rhythm Of ──────────────────────────── */}
                        <hr className="my-1 border-studio-line" />
                        <p className="px-2 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-studio-text-dim">
                            Follow Rhythm Of
                        </p>
                        <div className="flex items-center justify-between px-2 py-1">
                            <span className={`text-[11px] ${hasChords ? 'text-studio-text' : 'text-studio-text-dim/40'}`}>
                                Chords
                            </span>
                            <button
                                data-session-follow-chords
                                role="switch"
                                aria-checked={settings.followChords && hasChords}
                                disabled={!hasChords}
                                aria-label="Follow the rhythm of the chords"
                                title={hasChords
                                    ? 'Mark the chord changes with a cymbal'
                                    : 'There are no chords to follow yet - add some from the Chords menu, or write them on the Chord track'}
                                onClick={() => hasChords && apply({ followChords: !settings.followChords })}
                                className={`h-4 w-7 rounded-full p-[2px] transition-colors ${!hasChords
                                    ? 'cursor-default bg-white/10'
                                    : settings.followChords ? 'bg-amber-400' : 'bg-white/15'}`}
                            >
                                <span className={`block h-3 w-3 rounded-full bg-white transition-transform ${settings.followChords && hasChords ? 'translate-x-3' : ''}`} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between gap-2 px-2 py-1">
                            <span className="text-[11px]">Track</span>
                            <select
                                data-session-follow-track
                                aria-label="Follow the rhythm of a track"
                                value={settings.followTrackId ?? ''}
                                onChange={e => apply({ followTrackId: e.target.value || null })}
                                className="min-w-0 flex-1 rounded border border-studio-line bg-studio-sunken px-1 py-0.5 text-[11px] text-amber-300 outline-none"
                            >
                                <option value="">Off</option>
                                {tracks
                                    .filter(t => t.id !== trackId
                                        && ['midi', 'software-instrument', 'external-midi', 'drummer', 'bass-player', 'keyboard-player'].includes(t.type))
                                    .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                    </Popover>
                ))}
            </section>

            <section className="flex shrink-0 items-center gap-5 rounded-lg border border-studio-line bg-studio-sunken px-5 py-3">
                <div className="flex flex-col gap-3">
                    <div className="flex items-start gap-1">
                        <Knob label="Fill Amount" id="fillAmount" value={settings.fillAmount}
                            onChange={v => apply({ fillAmount: v })}
                            title="How often a phrase ends in a fill" />
                        <LockButton
                            id="fills"
                            locked={settings.lockFills}
                            onToggle={() => apply({ lockFills: !settings.lockFills })}
                            what="the fill settings"
                        />
                    </div>
                    <Knob label="Fill Complexity" id="fillComplexity" value={settings.fillComplexity}
                        onChange={v => apply({ fillComplexity: v })}
                        title="How busy those fills are" />
                </div>
                <div className="flex flex-col items-center gap-2">
                    <div className="flex items-start gap-1">
                        <Knob label="Swing" id="swing" value={settings.swing}
                            onChange={v => apply({ swing: v })}
                            title="How far every second subdivision is pushed late" />
                        <LockButton
                            id="swing"
                            locked={settings.lockSwing}
                            onToggle={() => apply({ lockSwing: !settings.lockSwing })}
                            what="the swing"
                        />
                    </div>
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

export function DetailsTab({ settings, tempo, apply }: {
    settings: DrummerSettings
    tempo: number
    apply: (next: Partial<DrummerSettings>) => void
}) {
    const resolved = resolveTempoMode(settings.tempoMode, tempo)

    return (
        <section className="flex md:min-w-[640px] flex-1 items-center justify-around gap-6 rounded-lg border border-studio-line bg-studio-sunken px-6 py-3">
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
                    {/*
                        The manual: the hi-hat, cymbal and tom menus appear only
                        when that piece is switched on in Main view. A menu that
                        changes a piece nobody plays is a control that does
                        nothing, which is the thing being avoided everywhere
                        else in this panel.
                    */}
                    {settings.pieces.hat && (
                        <Picker label="Hi-Hat" id="hiHat" value={settings.hiHat}
                            options={['automatic', 'closed', 'open']}
                            onChange={v => apply({ hiHat: v as never })} />
                    )}
                    {(settings.pieces.ride || settings.fillAmount > 0) && (
                        <Picker label="Cymbals" id="cymbals" value={settings.cymbals}
                            options={['crash', 'splash', 'china']}
                            onChange={v => apply({ cymbals: v as never })} />
                    )}
                    {settings.pieces.toms && (
                        <Picker label="Toms" id="toms" value={settings.toms}
                            options={['full', 'low', 'high']}
                            onChange={v => apply({ toms: v as never })} />
                    )}
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
                <div className="flex flex-col items-center gap-3">
                    <Knob label="Phrase Variation" id="phraseVariation" value={settings.phraseVariation}
                        onChange={v => apply({ phraseVariation: v })}
                        title="How much the pattern changes from bar to bar across the region" />
                    <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] text-studio-text-dim">Tempo</span>
                        <button
                            data-session-picker="tempoMode"
                            aria-label="Tempo"
                            title={settings.tempoMode === 'automatic'
                                ? `Automatic — at ${Math.round(tempo)} bpm the drummer plays ${resolved.replace('-', ' ')}`
                                : `The rhythm plays ${settings.tempoMode.replace('-', ' ')}`}
                            onClick={() => apply({
                                tempoMode: TEMPO_MODES[(TEMPO_MODES.indexOf(settings.tempoMode) + 1) % TEMPO_MODES.length],
                            })}
                            className="rounded px-1 text-[11px] font-semibold capitalize text-amber-300 transition-colors hover:text-amber-200"
                        >
                            {settings.tempoMode.replace('-', ' ')}
                        </button>
                        {settings.tempoMode === 'automatic' && (
                            <span data-session-tempo-resolved className="text-[9px] text-studio-text-dim">
                                {resolved.replace('-', ' ')}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </section>
    )
}

/* ── Manual ─────────────────────────────────────────────────────────────── */

const LENGTHS = [
    { label: '8 Steps', steps: 8 },
    { label: '1 Bar', steps: 16 },
    { label: '2 Bars', steps: 32 },
    { label: '4 Bars', steps: 64 },
]

/**
 * Manual view: the pattern typed in by hand.
 *
 * One row per kit piece, each step a sixteenth. Turning any step on switches
 * the region over to the hand-typed pattern; Reset clears it and hands the
 * region back to the generator, so this is never a one-way door.
 */
export function ManualTab({ settings, apply }: {
    settings: DrummerSettings
    apply: (next: Partial<DrummerSettings>) => void
}) {
    const [page, setPage] = useState(0)
    const [actionsOpen, setActionsOpen] = useState(false)
    const [lengthOpen, setLengthOpen] = useState(false)
    const actionsRef = useRef<HTMLButtonElement>(null)
    const lengthRef = useRef<HTMLButtonElement>(null)

    const manual = settings.manual ?? emptyManualPattern()
    const pages = Math.max(1, Math.ceil(manual.length / MANUAL_PAGE_STEPS))
    const current = Math.min(page, pages - 1)
    const offset = current * MANUAL_PAGE_STEPS
    const visible = Math.min(MANUAL_PAGE_STEPS, manual.length - offset)

    const write = (next: ManualPattern) => apply({ manual: next })

    const toggleStep = (piece: DrumPiece, at: number) => {
        const rows = { ...manual.rows }
        const row = [...(rows[piece] ?? Array.from({ length: manual.length }, () => false))]
        row[at] = !row[at]
        rows[piece] = row
        write({ ...manual, rows })
    }

    const setLength = (steps: number) => {
        const rows: ManualPattern['rows'] = {}
        for (const piece of MANUAL_ROWS) {
            const old = manual.rows[piece] ?? []
            rows[piece] = Array.from({ length: steps }, (_, i) => !!old[i])
        }
        setPage(0)
        write({ ...manual, length: steps, rows })
    }

    return (
        <section className="flex md:min-w-[560px] flex-1 flex-col justify-center gap-2 rounded-lg border border-studio-line bg-studio-sunken px-4 py-3">
            <div className="flex items-center gap-3">
                <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-wider text-studio-text-dim">Length</span>
                    <button
                        ref={lengthRef}
                        data-session-manual-length
                        onClick={() => setLengthOpen(v => !v)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-amber-300"
                    >
                        {LENGTHS.find(l => l.steps === manual.length)?.label ?? `${manual.length} Steps`}
                        <ChevronDown className="h-3 w-3" />
                    </button>
                </div>

                {/* The page overview: each page of the pattern, in miniature. */}
                {pages > 1 && (
                    <div className="flex items-center gap-1">
                        {Array.from({ length: pages }, (_, p) => (
                            <button
                                key={p}
                                data-session-manual-page={p}
                                onClick={() => setPage(p)}
                                aria-pressed={p === current}
                                title={`Page ${p + 1}`}
                                className={`flex h-4 items-center gap-[1px] rounded px-1 ${p === current ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`}
                            >
                                {Array.from({ length: MANUAL_PAGE_STEPS }, (_, i) => {
                                    const on = MANUAL_ROWS.some(piece => manual.rows[piece]?.[p * MANUAL_PAGE_STEPS + i])
                                    return <span key={i} className={`h-1 w-[2px] rounded-full ${on ? 'bg-amber-300' : 'bg-white/15'}`} />
                                })}
                            </button>
                        ))}
                    </div>
                )}

                <span className="flex-1" />

                {!settings.manual && (
                    <span className="text-[10px] text-studio-text-dim">
                        Switch a step on and the region plays this pattern instead of a generated one
                    </span>
                )}

                <button
                    ref={actionsRef}
                    data-session-manual-actions
                    aria-label="Pattern actions"
                    onClick={() => setActionsOpen(v => !v)}
                    className="rounded p-1 text-studio-text-dim transition-colors hover:text-white"
                >
                    <MoreHorizontal className="h-4 w-4" />
                </button>
            </div>

            {/* ── The grid ──────────────────────────────────────────────── */}
            <div className="flex flex-col gap-1">
                {MANUAL_ROWS.map(piece => {
                    const info = PIECES.find(p => p.id === piece)!
                    const muted = !!manual.muted[piece]
                    return (
                        <div key={piece} className="flex items-center gap-2">
                            <button
                                data-session-manual-mute={piece}
                                aria-pressed={!muted}
                                title={`${info.label} — ${muted ? 'muted' : 'playing'}`}
                                aria-label={`${info.label} row`}
                                onClick={() => write({ ...manual, muted: { ...manual.muted, [piece]: !muted } })}
                                className={`flex h-5 w-6 shrink-0 items-center justify-center rounded text-[12px] transition-colors ${muted
                                    ? 'text-studio-text-dim/30 hover:text-studio-text-dim'
                                    : 'bg-amber-400/20 text-amber-300'}`}
                            >
                                {info.glyph}
                            </button>
                            <div className="flex flex-1 gap-[3px]">
                                {Array.from({ length: visible }, (_, i) => {
                                    const at = offset + i
                                    const on = !!manual.rows[piece]?.[at]
                                    return (
                                        <button
                                            key={at}
                                            data-session-manual-step={`${piece}:${at}`}
                                            aria-pressed={on}
                                            aria-label={`${info.label} step ${at + 1}`}
                                            onClick={() => toggleStep(piece, at)}
                                            className={`h-5 flex-1 rounded-[3px] transition-colors ${on
                                                ? muted ? 'bg-white/25' : 'bg-amber-400'
                                                : at % 4 === 0 ? 'bg-white/[0.12] hover:bg-white/20' : 'bg-white/[0.06] hover:bg-white/15'}`}
                                        />
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>

            <Popover open={lengthOpen} anchorRef={lengthRef} width={140} onClose={() => setLengthOpen(false)}
                data-session-manual-lengths>
                {LENGTHS.map(l => (
                    <MenuItem
                        key={l.steps}
                        data-session-manual-length-row={l.steps}
                        label={l.label}
                        checked={manual.length === l.steps}
                        onClick={() => { setLength(l.steps); setLengthOpen(false) }}
                    />
                ))}
            </Popover>

            <Popover open={actionsOpen} anchorRef={actionsRef} width={175} onClose={() => setActionsOpen(false)}
                data-session-manual-menu>
                <MenuItem
                    label="Copy Page"
                    data-session-manual-copy-page
                    onClick={() => {
                        const copied: Partial<Record<DrumPiece, boolean[]>> = {}
                        for (const piece of MANUAL_ROWS) {
                            copied[piece] = (manual.rows[piece] ?? []).slice(offset, offset + MANUAL_PAGE_STEPS)
                        }
                        pageClipboard = copied
                        setActionsOpen(false)
                    }}
                />
                <MenuItem
                    label="Paste Page"
                    data-session-manual-paste-page
                    disabled={!pageClipboard}
                    title={pageClipboard ? undefined : 'Copy a page first'}
                    onClick={() => {
                        if (!pageClipboard) return
                        const rows = { ...manual.rows }
                        for (const piece of MANUAL_ROWS) {
                            const row = [...(rows[piece] ?? Array.from({ length: manual.length }, () => false))]
                            pageClipboard[piece]?.forEach((v, i) => {
                                if (offset + i < manual.length) row[offset + i] = v
                            })
                            rows[piece] = row
                        }
                        write({ ...manual, rows })
                        setActionsOpen(false)
                    }}
                />
                <hr className="my-1 border-studio-line" />
                <MenuItem label="Copy Pattern" data-session-manual-copy
                    onClick={() => { patternClipboard = manual; setActionsOpen(false) }} />
                <MenuItem
                    label="Paste Pattern"
                    data-session-manual-paste
                    disabled={!patternClipboard}
                    title={patternClipboard ? undefined : 'Copy a pattern first'}
                    onClick={() => {
                        if (patternClipboard) write(patternClipboard)
                        setActionsOpen(false)
                    }}
                />
                <hr className="my-1 border-studio-line" />
                <MenuItem
                    label="Reset"
                    data-session-manual-reset
                    title="Clear the pattern and hand the region back to the generator"
                    onClick={() => { apply({ manual: null }); setPage(0); setActionsOpen(false) }}
                />
            </Popover>
        </section>
    )
}

/* ── Controls ───────────────────────────────────────────────────────────── */

/**
 * The padlock beside Fill Amount and Swing.
 *
 * Pinned, these two survive a change of preset. Without them the preset menu
 * is a way to lose the two settings most often dialled in by hand.
 */
/** The kit, drawn rather than fetched — it is a label, not a photograph. */
export function KitGraphic() {
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
