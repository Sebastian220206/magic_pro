"use client"
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useProjectStore } from '@/store/projectStore'
import { audioEngine } from '@/engine/AudioEngineAdapter'
import { EqKnob } from './eq/EqKnob'
import { LIMITER_MODES, type LimiterMode } from '@/lib/limiterModes'
import { meterFraction } from '@/lib/compressorCurve'
import { Power, Undo2, Redo2 } from 'lucide-react'

/**
 * The Limiter.
 *
 * There was no editor for this plugin at all, so it opened as the
 * manifest-driven list of sliders. The DSP had a ceiling, a release and a
 * lookahead — no input gain, no mode, no soft knee, and no metering beyond a
 * single reduction figure. The reference shows all of them plus a stereo pair
 * of input and output meters, so the DSP grew to match and this is the panel
 * over it.
 */

const METER_MARKS = [20, 12, 6, 3, 0, -3, -6, -9, -12, -18, -24, -30, -40, -50, -60];

interface LimState {
    gain: number;
    release: number;
    ceiling: number;
    lookahead: number;
    mode: LimiterMode;
    softKnee: boolean;
    bypass: boolean;
}

const DEFAULTS: LimState = {
    gain: 0, release: 0.1, ceiling: -0.3, lookahead: 2,
    mode: 'legacy', softKnee: true, bypass: false,
};

function stateFromParams(p: Record<string, number> | undefined): LimState {
    const n = (k: string, fallback: number) =>
        typeof p?.[k] === 'number' ? (p[k] as number) : fallback;
    return {
        gain: n('gain', DEFAULTS.gain),
        release: n('release', DEFAULTS.release),
        ceiling: n('ceiling', DEFAULTS.ceiling),
        lookahead: n('lookahead', DEFAULTS.lookahead),
        mode: LIMITER_MODES[Math.round(n('mode', 0))]?.id ?? 'legacy',
        softKnee: n('softKnee', 1) !== 0,
        bypass: n('bypass', 0) !== 0,
    };
}

