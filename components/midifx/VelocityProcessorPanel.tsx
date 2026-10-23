"use client"

/**
 * Velocity Processor.
 *
 * No reference image was supplied for this one, so the layout follows the
 * house shape the other panels share rather than inventing a look for it: a
 * mode selector, the controls that mode uses, then the range that applies to
 * every mode.
 *
 * The response curve is drawn by running 0–127 through `shapeVelocity()` — the
 * function the processor itself calls. Anything the curve shows is therefore
 * what the next note will do, which is the whole point of showing it; a curve
 * derived from a second copy of the maths would drift the first time either
 * side changed.
 */

import React from 'react';
import {
    MenuField, PanelSection, RuledSlider, SliderRow, ToggleButton, ValueReadout,
    type MenuOption,
} from './controls';
import { shapeVelocity, type VelocityMode } from '@/engine/midi/fx/velocityProcessor';
import { toVelocityConfig } from '@/lib/midiFxSettings';
import type { MidiFxPanelProps } from './TransposerPanel';

const MODE_OPTIONS: readonly MenuOption<VelocityMode>[] = [
    { value: 'value', label: 'Value' },
    { value: 'compand', label: 'Compand' },
    { value: 'random', label: 'Random' },
];

const CURVE_WIDTH = 190;
const CURVE_HEIGHT = 92;

/** The response as an SVG path, sampled every four velocities. */
function curvePath(config: ReturnType<typeof toVelocityConfig>): string {
    const points: string[] = [];
    for (let v = 1; v <= 127; v += 4) {
        // A fixed 0.5 in place of Math.random keeps the drawn curve still while
        // Random mode is selected; the scatter's centre is what it describes.
        const out = shapeVelocity(v, config, () => 0.5);
        const x = ((v - 1) / 126) * CURVE_WIDTH;
        const y = CURVE_HEIGHT - (out / 127) * CURVE_HEIGHT;
        points.push(`${points.length === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return points.join(' ');
}

export function VelocityProcessorPanel({ settings, onChange }: MidiFxPanelProps) {
    const config = toVelocityConfig(settings);

    return (
        <div className="flex flex-col gap-2 p-2.5 w-[400px] max-w-[calc(100vw-2rem)]">
            <PanelSection className="px-3 py-3 flex items-center gap-4">
                <MenuField
                    label="Mode"
                    width={130}
                    value={config.mode}
                    options={MODE_OPTIONS}
                    onChange={v => onChange({ mode: v })}
                    title="Which shape is applied before the range clamp"
                />
                <span className="text-[10.5px] text-studio-text-dim flex-1">
                    {config.mode === 'value' && 'Scale, then add.'}
                    {config.mode === 'compand' && 'Pull toward or away from the pivot.'}
                    {config.mode === 'random' && 'Scatter around what was played.'}
                </span>
            </PanelSection>

            <div className="flex gap-2">
                {/* Response curve */}
                <PanelSection className="p-2.5 shrink-0">
                    <svg
                        width={CURVE_WIDTH}
                        height={CURVE_HEIGHT}
                        role="img"
                        aria-label="Velocity response curve"
                        className="block rounded-[3px] bg-black/50"
                    >
                        {/* Unity reference, so deflection from "no change" reads */}
                        <line
                            x1={0} y1={CURVE_HEIGHT} x2={CURVE_WIDTH} y2={0}
                            stroke="currentColor" strokeWidth={1} strokeDasharray="2 3"
                            className="text-studio-text-dim/35"
                        />
                        <path d={curvePath(config)} fill="none" strokeWidth={2} className="stroke-accent-cyan" />
                    </svg>
                    <div className="flex justify-between px-0.5 pt-1 text-[9px] tabular-nums text-studio-text-dim">
                        <span>played 1</span>
                        <span>127</span>
                    </div>
                </PanelSection>

                {/* Mode controls */}
                <PanelSection className="px-3 py-3 flex-1 flex flex-col gap-3 justify-center">
                    {config.mode === 'value' && (
                        <>
                            <SliderRow label="Scale" readout={`${config.scale} %`}>
                                <RuledSlider
                                    ariaLabel="Scale" value={config.scale} min={0} max={400}
                                    defaultValue={100} onChange={v => onChange({ scale: v })}
                                />
                            </SliderRow>
                            <SliderRow label="Add" readout={`${config.add > 0 ? '+' : ''}${config.add}`}>
                                <RuledSlider
                                    ariaLabel="Add" value={config.add} min={-127} max={127}
                                    defaultValue={0} origin={0} onChange={v => onChange({ add: v })}
                                />
                            </SliderRow>
                        </>
                    )}

                    {config.mode === 'compand' && (
                        <>
                            <SliderRow
                                label="Compand"
                                readout={`${config.compand > 0 ? '+' : ''}${config.compand}`}
                                hint="Below zero compresses toward the pivot, above it expands away"
                            >
                                <RuledSlider
                                    ariaLabel="Compand" value={config.compand} min={-100} max={100}
                                    defaultValue={0} origin={0} onChange={v => onChange({ compand: v })}
                                />
                            </SliderRow>
                            <SliderRow label="Pivot" readout={String(config.pivot)}>
                                <RuledSlider
                                    ariaLabel="Pivot" value={config.pivot} min={1} max={127}
                                    defaultValue={64} onChange={v => onChange({ pivot: v })}
                                />
                            </SliderRow>
                            <SliderRow label="Gain" readout={`${config.gain > 0 ? '+' : ''}${config.gain}`}>
                                <RuledSlider
                                    ariaLabel="Gain" value={config.gain} min={-99} max={99}
                                    defaultValue={0} origin={0} onChange={v => onChange({ gain: v })}
                                />
                            </SliderRow>
                        </>
                    )}

                    {config.mode === 'random' && (
                        <SliderRow label="Amount" readout={`± ${Math.round(config.random / 2)}`}>
                            <RuledSlider
                                ariaLabel="Random amount" value={config.random} min={0} max={127}
                                defaultValue={0} onChange={v => onChange({ random: v })}
                            />
                        </SliderRow>
                    )}
                </PanelSection>
            </div>

            <PanelSection className="px-3 py-3 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <span className="w-[92px] shrink-0 text-[11px] text-studio-text-mid">Range</span>
                    <div className="flex-1 flex flex-col gap-1.5">
                        <RuledSlider
                            ariaLabel="Range minimum" value={config.rangeMin} min={1} max={127}
                            defaultValue={1} onChange={v => onChange({ rangeMin: v })}
                        />
                        <RuledSlider
                            ariaLabel="Range maximum" value={config.rangeMax} min={1} max={127}
                            defaultValue={127} onChange={v => onChange({ rangeMax: v })}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <ValueReadout value={String(config.rangeMin)} width={40} />
                        <ValueReadout value={String(config.rangeMax)} width={40} />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <ToggleButton
                        active={false}
                        onClick={() => onChange({ scale: 100, add: 0, compand: 0, gain: 0, random: 0, rangeMin: 1, rangeMax: 127 })}
                        title="Return every control to the value that leaves velocity untouched"
                    >
                        Flat
                    </ToggleButton>
                    <span className="text-[10.5px] text-studio-text-dim">
                        Applied last, whichever mode is selected.
                    </span>
                </div>
            </PanelSection>
        </div>
    );
}
