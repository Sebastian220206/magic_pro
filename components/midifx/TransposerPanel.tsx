"use client"

/**
 * Transposer.
 *
 * The reference is two blocks: a transpose slider reading in semitones, and a
 * root/scale pair over a keyboard that shows which notes the scale admits.
 *
 * The keyboard is not decoration — it is the only way to see what a scale
 * setting actually does before you play. It is drawn from `inScale()`, the
 * same predicate the processor folds notes with, so what it lights cannot
 * disagree with what you hear.
 */

import React from 'react';
import {
    MenuField, MiniKeyboard, PanelSection, RuledSlider, SliderRow, type MenuOption,
} from './controls';
import { SCALES, NOTE_NAMES, inScale, type ScaleName } from '@/engine/midi/fx/transposer';
import { SCALE_NAMES, toTransposerConfig, type MidiFxSettings } from '@/lib/midiFxSettings';

export interface MidiFxPanelProps {
    settings: MidiFxSettings;
    onChange: (patch: MidiFxSettings) => void;
}

const SCALE_OPTIONS: readonly MenuOption<ScaleName>[] = SCALE_NAMES.map(name => ({
    value: name,
    label: SCALES[name].name,
}));

const ROOT_OPTIONS: readonly MenuOption<string>[] = NOTE_NAMES.map((name, index) => ({
    value: String(index),
    label: name,
}));

/** One octave from C3, which is where the reference's strip sits. */
const KEYBOARD_FROM = 48;
const KEYBOARD_TO = 71;

export function TransposerPanel({ settings, onChange }: MidiFxPanelProps) {
    const config = toTransposerConfig(settings);

    const admitted = new Set<number>();
    for (let pitch = KEYBOARD_FROM; pitch <= KEYBOARD_TO; pitch++) {
        if (inScale(pitch, config.root, config.scale)) admitted.add(pitch);
    }

    return (
        <div className="flex flex-col gap-2 p-2.5 w-[380px] max-w-[calc(100vw-2rem)]">
            <PanelSection className="px-3 py-3">
                <SliderRow
                    label="Transpose"
                    readout={`${config.transpose > 0 ? '+' : ''}${config.transpose} semi`}
                    hint="Shifted before the scale is applied"
                >
                    <RuledSlider
                        ariaLabel="Transpose"
                        value={config.transpose}
                        min={-24}
                        max={24}
                        defaultValue={0}
                        origin={0}
                        onChange={v => onChange({ transpose: v })}
                        format={v => `${v} semitones`}
                    />
                </SliderRow>
            </PanelSection>

            <PanelSection className="px-3 py-3 flex flex-col gap-3">
                <div className="flex items-center gap-5">
                    <MenuField
                        label="Root"
                        width={68}
                        value={String(config.root)}
                        options={ROOT_OPTIONS}
                        onChange={v => onChange({ root: Number(v) })}
                        title="The note the scale is built from"
                    />
                    <MenuField
                        label="Scale"
                        width={150}
                        value={config.scale}
                        options={SCALE_OPTIONS}
                        onChange={v => onChange({ scale: v })}
                        title="Notes outside the scale are moved to the nearest note inside it"
                    />
                </div>

                <MiniKeyboard
                    ariaLabel="Notes admitted by the scale"
                    from={KEYBOARD_FROM}
                    to={KEYBOARD_TO}
                    active={admitted}
                    tone="amber"
                    height={62}
                />

                <p className="text-[10.5px] leading-relaxed text-studio-text-dim">
                    {config.scale === 'chromatic'
                        ? 'Chromatic admits every note, so only the transpose applies.'
                        : `Lit keys are in ${NOTE_NAMES[config.root]} ${SCALES[config.scale].name}. Anything landing on a dark key moves to the nearest lit one.`}
                </p>
            </PanelSection>
        </div>
    );
}
