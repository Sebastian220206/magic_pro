"use client"

import React, { useEffect, useState } from "react"
import { useProjectStore } from "@/store/projectStore"
import { X, Eraser, AlertCircle } from "lucide-react"

export function SpotEraseDialog() {
    const { 
        showSpotEraseDialog, 
        toggleSpotErase, 
        spotEraseSettings, 
        updateSpotEraseSettings 
    } = useProjectStore()

    const [isFlashing, setIsFlashing] = useState(true)

    useEffect(() => {
        const interval = setInterval(() => {
            setIsFlashing(prev => !prev)
        }, 500)
        return () => clearInterval(interval)
    }, [])

    if (!showSpotEraseDialog) return null

    return (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[600] animate-in slide-in-from-top-4 duration-300">
            <div className={`bg-[#1c1c1e]/90 backdrop-blur-2xl border ${spotEraseSettings.enabled ? 'border-red-500/50' : 'border-white/10'} rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] px-6 py-4 flex items-center gap-6 min-w-[320px] transition-all duration-500`}>
                
                {/* Flashing Indicator */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${spotEraseSettings.enabled && isFlashing ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'bg-white/5 text-gray-500'}`}>
                    <Eraser className={`w-6 h-6 ${spotEraseSettings.enabled ? 'animate-pulse' : ''}`} />
                </div>

                <div className="flex flex-col gap-0.5">
                    <h3 className="text-[13px] font-black uppercase tracking-widest text-white">Spot Erase</h3>
                    <p className="text-[10px] font-medium text-gray-400 max-w-[180px]">
                        Hold keys on your keyboard to delete notes during playback or recording.
                    </p>
                </div>

                <div className="flex items-center gap-3 border-l border-white/5 pl-6 ml-auto">
                    <button 
                        onClick={() => updateSpotEraseSettings({ enabled: !spotEraseSettings.enabled })}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${spotEraseSettings.enabled ? 'bg-red-500 text-white shadow-lg' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                    >
                        {spotEraseSettings.enabled ? 'Active' : 'Enable'}
                    </button>
                    
                    <button 
                        onClick={() => toggleSpotErase(false)}
                        className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-gray-500 hover:text-white"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Status Bar */}
                {spotEraseSettings.enabled && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-48 h-1 bg-red-500 rounded-full animate-pulse blur-[2px]"></div>
                )}
            </div>
        </div>
    )
}
