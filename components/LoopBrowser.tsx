"use client"
import { useState, useCallback, useMemo } from "react"
import { useProjectStore } from "@/store/projectStore"
import { audioEngine } from "@/engine/AudioEngineAdapter"
import { loopLibrary, type LoopAsset } from "@/data/loopLibrary"
import {
    Search, Music, Play, RotateCcw,
    ChevronDown, Filter, MoreHorizontal,
    Volume2, Activity, List, LayoutGrid, X,
    ChevronRight, Info, PlusCircle, Pause, Star
} from "lucide-react"

const categories = [
  { key: 'all', name: 'All Loops' },
  { key: 'drums', name: 'Drums' },
  { key: 'bass', name: 'Bass' },
  { key: 'melodic', name: 'Melodic' },
];

/**
 * General MIDI program numbers to the instrument names the engine knows.
 *
 * The generator records which GM program each loop was written for, but
 * `loadInstrument` takes a name. Anything unmapped falls back to piano, which
 * is always available.
 */
const PROGRAM_TO_INSTRUMENT: Record<number, string> = {
    0: 'piano', 4: 'piano', 7: 'piano', 11: 'piano', 18: 'organ',
    24: 'guitar', 27: 'guitar', 28: 'guitar', 29: 'guitar',
    33: 'bass', 34: 'bass', 35: 'bass', 36: 'bass', 38: 'bass',
    48: 'strings', 50: 'strings', 52: 'strings', 61: 'brass', 65: 'brass',
    80: 'synth', 81: 'synth', 89: 'synth', 95: 'synth',
};

function instrumentForLoop(loop: LoopAsset): string {
    if (loop.drums) return 'drums';
    return (loop.program !== undefined && PROGRAM_TO_INSTRUMENT[loop.program]) || 'piano';
}

/**
 * Play a loop, whichever kind it is.
 *
 * Sampled loops have a file to play. Generated ones are MIDI and have to be
 * scheduled against the audio clock through an instrument instead.
 */
async function auditionLoop(loop: LoopAsset): Promise<void> {
    if (loop.notes?.length) {
        await audioEngine.previewMidiLoop(loop.notes, loop.bpm, instrumentForLoop(loop));
        return;
    }
    if (loop.path) {
        await audioEngine.previewLoop(loop.path);
    }
}

