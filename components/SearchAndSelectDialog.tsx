"use client"

import { useState, useEffect, useRef } from "react"
import { useProjectStore } from "@/store/projectStore"
import { Search, X, Hash, Layout } from "lucide-react"
import { neonTrackColor } from "@/lib/trackColor"

export function SearchAndSelectDialog() {
    const {
        showSearchAndSelect,
        toggleSearchAndSelect,
        tracks,
        selectTrack
    } = useProjectStore()

    const [query, setQuery] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (showSearchAndSelect) {
            setQuery("")
            setTimeout(() => inputRef.current?.focus(), 50)
        }
    }, [showSearchAndSelect])

    if (!showSearchAndSelect) return null

    const filtered = tracks.filter((t, idx) =>
        t.name.toLowerCase().includes(query.toLowerCase()) ||
        (idx + 1).toString() === query
    )

    const handleSelect = (id: string) => {
        selectTrack(id)
        toggleSearchAndSelect(false)
    }

    return (
        <div className="fixed inset-0 z-[1000] flex items-start justify-center pt-24 bg-black/60 backdrop-blur-[4px] animate-in fade-in duration-200">
            <div
                className="w-[480px] bg-studio-control border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                onKeyDown={(e) => {
                    if (e.key === 'Escape') toggleSearchAndSelect(false)
                    if (e.key === 'Enter' && filtered.length > 0) handleSelect(filtered[0].id)
                }}
            >
                {/* Search Header */}
                <div className="flex items-center px-4 h-12 border-b border-black/40 gap-3">
                    <Search className="w-4 h-4 text-studio-text-mid" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search for and select a track by name or number..."
                        className="flex-1 bg-transparent text-studio-text text-[13px] font-medium outline-none placeholder:text-studio-text-dim"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <button
                        onClick={() => toggleSearchAndSelect(false)}
                        className="p-1 hover:bg-white/5 rounded-full transition-all"
                    >
                        <X className="w-4 h-4 text-studio-text-dim" />
                    </button>
                </div>

                {/* Results List */}
                <div className="max-h-[320px] overflow-y-auto py-1 custom-scrollbar-v">
                    {filtered.length > 0 ? (
                        filtered.map((track, idx) => {
                            const trackNum = tracks.indexOf(track) + 1
                            return (
                                <button
                                    key={track.id}
                                    onClick={() => handleSelect(track.id)}
                                    className="w-full flex items-center px-4 h-11 gap-4 hover:bg-accent-cyan group transition-all text-left"
                                >
                                    <div className="w-6 text-[11px] font-black text-studio-text-dim group-hover:text-white/80 tabular-nums text-right">
                                        {trackNum}
                                    </div>
                                    <div
                                        className="w-8 h-8 rounded-[4px] flex items-center justify-center shadow-lg"
                                        style={{ backgroundColor: neonTrackColor(track.color) }}
                                    >
                                        <Hash className="w-4 h-4 text-black/40" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[13px] font-bold text-studio-text group-hover:text-white truncate">
                                            {track.name}
                                        </div>
                                        <div className="text-[10px] font-black text-studio-text-dim group-hover:text-white/60 uppercase tracking-widest">
                                            {track.type}
                                        </div>
                                    </div>
                                    {track.isStack && <Layout className="w-3 h-3 text-studio-text-dim group-hover:text-white/60 mr-2" />}
                                </button>
                            )
                        })
                    ) : (
                        <div className="py-12 flex flex-col items-center justify-center gap-2 opacity-40">
                            <Search className="w-8 h-8" />
                            <span className="text-[11px] font-black uppercase tracking-widest">No matching tracks found</span>
                        </div>
                    )}
                </div>

                {/* Footer Tip */}
                <div className="h-9 px-4 flex items-center bg-studio-panel text-[10px] font-bold text-studio-text-dim uppercase tracking-widest border-t border-black/40">
                    <span className="flex-1">Enter to Confirm • ESC to Cancel</span>
                </div>
            </div>
        </div>
    )
}
