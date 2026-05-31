"use client"
import React, { useState, useEffect, useRef } from 'react'
import { useProjectStore } from '@/store/projectStore'
import { audioEngine } from '@/engine/AudioEngineAdapter'

// --- Component Definition ---

interface CompressorProps {
    trackId: string
    pluginId: string
}

export function Compressor({ trackId, pluginId }: CompressorProps) {
    const { updatePluginParams, tracks } = useProjectStore()
    const track = tracks.find(t => t.id === trackId)
    const plugin = track?.plugins.find(p => p.id === pluginId)

    const [params, setParams] = useState({
        threshold: plugin?.params?.threshold ?? -20,
        ratio: plugin?.params?.ratio ?? 2,
        makeup: plugin?.params?.makeup ?? 0,
        knee: plugin?.params?.knee ?? 0.5,
        attack: plugin?.params?.attack ?? 0.003,
        release: plugin?.params?.release ?? 0.25,
        inputGain: plugin?.params?.inputGain ?? 0,
        outputGain: plugin?.params?.outputGain ?? 0,
        mix: plugin?.params?.mix ?? 100,
        distortion: plugin?.params?.distortion ?? 0,
        autoGain: plugin?.params?.autoGain ?? 0,
        circuit: plugin?.params?.circuit ?? 0,
        limiter: plugin?.params?.limiter ?? 0,
        limiterThreshold: plugin?.params?.limiterThreshold ?? -6,
    })

    const [viewMode, setViewMode] = useState<'meter' | 'graph'>('meter')
    const meterRef = useRef<HTMLCanvasElement>(null)
    const [reduction, setReduction] = useState(0)
    const smoothedReduction = useRef(0)
    
    // Meter States
    const [inputLevel, setInputLevel] = useState(-60)
    const [outputLevel, setOutputLevel] = useState(-60)
    const inputAnalyser = useRef<AnalyserNode | null>(null)
    const outputAnalyser = useRef<AnalyserNode | null>(null)

    useEffect(() => {
        const nodes = audioEngine.getTrackNodes(trackId);
        const compEntry = nodes?.nodes?.find(n => n.id === pluginId);
        if (compEntry && (compEntry as any).internalNodes) {
            const [input, comp, makeup] = (compEntry as any).internalNodes;
            const ctx = audioEngine.getContext();
            if (ctx && ctx.state !== 'suspended') {
                inputAnalyser.current = ctx.createAnalyser();
                outputAnalyser.current = ctx.createAnalyser();
                inputAnalyser.current!.fftSize = 256;
                outputAnalyser.current!.fftSize = 256;
                input.connect(inputAnalyser.current);
                makeup.connect(outputAnalyser.current);
            }
        }
        let frame: number;
        const update = () => {
            const trackNodes = audioEngine.getTrackNodes(trackId);
            const compNode = trackNodes?.nodes?.find(n => n.id === pluginId)?.instance as DynamicsCompressorNode | any;
            if (compNode && compNode.reduction !== undefined) {
                const target = Math.abs(typeof compNode.reduction === 'number' ? compNode.reduction : 0);
                smoothedReduction.current += (target - smoothedReduction.current) * 0.12;
                setReduction(smoothedReduction.current);
            }
            if (inputAnalyser.current && outputAnalyser.current) {
                const data = new Float32Array(inputAnalyser.current.frequencyBinCount);
                inputAnalyser.current.getFloatTimeDomainData(data);
                let rms = 0; for (let i = 0; i < data.length; i++) rms += data[i] * data[i];
                const dbIn = rms > 0 ? 20 * Math.log10(Math.sqrt(rms / data.length)) : -60;
                setInputLevel(prev => prev + (dbIn - prev) * 0.25);
                outputAnalyser.current.getFloatTimeDomainData(data);
                rms = 0; for (let i = 0; i < data.length; i++) rms += data[i] * data[i];
                const dbOut = rms > 0 ? 20 * Math.log10(Math.sqrt(rms / data.length)) : -60;
                setOutputLevel(prev => prev + (dbOut - prev) * 0.25);
            }
            drawDisplay();
            frame = requestAnimationFrame(update);
        };
        update();
        return () => { cancelAnimationFrame(frame); inputAnalyser.current?.disconnect(); outputAnalyser.current?.disconnect(); };
    }, [trackId, pluginId]);

    const drawDisplay = () => {
        const canvas = meterRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const w = canvas.width; const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        if (viewMode === 'meter') drawAnalogMeter(ctx, w, h);
        else drawCompressionGraph(ctx, w, h);
    };

    const drawAnalogMeter = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#f8fafc'); grad.addColorStop(1, '#cbd5e1');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#334155'; ctx.font = 'bold 12px "Inter", sans-serif'; ctx.fillStyle = '#334155'; ctx.textAlign = 'center';
        const cx = w/2; const cy = h + 130; const rad = h * 1.6;
        const startA = -Math.PI * 0.62; const endA = -Math.PI * 0.38;
        [0, 5, 10, 20, 30, 50].forEach(v => {
            const an = endA + (v/50) * (startA - endA);
            ctx.beginPath(); ctx.lineWidth = 1.5;
            ctx.moveTo(cx + Math.cos(an) * rad, cy + Math.sin(an) * rad);
            ctx.lineTo(cx + Math.cos(an) * (rad - 12), cy + Math.sin(an) * (rad - 12));
            ctx.stroke();
            ctx.fillText(v === 0 ? '0' : `-${v}`, cx + Math.cos(an) * (rad - 30), cy + Math.sin(an) * (rad - 30));
        });
        const nAn = endA + (Math.min(50, reduction) / 50) * (startA - endA);
        ctx.beginPath(); ctx.strokeStyle = '#cc2a1a'; ctx.lineWidth = 2.5; ctx.lineCap='round';
        ctx.moveTo(cx + Math.cos(nAn) * 30, cy + Math.sin(nAn) * 30);
        ctx.lineTo(cx + Math.cos(nAn) * (rad - 5), cy + Math.sin(nAn) * (rad - 5));
        ctx.stroke();
    };

    const drawCompressionGraph = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
        ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
        for(let i=0; i<=10; i++) { 
            const x = (i/10)*w; const y = (i/10)*h;
            ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
        }
        const thresh = (params.threshold + 50) / 50; const r = params.ratio;
        ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3; ctx.beginPath();
        for(let i=0; i<w; i++) {
            const xN = i/w; let yN = xN > thresh ? thresh + (xN - thresh) / r : xN;
            if (i === 0) ctx.moveTo(i, h - yN * h); else ctx.lineTo(i, h - yN * h);
        }
        ctx.stroke();
    };

    const handleParamChange = (k: string, v: number) => {
        const newParams = { ...params, [k]: v }; setParams(newParams);
        updatePluginParams(trackId, pluginId, newParams);
    };

    const circuits = ["Platinum Digital", "Studio VCA", "Studio FET", "Classic VCA", "Vintage VCA", "Vintage FET", "Vintage Opto"];

    return (
        <div className="flex flex-col bg-[#0f172a] rounded-sm text-white select-none border border-black shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden" 
             style={{ width: '1024px', height: '720px' }}>
            
            {/* Phase 2: Design System - Header */}
            <div className="h-[56px] bg-[#1e293b] border-b border-black flex items-center px-4 justify-between gap-1 shadow-md">
                {circuits.map((c, i) => (
                    <button key={i} onClick={() => handleParamChange('circuit', i)}
                        className={`flex-1 h-9 text-[10px] font-bold uppercase transition-all border border-black/40 ${params.circuit === i ? 'bg-[#38bdf8] text-black border-[#38bdf8] shadow-lg' : 'bg-[#1e293b] text-slate-500 hover:text-slate-300'}`}>
                        {c}
                    </button>
                ))}
            </div>

            <div className="flex flex-1 gap-0">
                {/* PHASE 3: LEFT PANEL (cols 1-2) - 160px */}
                <div className="w-[160px] flex flex-col items-center py-10 border-r border-black/20 justify-between bg-black/10">
                    <div className="flex flex-col items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest [font-variant:small-caps]">Input Level</span>
                        <div className="h-[420px] w-6 bg-black relative rounded shadow-[inset_0_2px_15px_rgba(0,0,0,1)] border border-white/5 overflow-hidden">
                            <div className="absolute inset-x-0 bottom-0 bg-[#38bdf8] transition-all duration-75 shadow-[0_0_20px_#38bdf8]" style={{ height: `${Math.max(0, (inputLevel + 60) * (100/63))}%` }}></div>
                            {[3, 0, -6, -12, -24, -48].map(v => (
                                <div key={v} className="absolute left-[8px] w-6 border-t border-white/10" style={{ bottom: `${(v + 60) * (100 / 63)}%` }}></div>
                            ))}
                        </div>
                        <span className="text-[11px] font-mono text-[#38bdf8] mt-1">{(inputLevel).toFixed(1)} dB</span>
                    </div>
                    {/* Input gain knob bottom aligned */}
                    <div className="mb-4">
                        <KnobSection label="Input Gain" val={params.inputGain} min={-30} max={30} unit="dB" onChange={(v: number)=>handleParamChange('inputGain', v)} />
                    </div>
                </div>

                {/* PHASE 3: CENTER PANEL (cols 3-10) - Dominant */}
                <div className="flex-1 flex flex-col items-center py-8 px-12 gap-12 bg-black/5">
                    {/* TOP: Graph Panel - Recessed Rectangle */}
                    <div className="w-[600px] h-[260px] bg-black p-[2px] rounded border border-black shadow-[inset_0_3px_50px_rgba(0,0,0,1)] relative overflow-hidden group">
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center bg-[#1e293b]/90 backdrop-blur-md rounded border border-white/10 p-1 z-10 shadow-2xl">
                             <button onClick={()=>setViewMode('meter')} className={`flex items-center justify-center w-[120px] h-9 text-[11px] font-bold uppercase transition-all ${viewMode==='meter'?'bg-slate-700 text-white shadow-lg':'text-slate-500'}`}>Meter</button>
                             <button onClick={()=>setViewMode('graph')} className={`flex items-center justify-center w-[120px] h-9 text-[11px] font-bold uppercase transition-all ${viewMode==='graph'?'bg-slate-700 text-white shadow-lg':'text-slate-500'}`}>Graph</button>
                        </div>
                        <canvas ref={meterRef} width={596} height={256} className="w-full h-full rounded opacity-90" />
                    </div>

                    {/* MIDDLE: Control Grid 2x3 + Side Pillar */}
                    <div className="flex gap-16 w-full justify-center items-end">
                        {/* 2 Row x 3 Column Matrix */}
                        <div className="flex flex-col gap-16">
                             {/* Row 1 */}
                            <div className="flex gap-16">
                                <KnobSection label="Threshold" val={params.threshold} min={-50} max={0} unit="dB" onChange={(v: number)=>handleParamChange('threshold', v)} />
                                <KnobSection label="Ratio" val={params.ratio} min={1} max={30} unit=":1" onChange={(v: number)=>handleParamChange('ratio', v)} />
                                <KnobSection label="Make Up" val={params.makeup} min={-20} max={50} unit="dB" onChange={(v: number)=>handleParamChange('makeup', v)} />
                            </div>
                            {/* Row 2 */}
                            <div className="flex gap-16">
                                <KnobSection label="Knee" val={params.knee} min={0} max={1} unit="" onChange={(v: number)=>handleParamChange('knee', v)} />
                                <KnobSection label="Attack" val={params.attack*1000} min={1} max={200} unit="ms" onChange={(v: number)=>handleParamChange('attack', v/1000)} />
                                <KnobSection label="Release" val={params.release*1000} min={5} max={5000} unit="ms" onChange={(v: number)=>handleParamChange('release', v/1000)} />
                            </div>
                        </div>

                        {/* SIDE: Aligned Right inside center - Logic strip */}
                        <div className="flex flex-col gap-12 pb-14 min-w-[70px]">
                            <div className="flex flex-col gap-1">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center [font-variant:small-caps]">Auto Gain</span>
                                {['OFF', '0 dB', '-12 dB'].map((l, i) => (
                                    <button key={i} onClick={() => handleParamChange('autoGain', i)} 
                                        className={`w-[70px] h-7 text-[10px] font-bold border border-black rounded-sm transition-all ${params.autoGain === i ? 'bg-[#38bdf8] text-black shadow-[0_0_12px_rgba(56,189,248,0.4)]' : 'bg-black/40 text-slate-500 hover:text-slate-300'}`}>
                                        {l}
                                    </button>
                                ))}
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center [font-variant:small-caps]">Release</span>
                                <button className="w-[70px] h-10 bg-black/40 text-[#38bdf8] border border-[#38bdf8]/20 rounded-sm font-bold text-[10px] shadow-sm hover:bg-[#38bdf8]/10">AUTO</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* PHASE 3: RIGHT PANEL (cols 11-12) - 220px Vertical Stack */}
                <div className="w-[220px] flex flex-col items-center py-10 px-8 border-l border-black/20 justify-between bg-black/10">
                    <div className="flex flex-col items-center gap-4 w-full">
                        <div className="flex items-center gap-3">
                             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest [font-variant:small-caps]">Limiter</span>
                             <div className={`w-2.5 h-2.5 rounded-full ring-2 ring-black ${params.limiter ? 'bg-red-500 shadow-[0_0_10px_red]' : 'bg-red-950'}`}></div>
                        </div>
                        <button onClick={()=>handleParamChange('limiter', params.limiter?0:1)} className={`w-[84px] h-10 text-[11px] font-bold rounded border border-black shadow-lg transition-all ${params.limiter ? 'bg-slate-200 text-black':'bg-black/40 text-slate-500'}`}>ON</button>
                    </div>

                    <div className="flex flex-col gap-8 w-full items-center">
                        <KnobSection label="Limiter" val={params.limiterThreshold} min={-20} max={0} unit="dB" onChange={(v: number)=>handleParamChange('limiterThreshold', v)} />
                        <KnobSection label="Distortion" val={params.distortion} min={0} max={100} unit="%" onChange={(v: number)=>handleParamChange('distortion', v)} />
                        <KnobSection label="Mix" val={params.mix} min={0} max={100} unit="%" onChange={(v: number)=>handleParamChange('mix', v)} />
                        <KnobSection label="Out Gain" val={params.outputGain} min={-30} max={30} unit="dB" onChange={(v: number)=>handleParamChange('outputGain', v)} />
                        
                        {/* Peak Meter Recessed LED */}
                        <div className="w-full h-8 bg-black rounded shadow-[inset_0_2px_8px_rgba(0,0,0,1)] relative overflow-hidden flex items-center p-1 border border-white/5">
                            <div className="h-full bg-[#38bdf8] shadow-[0_0_15px_#38bdf8] transition-all" style={{ width: `${Math.max(0, (outputLevel + 60) * (100/63))}%` }}></div>
                            <div className="absolute left-1/2 -translate-x-1/2 text-[10px] font-bold text-white font-mono tracking-tighter mix-blend-difference opacity-50">{(outputLevel).toFixed(1)}dB</div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Footer Status Bar */}
            <div className="h-8 bg-black/60 flex items-center justify-center border-t border-black/50 backdrop-blur-sm">
                <span className="text-[10px] font-bold text-slate-700 tracking-[1.5em] uppercase italic">Precision Dynamics Engine · Industrial Edition v7.0</span>
            </div>
        </div>
    )
}

