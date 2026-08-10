"use client"
import { useState, useEffect } from "react"
import { useProjectStore } from "@/store/projectStore"
import {
    X, ChevronDown, Plus,
    MoreHorizontal, Edit3,
    FileText, Save, Clock,
    Hash, Type, AlignLeft
} from "lucide-react"

export function NotePad() {
    const { showNotePad, toggleNotePad, focusedTrackId, tracks } = useProjectStore()
    const track = tracks.find(t => t.id === focusedTrackId);

    const [activeTab, setActiveTab] = useState<'project' | 'track'>('project')
    const [projectNotes, setProjectNotes] = useState("Project: Sunset Groove\n- Key: C Minor\n- Reference Track: Tame Impala - Let It Happen\n- Mixing: Check the low-end phase interaction at the breakdown")
    const [trackNotes, setTrackNotes] = useState<Record<string, string>>({})

    const handleNoteChange = (val: string) => {
        if (activeTab === 'project') {
            setProjectNotes(val);
        } else if (focusedTrackId) {
            setTrackNotes(s => ({ ...s, [focusedTrackId]: val }));
        }
    }

    const currentNotes = activeTab === 'project' ? projectNotes : (focusedTrackId ? trackNotes[focusedTrackId] || "" : "Select a track to add notes...");

    if (!showNotePad) return null

    return (
        <div className="w-[340px] h-full bg-studio-panel border-l border-black flex flex-col shrink-0 z-50 overflow-hidden shadow-[-20px_0_50px_rgba(0,0,0,0.6)] select-none text-studio-text-mid">
            {/* 1. Logic Signature Header Area */}
            <div className="pt-2 px-3 flex flex-col gap-2 shrink-0 border-b border-black pb-3 bg-studio-panel">
                <div className="flex items-center justify-between h-8">
                    <div className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors group">
                        <span className="text-[12px] font-black text-white/90 group-hover:text-white uppercase tracking-tighter">Note Pad</span>
                        <ChevronDown className="w-3.5 h-3.5 text-studio-text-dim" />
                    </div>
                    <button onClick={toggleNotePad} className="p-1 hover:bg-white/5 rounded-full transition-colors">
                        <X className="w-4 h-4 text-studio-text-dim hover:text-white" />
                    </button>
                </div>

                {/* Switcher: Project / Track Level Notes */}
                <div className="flex bg-studio-sunken rounded-lg border border-studio-line p-0.5 h-8 shadow-inner">
                    <button
                        onClick={() => setActiveTab('project')}
                        className={`flex-1 text-[10px] font-black uppercase transition-all rounded transition-all ${activeTab === 'project' ? 'text-accent-cyan bg-studio-control shadow-md border border-studio-line-strong' : 'text-studio-text-dim hover:text-studio-text-mid'}`}
                    >Project</button>
                    <button
                        onClick={() => setActiveTab('track')}
                        className={`flex-1 text-[10px] font-black uppercase transition-all rounded transition-all ${activeTab === 'track' ? 'text-accent-cyan bg-studio-control shadow-md border border-studio-line-strong' : 'text-studio-text-dim hover:text-studio-text-mid'}`}
                    >Track</button>
                </div>

                {activeTab === 'track' && track && (
                    <div className="flex items-center gap-2 px-1 py-1 bg-studio-sunken border border-white/5 rounded-md mt-1 shadow-inner group-hover:border-studio-line-strong transition-colors">
                        <Edit3 className="w-3.5 h-3.5 text-accent-cyan/60" />
                        <span className="text-[10px] font-black text-studio-text-mid uppercase truncate">{track.name}</span>
                    </div>
                )}
            </div>

            {/* 2. Text Editor Canvas with Pro Formatting */}
            <div className="flex-1 flex flex-col min-h-0 relative bg-studio-void group">
                {/* Visual Line Markers (Logic Style) */}
                <div className="absolute inset-0 pointer-events-none opacity-5 flex flex-col px-6 py-6 gap-[1.2rem]">
                    {[...Array(20)].map((_, i) => <div key={i} className="h-px w-full bg-white"></div>)}
                </div>

                <textarea
                    className="flex-1 w-full h-full bg-transparent p-6 text-[13px] font-medium text-studio-text placeholder-studio-text-dim resize-none focus:outline-none focus:text-white transition-colors custom-scrollbar-v relative z-10"
                    placeholder={activeTab === 'project' ? "Enter technical or creative project notes here..." : "Enter specific track settings, mixing notes, or performance cues..."}
                    value={currentNotes}
                    onChange={(e) => handleNoteChange(e.target.value)}
                    spellCheck={false}
                ></textarea>

                {/* Focus Overlay */}
                <div className="absolute inset-0 border-[2px] border-transparent group-focus-within:border-accent-cyan/5 pointer-events-none transition-all"></div>
            </div>

            {/* 3. Logic Signature Tool Footer */}
            <div className="h-[48px] bg-studio-panel border-t border-black flex items-center px-3 justify-between shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
                <div className="flex items-center gap-1.5">
                    <button className="flex items-center gap-2 px-3 h-7 bg-studio-raised border border-white/5 rounded-md hover:border-accent-cyan/20 transition-all group">
                        <Clock className="w-3.5 h-3.5 text-studio-text-dim group-hover:text-accent-cyan" />
                        <span className="text-[10px] font-black text-studio-text-dim group-hover:text-studio-text uppercase leading-none">Marker</span>
                    </button>
                    <button className="w-8 h-7 flex items-center justify-center text-studio-text-dim hover:text-white hover:bg-white/5 rounded transition-all"><AlignLeft className="w-4 h-4" /></button>
                </div>

                <div className="flex items-center gap-2">
                    <div className="w-px h-5 bg-studio-control mx-1"></div>
                    <button className="flex items-center gap-2 px-4 h-7 bg-accent-cyan border border-accent-cyan rounded-md shadow-[0_0_15px_rgba(14,165,233,0.3)] text-white hover:brightness-110 active:scale-95 transition-all">
                        <Save className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">SavE</span>
                    </button>
                    <button className="p-1 px-1.5 hover:bg-white/5 rounded transition-all"><MoreHorizontal className="w-5 h-5 text-studio-text-dim" /></button>
                </div>
            </div>

            <style jsx>{`
                textarea { line-height: 1.2rem; }
            `}</style>

        </div>
    )
}
