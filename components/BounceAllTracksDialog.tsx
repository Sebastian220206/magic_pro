"use client"

import { useState } from "react"
import { useProjectStore } from "@/store/projectStore"
import { X, RotateCcw, ChevronDown, Check, Info } from "lucide-react"

export function BounceAllTracksDialog() {
    const { showBounceAllTracksDialog, toggleBounceAllTracksDialog, bounceReplaceAllTracks } = useProjectStore()

    const [settings, setSettings] = useState({
        bypassEffects: false,
        includeAutomation: true,
        normalize: "Overload Protection Only" as "Off" | "Overload Protection Only" | "On"
    })

    if (!showBounceAllTracksDialog) return null

    const handleOk = () => {
        bounceReplaceAllTracks(settings)
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[203] flex items-center justify-center p-4">
            <div className="bg-[#2c2c2e] w-full max-w-sm rounded-xl shadow-2xl border border-white/10 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 flex flex-col items-center justify-center border-b border-white/5 bg-white/5">
                    <h2 className="text-sm font-black text-white tracking-widest uppercase">Bounce Replace All Tracks</h2>
                </div>

                {/* Body */}
                <div className="p-8 flex flex-col gap-6">
                    <div className="flex flex-col gap-4 ml-8">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div 
                                onClick={() => setSettings({ ...settings, bypassEffects: !settings.bypassEffects })}
                                className={`w-4 h-4 rounded border border-white/20 flex items-center justify-center transition-all ${settings.bypassEffects ? 'bg-sky-500 border-sky-400' : 'bg-black/40 group-hover:border-white/40'}`}
                            >
                                {settings.bypassEffects && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-xs text-gray-300 group-hover:text-white transition-colors font-medium">Bypass Effect Plug-ins</span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div 
                                onClick={() => setSettings({ ...settings, includeAutomation: !settings.includeAutomation })}
                                className={`w-4 h-4 rounded border border-white/20 flex items-center justify-center transition-all ${settings.includeAutomation ? 'bg-sky-500 border-sky-400' : 'bg-black/40 group-hover:border-white/40'}`}
                            >
                                {settings.includeAutomation && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-xs text-gray-300 group-hover:text-white transition-colors font-medium">Include Volume/Pan Automation</span>
                        </label>
                    </div>

                    {/* Normalize */}
                    <div className="flex items-center gap-4 mt-2">
                        <label className="text-[11px] font-bold text-gray-400 w-20 text-right">Normalize:</label>
                        <div className="flex-1 relative group">
                            <div className="bg-white/5 border border-white/10 rounded px-2.5 py-2 text-xs text-white flex items-center justify-between cursor-pointer hover:bg-white/10 transition-all">
                                <span>{settings.normalize}</span>
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                            </div>
                        </div>
                    </div>

                    {/* Disclaimer */}
                    <div className="flex items-start gap-4 px-4 py-3 bg-sky-500/5 rounded-lg border border-sky-500/10">
                        <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-gray-400 leading-relaxed font-medium">
                            You may want to <span className="text-sky-400">'Save As...'</span> the project after 'Bounce Replace All Tracks' has been finished.
                        </p>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="px-6 py-5 bg-white/5 border-t border-white/5 flex gap-2">
                    <button 
                        className="flex-1 px-4 py-2 border border-white/10 rounded-lg text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-white hover:bg-white/5 transition-all"
                    >
                        Restore Defaults
                    </button>
                    <button 
                        onClick={() => toggleBounceAllTracksDialog(false)}
                        className="px-6 py-2 rounded-lg text-xs font-bold text-gray-400 hover:bg-white/10 transition-all border border-transparent"
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
    )
}
