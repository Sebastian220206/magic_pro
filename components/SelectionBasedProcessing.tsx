"use client"
import React, { useState } from 'react'
import { useProjectStore } from '@/store/projectStore'
import {
    X, ChevronDown, Volume2, Speaker, 
    Play, Undo2, Check, MoreHorizontal,
    Plus, Settings2, Power, Trash2
} from 'lucide-react'

export function SelectionBasedProcessing() {
    const {
        sbpState,
        updateSBPState,
        toggleSelectionBasedProcessing,
        addPluginToSBP,
        removePluginFromSBP,
        applySelectionBasedProcessing,
        marqueeSelection,
        selectedClipId
    } = useProjectStore()

    const [showChannelStripMenu, setShowChannelStripMenu] = useState(false)

    if (!sbpState) return null;

    const {
        setA, setB, activeSet,
        splitAtMarqueeBorders, createNewTake, addEffectTail,
        gainMode, previewVolume, previewEnablesSolo, previewEnablesCycle
    } = sbpState

    const currentPlugins = activeSet === 'A' ? setA : setB

    return (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[8000] w-[320px] bg-studio-raised border border-studio-line-strong rounded-lg shadow-[0_30px_60px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden text-studio-text select-none">
            {/* Header */}
            <div className="h-9 flex items-center justify-between px-3 bg-studio-control border-b border-studio-line cursor-move">
                <div className="flex gap-1.5">
                    <button 
                        onClick={() => toggleSelectionBasedProcessing(false)}
                        className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e] flex items-center justify-center group"
                    >
                        <X className="w-2 h-2 text-black opacity-0 group-hover:opacity-100" />
                    </button>
                    <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]"></div>
                </div>
                <span className="text-[11px] font-bold tracking-tight text-studio-text">Selection-Based Processing</span>
                <div className="w-9"></div> {/* Spacer for balance */}
            </div>

            {/* Content Container */}
            <div className="p-4 space-y-5">
                {/* Channel Strip Setting */}
                <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-studio-text-mid px-1">Channel Strip Setting:</label>
                    <button className="w-full h-7 bg-studio-sunken border border-studio-line-strong rounded px-2.5 flex items-center justify-between text-[11px] font-bold hover:bg-studio-panel transition-colors shadow-inner">
                        <span className="truncate opacity-60">None</span>
                        <ChevronDown className="w-3 h-3 text-studio-text-dim" />
                    </button>
                </div>

                {/* Plug-ins Set Selector */}
                <div className="space-y-2">
                    <div className="flex gap-px bg-studio-sunken border border-studio-line-strong rounded p-0.5 shadow-inner">
                        <button 
                            onClick={() => updateSBPState({ activeSet: 'A' })}
                            className={`flex-1 h-6 text-[11px] font-black rounded transition-all ${activeSet === 'A' ? 'bg-accent-cyan text-white shadow-lg' : 'text-studio-text-mid hover:text-white hover:bg-white/5'}`}
                        >
                            A
                        </button>
                        <button 
                            onClick={() => updateSBPState({ activeSet: 'B' })}
                            className={`flex-1 h-6 text-[11px] font-black rounded transition-all ${activeSet === 'B' ? 'bg-accent-cyan text-white shadow-lg' : 'text-studio-text-mid hover:text-white hover:bg-white/5'}`}
                        >
                            B
                        </button>
                    </div>

                    {/* Plug-ins List */}
                    <div className="grid grid-cols-2 gap-3 min-h-[120px]">
                        <PluginList 
                            side="A" 
                            plugins={setA} 
                            active={activeSet === 'A'} 
                            onAdd={() => addPluginToSBP('A', 'eq')}
                            onRemove={(id) => removePluginFromSBP('A', id)}
                        />
                        <PluginList 
                            side="B" 
                            plugins={setB} 
                            active={activeSet === 'B'} 
                            onAdd={() => addPluginToSBP('B', 'eq')}
                            onRemove={(id) => removePluginFromSBP('B', id)}
                        />
                    </div>
                </div>

                {/* Options */}
                <div className="space-y-2 pt-1 border-t border-studio-line">
                    <div className="flex items-center gap-2.5 group cursor-pointer" onClick={() => updateSBPState({ splitAtMarqueeBorders: !splitAtMarqueeBorders })}>
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${splitAtMarqueeBorders ? 'bg-accent-cyan border-accent-cyan' : 'border-studio-line-strong bg-black/20 group-hover:border-studio-line-strong'}`}>
                            {splitAtMarqueeBorders && <Check className="w-2.5 h-2.5 text-white stroke-[4]" />}
                        </div>
                        <span className="text-[11px] font-medium text-studio-text">Split at Marquee Borders</span>
                    </div>

                    <div className="flex items-center gap-2.5 group cursor-pointer" onClick={() => updateSBPState({ createNewTake: !createNewTake })}>
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${createNewTake ? 'bg-accent-cyan border-accent-cyan' : 'border-studio-line-strong bg-black/20 group-hover:border-studio-line-strong'}`}>
                            {createNewTake && <Check className="w-2.5 h-2.5 text-white stroke-[4]" />}
                        </div>
                        <span className="text-[11px] font-medium text-studio-text">Create New Take</span>
                    </div>

                    <div className="flex items-center gap-2.5 group cursor-pointer" onClick={() => updateSBPState({ addEffectTail: !addEffectTail })}>
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${addEffectTail ? 'bg-accent-cyan border-accent-cyan' : 'border-studio-line-strong bg-black/20 group-hover:border-studio-line-strong'}`}>
                            {addEffectTail && <Check className="w-2.5 h-2.5 text-white stroke-[4]" />}
                        </div>
                        <span className="text-[11px] font-medium text-studio-text">Add Effect Tail</span>
                    </div>
                </div>

                {/* Gain Compensation */}
                <div className="flex items-center justify-between gap-4 pt-1 border-t border-studio-line">
                    <label className="text-[11px] font-medium text-studio-text-mid">Gain:</label>
                    <button className="flex-1 h-6 bg-studio-sunken border border-studio-line-strong rounded px-2 flex items-center justify-between text-[11px] font-bold hover:bg-studio-panel transition-colors shadow-inner">
                        <span>{gainMode}</span>
                        <ChevronDown className="w-2.5 h-2.5 text-studio-text-dim" />
                    </button>
                </div>

                {/* Preview Section */}
                <div className="pt-4 border-t border-studio-line space-y-4">
                    <div className="text-[11px] font-black uppercase tracking-wider text-studio-text-dim mb-2">Preview:</div>
                    
                    <div className="flex items-center gap-3">
                        <button className="w-8 h-8 rounded bg-studio-sunken border border-studio-line-strong flex items-center justify-center text-studio-text hover:text-white hover:bg-white/5 transition-all">
                            <Speaker className="w-4 h-4" />
                        </button>
                        <div className="flex-1 relative h-6 bg-studio-sunken rounded overflow-hidden shadow-inner border border-studio-line">
                            {/* Peak Meter Representation */}
                            <div className="absolute inset-y-[2px] left-[2px] right-[20px] bg-gradient-to-r from-green-500 via-yellow-400 to-red-500 rounded-sm opacity-80 shadow-[0_0_10px_rgba(34,197,94,0.3)]"></div>
                            <div className="absolute top-1 bottom-1 right-[16px] w-[1px] bg-yellow-500/50"></div>
                        </div>
                    </div>

                    {/* Preview Slider */}
                    <div className="flex flex-col gap-1">
                        <div className="relative h-6 flex items-center cursor-pointer group">
                            <div className="absolute w-full h-px bg-studio-control"></div>
                            <div className="absolute left-1/2 -translate-x-1/2 w-px h-2 bg-studio-control"></div>
                            <div className="absolute left-0 right-0 h-4 flex items-center">
                                <div 
                                    className="w-1.5 h-4 bg-studio-control border border-studio-line rounded-sm group-hover:bg-studio-control transition-colors"
                                    style={{ marginLeft: `${previewVolume * 100}%` }}
                                ></div>
                            </div>
                        </div>
                        <div className="flex justify-between px-1">
                            <span className="text-[9px] font-bold text-studio-text-dim tabular-nums">0:05</span>
                            <span className="text-[9px] font-bold text-studio-text-dim tabular-nums">-0:02</span>
                        </div>
                    </div>
                </div>

                {/* Region Info & Footer */}
                <div className="flex flex-col gap-4">
                    <div className="text-[10px] font-bold text-studio-text-dim italic px-1">
                        {marqueeSelection ? 'Marquee area selected' : selectedClipId ? '1 Region selected' : 'No selection'}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <button className="w-8 h-8 rounded bg-studio-sunken border border-studio-line-strong flex items-center justify-center text-studio-text-dim hover:text-white hover:bg-white/5 transition-all group">
                            <MoreHorizontal className="w-4 h-4" />
                        </button>
                        
                        <div className="flex gap-2 flex-1">
                            <button 
                                className="flex-1 h-8 rounded bg-studio-control border border-studio-line-strong text-[12px] font-bold text-studio-text-mid hover:text-white transition-all shadow-md active:scale-95 disabled:opacity-30"
                                disabled={!selectedClipId && !marqueeSelection}
                            >
                                Undo
                            </button>
                            <button 
                                onClick={applySelectionBasedProcessing}
                                className="flex-1 h-8 rounded bg-accent-cyan text-white text-[12px] font-extrabold shadow-lg hover:bg-cyan-300 transition-all active:scale-95 disabled:opacity-30 border border-cyan-300"
                                disabled={!selectedClipId && !marqueeSelection}
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function PluginList({ side, plugins, active, onAdd, onRemove }: { side: string, plugins: any[], active: boolean, onAdd: () => void, onRemove: (id: string) => void }) {
    return (
        <div className={`flex flex-col gap-1.5 min-h-[100px] p-2 rounded border transition-all ${active ? 'bg-studio-raised border-accent-cyan/30' : 'bg-studio-panel border-transparent opacity-60'}`}>
            {plugins.map((plugin) => (
                <div 
                    key={plugin.id} 
                    className={`h-6 px-2 flex items-center justify-between rounded text-[10px] font-bold border transition-all ${active ? 'bg-accent-cyan text-white border-cyan-300 shadow-sm' : 'bg-studio-control text-studio-text border-studio-line-strong'}`}
                >
                    <span className="truncate">{plugin.name}</span>
                    {active && (
                        <button onClick={() => onRemove(plugin.id)} className="p-0.5 hover:bg-white/20 rounded">
                            <Trash2 className="w-3 h-3" />
                        </button>
                    )}
                </div>
            ))}
            {active && plugins.length < 5 && (
                <button 
                    onClick={onAdd}
                    className="h-6 flex items-center justify-center gap-1 text-[9px] font-black uppercase text-studio-text-dim hover:text-accent-cyan hover:bg-white/5 rounded border border-dashed border-studio-line-strong transition-all"
                >
                    <Plus className="w-3 h-3" />
                    Insert
                </button>
            )}
        </div>
    )
}
