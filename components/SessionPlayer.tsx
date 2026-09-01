"use client"

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RotateCcw, Lock, Unlock, Play, MoreHorizontal, ChevronDown, Check } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import {
    generateDrummerPattern,
    patternPreview,
    emptyManualPattern,
    resolveTempoMode,
    DEFAULT_DRUMMER_SETTINGS,
    PATTERN_COUNT,
    MANUAL_PAGE_STEPS,
    type DrummerSettings,
    type DrumPiece,
    type ManualPattern,
    type TempoMode,
} from '@/lib/drummerPattern'
import {
    allPresets,
    applyPreset,
    presetPayload,
    saveUserPreset,
    deleteUserPreset,
    matchPreset,
    type SessionPreset,
} from '@/lib/sessionPresets'
import type { Clip } from '@/models/Clip'

/**
 * The Session Player Editor.
 *
 * Opens from the Editors button on a drummer track, where a software
 * instrument gets the piano roll.
 *
 * Every control here writes into `lib/drummerPattern` and regenerates the
 * region's notes, which the `DrumMachine` then plays. That is the whole point
 * of building the generator first: a panel of knobs with nothing behind them
 * is the exact thing this codebase keeps having to remove. Where the manual
 * describes something this app has no data for — chords — the control is
 * dimmed and says so rather than pretending.
 */

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

