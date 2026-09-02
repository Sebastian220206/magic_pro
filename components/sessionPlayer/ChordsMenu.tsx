"use client"

/**
 * The Chords menu.
 *
 * The manual puts chord editing here because the Session Player Editor is
 * where region chords are edited, and because the Bass and Keyboard Players
 * are meaningless without harmony. Three things live in it:
 *
 *   - which chords this region follows: its own, or the global Chord track
 *   - a set of progressions, as the quick way to give a region harmony
 *   - the chords themselves, listed, editable and removable
 *
 * Nothing here is decorative: every row writes chords that the players read on
 * their next regeneration.
 */
import React, { useRef, useState } from 'react'
import { ChevronDown, Plus, X } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import { Popover, MenuItem, MenuHeading } from './controls'
import {
    formatChord, parseChord, progressionChords, tonicOf, PROGRESSIONS,
    type Chord,
} from '@/lib/chords'
import type { Clip } from '@/models/Clip'

export function ChordsMenu({ region, bars, beatsPerBar, onChange }: {
    region: Clip
    bars: number
    beatsPerBar: number
    /** Called whenever the harmony changes, so the part is regenerated. */
    onChange: (chords: Chord[] | undefined) => void
}) {
    const ref = useRef<HTMLButtonElement>(null)
    const [open, setOpen] = useState(false)
    const [draft, setDraft] = useState('')
    const [error, setError] = useState<string | null>(null)

    const chordTrack = useProjectStore(s => s.globalTracks.chords ?? [])
    const setChordTrack = useProjectStore(s => s.setChordTrack)
    const keySignature = useProjectStore(s => s.keySignature)

    const regionChords = region.chords ?? []
    const followingRegion = regionChords.length > 0

    /** Where the next chord would start: after the last one, or at the top. */
    const nextStart = followingRegion
        ? Math.min(bars * beatsPerBar - 1,
            Math.max(...regionChords.map(c => c.start + c.duration)))
        : 0

    const add = () => {
        const parsed = parseChord(draft)
        if (!parsed) {
            setError(`"${draft.trim()}" is not a chord this can read`)
            return
        }
        setError(null)
        setDraft('')
        const start = nextStart
        const remaining = Math.max(1, bars * beatsPerBar - start)
        onChange([
            ...regionChords,
            { id: `chord-${Date.now()}`, start, duration: Math.min(beatsPerBar, remaining), ...parsed },
        ])
    }

    const applyProgression = (index: number) => {
        const chords = progressionChords(PROGRESSIONS[index], { keySignature, bars, beatsPerBar })
        onChange(chords.map((c, i) => ({ ...c, id: `chord-${Date.now()}-${i}` })))
        setOpen(false)
    }

    return (
        <>
            <button
                ref={ref}
                data-session-chords
                aria-haspopup="menu"
                title="The chords this region follows"
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-studio-text-dim transition-colors hover:text-white"
            >
                Chords <ChevronDown className="h-3 w-3" />
            </button>

            <Popover open={open} anchorRef={ref} width={280} onClose={() => setOpen(false)}
                data-session-chords-menu>
                <MenuHeading label="Follow" />
                <MenuItem
                    data-session-chord-source="region"
                    label="Region chords"
                    checked={followingRegion}
                    title="This region plays its own chords, whatever is on the Chord track"
                    onClick={() => {
                        if (followingRegion) return
                        onChange(progressionChords(PROGRESSIONS[0], { keySignature, bars, beatsPerBar })
                            .map((c, i) => ({ ...c, id: `chord-${Date.now()}-${i}` })))
                    }}
                />
                <MenuItem
                    data-session-chord-source="track"
                    label={`Chord track${chordTrack.length ? ` (${chordTrack.length})` : ' — empty'}`}
                    checked={!followingRegion}
                    title="Follow the global Chord track, so every Session Player stays in sync"
                    onClick={() => onChange(undefined)}
                />

                <MenuHeading label="Progressions" />
                {PROGRESSIONS.map((p, i) => (
                    <MenuItem
                        key={p.name}
                        data-session-progression={p.name}
                        label={p.name}
                        title={`Write ${p.name} across this region, in ${keySignature}`}
                        onClick={() => applyProgression(i)}
                    />
                ))}
                <MenuItem
                    data-session-progression-to-track
                    label="Copy these chords to the Chord track"
                    disabled={!followingRegion}
                    title={followingRegion
                        ? 'Put this region\'s chords on the global Chord track, so other players follow them too'
                        : 'This region has no chords of its own to copy'}
                    onClick={() => {
                        const start = region.start ?? 0
                        setChordTrack(regionChords.map((c, i) => ({
                            ...c, id: `track-${Date.now()}-${i}`, start: c.start + start,
                        })))
                        setOpen(false)
                    }}
                />

                <MenuHeading label={followingRegion ? 'Region chords' : `Chord track — key of ${tonicOf(keySignature).root === 0 ? keySignature : keySignature}`} />
                <div className="max-h-40 overflow-y-auto daw-scrollbar-thin">
                    {(followingRegion ? regionChords : chordTrack).length === 0 && (
                        <p className="px-2 py-1 text-[10px] leading-snug text-studio-text-dim/70">
                            Nothing written. The players fall back to the tonic of {keySignature}.
                        </p>
                    )}
                    {(followingRegion ? regionChords : chordTrack).map(chord => (
                        <div key={chord.id} data-session-chord={chord.id}
                            className="flex items-center gap-2 rounded px-2 py-0.5 hover:bg-white/5">
                            <span className="w-10 shrink-0 text-[10px] text-studio-text-dim">
                                {(chord.start / beatsPerBar + 1).toFixed(chord.start % beatsPerBar ? 2 : 0)}
                            </span>
                            <span className="flex-1 text-[11px] font-semibold text-amber-300">
                                {formatChord(chord)}
                            </span>
                            {followingRegion && (
                                <button
                                    data-session-chord-delete={chord.id}
                                    aria-label={`Delete ${formatChord(chord)}`}
                                    title="Remove this chord"
                                    onClick={() => onChange(regionChords.filter(c => c.id !== chord.id))}
                                    className="rounded p-0.5 text-studio-text-dim transition-colors hover:text-white"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <div className="mt-1 flex items-center gap-1 border-t border-studio-line px-1 pt-1.5">
                    <input
                        data-session-chord-input
                        value={draft}
                        placeholder="Am7, F#m, C/E…"
                        aria-label="Add a chord"
                        onChange={e => { setDraft(e.target.value); setError(null) }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
                        className="min-w-0 flex-1 rounded border border-studio-line bg-black/30 px-1.5 py-0.5 text-[11px] text-white outline-none placeholder:text-studio-text-dim/50 focus:border-accent-cyan"
                    />
                    <button
                        data-session-chord-add
                        aria-label="Add chord"
                        title="Add this chord to the region"
                        onClick={add}
                        className="rounded border border-studio-line bg-studio-control p-1 text-studio-text-dim transition-colors hover:text-white"
                    >
                        <Plus className="h-3 w-3" />
                    </button>
                </div>
                {error && (
                    <p data-session-chord-error className="px-2 pt-1 text-[10px] text-red-300">{error}</p>
                )}
            </Popover>
        </>
    )
}
