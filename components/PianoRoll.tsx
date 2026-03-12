"use client"
import { useProjectStore } from "@/store/projectStore"
import { useState, useRef, useEffect } from "react"
import {
    ChevronDown, ChevronRight, Search,
    MousePointer2, Pencil, Eraser,
    Scissors, Target, Settings,
    Maximize2, MoreHorizontal,
    Music, Volume2, Power
} from "lucide-react"

export function PianoRoll() {
    const {
        selectedClipId, selectedClipIds, pianoRollLinkMode, pianoRollFocusClipId,
        clips, addNote, updateNote, deleteNote, zoom,
        selectClip, updateClip, tracks, articulationSets, toggleArticulationEditor, setArticulationForNotes,
        setPianoRollLinkMode, setPianoRollFocusClipId
    } = useProjectStore()

    const selectedClip = clips.find(c => c.id === selectedClipId)
    const midiClips = clips.filter(c => c.type === 'midi')

    let displayClips = [] as typeof clips
    if (pianoRollLinkMode === 'single') {
        const focusClip = pianoRollFocusClipId ? clips.find(c => c.id === pianoRollFocusClipId) : selectedClip
        displayClips = focusClip && focusClip.type === 'midi' ? [focusClip] : []
    } else if (pianoRollLinkMode === 'selected') {
        displayClips = selectedClipIds
            .map(id => clips.find(c => c.id === id))
            .filter((c): c is typeof clips[number] => !!c && c.type === 'midi')
    } else if (pianoRollLinkMode === 'folder') {
        const trackId = (pianoRollFocusClipId ? clips.find(c => c.id === pianoRollFocusClipId) : selectedClip)?.trackId
        displayClips = trackId ? midiClips.filter(c => c.trackId === trackId) : []
    } else if (pianoRollLinkMode === 'project') {
        displayClips = midiClips
    }

    const notesWithSource = displayClips.flatMap(clip => (clip.notes || []).map(note => ({ ...note, clipId: clip.id })))
    const displayedRegionCount = displayClips.length
    const displayedNoteCount = notesWithSource.length

    const activeClip = displayClips[0] || selectedClip
    const displayClip = activeClip && activeClip.type === 'midi' ? activeClip : null

    const [dragNoteId, setDragNoteId] = useState<string | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    if (!displayClip) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0a0a] border-t border-black text-gray-800">
                <Music className="w-12 h-12 mb-4 opacity-10" />
                <div className="text-[10px] font-black uppercase tracking-[0.3em] px-8 py-3 border border-white/5 rounded-full bg-black/40 shadow-inner">
                    Select a MIDI Region to Edit
                </div>
            </div>
        )
    }

    const pitchRange = 64;
    const startPitch = 84; // C5
    const keyHeight = 24;
    const pixelsPerBeat = zoom || 80;

    const handleGridMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0 || e.target !== e.currentTarget) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const start = x / pixelsPerBeat;
        const pitch = startPitch - Math.floor(y / keyHeight);

        const targetClip = displayClip || selectedClip;
        if (!targetClip) return;

        addNote(targetClip.id, {
            id: Date.now().toString(),
            pitch,
            start,
            duration: 1,
            velocity: 100
        });
    }

    const handleNoteMouseDown = (e: React.MouseEvent, clipId: string, noteId: string) => {
        e.stopPropagation();
        if (e.button === 2) {
            deleteNote(clipId, noteId);
            return;
        }
        setDragNoteId(noteId);

        const startX = e.clientX;
        const startY = e.clientY;
        const sourceClip = clips.find(c => c.id === clipId)
        const note = sourceClip?.notes?.find(n => n.id === noteId)
        if (!note || !sourceClip) return;

        const originalStart = note.start;
        const originalPitch = note.pitch;

        const onMouseMove = (me: MouseEvent) => {
            const dx = (me.clientX - startX) / pixelsPerBeat;
            const dy = Math.floor((startY - me.clientY) / keyHeight);

            updateNote(selectedClip.id, noteId, {
                start: Math.max(0, originalStart + dx),
                pitch: Math.max(0, originalPitch + dy)
            });
        };

        const onMouseUp = () => {
            setDragNoteId(null);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }

    return (
        <div className="flex flex-col h-full bg-[#111] overflow-hidden select-none relative z-30 shadow-[0_-15px_40px_rgba(0,0,0,0.4)]">
            {/* 1. Piano Roll Local Toolbar */}
            <div className="h-9 bg-[#1a1a1a] border-b border-black flex items-center px-4 justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 bg-[#000] border border-[#333] rounded px-2.5 h-7 cursor-pointer hover:border-gray-500 transition-colors group">
                        <span className="text-[10px] font-black text-gray-400 group-hover:text-white uppercase tracking-tighter">Edit</span>
                        <ChevronDown className="w-3 h-3 text-gray-600" />
                    </div>

                    <div className="flex items-center gap-0.5 bg-[#000] rounded border border-[#333] p-0.5 h-7">
                        <button className="w-7 h-full flex items-center justify-center bg-[#333] text-sky-400 rounded-sm shadow-md border border-[#444]"><MousePointer2 className="w-3.5 h-3.5" /></button>
                        <button className="w-7 h-full flex items-center justify-center text-gray-500 hover:text-white"><Pencil className="w-3.5 h-3.5" /></button>
                        <button className="w-7 h-full flex items-center justify-center text-gray-500 hover:text-white"><Eraser className="w-3.5 h-3.5" /></button>
                    </div>

                    <div className="h-7 px-3 flex items-center gap-2 bg-[#000] border border-[#333] rounded-md mx-2 group cursor-pointer hover:border-gray-500">
                        <Target className="w-3.5 h-3.5 text-sky-400" />
                        <span className="text-[11px] font-black text-gray-400 uppercase tracking-tighter">Snap: Smart</span>
                        <ChevronDown className="w-2.5 h-2.5 text-gray-600" />
                    </div>

                    <div className="h-7 px-2 flex items-center gap-1 bg-[#000] border border-[#333] rounded-md mx-2">
                        {(['single', 'selected', 'folder', 'project'] as const).map(mode => (
                            <button
                                key={mode}
                                onClick={() => setPianoRollLinkMode(mode)}
                                className={`text-[9px] uppercase px-2 rounded ${pianoRollLinkMode === mode ? 'bg-sky-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                {mode[0].toUpperCase() + mode.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest leading-none">Automation</span>
                        <div className="w-8 h-4 bg-[#0a0a0a] border border-[#333] rounded-full relative shadow-inner cursor-pointer hover:border-gray-500 transition-colors">
                            <div className="absolute left-1 top-0.5 w-2.5 h-2.5 bg-gray-600 rounded-full shadow-sm"></div>
                        </div>
                    </div>
                    <button className="p-1.5 hover:bg-white/5 rounded transition-all"><Maximize2 className="w-4 h-4 text-gray-600 hover:text-white" /></button>
                </div>
            </div>

            {/* 2. Main Editing Workspace */}
            <div className="h-7 bg-[#090909] border-b border-black text-gray-300 text-xs flex items-center px-3 justify-between">
                <div>
                    <span className="font-black uppercase tracking-wide">Piano Roll</span>
                    <span className="ml-2 text-gray-400">Mode: {pianoRollLinkMode}</span>
                    <span className="ml-2 text-gray-400">Regions: {displayedRegionCount}</span>
                    <span className="ml-2 text-gray-400">Notes: {displayedNoteCount}</span>
                </div>
                <div>
                    <span className="text-gray-400">Click note to focus clip, double-click note to zoom</span>
                </div>
            </div>
            <div className="flex-1 flex overflow-hidden">
                {/* Local Inspector Sidebar (Mac Style) */}
                <div className="w-[180px] border-r border-black bg-[#1a1a1a] flex flex-col shrink-0 p-3 gap-6 overflow-y-auto custom-scrollbar-v shadow-inner shadow-2xl">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between group cursor-pointer">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] leading-none group-hover:text-gray-300">Region</span>
                            <ChevronDown className="w-3 h-3 text-gray-700" />
                        </div>
                        <div className="h-7 bg-[#000] border border-[#333] rounded flex items-center px-2.5 text-[11px] font-black text-white/90 shadow-inner group-hover:border-gray-500 truncate">
                            {displayClip?.name || 'No Clip'}
                        </div>
                    </div>

                    {/* Quantize Column */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between group cursor-pointer">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] leading-none group-hover:text-gray-300">Time Quantize</span>
                            <Settings className="w-3.5 h-3.5 text-gray-700" />
                        </div>
                        <div className="flex gap-1">
                            <div className="flex-1 h-7 bg-[#252525] border border-white/5 rounded shadow-sm flex items-center px-2 justify-between cursor-pointer hover:border-white/10 group">
                                <span className="text-[10px] font-black text-gray-300 uppercase truncate pr-1">1/16 Note</span>
                                <ChevronDown className="w-2.5 h-2.5 text-gray-600 group-hover:text-gray-400" />
                            </div>
                            <button className="w-8 h-7 flex items-center justify-center bg-[#0a0a0a] border border-[#333] rounded text-sky-400 font-black shadow-inner active:bg-sky-500/10 transition-colors">Q</button>
                        </div>
                    </div>

                    {/* Velocity Slider Area */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between group cursor-pointer">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] leading-none group-hover:text-gray-300">Velocity</span>
                            <Volume2 className="w-3.5 h-3.5 text-gray-700" />
                        </div>
                        <div className="h-1 bg-black rounded-full relative overflow-hidden shadow-inner p-[1px]">
                            <div className="h-full bg-gradient-to-r from-sky-600 to-sky-400 w-3/4 shadow-[0_0_12px_rgba(14,165,233,0.5)]"></div>
                        </div>
                        <div className="flex justify-between text-[9px] font-black text-gray-700 uppercase tracking-widest tabular-nums font-mono">
                            <span>0</span>
                            <span className="text-sky-400/60 font-black">94</span>
                            <span>127</span>
                        </div>
                    </div>

                    {/* Articulation Management */}
                    {(() => {
                        const track = tracks.find(t => t.id === selectedClip.trackId);
                        if (!track?.articulationSetId) return null;
                        const artSet = articulationSets.find(s => s.id === track.articulationSetId);
                        if (!artSet) return null;

                        return (
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between group cursor-pointer" onClick={() => toggleArticulationEditor(true, track.articulationSetId)}>
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] leading-none group-hover:text-gray-300">Articulation</span>
                                    <Music className="w-3.5 h-3.5 text-sky-400" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <div className="h-7 bg-[#252525] border border-white/5 rounded shadow-sm flex items-center px-2 justify-between cursor-pointer hover:border-white/10 group">
                                        <span className="text-[10px] font-black text-sky-400 uppercase truncate pr-1">
                                            {artSet.articulations.find(a => a.id === track.currentArticulationId)?.name || 'Default'}
                                        </span>
                                        <ChevronDown className="w-2.5 h-2.5 text-gray-600 group-hover:text-gray-400" />
                                    </div>
                                    <p className="text-[9px] text-gray-600 italic px-1">Sets articulation ID for selected notes.</p>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Piano Grid View */}
                <div className="flex-1 flex flex-col min-w-0 bg-[#0c0c0c] relative">
                    <div className="flex-1 flex overflow-auto custom-scrollbar-v custom-scrollbar-h relative" ref={containerRef}>
                        {/* Piano Keys Sidebar (Sticky) */}
                        <div className="w-[64px] bg-[#1a1a1a] border-r border-black shrink-0 z-30 flex flex-col sticky left-0 shadow-[15px_0_40px_rgba(0,0,0,0.6)]">
                            {[...Array(pitchRange)].map((_, i) => {
                                const pitch = startPitch - i;
                                const isBlack = [1, 3, 6, 8, 10].includes(pitch % 12);
                                return (
                                    <div
                                        key={pitch}
                                        className={`flex items-center justify-end pr-1.5 text-[8px] font-black shrink-0 border-b border-black/50 group relative ${isBlack ? 'bg-black h-[20px]' : 'bg-[#e0e1e2] h-[24px] text-[#2c3e50] shadow-sm'}`}
                                    >
                                        {!isBlack && (pitch % 12 === 0 ? <span className="text-[#333] text-[10px] drop-shadow-[0_1px_1px_rgba(255,255,255,0.4)] font-black">C{Math.floor(pitch / 12) - 1}</span> : '')}

                                        {/* Physical key detail */}
                                        <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-2 h-[1px] ${isBlack ? 'bg-white/10' : 'bg-black/10'}`}></div>

                                        {/* Key focus highlight */}
                                        <div className="absolute inset-0 bg-sky-500/0 group-hover:bg-sky-500/5 transition-colors"></div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Interactive Grid Canvas */}
                        <div
                            className="flex-1 relative min-w-max bg-[#111] grid-canvas"
                            onMouseDown={handleGridMouseDown}
                            onContextMenu={(e) => e.preventDefault()}
                        >
                            {/* Static Grid Layer (Optimized with CSS patterns) */}
                            <div className="absolute inset-x-0 top-0 flex flex-col pointer-events-none sticky left-0 z-10">
                                {[...Array(pitchRange)].map((_, i) => {
                                    const pitch = startPitch - i;
                                    const isBlack = [1, 3, 6, 8, 10].includes(pitch % 12);
                                    return <div key={i} className={`w-full border-b border-black/40 ${isBlack ? 'bg-black/25 h-[20px]' : 'bg-transparent h-[24px]'}`}></div>
                                })}
                            </div>

                            {/* Beat Markers Layer */}
                            <div className="absolute inset-0 flex pointer-events-none z-10 sticky top-0 h-full">
                                {[...Array(128)].map((_, i) => (
                                    <div key={i} className={`h-full border-r ${i % 16 === 0 ? 'border-sky-500/20 w-[2px]' : i % 4 === 0 ? 'border-sky-500/10 w-px' : 'border-white/[0.03] w-px'}`} style={{ width: `${pixelsPerBeat}px`, flexShrink: 0 }}></div>
                                ))}
                            </div>

                            {/* Note Editor Surface */}
                            <div className="relative pl-0 px-0 z-20 pointer-events-none" style={{ width: `${128 * pixelsPerBeat}px`, height: `${pitchRange * 24}px` }}>
                                {notesWithSource.map(noteSrc => {
                                    const top = (startPitch - noteSrc.pitch) * 24;
                                    const isBlack = [1, 3, 6, 8, 10].includes(noteSrc.pitch % 12);
                                    const h = isBlack ? 20 : 24;
                                    const isDragging = dragNoteId === noteSrc.id;
                                    const isActive = noteSrc.clipId === displayClip.id;

                                    return (
                                        <div
                                            key={`${noteSrc.clipId}-${noteSrc.id}`}
                                            onMouseDown={(e) => handleNoteMouseDown(e, noteSrc.clipId, noteSrc.id)}
                                            onClick={(e) => { e.stopPropagation(); selectClip(noteSrc.clipId); setPianoRollFocusClipId(noteSrc.clipId); }}
                                            onDoubleClick={(e) => {
                                                e.stopPropagation();
                                                setPianoRollLinkMode('single');
                                                setPianoRollFocusClipId(noteSrc.clipId);
                                                selectClip(noteSrc.clipId);
                                            }}
                                            className={`absolute rounded-[3px] group pointer-events-auto cursor-move select-none transition-shadow ${isDragging ? 'shadow-2xl z-50 brightness-125 scale-[1.02]' : 'shadow-[0_2px_10px_rgba(0,0,0,0.5)]'} ${isActive ? 'ring-2 ring-sky-400/70' : 'ring-0'}`}
                                            style={{
                                                left: `${noteSrc.start * pixelsPerBeat}px`,
                                                width: `${noteSrc.duration * pixelsPerBeat}px`,
                                                top: `${top}px`,
                                                height: `${h}px`,
                                                backgroundColor: isActive ? '#1ed760' : '#2f9c46',
                                                backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 20%, rgba(0,0,0,0.2) 100%)',
                                                border: isDragging ? '1px solid #fff' : '1px solid rgba(0,0,0,0.4)',
                                                opacity: isDragging ? 0.9 : 0.95
                                            }}
                                        >
                                            {/* Selection indication border */}
                                            <div className="absolute inset-0.5 border border-white/20 rounded-[2px] opacity-0 group-hover:opacity-100 transition-opacity"></div>

                                            {/* Velocity text tooltip (Simplified) */}
                                            {isDragging && (
                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#333] border border-white/10 rounded px-2 py-1 shadow-2xl z-50">
                                                    <div className="text-[10px] font-black text-white">Region: {displayClip.name}</div>
                                                    <div className="text-[8px] text-gray-300">Clip: {noteSrc.clipId}</div>
                                                    <span className="text-[10px] font-black text-sky-400 tabular-nums">{noteSrc.pitch} | {Math.round(noteSrc.start * 100) / 100}</span>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .grid-canvas {
                    background-image: 
                        linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
                    background-size: 20px 24px;
                }
                .custom-scrollbar-v::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar-h::-webkit-scrollbar { height: 6px; }
                .custom-scrollbar-v::-webkit-scrollbar-track, .custom-scrollbar-h::-webkit-scrollbar-track { background: #0c0c0c; }
                .custom-scrollbar-v::-webkit-scrollbar-thumb, .custom-scrollbar-h::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
            `}</style>
        </div>
    )
}