export function SessionPlayer() {
    const tracks = useProjectStore(s => s.tracks)
    const clips = useProjectStore(s => s.clips)
    const focusedTrackId = useProjectStore(s => s.focusedTrackId)
    const selectedClipIds = useProjectStore(s => s.selectedClipIds)
    const updateClip = useProjectStore(s => s.updateClip)
    const timeSignature = useProjectStore(s => s.timeSignature)
    const tempo = useProjectStore(s => s.tempo)

    const [tab, setTab] = useState<'main' | 'details' | 'manual'>('main')
    const [presets, setPresets] = useState<SessionPreset[]>(() => allPresets())
    const [keepSettings, setKeepSettings] = useState(false)
    /*
     * The preset you picked, when more than one would match.
     *
     * Saving your own settings under a new name can produce a preset identical
     * to an included one, and the included ones are listed first — so the menu
     * reported the built-in's name back at you the moment you saved. This is
     * only ever *preferred*: it is dropped as soon as the settings stop
     * matching it, so it can never name a sound you are no longer on.
     */
    const [chosenPreset, setChosenPreset] = useState<string | null>(null)

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
    const stored = target?.drummerSettings
    const settings: DrummerSettings = useMemo(
        () => ({ ...DEFAULT_DRUMMER_SETTINGS, ...(stored ?? {}) }),
        [stored])

    const beatsPerBar = Number(timeSignature?.split('/')[0]) || 4
    const bars = Math.max(1, Math.round((target?.duration || beatsPerBar) / beatsPerBar))

    /**
     * Where a followed track's notes fall, in beats from this region's start.
     *
     * "Follow Rhythm Of / Track" is only meaningful if the rhythm is real, so
     * this reads the other track's actual regions rather than a placeholder.
     *
     * Takes the track id rather than reading `settings.followTrackId`: as a
     * memo keyed on the *current* value, the apply that chose a track computed
     * its notes from the previous one — so picking a track appeared to do
     * nothing until you touched some other control.
     */
    const onsetsFor = useCallback((followTrackId: string | null) => {
        if (!followTrackId || !target) return undefined
        const start = target.start ?? 0
        const end = start + (target.duration ?? 0)
        const onsets: number[] = []
        for (const clip of clips) {
            if (clip.trackId !== followTrackId) continue
            for (const note of clip.notes ?? []) {
                const at = (clip.start ?? 0) + (note.start ?? 0)
                if (at < start || at >= end) continue
                onsets.push(at - start)
            }
        }
        return onsets.sort((a, b) => a - b)
    }, [clips, target])

    /** Write the settings and the notes they produce back onto the region. */
    const apply = useCallback((next: Partial<DrummerSettings>) => {
        if (!target) return
        const merged: DrummerSettings = { ...settings, ...next }
        const notes = generateDrummerPattern(merged, {
            bars, beatsPerBar, tempo, followOnsets: onsetsFor(merged.followTrackId),
        }).map((n, i) => ({
            id: `drum-${target.id}-${i}`,
            pitch: n.pitch,
            start: n.start,
            duration: n.duration,
            velocity: Math.round(n.velocity * 127),
        }))
        updateClip(target.id, { drummerSettings: merged, notes } as Partial<Clip>)
    }, [target, settings, bars, beatsPerBar, tempo, onsetsFor, updateClip])

    /** Choose a preset — honouring the locks, and the "keep settings" pin. */
    const choosePreset = useCallback((preset: SessionPreset) => {
        if (keepSettings) return
        setChosenPreset(preset.name)
        apply(applyPreset(settings, preset))
    }, [apply, settings, keepSettings])

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

    const chosen = chosenPreset ? presets.find(p => p.name === chosenPreset) : undefined
    const presetName = (chosen && matchPreset(settings, [chosen]) === chosenPreset)
        ? chosenPreset
        : matchPreset(settings, presets)

    return (
        <div data-session-player className="flex h-full flex-col overflow-hidden bg-studio-panel">
            {/* ── Menu bar ──────────────────────────────────────────────── */}
            <header className="flex h-8 shrink-0 items-center justify-between gap-3 border-b border-studio-line px-3">
                <div className="flex items-center gap-3">
                    <ChordsMenu />
                    <PresetMenu
                        presets={presets}
                        current={presetName}
                        keepSettings={keepSettings}
                        onChoose={choosePreset}
                        onSave={name => {
                            saveUserPreset(name, settings)
                            setPresets(allPresets())
                            setChosenPreset(name.trim() || null)
                        }}
                        onDelete={name => {
                            deleteUserPreset(name)
                            setPresets(allPresets())
                            setChosenPreset(null)
                        }}
                        onRecallDefault={() => apply(applyPreset(settings, presets[0]))}
                        onCopy={() => { settingsClipboard = presetPayload(settings) }}
                        onPaste={() => { if (settingsClipboard) apply(settingsClipboard) }}
                        canPaste={!!settingsClipboard}
                        onToggleKeep={() => setKeepSettings(v => !v)}
                    />
                </div>

                <h2 className="text-[12px] font-bold">Session Player</h2>

                <div className="flex items-center gap-1">
                    {(['main', 'details', 'manual'] as const).map(id => (
                        <button
                            key={id}
                            data-session-tab={id}
                            title={id === 'manual' ? 'Type a pattern in, step by step' : undefined}
                            onClick={() => setTab(id)}
                            className={`rounded px-2.5 py-0.5 text-[11px] font-semibold capitalize transition-colors ${tab === id
                                ? 'bg-white/10 text-white'
                                : 'text-studio-text-dim hover:text-white'}`}
                        >
                            {id}
                        </button>
                    ))}
                </div>
            </header>

            <RegionRuler region={target} bars={bars} beatsPerBar={beatsPerBar} color={track?.color} />

            <div className="flex min-h-0 flex-1 items-stretch gap-4 overflow-x-auto overflow-y-hidden p-4 daw-scrollbar-thin">
                {/* ── The kit, and the two big faders ───────────────────── */}
                <section className="flex shrink-0 items-end gap-4">
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] text-studio-text-dim">Acoustic Drummer</span>
                        <span className="text-[12px] font-semibold text-amber-300">
                            {presetName ?? track?.name ?? 'Drummer'}
                        </span>
                        <KitGraphic />
                        <button
                            data-session-reseed
                            title="Play it again — the same settings, a different take"
                            aria-label="Regenerate"
                            onClick={() => apply({ seed: (settings.seed % 997) + 1 })}
                            className="mt-1 flex items-center gap-1 rounded border border-studio-line bg-studio-control px-2 py-1 text-[10px] text-studio-text-dim transition-colors hover:text-white"
                        >
                            <RotateCcw className="h-3 w-3" /> Regenerate
                        </button>
                    </div>

                    <Fader label="Complexity" id="complexity" value={settings.complexity}
                        onChange={v => apply({ complexity: v })} />
                    <Fader label="Intensity" id="intensity" value={settings.intensity}
                        onChange={v => apply({ intensity: v })} />
                </section>

                {tab === 'main' && <MainTab settings={settings} tracks={tracks} trackId={track?.id} apply={apply} />}
                {tab === 'details' && <DetailsTab settings={settings} tempo={tempo} apply={apply} />}
                {tab === 'manual' && <ManualTab settings={settings} apply={apply} />}
            </div>
        </div>
    )
}

/* ── The region lane ────────────────────────────────────────────────────── */

/**
 * The strip above the controls: which region is being edited, and a way to
 * hear it.
 *
 * The manual's Play button sets the cycle area to the region and solos it,
 * which is what makes auditioning a preset useful — otherwise you hear the
 * whole arrangement and have to guess which part changed.
 */
