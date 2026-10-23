"use client"
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useProjectStore } from '@/store/projectStore'
import { audioEngine } from '@/engine/AudioEngineAdapter'
import { EqKnob } from './eq/EqKnob'
import {
    COMPRESSOR_MODELS, transferCurve, meterFraction, autoMakeupDb,
    type AutoGainMode,
} from '@/lib/compressorCurve'
import { SidechainPicker } from './mixer/RoutingControls'

/**
 * The compressor.
 *
 * This editor was in the unreachable baseline — nothing imported it, so the
 * compressor opened as the manifest-driven list of sliders. The DSP underneath
 * had three character modes, no input or output trim, no parallel blend, no
 * limiter, no distortion control, and metering that returned zero for input
 * and output with a comment saying analysers would be needed. All of that is
 * real now, and this is the interface over it.
 */

const AUTO_GAIN_MODES: { id: AutoGainMode; label: string }[] = [
    { id: 'off', label: 'Off' },
    { id: '0db', label: '0 dB' },
    { id: '-12db', label: '-12 dB' },
];

interface CompState {
    model: string;
    threshold: number;
    ratio: number;
    makeupGain: number;
    knee: number;
    attack: number;
    release: number;
    inputGain: number;
    outputGain: number;
    mix: number;
    limiterOn: boolean;
    limiterThreshold: number;
    distortion: number;
    distortionHard: boolean;
    autoGain: AutoGainMode;
}

const DEFAULTS: CompState = {
    model: 'platinum',
    threshold: -24, ratio: 4, makeupGain: 0,
    knee: 6, attack: 0.01, release: 0.1,
    inputGain: 0, outputGain: 0, mix: 1,
    limiterOn: false, limiterThreshold: -3,
    distortion: 0, distortionHard: false,
    autoGain: 'off',
};

function stateFromParams(p: Record<string, number> | undefined): CompState {
    const num = (k: keyof CompState, fallback: number) =>
        typeof p?.[k as string] === 'number' ? (p![k as string] as number) : fallback;
    return {
        model: COMPRESSOR_MODELS[Math.round(num('model' as never, 0))]?.id ?? DEFAULTS.model,
        threshold: num('threshold', DEFAULTS.threshold),
        ratio: num('ratio', DEFAULTS.ratio),
        makeupGain: num('makeupGain', DEFAULTS.makeupGain),
        knee: num('knee', DEFAULTS.knee),
        attack: num('attack', DEFAULTS.attack),
        release: num('release', DEFAULTS.release),
        inputGain: num('inputGain', DEFAULTS.inputGain),
        outputGain: num('outputGain', DEFAULTS.outputGain),
        mix: num('mix', DEFAULTS.mix),
        limiterOn: num('limiterOn' as never, 0) !== 0,
        limiterThreshold: num('limiterThreshold', DEFAULTS.limiterThreshold),
        distortion: num('distortion', DEFAULTS.distortion),
        distortionHard: num('distortionHard' as never, 0) !== 0,
        autoGain: AUTO_GAIN_MODES[Math.round(num('autoGain' as never, 0))]?.id ?? 'off',
    };
}

/** A vertical meter with the scale printed beside it, as in the reference. */
function LevelMeter({ db, label, scaleOnLeft }: { db: number; label: string; scaleOnLeft?: boolean }) {
    const MARKS = [3, 0, -3, -6, -9, -12, -18, -24, -30, -40, -50, -60];
    const fraction = meterFraction(db);
    return (
        <div className="flex flex-col items-center gap-1">
            <div className="px-1.5 py-0.5 rounded border border-accent-cyan/30 bg-black/60 text-[8px] font-bold tabular-nums text-accent-cyan">
                {db <= -60 ? '-∞ dB' : `${db.toFixed(1)} dB`}
            </div>
            <div className={`flex items-stretch gap-1 ${scaleOnLeft ? '' : 'flex-row-reverse'}`}>
                <div className="flex flex-col justify-between py-0.5">
                    {MARKS.map(m => (
                        <span key={m} className="text-[6px] leading-none tabular-nums text-studio-text-dim">{m}</span>
                    ))}
                </div>
                <div className="relative w-3 h-[248px] rounded-sm bg-black/70 border border-studio-line overflow-hidden">
                    <div
                        className="absolute bottom-0 left-0 right-0 transition-[height] duration-75"
                        style={{
                            height: `${fraction * 100}%`,
                            background: 'linear-gradient(to top, #22d3ee, #67e8f9 70%, #fbbf24 92%, #ef4444)',
                        }}
                    />
                </div>
            </div>
            <span className="text-[8px] font-bold uppercase tracking-wider text-studio-text-dim">{label}</span>
        </div>
    );
}

