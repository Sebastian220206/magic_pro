"use client"

/**
 * Arpeggiator.
 *
 * The reference's three bands, top to bottom: a transport strip with Latch and
 * Clear; the NOTE ORDER block holding the rate knob, the six direction buttons
 * and the range sliders; and a tabbed lower half whose Pattern tab is a
 * sixteen-step grid.
 *
 * Two of the reference's controls have no engine behind them and are dimmed
 * with the reason rather than drawn as working: Variation, which would need a
 * second pattern the engine does not store, and the Keyboard and Controller
 * tabs, which assign per-key and per-CC behaviour this app's note path cannot
 * carry. The step grid is a picture of the velocity pattern rather than an
 * editable custom sequence, for the same reason — the engine has named
 * patterns, not sixteen editable steps — so Live and Custom are dimmed and
 * Grid is what it shows.
 *
 * Everything else here is live: the six patterns, six rates, octave range,
 * swing, gate, velocity pattern and latch are all fields the processor reads.
 */

import React, { useState } from 'react';
import { Play, ArrowUp, ArrowDown, ArrowUpDown, Shuffle, Layers, Hand } from 'lucide-react';
import { EqKnob } from '@/components/eq/EqKnob';
import {
    MenuField, PanelButton, PanelSection, RuledSlider, SectionBanner, SliderRow,
    ToggleButton, ValueReadout, type MenuOption,
} from './controls';
import { stepVelocity, type ArpPattern, type VelocityPattern } from '@/engine/midi/fx/arpeggiator';
import {
    ARP_RATES, ARP_VELOCITY_PATTERNS, MIDI_FX_DEFAULTS, toArpeggiatorConfig,
} from '@/lib/midiFxSettings';
import type { MidiFxPanelProps } from './TransposerPanel';

/** The six note orders, in the reference's button order. */
const PATTERNS: readonly { id: ArpPattern; icon: typeof ArrowUp; title: string }[] = [
    { id: 'up', icon: ArrowUp, title: 'Up — lowest held note to highest' },
    { id: 'down', icon: ArrowDown, title: 'Down — highest held note to lowest' },
    { id: 'upDown', icon: ArrowUpDown, title: 'Up and down — turns around at each end' },
    { id: 'chord', icon: Layers, title: 'Chord — every held note on each step' },
    { id: 'random', icon: Shuffle, title: 'Random — a held note picked each step' },
    { id: 'order', icon: Hand, title: 'As played — the order the keys went down' },
];

const VELOCITY_LABELS: Record<VelocityPattern, string> = {
    none: 'Flat',
    accent: 'Accent First',
    crescendo: 'Crescendo',
    diminuendo: 'Diminuendo',
    random: 'Random',
};

const VELOCITY_OPTIONS: readonly MenuOption<VelocityPattern>[] =
    ARP_VELOCITY_PATTERNS.map(p => ({ value: p, label: VELOCITY_LABELS[p] }));

const STEPS = 16;

type Tab = 'pattern' | 'options' | 'keyboard' | 'controller';

const TABS: readonly { id: Tab; label: string; unavailable?: string }[] = [
    { id: 'pattern', label: 'Pattern' },
    { id: 'options', label: 'Options' },
    { id: 'keyboard', label: 'Keyboard', unavailable: 'Per-key assignment needs an event stream this app does not route' },
    { id: 'controller', label: 'Controller', unavailable: 'Controller assignment needs an event stream this app does not route' },
];

