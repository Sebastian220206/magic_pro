"use client"
import React, { useState, useEffect, useRef } from 'react'
import { useProjectStore } from '@/store/projectStore'
import { audioEngine } from '@/engine/AudioEngineAdapter'
import { Power, ChevronDown, RotateCcw, Play, Scissors, Layers, Settings, X, MoreHorizontal } from 'lucide-react'

interface ReverbProps {
    trackId: string
    pluginId: string
}

export function ChromaVerb({ trackId, pluginId }: ReverbProps) {
    const { updatePluginParams, tracks } = useProjectStore()
    const track = tracks.find(t => t.id === trackId)
    const plugin = track?.plugins.find(p => p.id === pluginId)

    const [params, setParams] = useState({
        attack: plugin?.params?.attack ?? 0,
        size: plugin?.params?.size ?? 60,
        density: plugin?.params?.density ?? 60,
        predelay: plugin?.params?.predelay ?? 8,
        decay: plugin?.params?.decay ?? 1.10,
        distance: plugin?.params?.distance ?? 50,
        dry: plugin?.params?.dry ?? 0,
        wet: plugin?.params?.wet ?? 100,
        modeIndex: plugin?.params?.modeIndex ?? 0,
        freeze: plugin?.params?.freeze ?? 0,
    })

    const [showModes, setShowModes] = useState(false)
    const displayRef = useRef<HTMLCanvasElement>(null)
    const [reduction, setReduction] = useState(0)

    useEffect(() => {
        let frame: number;
        const draw = () => {
            drawSpectralWaterfall();
            frame = requestAnimationFrame(draw);
        }
        draw();
        return () => cancelAnimationFrame(frame);
    }, [trackId, pluginId]);

    const drawSpectralWaterfall = () => {
        const canvas = displayRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // Draw EQ Lines (Static representations for now)
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.font = '8px bold sans-serif';
        ctx.fillStyle = '#444';

        [20, 30, 40, 100, 1000, 10000, 20000].forEach((f, i) => {
            const x = (i / 7) * w;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        });

        // Vibrant Particle Cloud representation (ChromaVerb signature look)
        const particles = 1200;
        ctx.shadowBlur = 2;
        for (let i = 0; i < particles; i++) {
            const x = Math.random() * w;
            const freq_factor = (x / w);
            const h_range = (0.35 + 0.6 * Math.sin(freq_factor * Math.PI));
            const y = (h * 0.9) - (Math.random() * h * h_range);

            // Continuous Rainbow Color mapping
            const hue = freq_factor * 280; // 0 (red) to 280 (purple)
            const alpha = (0.15 + Math.random() * 0.45);
            ctx.fillStyle = `hsla(${hue}, 80%, 60%, ${alpha})`;

            ctx.beginPath();
            ctx.arc(x, y, 1.1, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;

        // Draw Secondary Reference White Curve (Curve 2)
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, h * 0.32);
        ctx.bezierCurveTo(w * 0.4, h * 0.32, w * 0.6, h * 0.25, w, h * 0.28);
        ctx.stroke();

        // Draw the Red Active Damping EQ Curve (Red Box 1)
        ctx.strokeStyle = '#f24c3e'; // Correct reddish-orange
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, h * 0.35);
        ctx.bezierCurveTo(w * 0.3, h * 0.35, w * 0.5, h * 0.6, w * 0.6, h * 0.55);
        ctx.bezierCurveTo(w * 0.7, h * 0.5, w * 0.8, h * 0.45, w, h * 0.43);
        ctx.stroke();

        // Draw EQ Handles (Red Box 1 nodes)
        const handles = [
            { pos: [w * 0.3, h * 0.35], active: false },
            { pos: [w * 0.5, h * 0.48], active: true },
            { pos: [w * 0.72, h * 0.54], active: false },
            { pos: [w * 0.88, h * 0.38], active: false }
        ];

        handles.forEach((hObj, i) => {
            const [x, y] = hObj.pos;
            if (hObj.active) {
                ctx.shadowBlur = 15; ctx.shadowColor = 'white';
                ctx.fillStyle = 'white';
                ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0;
                ctx.strokeStyle = '#f24c3e'; ctx.lineWidth = 2.5; ctx.stroke();
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.6)';
                ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
            }
        });
    };

    const handleParamChange = (key: string, val: number) => {
        const newParams = { ...params, [key]: val };
        setParams(newParams);
        updatePluginParams(trackId, pluginId, newParams);
    };

    const reverbModes = [
        { name: 'Room', icon: '◈' }, { name: 'Chamber', icon: '❂' }, { name: 'Concert Hall', icon: '✧' },
        { name: 'Theatre', icon: '❖' }, { name: 'Synth Hall', icon: '❃' }, { name: 'Digital', icon: '⚙' },
        { name: 'Dark Room', icon: '🌑' }, { name: 'Dense', icon: '▩' }, { name: 'Smooth Space', icon: '≋' },
        { name: 'Vocal Hall', icon: '🎤' }, { name: 'Reflective Hall', icon: '◰' }, { name: 'Strange Room', icon: '🌀' },
        { name: 'Airy', icon: '💨' }, { name: 'Bloomy', icon: '🌸' }
    ];

    return (
        <div className="flex flex-col w-[940px] h-[680px] bg-[#0d0d0d] shadow-[0_50px_100px_rgba(0,0,0,1)] rounded-xl border border-white/5 font-sans overflow-hidden">

            {/* Top Toolbar */}
            <div className="h-24 bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] flex flex-col justify-end px-5 border-b border-white/5 pb-2">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 border border-white/20 rounded-full flex items-center justify-center text-sky-400 group cursor-pointer hover:border-sky-400">
                            <Power className="w-6 h-6 group-hover:drop-shadow-[0_0_8px_cyan]" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-none">Aux 1</span>
                            <div className="flex items-center gap-2 bg-[#222] border border-white/10 px-3 py-1.5 rounded cursor-pointer hover:bg-[#333]">
                                <span className="text-[13px] font-bold text-zinc-300">Factory Default</span>
                                <ChevronDown className="w-4 h-4 text-zinc-500" />
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-1">
                        {['Compare', 'Copy', 'Paste', 'Undo', 'Redo'].map(b => (
                            <button key={b} className="px-4 py-1.5 bg-[#222] border border-white/10 text-zinc-300 text-[11px] font-bold rounded shadow-xl active:bg-[#333] transition-all">{b}</button>
                        ))}
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest">View: <span className="text-zinc-300">75%</span></span>
                        <div className="w-10 h-10 border border-white/10 rounded flex items-center justify-center text-zinc-500"><RotateCcw className="w-5 h-5" /></div>
                    </div>
                </div>
            </div>

            {/* Display / Visualizer Area */}
            <div className="flex-1 relative bg-gradient-to-b from-[#0d0d0d] to-[#121212] p-4 flex flex-col pt-12 select-none">
                <div className="flex items-center justify-between px-10 mb-8 absolute top-4 inset-x-0 z-10">
                    <span className="text-[11px] font-black text-zinc-500 tracking-[0.2em] uppercase">DAMPING EQ</span>
                    <div
                        onClick={() => setShowModes(!showModes)}
                        className={`px-10 py-2 rounded text-[16px] font-black tracking-widest uppercase cursor-pointer transition-all ${showModes ? 'bg-[#f27c2e] text-white' : 'bg-[#f27c2e11] border border-[#f27c2e44] text-[#f27c2e] shadow-[0_0_20px_#f27c2e22] hover:bg-[#f27c2e22]'}`}
                    >
                        {reverbModes[params.modeIndex].name}
                    </div>
                    <div className="flex gap-px bg-black/60 backdrop-blur rounded overflow-hidden border border-white/10 p-0.5">
                        <button className="px-6 py-1.5 bg-[#f24c3e] text-white text-[10px] font-black uppercase tracking-widest rounded-sm shadow-lg">Main</button>
                        <button className="px-6 py-1.5 text-zinc-600 text-[10px] font-black uppercase tracking-widest hover:text-zinc-400 transition-colors">Details</button>
                    </div>
                </div>

                {showModes && (
                    <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center pt-24 pb-12">
                        <div className="w-[820px] h-[360px] bg-[#1a1a1a] rounded-2xl border border-white/10 p-8 shadow-[0_40px_100px_rgba(0,0,0,1)] flex flex-wrap gap-8 items-center justify-center overflow-y-auto">
                            {reverbModes.map((m, idx) => (
                                <div key={m.name} className={`flex flex-col items-center gap-3 p-4 rounded-xl cursor-pointer transition-all hover:scale-105 ${params.modeIndex === idx ? 'bg-sky-400/20 border border-sky-400/40' : 'hover:bg-white/5'}`} onClick={() => { handleParamChange('modeIndex', idx); setShowModes(false); }}>
                                    <div className={`text-4xl filter drop-shadow-[0_0_15px_currentColor] ${params.modeIndex === idx ? 'text-sky-400' : 'text-zinc-400'}`}>{m.icon}</div>
                                    <span className={`text-[11px] font-black w-24 text-center leading-tight uppercase tracking-widest ${params.modeIndex === idx ? 'text-white' : 'text-zinc-500'}`}>{m.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex-1 rounded-3xl overflow-hidden relative">
                    <canvas ref={displayRef} width={900} height={400} className="w-full h-full opacity-70" />

                    {/* Bottom Tech Readout Row */}
                    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-16 text-[11px] font-black uppercase tracking-[0.2em] items-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                        <div className="flex gap-2 items-center">
                            <span className="text-zinc-500">Frequency:</span>
                            <span className="text-[#f24c3e] text-[13px] font-mono">510 Hz</span>
                        </div>
                        <div className="flex gap-2 items-center">
                            <span className="text-zinc-500">Ratio:</span>
                            <span className="text-[#f24c3e] text-[13px] font-mono">0.93 x</span>
                        </div>
                        <div className="flex gap-2 items-center">
                            <span className="text-zinc-500">Q:</span>
                            <span className="text-[#f24c3e] text-[13px] font-mono">0.71</span>
                        </div>
                    </div>

                    {/* Visualizer Mode Button (Number 2) */}
                    <div className="absolute bottom-4 right-8 w-11 h-11 rounded-xl bg-gradient-to-br from-[#2a2a2a] to-[#111] border border-white/10 flex items-center justify-center cursor-pointer hover:border-[#f24c3e]/50 group transition-all shadow-2xl">
                        <div className="grid grid-cols-3 gap-1 group-hover:scale-110 transition-transform">
                            {[...Array(9)].map((_, i) => <div key={i} className="w-1.5 h-1.5 bg-[#f24c3e] rounded-full shadow-[0_0_8px_#f24c3e]"></div>)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Controls Strip */}
            <div className="h-[180px] bg-[#d6d8da] border-t border-black/20 flex px-8 items-center justify-between shadow-[inset_0_1px_4px_rgba(255,255,255,0.8)]">

                {/* Envelope / Shape Group (Red Box 6) */}
                <div className="flex flex-col gap-3">
                    <div className="flex gap-6">
                        <ControlKnob label="Attack" val={params.attack} unit="%" min={0} max={100} onChange={(v: number) => handleParamChange('attack', v)} color="#f24c3e" />
                        <ControlKnob label="Size" val={params.size} unit="%" min={0} max={100} onChange={(v: number) => handleParamChange('size', v)} color="#f24c3e" />
                        <ControlKnob label="Density" val={params.density} unit="%" min={0} max={100} onChange={(v: number) => handleParamChange('density', v)} color="#f24c3e" />
                    </div>
                    <div className="flex items-center gap-2 pl-2">
                        <div className="w-8 h-8 bg-[#fdfdfd] border border-black/15 rounded-md flex items-center justify-center text-zinc-400 shadow-sm"><Settings className="w-3.5 h-3.5" /></div>
                        <div className="flex flex-col -gap-1">
                            <span className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">Predelay</span>
                            <span className="text-[#f24c3e] font-mono text-[12px] font-black">{params.predelay} ms</span>
                        </div>
                    </div>
                </div>

                {/* Time Controls (Number 5) */}
                <div className="flex flex-col items-center pt-2 border-x border-black/5 px-8">
                    <div className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-8 h-8 rounded-lg border border-black/10 bg-white flex items-center justify-center shadow-sm text-zinc-400"><Layers className="w-4 h-4" /></div>
                            <div className="flex flex-col">
                                <span className="text-[11px] font-black tracking-widest text-zinc-700 uppercase leading-none">Decay</span>
                                <span className="text-[14px] font-black font-mono text-[#f24c3e]">{(params.decay).toFixed(2)} s</span>
                            </div>
                        </div>
                        <div className="relative w-[110px] h-[110px] flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="55" cy="55" r="50" fill="transparent" stroke="#ced0d2" strokeWidth="5" />
                                <circle cx="55" cy="55" r="50" fill="transparent" stroke="#f24c3e" strokeWidth="8" strokeDasharray={`${params.decay * 100} 320`} strokeLinecap="round" />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-[85px] h-[85px] bg-[#f8f9fa] rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.1)] flex items-center justify-center border border-black/10">
                                    <div className="w-1.5 h-9 bg-[#f24c3e] rounded-full translate-y-[-18px]" style={{ transform: `rotate(${(params.decay / 5) * 360}deg)` }}></div>
                                </div>
                            </div>
                            <div className="absolute bottom-[-10px] inset-x-0 flex justify-between text-[8px] font-black text-zinc-500 px-6"><span>0.3</span><span>100</span></div>
                        </div>
                        <button className="px-6 py-1 bg-[#eeeff1] text-[9px] font-black text-zinc-500 rounded-md mt-4 shadow-sm border border-black/10 active:bg-white uppercase tracking-widest transition-all">Freeze</button>
                    </div>
                </div>

                {/* Spatial Controls (Number 4) */}
                <div className="flex flex-col items-center border-r border-black/5 pr-8">
                    <ControlKnob label="Distance" val={params.distance} unit="%" min={0} max={100} onChange={(v: number) => handleParamChange('distance', v)} color="#f24c3e" />
                </div>

                {/* Mix Section (Far right) */}
                <div className="flex gap-10">
                    <div className="flex flex-col items-center gap-1.5">
                        <span className="text-[10px] font-black text-zinc-600 tracking-widest uppercase">Dry</span>
                        <span className="text-[13px] font-black text-[#f24c3e] font-mono tracking-tighter">100 %</span>
                        <div className="h-[100px] w-1.5 bg-black/10 relative rounded-full shadow-inner">
                            <div className="absolute inset-x-0 bottom-0 bg-[#f24c3e] rounded-full" style={{ height: '100%' }}></div>
                            <div className="absolute top-0 left-[-12px] w-8 h-2.5 bg-white border border-[#f24c3e] rounded-sm shadow-xl z-20"></div>
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                        <span className="text-[10px] font-black text-zinc-600 tracking-widest uppercase">Wet</span>
                        <span className="text-[13px] font-black text-[#f24c3e] font-mono tracking-tighter">70 %</span>
                        <div className="h-[100px] w-1.5 bg-black/10 relative rounded-full shadow-inner">
                            <div className="absolute inset-x-0 bottom-0 bg-[#f24c3e] rounded-full" style={{ height: '70%' }}></div>
                            <div className="absolute bottom-[70%] left-[-12px] w-8 h-2.5 bg-white border border-black/20 rounded-sm shadow-xl z-20 hover:border-[#f24c3e]"></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ChromaVerb Footer */}
            <div className="h-10 bg-black flex items-center justify-center border-t border-white/5"><span className="text-[14px] font-black tracking-[1.5em] uppercase italic text-zinc-700">C h r o m a V e r b</span></div>
        </div>
    )
}

function ControlKnob({ label, val, unit, min, max, onChange, color }: any) {
    return (
        <div className="flex flex-col items-center gap-0.5">
            <span className="text-[11px] font-black tracking-widest text-zinc-500 uppercase mb-0.5">{label}</span>
            <span className="text-[13px] font-black text-[#f24c3e] font-mono tracking-tighter mb-1.5">{val.toFixed(0)} <span className="text-[8px] text-zinc-400 uppercase tracking-widest font-sans ml-px">{unit}</span></span>
            <div className="relative w-14 h-14 group cursor-ns-resize shadow-md rounded-full p-1 bg-white border border-black/5" onMouseDown={(e) => {
                const startY = e.clientY;
                const move = (me: MouseEvent) => {
                    const delta = startY - me.clientY;
                    onChange(Math.max(min, Math.min(max, val + delta * 0.5)));
                };
                const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
                window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
            }}>
                <svg className="w-full h-full transform -rotate-90 scale-95 opacity-90">
                    <circle cx="28" cy="28" r="24" fill="transparent" stroke="#ced0d2" strokeWidth="2.5" />
                    <circle cx="28" cy="28" r="24" fill="transparent" stroke={color} strokeWidth="4" strokeDasharray={`${(val / (max - min)) * 150} 150`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-1 h-3 bg-zinc-300 rounded-full translate-y-[-10px]" style={{ transform: `rotate(${(val / max) * 360}deg)` }}></div>
                </div>
            </div>
        </div>
    )
}
