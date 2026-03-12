"use client"
import { useState, useEffect } from "react"
import { useProjectStore } from "@/store/projectStore"
import { audioEngine } from "@/engine/audioEngine"
import {
    Search, Music, Play, RotateCcw,
    ChevronDown, Filter, MoreHorizontal,
    Volume2, Activity, List, LayoutGrid, X,
    ChevronRight, Info, PlusCircle, Pause, Star
} from "lucide-react"

export function LoopBrowser() {
    const { showLoopBrowser, toggleLoopBrowser, addClip, focusedTrackId, tracks } = useProjectStore()
    const [searchQuery, setSearchQuery] = useState('')
    const [activeLoop, setActiveLoop] = useState<any>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [loopTypeFilter, setLoopTypeFilter] = useState<'All'|'audio'|'midi'|'pattern'|'session'>('All')
    const [showFavorites, setShowFavorites] = useState(false)
    const [favoriteLoopIds, setFavoriteLoopIds] = useState<Set<string>>(new Set())
    const [playInKeyMode, setPlayInKeyMode] = useState<'project'|'original'|'specific'>('project')
    const [playKey, setPlayKey] = useState('C')
    const [autoLeveling, setAutoLeveling] = useState(true)

    const loopCategories = [
        { name: 'House', count: 120 },
        { name: 'Techno', count: 85 },
        { name: 'Hip Hop', count: 140 },
        { name: 'Ambient', count: 65 },
        { name: 'Drums', count: 310 },
        { name: 'Bass', count: 195 },
        { name: 'Synth', count: 240 },
        { name: 'Strings', count: 80 },
    ]

    const loopData = [
        { id: 'l1', name: '70s Disco Kit 01', type: 'audio', bpm: 120, key: 'C', beats: 8, url: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a16c7f.mp3', genre:'Disco', instrument:'Drum' },
        { id: 'l2', name: 'Analog Deep Bass 24', type: 'audio', bpm: 124, key: 'C', beats: 4, url: 'https://cdn.pixabay.com/audio/2021/11/25/audio_145d8b76ce.mp3', genre:'Bass', instrument:'Synth' },
        { id: 'l3', name: 'Chill Rhodes Chords', type: 'midi', bpm: 90, key: 'Am', beats: 16, genre:'Chill', instrument:'Keys' },
        { id: 'l4', name: 'Dusty Vinyl Beat 08', type: 'audio', bpm: 95, key: 'D', beats: 4, genre:'Hip Hop', instrument:'Drum' },
        { id: 'l5', name: 'Epic Strings Staccato', type: 'audio', bpm: 120, key: 'Em', beats: 8, genre:'Cinematic', instrument:'Strings' },
        { id: 'l6', name: 'Funky Strat Muted', type: 'audio', bpm: 115, key: 'E', beats: 8, genre:'Funk', instrument:'Guitar' },
    ]

    const filteredLoops = loopData.filter(l => {
        const matchesSearch = l.name.toLowerCase().includes(searchQuery.toLowerCase())
            || l.genre?.toLowerCase().includes(searchQuery.toLowerCase())
            || l.instrument?.toLowerCase().includes(searchQuery.toLowerCase())

        const matchesType = loopTypeFilter === 'All' ? true : l.type === loopTypeFilter
        const matchesFavorite = showFavorites ? favoriteLoopIds.has(l.id) : true

        return matchesSearch && matchesType && matchesFavorite
    })

    const handleAudition = async (loop: any) => {
        if (!loop.url) return;

        if (activeLoop?.id === loop.id && isPlaying) {
            audioEngine.stop();
            setIsPlaying(false);
            return;
        }

        setActiveLoop(loop);
        setIsPlaying(true);

        try {
            await audioEngine.loadSample(loop.id, loop.url);
            audioEngine.play(false);
            audioEngine.playRegion('audition', loop, 0); // Simplified audition track
        } catch (e) {
            console.error("Audition failed", e);
            setIsPlaying(false);
        }
    }

    const toggleFavoriteLoop = (loopId: string) => {
        setFavoriteLoopIds(prev => {
            const next = new Set(prev)
            if (next.has(loopId)) next.delete(loopId)
            else next.add(loopId)
            return next
        })
    }

    const handleAddToTimeline = (loop: any) => {
        if (!focusedTrackId) return;

        const targetTrack = tracks.find(t => t.id === focusedTrackId)
        if (!targetTrack) return;

        // Auto key-assign for loops (play in key rules)
        const baseKey = playInKeyMode === 'project' ? 'C' : playInKeyMode === 'original' ? loop.key : playKey

        addClip({
            id: Date.now().toString(),
            trackId: focusedTrackId,
            name: `${loop.name} (${loop.type})`,
            type: loop.type === 'audio' ? 'audio' : 'midi',
            alternativeId: targetTrack.activeAlternativeId || 'default',
            start: 0,
            duration: loop.beats || 4,
            color: loop.type === 'audio' ? '#64D2FF' : '#66FFA9',
            fileUrl: loop.url,
            offset: 0,
            muted: false,
            loop: true,
            qSwing: 0,
            transpose: 0,
            velocityOffset: 0,
            notes: loop.type !== 'audio' ? [] : undefined,
            key: baseKey,
        } as any)
    }

    if (!showLoopBrowser) return null

    return (
        <div className="w-[340px] h-full bg-[#1a1a1a] border-l border-black flex flex-col shrink-0 z-50 overflow-hidden shadow-[-20px_0_50px_rgba(0,0,0,0.6)] select-none text-gray-400">
            {/* 1. Interactive Header Area */}
            <div className="pt-2 px-3 flex flex-col gap-2 shrink-0 border-b border-black pb-3 bg-[#1a1a1a]">
                <div className="flex items-center justify-between h-8">
                    <div className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors group">
                        <span className="text-[12px] font-black text-white/90 group-hover:text-white">Apple Loops</span>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-700" />
                    </div>
                    <button onClick={toggleLoopBrowser} className="p-1 hover:bg-white/5 rounded-full transition-colors">
                        <X className="w-4 h-4 text-gray-600 hover:text-white" />
                    </button>
                </div>

                {/* Loop Type Filter Row */}
                <div className="flex bg-[#000] rounded-lg border border-[#333] p-0.5 h-8 shadow-inner">
                    {['All', 'audio', 'midi', 'pattern', 'session'].map(type => (
                        <button
                            key={type}
                            onClick={() => setLoopTypeFilter(type as any)}
                            className={`flex-1 text-[10px] font-black uppercase transition-all rounded ${loopTypeFilter === type ? 'text-sky-400 bg-[#333] shadow-md border border-[#444]' : 'text-gray-600 hover:text-gray-400'}`}
                        >{type}</button>
                    ))}
                </div>

                {/* Category Grid (Responsive Filter) */}
                <div className="grid grid-cols-2 gap-1 overflow-y-auto max-h-[120px] custom-scrollbar-v pr-1 py-1">
                    {loopCategories.map(cat => (
                        <button
                            key={cat.name}
                            className="h-6 flex items-center justify-between px-2 bg-black/30 border border-white/5 rounded hover:bg-white/5 hover:border-sky-500/20 transition-all group"
                        >
                            <span className="text-[10px] font-bold text-gray-600 group-hover:text-gray-300">{cat.name}</span>
                            <span className="text-[8px] font-black text-gray-800 tabular-nums">{cat.count}</span>
                        </button>
                    ))}
                </div>

                {/* Loop Preferences */}
                <div className="flex gap-1.5">
                    <button
                        onClick={() => setShowFavorites(!showFavorites)}
                        className={`h-7 px-2 text-[10px] font-black uppercase tracking-wider rounded ${showFavorites ? 'bg-amber-500/25 text-amber-300' : 'bg-white/5 text-gray-300'} hover:bg-amber-500/15`}
                    >
                        Favorites
                    </button>
                    <button
                        onClick={() => setAutoLeveling(!autoLeveling)}
                        className={`h-7 px-2 text-[10px] font-black uppercase tracking-wider rounded ${autoLeveling ? 'bg-emerald-500/25 text-emerald-300' : 'bg-white/5 text-gray-300'}`}
                    >
                        Auto Leveling: {autoLeveling ? 'On' : 'Off'}
                    </button>
                    <select
                        className="h-7 bg-[#0a0a0a] border border-[#333] text-[10px] font-bold text-gray-300 rounded px-2"
                        value={playInKeyMode}
                        onChange={(e) => setPlayInKeyMode(e.target.value as 'project'|'original'|'specific')}
                    >
                        <option value="project">Project Key</option>
                        <option value="original">Original Key</option>
                        <option value="specific">Specific Key</option>
                    </select>
                    {playInKeyMode === 'specific' && (
                        <select
                            className="h-7 bg-[#0a0a0a] border border-[#333] text-[10px] font-bold text-gray-300 rounded px-2"
                            value={playKey}
                            onChange={(e) => setPlayKey(e.target.value)}
                        >
                            {['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].map(k => <option key={k}>{k}</option>)}
                        </select>
                    )}
                </div>

                {/* Real-time Search */}
                <div className="relative mt-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                    <input
                        type="text"
                        placeholder="Search Loops..."
                        className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-8 h-7 text-[11px] font-medium text-gray-300 placeholder-gray-800 focus:outline-none focus:border-sky-500/30 shadow-inner group-hover:border-gray-500 transition-colors"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-700" />
                </div>
            </div>

            {/* 2. Results Table with Column Persistence */}
            <div className="flex-1 flex flex-col min-h-0 bg-[#0c0c0c]">
                <div className="h-6 flex items-center bg-[#252525] border-b border-black text-[9px] font-black text-gray-600 uppercase px-3 gap-2 shrink-0 sticky top-0 z-10">
                    <div className="w-6"></div>
                    <div className="flex-1">Name <ChevronDownSmall className="inline w-2 h-2" /></div>
                    <div className="w-10 text-center">BPM</div>
                    <div className="w-8 text-center">Beats</div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar-v">
                    {filteredLoops.map((loop, idx) => {
                        const isCurrentActive = activeLoop?.id === loop.id;
                        return (
                            <div
                                key={loop.id}
                                onDoubleClick={() => handleAddToTimeline(loop)}
                                onClick={() => handleAudition(loop)}
                                className={`h-[32px] flex items-center px-3 border-b border-black/10 group cursor-pointer transition-colors ${isCurrentActive ? 'bg-sky-500/20' : idx % 2 === 0 ? 'bg-white/[0.01]' : 'bg-transparent'} hover:bg-sky-500/[0.08]`}
                            >
                                <div className="w-6 h-6 flex items-center justify-center">
                                    <RotateCcw className={`w-3.5 h-3.5 ${loop.type === 'midi' ? 'text-green-500' : 'text-sky-500'} ${isCurrentActive && isPlaying ? 'animate-spin-slow' : 'opacity-40'} group-hover:opacity-100 transition-all`} />
                                </div>
                                <div className={`flex-1 text-[11px] font-bold truncate pr-2 ${isCurrentActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>
                                    {loop.name}
                                </div>
                                <div className="w-10 text-[10px] font-black text-gray-700 tabular-nums text-center group-hover:text-gray-500">{loop.bpm}</div>
                                <div className="w-8 text-[10px] font-black text-gray-700 tabular-nums text-center">{loop.beats}</div>
                                <div className="flex items-center gap-2">
                                    <Star
                                        className={`w-4 h-4 cursor-pointer ${favoriteLoopIds.has(loop.id) ? 'text-amber-300' : 'text-gray-500'} hover:text-amber-300 transition-colors`}
                                        onClick={(e) => { e.stopPropagation(); toggleFavoriteLoop(loop.id); }}
                                    />
                                    <PlusCircle className="w-4 h-4 text-sky-400 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleAddToTimeline(loop); }} />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* 3. Logic Audition Footer (Functional) */}
            <div className="h-[96px] bg-[#1a1a1a] border-t border-black p-3 pt-4 flex flex-col gap-2 shrink-0 shadow-2xl relative">
                {/* Progress bar overlay (Audition) */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-black/40">
                    <div className={`h-full bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.8)] transition-all ${isPlaying ? 'w-[45%]' : 'w-0'}`}></div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className={`w-9 h-9 rounded-lg bg-sky-500 shadow-[0_0_20px_rgba(14,165,233,0.4)] border border-sky-400 flex items-center justify-center text-white active:scale-95 transition-all ${!activeLoop && 'opacity-30 cursor-not-allowed'}`}
                        >
                            {isPlaying ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
                        </button>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[11px] font-black text-white/90 leading-tight truncate w-32">{activeLoop ? activeLoop.name : "Select a Loop"}</span>
                            <span className="text-[9px] font-black text-gray-700 uppercase tracking-widest">{activeLoop ? `${activeLoop.bpm} BPM • 8 Beats` : "Ready to Audition"}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <button className="w-7 h-7 flex items-center justify-center hover:bg-white/5 rounded text-gray-600 hover:text-white transition-all"><Info className="w-4 h-4" /></button>
                        <button className="p-1 px-2.5 h-7 bg-sky-500/10 border border-sky-500/20 rounded-md text-[9px] font-black text-sky-400 uppercase tracking-widest hover:bg-sky-500/20 transition-all">Add</button>
                    </div>
                </div>

                {/* Audition Volume Slider */}
                <div className="flex items-center gap-3">
                    <Volume2 className="w-3.5 h-3.5 text-gray-700" />
                    <div className="flex-1 h-1.5 bg-black/80 rounded-full overflow-hidden relative shadow-inner ring-1 ring-white/5">
                        <div className="h-full bg-gradient-to-r from-sky-600 to-sky-400 w-3/4 shadow-[0_0_10px_rgba(14,165,233,0.5)] relative">
                            <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/10"></div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .custom-scrollbar-v::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar-v::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar-v::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
                .animate-spin-slow { animation: spin 4s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
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
