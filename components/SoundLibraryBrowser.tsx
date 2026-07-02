"use client"

import { useState, useMemo, useCallback } from "react"
import { Search, Music, Zap, Drum, Volume2, Headphones, Play, Square, X } from "lucide-react"
import { extendedSynthPresets, samplerInstruments, drumKitInstruments, soundLibraryCategories, getSoundInfo, type SoundInfo } from "@/engine/soundLibrary/instruments"
import { instrumentRegistry } from "@/engine/instruments/instrumentRegistry"
import { audioEngine } from "@/engine/AudioEngineAdapter"

type LibraryTab = "instruments" | "loops"

interface LoopEntry {
  id: string
  name: string
  category: string
  genre: string
  path: string
  bpm: number
  duration: number
}

const LOOP_LIBRARY: LoopEntry[] = [
  // Drums
  { id: "loop-drum-house-1", name: "House Beat 01", category: "Drums", genre: "House", path: "/audio/loops/drums/drums_house_01.wav", bpm: 120, duration: 2 },
  { id: "loop-drum-house-2", name: "House Beat 02", category: "Drums", genre: "House", path: "/audio/loops/drums/drums_house_02.wav", bpm: 120, duration: 2 },
  { id: "loop-drum-lofi-1", name: "Lo-fi Beat 01", category: "Drums", genre: "Lo-fi", path: "/audio/loops/drums/drums_lofi_01.wav", bpm: 120, duration: 2 },
  { id: "loop-drum-lofi-2", name: "Lo-fi Beat 02", category: "Drums", genre: "Lo-fi", path: "/audio/loops/drums/drums_lofi_02.wav", bpm: 120, duration: 2 },
  { id: "loop-drum-trap-1", name: "Trap Beat 01", category: "Drums", genre: "Trap", path: "/audio/loops/drums/drums_trap_01.wav", bpm: 120, duration: 2 },
  { id: "loop-drum-trap-2", name: "Trap Beat 02", category: "Drums", genre: "Trap", path: "/audio/loops/drums/drums_trap_02.wav", bpm: 120, duration: 2 },
  { id: "loop-drum-techno-1", name: "Techno Beat 01", category: "Drums", genre: "Techno", path: "/audio/loops/drums/drums_techno_01.wav", bpm: 120, duration: 2 },
  { id: "loop-drum-techno-2", name: "Techno Beat 02", category: "Drums", genre: "Techno", path: "/audio/loops/drums/drums_techno_02.wav", bpm: 120, duration: 2 },
  { id: "loop-drum-hiphop-1", name: "Hip Hop Beat 01", category: "Drums", genre: "Hip Hop", path: "/audio/loops/drums/drums_hiphop_01.wav", bpm: 120, duration: 2 },
  { id: "loop-drum-hiphop-2", name: "Hip Hop Beat 02", category: "Drums", genre: "Hip Hop", path: "/audio/loops/drums/drums_hiphop_02.wav", bpm: 120, duration: 2 },
  { id: "loop-drum-funk-1", name: "Funk Beat 01", category: "Drums", genre: "Funk", path: "/audio/loops/drums/drums_funk_01.wav", bpm: 120, duration: 2 },
  { id: "loop-drum-rock-1", name: "Rock Beat 01", category: "Drums", genre: "Rock", path: "/audio/loops/drums/drums_rock_01.wav", bpm: 120, duration: 2 },
  // Bass
  { id: "loop-bass-deep-1", name: "Deep Bass 01", category: "Bass", genre: "Deep House", path: "/audio/loops/bass/bass_deep_01.wav", bpm: 120, duration: 2 },
  { id: "loop-bass-deep-2", name: "Deep Bass 02", category: "Bass", genre: "Deep House", path: "/audio/loops/bass/bass_deep_02.wav", bpm: 120, duration: 2 },
  { id: "loop-bass-walking-1", name: "Walking Bass 01", category: "Bass", genre: "Jazz", path: "/audio/loops/bass/bass_walking_01.wav", bpm: 120, duration: 2 },
  { id: "loop-bass-sub-1", name: "Sub Bass 01", category: "Bass", genre: "Dubstep", path: "/audio/loops/bass/bass_sub_01.wav", bpm: 120, duration: 2 },
  { id: "loop-bass-electro-1", name: "Electro Bass 01", category: "Bass", genre: "Electro", path: "/audio/loops/bass/bass_electro_01.wav", bpm: 120, duration: 2 },
  // Melodic
  { id: "loop-melodic-keys-1", name: "Keys Chord 01", category: "Melodic", genre: "House", path: "/audio/loops/melodic/melodic_keys_01.wav", bpm: 120, duration: 2 },
  { id: "loop-melodic-keys-2", name: "Keys Melody 01", category: "Melodic", genre: "House", path: "/audio/loops/melodic/melodic_keys_02.wav", bpm: 120, duration: 2 },
  { id: "loop-melodic-guitar-1", name: "Guitar Riff 01", category: "Melodic", genre: "Pop", path: "/audio/loops/melodic/melodic_guitar_01.wav", bpm: 120, duration: 2 },
  { id: "loop-melodic-strings-1", name: "Strings Pad 01", category: "Melodic", genre: "Cinematic", path: "/audio/loops/melodic/melodic_strings_01.wav", bpm: 120, duration: 2 },
  { id: "loop-melodic-ambient-1", name: "Ambient Pad 01", category: "Melodic", genre: "Ambient", path: "/audio/loops/melodic/melodic_ambient_01.wav", bpm: 120, duration: 4 },
]

