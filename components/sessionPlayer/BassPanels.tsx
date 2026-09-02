"use client"

/**
 * The Bass Player's own controls.
 *
 * Main carries what shapes the line — the pattern, which notes it may use,
 * octave jumps, phrasing and the lowest note it can reach. Details carries the
 * articulations: muting, dead notes, pickup hits, slides and Align Root.
 *
 * Every one of them changes the notes in the region; none is a label.
 */
import React from 'react'
import { Knob, Picker, Toggle, NoteSlider, LockButton } from './controls'
import { PatternRow } from './PatternRow'
import {
    type BassSettings, BASS_LOW_B, BASS_HIGH,
} from '@/lib/bassPlayer'
import type { Track } from '@/models/Track'

const MELODY = ['root-only', 'root-fifth', 'chord-tones', 'passing'] as const
const OCTAVES = ['off', 'few', 'some', 'more'] as const
const PHRASING = ['short', 'medium', 'long'] as const

const MELODY_LABEL: Record<string, string> = {
    'root-only': 'Root Only',
    'root-fifth': 'Root & Fifth',
    'chord-tones': 'Chord Tones',
    passing: 'Passing Notes',
};

export function BassMain({ settings, tracks, trackId, hasChords, apply }: {
    settings: BassSettings
    tracks: Track[]
    trackId?: string
    hasChords: boolean
    apply: (next: Partial<BassSettings>) => void
}) {
    return (
        <>
            <section className="flex md:min-w-[380px] flex-1 flex-col justify-center gap-3 rounded-lg border border-studio-line bg-studio-sunken px-4 py-3">
                <PatternRow
                    variation={settings.variation}
                    complexity={settings.complexity}
                    followTrackId={settings.followTrackId}
                    followChords={settings.followChords}
                    tracks={tracks}
                    trackId={trackId}
                    hasChords={hasChords}
                    onVariation={v => apply({ variation: v })}
                    onFollowTrack={id => apply({ followTrackId: id })}
                    onFollowChords={on => apply({ followChords: on })}
                />

                <div className="flex items-end gap-5">
                    <Picker label="Melody" id="melody" value={settings.melody} options={MELODY}
                        format={v => MELODY_LABEL[v] ?? v}
                        onChange={v => apply({ melody: v as BassSettings['melody'] })} />
                    <Picker label="Octaves" id="octaves" value={settings.octaves} options={OCTAVES}
                        onChange={v => apply({ octaves: v as BassSettings['octaves'] })} />
                    <Picker label="Phrasing" id="phrasing" value={settings.phrasing} options={PHRASING}
                        onChange={v => apply({ phrasing: v as BassSettings['phrasing'] })} />
                    <div className="md:min-w-[150px] flex-1">
                        <NoteSlider
                            id="lowestNote"
                            label="Lowest Note"
                            value={settings.lowestNote}
                            low={BASS_LOW_B}
                            high={BASS_HIGH - 12}
                            onChange={v => apply({ lowestNote: v })}
                            title="The lowest note the player can reach. B0 emulates a five-string."
                        />
                    </div>
                </div>
            </section>

            <FillsAndSwing settings={settings} apply={apply} />
        </>
    )
}

