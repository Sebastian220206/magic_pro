"use client"

/**
 * Modulator.
 *
 * Target and waveform on top, depth and cycle length below, and the LFO's
 * cycle drawn from the processor's own `modulatorValue()` — the same rule the
 * Randomizer panel follows with its histogram, so the display cannot disagree
 * with what you hear.
 *
 * The LFO steps once per played note rather than running on the transport
 * clock, because the transform path never receives a beat. The notice at the
 * bottom says so instead of letting the Rate control imply a sync it has not
 * got.
 */

import React, { useMemo } from 'react';
import {
    MenuField, PanelNotice, PanelSection, RuledSlider, SliderRow,
    type MenuOption,
} from './controls';
import { modulatorValue, type ModulatorTarget, type ModulatorWaveform } from '@/engine/midi/fx/modulator';
import { toModulatorConfig } from '@/lib/midiFxSettings';
import type { MidiFxPanelProps } from './TransposerPanel';

const TARGET_OPTIONS: readonly MenuOption<ModulatorTarget>[] = [
    { value: 'velocity', label: 'Velocity' },
    { value: 'noteNumber', label: 'Note Number' },
];

const WAVEFORM_OPTIONS: readonly MenuOption<ModulatorWaveform>[] = [
    { value: 'sine', label: 'Sine' },
    { value: 'triangle', label: 'Triangle' },
    { value: 'square', label: 'Square' },
    { value: 'saw', label: 'Saw' },
    { value: 'random', label: 'Random' },
];

const PREVIEW_STEPS = 32;

export function ModulatorPanel({ settings, onChange }: MidiFxPanelProps) {
    const config = toModulatorConfig(settings);
    const steps = Math.max(2, Math.round(config.stepsPerCycle));

    // One LFO cycle sampled from the processor's own function. Random freezes
    // one draw per waveform selection rather than jittering every render.
    const cycle = useMemo(
        () => Array.from({ length: PREVIEW_STEPS }, (_, i) =>
            modulatorValue(i / PREVIEW_STEPS, config.waveform, () => (i * 0.61803398875) % 1)),
        [config.waveform],
    );

    const depthUnit = config.target === 'noteNumber' ? 'semi' : 'vel';

    return (
        <div className="flex flex-col gap-2 p-2.5 w-[400px] max-w-[calc(100vw-2rem)]">
            <PanelSection className="px-3 py-3 flex flex-col gap-3">
                <div className="flex items-center gap-5">
                    <MenuField
                        label="Target"
                        width={130}
                        value={config.target}
                        options={TARGET_OPTIONS}
                        onChange={v => onChange({ target: v })}
                        title="Which property of the note the LFO moves"
                    />
                    <MenuField
                        label="Waveform"
                        width={130}
                        value={config.waveform}
                        options={WAVEFORM_OPTIONS}
                        onChange={v => onChange({ waveform: v })}
                        title="The LFO's shape over one cycle"
                    />
                </div>
            </PanelSection>

            <PanelSection className="p-2.5">
                <div className="rounded-[4px] border border-amber-900/60 bg-gradient-to-b from-amber-950/60 to-black/70 p-2.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-400">LFO Cycle</span>
                        <span className="text-[11px] font-bold tabular-nums text-amber-300">
                            ±{config.depth} {depthUnit}
                        </span>
                    </div>

                    <div
                        className="h-[72px] flex items-center gap-[2px]"
                        role="img"
                        aria-label={`${config.waveform} cycle at depth ${config.depth}`}
                    >
                        {cycle.map((value, i) => (
                            <div
                                key={i}
                                className="flex-1 self-stretch flex items-center"
                            >
                                <div
                                    className="w-full rounded-[1px] bg-gradient-to-t from-amber-700/70 to-amber-400"
                                    style={{
                                        height: `${Math.max(2, Math.abs(value) * 50)}%`,
                                        marginTop: value < 0 ? '50%' : undefined,
                                        marginBottom: value >= 0 ? '50%' : undefined,
                                    }}
                                />
                            </div>
                        ))}
                    </div>

                    <div className="h-px bg-amber-200/20" />
                </div>
            </PanelSection>

            <PanelSection className="px-3 py-3 flex flex-col gap-3">
                <SliderRow
                    label="Depth"
                    readout={`±${config.depth} ${depthUnit}`}
                    hint={config.target === 'noteNumber'
                        ? 'Peak deflection in semitones'
                        : 'Peak deflection in velocity units'}
                >
                    <RuledSlider
                        ariaLabel="Depth"
                        value={config.depth}
                        min={0}
                        max={config.target === 'noteNumber' ? 24 : 64}
                        defaultValue={10}
                        onChange={v => onChange({ depth: v })}
                    />
                </SliderRow>

                <SliderRow
                    label="Cycle"
                    readout={`${steps} notes`}
                    hint="Notes per LFO cycle"
                >
                    <RuledSlider
                        ariaLabel="Notes per cycle"
                        value={steps}
                        min={2}
                        max={16}
                        defaultValue={8}
                        onChange={v => onChange({ stepsPerCycle: v })}
                        format={v => `${v} notes per cycle`}
                    />
                </SliderRow>
            </PanelSection>

            <PanelNotice>
                The LFO advances one step per played note, not with the transport — the
                note path carries no beat to sync to. Depth is a peak deflection{' '}
                {config.target === 'noteNumber' ? 'in semitones' : 'in velocity units'} around
                the note as played.
            </PanelNotice>
        </div>
    );
}
