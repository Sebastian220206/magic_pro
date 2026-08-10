"use client"

import React, { useState } from "react"
import { useProjectStore } from "@/store/projectStore"
import { X, ChevronDown, ChevronRight, Power, Settings2, Info } from "lucide-react"

export function NoteRepeatDialog() {
    const { 
        showNoteRepeatDialog, 
        toggleNoteRepeat, 
        noteRepeatSettings, 
        updateNoteRepeatSettings 
    } = useProjectStore()

    const [isExpanded, setIsExpanded] = useState(true)

    if (!showNoteRepeatDialog) return null

    const rates = ["1/4", "1/4T", "1/4.", "1/8", "1/8T", "1/8.", "1/16", "1/16T", "1/16.", "1/32", "1/32T", "1/64"]

    return (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 lg:top-32 lg:left-[400px] lg:translate-x-0 z-[600] w-[500px] max-w-[calc(100vw-16px)] animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-studio-control/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_30px_90px_rgba(0,0,0,0.8)] overflow-hidden">
                {/* Header */}
                <div className="h-9 flex items-center justify-between px-3 bg-white/5 border-b border-black/40">
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="p-1 hover:bg-white/10 rounded transition-colors"
                        >
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-studio-text-mid" /> : <ChevronRight className="w-3.5 h-3.5 text-studio-text-mid" />}
                        </button>
                        <span className="text-[11px] font-black uppercase tracking-widest text-studio-text">Note Repeat</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={() => updateNoteRepeatSettings({ enabled: !noteRepeatSettings.enabled })}
                            className={`w-6 h-6 flex items-center justify-center rounded-full transition-all ${noteRepeatSettings.enabled ? 'bg-accent-cyan text-white shadow-[0_0_10px_rgba(14,165,233,0.5)]' : 'text-studio-text-dim hover:text-studio-text bg-white/5'}`}
                        >
                            <Power className="w-3 h-3" />
                        </button>
                        <button 
                            onClick={() => toggleNoteRepeat(false)}
                            className="p-1.5 hover:bg-red-500/20 text-studio-text-dim hover:text-red-400 rounded-full transition-all"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Main Controls */}
                <div className="p-6 flex flex-col gap-6">
                    <div className="grid grid-cols-3 gap-8">
                        {/* Rate Column */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-bold text-studio-text-dim uppercase tracking-tight">Rate:</label>
                            <div className="relative group">
                                <select 
                                    value={noteRepeatSettings.rate}
                                    onChange={(e) => updateNoteRepeatSettings({ rate: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[12px] font-black text-accent-cyan appearance-none hover:bg-black/60 transition-colors"
                                >
                                    {rates.map(r => <option key={r} value={r}>{r} Note</option>)}
                                </select>
                                <ChevronDown className="w-3 h-3 text-studio-text-dim absolute right-2 top-2.5 pointer-events-none group-hover:text-accent-cyan" />
                            </div>
                            <div className="flex gap-1 mt-1">
                                <NoteTypeButton active={!noteRepeatSettings.rate.includes('T') && !noteRepeatSettings.rate.includes('.')} label="♩" />
                                <NoteTypeButton active={noteRepeatSettings.rate.includes('T')} label="♩T" />
                                <NoteTypeButton active={noteRepeatSettings.rate.includes('.')} label="♩." />
                            </div>
                        </div>

                        {/* Velocity Column */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-bold text-studio-text-dim uppercase tracking-tight">Velocity:</label>
                            <div className="bg-black/40 border border-white/10 rounded h-8 flex items-center justify-between px-2">
                                <span className="text-[12px] font-black text-studio-text">{noteRepeatSettings.velocity}</span>
                                <div className="flex flex-col">
                                    <button className="text-studio-text-dim hover:text-accent-cyan"><ChevronDown className="w-3 h-3 rotate-180" /></button>
                                    <button className="text-studio-text-dim hover:text-accent-cyan"><ChevronDown className="w-3 h-3" /></button>
                                </div>
                            </div>
                        </div>

                        {/* Gate Column */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-bold text-studio-text-dim uppercase tracking-tight">Gate:</label>
                            <div className="bg-black/40 border border-white/10 rounded h-8 flex items-center justify-between px-2">
                                <span className="text-[12px] font-black text-studio-text">{noteRepeatSettings.gate}%</span>
                                <div className="flex flex-col">
                                    <button className="text-studio-text-dim hover:text-accent-cyan"><ChevronDown className="w-3 h-3 rotate-180" /></button>
                                    <button className="text-studio-text-dim hover:text-accent-cyan"><ChevronDown className="w-3 h-3" /></button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Controller Assignments (Revealed Area) */}
                    {isExpanded && (
                        <div className="border-t border-white/5 pt-6 animate-in slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-3 gap-8 opacity-60">
                                <ControllerSelect label="Modulation Wheel" />
                                <ControllerSelect label="Aftertouch" />
                                <ControllerSelect label="Pitch Bend" />
                            </div>
                            <div className="mt-4 grid grid-cols-3 gap-8">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-bold text-studio-text-dim">MAX: {noteRepeatSettings.rate}</span>
                                    <span className="text-[9px] font-bold text-studio-text-dim">MIN: 1/16</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-bold text-studio-text-dim">MAX OFFSET: +0</span>
                                    <span className="text-[9px] font-bold text-studio-text-dim">MIN OFFSET: -0</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-bold text-studio-text-dim">MAX: 100%</span>
                                    <span className="text-[9px] font-bold text-studio-text-dim">MIN: 100%</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer: Key Remote Strip */}
                <div className="bg-black/40 border-t border-white/10 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <input 
                            type="checkbox" 
                            checked={noteRepeatSettings.keyRemote} 
                            onChange={(e) => updateNoteRepeatSettings({ keyRemote: e.target.checked })}
                            className="w-3 h-3 rounded bg-black/60 border-white/10 text-accent-cyan focus:ring-accent-cyan"
                        />
                        <span className="text-[10px] font-bold text-studio-text-mid uppercase tracking-tighter">Key Remote</span>
                    </div>

                    {/* Miniature Piano Mapping */}
                    <div className="flex h-16 rounded overflow-hidden border border-black/60 shadow-inner">
                        <RemoteKey note="C-1" label="ON/OFF" active={noteRepeatSettings.onOffButton} onClick={() => updateNoteRepeatSettings({ onOffButton: !noteRepeatSettings.onOffButton })} />
                        <RemoteKey note="D-1" label="SPOT ERASE" secondary />
                        <RemoteKey note="E-1" label="1/4" rate="1/4" />
                        <RemoteKey note="F-1" label="1/8" rate="1/8" />
                        <RemoteKey note="G-1" label="1/16" rate="1/16" />
                        <RemoteKey note="A-1" label="1/32" rate="1/32" />
                        <RemoteKey note="B-1" label="1/64" rate="1/64" />
                        <RemoteKey note="C0" label="10%" />
                        <RemoteKey note="D0" label="50%" />
                        <RemoteKey note="E0" label="90%" />
                    </div>
                </div>
            </div>
        </div>
    )
}

function NoteTypeButton({ active, label }: { active: boolean, label: string }) {
    return (
        <button className={`flex-1 h-6 flex items-center justify-center rounded border text-[11px] transition-all ${active ? 'bg-accent-cyan border-accent-cyan text-white shadow-lg' : 'bg-black/20 border-white/5 text-studio-text-dim hover:text-studio-text-mid'}`}>
            {label}
        </button>
    )
}

function ControllerSelect({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm border border-white/20 bg-black/20"></div>
            <div className="flex-1 bg-black/40 border border-white/10 rounded h-7 flex items-center px-2 text-[10px] font-bold text-studio-text-dim justify-between">
                {label}
                <ChevronDown className="w-3 h-3" />
            </div>
        </div>
    )
}

function RemoteKey({ note, label, active, secondary, rate, onClick }: { note: string, label: string, active?: boolean, secondary?: boolean, rate?: string, onClick?: () => void }) {
    const isBlack = note.includes('#')
    return (
        <div 
            onClick={onClick}
            className={`flex-1 flex flex-col items-center justify-end pb-1 border-r border-black/20 group relative cursor-pointer ${active ? 'bg-accent-cyan/40' : secondary ? 'bg-red-500/10' : 'bg-studio-raised hover:bg-studio-raised'} transition-colors`}
        >
            <span className="text-[7px] font-black text-studio-text-mid absolute top-1 left-1">{note}</span>
            <div className={`px-1 py-0.5 rounded-[1px] text-[7px] font-black leading-none text-center ${active ? 'bg-accent-cyan text-white' : 'bg-white/10 text-studio-text group-hover:bg-white/20'}`}>
                {label}
            </div>
        </div>
    )
}