export function BassDetails({ settings, apply }: {
    settings: BassSettings
    apply: (next: Partial<BassSettings>) => void
}) {
    return (
        <section className="flex md:min-w-[560px] flex-1 items-center justify-around gap-6 rounded-lg border border-studio-line bg-studio-sunken px-6 py-3">
            <div className="flex flex-col items-center gap-3">
                <div className="flex gap-4">
                    <Knob label="Dead Notes" id="deadNotes" value={settings.deadNotes}
                        onChange={v => apply({ deadNotes: v })}
                        title="Percussive, near-pitchless notes between the real ones" />
                    <Knob label="Slides" id="slides" value={settings.slides}
                        onChange={v => apply({ slides: v })}
                        title="How often the line slides into a note from a step below" />
                </div>
                <Toggle id="pickupHits" label="Pickup Hits" on={settings.pickupHits}
                    onToggle={() => apply({ pickupHits: !settings.pickupHits })}
                    title="Strike the strings with an open palm on the second and fourth beats" />
            </div>

            <div className="flex flex-col items-center gap-3">
                <Knob label="Mute Offset" id="muteOffset" value={settings.muteOffset}
                    onChange={v => apply({ muteOffset: v })}
                    title="How heavily the notes are muted — shorter, and with less weight" />
                <Toggle id="dynamicMute" label="Dynamic Mute" on={settings.dynamicMute}
                    onToggle={() => apply({ dynamicMute: !settings.dynamicMute })}
                    title="Mute according to what is around a note rather than uniformly" />
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
                        title="The spread between the softest and hardest notes" />
                    <Knob label="Humanize" id="humanize" value={settings.humanize}
                        onChange={v => apply({ humanize: v })}
                        title="How much the timing and velocity wander" />
                </div>
            </div>

            <div className="flex flex-col items-center gap-3">
                <Knob label="Phrase Variation" id="phraseVariation" value={settings.phraseVariation}
                    onChange={v => apply({ phraseVariation: v })}
                    title="How much the pattern changes from bar to bar" />
                <Toggle id="alignRoot" label="Align Root" on={settings.alignRoot}
                    onToggle={() => apply({ alignRoot: !settings.alignRoot })}
                    title="Choose closer intervals for root notes across a progression" />
            </div>
        </section>
    )
}

/**
 * Fills and swing, with their locks.
 *
 * Shared by both pitched players — the manual gives all three the same block,
 * down to the padlocks beside Fill Amount and Swing.
 */
export function FillsAndSwing<S extends {
    fillAmount: number; fillComplexity: number; swing: number
    swingGrid: '8th' | '16th'; lockFills: boolean; lockSwing: boolean
}>({ settings, apply }: { settings: S; apply: (next: Partial<S>) => void }) {
    return (
        <section className="flex shrink-0 items-start gap-5 rounded-lg border border-studio-line bg-studio-sunken px-5 py-3">
            <div className="flex items-start gap-1">
                <div className="flex flex-col gap-3">
                    <Knob label="Fill Amount" id="fillAmount" value={settings.fillAmount}
                        onChange={v => apply({ fillAmount: v } as Partial<S>)}
                        title="How often a phrase ends in a fill" />
                    <Knob label="Fill Complexity" id="fillComplexity" value={settings.fillComplexity}
                        onChange={v => apply({ fillComplexity: v } as Partial<S>)}
                        title="How busy those fills are" />
                </div>
                <LockButton id="fills" locked={settings.lockFills} what="the fills"
                    onToggle={() => apply({ lockFills: !settings.lockFills } as Partial<S>)} />
            </div>

            <div className="flex items-start gap-1">
                <div className="flex flex-col items-center gap-2">
                    <Knob label="Swing" id="swing" value={settings.swing}
                        onChange={v => apply({ swing: v } as Partial<S>)}
                        title="How far every second subdivision is pushed late" />
                    <button
                        data-session-swing-grid
                        title="Which subdivision the swing applies to"
                        onClick={() => apply({ swingGrid: settings.swingGrid === '8th' ? '16th' : '8th' } as Partial<S>)}
                        className="rounded border border-studio-line bg-studio-control px-2 py-0.5 text-[10px] font-semibold text-studio-text transition-colors hover:text-white"
                    >
                        {settings.swingGrid}
                    </button>
                </div>
                <LockButton id="swing" locked={settings.lockSwing} what="the swing"
                    onToggle={() => apply({ lockSwing: !settings.lockSwing } as Partial<S>)} />
            </div>
        </section>
    )
}

/** The bass, drawn rather than fetched — it is a label, not a photograph. */
export function BassGraphic() {
    return (
        <svg viewBox="0 0 100 70" className="h-16 w-24" aria-hidden="true">
            <g fill="none" stroke="#fbbf24" strokeWidth="1.6" strokeLinejoin="round">
                <path d="M30 50c-9 0-15-6-15-13s6-12 14-12c5 0 8 2 11 2s6-2 11-2c8 0 14 5 14 12S59 50 50 50c-5 0-7-2-10-2s-5 2-10 2z" />
                <path d="M63 33 88 16" />
                <rect x="86" y="9" width="10" height="9" rx="1.5" transform="rotate(-34 91 13)" />
                <circle cx="45" cy="36" r="5" />
                <path d="M66 30 88 14M61 37 84 21" strokeWidth="0.9" />
            </g>
        </svg>
    )
}
