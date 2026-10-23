"use client"

/**
 * Note Repeater.
 *
 * Rate and repeat count on top, the velocity ramp below, and a preview of the
 * first eight repeats drawn from the processor's own `repeatVelocity()` — so
 * the bars show the decay or build you will actually hear, at the velocity a
 * struck note at 100 would produce.
 *
 * Like the Arpeggiator, the repeater is a generator: the held note is silent
 * until the transport's next tick sounds the first repeat. The notice says so
 * rather than letting a held key that starts quiet read as broken.
 */

import React, { useMemo } from 'react';
import {
    MenuField, PanelNotice, PanelSection, RuledSlider, SliderRow,
    type MenuOption,
} from './controls';
import { repeatVelocity, type RepeatRate } from '@/engine/midi/fx/noteRepeater';
import { REPEAT_RATES, toNoteRepeaterConfig } from '@/lib/midiFxSettings';
import type { MidiFxPanelProps } from './TransposerPanel';

const RATE_OPTIONS: readonly MenuOption<RepeatRate>[] = REPEAT_RATES.map(rate => ({
    value: rate,
    label: rate,
}));

const PREVIEW_REPEATS = 8;
const PREVIEW_BASE_VELOCITY = 100;

export function NoteRepeaterPanel({ settings, onChange }: MidiFxPanelProps) {
    const config = toNoteRepeaterConfig(settings);
    const repetitions = Math.max(0, Math.round(config.repetitions));

    const bars = useMemo(
        () => Array.from({ length: PREVIEW_REPEATS }, (_, i) =>
            repeatVelocity(PREVIEW_BASE_VELOCITY, i, config)),
        [config],
    );

    return (
        <div className="flex flex-col gap-2 p-2.5 w-[400px] max-w-[calc(100vw-2rem)]">
            <PanelSection className="px-3 py-3 flex flex-col gap-3">
                <div className="flex items-center gap-5">
                    <MenuField
                        label="Rate"
                        width={110}
                        value={config.rate}
                        options={RATE_OPTIONS}
                        onChange={v => onChange({ rate: v })}
                        title="Time between repeats, in note values"
                    />
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-studio-text-mid">Repeats</span>
                        <span
                            className="inline-block h-[22px] leading-[20px] rounded-full bg-studio-sunken border border-studio-line-strong px-2 text-[11px] tabular-nums text-studio-text text-center min-w-[54px]"
                            title={repetitions === 0 ? 'Repeats for as long as the key is held' : 'Stops after this many repeats'}
                        >
                            {repetitions === 0 ? 'Hold' : repetitions}
                        </span>
                    </div>
                </div>

                <SliderRow
                    label="Repeat Count"
                    readout={repetitions === 0 ? 'while held' : `${repetitions}×`}
                    hint="0 repeats for as long as the key is held"
                >
                    <RuledSlider
                        ariaLabel="Repeat count"
                        value={repetitions}
                        min={0}
                        max={32}
                        defaultValue={0}
                        onChange={v => onChange({ repetitions: v })}
                        format={v => (v === 0 ? 'repeat while held' : `${v} repeats`)}
                    />
                </SliderRow>
            </PanelSection>

            <PanelSection className="p-2.5">
                <div className="rounded-[4px] border border-amber-900/60 bg-gradient-to-b from-amber-950/60 to-black/70 p-2.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-400">Velocity</span>
                        <span className="text-[11px] font-bold tabular-nums text-amber-300">
                            {config.velocityRamp > 0 ? '+' : ''}{config.velocityRamp} / repeat
                        </span>
                    </div>

                    <div
                        className="h-[72px] flex items-end gap-[2px]"
                        role="img"
                        aria-label={`First ${PREVIEW_REPEATS} repeats from velocity ${PREVIEW_BASE_VELOCITY}`}
                    >
                        {bars.map((velocity, i) => (
                            <div
                                key={i}
                                className="flex-1 rounded-t-[1px] bg-gradient-to-t from-amber-700/70 to-amber-400"
                                style={{ height: `${Math.max(2, (velocity / 127) * 100)}%` }}
                                title={`Repeat ${i + 1}: velocity ${velocity}`}
                            />
                        ))}
                    </div>
                </div>
            </PanelSection>

            <PanelSection className="px-3 py-3">
                <SliderRow
                    label="Vel Ramp"
                    readout={`${config.velocityRamp > 0 ? '+' : ''}${config.velocityRamp}`}
                    hint="Velocity added per repeat — negative decays, positive builds"
                >
                    <RuledSlider
                        ariaLabel="Velocity ramp"
                        value={config.velocityRamp}
                        min={-24}
                        max={24}
                        defaultValue={-3}
                        origin={0}
                        onChange={v => onChange({ velocityRamp: v })}
                        format={v => `${v} velocity per repeat`}
                    />
                </SliderRow>
            </PanelSection>

            <PanelNotice>
                A generator, like the Arpeggiator: the held note repeats on the
                transport&apos;s clock, so the first repeat lands on the next tick rather
                than on the key press. Releasing the key releases the last repeat.
            </PanelNotice>
        </div>
    );
}