export function Compressor({ trackId, pluginId }: { trackId: string; pluginId: string }) {
    const updatePluginParams = useProjectStore(s => s.updatePluginParams);
    const isMaster = trackId === 'master';
    const masterPlugins = useProjectStore(s => s.masterPlugins);
    const tracks = useProjectStore(s => s.tracks);
    const track = isMaster ? null : tracks.find(t => t.id === trackId);
    const plugin = isMaster
        ? masterPlugins.find(p => p.id === pluginId)
        : track?.plugins.find(p => p.id === pluginId);

    const [state, setState] = useState<CompState>(() => stateFromParams(plugin?.params as never));
    const [view, setView] = useState<'meter' | 'graph'>('meter');
    const [meters, setMeters] = useState({ reduction: 0, inputLevel: -60, outputLevel: -60 });

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawState = useRef({ state, view, meters });
    useEffect(() => { drawState.current = { state, view, meters }; }, [state, view, meters]);

    /** Write everything as the flat numbers automation can carry. */
    const commit = useCallback((next: CompState) => {
        updatePluginParams(trackId, pluginId, {
            model: COMPRESSOR_MODELS.findIndex(m => m.id === next.model),
            threshold: next.threshold,
            ratio: next.ratio,
            makeupGain: next.makeupGain,
            knee: next.knee,
            attack: next.attack,
            release: next.release,
            inputGain: next.inputGain,
            outputGain: next.outputGain,
            mix: next.mix,
            limiterOn: next.limiterOn ? 1 : 0,
            limiterThreshold: next.limiterThreshold,
            distortion: next.distortion,
            distortionHard: next.distortionHard ? 1 : 0,
            autoGain: AUTO_GAIN_MODES.findIndex(m => m.id === next.autoGain),
        });
    }, [trackId, pluginId, updatePluginParams]);

    const edit = useCallback((patch: Partial<CompState>) => {
        setState(prev => {
            const next = { ...prev, ...patch };
            commit(next);
            return next;
        });
    }, [commit]);

    // Meters, read from the live processor.
    useEffect(() => {
        let raf = 0;
        const tick = () => {
            raf = requestAnimationFrame(tick);
            const data = audioEngine.getCompressorMeters?.(trackId, pluginId);
            if (data) setMeters(data);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [trackId, pluginId]);

    // The display: a gain-reduction meter, or the transfer curve.
    useEffect(() => {
        let raf = 0;
        const draw = () => {
            raf = requestAnimationFrame(draw);
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (!canvas || !ctx) return;
            const dpr = window.devicePixelRatio || 1;
            const w = canvas.clientWidth;
            const h = canvas.clientHeight;
            if (!w || !h) return;
            if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
                canvas.width = w * dpr; canvas.height = h * dpr;
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = '#060c14';
            ctx.fillRect(0, 0, w, h);

            const live = drawState.current;

            if (live.view === 'graph') {
                // Transfer curve: input level in, output level out.
                ctx.strokeStyle = 'rgba(255,255,255,0.07)';
                ctx.lineWidth = 1;
                for (let db = -60; db <= 0; db += 12) {
                    const x = ((db + 60) / 60) * w;
                    const y = h - ((db + 60) / 60) * h;
                    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
                }
                // Unity, for reference.
                ctx.strokeStyle = 'rgba(255,255,255,0.16)';
                ctx.setLineDash([3, 3]);
                ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w, 0); ctx.stroke();
                ctx.setLineDash([]);

                const makeup = live.state.autoGain === 'off'
                    ? live.state.makeupGain
                    : autoMakeupDb(live.state.autoGain, live.state.threshold, live.state.ratio, live.state.knee);
                const points = transferCurve(
                    live.state.threshold, live.state.ratio, live.state.knee, makeup,
                    { enabled: live.state.limiterOn, threshold: live.state.limiterThreshold },
                );
                ctx.beginPath();
                points.forEach((p, i) => {
                    const x = ((p.inputDb + 60) / 60) * w;
                    const y = h - ((Math.max(-60, Math.min(6, p.outputDb)) + 60) / 66) * h;
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                });
                ctx.strokeStyle = '#22d3ee';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Where the signal sits on that curve right now.
                const inX = ((Math.max(-60, live.meters.inputLevel) + 60) / 60) * w;
                ctx.strokeStyle = 'rgba(251,191,36,0.7)';
                ctx.beginPath(); ctx.moveTo(inX, 0); ctx.lineTo(inX, h); ctx.stroke();
            } else {
                // Gain-reduction meter, reading right to left from 0.
                const SCALE = [-50, -30, -20, -10, -5, 0];
                ctx.font = '10px ui-monospace, monospace';
                ctx.fillStyle = 'rgba(255,255,255,0.45)';
                for (const db of SCALE) {
                    const x = ((db + 60) / 60) * w;
                    ctx.fillText(String(db), x - 8, 18);
                    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
                    ctx.beginPath(); ctx.moveTo(x, 22); ctx.lineTo(x, 30); ctx.stroke();
                }

                const reduction = Math.abs(live.meters.reduction);
                const barY = h * 0.45;
                const barH = h * 0.22;
                ctx.fillStyle = 'rgba(255,255,255,0.05)';
                ctx.fillRect(0, barY, w, barH);

                // Reduction grows leftward from 0 dB at the right edge.
                const span = (reduction / 30) * w;
                const gradient = ctx.createLinearGradient(w - span, 0, w, 0);
                gradient.addColorStop(0, '#22d3ee');
                gradient.addColorStop(1, '#fbbf24');
                ctx.fillStyle = gradient;
                ctx.fillRect(w - span, barY, span, barH);

                ctx.fillStyle = '#e6f4f8';
                ctx.font = 'bold 13px ui-monospace, monospace';
                ctx.fillText(`${reduction.toFixed(1)} dB GR`, 12, h - 14);
            }
        };
        raf = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(raf);
    }, []);

    return (
        <div
            data-compressor-editor
            className="w-[1000px] max-w-[calc(100vw-1rem)] rounded-xl border border-accent-cyan/25 bg-gradient-to-b from-[#0c1826] to-[#060a10] shadow-[0_30px_80px_rgba(0,0,0,0.85)] overflow-hidden"
        >
            {/* Title */}
            <div className="relative px-6 pt-3 pb-2 text-center border-b border-accent-cyan/15">
                <div className="absolute left-6 top-3 text-[8px] font-bold uppercase tracking-[0.2em] text-studio-text-dim">
                    {track?.name ?? 'Track'}
                </div>
                <h2 className="text-[22px] leading-none font-light tracking-wide text-accent-cyan drop-shadow-[0_0_16px_rgba(34,211,238,0.5)]">
                    Compressor
                </h2>
            </div>

            {/* Model row + side-chain */}
            <div className="px-4 pt-3 flex items-start gap-3">
                <div className="flex-1 flex gap-1">
                    {COMPRESSOR_MODELS.map(m => (
                        <button
                            key={m.id}
                            data-comp-model={m.id}
                            onClick={() => edit({ model: m.id })}
                            className={`flex-1 h-9 rounded-md border text-[9px] font-bold leading-tight px-1 transition-colors ${state.model === m.id
                                ? 'bg-accent-cyan/15 border-accent-cyan text-accent-cyan shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                                : 'bg-black/40 border-studio-line-strong text-studio-text-dim hover:text-studio-text hover:border-accent-cyan/40'}`}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>

                {/* Side-chain Routing Picker */}
                <div
                    className="w-[190px] rounded-md border border-accent-cyan/30 bg-black/50 p-1.5 shadow-sm"
                    title="Keying from another track via sidechain detector"
                >
                    <div className="text-[8px] font-bold uppercase tracking-wider text-accent-cyan text-center mb-1">
                        Side-Chain Key
                    </div>
                    {track ? (
                        <SidechainPicker track={track} pluginId={pluginId} />
                    ) : (
                        <div className="text-[9px] text-center text-studio-text-dim">Master Bus Direct</div>
                    )}
                </div>
            </div>

            <div className="px-4 py-3 flex gap-4 items-start">
                {/* Input meter, with its trim beneath — as the reference has it. */}
                <div className="flex flex-col items-center gap-2">
                    <LevelMeter db={meters.inputLevel} label="Input" scaleOnLeft />
                    <Control label="Input Gain" value={`${state.inputGain.toFixed(1)} dB`}>
                        <EqKnob size={44} value={state.inputGain} min={-30} max={30} defaultValue={0}
                            onChange={v => edit({ inputGain: Math.round(v * 10) / 10 })}
                            title="Trim before the detector" />
                    </Control>
                </div>

                {/* Centre column */}
                <div className="flex-1 min-w-0 flex flex-col gap-3">
                    {/* Display */}
                    <div className="rounded-lg border border-accent-cyan/20 bg-black/40 p-2">
                        <div className="flex justify-center mb-2">
                            <div className="flex rounded-md overflow-hidden border border-studio-line-strong">
                                {(['meter', 'graph'] as const).map(v => (
                                    <button
                                        key={v}
                                        data-comp-view={v}
                                        onClick={() => setView(v)}
                                        className={`px-6 h-6 text-[10px] font-bold capitalize transition-colors ${view === v
                                            ? 'bg-accent-cyan/20 text-accent-cyan'
                                            : 'bg-black/50 text-studio-text-dim hover:text-studio-text'}`}
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <canvas ref={canvasRef} data-comp-canvas className="w-full h-[130px] rounded" />
                    </div>

                    {/* Main knobs */}
                    <div className="grid grid-cols-4 gap-2">
                        <Control label="Threshold" value={`${state.threshold.toFixed(1)} dB`}>
                            <EqKnob size={54} value={state.threshold} min={-60} max={0} defaultValue={-24}
                                onChange={v => edit({ threshold: Math.round(v * 10) / 10 })} title="Where compression starts" />
                        </Control>
                        <Control label="Ratio" value={`${state.ratio.toFixed(1)}:1`}>
                            <EqKnob size={54} value={state.ratio} min={1} max={30} defaultValue={4}
                                onChange={v => edit({ ratio: Math.round(v * 10) / 10 })} title="How hard it pulls down" />
                        </Control>
                        <Control label="Make Up" value={`${state.makeupGain.toFixed(1)} dB`}>
                            <EqKnob size={54} value={state.makeupGain} min={-30} max={30} defaultValue={0}
                                disabled={state.autoGain !== 'off'}
                                onChange={v => edit({ makeupGain: Math.round(v * 10) / 10 })}
                                title={state.autoGain === 'off' ? 'Gain back after compression' : 'Auto Gain is setting this'} />
                        </Control>
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-[8px] font-bold uppercase tracking-wider text-studio-text-dim">Auto Gain</span>
                            {AUTO_GAIN_MODES.map(m => (
                                <button
                                    key={m.id}
                                    data-comp-autogain={m.id}
                                    onClick={() => edit({ autoGain: m.id })}
                                    className={`w-full h-6 rounded border text-[9px] font-bold transition-colors ${state.autoGain === m.id
                                        ? 'bg-accent-cyan/15 border-accent-cyan text-accent-cyan'
                                        : 'bg-black/40 border-studio-line-strong text-studio-text-dim hover:text-studio-text'}`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Time knobs */}
                    <div className="grid grid-cols-3 gap-2">
                        <Control label="Knee" value={state.knee.toFixed(1)}>
                            <EqKnob size={44} value={state.knee} min={0} max={40} defaultValue={6}
                                onChange={v => edit({ knee: Math.round(v * 10) / 10 })} title="How rounded the corner is" />
                        </Control>
                        <Control label="Attack" value={`${(state.attack * 1000).toFixed(0)} ms`}>
                            <EqKnob size={44} value={state.attack * 1000} min={0} max={200} defaultValue={10}
                                onChange={v => edit({ attack: Math.round(v) / 1000 })} title="How fast it grabs" />
                        </Control>
                        <Control label="Release" value={`${(state.release * 1000).toFixed(0)} ms`}>
                            <EqKnob size={44} value={state.release * 1000} min={5} max={2000} defaultValue={100}
                                onChange={v => edit({ release: Math.round(v) / 1000 })} title="How fast it lets go" />
                        </Control>
                    </div>
                </div>

                {/* Right column: limiter, distortion, mix */}
                <div className="w-[150px] shrink-0 flex flex-col gap-3">
                    <div className="rounded-lg border border-amber-400/25 bg-black/40 p-2 flex flex-col items-center gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-300">Limiter</span>
                        <button
                            data-comp-limiter
                            onClick={() => edit({ limiterOn: !state.limiterOn })}
                            className={`h-6 px-5 rounded border text-[9px] font-black transition-colors ${state.limiterOn
                                ? 'bg-amber-500/25 border-amber-400 text-amber-300'
                                : 'bg-black/50 border-studio-line-strong text-studio-text-dim'}`}
                        >
                            ON
                        </button>
                        <span className="text-[8px] font-bold uppercase tracking-wider text-studio-text-dim mt-1">Threshold</span>
                        <EqKnob size={42} color="#fbbf24" value={state.limiterThreshold} min={-30} max={0} defaultValue={-3}
                            disabled={!state.limiterOn}
                            onChange={v => edit({ limiterThreshold: Math.round(v * 10) / 10 })}
                            title={state.limiterOn ? 'Brickwall ceiling' : 'Turn the limiter on first'} />
                        <span className="text-[8px] font-bold tabular-nums text-amber-300">{state.limiterThreshold.toFixed(1)} dB</span>
                    </div>

                    <div className="rounded-lg border border-studio-line-strong bg-black/40 p-2 flex flex-col items-center gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-studio-text-dim">Distortion</span>
                        <div className="flex gap-1 w-full">
                            {([['Soft', false], ['Hard', true]] as const).map(([label, hard]) => (
                                <button
                                    key={label}
                                    data-comp-distortion={label.toLowerCase()}
                                    onClick={() => edit({ distortionHard: hard })}
                                    className={`flex-1 h-5 rounded border text-[8px] font-bold transition-colors ${state.distortionHard === hard
                                        ? 'bg-accent-cyan/15 border-accent-cyan text-accent-cyan'
                                        : 'bg-black/40 border-studio-line text-studio-text-dim'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <EqKnob size={42} value={state.distortion} min={0} max={1} defaultValue={0}
                            onChange={v => edit({ distortion: Math.round(v * 100) / 100 })}
                            title="How hard the signal is driven into the shaper" />
                        <span className="text-[8px] font-bold tabular-nums text-studio-text-mid">{Math.round(state.distortion * 100)}%</span>
                    </div>

                    <div className="rounded-lg border border-studio-line-strong bg-black/40 p-2 flex flex-col items-center gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-studio-text-dim">Mix</span>
                        <EqKnob size={42} value={state.mix} min={0} max={1} defaultValue={1}
                            onChange={v => edit({ mix: Math.round(v * 100) / 100 })}
                            title="Blend the uncompressed signal back in" />
                        <div className="flex justify-between w-full text-[7px] text-studio-text-dim">
                            <span>Input</span><span>Output</span>
                        </div>
                        <span className="text-[8px] font-bold tabular-nums text-accent-cyan">{Math.round(state.mix * 100)}%</span>
                    </div>
                </div>

                {/* Output meter, with its trim beneath. */}
                <div className="flex flex-col items-center gap-2">
                    <LevelMeter db={meters.outputLevel} label="Output" />
                    <Control label="Output Gain" value={`${state.outputGain.toFixed(1)} dB`}>
                        <EqKnob size={44} value={state.outputGain} min={-30} max={30} defaultValue={0}
                            onChange={v => edit({ outputGain: Math.round(v * 10) / 10 })}
                            title="Trim on the way out" />
                    </Control>
                </div>
            </div>

        </div>
    );
}

function Control({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col items-center gap-0.5">
            <span className="text-[8px] font-bold uppercase tracking-wider text-studio-text-dim">{label}</span>
            {children}
            <span className="text-[8px] font-bold tabular-nums text-accent-cyan">{value}</span>
        </div>
    );
}