export function LoopBrowser() {
    const { showLoopBrowser, toggleLoopBrowser, addClip, focusedTrackId, tracks } = useProjectStore()
    const [searchQuery, setSearchQuery] = useState('')
    const [activeLoop, setActiveLoop] = useState<LoopAsset | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [activeCategory, setActiveCategory] = useState('all')
    const [showFavorites, setShowFavorites] = useState(false)
    const [favoriteLoopIds, setFavoriteLoopIds] = useState<Set<string>>(new Set())
    const [playInKeyMode, setPlayInKeyMode] = useState<'project' | 'original' | 'specific'>('project')
    const [playKey, setPlayKey] = useState('C')
    const [autoLeveling, setAutoLeveling] = useState(true)

    const filteredLoops = useMemo(() => {
      return loopLibrary.filter(l => {
        const matchesCategory = activeCategory === 'all' || l.category === activeCategory;
        const matchesSearch = !searchQuery || l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.genre.toLowerCase().includes(searchQuery.toLowerCase()) || l.instrument.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFavorite = showFavorites ? favoriteLoopIds.has(l.id) : true;
        return matchesCategory && matchesSearch && matchesFavorite;
      });
    }, [searchQuery, activeCategory, showFavorites, favoriteLoopIds]);

    const handleAudition = useCallback(async (loop: LoopAsset) => {
        if (activeLoop?.id === loop.id && isPlaying) {
            audioEngine.stopPreview();
            setIsPlaying(false);
            setActiveLoop(null);
            return;
        }

        setActiveLoop(loop);
        setIsPlaying(true);
        await auditionLoop(loop);
    }, [activeLoop, isPlaying]);

    const toggleFavoriteLoop = useCallback((loopId: string) => {
        setFavoriteLoopIds(prev => {
            const next = new Set(prev)
            if (next.has(loopId)) next.delete(loopId)
            else next.add(loopId)
            return next
        })
    }, [])

    const handleAddToTimeline = useCallback((loop: LoopAsset) => {
        if (!focusedTrackId) return;

        const targetTrack = tracks.find(t => t.id === focusedTrackId)
        if (!targetTrack) return;

        const baseKey = playInKeyMode === 'project' ? 'C' : playInKeyMode === 'original' ? (loop.key || 'C') : playKey;
        const isMidi = Boolean(loop.notes?.length);

        /*
         * A MIDI loop becomes a real MIDI clip, not an audio region. That is
         * the whole reason the library is MIDI: the notes land in the piano
         * roll where they can be transposed, re-voiced or corrected. Notes are
         * given fresh ids so two copies of the same loop never share them.
         */
        addClip({
            id: Date.now().toString(),
            trackId: focusedTrackId,
            name: loop.name,
            type: isMidi ? 'midi' : 'audio',
            alternativeId: targetTrack.activeAlternativeId || 'default',
            start: 0,
            duration: loop.beats || 4,
            color: isMidi ? '#A78BFA' : '#64D2FF',
            fileUrl: isMidi ? undefined : loop.path,
            offset: 0,
            muted: false,
            loop: true,
            qSwing: 0,
            transpose: 0,
            velocityOffset: 0,
            notes: isMidi
                ? loop.notes!.map((n, i) => ({
                    id: `${Date.now()}-${i}`,
                    pitch: n.pitch,
                    velocity: n.velocity,
                    start: n.start,
                    duration: n.duration,
                }))
                : undefined,
            key: baseKey,
        } as any);

        // Give the track an instrument if it has none, so the loop makes a
        // sound on the first press of play rather than dropping in silent.
        if (isMidi && !targetTrack.instrument) {
            audioEngine.loadInstrument(focusedTrackId, instrumentForLoop(loop))
                .catch(err => console.warn('[LoopBrowser] Could not load instrument:', err));
        }
    }, [focusedTrackId, tracks, playInKeyMode, playKey, addClip]);

    const categoryCounts = useMemo(() => {
      const counts: Record<string, number> = { all: loopLibrary.length };
      for (const cat of ['drums', 'bass', 'melodic']) {
        counts[cat] = loopLibrary.filter(l => l.category === cat).length;
      }
      return counts;
    }, []);

    if (!showLoopBrowser) return null

    return (
        <div className="w-[340px] h-full bg-studio-panel border-l border-black flex flex-col shrink-0 z-50 overflow-hidden shadow-[-20px_0_50px_rgba(0,0,0,0.6)] select-none text-studio-text-mid">
            {/* 1. Interactive Header Area */}
            <div className="pt-2 px-3 flex flex-col gap-2 shrink-0 border-b border-black pb-3 bg-studio-panel">
                <div className="flex items-center justify-between h-8">
                    <div className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors group">
                        <span className="text-[12px] font-black text-white/90 group-hover:text-white">Loop Browser</span>
                        <ChevronDown className="w-3.5 h-3.5 text-studio-text-dim" />
                    </div>
                    <button onClick={toggleLoopBrowser} className="p-1 hover:bg-white/5 rounded-full transition-colors">
                        <X className="w-4 h-4 text-studio-text-dim hover:text-white" />
                    </button>
                </div>

                {/* Category Filter Row */}
                <div className="flex bg-studio-void rounded-lg border border-studio-line p-0.5 h-8 shadow-inner">
                    {categories.map(cat => (
                        <button
                            key={cat.key}
                            onClick={() => setActiveCategory(cat.key)}
                            className={`flex-1 text-[10px] font-black uppercase transition-all rounded ${activeCategory === cat.key ? 'text-accent-cyan bg-studio-control shadow-md border border-studio-line-strong' : 'text-studio-text-dim hover:text-studio-text-mid'}`}
                        >
                          {cat.name}
                          <span className="ml-1 text-[8px] text-studio-text-dim">({categoryCounts[cat.key]})</span>
                        </button>
                    ))}
                </div>

                {/* Loop Preferences */}
                <div className="flex gap-1.5">
                    <button
                        onClick={() => setShowFavorites(!showFavorites)}
                        className={`h-7 px-2 text-[10px] font-black uppercase tracking-wider rounded ${showFavorites ? 'bg-amber-500/25 text-amber-300' : 'bg-white/5 text-studio-text'} hover:bg-amber-500/15`}
                    >
                        Favorites
                    </button>
                    <button
                        onClick={() => setAutoLeveling(!autoLeveling)}
                        className={`h-7 px-2 text-[10px] font-black uppercase tracking-wider rounded ${autoLeveling ? 'bg-emerald-500/25 text-emerald-300' : 'bg-white/5 text-studio-text'}`}
                    >
                        Auto Leveling: {autoLeveling ? 'On' : 'Off'}
                    </button>
                    <select
                        className="h-7 bg-studio-sunken border border-studio-line text-[10px] font-bold text-studio-text rounded px-2"
                        value={playInKeyMode}
                        onChange={(e) => setPlayInKeyMode(e.target.value as 'project' | 'original' | 'specific')}
                    >
                        <option value="project">Project Key</option>
                        <option value="original">Original Key</option>
                        <option value="specific">Specific Key</option>
                    </select>
                    {playInKeyMode === 'specific' && (
                        <select
                            className="h-7 bg-studio-sunken border border-studio-line text-[10px] font-bold text-studio-text rounded px-2"
                            value={playKey}
                            onChange={(e) => setPlayKey(e.target.value)}
                        >
                            {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(k => <option key={k}>{k}</option>)}
                        </select>
                    )}
                </div>

                {/* Real-time Search */}
                <div className="relative mt-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-studio-text-dim" />
                    <input
                        type="text"
                        placeholder="Search Loops..."
                        className="w-full bg-studio-sunken border border-studio-line rounded-md px-8 h-7 text-[11px] font-medium text-studio-text placeholder-studio-text-dim focus:outline-none focus:border-accent-cyan/30 shadow-inner group-hover:border-studio-line-strong transition-colors"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-studio-text-dim" />
                </div>
            </div>

            {/* 2. Results Table */}
            <div className="flex-1 flex flex-col min-h-0 bg-studio-void">
                <div className="h-6 flex items-center bg-studio-raised border-b border-black text-[9px] font-black text-studio-text-dim uppercase px-3 gap-2 shrink-0 sticky top-0 z-10">
                    <div className="w-6"></div>
                    <div className="flex-1">Name</div>
                    <div className="w-10 text-center">BPM</div>
                    <div className="w-8 text-center">Beats</div>
                    <div className="w-10 text-center">Key</div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar-v">
                    {filteredLoops.length === 0 && (
                      <div className="flex items-center justify-center h-24 text-studio-text-dim text-[11px]">No loops found</div>
                    )}
                    {filteredLoops.map((loop, idx) => {
                        const isCurrentActive = activeLoop?.id === loop.id;
                        return (
                            <div
                                key={loop.id}
                                onDoubleClick={() => handleAddToTimeline(loop)}
                                onClick={() => handleAudition(loop)}
                                className={`h-[32px] flex items-center px-3 border-b border-black/10 group cursor-pointer transition-colors ${isCurrentActive ? 'bg-accent-cyan/20' : idx % 2 === 0 ? 'bg-white/[0.01]' : 'bg-transparent'} hover:bg-accent-cyan/[0.08]`}
                            >
                                <div className="w-6 h-6 flex items-center justify-center">
                                    <RotateCcw className={`w-3.5 h-3.5 text-accent-cyan ${isCurrentActive && isPlaying ? 'animate-spin-slow' : 'opacity-40'} group-hover:opacity-100 transition-all`} />
                                </div>
                                <div className={`flex-1 text-[11px] font-bold truncate pr-2 ${isCurrentActive ? 'text-white' : 'text-studio-text-dim group-hover:text-studio-text'}`}>
                                    {loop.name}
                                </div>
                                <div className="w-10 text-[10px] font-black text-studio-text-dim tabular-nums text-center group-hover:text-studio-text-dim">{loop.bpm}</div>
                                <div className="w-8 text-[10px] font-black text-studio-text-dim tabular-nums text-center">{loop.beats}</div>
                                <div className="w-10 text-[10px] font-black text-studio-text-dim tabular-nums text-center">{loop.key || '-'}</div>
                                <div className="flex items-center gap-2">
                                    <Star
                                        className={`w-4 h-4 cursor-pointer ${favoriteLoopIds.has(loop.id) ? 'text-amber-300' : 'text-studio-text-dim'} hover:text-amber-300 transition-colors`}
                                        onClick={(e) => { e.stopPropagation(); toggleFavoriteLoop(loop.id); }}
                                    />
                                    <PlusCircle className="w-4 h-4 text-accent-cyan cursor-pointer" onClick={(e) => { e.stopPropagation(); handleAddToTimeline(loop); }} />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* 3. Audition Footer */}
            <div className="h-[96px] bg-studio-panel border-t border-black p-3 pt-4 flex flex-col gap-2 shrink-0 shadow-2xl relative">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-black/40">
                    <div className={`h-full bg-accent-cyan shadow-[0_0_10px_rgba(14,165,233,0.8)] transition-all ${isPlaying ? 'w-[45%]' : 'w-0'}`}></div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={async () => {
                                if (isPlaying) {
                                    audioEngine.stopPreview();
                                    setIsPlaying(false);
                                } else if (activeLoop) {
                                    setIsPlaying(true);
                                    await auditionLoop(activeLoop);
                                }
                            }}
                            className={`w-9 h-9 rounded-lg bg-accent-cyan shadow-[0_0_20px_rgba(14,165,233,0.4)] border border-accent-cyan flex items-center justify-center text-white active:scale-95 transition-all ${!activeLoop && 'opacity-30 cursor-not-allowed'}`}
                        >
                            {isPlaying ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
                        </button>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[11px] font-black text-white/90 leading-tight truncate w-32">{activeLoop ? activeLoop.name : "Select a Loop"}</span>
                            <span className="text-[9px] font-black text-studio-text-dim uppercase tracking-widest">{activeLoop ? `${activeLoop.bpm} BPM • ${activeLoop.beats} Beats` : "Ready to Audition"}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <button className="w-7 h-7 flex items-center justify-center hover:bg-white/5 rounded text-studio-text-dim hover:text-white transition-all"><Info className="w-4 h-4" /></button>
                        <button
                          onClick={() => activeLoop && handleAddToTimeline(activeLoop)}
                          className="p-1 px-2.5 h-7 bg-accent-cyan/10 border border-accent-cyan/20 rounded-md text-[9px] font-black text-accent-cyan uppercase tracking-widest hover:bg-accent-cyan/20 transition-all"
                        >
                          Add
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Volume2 className="w-3.5 h-3.5 text-studio-text-dim" />
                    <div className="flex-1 h-1.5 bg-black/80 rounded-full overflow-hidden relative shadow-inner ring-1 ring-white/5">
                        <div className="h-full bg-gradient-to-r from-accent-cyan to-accent-cyan w-3/4 shadow-[0_0_10px_rgba(14,165,233,0.5)] relative">
                            <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/10"></div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .animate-spin-slow { animation: spin 4s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>

        </div>
    )
}
