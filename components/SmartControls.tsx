"use client"
import { useProjectStore } from "@/store/projectStore"
import { audioEngine } from "@/engine/AudioEngineAdapter"
import {
    ChevronDown, Settings,
    Maximize2, MoreHorizontal,
    Activity, Sliders, Layout,
    Zap, Music, Volume2, Power
} from "lucide-react"

export function SmartControls() {
    const {
        focusedTrackId, tracks, showSmartControls, toggleSmartControls,
        updateTrack
    } = useProjectStore()

    const track = tracks.find(t => t.id === focusedTrackId)

    if (!showSmartControls) return null

    if (!track) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-studio-sunken border-t border-black text-studio-text">
                <Sliders className="w-12 h-12 mb-4 opacity-10" />
                <div className="text-[10px] font-black uppercase tracking-[0.3em] px-8 py-3 border border-white/5 rounded-full bg-black/40 shadow-inner">
                    Select a track to view Smart Controls
                </div>
            </div>
        )
    }

    const handleParamChange = (field: string, val: number) => {
        updateTrack(track.id, { [field]: val } as any);
    }

    return (
        <div className="flex flex-col h-full bg-studio-sunken overflow-hidden select-none relative z-30 shadow-[0_-15px_40px_rgba(0,0,0,0.4)]">
            {/* 1. Smart Controls Local Toolbar */}
            <div className="h-9 bg-studio-panel border-b border-black flex items-center px-4 justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 bg-studio-void border border-studio-line rounded px-2.5 h-7 cursor-pointer hover:border-studio-line-strong transition-colors group">
                        <span className="text-[10px] font-black text-white/90 group-hover:text-white uppercase tracking-tighter">Controls</span>
                        <ChevronDown className="w-3 h-3 text-studio-text-dim" />
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button className="p-1 hover:bg-white/5 rounded transition-all"><Maximize2 className="w-4 h-4 text-studio-text-dim hover:text-white" /></button>
                </div>
            </div>

            {/* 2. Main Editing Workspace (Split) */}
            <div className="flex-1 flex overflow-hidden">
                {/* Local Inspector Sidebar (Mac Style) */}
                <div className="w-[180px] border-r border-black bg-studio-panel flex flex-col shrink-0 p-3 gap-6 overflow-y-auto custom-scrollbar-v shadow-inner shadow-2xl">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between group cursor-pointer">
                            <span className="text-[10px] font-black text-studio-text-dim uppercase tracking-[0.2em] leading-none group-hover:text-studio-text">Layout</span>
                            <Layout className="w-3.5 h-3.5 text-accent-cyan" />
                        </div>
                        <div className="h-7 bg-studio-void border border-studio-line rounded flex items-center px-2.5 text-[11px] font-black text-accent-cyan shadow-inner group-hover:border-studio-line-strong truncate">
                            Modern Industrial
                        </div>
                    </div>

                    {/* Parameter List Column */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between group cursor-pointer">
                            <span className="text-[10px] font-black text-studio-text-dim uppercase tracking-[0.2em] leading-none group-hover:text-studio-text">Parameter</span>
                            <Zap className="w-3.5 h-3.5 text-studio-text-dim" />
                        </div>
                        <div className="flex flex-col gap-1 h-[120px] overflow-y-auto custom-scrollbar-v pr-1">
                            {['Cutoff', 'Resonance', 'Drive', 'Compressor Threshold', 'Reverb Mix'].map(p => (
                                <div key={p} className="h-6 flex items-center px-2 bg-black/40 border border-white/5 rounded text-[10px] font-black text-studio-text-dim hover:text-accent-cyan cursor-pointer transition-all">{p}</div>
                            ))}
                        </div>
                    </div>

                    {/* Mappings Filter Area */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between group cursor-pointer">
                            <span className="text-[10px] font-black text-studio-text-dim uppercase tracking-[0.2em] leading-none group-hover:text-studio-text">Compare</span>
                            <Activity className="w-3.5 h-3.5 text-studio-text-dim" />
                        </div>
                    </div>
                </div>

                {/* Main Glass/Brushed Metal Control Interface */}
                <div className="flex-1 bg-brushed-metal relative flex items-center justify-center overflow-hidden p-8">
                    {/* Shadow Islands for Contrast */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none"></div>

                    <div className="grid grid-cols-4 gap-12 relative z-10 w-full max-w-4xl px-12">
                        {[
                            { name: 'Warmth', field: 'warmth', color: 'orange' },
                            { name: 'Punch', field: 'punch', color: 'sky' },
                            { name: 'Ambience', field: 'ambience', color: 'purple' },
                            { name: 'Final Mix', field: 'volume', color: 'green' }
                        ].map(knob => (
                            <div key={knob.name} className="flex flex-col items-center gap-4 group">
                                <div className="relative">
                                    <Knob
                                        color={knob.color}
                                        value={knob.field === 'volume' ? track.volume : 0.5}
                                        onChange={(v) => handleParamChange(knob.field, v)}
                                    />
                                    {/* Neon Indicator (Magic Pro signature) */}
                                    {track.id === focusedTrackId && (
                                        <div className="absolute -inset-1 rounded-full bg-accent-cyan/0 group-hover:bg-accent-cyan/10 blur-xl transition-all duration-700"></div>
                                    )}
                                </div>
                                <span className="text-[10px] font-black text-studio-text-dim group-hover:text-white uppercase tracking-[0.15em] transition-colors">{knob.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <style jsx>{`
                .bg-brushed-metal {
                    background: #161616;
                    background-image: linear-gradient(rgba(255,255,255,.01) 50%, transparent 50%),
                    linear-gradient(90deg, rgba(255,255,255,.022) 50%, transparent 50%);
                    background-size: 4px 4px;
                }
            `}</style>

        </div>
    )
}

interface KnobProps {
    color: string;
    value: number;
    onChange: (val: number) => void;
}

function Knob({ color, value = 0.5, onChange }: KnobProps) {
    const handleMouseDown = (e: React.MouseEvent) => {
        const startY = e.clientY;
        const startVal = value;
        const onMove = (me: MouseEvent) => {
            const dy = (startY - me.clientY) / 100;
            onChange(Math.max(0, Math.min(1, startVal + dy)));
        };
        const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }

    const colors: Record<string, string> = {
        sky: '#0ea5e9',
        orange: '#f97316',
        purple: '#a855f7',
        green: '#1ed760'
    };
    const activeColor = colors[color] || colors.sky;

    return (
        <div
            className="w-20 h-20 rounded-full bg-gradient-to-tr from-studio-sunken via-studio-control to-studio-control border border-studio-line shadow-[0_10px_30px_rgba(0,0,0,0.6)] relative cursor-ns-resize active:scale-[1.05] transition-transform duration-150"
            onMouseDown={handleMouseDown}
        >
            {/* Radial Ring */}
            <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="40" cy="40" r="32" fill="none" stroke="#000" strokeWidth="4" />
                <circle
                    cx="40"
                    cy="40"
                    r="32"
                    fill="none"
                    stroke={activeColor}
                    strokeWidth="4"
                    strokeDasharray={`${value * 201} 201`}
                    className="opacity-40"
                />
            </svg>

            {/* Knob Body Indicator */}
            <div
                className="absolute inset-[15%] rounded-full bg-studio-sunken border border-white/5 shadow-inner transition-transform duration-75"
                style={{ transform: `rotate(${(value * 270) - 135}deg)` }}
            >
                <div className={`absolute top-1 left-1/2 -translate-x-1/2 w-1 h-3 rounded-full ${value > 0.1 ? 'bg-accent-cyan' : 'bg-studio-raised'} shadow-[0_0_8px_rgba(14,165,233,0.4)]`}></div>
            </div>

            {/* Top Glare */}
            <div className="absolute inset-[15%] rounded-full bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
        </div>
    )
}
