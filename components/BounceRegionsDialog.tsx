"use client"

import { useState } from "react"
import { useProjectStore } from "@/store/projectStore"
import { X, RotateCcw, ChevronDown, Check } from "lucide-react"

export function BounceRegionsDialog() {
    const { showBounceRegionsDialog, toggleBounceRegionsDialog, bounceRegionsInPlace, clips } = useProjectStore()
    const firstClip = showBounceRegionsDialog && clips.find(c => c.id === showBounceRegionsDialog[0])

    const [settings, setSettings] = useState({
        name: firstClip ? `${firstClip.name}_bip` : "",
        destination: "New Track" as "New Track" | "Selected Track",
        destinationFile: "One File" as "One File" | "One File per Track" | "One File per Region",
        source: "Mute" as "Leave" | "Mute" | "Delete",
        includeTailInFile: true,
        includeTailInRegion: false,
        includeAutomation: true,
        normalize: "Overload Protection Only" as "Off" | "Overload Protection Only" | "On"
    })

    if (!showBounceRegionsDialog || !firstClip) return null

    const handleOk = () => {
        bounceRegionsInPlace(showBounceRegionsDialog, settings)
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[203] flex items-center justify-center p-4">
            <div className="bg-[#2c2c2e] w-full max-w-md rounded-xl shadow-2xl border border-white/10 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-white/5">
                    <h2 className="text-sm font-bold text-white tracking-tight">Bounce Regions In Place</h2>
                    <button onClick={() => toggleBounceRegionsDialog(null)} className="p-1 hover:bg-white/5 rounded-full transition-colors text-gray-500 hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[70vh] custom-scrollbar">
                    {/* Name */}
                    <div className="flex items-center gap-4">
                        <label className="text-[11px] font-bold text-gray-400 w-24 text-right">Name:</label>
                        <input 
                            type="text" 
                            className="flex-1 bg-white/5 border border-white/10 rounded px-2.5 py-1 text-xs text-white focus:ring-1 focus:ring-sky-500 focus:outline-none transition-all"
                            value={settings.name}
                            onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                        />
                    </div>

                    {/* Destination */}
                    <div className="flex items-start gap-4">
                        <label className="text-[11px] font-bold text-gray-400 w-24 text-right pt-0.5">Destination:</label>
                        <div className="flex flex-col gap-2 flex-1">
                            <div className="flex flex-col gap-2">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div 
                                        onClick={() => setSettings({ ...settings, destination: 'New Track' })}
                                        className={`w-3.5 h-3.5 rounded-full border border-white/20 flex items-center justify-center transition-all ${settings.destination === 'New Track' ? 'bg-sky-500 border-sky-400 ring-4 ring-sky-500/10' : 'bg-black/40'}`}
                                    >
                                        {settings.destination === 'New Track' && <div className="w-1.5 h-1.5 bg-white rounded-full shadow-sm" />}
                                    </div>
                                    <span className="text-xs text-gray-300 group-hover:text-white transition-colors">New Track</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div 
                                        onClick={() => setSettings({ ...settings, destination: 'Selected Track' })}
                                        className={`w-3.5 h-3.5 rounded-full border border-white/20 flex items-center justify-center transition-all ${settings.destination === 'Selected Track' ? 'bg-sky-500 border-sky-400 ring-4 ring-sky-500/10' : 'bg-black/40'}`}
                                    >
                                        {settings.destination === 'Selected Track' && <div className="w-1.5 h-1.5 bg-white rounded-full shadow-sm" />}
                                    </div>
                                    <span className="text-xs text-gray-300 group-hover:text-white transition-colors">Selected Track</span>
                                </label>
                            </div>
                            
                            <div className="relative group mt-1">
                                <div className="bg-white/5 border border-white/10 rounded px-2.5 py-1 text-xs text-white flex items-center justify-between cursor-pointer hover:bg-white/10">
                                    <span>{settings.destinationFile}</span>
                                    <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Source Action */}
                    <div className="flex items-start gap-4 border-t border-white/5 pt-4">
                        <label className="text-[11px] font-bold text-gray-400 w-24 text-right pt-0.5">Source:</label>
                        <div className="flex flex-col gap-2">
                            {['Leave', 'Mute', 'Delete'].map((opt) => (
                                <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                                    <div 
                                        onClick={() => setSettings({ ...settings, source: opt as any })}
                                        className={`w-3.5 h-3.5 rounded-full border border-white/20 flex items-center justify-center transition-all ${settings.source === opt ? 'bg-sky-500 border-sky-400' : 'bg-black/40'}`}
                                    >
                                        {settings.source === opt && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                    </div>
                                    <span className="text-xs text-gray-300 group-hover:text-white transition-colors">{opt}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Options */}
                    <div className="flex flex-col gap-3 ml-28 border-t border-white/5 pt-4">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div 
                                onClick={() => setSettings({ ...settings, includeTailInFile: !settings.includeTailInFile })}
                                className={`w-3.5 h-3.5 rounded border border-white/20 flex items-center justify-center transition-all ${settings.includeTailInFile ? 'bg-sky-500 border-sky-400' : 'bg-black/40'}`}
                            >
                                {settings.includeTailInFile && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <span className="text-xs text-gray-300 group-hover:text-white transition-colors">Include Audio Tail in File</span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group opacity-50 pl-6">
                            <div 
                                onClick={() => setSettings({ ...settings, includeTailInRegion: !settings.includeTailInRegion })}
                                className={`w-3.5 h-3.5 rounded border border-white/20 flex items-center justify-center transition-all ${settings.includeTailInRegion ? 'bg-sky-500 border-sky-400' : 'bg-black/40'}`}
                            >
                                {settings.includeTailInRegion && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <span className="text-xs text-gray-400">Include Audio Tail in Region</span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div 
                                onClick={() => setSettings({ ...settings, includeAutomation: !settings.includeAutomation })}
                                className={`w-3.5 h-3.5 rounded border border-white/20 flex items-center justify-center transition-all ${settings.includeAutomation ? 'bg-sky-500 border-sky-400' : 'bg-black/40'}`}
                            >
                                {settings.includeAutomation && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <span className="text-xs text-gray-300 group-hover:text-white transition-colors">Include Volume/Pan Automation</span>
                        </label>
                    </div>

                    {/* Normalize */}
                    <div className="flex items-center gap-4 border-t border-white/5 pt-4">
                        <label className="text-[11px] font-bold text-gray-400 w-24 text-right">Normalize:</label>
                        <div className="flex-1 relative group">
                            <div className="bg-white/5 border border-white/10 rounded px-2.5 py-1 text-xs text-white flex items-center justify-between cursor-pointer hover:bg-white/10">
                                <span>{settings.normalize}</span>
                                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="px-6 py-5 bg-white/5 border-t border-white/5 flex items-center justify-between">
                    <button className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-white transition-colors">
                        <RotateCcw className="w-3.5 h-3.5" /> Restore Defaults
                    </button>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => toggleBounceRegionsDialog(null)}
                            className="px-6 py-2 rounded-lg text-xs font-bold text-gray-400 hover:bg-white/5 transition-all"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleOk}
                            className="px-8 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-lg text-xs font-bold shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
                        >
                            OK
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