const LOOP_CATEGORIES = ["All", "Drums", "Bass", "Melodic"]
const LOOP_GENRES = ["All", "House", "Lo-fi", "Trap", "Techno", "Hip Hop", "Funk", "Rock", "Deep House", "Jazz", "Dubstep", "Electro", "Pop", "Cinematic", "Ambient"]

const ENGINE_ICONS: Record<string, React.ReactNode> = {
  synth: <Zap className="w-3.5 h-3.5" />,
  sampler: <Music className="w-3.5 h-3.5" />,
  drumkit: <Drum className="w-3.5 h-3.5" />,
  soundfont: <Music className="w-3.5 h-3.5" />,
}

interface Props {
  onSelectInstrument?: (name: string) => void
  onSelectLoop?: (loop: LoopEntry) => void
  onClose?: () => void
}

export function SoundLibraryBrowser({ onSelectInstrument, onSelectLoop, onClose }: Props) {
  const [tab, setTab] = useState<LibraryTab>("instruments")
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("All")
  const [genreFilter, setGenreFilter] = useState<string>("All")
  const [previewing, setPreviewing] = useState<string | null>(null)

  const allInstruments = useMemo(() => {
    const names = soundLibraryCategories.flatMap(c => c.instruments)
    return names.map(name => {
      const info = getSoundInfo(name)
      return { name, info }
    }).filter(x => x.info)
  }, [])

  const filteredInstruments = useMemo(() => {
    return allInstruments.filter(x => {
      if (search && !x.name.toLowerCase().includes(search.toLowerCase())) return false
      if (categoryFilter !== "All" && x.info?.category !== categoryFilter) return false
      return true
    })
  }, [allInstruments, search, categoryFilter])

  const filteredLoops = useMemo(() => {
    return LOOP_LIBRARY.filter(l => {
      if (search && !l.name.toLowerCase().includes(search.toLowerCase())) return false
      if (categoryFilter !== "All" && l.category !== categoryFilter) return false
      if (genreFilter !== "All" && l.genre !== genreFilter) return false
      return true
    })
  }, [search, categoryFilter, genreFilter])

  const handlePreview = useCallback(async (id: string, type: "instrument" | "loop", path?: string) => {
    if (previewing === id) {
      audioEngine.stopPreview()
      setPreviewing(null)
      return
    }
    audioEngine.stopPreview()
    if (type === "loop" && path) {
      try {
        await audioEngine.previewLoop(path)
        setPreviewing(id)
      } catch {
        setPreviewing(null)
      }
    }
  }, [previewing])

  return (
    <div className="flex flex-col h-full bg-[#0c0c0c]">
      {/* Tabs */}
      <div className="flex bg-[#0a0a0a] rounded-lg border border-[#333] p-0.5 h-8 mx-3 mt-3 mb-2 shadow-inner">
        <button
          onClick={() => setTab("instruments")}
          className={`flex-1 text-[10px] font-black uppercase transition-all rounded ${tab === "instruments" ? "text-sky-400 bg-[#333] shadow-md border border-[#444]" : "text-gray-600 hover:text-gray-400"}`}
        >
          Instruments
        </button>
        <button
          onClick={() => setTab("loops")}
          className={`flex-1 text-[10px] font-black uppercase transition-all rounded ${tab === "loops" ? "text-sky-400 bg-[#333] shadow-md border border-[#444]" : "text-gray-600 hover:text-gray-400"}`}
        >
          Loops
        </button>
      </div>

      {/* Search */}
      <div className="relative mx-3 mb-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-700" />
        <input
          type="text"
          placeholder={tab === "instruments" ? "Search instruments..." : "Search loops..."}
          className="w-full bg-[#0a0a0a] border border-[#333] rounded px-7 h-7 text-[11px] font-medium text-gray-300 placeholder-gray-800 focus:outline-none focus:border-sky-500/30 shadow-inner transition-colors"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-700 hover:text-white">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Category/Genre filters */}
      <div className="flex gap-1 mx-3 mb-2 overflow-x-auto">
        {(tab === "instruments" ? ["All", "Software Instruments", "Synthesizers", "Keyboards", "Drum Kits", "SoundFont Instruments"] : LOOP_CATEGORIES).map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase whitespace-nowrap transition-colors ${categoryFilter === cat ? "bg-sky-500/20 text-sky-300 border border-sky-400/30" : "text-gray-600 hover:text-gray-400 bg-black/20"}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Genre filter for loops */}
      {tab === "loops" && (
        <div className="flex gap-1 mx-3 mb-2 overflow-x-auto">
          {LOOP_GENRES.map(genre => (
            <button
              key={genre}
              onClick={() => setGenreFilter(genre)}
              className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase whitespace-nowrap transition-colors ${genreFilter === genre ? "bg-purple-500/20 text-purple-300 border border-purple-400/30" : "text-gray-700 hover:text-gray-400 bg-black/10"}`}
            >
              {genre}
            </button>
          ))}
        </div>
      )}

      {/* Content list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar-v px-3 pb-3">
        <div className="h-6 flex items-center border-b border-black/30 text-[9px] font-black text-gray-700 uppercase mb-1">
          <div className="flex-1">{tab === "instruments" ? "Instrument" : "Loop Name"}</div>
          {tab === "loops" && <div className="w-10 text-right">BPM</div>}
          <div className="w-12 text-right">Engine</div>
          <div className="w-8"></div>
        </div>

        {tab === "instruments" ? (
          filteredInstruments.length === 0 ? (
            <div className="text-gray-800 text-[11px] text-center pt-8">No instruments match your search.</div>
          ) : (
            filteredInstruments.map(({ name, info }) => (
              <div
                key={name}
                className="h-8 flex items-center border-b border-black/5 group cursor-pointer hover:bg-sky-500/[0.06] transition-colors rounded-sm px-1"
                onClick={() => onSelectInstrument?.(name)}
              >
                <div
                  className="w-5 h-5 rounded flex items-center justify-center mr-2 shrink-0"
                  style={{ backgroundColor: (info?.color || "#666") + "30" }}
                >
                  <span style={{ color: info?.color }}>{ENGINE_ICONS[info?.engine || "synth"]}</span>
                </div>
                <div className="flex-1 text-[11px] font-bold text-gray-500 group-hover:text-gray-200 truncate">
                  {name}
                </div>
                <div className="w-12 text-right">
                    <span className={`text-[8px] font-black uppercase px-1 py-0.5 rounded ${info?.engine === "synth" ? "text-yellow-500 bg-yellow-500/10" : info?.engine === "sampler" ? "text-sky-500 bg-sky-500/10" : info?.engine === "drumkit" ? "text-green-500 bg-green-500/10" : "text-orange-500 bg-orange-500/10"}`}>
                    {info?.engine || "synth"}
                  </span>
                </div>
                <div className="w-8 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePreview(name, "instrument") }}
                    className="w-5 h-5 rounded flex items-center justify-center text-gray-600 hover:text-white hover:bg-white/10"
                  >
                    <Play className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )
        ) : (
          filteredLoops.length === 0 ? (
            <div className="text-gray-800 text-[11px] text-center pt-8">No loops match your filters.</div>
          ) : (
            filteredLoops.map(loop => (
              <div
                key={loop.id}
                className="h-8 flex items-center border-b border-black/5 group cursor-pointer hover:bg-sky-500/[0.06] transition-colors rounded-sm px-1"
                onClick={() => onSelectLoop?.(loop)}
              >
                <div className="w-5 h-5 rounded flex items-center justify-center mr-2 shrink-0 bg-purple-500/20 text-purple-400">
                  <Volume2 className="w-3 h-3" />
                </div>
                <div className="flex-1 text-[11px] font-bold text-gray-500 group-hover:text-gray-200 truncate">
                  {loop.name}
                </div>
                <div className="w-10 text-right text-[10px] font-black text-gray-700 tabular-nums">{loop.bpm}</div>
                <div className="w-8 text-right">
                  {previewing === loop.id ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePreview(loop.id, "loop", loop.path) }}
                      className="w-5 h-5 rounded flex items-center justify-center text-sky-400 hover:text-white"
                    >
                      <Square className="w-2.5 h-2.5" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePreview(loop.id, "loop", loop.path) }}
                      className="w-5 h-5 rounded flex items-center justify-center text-gray-600 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Play className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )
        )}
      </div>

      <style jsx>{`
        .custom-scrollbar-v::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar-v::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-v::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}</style>
    </div>
  )
}