export function ArpeggiatorPanel({ settings, onChange }: MidiFxPanelProps) {
    const config = toArpeggiatorConfig(settings);
    const [tab, setTab] = useState<Tab>('pattern');

    const rateIndex = Math.max(0, ARP_RATES.indexOf(config.rate));

    return (
        <div className="flex flex-col gap-2 p-2.5 w-[620px] max-w-[calc(100vw-2rem)]">
            {/* Transport strip */}
            <PanelSection className="px-3 py-2.5 flex items-center gap-3">
                <div
                    className="w-11 h-11 rounded-full grid place-items-center border border-amber-300 bg-gradient-to-b from-amber-400 to-amber-600 shadow-[0_0_14px_rgba(251,191,36,0.35)]"
                    title="The arpeggiator runs whenever the transport does and keys are held"
                >
                    <Play className="w-5 h-5 text-black fill-black" />
                </div>

                <ToggleButton
                    active={config.latch}
                    onClick={() => onChange({ latch: !config.latch })}
                    title="Keep arpeggiating after the keys are released"
                >
                    Latch
                </ToggleButton>

                <ToggleButton
                    active={config.sync}
                    onClick={() => onChange({ sync: !config.sync })}
                    title="Lock the step rate to the project tempo"
                >
                    Sync
                </ToggleButton>

                <PanelButton
                    className="ml-auto"
                    onClick={() => onChange({ ...MIDI_FX_DEFAULTS.arpeggiator })}
                    title="Return every control to its default"
                >
                    Clear
                </PanelButton>
            </PanelSection>

            {/* Note order */}
            <PanelSection>
                <SectionBanner>Note Order</SectionBanner>

                <div className="p-3 flex items-center gap-5">
                    {/* Rate */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                        <ValueReadout value={config.rate} width={52} />
                        <EqKnob
                            size={54}
                            value={rateIndex}
                            min={0}
                            max={ARP_RATES.length - 1}
                            defaultValue={ARP_RATES.indexOf('1/16')}
                            onChange={v => onChange({ rate: ARP_RATES[Math.round(v)] })}
                            title="Step rate"
                        />
                        <div className="flex justify-between w-[62px] text-[8px] uppercase tracking-wide text-studio-text-dim">
                            <span>Slow</span><span>Fast</span>
                        </div>
                    </div>

                    {/* Direction */}
                    <div className="flex gap-1">
                        {PATTERNS.map(({ id, icon: Icon, title }) => (
                            <button
                                key={id}
                                type="button"
                                title={title}
                                aria-label={title}
                                aria-pressed={config.pattern === id}
                                onClick={() => onChange({ pattern: id })}
                                className={`w-[46px] h-[42px] rounded-[3px] border grid place-items-center transition-colors ${config.pattern === id
                                    ? 'bg-amber-500/85 border-amber-300 text-black shadow-[0_0_10px_rgba(251,191,36,0.3)]'
                                    : 'bg-studio-control border-studio-line-strong text-studio-text-mid hover:text-studio-text hover:border-studio-text-dim'}`}
                            >
                                <Icon className="w-5 h-5" />
                            </button>
                        ))}
                    </div>

                    {/* Ranges */}
                    <div className="ml-auto flex gap-4">
                        <RangeColumn
                            label="Variation"
                            value={1}
                            disabled
                            title="Needs a second pattern the engine does not store"
                            onChange={() => { /* dimmed */ }}
                        />
                        <RangeColumn
                            label="Oct Range"
                            value={config.octaveRange}
                            title="How many octaves the pattern climbs before repeating"
                            onChange={v => onChange({ octaveRange: v })}
                        />
                    </div>
                </div>
            </PanelSection>

            {/* Tabs */}
            <PanelSection>
                <div className="flex border-b border-black/40">
                    {TABS.map(({ id, label, unavailable }) => (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={tab === id}
                            disabled={!!unavailable}
                            title={unavailable}
                            onClick={() => setTab(id)}
                            className={`flex-1 h-[30px] text-[11px] font-bold uppercase tracking-[0.12em] border-r border-black/30 last:border-r-0 transition-colors ${unavailable
                                ? 'text-studio-text-dim/35 cursor-default'
                                : tab === id
                                    ? 'text-amber-400 bg-white/[0.04]'
                                    : 'text-studio-text-dim hover:text-studio-text-mid'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {tab === 'pattern' && (
                    <div className="p-3 flex gap-3">
                        <div className="flex flex-col gap-1 shrink-0">
                            <PanelButton onClick={() => { }} disabled title="Recording a played pattern is not built">
                                Live
                            </PanelButton>
                            <ToggleButton active onClick={() => { }} title="The velocity pattern, step by step">
                                Grid
                            </ToggleButton>
                            <PanelButton onClick={() => { }} disabled title="The engine stores named patterns, not sixteen editable steps">
                                Custom
                            </PanelButton>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                            <div
                                className="flex-1 flex items-end gap-[3px] h-[92px]"
                                role="img"
                                aria-label={`Velocity across ${STEPS} steps, ${VELOCITY_LABELS[config.velocityPattern]}`}
                            >
                                {Array.from({ length: STEPS }, (_, step) => {
                                    // A fixed source rather than Math.random, so the
                                    // Random pattern draws a stable shape instead of
                                    // flickering on every render.
                                    const velocity = stepVelocity(
                                        step, STEPS, config.velocityPattern, config.velocityAmount,
                                        () => ((step * 2654435761) % 1000) / 1000,
                                    );
                                    return (
                                        <div
                                            key={step}
                                            title={`Step ${step + 1} — velocity ${velocity}`}
                                            className="flex-1 rounded-t-[2px] bg-gradient-to-t from-cyan-800/70 to-accent-cyan"
                                            style={{ height: `${(velocity / 127) * 100}%` }}
                                        />
                                    );
                                })}
                            </div>
                            <div className="flex gap-[3px] text-[8px] tabular-nums text-studio-text-dim">
                                {Array.from({ length: STEPS }, (_, i) => (
                                    <span key={i} className="flex-1 text-center">{i + 1}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'options' && (
                    <div className="p-3 flex flex-col gap-3">
                        <MenuField
                            label="Velocity"
                            width={168}
                            value={config.velocityPattern}
                            options={VELOCITY_OPTIONS}
                            onChange={v => onChange({ velocityPattern: v })}
                            title="How velocity moves across the pattern"
                        />
                        <SliderRow label="Amount" readout={`${Math.round(config.velocityAmount * 100)} %`}>
                            <RuledSlider
                                ariaLabel="Velocity amount" value={config.velocityAmount}
                                min={0} max={1} step={0.01} defaultValue={0.5}
                                onChange={v => onChange({ velocityAmount: v })}
                            />
                        </SliderRow>
                        <SliderRow
                            label="Swing"
                            readout={`${Math.round(config.swing * 100)} %`}
                            hint="Applies at 1/8 and 1/16 only"
                        >
                            <RuledSlider
                                ariaLabel="Swing" value={config.swing}
                                min={0} max={1} step={0.01} defaultValue={0}
                                onChange={v => onChange({ swing: v })}
                            />
                        </SliderRow>
                        <SliderRow label="Gate" readout={`${Math.round(config.gate * 100)} %`}>
                            <RuledSlider
                                ariaLabel="Gate" value={config.gate}
                                min={0.01} max={2} step={0.01} defaultValue={0.8}
                                onChange={v => onChange({ gate: v })}
                            />
                        </SliderRow>
                        {(config.rate !== '1/8' && config.rate !== '1/16' && config.swing > 0) && (
                            <p className="text-[10.5px] text-amber-400/80">
                                Swing has no effect at {config.rate} — it applies at 1/8 and 1/16.
                            </p>
                        )}
                    </div>
                )}
            </PanelSection>
        </div>
    );
}

/** The vertical 1–4 selector the reference puts beside the direction buttons. */
function RangeColumn({
    label, value, onChange, disabled, title,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
    title?: string;
}) {
    return (
        <div className="flex flex-col items-center gap-1" title={title}>
            <span className={`text-[9px] font-bold uppercase tracking-wide ${disabled ? 'text-studio-text-dim/40' : 'text-studio-text-dim'}`}>
                {label}
            </span>
            <div className="flex flex-col-reverse gap-[3px]">
                {[1, 2, 3, 4].map(step => (
                    <button
                        key={step}
                        type="button"
                        disabled={disabled}
                        aria-label={`${label} ${step}`}
                        aria-pressed={value === step}
                        onClick={() => onChange(step)}
                        className={`w-6 h-[13px] rounded-[2px] border text-[8px] font-bold transition-colors ${disabled
                            ? 'bg-black/30 border-studio-line text-studio-text-dim/30 cursor-default'
                            : value >= step
                                ? 'bg-amber-500/80 border-amber-300 text-black'
                                : 'bg-studio-control border-studio-line-strong text-studio-text-dim hover:border-studio-text-dim'}`}
                    >
                        {step}
                    </button>
                ))}
            </div>
        </div>
    );
}
