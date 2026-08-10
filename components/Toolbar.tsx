"use client"
import { useRef, useCallback } from "react"
import { useProjectStore } from "@/store/projectStore"
import { ToolsMenu } from "./ToolsMenu"
import {
    Scissors, Copy, ClipboardPaste,
    MousePointer2, Eraser, Move,
    Type, Hand, Search, Magnet,
    Grid, Split, RefreshCcw, Layers, Pencil, Crop
} from "lucide-react"

const TOOL_PALETTE: { id: 'pointer' | 'scissors' | 'erase' | 'zoom' | 'text' | 'pencil' | 'marquee'; icon: typeof MousePointer2; shortcut: string }[] = [
    { id: 'pointer',   icon: MousePointer2, shortcut: 'A' },
    { id: 'scissors',  icon: Scissors,      shortcut: 'S' },
    { id: 'erase',     icon: Eraser,        shortcut: 'E' },
    { id: 'zoom',      icon: Search,        shortcut: 'Z' },
    { id: 'text',      icon: Type,          shortcut: 'T' },
    { id: 'pencil',    icon: Pencil,        shortcut: 'P' },
    { id: 'marquee',   icon: Crop,          shortcut: 'R' },
]

export function Toolbar() {
    const toolMenuAnchorRef = useRef<HTMLDivElement>(null)
    const {
        showToolbar,
        currentTool,
        setCurrentTool,
        toggleToolsMenu,
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

    const handleToolsMenuClose = useCallback(() => {
        toggleToolsMenu(false)
    }, [toggleToolsMenu])

    if (!showToolbar) return null

    return (
        <>
        {/*
          * Scrolls horizontally rather than clipping — see the same note on
          * TransportBar. `px-3 sm:px-6` buys back a little width on a phone,
          * where 48px of horizontal padding is a meaningful share of the row.
          */}
        <div className="h-[44px] bg-studio-panel border-b border-studio-line flex items-center px-3 sm:px-6 gap-6 shadow-md shrink-0 z-10 overflow-x-auto overflow-y-hidden daw-scrollbar-thin transition-all animate-in slide-in-from-top duration-200">
            {/* Context Tool Palette */}
            <div
                ref={toolMenuAnchorRef}
                className="flex items-center bg-studio-sunken rounded-lg border border-studio-line p-0.5 gap-0.5 cursor-pointer"
                onClick={() => toggleToolsMenu()}
                title="Click to open Tools Menu (T)"
            >
                {TOOL_PALETTE.map((tool) => {
                    const Icon = tool.icon
                    return (
                        <ToolButton
                            key={tool.id}
                            icon={<Icon className="w-4 h-4" />}
                            active={currentTool === tool.id || (tool.id === 'pointer' && currentTool === 'select')}
                            onClick={(e) => {
                                e.stopPropagation()
                                setCurrentTool(tool.id)
                            }}
                            title={`${tool.id} (${tool.shortcut})`}
                        />
                    )
                })}
            </div>

            {/* Edit / Function Utilities */}
            <div className="flex items-center gap-2">
                <button className="logic-button px-3 h-7 text-[10px] font-black uppercase text-studio-text-mid hover:text-white transition-colors">Capture Recording</button>
                <button className="logic-button px-3 h-7 text-[10px] font-black uppercase text-studio-text-mid hover:text-white transition-colors">Quantize</button>
                <div className="w-px h-5 bg-white/10 mx-1"></div>
                
                <button 
                    onClick={() => toggleNoteRepeat()}
                    className={`h-7 px-3 rounded-md flex items-center gap-2 transition-all ${showNoteRepeatDialog ? 'bg-accent-cyan text-white shadow-[0_0_10px_rgba(14,165,233,0.3)]' : 'bg-white/5 border border-white/10 text-studio-text-dim hover:text-studio-text'}`}
                >
                    <RefreshCcw className={`w-3 h-3 ${showNoteRepeatDialog ? 'animate-spin-slow' : ''}`} />
                    <span className="text-[10px] font-black uppercase">Note Repeat</span>
                </button>

                <button 
                    onClick={() => toggleSpotErase()}
                    className={`h-7 px-3 rounded-md flex items-center gap-2 transition-all ${showSpotEraseDialog ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'bg-white/5 border border-white/10 text-studio-text-dim hover:text-studio-text'}`}
                >
                    <Eraser className="w-3 h-3" />
                    <span className="text-[10px] font-black uppercase">Spot Erase</span>
                </button>

                <button 
                    onClick={() => toggleStepInput()}
                    className={`h-7 px-3 rounded-md flex items-center gap-2 transition-all ${showStepInputKeyboard ? 'bg-accent-cyan text-white shadow-[0_0_10px_rgba(14,165,233,0.3)]' : 'bg-white/5 border border-white/10 text-studio-text-dim hover:text-studio-text'}`}
                >
                    <Piano2 className="w-3 h-3" />
                    <span className="text-[10px] font-black uppercase">Step Input</span>
                </button>

                <div className="w-px h-5 bg-white/10 mx-1"></div>

                {/* Replace Mode */}
                <div className="flex items-center gap-0.5">
                    <button 
                        onClick={() => toggleReplaceMode()}
                        className={`h-7 px-3 rounded-l-md flex items-center gap-2 transition-all ${replaceMode ? 'bg-orange-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.3)]' : 'bg-white/5 border border-white/10 text-studio-text-dim hover:text-studio-text'}`}
                        title="Replace Mode"
                    >
                        <RefreshCcw className="w-3 h-3" />
                        <span className="text-[10px] font-black uppercase">Replace</span>
                    </button>
                    <select 
                        value={replaceModeType}
                        onChange={(e) => setReplaceModeType(e.target.value as any)}
                        className="h-7 bg-studio-control border border-white/10 rounded-r-md px-1 text-[10px] font-bold text-studio-text-mid focus:outline-none hover:bg-studio-control transition-colors"
                    >
                        <option value="Region Erase">Region Erase</option>
                        <option value="Region Punch">Region Punch</option>
                        <option value="Content Erase">Content Erase</option>
                        <option value="Content Punch">Content Punch</option>
                    </select>
                </div>

                {/* Overlap Mode */}
                <div className="flex items-center gap-2 ml-2">
                    <span className="text-[9px] font-black text-studio-text-dim uppercase">Overlap:</span>
                    <select 
                        value={recordingOverlappingMode}
                        onChange={(e) => setRecordingOverlappingMode(e.target.value as any)}
                        className="h-7 bg-studio-control border border-white/10 rounded-md px-2 text-[10px] font-bold text-accent-cyan focus:outline-none hover:bg-studio-control transition-colors"
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
                <div className="flex items-center gap-2 bg-studio-sunken px-3 h-7 rounded-md border border-studio-line">
                    <span className="text-[10px] font-black text-studio-text-dim uppercase">Snap:</span>
                    <span className="text-[11px] font-bold text-accent-cyan">Smart</span>
                    <ChevronDownSmall className="w-2.5 h-2.5 text-studio-text-dim" />
                </div>
            </div>
        </div>
        <ToolsMenu anchorEl={toolMenuAnchorRef.current} onClose={handleToolsMenuClose} />
        </>
    )
}

function ToolButton({ icon, active = false, onClick, title }: { icon: React.ReactNode, active?: boolean, onClick?: (e: React.MouseEvent) => void, title?: string }) {
    return (
        <button
            onClick={onClick}
            title={title}
            className={`w-8 h-8 flex items-center justify-center rounded transition-all ${active ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40 shadow-md shadow-accent-cyan/10' : 'text-studio-text-dim hover:text-white'}`}
        >
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