function RegionRuler({ region, bars, beatsPerBar, color }: {
    region: Clip; bars: number; beatsPerBar: number; color?: string
}) {
    const play = useProjectStore(s => s.play)
    const stop = useProjectStore(s => s.stop)
    const playing = useProjectStore(s => s.playing)
    const movePlayhead = useProjectStore(s => s.movePlayhead)

    const audition = () => {
        if (playing) { stop(); return }
        const start = region.start ?? 0
        useProjectStore.setState({
            locatorLeft: start,
            locatorRight: start + (region.duration ?? beatsPerBar),
            cycleEnabled: true,
            skipCycleEnabled: false,
        })
        movePlayhead(start)
        play()
    }

    const startBar = Math.floor((region.start ?? 0) / beatsPerBar) + 1

    return (
        <div className="flex h-9 shrink-0 items-stretch gap-2 border-b border-studio-line bg-studio-sunken px-3 py-1">
            <button
                data-session-audition
                onClick={audition}
                title={playing ? 'Stop' : 'Play this region on its own, on a cycle'}
                aria-label={playing ? 'Stop' : 'Play region'}
                className="flex w-7 shrink-0 items-center justify-center rounded border border-studio-line bg-studio-control text-studio-text-dim transition-colors hover:text-white"
            >
                <Play className="h-3 w-3" fill={playing ? 'currentColor' : 'none'} />
            </button>

            {/* The region as it sits in the arrangement, with its bar lines. */}
            <div
                data-session-region
                className="relative flex flex-1 items-center overflow-hidden rounded border px-2"
                style={{
                    background: `${color ?? '#fb923c'}22`,
                    borderColor: `${color ?? '#fb923c'}88`,
                }}
            >
                <span className="relative z-10 truncate text-[10px] font-semibold text-amber-200">
                    {region.name || 'Drummer'}
                </span>
                <span className="relative z-10 ml-2 whitespace-nowrap text-[10px] text-studio-text-dim">
                    bar {startBar} · {bars} {bars === 1 ? 'bar' : 'bars'}
                </span>
                <div className="pointer-events-none absolute inset-0 flex items-stretch">
                    {Array.from({ length: bars }, (_, i) => (
                        <span key={i} className="flex-1 border-l border-white/10 first:border-l-0" />
                    ))}
                </div>
            </div>
        </div>
    )
}

/* ── Menus ──────────────────────────────────────────────────────────────── */

/**
 * A menu that escapes the panel's stacking context.
 *
 * The editor is the bottom of the window, so every menu here opens upward, and
 * an absolutely positioned child opening upward is painted under the timeline
 * whatever its z-index — an ancestor establishes the context. Fixed
 * coordinates taken from the trigger's own rect are the way out; the transport
 * bar's display menu hit exactly this.
 */
function Popover({ open, anchorRef, width, onClose, children, ...rest }: {
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
            className="z-[9000] rounded-lg border border-studio-line-strong bg-studio-panel/97 p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-md"
            {...rest}
        >
            {children}
        </div>,
        document.body,
    )
}