/** One column of the meter block: a scale, then one or two bars. */
function MeterColumn({
    label, values, readouts, downward,
}: { label: string; values: number[]; readouts: string[]; downward?: boolean }) {
    return (
        <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-studio-text-dim">{label}</span>
            <div className="flex gap-1">
                {readouts.map((r, i) => (
                    <span key={i} className="w-8 text-center text-[9px] font-bold tabular-nums text-amber-300">{r}</span>
                ))}
            </div>
            <div className="flex items-stretch gap-1">
                <div className="flex flex-col justify-between py-px pr-0.5">
                    {METER_MARKS.map(m => (
                        <span key={m} className="text-[6px] leading-none tabular-nums text-studio-text-dim/70">{m}</span>
                    ))}
                </div>
                {values.map((db, i) => {
                    // Reduction runs from the top down: no reduction is a
                    // full bar's worth of headroom, not an empty meter.
                    const fraction = downward
                        ? Math.max(0, Math.min(1, db / 24))
                        : meterFraction(db, -60, 20);
                    return (
                        <div key={i} className="relative w-3 h-[190px] rounded-sm bg-black/70 border border-studio-line overflow-hidden">
                            <div
                                className={`absolute left-0 right-0 ${downward ? 'top-0' : 'bottom-0'}`}
                                style={{
                                    height: `${fraction * 100}%`,
                                    background: downward
                                        ? 'linear-gradient(to bottom, #38bdf8, #22d3ee)'
                                        : 'linear-gradient(to top, #22d3ee, #67e8f9 78%, #fbbf24 92%, #ef4444)',
                                }}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function Limiter({ trackId, pluginId }: { trackId: string; pluginId: string }) {
    const updatePluginParams = useProjectStore(s => s.updatePluginParams);
    const isMaster = trackId === 'master';
    const masterPlugins = useProjectStore(s => s.masterPlugins);
    const tracks = useProjectStore(s => s.tracks);
    const track = isMaster ? null : tracks.find(t => t.id === trackId);
    const plugin = isMaster
        ? masterPlugins.find(p => p.id === pluginId)
        : track?.plugins.find(p => p.id === pluginId);

    const [state, setState] = useState<LimState>(() => stateFromParams(plugin?.params as never));
    const [meters, setMeters] = useState({
        inputLeft: -60, inputRight: -60, outputLeft: -60, outputRight: -60, reduction: 0,
    });
    /** The settings Compare flips back to, so A/B is a real comparison. */
    const compareRef = useRef<LimState | null>(null);
    const [comparing, setComparing] = useState(false);

    const commit = useCallback((next: LimState) => {
        updatePluginParams(trackId, pluginId, {
            gain: next.gain,
            release: next.release,
            ceiling: next.ceiling,
            lookahead: next.lookahead,
            mode: LIMITER_MODES.findIndex(m => m.id === next.mode),
            softKnee: next.softKnee ? 1 : 0,
            bypass: next.bypass ? 1 : 0,
        });
    }, [trackId, pluginId, updatePluginParams]);

    const edit = useCallback((patch: Partial<LimState>) => {
        setState(prev => {
            const next = { ...prev, ...patch };
            commit(next);
            return next;
        });
    }, [commit]);

    useEffect(() => {
        let raf = 0;
        const tick = () => {
            raf = requestAnimationFrame(tick);
            const data = audioEngine.getLimiterMeters?.(trackId, pluginId);
            if (data) setMeters(data);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [trackId, pluginId]);

    /** Swap the current settings for the ones held, and back again. */
    const toggleCompare = () => {
        if (!compareRef.current) {
            compareRef.current = state;
            setComparing(true);
            edit(DEFAULTS);
            return;
        }
        const held = compareRef.current;
        compareRef.current = state;
        setComparing(c => !c);
        edit(held);
    };

    const db = (v: number) => (v <= -60 ? '-∞' : v.toFixed(1));

    return (
        <div
            data-limiter-editor
            className="w-[740px] max-w-[calc(100vw-1rem)] rounded-xl border border-[#3b3e44] bg-[#1e2023] shadow-[0_30px_90px_rgba(0,0,0,0.95)] overflow-hidden font-sans select-none"
        >
            {/* Logic Pro Native Effect Window Header Bar */}
            <div className="h-10 bg-gradient-to-b from-[#3a3d42] to-[#27292d] px-4 flex items-center justify-between border-b border-[#18191b] shadow-sm">
                <div className="flex items-center gap-2">
                    <button
                        data-limiter-power
                        onClick={() => edit({ bypass: !state.bypass })}
                        title={state.bypass ? 'Bypassed — click to engage' : 'Engaged — click to bypass'}
                        className={`w-7 h-7 rounded-[3px] border flex items-center justify-center transition-all ${
                            !state.bypass
                                ? 'bg-gradient-to-b from-[#2e7d32] to-[#1b5e20] border-[#4caf50] text-white shadow-[0_0_8px_rgba(76,175,80,0.6)]'
                                : 'bg-[#1e2023] border-[#3b3e44] text-[#8b8e93] hover:text-white'
                        }`}
                    >
                        <Power className="w-3.5 h-3.5 fill-current" />
                    </button>
                    <div className="h-4 w-px bg-black/40 mx-1" />
                    <span className="text-[12px] font-bold text-white/90 tracking-wide">Limiter</span>
                    <span className="text-[10px] font-semibold text-white/40 tracking-wider">[{track?.name ?? 'Track'}]</span>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-white/40">Setting:</span>
                    <div className="flex items-center h-6 rounded-[3px] border border-[#3b3e44] bg-[#141517] px-2 shadow-inner">
                        <span className="px-1 text-[10px] font-bold tracking-tight text-white/90">User Default</span>
                    </div>

                    <button
                        data-limiter-compare
                        onClick={toggleCompare}
                        title="Swap between these settings and the ones held"
                        className={`h-6 px-2.5 rounded-[3px] text-[9px] font-bold border transition-colors shadow-sm ${
                            comparing
                                ? 'bg-accent-cyan/20 border-accent-cyan text-accent-cyan'
                                : 'bg-[#282a2e] border-[#3b3e44] text-white/70 hover:text-white'
                        }`}
                    >
                        Compare
                    </button>
                </div>
            </div>

            <div className="flex">
                {/* Meters */}
                <div className="p-3 flex gap-3 bg-black/25 border-r border-black/30">
                    <MeterColumn
                        label="Input"
                        values={[meters.inputLeft, meters.inputRight]}
                        readouts={[db(meters.inputLeft), db(meters.inputRight)]}
                    />
                    <MeterColumn
                        label="Reduction"
                        values={[meters.reduction]}
                        readouts={[meters.reduction.toFixed(1)]}
                        downward
                    />
                    <MeterColumn
                        label="Output"
                        values={[meters.outputLeft, meters.outputRight]}
                        readouts={[db(meters.outputLeft), db(meters.outputRight)]}
                    />
                </div>

                {/* Controls */}
                <div className="flex-1 p-4 flex flex-col gap-5">
                    <div className="grid grid-cols-4 gap-3">
                        <Knob label="Gain" value={`${state.gain >= 0 ? '+' : ''}${state.gain.toFixed(1)} dB`}
                            min={-20} max={20} current={state.gain} defaultValue={0}
                            onChange={v => edit({ gain: Math.round(v * 10) / 10 })}
                            title="Drive into the limiter" />
                        <Knob label="Release" value={`${(state.release * 1000).toFixed(0)} ms`}
                            min={2} max={2000} current={state.release * 1000} defaultValue={100}
                            onChange={v => edit({ release: Math.round(v) / 1000 })}
                            title="How fast it lets go" />
                        <Knob label="Output Level" value={`${state.ceiling.toFixed(1)} dB`}
                            min={-10} max={1} current={state.ceiling} defaultValue={-0.3}
                            onChange={v => edit({ ceiling: Math.round(v * 10) / 10 })}
                            title="The highest level allowed out" />
                        <Knob label="Lookahead" value={`${state.lookahead.toFixed(1)} ms`}
                            min={0} max={10} current={state.lookahead} defaultValue={2}
                            onChange={v => edit({ lookahead: Math.round(v * 10) / 10 })}
                            title="How far ahead it watches for a peak" />
                    </div>

                    <div className="flex items-end gap-10">
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-studio-text-dim">Mode</span>
                            <select
                                data-limiter-mode
                                value={state.mode}
                                onChange={e => edit({ mode: e.target.value as LimiterMode })}
                                title={LIMITER_MODES.find(m => m.id === state.mode)?.hint}
                                className="h-7 w-[120px] rounded bg-black/50 border border-studio-line-strong px-2 text-[11px] text-studio-text outline-none focus:border-accent-cyan"
                            >
                                {LIMITER_MODES.map(m => (
                                    <option key={m.id} value={m.id}>{m.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col items-center gap-1">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-studio-text-dim">Soft Knee</span>
                            <button
                                data-limiter-softknee
                                onClick={() => edit({ softKnee: !state.softKnee })}
                                title="Rounds the corner where limiting begins"
                                className={`h-7 px-6 rounded text-[10px] font-black border transition-colors ${state.softKnee
                                    ? 'bg-accent-cyan/20 border-accent-cyan text-accent-cyan'
                                    : 'bg-black/40 border-studio-line-strong text-studio-text-dim'}`}
                            >
                                {state.softKnee ? 'ON' : 'OFF'}
                            </button>
                        </div>

                        <p className="text-[9px] leading-snug text-studio-text-dim max-w-[190px] ml-auto">
                            {LIMITER_MODES.find(m => m.id === state.mode)?.hint}
                        </p>
                    </div>
                </div>
            </div>

            <div className="py-1 text-center border-t border-black/30 bg-black/25">
                <span className="text-[10px] font-medium tracking-wide text-studio-text-mid">Limiter</span>
            </div>
        </div>
    );
}

function Knob({
    label, value, min, max, current, defaultValue, onChange, title,
}: {
    label: string; value: string; min: number; max: number; current: number;
    defaultValue: number; onChange: (v: number) => void; title: string;
}) {
    return (
        <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wide text-studio-text-dim">{label}</span>
            <span className="text-[13px] font-bold tabular-nums text-studio-text">{value}</span>
            <EqKnob size={52} value={current} min={min} max={max} defaultValue={defaultValue}
                onChange={onChange} title={title} />
            <div className="flex justify-between w-16 text-[8px] tabular-nums text-studio-text-dim">
                <span>{min}</span><span>{max}</span>
            </div>
        </div>
    );
}
