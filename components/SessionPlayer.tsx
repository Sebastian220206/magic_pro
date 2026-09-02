"use client"

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { RotateCcw, Play, ChevronDown, Check } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import {
    generateDrummerPattern,
    DEFAULT_DRUMMER_SETTINGS,
    type DrummerSettings,
} from '@/lib/drummerPattern'
import { generateBassLine, DEFAULT_BASS_SETTINGS, type BassSettings } from '@/lib/bassPlayer'
import { generateKeyboardPart, DEFAULT_KEYBOARD_SETTINGS, type KeyboardSettings } from '@/lib/keyboardPlayer'
import { harmonyFor, type Chord } from '@/lib/chords'
import {
    playerForTrackType, findStyle, defaultStyle, PLAYER_LABEL,
    type SessionPlayerKind, type SessionStyle,
} from '@/lib/sessionStyles'
import {
    allPresets,
    applyPreset,
    presetPayload,
    saveUserPreset,
    deleteUserPreset,
    matchPreset,
    defaultsFor,
    type SessionPreset,
    type AnySessionSettings,
} from '@/lib/sessionPresets'
import { MainTab, DetailsTab, ManualTab, KitGraphic } from './sessionPlayer/DrummerPanels'
import { BassMain, BassDetails, BassGraphic } from './sessionPlayer/BassPanels'
import { KeyboardMain, KeyboardDetails, KeyboardGraphic } from './sessionPlayer/KeyboardPanels'
import { ChordsMenu } from './sessionPlayer/ChordsMenu'
import { PlayerDialog } from './sessionPlayer/PlayerDialog'
import { PitchedManualTab } from './sessionPlayer/PitchedManualTab'
import { Fader, Popover, MenuItem } from './sessionPlayer/controls'
import type { Clip } from '@/models/Clip'

/**
 * The Session Player Editor.
 *
 * Opens from the Editors button on a Drummer, Bass Player or Keyboard Player
 * track, where a plain software instrument gets the piano roll.
 *
 * The shell is the same for all three - menu bar, region lane, the instrument
 * and its Complexity and Intensity faders - and only the panels below differ,
 * which is exactly how the manual describes it: settings common to every
 * Session Player, plus what is unique to each.
 *
 * Every control writes into a generator and regenerates the region's notes. A
 * panel of knobs with nothing behind them is the thing this codebase keeps
 * having to remove, so the three generators came first and this came second.
 */

/** What the region is worked on as, and what it carries. */
interface Session {
    kind: SessionPlayerKind
    settings: AnySessionSettings
}

/** The clipboard the Preset menu's Copy and Paste share, per player. */
const settingsClipboard: Partial<Record<SessionPlayerKind, Partial<AnySessionSettings>>> = {}

