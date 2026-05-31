"use client"
import { useProjectStore } from "@/store/projectStore"
import {
    Clock, Tag, Activity,
    Type, ChevronDown, Plus,
    Maximize2, MoreHorizontal,
    Flag, Music, Zap
} from "lucide-react"

export function GlobalTracks() {
    const {
        showGlobalTracks, globalTracks, zoom,
        addMarker, updateTempoPoint,
        beatMappingMode,
        selectedClipId, selectedNoteId, clips,
        addBeatMappingEntry, applyBeatMappingToTempo, clearBeatMapping,
        snap
    } = useProjectStore()

    if (!showGlobalTracks) return null

    const pixelsPerBeat = zoom || 80;

    const getSnapValue = (val: number) => {
        let divisor = 1;
        switch (snap) {
            case 'bar': divisor = 4; break;
            case 'half': divisor = 2; break;
            case 'quarter': divisor = 1; break;
            case 'eighth': divisor = 0.5; break;
            case 'sixteenth': divisor = 0.25; break;
        }
        return Math.round(val / divisor) * divisor;
    };

    const resolveSourceTime = () => {
        if (!selectedClipId) return 0;
        const clip = clips.find(c => c.id === selectedClipId);
        if (!clip) return 0;
        if (selectedNoteId && clip.notes) {
            const note = clip.notes.find(n => n.id === selectedNoteId);
            if (note) return (clip.startBeat ?? clip.start) + note.start;
        }
        return clip.startBeat ?? clip.start;
    };

    const handleBeatMappingClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const targetTime = getSnapValue((e.clientX - rect.left) / pixelsPerBeat);
        const sourceTime = resolveSourceTime();
        const clipId = selectedClipId || '';
        const noteId = selectedNoteId || undefined;
        if (!clipId) return;

        addBeatMappingEntry(clipId, sourceTime, targetTime, noteId);
        applyBeatMappingToTempo();
    };

    return (
        <div className="flex flex-col border-b border-black bg-[#1a1a1a] select-none z-40 shrink-0 shadow-lg">
            {/* 1. Marker Track (High Fidelity Logic Style) */}
            <div className="h-8 flex border-b border-black/40 group relative overflow-hidden">
                <div className="w-[280px] bg-[#222] border-r border-black flex items-center px-4 justify-between shrink-0 sticky left-0 z-10 shadow-xl">
                    <div className="flex items-center gap-2">
                        <Flag className="w-3.5 h-3.5 text-yellow-500/60" />
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Markers</span>
                    </div>
                    <button
                        onClick={() => addMarker(0, "New Section")}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/5 rounded transition-all"
                    >
                        <Plus className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                </div>

                <div className="flex-1 relative bg-black/20 min-w-0 overflow-hidden h-full">
                    {globalTracks.markers.map(m => (
                        <div
                            key={m.id}
                            className="absolute top-1 bottom-1 rounded border border-yellow-500/40 bg-yellow-500/20 px-3 flex items-center shadow-lg group/marker cursor-move hover:brightness-125 transition-all"
                            style={{
                                left: `${m.time * pixelsPerBeat}px`,
                                width: `${m.duration * pixelsPerBeat}px`
                            }}
                        >
                            <span className="text-[10px] font-black text-yellow-500 truncate uppercase tracking-tighter">{m.text}</span>
                            <div className="absolute right-1 w-1.5 h-1.5 rounded-full bg-yellow-500/40 opacity-0 group-hover/marker:opacity-100"></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 2. Tempo Track (Logic High Density Curve) */}
            <div className="h-12 flex border-b border-black/40 group relative">
                <div className="w-[280px] bg-[#222] border-r border-black flex items-center px-4 justify-between shrink-0 sticky left-0 z-10 shadow-xl">
                    <div className="flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-sky-400/60" />
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Tempo</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <span className="text-[10px] font-black text-sky-500 tabular-nums">{globalTracks.tempo[0].value}</span>
                        <ChevronDown className="w-3 h-3 text-gray-700" />
                    </div>
                </div>

                <div className="flex-1 relative bg-black/10 min-w-0 overflow-hidden h-full">
                    {/* SVG Curve Layer */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                        <path
                            d={`M 0 24 ${globalTracks.tempo.map(p => `L ${p.time * pixelsPerBeat} 24`).join(' ')} L 10000 24`}
                            fill="none"
                            stroke="#0ea5e9"
                            strokeWidth="1.5"
                            className="opacity-40"
                        />
                    </svg>

                    {/* Draggable Points */}
                    {globalTracks.tempo.map((p, idx) => (
                        <div
                            key={idx}
                            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-sky-500 rounded border border-white/20 shadow-lg cursor-ns-resize hover:scale-125 transition-transform"
                            style={{ left: `${p.time * pixelsPerBeat}px` }}
                        >
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#333] border border-white/10 rounded px-1.5 py-0.5 opacity-0 hover:opacity-100 transition-opacity z-50">
                                <span className="text-[9px] font-black text-sky-400 tabular-nums">{p.value}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {beatMappingMode && (
                <>
                    {/* 3. Beat Mapping Track (Logic-style) */}
                    <div className="h-12 flex border-b border-black/40 group relative">
                        <div className="w-[280px] bg-[#222] border-r border-black flex items-center px-4 justify-between shrink-0 sticky left-0 z-10 shadow-xl">
                    <div className="flex items-center gap-2">
                        <Music className="w-3.5 h-3.5 text-cyan-400/70" />
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Beat Mapping</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => applyBeatMappingToTempo()} className="px-2 py-1 rounded text-[10px] text-white bg-sky-500/70 hover:bg-sky-500">Apply</button>
                        <button onClick={() => clearBeatMapping()} className="px-2 py-1 rounded text-[10px] text-gray-300 bg-[#333] hover:bg-[#444]">Clear</button>
                    </div>
                </div>

                <div
                    className="flex-1 relative bg-black/10 min-w-0 overflow-hidden h-full cursor-copy"
                    onMouseDown={handleBeatMappingClick}
                >
                    {globalTracks.beatMapping?.map((mapping) => (
                        <div key={mapping.id} className="absolute top-0 bottom-0 w-px bg-cyan-500/90" style={{ left: `${mapping.targetTime * pixelsPerBeat}px` }}>
                            <div className="absolute top-0 -right-5 text-[9px] text-cyan-300">{Math.round(mapping.sourceTime * 100) / 100}</div>
                        </div>
                    ))}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                        {globalTracks.beatMapping?.map((mapping, idx) => {
                            const source = mapping.sourceTime * pixelsPerBeat;
                            const target = mapping.targetTime * pixelsPerBeat;
                            return <line key={mapping.id} x1={source} y1={0} x2={target} y2={48} stroke="#38bdf8" strokeWidth={1} strokeDasharray="3 3" />
                        })}
                    </svg>
                </div>
            </div>
            </>
            )}

            {/* 4. Signature & Key Tracks (Condensed Logic Bar) */}
            <div className="h-7 flex border-b border-black/60 group relative">
                <div className="w-[280px] bg-[#1a1a1a] border-r border-black flex items-center px-4 justify-between shrink-0 sticky left-0 z-10">
                    <div className="flex gap-4">
                        <div className="flex items-center gap-1.5">
                            <Music className="w-3 h-3 text-gray-600" />
                            <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Sig</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Zap className="w-3 h-3 text-gray-600" />
                            <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Key</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex pointer-events-none px-4">
                    <div className="flex items-center gap-1.5 h-full">
                        <span className="text-[10px] font-black text-gray-500">4/4</span>
                        <div className="w-px h-3 bg-gray-800"></div>
                        <span className="text-[10px] font-black text-gray-500">C Major</span>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .custom-scrollbar-v::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar-v::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar-v::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
            `}</style>
        </div>
    )
}
