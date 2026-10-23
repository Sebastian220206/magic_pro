"use client"

/**
 * Randomizer.
 *
 * The reference's layout: event type and input range on top, the random amount
 * and its weight in the boxed display below, output offset at the bottom.
 *
 * The boxed display in the reference is a live histogram of where the scatter
 * lands. Ours is the same idea drawn honestly — it samples the processor's own
 * `weightedSample()` a few hundred times and bins the results, so moving Weight
 * visibly redistributes the bars. A drawn-on gradient would have been easier
 * and would have lied about what the control does.
 */

import React, { useMemo } from 'react';
import {
    MenuField, PanelSection, RuledRangeSlider, RuledSlider, SliderRow, ValueReadout,
    type MenuOption,
} from './controls';
import { weightedSample, type RandomizerTarget } from '@/engine/midi/fx/randomizer';
import { toRandomizerConfig } from '@/lib/midiFxSettings';
import type { MidiFxPanelProps } from './TransposerPanel';

const TARGET_OPTIONS: readonly MenuOption<RandomizerTarget>[] = [
    { value: 'velocity', label: 'Velocity' },
    { value: 'noteNumber', label: 'Note Number' },
];

const BINS = 24;
const SAMPLES = 600;

/** Bin `weightedSample` so the display shows the real distribution. */
function histogram(weight: number): number[] {
    const bins = new Array<number>(BINS).fill(0);
    for (let i = 0; i < SAMPLES; i++) {
        // -0.5…0.5 mapped onto the bin range.
        const index = Math.min(BINS - 1, Math.max(0, Math.floor((weightedSample(weight) + 0.5) * BINS)));
        bins[index]++;
    }
    const peak = Math.max(1, ...bins);
    return bins.map(count => count / peak);
}

export function RandomizerPanel({ settings, onChange }: MidiFxPanelProps) {
    const config = toRandomizerConfig(settings);
    // Re-sampled only when the weight moves; every other control leaves the
    // shape of the distribution alone.
    const bars = useMemo(() => histogram(config.weight), [config.weight]);

    return (
        <div className="flex flex-col gap-2 p-2.5 w-[400px] max-w-[calc(100vw-2rem)]">
            <PanelSection className="px-3 py-3 flex flex-col gap-3">
                <MenuField
                    label="Event Type"
                    width={168}
                    value={config.target}
                    options={TARGET_OPTIONS}
                    onChange={v => onChange({ target: v })}
                    title="Which property of the note is scattered"
                />

                <div className="flex items-center gap-3">
                    <span className="w-[92px] shrink-0 text-[11px] text-studio-text-mid">Input Range</span>
                    <div className="flex-1 min-w-0">
                        <RuledRangeSlider
                            ariaLabel="Input range"
                            low={config.inputLow}
                            high={config.inputHigh}
                            min={0}
                            max={127}
                            onChange={(low, high) => onChange({ inputLow: low, inputHigh: high })}
                        />
                    </div>
                    <div className="flex gap-1">
                        <ValueReadout value={String(config.inputLow)} width={40} />
                        <ValueReadout value={String(config.inputHigh)} width={40} />
                    </div>
                </div>

                <p className="text-[10.5px] text-studio-text-dim">
                    Notes outside this band pass through untouched.
                </p>
            </PanelSection>

            {/* The amber display: amount above, distribution, weight below. */}
            <PanelSection className="p-2.5">
                <div className="rounded-[4px] border border-amber-900/60 bg-gradient-to-b from-amber-950/60 to-black/70 p-2.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-400">Random</span>
                        <span className="text-[11px] font-bold tabular-nums text-amber-300">{config.amount}</span>
                    </div>

                    <div
                        className="h-[72px] flex items-end gap-[2px]"
                        role="img"
                        aria-label={`Distribution at weight ${config.weight} percent`}
                    >
                        {bars.map((height, i) => (
                            <div
                                key={i}
                                className="flex-1 rounded-t-[1px] bg-gradient-to-t from-amber-700/70 to-amber-400"
                                style={{
                                    // Scaled by amount so a scatter of zero reads
                                    // as a flat floor rather than a full display.
                                    height: `${Math.max(2, height * 100 * Math.min(1, config.amount / 64))}%`,
                                }}
                            />
                        ))}
                    </div>

                    <RuledSlider
                        ariaLabel="Random amount"
                        value={config.amount}
                        min={0}
                        max={127}
                        defaultValue={0}
                        onChange={v => onChange({ amount: v })}
                    />

                    <div className="flex items-center justify-between text-[10px] text-amber-200/70">
                        <span>Low</span>
                        <span className="text-amber-300">Weight&nbsp;&nbsp;{config.weight} %</span>
                        <span>High</span>
                    </div>
                    <RuledSlider
                        ariaLabel="Weight"
                        value={config.weight}
                        min={-100}
                        max={100}
                        defaultValue={0}
                        origin={0}
                        onChange={v => onChange({ weight: v })}
                        format={v => `${v} percent toward ${v < 0 ? 'low' : 'high'}`}
                    />
                </div>
            </PanelSection>

            <PanelSection className="px-3 py-3">
                <SliderRow
                    label="Output Offset"
                    readout={`${config.offset > 0 ? '+' : ''}${config.offset}`}
                >
                    <RuledSlider
                        ariaLabel="Output offset"
                        value={config.offset}
                        min={-127}
                        max={127}
                        defaultValue={0}
                        origin={0}
                        onChange={v => onChange({ offset: v })}
                    />
                </SliderRow>
            </PanelSection>
        </div>
    );
}
