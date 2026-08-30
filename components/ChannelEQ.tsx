"use client"
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useProjectStore } from '@/store/projectStore'
import { audioEngine } from '@/engine/AudioEngineAdapter'
import { EqKnob } from './eq/EqKnob'
import {
    freqToX, xToFreq, dbToY, yToDb, bandAtPoint, spectrumColor,
    eqBandsFromParams,
    FREQ_GRID, DB_GRID, BAND_COLORS, EQ_MIN_HZ, EQ_MAX_HZ, EQ_DB_RANGE,
    formatHz, formatDb,
} from '@/lib/eqCurve'
import { Power, Save, Settings, ChevronLeft, ChevronRight, Copy } from 'lucide-react'

/**
 * The eight-band EQ.
 *
 * The editor drew eight bands and wrote `band1_freq`, `band1_gain`, `band1_q`
 * … into a three-band DSP whose `setState` read none of those keys. Moving a
 * band changed a picture. The curve came from `getEQFrequencyResponse`, which
 * returned an array of zeros, so it was a picture of a flat EQ regardless.
 * Both are real now; this is the interface over them.
 */

const BAND_TYPES = [
    { id: 'lowcut', label: 'Low Cut' },
    { id: 'lowshelf', label: 'Low Shelf' },
    { id: 'bell', label: 'Bell' },
    { id: 'notch', label: 'Notch' },
    { id: 'highshelf', label: 'High Shelf' },
    { id: 'highcut', label: 'High Cut' },
] as const;

type BandTypeId = typeof BAND_TYPES[number]['id'];

/** Cut and notch shapes have no gain — they remove, they do not boost. */
const GAIN_APPLIES: Record<BandTypeId, boolean> = {
    lowcut: false, lowshelf: true, bell: true,
    notch: false, highshelf: true, highcut: false,
};

interface Band {
    type: BandTypeId;
    freq: number;
    gain: number;
    q: number;
    enabled: boolean;
}

const DEFAULT_BANDS: Band[] = [
    { type: 'lowcut', freq: 30, gain: 0, q: 0.7, enabled: false },
    { type: 'lowshelf', freq: 80, gain: 0, q: 0.7, enabled: true },
    { type: 'bell', freq: 200, gain: 0, q: 1.0, enabled: true },
    { type: 'bell', freq: 500, gain: 0, q: 1.0, enabled: true },
    { type: 'bell', freq: 1200, gain: 0, q: 1.0, enabled: true },
    { type: 'bell', freq: 3500, gain: 0, q: 1.0, enabled: true },
    { type: 'highshelf', freq: 8000, gain: 0, q: 0.7, enabled: true },
    { type: 'highcut', freq: 18000, gain: 0, q: 0.7, enabled: false },
];

/*
 * `bandsFromParams` moved to `lib/eqCurve`, beside the rest of the EQ
 * arithmetic. It was private here, so the mixer's EQ thumbnail could not read
 * a strip's actual settings and drew a fixed squiggle instead — the same
 * picture on a flat channel and a heavily shaped one.
 */
const bandsFromParams = eqBandsFromParams;

