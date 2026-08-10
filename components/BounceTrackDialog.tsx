"use client"

import { useState } from "react"
import { useProjectStore } from "@/store/projectStore"
import { X, RotateCcw, ChevronDown, Check } from "lucide-react"

export function BounceTrackDialog() {
    const { showBounceTrackDialog, toggleBounceTrackDialog, bounceTrackInPlace, tracks } = useProjectStore()
    const track = tracks.find(t => t.id === showBounceTrackDialog)

    const [settings, setSettings] = useState({
        name: track ? `${track.name}_bip` : "",
        destination: "New Track" as "New Track" | "Replace Track",
        bypassEffects: false,
        includeAutomation: true,
        normalize: "Overload Protection Only" as "Off" | "Overload Protection Only" | "On"
    })

    if (!showBounceTrackDialog || !track) return null

    const handleOk = () => {
        bounceTrackInPlace(track.id, settings)
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[203] flex items-center justify-center p-4">
            <div className="bg-studio-control w-full max-w-md rounded-xl shadow-2xl border border-white/10 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-white/5">
                    <h2 className="text-sm font-bold text-white tracking-tight">Bounce Track In Place</h2>
                    <button onClick={() => toggleBounceTrackDialog(null)} className="p-1 hover:bg-white/5 rounded-full transition-colors text-studio-text-dim hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col gap-6">
                    {/* Name */}
                    <div className="flex items-center gap-4">
                        <label className="text-[11px] font-bold text-studio-text-mid w-24 text-right">Name:</label>
                        <input 
                            type="text" 
                            className="flex-1 bg-white/5 border border-white/10 rounded px-2.5 py-1 text-xs text-white focus:ring-1 focus:ring-accent-cyan focus:outline-none transition-all hover:bg-white/10"
                            value={settings.name}
                            onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                        />
                    </div>

                    {/* Destination */}
                    <div className="flex items-start gap-4">
                        <label className="text-[11px] font-bold text-studio-text-mid w-24 text-right pt-0.5">Destination:</label>
                        <div className="flex flex-col gap-2">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div 
                                    onClick={() => setSettings({ ...settings, destination: 'New Track' })}
                                    className={`w-4 h-4 rounded-full border border-white/20 flex items-center justify-center transition-all ${settings.destination === 'New Track' ? 'bg-accent-cyan border-accent-cyan ring-4 ring-accent-cyan/10' : 'bg-black/40 group-hover:border-white/40'}`}
                                >
                                    {settings.destination === 'New Track' && <div className="w-1.5 h-1.5 bg-white rounded-full shadow-sm" />}
                                </div>
                                <span className="text-xs text-studio-text group-hover:text-white transition-colors font-medium">New Track</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div 
                                    onClick={() => setSettings({ ...settings, destination: 'Replace Track' })}
                                    className={`w-4 h-4 rounded-full border border-white/20 flex items-center justify-center transition-all ${settings.destination === 'Replace Track' ? 'bg-accent-cyan border-accent-cyan ring-4 ring-accent-cyan/10' : 'bg-black/40 group-hover:border-white/40'}`}
                                >
                                    {settings.destination === 'Replace Track' && <div className="w-1.5 h-1.5 bg-white rounded-full shadow-sm" />}
                                </div>
                                <span className="text-xs text-studio-text group-hover:text-white transition-colors font-medium">Replace Track</span>
                            </label>
                        </div>
                    </div>

                    {/* Options */}
                    <div className="flex flex-col gap-3 ml-28">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div 
                                onClick={() => setSettings({ ...settings, bypassEffects: !settings.bypassEffects })}
                                className={`w-3.5 h-3.5 rounded border border-white/20 flex items-center justify-center transition-all ${settings.bypassEffects ? 'bg-accent-cyan border-accent-cyan' : 'bg-black/40 group-hover:border-white/40'}`}
                            >
                                {settings.bypassEffects && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <span className="text-xs text-studio-text group-hover:text-white transition-colors">Bypass Effect Plug-ins</span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div 
                                onClick={() => setSettings({ ...settings, includeAutomation: !settings.includeAutomation })}
                                className={`w-3.5 h-3.5 rounded border border-white/20 flex items-center justify-center transition-all ${settings.includeAutomation ? 'bg-accent-cyan border-accent-cyan' : 'bg-black/40 group-hover:border-white/40'}`}
                            >
                                {settings.includeAutomation && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <span className="text-xs text-studio-text group-hover:text-white transition-colors">Include Volume/Pan Automation</span>
                        </label>
                    </div>

                    {/* Normalize */}
                    <div className="flex items-center gap-4">
                        <label className="text-[11px] font-bold text-studio-text-mid w-24 text-right">Normalize:</label>
                        <div className="flex-1 relative group">
                            <div className="bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white flex items-center justify-between cursor-pointer hover:bg-white/10 transition-all">
                                <span>{settings.normalize}</span>
                                <ChevronDown className="w-3.5 h-3.5 text-studio-text-dim" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="px-6 py-5 bg-white/5 border-t border-white/5 flex items-center justify-between">
                    <button className="flex items-center gap-2 text-[11px] font-black text-studio-text-dim uppercase tracking-widest hover:text-white transition-colors">
                        <RotateCcw className="w-3.5 h-3.5" /> Restore Defaults
                    </button>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => toggleBounceTrackDialog(null)}
                            className="px-6 py-2 rounded-lg text-xs font-bold text-studio-text-mid hover:bg-white/5 transition-all"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleOk}
                            className="px-8 py-2 bg-accent-cyan hover:bg-accent-cyan text-white rounded-lg text-xs font-bold shadow-lg shadow-accent-cyan/20 active:scale-95 transition-all"
                        >
                            OK
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
