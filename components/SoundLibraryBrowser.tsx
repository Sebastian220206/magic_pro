"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Search, Music, Play, X } from "lucide-react"
import { audioEngine } from "@/engine/AudioEngineAdapter"

interface SoundFontItem {
  id: string
  name: string
  category: string
  fileUrl: string
  fileSizeKb: number
  storagePath: string
  createdAt: string
}

interface Props {
  onSelectInstrument?: (name: string) => void
  onClose?: () => void
}

export function SoundLibraryBrowser({ onSelectInstrument }: Props) {
  const [search, setSearch] = useState("")
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [items, setItems] = useState<SoundFontItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/soundfonts')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load')
        return res.json()
      })
      .then((data: SoundFontItem[]) => {
        setItems(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const filteredItems = useMemo(() => {
    if (!search) return items
    const q = search.toLowerCase()
    return items.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    )
  }, [items, search])

  const handlePreview = useCallback(async (id: string) => {
    if (previewing === id) {
      audioEngine.stopPreview()
      setPreviewing(null)
      return
    }
    audioEngine.stopPreview()
  }, [previewing])

  const formatSize = (kb: number) => {
    if (kb >= 1024) return (kb / 1024).toFixed(1) + ' MB'
    return kb + ' KB'
  }

  return (
    <div className="flex flex-col h-full bg-[#0c0c0c]">
      {/* Search */}
      <div className="relative mx-3 mt-3 mb-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-700" />
        <input
          type="text"
          placeholder="Search SoundFonts..."
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

      {/* Content list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar-v px-3 pb-3">
        <div className="h-6 flex items-center border-b border-black/30 text-[9px] font-black text-gray-700 uppercase mb-1">
          <div className="flex-1">SoundFont</div>
          <div className="w-14 text-right">Size</div>
          <div className="w-12 text-right">Engine</div>
          <div className="w-8"></div>
        </div>

        {loading ? (
          <div className="text-gray-800 text-[11px] text-center pt-8">Loading...</div>
        ) : error ? (
          <div className="text-red-800 text-[11px] text-center pt-8">Failed to load SoundFonts.</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-gray-800 text-[11px] text-center pt-8">
            {search ? 'No SoundFonts match your search.' : 'No SoundFonts uploaded yet.'}
          </div>
        ) : (
          filteredItems.map(item => (
            <div
              key={item.id}
              className="h-8 flex items-center border-b border-black/5 group cursor-pointer hover:bg-sky-500/[0.06] transition-colors rounded-sm px-1"
              onClick={() => onSelectInstrument?.(item.name)}
            >
              <div className="w-5 h-5 rounded flex items-center justify-center mr-2 shrink-0 bg-orange-500/20">
                <Music className="w-3 h-3 text-orange-400" />
              </div>
              <div className="flex-1 text-[11px] font-bold text-gray-500 group-hover:text-gray-200 truncate">
                {item.name}
              </div>
              <div className="w-14 text-right text-[9px] font-medium text-gray-700 tabular-nums">
                {formatSize(item.fileSizeKb)}
              </div>
              <div className="w-12 text-right">
                <span className="text-[8px] font-black uppercase px-1 py-0.5 rounded text-orange-500 bg-orange-500/10">
                  soundfont
                </span>
              </div>
              <div className="w-8 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); handlePreview(item.id) }}
                  className="w-5 h-5 rounded flex items-center justify-center text-gray-600 hover:text-white hover:bg-white/10"
                >
                  <Play className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
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
