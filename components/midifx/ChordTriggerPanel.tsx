"use client"

/**
 * Chord Trigger.
 *
 * The reference's frame: Single/Multi and Learn/Clear across the top, a blue
 * Input keyboard of trigger keys, an amber Output keyboard below it, and Chord
 * Transpose on the right of the output row.
 *
 * Where it departs, and why: Logic's Chord Trigger learns a voicing you play
 * and stores it per trigger key. This engine is interval-based — a chord type,
 * an inversion and a voicing, from `CHORD_LIBRARY` — so the panel exposes those
 * instead of a per-key learn grid it has no way to store. Learn is present and
 * dimmed with that reason rather than omitted, so the difference is visible
 * rather than looking like an oversight.
 *
 * The Output keyboard is computed by running the real `ChordTrigger` for the
 * selected trigger key, so it shows the notes that would actually sound —
 * inversion, voicing and transpose included — rather than the raw intervals.
 */

import React, { useMemo, useState } from 'react';
import {
    MenuField, MiniKeyboard, PanelButton, PanelSection, RuledSlider, ToggleButton,
    ValueReadout, noteName, type MenuOption,
} from './controls';
import { CHORD_LIBRARY, createChordTrigger, type ChordType, type VoicingType } from '@/engine/midi/fx/chordTrigger';
import { CHORD_TYPES, VOICINGS, MIDI_FX_DEFAULTS, toChordTriggerConfig } from '@/lib/midiFxSettings';
import type { MidiFxPanelProps } from './TransposerPanel';

const CHORD_OPTIONS: readonly MenuOption<ChordType>[] = CHORD_TYPES.map(type => ({
    value: type,
    label: CHORD_LIBRARY[type].name,
}));

const VOICING_LABELS: Record<VoicingType, string> = {
    'close': 'Close',
    'spread': 'Spread',
    'octave-doubling': 'Octave Doubling',
    'drop2': 'Drop 2',
    'drop3': 'Drop 3',
};

const VOICING_OPTIONS: readonly MenuOption<VoicingType>[] = VOICINGS.map(v => ({
    value: v,
    label: VOICING_LABELS[v],
}));

const INVERSION_OPTIONS: readonly MenuOption<string>[] = [
    { value: '0', label: 'Root Position' },
    { value: '1', label: '1st Inversion' },
    { value: '2', label: '2nd Inversion' },
    { value: '3', label: '3rd Inversion' },
];

const KEYBOARD_FROM = 48;
const KEYBOARD_TO = 83;

export function ChordTriggerPanel({ settings, onChange }: MidiFxPanelProps) {
    const config = toChordTriggerConfig(settings);
    /** Which trigger key the Output keyboard is previewing. */
    const [previewRoot, setPreviewRoot] = useState(60);

    // Run the real processor rather than re-deriving the voicing here, so the
    // preview cannot disagree with what plays.
    const chord = useMemo(() => {
        const trigger = createChordTrigger();
        trigger.deserialize(config);
        const pitches = trigger.noteOn(previewRoot, 100)
            .filter(e => e.type === 'note-on')
            .map(e => e.pitch);
        trigger.allNotesOff();
        return pitches;
    }, [config, previewRoot]);

    const output = useMemo(() => new Set(chord), [chord]);
    const triggers = useMemo(() => new Set([previewRoot]), [previewRoot]);

    return (
        <div className="flex flex-col gap-2 p-2.5 w-[600px] max-w-[calc(100vw-2rem)]">
            {/* Mode and learn */}
            <PanelSection className="px-3 py-2.5 flex items-center gap-2">
                <div className="flex gap-0.5">
                    <ToggleButton
                        active={config.triggerMode === 'single'}
                        onClick={() => onChange({ triggerMode: 'single' })}
                        title="One key sounds the whole chord"
                    >
                        Single
                    </ToggleButton>
                    <ToggleButton
                        active={config.triggerMode === 'multi'}
                        onClick={() => onChange({ triggerMode: 'multi' })}
                        title="Each held key sounds its own chord"
                    >
                        Multi
                    </ToggleButton>
                </div>

                <div className="ml-auto flex gap-0.5">
                    <PanelButton
                        onClick={() => { /* dimmed */ }}
                        disabled
                        title="This engine builds chords from intervals, so there is no per-key voicing to learn"
                    >
                        Learn
                    </PanelButton>
                    <PanelButton
                        onClick={() => onChange({ ...MIDI_FX_DEFAULTS.chordTrigger })}
                        title="Return every control to its default"
                    >
                        Clear
                    </PanelButton>
                </div>
            </PanelSection>

            {/* Chord definition */}
            <PanelSection className="px-3 py-3 flex flex-wrap items-center gap-x-5 gap-y-2.5">
                <MenuField
                    label="Chord" width={150} value={config.chordType} options={CHORD_OPTIONS}
                    onChange={v => onChange({ chordType: v })}
                    title="Intervals the trigger key is built into"
                />
                <MenuField
                    label="Voicing" width={150} value={config.voicing} options={VOICING_OPTIONS}
                    onChange={v => onChange({ voicing: v })}
                    title="How the chord tones are spread across octaves"
                />
                <MenuField
                    label="Inversion" width={140} value={String(config.inversion)} options={INVERSION_OPTIONS}
                    onChange={v => onChange({ inversion: Number(v) })}
                    title="Which chord tone sits at the bottom"
                />
            </PanelSection>

            {/* Input */}
            <PanelSection className="px-3 py-3 flex flex-col gap-2">
                <div className="flex items-baseline gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-studio-text-dim">Input</span>
                    <span className="text-[11px] text-studio-text-mid">Trigger Keys</span>
                    <span className="ml-auto text-[10.5px] text-studio-text-dim">
                        Click a key to preview it — {noteName(previewRoot)}
                    </span>
                </div>
                <MiniKeyboard
                    ariaLabel="Trigger keys"
                    from={KEYBOARD_FROM}
                    to={KEYBOARD_TO}
                    active={triggers}
                    onToggle={setPreviewRoot}
                    tone="cyan"
                    height={62}
                />
            </PanelSection>

            {/* Output */}
            <PanelSection className="px-3 py-3 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-studio-text-dim">Output</span>
                    <span className="text-[11px] tabular-nums text-amber-400">
                        {chord.map(noteName).join('  ') || '—'}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-[11px] text-studio-text-mid whitespace-nowrap">Chord Transpose</span>
                        <ValueReadout
                            value={`${config.transpose > 0 ? '+' : ''}${config.transpose}`}
                            width={44}
                        />
                    </div>
                </div>

                <MiniKeyboard
                    ariaLabel="Notes the chord sounds"
                    from={KEYBOARD_FROM}
                    to={KEYBOARD_TO}
                    active={output}
                    tone="amber"
                    height={62}
                />

                <RuledSlider
                    ariaLabel="Chord transpose"
                    value={config.transpose}
                    min={-12}
                    max={12}
                    defaultValue={0}
                    origin={0}
                    onChange={v => onChange({ transpose: v })}
                    format={v => `${v} semitones`}
                />
            </PanelSection>
        </div>
    );
}