export function ChannelEQ({ trackId, pluginId }: { trackId: string, pluginId: string }) {
    const updatePluginParams = useProjectStore(s => s.updatePluginParams);
    const tracks = useProjectStore(s => s.tracks);
    const track = tracks.find(t => t.id === trackId);
    const plugin = track?.plugins.find(p => p.id === pluginId);
    const params = plugin?.params as Record<string, number> | undefined;

    const [bands, setBands] = useState<Band[]>(() => bandsFromParams(params));
    const [selected, setSelected] = useState(0);
    const [inputGain, setInputGain] = useState(params?.inputGain ?? 0);
    const [outputGain, setOutputGain] = useState(params?.outputGain ?? 0);
    const [mix, setMix] = useState(params?.mix ?? 1);
    const [autoMakeup, setAutoMakeup] = useState((params?.autoMakeup ?? 0) !== 0);
    const [bypass, setBypass] = useState((params?.bypass ?? 0) !== 0);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const dragBand = useRef<number | null>(null);
    // The draw loop reads this rather than closing over state, so it does not
    // have to be torn down and restarted on every parameter change.
    const drawState = useRef({ bands, selected, bypass });
    useEffect(() => { drawState.current = { bands, selected, bypass }; }, [bands, selected, bypass]);

    /** Push everything to the engine as the flat numbers automation can carry. */
    const commit = useCallback((next: Band[], globals?: Partial<{
        inputGain: number; outputGain: number; mix: number; autoMakeup: boolean; bypass: boolean;
    }>) => {
        const out: Record<string, number> = {};
        next.forEach((b, i) => {
            const p = `band${i + 1}`;
            out[`${p}_type`] = BAND_TYPES.findIndex(t => t.id === b.type);
            out[`${p}_freq`] = b.freq;
            out[`${p}_gain`] = b.gain;
            out[`${p}_q`] = b.q;
            out[`${p}_enabled`] = b.enabled ? 1 : 0;
        });
        out.inputGain = globals?.inputGain ?? inputGain;
        out.outputGain = globals?.outputGain ?? outputGain;
        out.mix = globals?.mix ?? mix;
        out.autoMakeup = (globals?.autoMakeup ?? autoMakeup) ? 1 : 0;
        out.bypass = (globals?.bypass ?? bypass) ? 1 : 0;
        updatePluginParams(trackId, pluginId, out);
    }, [trackId, pluginId, updatePluginParams, inputGain, outputGain, mix, autoMakeup, bypass]);

    const editBand = useCallback((index: number, patch: Partial<Band>) => {
        setBands(prev => {
            const next = prev.map((b, i) => i === index ? { ...b, ...patch } : b);
            commit(next);
            return next;
        });
    }, [commit]);

    // ── Drawing ──────────────────────────────────────────────────────────────

    const frequencies = useRef<Float32Array<ArrayBuffer>>(new Float32Array(new ArrayBuffer(4)));

    useEffect(() => {
        let raf = 0;
        const draw = () => {
            raf = requestAnimationFrame(draw);
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (!canvas || !ctx) return;

            const dpr = window.devicePixelRatio || 1;
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;
            if (width === 0 || height === 0) return;
            if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
                canvas.width = width * dpr;
                canvas.height = height * dpr;
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, width, height);

            // Bed.
            ctx.fillStyle = '#070c13';
            ctx.fillRect(0, 0, width, height);

            // Grid.
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 1;
            ctx.font = '9px ui-monospace, monospace';
            for (const { hz, label } of FREQ_GRID) {
                const x = Math.round(freqToX(hz, width)) + 0.5;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.28)';
                ctx.fillText(label, x + 3, 11);
            }
            for (const db of DB_GRID) {
                const y = Math.round(dbToY(db, height)) + 0.5;
                ctx.strokeStyle = db === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.05)';
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.28)';
                const text = db > 0 ? `+${db}` : `${db}`;
                // The outermost lines sit on the canvas edge, so their labels
                // are nudged inward rather than drawn off it.
                const labelY = Math.max(9, Math.min(height - 3, y - 3));
                ctx.fillText(text, 4, labelY);
                ctx.fillText(text, width - 20, labelY);
            }

            // Spectrum, tinted across the band so a peak can be matched to the
            // band that will treat it without reading the axis.
            const analyser = audioEngine.getEQAnalyzer(trackId, pluginId, false);
            if (analyser) {
                analyser.fftSize = 4096;
                const bins = analyser.frequencyBinCount;
                const data = new Uint8Array(new ArrayBuffer(bins));
                analyser.getByteFrequencyData(data);
                const sampleRate = audioEngine.getSampleRate() || 48000;
                for (let i = 1; i < bins; i++) {
                    const hz = (i * sampleRate) / (bins * 2);
                    if (hz < EQ_MIN_HZ) continue;
                    if (hz > EQ_MAX_HZ) break;
                    const level = data[i] / 255;
                    if (level <= 0.005) continue;
                    const x = freqToX(hz, width);
                    // A gentle power curve so quiet detail is still visible.
                    const barHeight = Math.pow(level, 0.55) * height * 0.8;
                    ctx.fillStyle = spectrumColor(hz);
                    ctx.globalAlpha = 0.5;
                    ctx.fillRect(x, height - barHeight, 1.4, barHeight);
                }
                ctx.globalAlpha = 1;
            }

            // The curve, straight off the live filters.
            if (frequencies.current.length !== Math.max(2, Math.floor(width))) {
                const count = Math.max(2, Math.floor(width));
                const array = new Float32Array(new ArrayBuffer(count * 4));
                for (let x = 0; x < count; x++) array[x] = xToFreq(x, count);
                frequencies.current = array;
            }
            const response = audioEngine.getEQFrequencyResponse(trackId, pluginId, frequencies.current);
            const { bands: liveBands, selected: liveSelected, bypass: liveBypass } = drawState.current;

            ctx.beginPath();
            for (let x = 0; x < response.length; x++) {
                const y = dbToY(response[x], height);
                if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = liveBypass ? 'rgba(255,255,255,0.25)' : '#22d3ee';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Fill between the curve and the flat line, so boost and cut read
            // at a glance.
            ctx.lineTo(width, dbToY(0, height));
            ctx.lineTo(0, dbToY(0, height));
            ctx.closePath();
            ctx.fillStyle = liveBypass ? 'rgba(255,255,255,0.03)' : 'rgba(34,211,238,0.10)';
            ctx.fill();

            // Band handles.
            liveBands.forEach((band, index) => {
                const x = freqToX(band.freq, width);
                const y = dbToY(GAIN_APPLIES[band.type] ? band.gain : 0, height);
                const colour = BAND_COLORS[index];
                ctx.globalAlpha = band.enabled ? 1 : 0.3;

                if (index === liveSelected) {
                    ctx.beginPath();
                    ctx.arc(x, y, 11, 0, Math.PI * 2);
                    ctx.fillStyle = colour;
                    ctx.globalAlpha = band.enabled ? 0.22 : 0.1;
                    ctx.fill();
                    ctx.globalAlpha = band.enabled ? 1 : 0.3;
                }
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI * 2);
                ctx.fillStyle = colour;
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.6)';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                ctx.fillStyle = '#04070b';
                ctx.font = 'bold 8px ui-monospace, monospace';
                ctx.fillText(String(index + 1), x - 2.5, y + 3);
                ctx.globalAlpha = 1;
            });
        };
        raf = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(raf);
    }, [trackId, pluginId]);

    // ── Dragging a node ──────────────────────────────────────────────────────

    const pointerPosition = (e: React.MouseEvent | MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width, h: rect.height };
    };

    const onCanvasDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const at = pointerPosition(e);
        if (!at) return;
        const hit = bandAtPoint(
            bands.map(b => ({ frequency: b.freq, gain: GAIN_APPLIES[b.type] ? b.gain : 0, enabled: b.enabled })),
            at.x, at.y, at.w, at.h,
        );
        if (hit === null) return;
        setSelected(hit);
        dragBand.current = hit;

        const onMove = (me: MouseEvent) => {
            const p = pointerPosition(me);
            const index = dragBand.current;
            if (!p || index === null) return;
            const band = bands[index];
            const patch: Partial<Band> = { freq: Math.round(xToFreq(p.x, p.w)) };
            // Only shapes with a gain move vertically; dragging a cut up and
            // down would suggest it does something it does not.
            if (GAIN_APPLIES[band.type]) {
                patch.gain = Math.round(yToDb(p.y, p.h) * 10) / 10;
            }
            editBand(index, patch);
        };
        const onUp = () => {
            dragBand.current = null;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    /** Scrolling over a node widens or narrows it, as on a hardware EQ. */
    const onCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
        const at = pointerPosition(e);
        if (!at) return;
        const hit = bandAtPoint(
            bands.map(b => ({ frequency: b.freq, gain: GAIN_APPLIES[b.type] ? b.gain : 0, enabled: b.enabled })),
            at.x, at.y, at.w, at.h,
        );
        if (hit === null) return;
        e.preventDefault();
        const band = bands[hit];
        const next = Math.max(0.1, Math.min(18, band.q * (e.deltaY > 0 ? 0.9 : 1.11)));
        editBand(hit, { q: Math.round(next * 100) / 100 });
    };

    const setGlobal = (patch: Partial<{
        inputGain: number; outputGain: number; mix: number; autoMakeup: boolean; bypass: boolean;
    }>) => {
        if (patch.inputGain !== undefined) setInputGain(patch.inputGain);
        if (patch.outputGain !== undefined) setOutputGain(patch.outputGain);
        if (patch.mix !== undefined) setMix(patch.mix);
        if (patch.autoMakeup !== undefined) setAutoMakeup(patch.autoMakeup);
        if (patch.bypass !== undefined) setBypass(patch.bypass);
        commit(bands, patch);
    };

    const band = bands[selected];
    const columns = useMemo(() => bands.map((b, i) => ({ band: b, index: i })), [bands]);

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div
            data-eq-editor
            /* Caps itself against the viewport: 900px is wider than a phone,
               and the backdrop that would otherwise constrain it lives in
               `PluginEditorWindow`, not here. */
            className="w-[900px] max-w-[calc(100vw-1rem)] bg-gradient-to-b from-[#0b1420] to-[#060a10] rounded-xl border border-accent-cyan/25 shadow-[0_30px_80px_rgba(0,0,0,0.8)] overflow-hidden"
        >
            {/* Header */}
            <div className="px-5 pt-3 pb-3 flex items-end justify-between border-b border-accent-cyan/15 bg-gradient-to-b from-white/[0.04] to-transparent">
                <div>
                    <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-studio-text-dim/70 mb-0.5">
                        {track?.name ?? 'Track'} · Channel EQ
                    </div>
                    <h2 className="text-[26px] leading-none font-black tracking-tight text-accent-cyan drop-shadow-[0_0_14px_rgba(34,211,238,0.45)]">
                        EQUALIZER
                    </h2>
                    <div className="text-[8px] font-bold uppercase tracking-[0.25em] text-studio-text-dim mt-1">
                        Studio EQ · 8 Band Parametric
                    </div>
                </div>

                <div className="flex items-center gap-2 pb-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-studio-text-dim">Preset:</span>
                    <div className="flex items-center h-6 rounded-md border border-studio-line-strong bg-black/50 overflow-hidden">
                        <button className="px-1.5 h-full text-studio-text-dim hover:text-accent-cyan" title="Previous preset">
                            <ChevronLeft className="w-3 h-3" />
                        </button>
                        <span className="px-4 text-[10px] font-bold tracking-wider text-studio-text">[DEFAULT]</span>
                        <button className="px-1.5 h-full text-studio-text-dim hover:text-accent-cyan" title="Next preset">
                            <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                    <button className="p-1 rounded text-studio-text-dim hover:text-accent-cyan" title="Copy settings">
                        <Copy className="w-3.5 h-3.5" />
                    </button>
                </div>

                <div className="flex items-center gap-1.5 pb-1">
                    <button
                        data-eq-bypass
                        onClick={() => setGlobal({ bypass: !bypass })}
                        title="Bypass the whole EQ"
                        className={`h-6 px-3 rounded-md text-[9px] font-black uppercase tracking-wider border transition-colors ${bypass
                            ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                            : 'bg-black/50 border-studio-line-strong text-studio-text-dim hover:text-accent-cyan hover:border-accent-cyan/50'}`}
                    >
                        Bypass
                    </button>
                    <button className="h-6 px-3 rounded-md text-[9px] font-black uppercase tracking-wider border border-studio-line-strong bg-black/50 text-studio-text-dim hover:text-accent-cyan">
                        Save
                    </button>
                    <button className="h-6 w-6 grid place-items-center rounded-md border border-studio-line-strong bg-black/50 text-studio-text-dim hover:text-accent-cyan" title="Save as">
                        <Save className="w-3 h-3" />
                    </button>
                    <button className="h-6 w-6 grid place-items-center rounded-md border border-studio-line-strong bg-black/50 text-studio-text-dim hover:text-accent-cyan" title="Settings">
                        <Settings className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {/* Curve */}
            <div className="px-4 pt-3 pb-2">
                <canvas
                    ref={canvasRef}
                    data-eq-canvas
                    onMouseDown={onCanvasDown}
                    onWheel={onCanvasWheel}
                    className="w-full h-[240px] rounded-lg border border-accent-cyan/15 cursor-crosshair"
                    title="Drag a node to move its band. Scroll over one to change its Q."
                />
            </div>

            {/* Band matrix */}
            <div className="px-4 pb-3">
                <div className="rounded-lg border border-accent-cyan/15 bg-black/30 p-2">
                    <div className="flex gap-1.5">
                        {/* Row labels */}
                        <div className="w-12 shrink-0 flex flex-col gap-1.5 pt-0.5">
                            {['Band', 'Type', 'Freq', 'Gain', 'Q', 'On'].map(label => (
                                <div key={label} className="h-6 flex items-center justify-end pr-1">
                                    <span className="text-[8px] font-black uppercase tracking-wider text-studio-text-dim">{label}</span>
                                </div>
                            ))}
                        </div>

                        {columns.map(({ band: b, index }) => {
                            const colour = BAND_COLORS[index];
                            const gainUsed = GAIN_APPLIES[b.type];
                            return (
                                <div
                                    key={index}
                                    data-eq-band={index + 1}
                                    onClick={() => setSelected(index)}
                                    className={`flex-1 min-w-0 flex flex-col gap-1.5 rounded-md p-1 transition-colors cursor-pointer ${selected === index ? 'bg-white/[0.06] ring-1 ring-inset' : 'hover:bg-white/[0.03]'}`}
                                    style={selected === index ? { boxShadow: `inset 0 0 0 1px ${colour}55` } : undefined}
                                >
                                    {/* Number chip */}
                                    <div className="h-6 flex items-center justify-center">
                                        <span
                                            className="w-5 h-5 rounded-full grid place-items-center text-[9px] font-black text-black"
                                            style={{ background: colour, opacity: b.enabled ? 1 : 0.35 }}
                                        >
                                            {index + 1}
                                        </span>
                                    </div>

                                    {/* Type */}
                                    <select
                                        value={b.type}
                                        onChange={(e) => editBand(index, { type: e.target.value as BandTypeId })}
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-6 w-full rounded bg-black/60 border border-studio-line-strong px-1 text-[9px] font-bold text-studio-text outline-none focus:border-accent-cyan"
                                    >
                                        {BAND_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                    </select>

                                    {/* Frequency */}
                                    <div className="h-6 flex items-center justify-center gap-1">
                                        <EqKnob
                                            size={22}
                                            color={colour}
                                            value={Math.log10(b.freq)}
                                            min={Math.log10(EQ_MIN_HZ)}
                                            max={Math.log10(EQ_MAX_HZ)}
                                            defaultValue={Math.log10(DEFAULT_BANDS[index].freq)}
                                            onChange={(v) => editBand(index, { freq: Math.round(Math.pow(10, v)) })}
                                            title="Frequency"
                                        />
                                        <span className="text-[8px] font-bold tabular-nums" style={{ color: colour }}>
                                            {formatHz(b.freq)}
                                        </span>
                                    </div>

                                    {/* Gain */}
                                    <div className="h-6 flex items-center justify-center gap-1">
                                        <EqKnob
                                            size={22}
                                            color={colour}
                                            value={b.gain}
                                            min={-EQ_DB_RANGE}
                                            max={EQ_DB_RANGE}
                                            disabled={!gainUsed}
                                            onChange={(v) => editBand(index, { gain: Math.round(v * 10) / 10 })}
                                            title={gainUsed ? 'Gain' : 'A cut or notch has no gain'}
                                        />
                                        <span
                                            className={`text-[8px] font-bold tabular-nums ${gainUsed ? '' : 'opacity-30'}`}
                                            style={{ color: gainUsed ? colour : undefined }}
                                        >
                                            {gainUsed ? formatDb(b.gain) : '—'}
                                        </span>
                                    </div>

                                    {/* Q */}
                                    <div className="h-6 flex items-center justify-center gap-1">
                                        <EqKnob
                                            size={22}
                                            color={colour}
                                            value={b.q}
                                            min={0.1}
                                            max={18}
                                            defaultValue={DEFAULT_BANDS[index].q}
                                            onChange={(v) => editBand(index, { q: Math.round(v * 100) / 100 })}
                                            title="Q — how wide the band is"
                                        />
                                        <span className="text-[8px] font-bold tabular-nums text-studio-text-mid">
                                            {b.q.toFixed(2)}
                                        </span>
                                    </div>

                                    {/* Enable */}
                                    <button
                                        data-eq-band-enable
                                        onClick={(e) => { e.stopPropagation(); editBand(index, { enabled: !b.enabled }); }}
                                        title={b.enabled ? 'Band on' : 'Band off'}
                                        className={`h-6 w-full rounded grid place-items-center border transition-colors ${b.enabled
                                            ? 'border-transparent text-black'
                                            : 'bg-black/50 border-studio-line text-studio-text-dim hover:text-studio-text'}`}
                                        style={b.enabled ? { background: colour } : undefined}
                                    >
                                        <Power className="w-3 h-3" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Global controls */}
            <div className="px-4 pb-4">
                <div className="rounded-lg border border-accent-cyan/15 bg-black/30 px-4 py-2 flex items-center gap-6">
                    <span className="text-[9px] font-black uppercase tracking-[0.15em] text-studio-text-dim shrink-0">
                        Global Controls
                    </span>

                    <div className="flex items-center gap-5">
                        <div className="flex flex-col items-center">
                            <EqKnob
                                size={34} value={inputGain} min={-24} max={24} label="Input"
                                onChange={(v) => setGlobal({ inputGain: Math.round(v * 10) / 10 })}
                                title="Trim before the filters"
                            />
                            <span className="text-[8px] font-bold tabular-nums text-accent-cyan">{formatDb(inputGain)}</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <EqKnob
                                size={34} value={outputGain} min={-24} max={24} label="Output"
                                onChange={(v) => setGlobal({ outputGain: Math.round(v * 10) / 10 })}
                                title="Trim after them"
                            />
                            <span className="text-[8px] font-bold tabular-nums text-accent-cyan">{formatDb(outputGain)}</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <EqKnob
                                size={34} value={mix} min={0} max={1} defaultValue={1} label="Dry/Wet"
                                onChange={(v) => setGlobal({ mix: Math.round(v * 100) / 100 })}
                                title="Blend the untouched signal back in"
                            />
                            <span className="text-[8px] font-bold tabular-nums text-accent-cyan">{Math.round(mix * 100)}%</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={() => setGlobal({ bypass: !bypass })}
                            className={`h-7 px-4 rounded-md text-[9px] font-black uppercase tracking-wider border transition-colors ${bypass
                                ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                                : 'bg-black/50 border-studio-line-strong text-studio-text-dim hover:text-accent-cyan'}`}
                        >
                            Bypass
                        </button>

                        {/* Dimmed with the reason: mid/side needs the signal
                            split, filtered separately and recombined, which
                            this EQ's single chain does not do. */}
                        <div
                            className="flex flex-col items-center opacity-30 cursor-default"
                            title="Mid/Side needs two filter chains; this EQ has one"
                        >
                            <div className="h-5 w-9 rounded-full bg-studio-control border border-studio-line" />
                            <span className="text-[7px] font-bold uppercase tracking-wide text-studio-text-dim mt-0.5">M/S Mode</span>
                        </div>

                        <div className="flex flex-col items-center">
                            <button
                                data-eq-automakeup
                                onClick={() => setGlobal({ autoMakeup: !autoMakeup })}
                                title="Offset the output by the curve's average boost"
                                className={`h-5 w-9 rounded-full border transition-colors relative ${autoMakeup
                                    ? 'bg-accent-cyan/30 border-accent-cyan'
                                    : 'bg-studio-control border-studio-line'}`}
                            >
                                <span
                                    className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all ${autoMakeup ? 'left-4 bg-accent-cyan' : 'left-0.5 bg-studio-text-dim'}`}
                                />
                            </button>
                            <span className="text-[7px] font-bold uppercase tracking-wide text-studio-text-dim mt-0.5">Auto Makeup</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Selected band readout, so the value being dragged is always legible. */}
            <div className="px-4 pb-3 -mt-1 flex items-center gap-3 text-[9px] font-bold tabular-nums">
                <span className="uppercase tracking-wider text-studio-text-dim">Band {selected + 1}</span>
                <span style={{ color: BAND_COLORS[selected] }}>{BAND_TYPES.find(t => t.id === band?.type)?.label}</span>
                <span className="text-studio-text">{formatHz(band?.freq ?? 0)}</span>
                <span className="text-studio-text">{GAIN_APPLIES[band?.type ?? 'bell'] ? formatDb(band?.gain ?? 0) : '—'}</span>
                <span className="text-studio-text-mid">Q {(band?.q ?? 1).toFixed(2)}</span>
            </div>
        </div>
    );
}
