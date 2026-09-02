"use client"

/**
 * The Patterns button and its dialog, for the pitched players.
 *
 * One row of sixteen dots with a numbered button that opens the eight
 * patterns, and under them "Follow Rhythm Of" — the Chords switch and the
 * Track pop-up. The Drummer has several of these, one per group of kit pieces;
 * the Bass and Keyboard Players have one, which is what the manual specifies.
 */
import React, { useRef, useState } from 'react'
import { Popover, MenuHeading } from './controls'
import { rhythmPreview, RHYTHM_PATTERN_COUNT } from '@/lib/sessionRhythm'
import type { Track } from '@/models/Track'

export function PatternRow({
    variation, complexity, followTrackId, followChords, tracks, trackId,
    onVariation, onFollowTrack, onFollowChords, hasChords,
}: {
    variation: number
    complexity: number
    followTrackId: string | null
    followChords: boolean
    tracks: Track[]
    /** This player's own track, which it must not be offered as following. */
    trackId?: string
    onVariation: (v: number) => void
    onFollowTrack: (id: string | null) => void
    onFollowChords: (on: boolean) => void
    /** Whether there is any harmony to place emphasis on. */
    hasChords: boolean
}) {
    const buttonRef = useRef<HTMLButtonElement>(null)
    const [open, setOpen] = useState(false)
    const steps = rhythmPreview(variation, complexity)

    const followable = tracks.filter(t =>
        t.id !== trackId
        && ['midi', 'software-instrument', 'external-midi', 'drummer', 'bass-player', 'keyboard-player'].includes(t.type))
    const followed = tracks.find(t => t.id === followTrackId)

    return (
        <div className="flex flex-1 items-center gap-3">
            <button
                ref={buttonRef}
                data-session-variation="0"
                title="Choose a pattern"
                aria-label="Patterns"
                onClick={() => setOpen(o => !o)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-[#04070b]"
            >
                {variation}
            </button>

            <div className="flex flex-1 flex-col gap-1">
                <div data-session-steps="0" className="flex items-center gap-[3px]">
                    {steps.map((on, i) => (
                        <span
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-colors ${on
                                ? i % 4 === 0 ? 'bg-amber-300' : 'bg-amber-400/70'
                                : 'bg-white/10'}`}
                        />
                    ))}
                </div>
                <span data-session-follow-label className="text-[9px] text-studio-text-dim">
                    Follow: {[followChords && hasChords ? 'Chord Rhythm' : null, followed?.name]
                        .filter(Boolean).join(' / ') || 'Nothing'}
                </span>
            </div>

            <Popover open={open} anchorRef={buttonRef} width={320} onClose={() => setOpen(false)}
                data-session-variations="0">
                {Array.from({ length: RHYTHM_PATTERN_COUNT }, (_, i) => i + 1).map(v => (
                    <button
                        key={v}
                        data-session-variation-row={v}
                        onClick={() => { onVariation(v); setOpen(false) }}
                        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 transition-colors ${v === variation ? 'bg-white/10' : 'hover:bg-white/5'}`}
                    >
                        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-studio-line text-[9px] text-studio-text-dim">
                            {v}
                        </span>
                        <span className="flex flex-1 items-center gap-[2px]">
                            {rhythmPreview(v, complexity).map((on, i) => (
                                <span key={i} className={`h-1 flex-1 rounded-full ${on ? 'bg-amber-300/80' : 'bg-white/10'}`} />
                            ))}
                        </span>
                    </button>
                ))}

                <div className="mt-1 border-t border-studio-line pt-1">
                    <MenuHeading label="Follow Rhythm Of" />

                    <div className="flex items-center justify-between px-2 py-1">
                        <span className="text-[11px] text-studio-text">Chords</span>
                        <button
                            data-session-follow-chords
                            role="switch"
                            aria-checked={followChords && hasChords}
                            disabled={!hasChords}
                            title={hasChords
                                ? 'Place rhythmic emphasis where the chords change'
                                : 'There are no chords to follow yet — add some from the Chords menu, or write them on the Chord track'}
                            onClick={() => hasChords && onFollowChords(!followChords)}
                            className={`h-4 w-7 rounded-full p-[2px] transition-colors ${!hasChords
                                ? 'cursor-default bg-white/10'
                                : followChords ? 'bg-amber-400' : 'bg-white/15'}`}
                        >
                            <span className={`block h-3 w-3 rounded-full bg-white transition-transform ${followChords && hasChords ? 'translate-x-3' : ''}`} />
                        </button>
                    </div>

                    <div className="px-2 pb-1 pt-0.5 text-[11px] text-studio-text">Track</div>
                    <button
                        data-session-follow-track="none"
                        onClick={() => { onFollowTrack(null); setOpen(false) }}
                        className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] transition-colors ${followTrackId ? 'text-studio-text hover:bg-white/10' : 'bg-white/10 text-white'}`}
                    >
                        Off
                    </button>
                    {followable.length === 0 && (
                        <p className="px-2 py-1 text-[10px] leading-snug text-studio-text-dim/70">
                            No other track holds notes to follow yet.
                        </p>
                    )}
                    {followable.map(t => (
                        <button
                            key={t.id}
                            data-session-follow-track={t.id}
                            onClick={() => { onFollowTrack(t.id); setOpen(false) }}
                            className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] transition-colors ${t.id === followTrackId ? 'bg-white/10 text-white' : 'text-studio-text hover:bg-white/10'}`}
                        >
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.color || '#888' }} />
                            <span className="truncate">{t.name}</span>
                        </button>
                    ))}
                </div>
            </Popover>
        </div>
    )
}
