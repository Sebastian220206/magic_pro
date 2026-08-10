"use client"

import { useProjectStore } from "@/store/projectStore"
import { X, Check } from "lucide-react"

export function TrackHeaderConfigDialog() {
    const {
        showTrackHeaderConfig,
        toggleTrackHeaderConfig,
        trackHeaderConfig,
        updateTrackHeaderConfig
    } = useProjectStore()

    if (!showTrackHeaderConfig) return null

    const sections = [
        {
            title: "Buttons",
            items: [
                { id: 'showOnOff', label: 'On/Off' },
                { id: 'showMute', label: 'Mute' },
                { id: 'showSolo', label: 'Solo' },
                { id: 'showRecord', label: 'Record Enable' },
                { id: 'showInput', label: 'Input Monitoring' },
                { id: 'showProtect', label: 'Protect' },
                { id: 'showFreeze', label: 'Freeze' }
            ]
        },
        {
            title: "Controls",
            items: [
                { id: 'showVolume', label: 'Volume' },
                { id: 'showPan', label: 'Pan' }
            ]
        },
        {
            title: "Other View Options",
            items: [
                { id: 'showTrackNumbers', label: 'Track Numbers' },
                { id: 'showColorBars', label: 'Color Bars' },
                { id: 'showTrackIcons', label: 'Track Icons' },
                { id: 'showAlternatives', label: 'Track Alternatives' }
            ]
        }
    ]

    return (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
            onClick={() => toggleTrackHeaderConfig(false)}>
            <div
                className="bg-studio-control border border-white/10 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden w-[380px] animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="h-10 px-4 flex items-center justify-between border-b border-black/40 bg-studio-control">
                    <span className="text-[11px] font-black text-studio-text uppercase tracking-widest">Track Header Configuration</span>
                    <button onClick={() => toggleTrackHeaderConfig(false)} className="p-1 hover:bg-white/10 rounded-full transition-all text-studio-text-mid hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 flex flex-col gap-6">
                    {sections.map((section) => (
                        <div key={section.title} className="flex flex-col gap-2.5">
                            <h3 className="text-[10px] font-black text-studio-text-dim uppercase tracking-widest border-b border-white/5 pb-1 mb-1">
                                {section.title}
                            </h3>
                            <div className="grid grid-cols-1 gap-1.5">
                                {section.items.map((item) => (
                                    <button
                                        key={item.id}
                                        className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-white/5 transition-all group"
                                        onClick={() => updateTrackHeaderConfig({ [item.id]: !trackHeaderConfig[item.id as keyof typeof trackHeaderConfig] })}
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${trackHeaderConfig[item.id as keyof typeof trackHeaderConfig] ? 'bg-accent-cyan border-accent-cyan' : 'bg-black/40 border-white/10'}`}>
                                            {trackHeaderConfig[item.id as keyof typeof trackHeaderConfig] && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <span className={`text-[12px] font-medium transition-colors ${trackHeaderConfig[item.id as keyof typeof trackHeaderConfig] ? 'text-studio-text' : 'text-studio-text-mid group-hover:text-studio-text'}`}>
                                            {item.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-studio-panel px-5 py-3 border-t border-black/40 flex justify-end">
                    <button
                        onClick={() => toggleTrackHeaderConfig(false)}
                        className="bg-accent-cyan hover:bg-accent-cyan text-white text-[11px] font-black uppercase tracking-widest px-8 py-1.5 rounded-full transition-all active:scale-95 shadow-lg shadow-accent-cyan/10"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    )
}
