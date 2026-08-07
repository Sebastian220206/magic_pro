"use client"
import { useState, useRef, useMemo, useEffect } from "react"
import { useProjectStore } from "@/store/projectStore"
import {
    Search, File, Folder, Music, Image, Video, 
    MoreHorizontal, Filter, Grid, List, LayoutGrid,
    ChevronRight, ChevronDown, Download, Trash,
    PlusCircle, X, ExternalLink, HardDrive, FileAudio, FileText, Settings
} from "lucide-react"
import { SoundLibraryBrowser } from "./SoundLibraryBrowser"

export function Browsers() {
    const { showBrowsers, toggleBrowsers, clips, tracks, focusedTrackId, addClip, addMediaFile } = useProjectStore()
    const [activeTab, setActiveTab] = useState<'project' | 'all' | 'sounds'>('project')
    const [searchQuery, setSearchQuery] = useState('')
    const [allFilesLocation, setAllFilesLocation] = useState<'Computer' | 'Home' | 'Project'>('Project')
    const [viewMode, setViewMode] = useState<'list' | 'column'>('list')
    const [importedFiles, setImportedFiles] = useState<Array<{id:string,name:string,size:number,date:string,type:'audio'|'midi'|'file',file?:File,fileUrl?:string}>>([])
    const [recentSearchTerms, setRecentSearchTerms] = useState<string[]>([])
    const [showRecentSearch, setShowRecentSearch] = useState(false)
    const [searchConditions, setSearchConditions] = useState<Array<{id:string, field:'Name'|'File Type'|'Format'|'Size'|'Modified Date', operator:string, value:string}>>([])
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const onClick = () => setShowRecentSearch(false)
        window.addEventListener('click', onClick)
        return () => window.removeEventListener('click', onClick)
    }, [])

    const projectFiles = useMemo(() => {
        return clips.map(c => ({
            id: c.id,
            name: c.name,
            size: `${(Math.random() * 10 + 2).toFixed(1)} MB`,
            type: c.type === 'audio' ? 'audio' : 'midi',
            date: 'Mar 10'
        })).filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    }, [clips, searchQuery])

    interface BrowserFile {
    id: string;
    name: string;
    type: string;
    size: string;
    date: string;
    file?: globalThis.File;
    fileUrl?: string;
  }

  const allFilesBase: BrowserFile[] = [
        { id: 'fs-desktop', name: 'Desktop', type: 'folder', size: '', date: '' },
        { id: 'fs-documents', name: 'Documents', type: 'folder', size: '', date: '' },
        { id: 'fs-music', name: 'Music Library', type: 'folder', size: '', date: '' },
        { id: 'fs-downloads', name: 'Downloads', type: 'folder', size: '', date: '' },
        { id: 'fs-volumes', name: 'External Volumes', type: 'drive', size: '', date: '' },
    ]

    const allFiles: BrowserFile[] = [...allFilesBase, ...importedFiles.map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        size: (f.size / 1024).toFixed(1) + ' KB',
        date: new Date(f.date).toLocaleDateString(),
        file: f.file,
        fileUrl: f.fileUrl
    }))]

    const filteredAllFiles = allFiles
        .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .filter(f => searchConditions.every(cond => {
            const fieldValue = cond.field === 'Name' ? f.name : cond.field === 'File Type' ? f.type : ''
            const value = cond.value.toLowerCase()
            if (cond.operator === 'contains') return fieldValue.toLowerCase().includes(value)
            if (cond.operator === 'does not contain') return !fieldValue.toLowerCase().includes(value)
            if (cond.operator === 'is') return fieldValue.toLowerCase() === value
            if (cond.operator === 'is not') return fieldValue.toLowerCase() !== value
            return true
        }))

    const handleImportButtonClick = () => {
        fileInputRef.current?.click()
    }

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files
        if (!files) return

        const newImports: Array<{id:string,name:string,size:number,date:string,type:'audio'|'midi'|'file',file?:File,fileUrl?:string}> = []
        Array.from(files).forEach(file => {
            const fileExt = file.name.split('.').pop()?.toLowerCase() || ''
            const isMidi = fileExt === 'mid' || fileExt === 'midi'
            const type = isMidi ? 'midi' : (file.type.startsWith('audio') ? 'audio' : 'file') as 'audio'|'midi'|'file'
            const fileUrl = URL.createObjectURL(file)

            newImports.push({ id: `import-${Date.now()}-${file.name}`, name: file.name, size: file.size, date: new Date().toISOString(), type, file, fileUrl})
            
            addMediaFile(file, focusedTrackId || undefined)
        })

        setImportedFiles(prev => [...newImports, ...prev])
        event.target.value = ''
    }

    const handleRecentSearchSelect = (term: string) => {
        setSearchQuery(term)
        setShowRecentSearch(false)
    }

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const trimmed = searchQuery.trim()
            if (!trimmed) return
            setRecentSearchTerms(prev => [trimmed, ...prev.filter(term => term !== trimmed)].slice(0, 10))
            setShowRecentSearch(false)
        }
    }

    if (!showBrowsers) return null

    return (
        <div className="w-[340px] h-full bg-[#1a1a1a] border-l border-black flex flex-col shrink-0 z-50 overflow-hidden shadow-[-30px_0_60px_rgba(0,0,0,0.6)] select-none text-gray-400">
            <div className="pt-2 px-3 flex flex-col gap-2 shrink-0 border-b border-black pb-3 bg-[#1e1e1e]">
                <div className="flex items-center justify-between h-8">
                    <div className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors group">
                        <span className="text-[12px] font-black text-white/90 group-hover:text-white uppercase tracking-tighter">Browsers</span>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-700" />
                    </div>
                    <button onClick={toggleBrowsers} className="p-1 hover:bg-white/5 rounded-full transition-colors">
                        <X className="w-4 h-4 text-gray-600 hover:text-white" />
                    </button>
                </div>

                <div className="flex bg-[#0a0a0a] rounded-lg border border-[#333] p-0.5 h-8 shadow-inner">
                    <button
                        onClick={() => setActiveTab('project')}
                        className={`flex-1 text-[10px] font-black uppercase transition-all rounded transition-all ${activeTab === 'project' ? 'text-sky-400 bg-[#333] shadow-md border border-[#444]' : 'text-gray-600 hover:text-gray-400'}`}
                    >Project Audio</button>
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`flex-1 text-[10px] font-black uppercase transition-all rounded transition-all ${activeTab === 'all' ? 'text-sky-400 bg-[#333] shadow-md border border-[#444]' : 'text-gray-600 hover:text-gray-400'}`}
                    >All Files</button>
                    <button
                        onClick={() => setActiveTab('sounds')}
                        className={`flex-1 text-[10px] font-black uppercase transition-all rounded transition-all ${activeTab === 'sounds' ? 'text-sky-400 bg-[#333] shadow-md border border-[#444]' : 'text-gray-600 hover:text-gray-400'}`}
                    >Sounds</button>
                </div>

                {/* Location + View Mode */}
                <div className="mt-1 flex items-center gap-1 text-[9px] uppercase">
                    {['Computer','Home','Project'].map(loc => (
                        <button
                            key={loc}
                            onClick={() => setAllFilesLocation(loc as any)}
                            className={`flex-1 py-1 rounded-lg ${allFilesLocation === loc ? 'bg-sky-500/25 text-sky-300 border border-sky-400/50' : 'bg-black/20 text-gray-400 hover:bg-white/10'} transition-colors`}
                        >{loc}</button>
                    ))}
                    <button
                        onClick={() => setViewMode(v => v === 'list' ? 'column' : 'list')}
                        className="px-2 py-1 rounded-lg bg-black/20 text-gray-400 hover:bg-white/10 transition-colors"
                    >{viewMode === 'list' ? <List className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}</button>
                </div>

                {/* Real-time Search Integration */}
                <div className="relative mt-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-700" />
                    <input
                        type="text"
                        placeholder={activeTab === 'project' ? "Search Project Assets..." : "Browse Disk..."}
                        className="w-full bg-[#0a0a0a] border border-[#333] rounded px-8 h-7 text-[11px] font-medium text-gray-300 placeholder-gray-800 focus:outline-none focus:border-sky-500/30 shadow-inner group-hover:border-gray-500 transition-colors"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        onClick={(e) => { e.stopPropagation(); setShowRecentSearch(true); }}
                    />
                    <button onClick={handleImportButtonClick} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/5 rounded"><PlusCircle className="w-3 h-3 text-gray-700" /></button>
                    <input ref={fileInputRef} type="file" accept="audio/*,.wav,.aiff,.mp3,.flac,.mid,.midi,.xml,.aaf" multiple className="hidden" onChange={handleFileImport} />
                    <div className="absolute right-8 top-1/2 -translate-y-1/2 p-1 cursor-pointer hover:bg-white/5 rounded" onClick={(e) => { e.stopPropagation(); setSearchQuery(''); }}><X className="w-3 h-3 text-gray-700" /></div>
                </div>
            </div>

            {/* 2. Content List with Table Headers (Magic Pro Look) */}
            <div className="flex-1 flex flex-col min-h-0 bg-[#0c0c0c]">
                <div className="h-6 flex items-center bg-[#252525] border-b border-black text-[9px] font-black text-gray-600 uppercase px-3 gap-2 shrink-0 sticky top-0 z-10">
                    <div className="w-6"></div>
                    <div className="flex-1">Name <ChevronDownSmall className="inline w-2 h-2" /></div>
                    <div className="w-16 text-right">Size</div>
                    <div className="w-12 text-center text-sky-400/40 opacity-0 group-hover:opacity-100"><Filter className="w-2.5 h-2.5" /></div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar-v">
                    {activeTab === 'project' ? (
                        projectFiles.length > 0 ? (
                            projectFiles.map((file, idx) => (
                                <div
                                    key={file.id}
                                    onDoubleClick={() => {
                                        const clipFromProject = clips.find(c => c.id === file.id)
                                        if (clipFromProject) {
                                            const targetTrackId = focusedTrackId || tracks.find(t => t.type === 'audio')?.id
                                            if (targetTrackId) {
                                                addClip({ ...clipFromProject, id: `clip-${Date.now()}`, trackId: targetTrackId, startBeat: 0 })
                                            }
                                        }
                                    }}
                                    className={`h-8 flex items-center px-3 border-b border-black/10 group cursor-pointer hover:bg-sky-500/[0.08] transition-colors ${idx % 2 === 0 ? 'bg-white/[0.01]' : 'bg-transparent'}`}
                                >
                                    <div className="w-6 flex items-center justify-center">
                                        {file.type === 'audio' ? <FileAudio className="w-3.5 h-3.5 text-sky-500 opacity-40 group-hover:opacity-100" /> : <Music className="w-3.5 h-3.5 text-green-500 opacity-40 group-hover:opacity-100" />}
                                    </div>
                                    <div className="flex-1 text-[11px] font-bold text-gray-500 group-hover:text-gray-200 truncate pr-2">
                                        {file.name}
                                    </div>
                                    <div className="w-16 text-[10px] font-black text-gray-700 group-hover:text-gray-500 text-right tabular-nums">{file.size}</div>
                                    <div className="w-12 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ChevronRight className="w-3 h-3 text-sky-500/60" />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center pt-20 text-gray-800 scale-75 opacity-20"><FileText className="w-12 h-12 mb-2" /><span className="text-[10px] font-black uppercase tracking-widest">No Search Results</span></div>
                        )
                    ) : activeTab === 'sounds' ? (
                        <SoundLibraryBrowser
                            onSelectInstrument={(name) => {
                                const tid = focusedTrackId || tracks.find(t => t.type === 'audio')?.id
                                if (tid) {
                                    useProjectStore.getState().updateTrack(tid, { instrument: name } as any)
                                }
                            }}
                        />
                    ) : (
                        filteredAllFiles.map((item, idx) => (
                            <div
                                key={item.id}
                                draggable={!!item.file}
                                onDragStart={(e) => {
                                    if (item.file instanceof File && e.dataTransfer.items) {
                                        try { e.dataTransfer.items.add(item.file); } catch (error) { /* No-op */ }
                                    }
                                }}
                                onDoubleClick={() => {
                                    if (item.file instanceof File) {
                                        addMediaFile(item.file, focusedTrackId || undefined)
                                    }
                                }}
                                className={`h-11 flex items-center px-3 border-b border-black/10 group cursor-pointer transition-colors hover:bg-white/[0.05] border-l-2 border-transparent hover:border-sky-500/40`}
                            >
                                <div className="w-10 flex items-center justify-center">
                                    {item.type === 'drive' ? <HardDrive className="w-5 h-5 text-sky-400 drop-shadow-lg" /> : <Folder className="w-5 h-5 text-gray-600 group-hover:text-sky-500 shadow-sm" />}
                                </div>
                                <div className="flex-1 text-[12px] font-black text-gray-500 group-hover:text-gray-200 truncate">
                                    {item.name}
                                </div>
                                <div className="w-16 text-[10px] font-black text-gray-700 text-right tabular-nums mr-2">{item.size || '-'}</div>
                                <ChevronRight className="w-3.5 h-3.5 text-gray-800 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* 3. Logical Breadcrumb Footer with File-Stage Navigation */}
            <div className="h-[44px] bg-[#1a1a1a] border-t border-black px-4 flex items-center justify-between shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
                <div className="flex items-center gap-2 overflow-hidden group/path cursor-pointer">
                    <HardDrive className="w-3.5 h-3.5 text-gray-700 group-hover:text-sky-500 shrink-0" />
                    <span className="text-[10px] font-black text-gray-600 truncate uppercase tracking-widest leading-none group-hover:text-gray-400">Macintosh HD › Users › producer › Project</span>
                </div>
                <button className="p-1 hover:bg-white/5 rounded text-gray-700 hover:text-white"><Settings className="w-3.5 h-3.5" /></button>
            </div>

            <style jsx>{`
                .custom-scrollbar-v::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar-v::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar-v::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
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