/** One row of a menu. */
function MenuItem({ label, onClick, checked, disabled, title, ...rest }: {
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

/**
 * The Chords menu.
 *
 * The manual puts it here because the Bass and Keyboard Players follow a Chord
 * track. This app has a key signature and no chord track, so there is nothing
 * for it to list — and a menu that opens onto nothing is worse than one that
 * says why it is closed.
 */
function ChordsMenu() {
    return (
        <button
            data-session-chords
            disabled
            title="Chords need a Chord track, which this project does not have yet. The Drummer would not follow them in any case — it is the Bass and Keyboard Players that do."
            className="flex cursor-default items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-studio-text-dim/40"
        >
            Chords <ChevronDown className="h-3 w-3" />
        </button>
    )
}

function PresetMenu({
    presets, current, keepSettings, onChoose, onSave, onDelete,
    onRecallDefault, onCopy, onPaste, canPaste, onToggleKeep,
}: {
    presets: SessionPreset[]
    current: string | null
    keepSettings: boolean
    onChoose: (p: SessionPreset) => void
    onSave: (name: string) => void
    onDelete: (name: string) => void
    onRecallDefault: () => void
    onCopy: () => void
    onPaste: () => void
    canPaste: boolean
    onToggleKeep: () => void
}) {
    const ref = useRef<HTMLButtonElement>(null)
    const [open, setOpen] = useState(false)
    const [naming, setNaming] = useState(false)
    const [draft, setDraft] = useState('')

    const chosen = presets.find(p => p.name === current)

    return (
        <>
            <button
                ref={ref}
                data-session-preset-menu
                onClick={() => setOpen(v => !v)}
                title="Presets — settings you can browse, save and come back to"
                className="flex items-center gap-1.5 text-[11px]"
            >
                <span className="font-bold uppercase tracking-wider text-studio-text-dim">Preset</span>
                <span data-session-preset className="text-amber-300">{current ?? 'Custom'}</span>
                <ChevronDown className="h-3 w-3 text-studio-text-dim" />
            </button>

            <Popover open={open} anchorRef={ref} width={240} onClose={() => setOpen(false)}
                data-session-preset-list>
                {presets.map(p => (
                    <MenuItem
                        key={p.name}
                        data-session-preset-row={p.name}
                        label={p.name}
                        checked={p.name === current}
                        disabled={keepSettings}
                        title={keepSettings
                            ? 'Settings are pinned — turn off "Keep Settings when Changing Style" to load a preset'
                            : undefined}
                        onClick={() => { onChoose(p); setOpen(false) }}
                    />
                ))}

                <hr className="my-1 border-studio-line" />
                <MenuItem label="Copy" data-session-preset-copy
                    onClick={() => { onCopy(); setOpen(false) }} />
                <MenuItem label="Paste" data-session-preset-paste disabled={!canPaste}
                    title={canPaste ? undefined : 'Copy a region’s settings first'}
                    onClick={() => { onPaste(); setOpen(false) }} />

                <hr className="my-1 border-studio-line" />
                {naming ? (
                    <form
                        className="px-2 py-1"
                        onSubmit={e => {
                            e.preventDefault()
                            if (draft.trim()) onSave(draft)
                            setDraft(''); setNaming(false); setOpen(false)
                        }}
                    >
                        <input
                            data-session-preset-name
                            autoFocus
                            value={draft}
                            onChange={e => setDraft(e.target.value)}
                            placeholder="Preset name"
                            className="w-full rounded border border-studio-line bg-studio-sunken px-1.5 py-1 text-[11px] outline-none focus:border-accent-cyan"
                        />
                    </form>
                ) : (
                    <MenuItem label="Save…" data-session-preset-save onClick={() => setNaming(true)} />
                )}
                <MenuItem
                    label="Delete"
                    data-session-preset-delete
                    disabled={!chosen || chosen.builtIn}
                    title={chosen?.builtIn ? 'Included presets cannot be deleted' : undefined}
                    onClick={() => { if (chosen) onDelete(chosen.name); setOpen(false) }}
                />
                <MenuItem label="Recall Default" data-session-preset-default
                    onClick={() => { onRecallDefault(); setOpen(false) }} />
                <MenuItem
                    label="Keep Settings when Changing Style"
                    data-session-preset-keep
                    checked={keepSettings}
                    onClick={onToggleKeep}
                />
            </Popover>
        </>
    )
}

/* ── Main ───────────────────────────────────────────────────────────────── */

function MainTab({ settings, tracks, trackId, apply }: {
    settings: DrummerSettings
    tracks: Array<{ id: string; name: string; type: string }>
    trackId?: string
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
            <section className="relative flex min-w-[380px] flex-1 flex-col justify-center gap-4 rounded-lg border border-studio-line bg-studio-sunken px-4 py-3">
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
                            <span className="text-[11px] text-studio-text-dim/40">Chords</span>
                            <button
                                data-session-follow-chords
                                disabled
                                aria-label="Follow the rhythm of the chords"
                                title="Following chords needs a Chord track, which this project does not have yet"
                                className="flex h-3.5 w-7 cursor-default items-center rounded-full bg-white/10"
                            >
                                <span className="ml-0.5 block h-2.5 w-2.5 rounded-full bg-white/30" />
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
                                        && ['midi', 'software-instrument', 'external-midi', 'drummer'].includes(t.type))
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

function DetailsTab({ settings, tempo, apply }: {
    settings: DrummerSettings
    tempo: number
    apply: (next: Partial<DrummerSettings>) => void
}) {
    const resolved = resolveTempoMode(settings.tempoMode, tempo)

    return (
        <section className="flex min-w-[640px] flex-1 items-center justify-around gap-6 rounded-lg border border-studio-line bg-studio-sunken px-6 py-3">
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
function ManualTab({ settings, apply }: {
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
        <section className="flex min-w-[560px] flex-1 flex-col justify-center gap-2 rounded-lg border border-studio-line bg-studio-sunken px-4 py-3">
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
function LockButton({ id, locked, onToggle, what }: {
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
