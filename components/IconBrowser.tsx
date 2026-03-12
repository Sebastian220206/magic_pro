"use client"

import { useProjectStore } from "@/store/projectStore"
import {
    X, Music, Mic, Drum, Keyboard, Guitar,
    Speaker, Activity, Radio, Volume2,
    Headphones, Zap, Search, Hash
} from "lucide-react"

export function IconBrowser() {
    const {
        showIconBrowser,
        toggleIconBrowser,
        updateTrack
    } = useProjectStore()

    if (!showIconBrowser) return null

    const iconCategories = [
        { id: 'drums', label: 'Drums', icons: ['drum', 'activity', 'radio'] },
        { id: 'percussion', label: 'Percussion', icons: ['volume2', 'zap'] },
        { id: 'bass', label: 'Bass', icons: ['speaker', 'hash'] },
        { id: 'guitar', label: 'Guitar', icons: ['guitar', 'headphones'] },
        { id: 'keyboards', label: 'Keyboards', icons: ['keyboard', 'music'] },
        { id: 'mic', label: 'Vocals', icons: ['mic'] },
    ]

    const handleAssignIcon = (icon: string) => {
        if (showIconBrowser) {
            updateTrack(showIconBrowser, { icon: icon as any })
            toggleIconBrowser(null)
        }
    }

    const IconRenderer = ({ name, className }: { name: string, className?: string }) => {
        switch (name) {
            case 'drum': return <Drum className={className} />
            case 'activity': return <Activity className={className} />
            case 'radio': return <Radio className={className} />
            case 'volume2': return <Volume2 className={className} />
            case 'zap': return <Zap className={className} />
            case 'speaker': return <Speaker className={className} />
            case 'hash': return <Hash className={className} />
            case 'guitar': return <Guitar className={className} />
            case 'headphones': return <Headphones className={className} />
            case 'keyboard': return <Keyboard className={className} />
            case 'music': return <Music className={className} />
            case 'mic': return <Mic className={className} />
            default: return <Music className={className} />
        }
    }

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-[4px] animate-in fade-in duration-200">
            <div
                className="bg-[#2c2c2e] border border-white/10 rounded-2xl shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden w-[620px] h-[480px] flex flex-col animate-in zoom-in-95 duration-200"
                onKeyDown={(e) => { if (e.key === 'Escape') toggleIconBrowser(null) }}
            >
                {/* Header Row */}
                <div className="h-14 px-6 flex items-center justify-between border-b border-black/40 bg-[#3a3a3c] shrink-0">
                    <div className="flex items-center gap-4">
                        <span className="text-[14px] font-black text-white uppercase tracking-widest">Icon Browser</span>
                        <div className="h-4 w-px bg-white/10"></div>
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search icons..."
                                className="bg-black/20 border border-black/40 rounded-full h-8 px-9 text-[12px] font-medium outline-none focus:border-sky-500/50 transition-all w-48 placeholder:text-gray-500"
                            />
                        </div>
                    </div>
                    <button onClick={() => toggleIconBrowser(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-gray-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-1 min-h-0">
                    {/* Category List */}
                    <div className="w-[160px] border-r border-black/40 bg-[#252527] py-2 overflow-y-auto overflow-x-hidden custom-scrollbar-v shrink-0">
                        {iconCategories.map((cat) => (
                            <button
                                key={cat.id}
                                className="w-full px-6 py-2.5 text-left text-[11px] font-black text-gray-500 uppercase tracking-widest hover:bg-white/5 hover:text-gray-300 transition-all"
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    {/* Icon Grid */}
                    <div className="flex-1 bg-black/20 p-6 overflow-y-auto custom-scrollbar-v">
                        <div className="grid grid-cols-4 gap-6">
                            {iconCategories.flatMap(cat => cat.icons).map((iconName, i) => (
                                <button
                                    key={i}
                                    className="aspect-square rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-sky-500/20 hover:border-sky-500/50 transition-all flex items-center justify-center group active:scale-95"
                                    onClick={() => handleAssignIcon(iconName)}
                                >
                                    <IconRenderer name={iconName} className="w-10 h-10 text-gray-400 group-hover:text-white drop-shadow-2xl transition-all group-hover:scale-110" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="h-12 px-6 flex items-center justify-end bg-[#1c1c1e] border-t border-black/40 shrink-0">
                    <button
                        onClick={() => toggleIconBrowser(null)}
                        className="bg-sky-500 hover:bg-sky-400 text-white text-[12px] font-black uppercase tracking-widest px-8 h-8 rounded-full transition-all active:scale-95"
                    >
                        Close
                    </button>
                </div>
            </div>
            <style jsx>{`
                .custom-scrollbar-v::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar-v::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar-v::-webkit-scrollbar-thumb { background: #444; border-radius: 10px; }
            `}</style>
        </div>
    )
}
