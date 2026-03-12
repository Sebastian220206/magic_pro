"use client"
import { useProjectStore } from "@/store/projectStore"
import {
    Scissors, Copy, ClipboardPaste,
    MousePointer2, Eraser, Move,
    Type, Hand, Search, Magnet,
    Grid, Split, RefreshCcw, Layers
} from "lucide-react"

export function Toolbar() {
    const { 
        showToolbar, 
        toggleNoteRepeat, 
        showNoteRepeatDialog,
        toggleSpotErase,
        showSpotEraseDialog,
        toggleStepInput,
        showStepInputKeyboard,
        replaceMode,
        toggleReplaceMode,
        replaceModeType,
        setReplaceModeType,
        recordingOverlappingMode,
        setRecordingOverlappingMode
    } = useProjectStore()

    if (!showToolbar) return null

    return (
        <div className="h-[44px] bg-[#1a1a1a] border-b border-[#000] flex items-center px-6 gap-6 shadow-md shrink-0 z-10 transition-all animate-in slide-in-from-top duration-200">
            {/* Context Tool Palette */}
            <div className="flex items-center bg-[#0a0a0a] rounded-lg border border-[#333] p-0.5 gap-0.5">
                <ToolButton icon={<MousePointer2 className="w-4 h-4" />} active />
                <ToolButton icon={<Scissors className="w-4 h-4" />} />
                <ToolButton icon={<Eraser className="w-4 h-4" />} />
                <ToolButton icon={<Search className="w-4 h-4" />} />
                <ToolButton icon={<Type className="w-4 h-4" />} />
                <ToolButton icon={<Move className="w-4 h-4" />} />
                <ToolButton icon={<Hand className="w-4 h-4" />} />
            </div>

            {/* Edit / Function Utilities */}
            <div className="flex items-center gap-2">
                <button className="logic-button px-3 h-7 text-[10px] font-black uppercase text-gray-400 hover:text-white transition-colors">Capture Recording</button>
                <button className="logic-button px-3 h-7 text-[10px] font-black uppercase text-gray-400 hover:text-white transition-colors">Quantize</button>
                <div className="w-px h-5 bg-white/10 mx-1"></div>
                
                <button 
                    onClick={() => toggleNoteRepeat()}
                    className={`h-7 px-3 rounded-md flex items-center gap-2 transition-all ${showNoteRepeatDialog ? 'bg-sky-500 text-white shadow-[0_0_10px_rgba(14,165,233,0.3)]' : 'bg-white/5 border border-white/10 text-gray-500 hover:text-gray-300'}`}
                >
                    <RefreshCcw className={`w-3 h-3 ${showNoteRepeatDialog ? 'animate-spin-slow' : ''}`} />
                    <span className="text-[10px] font-black uppercase">Note Repeat</span>
                </button>

                <button 
                    onClick={() => toggleSpotErase()}
                    className={`h-7 px-3 rounded-md flex items-center gap-2 transition-all ${showSpotEraseDialog ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'bg-white/5 border border-white/10 text-gray-500 hover:text-gray-300'}`}
                >
                    <Eraser className="w-3 h-3" />
                    <span className="text-[10px] font-black uppercase">Spot Erase</span>
                </button>

                <button 
                    onClick={() => toggleStepInput()}
                    className={`h-7 px-3 rounded-md flex items-center gap-2 transition-all ${showStepInputKeyboard ? 'bg-sky-500 text-white shadow-[0_0_10px_rgba(14,165,233,0.3)]' : 'bg-white/5 border border-white/10 text-gray-500 hover:text-gray-300'}`}
                >
                    <Piano2 className="w-3 h-3" />
                    <span className="text-[10px] font-black uppercase">Step Input</span>
                </button>

                <div className="w-px h-5 bg-white/10 mx-1"></div>

                {/* Replace Mode */}
                <div className="flex items-center gap-0.5">
                    <button 
                        onClick={() => toggleReplaceMode()}
                        className={`h-7 px-3 rounded-l-md flex items-center gap-2 transition-all ${replaceMode ? 'bg-orange-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.3)]' : 'bg-white/5 border border-white/10 text-gray-500 hover:text-gray-300'}`}
                        title="Replace Mode"
                    >
                        <RefreshCcw className="w-3 h-3" />
                        <span className="text-[10px] font-black uppercase">Replace</span>
                    </button>
                    <select 
                        value={replaceModeType}
                        onChange={(e) => setReplaceModeType(e.target.value as any)}
                        className="h-7 bg-[#2a2a2a] border border-white/10 rounded-r-md px-1 text-[10px] font-bold text-gray-400 focus:outline-none hover:bg-[#333] transition-colors"
                    >
                        <option value="Region Erase">Region Erase</option>
                        <option value="Region Punch">Region Punch</option>
                        <option value="Content Erase">Content Erase</option>
                        <option value="Content Punch">Content Punch</option>
                    </select>
                </div>

                {/* Overlap Mode */}
                <div className="flex items-center gap-2 ml-2">
                    <span className="text-[9px] font-black text-gray-600 uppercase">Overlap:</span>
                    <select 
                        value={recordingOverlappingMode}
                        onChange={(e) => setRecordingOverlappingMode(e.target.value as any)}
                        className="h-7 bg-[#2a2a2a] border border-white/10 rounded-md px-2 text-[10px] font-bold text-sky-400 focus:outline-none hover:bg-[#333] transition-colors"
                    >
                        <option value="Create Take Folder">Create Take Folder</option>
                        <option value="Merge">Merge</option>
                        <option value="Create Tracks">Create Tracks</option>
                        <option value="Create Tracks and Mute">Create Tracks and Mute</option>
                    </select>
                </div>
            </div>

            {/* Snap & Drag Utilities */}
            <div className="flex items-center gap-4 ml-auto">
                <div className="flex items-center gap-2 bg-[#0a0a0a] px-3 h-7 rounded-md border border-[#333]">
                    <span className="text-[10px] font-black text-gray-600 uppercase">Snap:</span>
                    <span className="text-[11px] font-bold text-sky-400">Smart</span>
                    <ChevronDownSmall className="w-2.5 h-2.5 text-gray-500" />
                </div>
            </div>
        </div>
    )
}

function ToolButton({ icon, active = false }: { icon: React.ReactNode, active?: boolean }) {
    return (
        <button className={`w-8 h-8 flex items-center justify-center rounded transition-all ${active ? 'bg-[#333] text-sky-400 border border-[#444] shadow-md' : 'text-gray-500 hover:text-white'}`}>
            {icon}
        </button>
    )
}

function Piano2({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <rect width="20" height="12" x="2" y="6" rx="2" />
            <path d="M6 6v7M10 6v7M14 6v7M18 6v7" />
        </svg>
    )
}

function ChevronDownSmall({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 100 100" className={className} fill="currentColor">
            <polygon points="20,40 80,40 50,70" />
        </svg>
    )
}
