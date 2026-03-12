"use client"
import { useState, useMemo } from 'react'
import {
    Search, Music, ChevronRight, ChevronDown,
    MoreHorizontal, Settings, Trash2, Save,
    RotateCcw, Keyboard, Drum, Mic, Speaker,
    ChevronUp, X
} from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import { libraryData, Preset, Category } from '@/lib/libraryData'

export function LibraryPanel() {
    const { 
        showLibrary, focusedTrackId, updateTrack, tracks,
        librarySearchQuery, setLibrarySearchQuery,
        libraryPatchMerging, toggleLibraryPatchMerging,
        libraryMergingOptions, setLibraryMergingOption,
        librarySelectedPresetId, setLibrarySelectedPresetId,
        applyPatch
    } = useProjectStore()
    
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(libraryData[1]) // Default to Synthesizers
    const [showActionsMenu, setShowActionsMenu] = useState(false)

    const track = tracks.find(t => t.id === focusedTrackId)

    const filteredCategories = useMemo(() => {
        if (!librarySearchQuery) return libraryData
        return libraryData.filter(cat =>
            cat.name.toLowerCase().includes(librarySearchQuery.toLowerCase()) ||
            cat.presets.some(p => p.name.toLowerCase().includes(librarySearchQuery.toLowerCase()))
        )
    }, [librarySearchQuery])

    const handlePresetSelect = (preset: Preset) => {
        setLibrarySelectedPresetId(preset.id)
        if (!focusedTrackId) return
        applyPatch(focusedTrackId, preset.id)
    }

    if (!showLibrary) return null

    return (
        <div className="w-[320px] h-full bg-[#1e1e1e] border-r border-black flex flex-col shrink-0 z-50 overflow-hidden shadow-2xl select-none text-gray-300">

            {/* 1. Header Area */}
            <div className="pt-2 px-4 flex flex-col items-center gap-1 shrink-0 pb-4">
                <div className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                    <span className="text-[12px] font-medium opacity-80">Library</span>
                    <span className="text-[12px] font-bold">All Sounds</span>
                    <div className="flex flex-col -gap-1">
                        <ChevronUp className="w-2.5 h-2.5 opacity-50" />
                        <ChevronDown className="w-2.5 h-2.5 opacity-50 -mt-1" />
                    </div>
                </div>

                {/* Track Icon Visual */}
                <div className="w-full aspect-video flex flex-col items-center justify-center gap-3 py-4">
                    <div className="w-24 h-24 border-[3px] border-[#63ed63] rounded-xl flex flex-col items-center justify-center relative shadow-[0_0_30px_rgba(99,237,99,0.3)] bg-gradient-to-b from-[#63ed63]/10 to-transparent">
                        <div className="w-16 h-12 flex flex-col items-center justify-center text-[#63ed63]">
                            <Music className="w-12 h-12" />
                        </div>
                        <div className="absolute -bottom-1 w-12 h-1 bg-[#63ed63] rounded-full blur-[2px] opacity-50"></div>
                    </div>
                    <span className="text-[14px] font-black text-white tracking-tight drop-shadow-lg uppercase">
                        {librarySelectedPresetId ? librarySelectedPresetId.split('-').join(' ') : 'Analog Deep Bass'}
                    </span>
                </div>

                {/* Search Bar */}
                <div className="w-full relative px-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <Search className="w-3 h-3 text-gray-500" />
                        <ChevronDown className="w-2.5 h-2.5 text-gray-700" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search Sounds"
                        value={librarySearchQuery}
                        onChange={(e) => setLibrarySearchQuery(e.target.value)}
                        className="w-full bg-black/40 border border-[#333] rounded h-[26px] pl-10 pr-3 text-[11px] font-bold text-gray-200 placeholder-gray-700 focus:outline-none focus:ring-1 focus:ring-sky-500/50 transition-all shadow-inner"
                    />
                </div>
            </div>

            {/* 2. Dual List Area */}
            <div className="flex-1 flex min-h-0 border-t border-black bg-[#1a1a1a]">
                {/* Categories Column */}
                <div className="w-[140px] h-full overflow-y-auto custom-scrollbar border-r border-black/50 bg-[#1e1e1e]">
                    {filteredCategories.map((cat, idx) => (
                        <div
                            key={cat.name}
                            onClick={() => setSelectedCategory(cat)}
                            className={`h-7 px-2 flex items-center justify-between group cursor-pointer border-b border-black/10 transition-colors ${selectedCategory?.name === cat.name ? 'bg-sky-500/10 text-white' : 'hover:bg-white/[0.03]'}`}
                        >
                            <div className="flex items-center gap-2 truncate">
                                <span className="text-[10px] font-bold text-white/30 tabular-nums">{(idx + 1).toString().padStart(2, '0')}</span>
                                <span className={`text-[11px] font-bold truncate ${selectedCategory?.name === cat.name ? 'text-sky-400' : 'text-gray-400'}`}>
                                    {cat.name}
                                </span>
                            </div>
                            <ChevronRight className={`w-3 h-3 ${selectedCategory?.name === cat.name ? 'text-sky-400' : 'text-gray-700 group-hover:text-gray-500'}`} />
                        </div>
                    ))}
                </div>

                {/* Patches Column */}
                <div className="flex-1 h-full overflow-y-auto custom-scrollbar bg-[#161616]">
                    {selectedCategory?.presets.map(preset => (
                        <div
                            key={preset.id}
                            onClick={() => handlePresetSelect(preset)}
                            className={`h-7 px-4 flex items-center justify-between group cursor-pointer border-b border-black/10 transition-colors ${librarySelectedPresetId === preset.id ? 'bg-sky-600 text-white shadow-[inset_0_0_10px_rgba(255,255,255,0.1)]' : 'hover:bg-white/[0.03]'}`}
                        >
                            <span className={`text-[11px] font-bold truncate ${librarySelectedPresetId === preset.id ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                                {preset.name}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* 2.5 Patch Merging Area */}
            {libraryPatchMerging && (
                <div className="h-10 bg-[#2c2c2e] border-t border-black flex items-center px-2 gap-1 animate-in slide-in-from-bottom-2 duration-200">
                    <button onClick={() => toggleLibraryPatchMerging()} className="p-1 hover:text-white transition-colors"><X className="w-3 h-3" /></button>
                    {(['midiEffects', 'instruments', 'audioEffects', 'sends'] as const).map(opt => (
                        <button
                            key={opt}
                            onClick={() => setLibraryMergingOption(opt, !libraryMergingOptions[opt])}
                            className={`flex-1 h-7 rounded text-[8px] font-black uppercase transition-all ${libraryMergingOptions[opt] ? 'bg-sky-500 text-white shadow-lg' : 'bg-black/40 text-gray-500 hover:text-gray-300'}`}
                        >
                            {opt.replace('Effects', ' FX')}
                        </button>
                    ))}
                </div>
            )}

            {/* 3. Footer Area */}
            <div className="h-[70px] bg-[#222] border-t border-black flex flex-col shrink-0 px-3">
                {/* Breadcrumbs */}
                <div className="h-6 flex items-center gap-1.5 text-[9px] font-bold text-gray-500 overflow-hidden">
                    <span className="hover:text-gray-300 cursor-pointer">Legacy</span>
                    <ChevronRight className="w-2 h-2 opacity-50" />
                    <span className="hover:text-gray-300 cursor-pointer">Logic</span>
                    <ChevronRight className="w-2 h-2 opacity-50" />
                    <span className="text-gray-400 truncate">{selectedCategory?.name || 'Synthesizers'}</span>
                    <ChevronRight className="w-2 h-2 opacity-30" />
                </div>

                {/* Footer Buttons */}
                <div className="flex-1 flex items-center justify-between gap-1 pb-1 relative">
                    <div className="flex gap-1 items-center">
                        <div className="relative">
                            <button 
                                onClick={() => setShowActionsMenu(!showActionsMenu)}
                                className={`w-8 h-[24px] flex items-center justify-center border border-black/40 rounded shadow-sm transition-colors ${showActionsMenu ? 'bg-sky-500 text-white' : 'bg-[#111] hover:bg-[#333]'}`}
                            >
                                <MoreHorizontal className="w-3.5 h-3.5" />
                                <ChevronDown className="w-2 h-2 ml-0.5 opacity-50" />
                            </button>
                            {showActionsMenu && (
                                <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#2c2c2e] border border-white/10 rounded-lg shadow-2xl z-[100] py-1 overflow-hidden">
                                    <button 
                                        className="w-full px-3 py-1.5 text-left text-[11px] font-bold text-gray-200 hover:bg-sky-500 hover:text-white transition-colors flex items-center justify-between"
                                        onClick={() => { toggleLibraryPatchMerging(!libraryPatchMerging); setShowActionsMenu(false); }}
                                    >
                                        {libraryPatchMerging ? 'Disable Patch Merging' : 'Enable Patch Merging'}
                                    </button>
                                    <div className="h-px bg-white/5 my-1" />
                                    <button className="w-full px-3 py-1.5 text-left text-[11px] font-bold text-gray-200 hover:bg-sky-500 hover:text-white transition-colors">Search Results to Track...</button>
                                </div>
                            )}
                        </div>
                        <button className="px-3 h-[24px] flex items-center justify-center bg-[#111] border border-black/40 rounded shadow-sm text-[10px] font-bold text-gray-400 hover:text-white hover:bg-[#333] transition-colors">
                            Revert
                        </button>
                    </div>

                    <div className="flex gap-1 items-center">
                        <button className="px-3 h-[24px] flex items-center justify-center text-[10px] font-bold text-gray-400 hover:text-red-400 transition-colors">
                            Delete
                        </button>
                        <button className="px-3 h-[24px] flex items-center justify-center bg-[#333] border border-white/5 rounded shadow-md text-[10px] font-bold text-white hover:bg-[#444] transition-colors">
                            Save...
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
            `}</style>
        </div>
    )
}
