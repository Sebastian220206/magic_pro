"use client"

import { useState } from "react"
import { useProjectStore } from "@/store/projectStore"
import { 
    X, Plus, Minus, RotateCcw, 
    Settings, Music, Activity, 
    ChevronDown, Info 
} from "lucide-react"

export function ArticulationSetEditor() {
    const { 
        editingArticulationSetId, articulationSets, 
        updateArticulationSet, toggleArticulationEditor 
    } = useProjectStore()
    
    const [activeTab, setActiveTab] = useState<'Articulations' | 'Switches' | 'Output'>('Articulations')
    
    const articulationSet = articulationSets.find(s => s.id === editingArticulationSetId)
    
    if (!articulationSet) return null

    const handleUpdate = (updates: any) => {
        updateArticulationSet(articulationSet.id, updates)
    }

    const addArticulation = () => {
        const nextId = Math.max(0, ...articulationSet.articulations.map(a => a.id)) + 1
        handleUpdate({
            articulations: [...articulationSet.articulations, { id: nextId, name: 'New Articulation', channel: '-', symbol: '-' }]
        })
    }

    const removeArticulation = (id: number) => {
        handleUpdate({
            articulations: articulationSet.articulations.filter(a => a.id !== id)
        })
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-8">
            <div className="bg-[#1e1e1e] w-full max-w-4xl h-[600px] rounded-xl shadow-2xl border border-white/10 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-sky-500/20 rounded-lg">
                            <Settings className="w-5 h-5 text-sky-400" />
                        </div>
                        <div>
                            <input 
                                className="bg-transparent text-lg font-bold text-white border-none focus:ring-0 p-0 hover:bg-white/5 transition-colors rounded px-2"
                                value={articulationSet.name}
                                onChange={(e) => handleUpdate({ name: e.target.value })}
                            />
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Articulation Set Editor</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => toggleArticulationEditor(false)}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex justify-center gap-2 p-4 bg-black/20">
                    {(['Switches', 'Articulations', 'Output'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${
                                activeTab === tab 
                                ? 'bg-white text-black shadow-lg shadow-white/5' 
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Main Content Pane */}
                <div className="flex-1 overflow-hidden p-6 relative">
                    <div className="bg-black/40 border border-white/5 rounded-xl h-full flex flex-col overflow-hidden">
                        {activeTab === 'Articulations' && (
                            <div className="flex-1 flex flex-col">
                                <div className="grid grid-cols-[1fr_120px_100px_150px] gap-4 px-6 py-3 bg-white/5 border-b border-white/5 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                    <div>Name</div>
                                    <div>Articulation ID</div>
                                    <div>Channel</div>
                                    <div>Symbol</div>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    {articulationSet.articulations.map((art, idx) => (
                                        <div key={idx} className="grid grid-cols-[1fr_120px_100px_150px] gap-4 px-6 py-2 border-b border-white/5 items-center hover:bg-white/5 group">
                                            <input 
                                                className="bg-transparent text-sm text-gray-200 border-none focus:ring-0 p-0"
                                                value={art.name}
                                                onChange={(e) => {
                                                    const newArts = [...articulationSet.articulations]
                                                    newArts[idx] = { ...art, name: e.target.value }
                                                    handleUpdate({ articulations: newArts })
                                                }}
                                            />
                                            <input 
                                                type="number"
                                                className="bg-transparent text-sm text-gray-200 border-none focus:ring-0 p-0 text-center"
                                                value={art.id}
                                                onChange={(e) => {
                                                    const newArts = [...articulationSet.articulations]
                                                    newArts[idx] = { ...art, id: parseInt(e.target.value) || 0 }
                                                    handleUpdate({ articulations: newArts })
                                                }}
                                            />
                                            <div className="flex items-center justify-between text-sm text-gray-400 bg-white/5 px-2 py-1 rounded cursor-pointer hover:bg-white/10">
                                                <span>{art.channel}</span>
                                                <ChevronDown className="w-3 h-3" />
                                            </div>
                                            <div className="flex items-center justify-between text-sm text-gray-400 bg-white/5 px-2 py-1 rounded cursor-pointer hover:bg-white/10">
                                                <span>{art.symbol}</span>
                                                <ChevronDown className="w-3 h-3" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-4 bg-white/5 flex items-center justify-between">
                                    <div className="flex gap-2">
                                        <button onClick={addArticulation} className="p-1.5 bg-white/5 hover:bg-white/10 rounded border border-white/10"><Plus className="w-4 h-4 text-gray-400" /></button>
                                        <button onClick={() => removeArticulation(articulationSet.articulations[articulationSet.articulations.length-1]?.id)} className="p-1.5 bg-white/5 hover:bg-white/10 rounded border border-white/10"><Minus className="w-4 h-4 text-gray-400" /></button>
                                    </div>
                                    <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-bold text-gray-400 border border-white/10 transition-all">
                                        <RotateCcw className="w-3.5 h-3.5" /> Undo
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'Switches' && (
                            <div className="flex-1 flex flex-col">
                                <div className="p-6 flex items-center gap-12 bg-white/5 border-b border-white/5">
                                    <button className="px-6 py-2 bg-white/10 rounded-lg text-xs font-bold text-white border border-white/10 shadow-lg shadow-sky-500/20">MIDI Remote</button>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase">MIDI Channel:</span>
                                        <div className="flex items-center gap-2 bg-white/5 px-4 py-1.5 rounded-lg border border-white/10 text-xs text-white cursor-pointer">
                                            {articulationSet.midiChannel} <ChevronDown className="w-3.5 h-3.5" />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase">Octave Offset:</span>
                                        <div className="flex items-center gap-2 bg-white/5 px-4 py-1.5 rounded-lg border border-white/10 text-xs text-white cursor-pointer hover:bg-white/10">
                                            {articulationSet.octaveOffset} <ChevronDown className="w-3.5 h-3.5 text-sky-400" />
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-[120px_100px_90px_90px_160px_1fr] gap-4 px-6 py-3 bg-white/5 border-b border-white/5 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                    <div>Type</div>
                                    <div>Selector</div>
                                    <div>V-Start</div>
                                    <div>V-End</div>
                                    <div>Mode</div>
                                    <div>Articulation</div>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    {articulationSet.switches.map((sw, idx) => (
                                        <div key={idx} className="grid grid-cols-[120px_100px_90px_90px_160px_1fr] gap-4 px-6 py-2 border-b border-white/5 items-center hover:bg-white/5">
                                            <div className="text-xs text-gray-300 flex items-center justify-between bg-white/5 px-2 py-1 rounded">
                                                {sw.type} <ChevronDown className="w-3 h-3 text-gray-500" />
                                            </div>
                                            <div className="text-xs text-gray-300 flex items-center justify-between bg-white/5 px-2 py-1 rounded">
                                                {sw.selector} <ChevronDown className="w-3 h-3 text-gray-500" />
                                            </div>
                                            <div className="text-xs text-center text-gray-500">{sw.valueStart}</div>
                                            <div className="text-xs text-center text-gray-500">{sw.valueEnd}</div>
                                            <div className="text-xs text-gray-300 flex items-center justify-between bg-white/5 px-2 py-1 rounded">
                                                {sw.mode} <ChevronDown className="w-3 h-3 text-gray-500" />
                                            </div>
                                            <div className="text-xs text-gray-300 flex items-center justify-between bg-white/5 px-2 py-1 rounded text-sky-400 font-bold">
                                                {articulationSet.articulations.find(a => a.id === sw.articulationId)?.name || 'None'} <ChevronDown className="w-3 h-3 text-gray-500" />
                                            </div>
                                        </div>
                                    ))}
                                    <div className="p-6 flex flex-col items-center justify-center gap-4 text-gray-600 opacity-50">
                                        <Plus className="w-12 h-12 stroke-[1px]" />
                                        <p className="text-sm font-medium">Click + to add keyswitches</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'Output' && (
                            <div className="flex-1 flex flex-col">
                                <div className="grid grid-cols-[1fr_150px_120px_120px_120px] gap-4 px-6 py-3 bg-white/5 border-b border-white/5 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                    <div>Name</div>
                                    <div>Type</div>
                                    <div>Channel</div>
                                    <div>Selector</div>
                                    <div>Value</div>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    {articulationSet.articulations.map((art, idx) => {
                                        const output = articulationSet.outputs.find(o => o.articulationId === art.id)
                                        return (
                                            <div key={idx} className="grid grid-cols-[1fr_150px_120px_120px_120px] gap-4 px-6 py-2 border-b border-white/5 items-center hover:bg-white/5">
                                                <div className="text-sm font-bold text-gray-400 ml-4">{art.name}</div>
                                                <div className="text-xs text-gray-500 flex items-center justify-between bg-white/5 px-2 py-1 rounded">
                                                    {output?.type || '-'} <ChevronDown className="w-3 h-3" />
                                                </div>
                                                <div className="text-xs text-gray-500 flex items-center justify-between bg-white/5 px-2 py-1 rounded">
                                                    {output?.channel || '-'} <ChevronDown className="w-3 h-3" />
                                                </div>
                                                <div className="text-xs text-gray-500 flex items-center justify-between bg-white/5 px-2 py-1 rounded">
                                                    {output?.selector || '-'} <ChevronDown className="w-3 h-3" />
                                                </div>
                                                <div className="text-xs text-center text-gray-500">-</div>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="p-6 border-t border-white/5 bg-white/5">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="w-4 h-4 rounded border border-white/20 flex items-center justify-center transition-colors group-hover:border-sky-500">
                                            <div className="w-2 h-2 bg-sky-500 rounded-sm scale-0 transition-transform" />
                                        </div>
                                        <span className="text-xs font-bold text-gray-400 group-hover:text-white transition-colors">Activate Multiple Outputs</span>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Pro Tip */}
                    <div className="absolute top-2 right-12 flex items-center gap-2 bg-sky-500/10 border border-sky-500/20 px-3 py-1 rounded-full text-[9px] font-black text-sky-400 uppercase tracking-widest shadow-lg shadow-sky-500/5">
                        <Info className="w-3 h-3" /> Articulation ID: {articulationSet.articulations.length} active
                    </div>
                </div>
            </div>
        </div>
    )
}