function KnobSection({ label, val, min, max, unit, onChange }: any) {
    const handleMouseDown = (e: React.MouseEvent) => {
        const startY = e.clientY; const startVal = val;
        const move = (me: MouseEvent) => {
            const dY = startY - me.clientY; const sensitivity = me.shiftKey ? 0.005 : 0.02;
            const newVal = startVal + (dY * (max-min) * sensitivity) / 180;
            onChange(Math.max(min, Math.min(max, newVal)));
        };
        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
        window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    };

    return (
        <div className="flex flex-col items-center">
            {/* Phase 4: Component System - Knob Container */}
            <div className="relative cursor-ns-resize h-[84px] w-[84px] shadow-2xl transition-transform active:scale-[0.98]" onMouseDown={handleMouseDown}>
                <KnobDisplay value={val} min={min} max={max} size="w-full h-full" />
                <div className="absolute -inset-4 border border-white/5 rounded-full pointer-events-none opacity-20" />
            </div>
            {/* Phase 2: Strict Labels/Values BELOW */}
            <div className="flex flex-col items-center mt-3 h-[42px] justify-center gap-0.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center [font-variant:small-caps]">{label}</span>
                <span className="text-[12px] font-black text-[#38bdf8] font-mono drop-shadow-[0_0_10px_rgba(56,189,248,0.3)]">
                    {val.toFixed(1)}<span className="text-[8px] text-slate-700 ml-0.5 font-sans lowercase">{unit}</span>
                </span>
            </div>
        </div>
    )
}

function KnobDisplay({ value, min, max, size }: { value: number, min: number, max: number, size: string }) {
    const rotation = ((value - min) / (max - min)) * 270 - 135;
    return (
        <div className={`relative ${size} rounded-full border border-black/80 overflow-hidden shadow-2xl`}>
            {/* Phase 4: Radical Metallic Gradient */}
            <div className="absolute inset-0 bg-[#cbd5e1]" 
                 style={{ backgroundImage: 'conic-gradient(from 0deg, #94a3b8, #cbd5e1, #f1f5f9, #cbd5e1, #94a3b8, #64748b, #94a3b8)' }}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1),transparent)]" />
            </div>
            {/* Inset Ring */}
            <div className="absolute inset-2 rounded-full border border-black/10 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
            {/* Tactile Indicator */}
            <div className="absolute inset-0 transition-transform duration-75" style={{ transform: `rotate(${rotation}deg)` }}>
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-[3px] h-3.5 rounded-full bg-black/90 shadow-[0_0_2px_rgba(255,255,255,0.3)]" />
            </div>
        </div>
    )
}
