"use client"

/**
 * Modifier.
 *
 * The reference's shape exactly: Thru at the top left beside the two event
 * menus, then Scale and Add on ruled sliders below.
 *
 * The reference's Re-Assign To menu lists every continuous controller. Ours
 * lists them too, disabled and carrying the reason — this app's live note path
 * is `triggerNote(trackId, pitch, velocity)`, so a controller target has
 * nowhere to go. Offering them as working options and dropping the output
 * silently is the failure `lib/fxCatalog.ts` was written to stop.
 */

import React from 'react';
import {
    MenuField, PanelSection, PanelNotice, RuledSlider, SliderRow, ToggleButton,
    type MenuOption,
} from './controls';
import { modifierTransform, type ModifierProperty } from '@/engine/midi/fx/modifier';
import { toModifierConfig } from '@/lib/midiFxSettings';
import type { MidiFxPanelProps } from './TransposerPanel';

const NO_CONTROLLERS = 'this app routes notes only';

const PROPERTY_OPTIONS: readonly MenuOption<string>[] = [
    { value: 'noteNumber', label: 'Note Number' },
    { value: 'velocity', label: 'Velocity' },
    { value: 'cc1', label: '1 Modulation', unavailable: NO_CONTROLLERS },
    { value: 'cc7', label: '7 Volume', unavailable: NO_CONTROLLERS },
    { value: 'cc10', label: '10 Pan', unavailable: NO_CONTROLLERS },
    { value: 'cc74', label: '74 Brightness', unavailable: NO_CONTROLLERS },
    { value: 'pitchBend', label: 'Pitch Bend', unavailable: NO_CONTROLLERS },
    { value: 'chPressure', label: 'Channel Pressure', unavailable: NO_CONTROLLERS },
];

/** Example inputs for the readout, so the transform is legible without playing. */
const PREVIEW_INPUTS = [0, 32, 64, 96, 127];

export function ModifierPanel({ settings, onChange }: MidiFxPanelProps) {
    const config = toModifierConfig(settings);
    // Thru sounds the note as played beside the modified one, so it can only
    // do anything when the modified note lands on a different pitch.
    const thruUseful = config.target === 'noteNumber';

    return (
        <div className="flex flex-col gap-2 p-2.5 w-[400px] max-w-[calc(100vw-2rem)]">
            <PanelSection className="px-3 py-3 flex flex-col gap-3">
                <div className="flex items-start gap-4">
                    <ToggleButton
                        active={config.thru && thruUseful}
                        disabled={!thruUseful}
                        onClick={() => onChange({ thru: !config.thru })}
                        title={thruUseful
                            ? 'Also sound the note as played, alongside the modified one'
                            : 'Only useful when the note number is re-assigned — otherwise both notes are the same pitch'}
                    >
                        Thru
                    </ToggleButton>

                    <div className="flex flex-col gap-2 flex-1 min-w-0">
                        <MenuField
                            label="Input Event"
                            width="100%"
                            value={config.source}
                            options={PROPERTY_OPTIONS}
                            onChange={v => onChange({ source: v as ModifierProperty })}
                            title="The property the transform reads"
                        />
                        <MenuField
                            label="Re-Assign To"
                            width="100%"
                            value={config.target}
                            options={PROPERTY_OPTIONS}
                            onChange={v => onChange({ target: v as ModifierProperty })}
                            title="The property the transform writes"
                        />
                    </div>
                </div>
            </PanelSection>

            <PanelSection className="px-3 py-3 flex flex-col gap-3">
                <SliderRow label="Scale" readout={`${config.scale} %`}>
                    <RuledSlider
                        ariaLabel="Scale"
                        value={config.scale}
                        min={-200}
                        max={200}
                        defaultValue={100}
                        origin={0}
                        onChange={v => onChange({ scale: v })}
                        format={v => `${v} percent`}
                    />
                </SliderRow>

                <SliderRow label="Add" readout={`${config.add > 0 ? '+' : ''}${config.add}`}>
                    <RuledSlider
                        ariaLabel="Add"
                        value={config.add}
                        min={-127}
                        max={127}
                        defaultValue={0}
                        origin={0}
                        onChange={v => onChange({ add: v })}
                    />
                </SliderRow>

                {/* What the two sliders come to, at five example inputs. Drawn
                    from the processor's own transform rather than repeating
                    the arithmetic here. */}
                <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-studio-text-dim mr-1">in → out</span>
                    {PREVIEW_INPUTS.map(input => (
                        <span
                            key={input}
                            className="flex-1 rounded-[3px] bg-black/40 border border-studio-line px-1 py-0.5 text-center text-[10px] tabular-nums text-studio-text-mid"
                        >
                            {input}
                            <span className="text-studio-text-dim"> → </span>
                            <span className="text-amber-400">{modifierTransform(input, config)}</span>
                        </span>
                    ))}
                </div>
            </PanelSection>

            <PanelNotice>
                Reads <strong className="text-studio-text-mid">{config.source === 'noteNumber' ? 'note number' : 'velocity'}</strong>,
                writes <strong className="text-studio-text-mid">{config.target === 'noteNumber' ? 'note number' : 'velocity'}</strong>.
                Controller targets are listed but cannot be selected: the track&rsquo;s note path carries a pitch and a velocity, so there is nothing for a controller to travel on.
            </PanelNotice>
        </div>
    );
}
