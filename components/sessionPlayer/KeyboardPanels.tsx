"use client"

/**
 * The Keyboard Player's own controls.
 *
 * Two hands, each with a mute, a position on the keyboard, and its own rules —
 * voicing and style on the left, voicing and movement on the right. The manual
 * is careful that these interact: muting the left hand changes what the right
 * one plays, so the two buttons are not simply on/off switches for two
 * independent parts.
 */
import React from 'react'
import { Knob, Picker, NoteSlider } from './controls'
import { PatternRow } from './PatternRow'
import { FillsAndSwing } from './BassPanels'
import { type KeyboardSettings, KEYS_LOW, KEYS_HIGH } from '@/lib/keyboardPlayer'
import type { Track } from '@/models/Track'

const LEFT_VOICING = ['root-only', 'root-octave', 'root-fifth', 'root-fifth-octave', 'broken'] as const
const LEFT_STYLE = [
    'sustain-only', 'simple', 'moderate', 'complex',
    'follow-right-hand', 'steady-4ths', 'steady-8ths',
] as const
const RIGHT_VOICING = ['triad', 'four-voice', 'extensions', 'full-chord'] as const
const RIGHT_MOVEMENT = ['minimal', 'medium', 'wide'] as const
const PHRASING = ['staccato', 'mixed', 'legato'] as const

const LABEL: Record<string, string> = {
    'root-only': 'Root Only',
    'root-octave': 'Root & Octave',
    'root-fifth': 'Root & Fifth',
    'root-fifth-octave': 'Root, Fifth & Octave',
    broken: 'Broken',
    'sustain-only': 'Sustain Only',
    'follow-right-hand': 'Follow Right Hand',
    'steady-4ths': 'Steady 4ths',
    'steady-8ths': 'Steady 8ths',
    'four-voice': '4+ Voice',
    'full-chord': 'Full Chord',
};

const show = (v: string) => LABEL[v] ?? v.replace(/-/g, ' ')

export function KeyboardMain({ settings, tracks, trackId, hasChords, apply }: {
    settings: KeyboardSettings
    tracks: Track[]
    trackId?: string
    hasChords: boolean
    apply: (next: Partial<KeyboardSettings>) => void
}) {
    return (
        <>
            <section className="flex md:min-w-[420px] flex-1 flex-col justify-center gap-3 rounded-lg border border-studio-line bg-studio-sunken px-4 py-3">
                <div className="flex items-center gap-3">
                    <div className="flex shrink-0 gap-1.5">
                        <HandButton id="left" on={settings.leftHand}
                            onToggle={() => apply({ leftHand: !settings.leftHand })} />
                        <HandButton id="right" on={settings.rightHand}
                            onToggle={() => apply({ rightHand: !settings.rightHand })} />
                    </div>
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
                </div>

                <div className="flex items-start gap-6">
                    <div className="flex flex-1 flex-col gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-studio-text-dim">Left Hand</span>
                        <NoteSlider id="leftPosition" label="Position" value={settings.leftPosition}
                            low={KEYS_LOW} high={72}
                            onChange={v => apply({ leftPosition: v })}
                            title="Where the left hand sits on the keyboard" />
                        <div className="flex gap-4">
                            <Picker label="Voicing" id="leftVoicing" value={settings.leftVoicing}
                                options={LEFT_VOICING} format={show}
                                onChange={v => apply({ leftVoicing: v as KeyboardSettings['leftVoicing'] })} />
                            <Picker label="Style" id="leftStyle" value={settings.leftStyle}
                                options={LEFT_STYLE} format={show}
                                onChange={v => apply({ leftStyle: v as KeyboardSettings['leftStyle'] })} />
                        </div>
                    </div>

                    <div className="flex flex-1 flex-col gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-studio-text-dim">Right Hand</span>
                        <NoteSlider id="rightPosition" label="Position" value={settings.rightPosition}
                            low={52} high={KEYS_HIGH - 8}
                            onChange={v => apply({ rightPosition: v })}
                            title="Where the right hand sits on the keyboard" />
                        <div className="flex gap-4">
                            <Picker label="Voicing" id="rightVoicing" value={settings.rightVoicing}
                                options={RIGHT_VOICING} format={show}
                                onChange={v => apply({ rightVoicing: v as KeyboardSettings['rightVoicing'] })} />
                            <Picker label="Movement" id="rightMovement" value={settings.rightMovement}
                                options={RIGHT_MOVEMENT} format={show}
                                onChange={v => apply({ rightMovement: v as KeyboardSettings['rightMovement'] })} />
                        </div>
                    </div>
                </div>
            </section>

            <FillsAndSwing settings={settings} apply={apply} />
        </>
    )
}

export function KeyboardDetails({ settings, apply }: {
    settings: KeyboardSettings
    apply: (next: Partial<KeyboardSettings>) => void
}) {
    return (
        <section className="flex md:min-w-[520px] flex-1 items-center justify-around gap-6 rounded-lg border border-studio-line bg-studio-sunken px-6 py-3">
            <div className="flex flex-col items-center gap-3">
                <Knob label="Grace Notes" id="graceNotes" value={settings.graceNotes}
                    onChange={v => apply({ graceNotes: v })}
                    title="How often a note is led into from a step below" />
                <Picker label="Phrasing" id="phrasing" value={settings.phrasing}
                    options={PHRASING} onChange={v => apply({ phrasing: v as KeyboardSettings['phrasing'] })} />
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

            <Knob label="Phrase Variation" id="phraseVariation" value={settings.phraseVariation}
                onChange={v => apply({ phraseVariation: v })}
                title="How much the pattern changes from bar to bar" />
        </section>
    )
}

/**
 * One hand, muted or playing.
 *
 * The manual describes these as selected or dimmed rather than as a switch,
 * because a muted hand is still part of the performance — the other one plays
 * differently for it.
 */
function HandButton({ id, on, onToggle }: { id: 'left' | 'right'; on: boolean; onToggle: () => void }) {
    return (
        <button
            data-session-hand={id}
            aria-pressed={on}
            aria-label={`${id === 'left' ? 'Left' : 'Right'} hand`}
            title={`${id === 'left' ? 'Left' : 'Right'} hand — ${on ? 'playing' : 'muted'}`}
            onClick={onToggle}
            className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${on
                ? 'bg-amber-400/20 text-amber-300'
                : 'text-studio-text-dim/40 hover:text-studio-text-dim'}`}
        >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"
                style={{ transform: id === 'right' ? 'scaleX(-1)' : undefined }}>
                <path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-.5V4.5a1.5 1.5 0 0 1 3 0V11m0-.5V6a1.5 1.5 0 0 1 3 0v6.5" />
                <path d="M17 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-5-2.7l-2.2-3.3a1.5 1.5 0 0 1 2.4-1.8L9 15" />
            </svg>
        </button>
    )
}

/** The piano, drawn rather than fetched. */
export function KeyboardGraphic() {
    return (
        <svg viewBox="0 0 100 70" className="h-16 w-24" aria-hidden="true">
            <g fill="none" stroke="#fbbf24" strokeWidth="1.6" strokeLinejoin="round">
                <path d="M8 46h84M8 46V28h84v18" />
                <path d="M20 28v18M32 28v18M44 28v18M56 28v18M68 28v18M80 28v18" strokeWidth="1" />
                <path d="M16 28v11h8V28M40 28v11h8V28M52 28v11h8V28M64 28v11h8V28M76 28v11h8V28" strokeWidth="1" />
                <path d="M8 46v6h84v-6" />
            </g>
        </svg>
    )
}