export function SessionPlayer() {
    const tracks = useProjectStore(s => s.tracks)
    const clips = useProjectStore(s => s.clips)
    const focusedTrackId = useProjectStore(s => s.focusedTrackId)
    const selectedClipIds = useProjectStore(s => s.selectedClipIds)
    const updateClip = useProjectStore(s => s.updateClip)
    const updateTrack = useProjectStore(s => s.updateTrack)
    const timeSignature = useProjectStore(s => s.timeSignature)
    const tempo = useProjectStore(s => s.tempo)
    const keySignature = useProjectStore(s => s.keySignature)
    const chordTrack = useProjectStore(s => s.globalTracks.chords)

    const [tab, setTab] = useState<'main' | 'details' | 'manual'>('main')
    const [keepSettings, setKeepSettings] = useState(false)
    const [changePatch, setChangePatch] = useState(true)
    /*
     * The preset you picked, when more than one would match.
     *
     * Saving your own settings under a new name can produce a preset identical
     * to an included one, and the included ones are listed first - so the menu
     * reported the built-in's name back at you the moment you saved. This is
     * only ever *preferred*: it is dropped as soon as the settings stop
     * matching it, so it can never name a sound you are no longer on.
     */
    const [chosenPreset, setChosenPreset] = useState<string | null>(null)

    /*
     * The region being edited: a selected one if it sits on a Session Player
     * track, otherwise the first region on the focused one. The same rule the
     * piano roll uses for choosing what it is looking at.
     */
    const target = useMemo(() => {
        const sessionTracks = new Set(
            tracks.filter(t => playerForTrackType(t.type)).map(t => t.id))
        const selected = clips.find(c => selectedClipIds?.includes(c.id) && sessionTracks.has(c.trackId))
        if (selected) return selected
        return clips.find(c => c.trackId === focusedTrackId && sessionTracks.has(c.trackId))
            ?? clips.find(c => sessionTracks.has(c.trackId))
    }, [tracks, clips, selectedClipIds, focusedTrackId])

    const track = tracks.find(t => t.id === target?.trackId)

    /*
     * Which player performs this region.
     *
     * The region wins over the track, so the Type pop-up can put a bass verse
     * and a keyboard chorus on one track - the manual's behaviour, and the
     * reason this is not simply read off the track type.
     */
    const kind: SessionPlayerKind =
        target?.sessionPlayer ?? playerForTrackType(track?.type) ?? 'drummer'

    const [presets, setPresets] = useState<SessionPreset[]>(() => allPresets(kind))
    const presetKind = useRef(kind)
    if (presetKind.current !== kind) {
        presetKind.current = kind
        // Reading during render rather than in an effect: the menu must never
        // show one player's presets while another player's panel is on screen.
        setPresets(allPresets(kind))
        setChosenPreset(null)
    }

    const settings: AnySessionSettings = useMemo(() => {
        const stored = kind === 'drummer' ? target?.drummerSettings
            : kind === 'bass' ? target?.bassSettings
                : target?.keyboardSettings
        return { ...defaultsFor(kind), ...(stored ?? {}) } as AnySessionSettings
    }, [kind, target])

    const beatsPerBar = Number(timeSignature?.split('/')[0]) || 4
    const bars = Math.max(1, Math.round((target?.duration || beatsPerBar) / beatsPerBar))

    /** Whether there is any harmony to follow — the Chords switch dims without it. */
    const hasChords = (target?.chords?.length ?? 0) > 0 || (chordTrack?.length ?? 0) > 0

    /**
     * Where a followed track's notes fall, in beats from this region's start.
     *
     * "Follow Rhythm Of / Track" is only meaningful if the rhythm is real, so
     * this reads the other track's actual regions rather than a placeholder.
     *
     * Takes the track id rather than reading `settings.followTrackId`: as a
     * memo keyed on the *current* value, the apply that chose a track computed
     * its notes from the previous one - so picking a track appeared to do
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

    /**
     * Write the settings, and the notes they produce, back onto the region.
     *
     * `chords` is passed separately rather than read off the region, for the
     * same reason as `followTrackId`: the write that changes the harmony has
     * to generate from the new harmony, not the one still in the store.
     */
    const apply = useCallback((
        next: Partial<AnySessionSettings>,
        options?: { chords?: Chord[] | undefined; chordsChanged?: boolean; kind?: SessionPlayerKind },
    ) => {
        if (!target) return
        const useKind = options?.kind ?? kind
        const base = options?.kind && options.kind !== kind ? defaultsFor(options.kind) : settings
        const merged = { ...base, ...next } as AnySessionSettings
        const chords = options?.chordsChanged ? options.chords : target.chords
        const regionStart = target.start ?? 0

        const harmony = { regionChords: chords, chordTrack, regionStart, keySignature }
        const raw = useKind === 'drummer'
            ? generateDrummerPattern(merged as DrummerSettings, {
                bars, beatsPerBar, tempo,
                followOnsets: onsetsFor(merged.followTrackId),
                chordChanges: merged.followChords
                    ? harmonyFor({ ...harmony, bars, beatsPerBar }).map(c => c.start).filter(b => b > 0)
                    : undefined,
            })
            : useKind === 'bass'
                ? generateBassLine(merged as BassSettings, {
                    bars, beatsPerBar, tempo, ...harmony,
                    followOnsets: onsetsFor(merged.followTrackId),
                })
                : generateKeyboardPart(merged as KeyboardSettings, {
                    bars, beatsPerBar, tempo, ...harmony,
                    followOnsets: onsetsFor(merged.followTrackId),
                })

        const notes = raw.map((n, i) => ({
            id: `sp-${target.id}-${i}`,
            pitch: n.pitch,
            start: n.start,
            duration: n.duration,
            velocity: Math.round(n.velocity * 127),
        }))

        const patch: Partial<Clip> = { notes, sessionPlayer: useKind }
        if (useKind === 'drummer') patch.drummerSettings = merged as DrummerSettings
        if (useKind === 'bass') patch.bassSettings = merged as BassSettings
        if (useKind === 'keyboard') patch.keyboardSettings = merged as KeyboardSettings
        if (options?.chordsChanged) patch.chords = options.chords
        updateClip(target.id, patch)
    }, [target, settings, kind, bars, beatsPerBar, tempo, onsetsFor, updateClip, chordTrack, keySignature])

    /** Choose a preset - honouring the locks, and the "keep settings" pin. */
    const choosePreset = useCallback((preset: SessionPreset) => {
        if (keepSettings) return
        setChosenPreset(preset.name)
        apply(applyPreset(settings, preset))
    }, [apply, settings, keepSettings])

    /** Choose a style: its settings, and its patch unless that is pinned off. */
    const chooseStyle = useCallback((style: SessionStyle<never>) => {
        const next = keepSettings
            ? {}
            : applyPreset(settings, { name: style.name, kind, builtIn: true, settings: style.settings })
        apply({ ...next, style: style.name } as Partial<AnySessionSettings>)
        if (changePatch && track) updateTrack(track.id, { instrument: style.patch })
    }, [apply, settings, kind, keepSettings, changePatch, track, updateTrack])

    if (!target) {
        return (
            <div data-session-player className="flex h-full items-center justify-center px-8 text-center">
                <p className="max-w-sm text-[13px] leading-relaxed text-studio-text-dim">
                    The Session Player edits a Drummer, Bass Player or Keyboard Player region.
                    Add one - draw it in the timeline - and it will open here.
                </p>
            </div>
        )
    }

    const chosen = chosenPreset ? presets.find(p => p.name === chosenPreset) : undefined
    const presetName = (chosen && matchPreset(settings, [chosen], kind) === chosenPreset)
        ? chosenPreset
        : matchPreset(settings, presets, kind)

    const styleName = (settings as { style?: string }).style ?? defaultStyle(kind)
    const graphic = kind === 'drummer' ? <KitGraphic />
        : kind === 'bass' ? <BassGraphic />
            : <KeyboardGraphic />

    return (
        <div data-session-player data-session-kind={kind} className="flex h-full flex-col overflow-hidden bg-studio-panel">
            {/* ── Menu bar ──────────────────────────────────────────────── */}
            <header className="flex h-8 shrink-0 items-center justify-between gap-3 border-b border-studio-line px-3">
                <div className="flex items-center gap-3">
                    <ChordsMenu
                        region={target}
                        bars={bars}
                        beatsPerBar={beatsPerBar}
                        onChange={chords => apply({}, { chords, chordsChanged: true })}
                    />
                    <PresetMenu
                        presets={presets}
                        current={presetName}
                        keepSettings={keepSettings}
                        onChoose={choosePreset}
                        onSave={name => {
                            saveUserPreset(name, settings, kind)
                            setPresets(allPresets(kind))
                            setChosenPreset(name.trim() || null)
                        }}
                        onDelete={name => {
                            deleteUserPreset(name, kind)
                            setPresets(allPresets(kind))
                            setChosenPreset(null)
                        }}
                        onRecallDefault={() => apply(applyPreset(settings, presets[0]))}
                        onCopy={() => { settingsClipboard[kind] = presetPayload(settings, kind) }}
                        onPaste={() => {
                            const payload = settingsClipboard[kind]
                            if (payload) apply(payload)
                        }}
                        canPaste={!!settingsClipboard[kind]}
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
                {/* ── The player, and the two big faders ────────────────── */}
                <section className="flex shrink-0 items-end gap-4">
                    <div className="flex flex-col items-center gap-1">
                        <PlayerDialog
                            kind={kind}
                            style={styleName}
                            changePatch={changePatch}
                            graphic={graphic}
                            name={presetName ?? styleName}
                            onKind={next => apply({}, { kind: next })}
                            onStyle={chooseStyle}
                            onChangePatch={setChangePatch}
                        />
                        <button
                            data-session-reseed
                            title="Play it again - the same settings, a different take"
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

                {kind === 'drummer' && tab === 'main' && (
                    <MainTab settings={settings as DrummerSettings} tracks={tracks} trackId={track?.id}
                        hasChords={hasChords} apply={apply} />
                )}
                {kind === 'drummer' && tab === 'details' && (
                    <DetailsTab settings={settings as DrummerSettings} tempo={tempo} apply={apply} />
                )}
                {kind === 'drummer' && tab === 'manual' && (
                    <ManualTab settings={settings as DrummerSettings} apply={apply} />
                )}

                {kind === 'bass' && tab === 'main' && (
                    <BassMain settings={settings as BassSettings} tracks={tracks} trackId={track?.id}
                        hasChords={hasChords} apply={apply} />
                )}
                {kind === 'bass' && tab === 'details' && (
                    <BassDetails settings={settings as BassSettings} apply={apply} />
                )}

                {kind === 'keyboard' && tab === 'main' && (
                    <KeyboardMain settings={settings as KeyboardSettings} tracks={tracks} trackId={track?.id}
                        hasChords={hasChords} apply={apply} />
                )}
                {kind === 'keyboard' && tab === 'details' && (
                    <KeyboardDetails settings={settings as KeyboardSettings} apply={apply} />
                )}

                {kind !== 'drummer' && tab === 'manual' && (
                    <PitchedManualTab settings={settings} kind={kind} apply={apply} />
                )}
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

