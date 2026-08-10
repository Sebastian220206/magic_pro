"use client"

import { useState } from "react"
import { useProjectStore } from "@/store/projectStore"
import { X, Play, Activity } from "lucide-react"

export function DrumReplacementDialog() {
    const {
        showDrumReplacement,
        toggleDrumReplacement,
        confirmDrumReplacement
    } = useProjectStore()

    const [instrument, setInstrument] = useState('Kick')
    const [mode, setMode] = useState('replacement') // replacement | doubling
    const [threshold, setThreshold] = useState(-12.0)
    const [triggerNote, setTriggerNote] = useState('Auto')
    const [timingOffset, setTimingOffset] = useState(0.0)

    if (!showDrumReplacement) return null

    const handleConfirm = () => {
        confirmDrumReplacement({
            instrument,
            mode,
            threshold,
            triggerNote,
            timingOffset
        })
    }

    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 backdrop-blur-[4px] animate-in fade-in duration-200">
            <div
                className="bg-studio-control border border-white/10 rounded-2xl shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden w-[540px] animate-in zoom-in-95 duration-200"
                onKeyDown={(e) => { if (e.key === 'Escape') toggleDrumReplacement(null) }}
            >
                {/* Header */}
                <div className="h-14 px-6 flex items-center justify-between border-b border-black/40 bg-studio-control">
                    <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-accent-cyan" />
                        <span className="text-[14px] font-black text-white uppercase tracking-widest">Drum Replacement/Doubling</span>
                    </div>
                    <button onClick={() => toggleDrumReplacement(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-studio-text-mid hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 flex flex-col gap-8">
                    {/* Instrument and Mode Selection */}
                    <div className="grid grid-cols-2 gap-12">
                        <div className="flex flex-col gap-3">
                            <label className="text-[10px] font-black text-studio-text-dim uppercase tracking-widest">Instrument</label>
                            <select
                                value={instrument}
                                onChange={(e) => setInstrument(e.target.value)}
                                className="bg-black/20 border border-black/60 rounded-lg h-10 px-4 text-[13px] font-bold text-studio-text outline-none focus:border-accent-cyan/50 appearance-none bg-no-repeat bg-[right_1rem_center] cursor-pointer"
                                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")' }}
                            >
                                <option>Kick</option>
                                <option>Snare</option>
                                <option>Tom</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-3">
                            <label className="text-[10px] font-black text-studio-text-dim uppercase tracking-widest">Mode</label>
                            <div className="flex bg-black/20 border border-black/60 rounded-lg p-1 h-10">
                                <button
                                    onClick={() => setMode('replacement')}
                                    className={`flex-1 rounded-md text-[11px] font-black uppercase tracking-tighter transition-all ${mode === 'replacement' ? 'bg-accent-cyan text-white shadow-lg' : 'text-studio-text-dim hover:text-studio-text'}`}
                                >Replacement</button>
                                <button
                                    onClick={() => setMode('doubling')}
                                    className={`flex-1 rounded-md text-[11px] font-black uppercase tracking-tighter transition-all ${mode === 'doubling' ? 'bg-accent-cyan text-white shadow-lg' : 'text-studio-text-dim hover:text-studio-text'}`}
                                >Doubling</button>
                            </div>
                        </div>
                    </div>

                    {/* Relative Threshold */}
                    <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-end">
                            <label className="text-[10px] font-black text-studio-text-dim uppercase tracking-widest">Relative Threshold</label>
                            <span className="text-[14px] font-black text-accent-cyan font-mono">{threshold.toFixed(1)} dB</span>
                        </div>
                        <input
                            type="range"
                            min="-40"
                            max="0"
                            step="0.5"
                            value={threshold}
                            onChange={(e) => setThreshold(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-black/40 rounded-full appearance-none cursor-pointer accent-cyan-400 outline-none"
                        />
                        <div className="flex justify-between text-[9px] font-black text-studio-text-dim">
                            <span>-40.0 dB</span>
                            <button className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded transition-all text-accent-cyan flex items-center gap-1.5 active:scale-95">
                                <Play className="w-2.5 h-2.5 fill-current" />
                                Preview
                            </button>
                            <span>0.0 dB</span>
                        </div>
                    </div>

                    {/* Trigger Note and Timing Offset */}
                    <div className="grid grid-cols-2 gap-12">
                        <div className="flex flex-col gap-3">
                            <label className="text-[10px] font-black text-studio-text-dim uppercase tracking-widest">Trigger Note</label>
                            <select
                                value={triggerNote}
                                onChange={(e) => setTriggerNote(e.target.value)}
                                className="bg-black/20 border border-black/60 rounded-lg h-10 px-4 text-[13px] font-bold text-studio-text outline-none focus:border-accent-cyan/50 appearance-none bg-no-repeat bg-[right_1rem_center] cursor-pointer"
                                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")' }}
                            >
                                <option>Auto</option>
                                <option>C1 (36)</option>
                                <option>D1 (38)</option>
                                <option>A1 (45)</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-3">
                            <div className="flex justify-between">
                                <label className="text-[10px] font-black text-studio-text-dim uppercase tracking-widest">Timing Offset</label>
                                <span className="text-[12px] font-bold text-studio-text-mid font-mono">{timingOffset.toFixed(1)} ms</span>
                            </div>
                            <input
                                type="range"
                                min="-20"
                                max="20"
                                step="0.1"
                                value={timingOffset}
                                onChange={(e) => setTimingOffset(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-black/40 rounded-full appearance-none cursor-pointer accent-cyan-400 outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="h-16 px-8 flex items-center justify-between bg-studio-panel border-t border-black/40 shrink-0">
                    <button
                        onClick={() => toggleDrumReplacement(null)}
                        className="text-[12px] font-black text-studio-text-dim hover:text-white uppercase tracking-widest transition-all"
                    >Cancel</button>
                    <button
                        onClick={handleConfirm}
                        className="bg-accent-cyan hover:bg-accent-cyan text-white text-[13px] font-black uppercase tracking-widest px-10 h-10 rounded-full shadow-lg shadow-accent-cyan/20 transition-all active:scale-95"
                    >OK</button>
                </div>
            </div>
        </div>
    )
}
