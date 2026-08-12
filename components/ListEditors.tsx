"use client"
import { useProjectStore } from "@/store/projectStore"
import { useMidiStore } from "@/store/midiStore"
import { pitchToNoteName } from "@/engine/midi/types"
import {
    X, ChevronDown, List,
    Calendar, Music, Filter,
    MoreHorizontal, ChevronRight,
    DivideCircle, LayoutList
} from "lucide-react"
import { useMemo, useState } from "react"

export function ListEditors() {
    const { showListEditors, toggleListEditors, timeSignature } = useProjectStore()
    const notes = useMidiStore(s => s.getCurrentClip()?.notes ?? null)
    const [activeTab, setActiveTab] = useState<'event' | 'marker' | 'tempo' | 'sig'>('event')

    const beatsPerBar = Number(timeSignature?.split('/')[0]) || 4

    /**
     * The real events on the selected clip.
     *
     * This list previously rendered five hard-coded notes — C3, E3, G3, C4, F3
     * — for every project. It looked like a working event list and reported
     * the same five events whatever you had written, which is worse than
     * showing nothing.
     */
    const events = useMemo(() => {
        if (!notes) return []
        return [...notes]
            .sort((a, b) => a.startBeat - b.startBeat || b.pitch - a.pitch)
            .map(n => {
                const bar = Math.floor(n.startBeat / beatsPerBar) + 1
                const beatInBar = n.startBeat - (bar - 1) * beatsPerBar
                const beat = Math.floor(beatInBar) + 1
                // Ticks are the classic 960 PPQN, so positions read the way
                // they do in the transport.
                const tick = Math.round((beatInBar % 1) * 960)
                const lenBars = Math.floor(n.duration / beatsPerBar)
                const lenBeats = Math.floor(n.duration % beatsPerBar)
                const lenTicks = Math.round((n.duration % 1) * 960)
                return {
                    id: n.id,
                    bar,
                    beat,
                    tick,
                    ch: (n.channel ?? 0) + 1,
                    num: pitchToNoteName(n.pitch),
                    val: n.velocity,
                    length: `${lenBars}.${lenBeats}.${lenTicks}`,
                }
            })
    }, [notes, beatsPerBar])

    if (!showListEditors) return null

    return (
        <div className="w-[340px] h-full bg-studio-panel border-l border-black flex flex-col shrink-0 z-50 overflow-hidden shadow-2xl select-none text-studio-text-mid">
            {/* 1. Header Area with Sub-Tab Selector */}
            <div className="pt-2 px-3 flex flex-col gap-2 shrink-0 border-b border-black pb-3 bg-studio-panel">
                <div className="flex items-center justify-between h-8">
                    <div className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                        <span className="text-[12px] font-black text-white/90">List Editors</span>
                        <ChevronDown className="w-3.5 h-3.5 text-studio-text-dim" />
                    </div>
                    <button onClick={toggleListEditors} className="p-1 hover:bg-white/5 rounded-full transition-colors">
                        <X className="w-4 h-4 text-studio-text-dim" />
                    </button>
                </div>

                {/* Sub-Tabs: Event / Marker / Tempo / Signature */}
                <div className="flex bg-studio-sunken rounded-lg border border-studio-line p-0.5 h-10">
                    {['Event', 'Marker', 'Tempo', 'Sig'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab.toLowerCase() as any)}
                            className={`flex-1 text-[9px] font-black uppercase transition-all rounded transition-all px-1 tracking-tight ${activeTab === tab.toLowerCase() ? 'text-accent-cyan bg-studio-control shadow-md border border-studio-line-strong' : 'text-studio-text-dim hover:text-studio-text'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* 2. Numerical Event List */}
            <div className="flex-1 flex flex-col min-h-0 bg-studio-sunken">
                <div className="h-6 flex items-center bg-studio-raised border-b border-black text-[8px] font-black text-studio-text-dim uppercase px-3 gap-0.5 shrink-0">
                    <div className="w-12">Position</div>
                    <div className="w-10">Status</div>
                    <div className="w-8 text-center">Ch</div>
                    <div className="flex-1">Number/Value</div>
                    <div className="w-12 text-right pr-2">Length</div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {events.length === 0 && (
                        <div className="p-4 text-[11px] text-studio-text-dim text-center">
                            {notes ? 'This region has no events.' : 'Select a MIDI region to list its events.'}
                        </div>
                    )}
                    {events.map((ev, idx) => (
                        <div
                            key={ev.id}
                            className={`h-[24px] flex items-center px-3 border-b border-black/10 group cursor-pointer hover:bg-white/5 transition-colors ${idx % 2 === 0 ? 'bg-white/[0.01]' : ''}`}
                        >
                            <div className="w-12 text-[10px] font-black text-studio-text-mid group-hover:text-accent-cyan tabular-nums">
                                {ev.bar}.{ev.beat}.{ev.tick}
                            </div>
                            <div className="w-10 text-[9px] font-bold text-studio-text-dim uppercase">Note</div>
                            <div className="w-8 text-[10px] font-black text-studio-text-dim text-center">{ev.ch}</div>
                            <div className="flex-1 flex items-center gap-2">
                                <span className="text-[11px] font-black text-studio-text group-hover:text-white">{ev.num}</span>
                                <div className="h-1 flex-1 bg-black/40 rounded-full overflow-hidden">
                                    <div className="h-full bg-accent-cyan/30" style={{ width: `${(ev.val / 127) * 100}%` }}></div>
                                </div>
                                <span className="text-[10px] font-black text-accent-cyan/60 tabular-nums">{ev.val}</span>
                            </div>
                            <div className="w-12 text-[10px] font-black text-studio-text-dim text-right pr-2 tabular-nums">{ev.length}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 3. Footer Filter Area */}
            <div className="h-[44px] bg-studio-panel border-t border-black px-4 flex items-center justify-between shrink-0 shadow-inner">
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-1.5 px-2 h-6 bg-studio-sunken border border-studio-line rounded text-[9px] font-black uppercase text-studio-text-dim hover:text-white">
                        <Filter className="w-2.5 h-2.5" /> Filter
                    </button>
                    <div className="flex gap-0.5">
                        {[...Array(4)].map((_, i) => <div key={i} className={`w-3 h-3 rounded-full border border-white/5 bg-accent-cyan/${(i + 1) * 20}`}></div>)}
                    </div>
                </div>
                <button className="p-2 text-studio-text-dim hover:text-white transition-all"><MoreHorizontal className="w-4 h-4" /></button>
            </div>


        </div>
    )
}

function ChevronDownSmall({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 100 100" className={className} fill="currentColor">
            <polygon points="20,40 80,40 50,70" />
        </svg>
    )
}
