"use client"
import { useState, useRef, useCallback, useEffect } from "react"
import { useProjectStore } from "@/store/projectStore"
import { useShallow } from 'zustand/react/shallow'

import { ProjectSettingsDialog } from "./ProjectSettingsDialog"
import { NewTrackDialog } from "./NewTrackDialog"
import {
    Plus, Settings, ChevronDown, Search, LayoutGrid,
    Layout, Maximize2,
    HelpCircle, Music,
    MousePointer2, Zap,
    ZoomIn, GripVertical
} from "lucide-react"
import { TOOLS, ToolsMenu } from "./ToolsMenu"

export function TracksAreaMenuBar() {
    const store = useProjectStore(useShallow(s => ({
        addTrack: s.addTrack, snap: s.snap, setSnap: s.setSnap,
        showAutomation: s.showAutomation, toggleAutomation: s.toggleAutomation,
        beatMappingMode: s.beatMappingMode, toggleBeatMapping: s.toggleBeatMapping,
        toggleNewTrackDialog: s.toggleNewTrackDialog,
        tracks: s.tracks, focusedTrackId: s.focusedTrackId, selectedTrackIds: s.selectedTrackIds,
        toggleSelectionBasedProcessing: s.toggleSelectionBasedProcessing,
        showSelectionBasedProcessing: s.showSelectionBasedProcessing,
        toggleBounceTrackDialog: s.toggleBounceTrackDialog,
        toggleBounceRegionsDialog: s.toggleBounceRegionsDialog,
        toggleBounceAllTracksDialog: s.toggleBounceAllTracksDialog,
        toggleExportDialog: s.toggleExportDialog, toggleShareDialog: s.toggleShareDialog,
        selectedClipIds: s.selectedClipIds,
        showSearchAndSelect: s.showSearchAndSelect,
        toggleSearchAndSelect: s.toggleSearchAndSelect,
        copySelectedClips: s.copySelectedClips,
        pasteClipsAtPlayhead: s.pasteClipsAtPlayhead,
        toggleLiveLoops: s.toggleLiveLoops, showLiveLoopsGrid: s.showLiveLoopsGrid,
        toggleTracksArea: s.toggleTracksArea, showTracksArea: s.showTracksArea,
        trackHeight: s.trackHeight, setTrackHeight: s.setTrackHeight,
        zoom: s.zoom, setZoom: s.setZoom,
        currentTool: s.currentTool,
    })));
    const {
        addTrack, snap, setSnap,
        showAutomation, toggleAutomation,
        beatMappingMode, toggleBeatMapping,
        toggleNewTrackDialog,
        tracks, focusedTrackId, selectedTrackIds,
        toggleSelectionBasedProcessing,
        showSelectionBasedProcessing,
        toggleBounceTrackDialog, toggleBounceRegionsDialog, toggleBounceAllTracksDialog,
        toggleExportDialog, toggleShareDialog,
        selectedClipIds,
        showSearchAndSelect, toggleSearchAndSelect,
        copySelectedClips,
        pasteClipsAtPlayhead,
        toggleLiveLoops, showLiveLoopsGrid,
        toggleTracksArea, showTracksArea,
        trackHeight, setTrackHeight,
        zoom, setZoom,
        currentTool
    } = store
    const [showProjectSettings, setShowProjectSettings] = useState(false)
    const [showExportMenu, setShowExportMenu] = useState(false)
    const [isToolMenuOpen, setIsToolMenuOpen] = useState(false)
    const toolMenuAnchorRef = useRef<HTMLDivElement>(null)

    const currentToolDef = TOOLS.find(t => t.id === currentTool) || TOOLS[0]
    const CurrentToolIcon = currentToolDef.icon

    const handleAddTrack = (e: React.MouseEvent) => {
        if (e.altKey && e.shiftKey) {
            const selectedTrack = tracks.find(t => t.id === focusedTrackId);
            const type = selectedTrack?.type || 'audio';
            addTrack({
                name: type === 'audio' ? 'Audio' : 'Inst',
                type: type as any,
                color: type === 'audio' ? '#38bdf8' : '#63ed63',
                icon: type === 'audio' ? 'mic' : 'keyboard'
            });
            return;
        }

        if (e.shiftKey && (e.metaKey || e.ctrlKey)) {
            const selectedTrack = tracks.find(t => t.id === focusedTrackId);
            const isInstrument = selectedTrack?.type === 'software-instrument' || selectedTrack?.type === 'midi';
            const type = isInstrument ? 'audio' : 'software-instrument';
            addTrack({
                name: type === 'audio' ? 'Audio' : 'Inst',
                type: type as any,
                color: type === 'audio' ? '#38bdf8' : '#63ed63',
                icon: type === 'audio' ? 'mic' : 'keyboard'
            });
            return;
        }

        toggleNewTrackDialog(true);
    }

    return (
        <div className="h-10 bg-studio-control border-b border-black flex items-center px-1.5 justify-between shrink-0 z-40 select-none">
            {/* 1. Left Section: Dropdowns & View Toggles */}
            <div className="flex items-center">
                {/* Local Inspector Toggle (The UP arrow in image) */}
                <button className="w-8 h-7 flex items-center justify-center text-studio-text-mid hover:text-white border border-transparent hover:border-white/10 rounded transition-colors mr-1">
                    <Maximize2 className="w-3.5 h-3.5 rotate-180" />
                </button>

                {/* View Mode Cluster (Live Loops, Tracks, Automation) */}
                <div className="flex items-center bg-black/20 rounded-[4px] p-0.5 border border-white/5 mr-3">
                    <ViewToggle icon={LayoutGrid} active={showLiveLoopsGrid} onClick={toggleLiveLoops} />
                    <ViewToggle icon={Layout} active={showTracksArea} onClick={toggleTracksArea} />
                    <div className="w-px h-4 bg-white/10 mx-0.5"></div>
                    <ViewToggle icon={Zap} active={showAutomation} onClick={toggleAutomation} />
                </div>
            </div>

            {/* 2. Center Section: Tool Palette (The Arrow and Divider) */}
            <div className="flex items-center justify-center flex-1">
                <div 
                    ref={toolMenuAnchorRef}
                    className="flex items-center bg-black/20 rounded-[4px] border border-white/10 p-0.5 gap-0.5 cursor-pointer hover:bg-white/5"
                    onClick={() => setIsToolMenuOpen(!isToolMenuOpen)}
                >
                    <ToolButton icon={CurrentToolIcon} active={true} showArrow />
                </div>
            </div>

            {/* 3. Right Section: Snap, Drag, and Zoom */}
            <div className="flex items-center gap-4">
                {/* Snap Settings */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-studio-text-mid font-bold uppercase tracking-wider">Snap:</span>
                    <div className="flex h-6 bg-studio-panel border border-black rounded px-2 items-center justify-between w-[120px] text-[11px] text-studio-text cursor-pointer hover:bg-studio-raised">
                        <span className="font-bold">Smart</span>
                        <div className="flex flex-col gap-0.5 opacity-40">
                            <ChevronDown className="w-2.5 h-2.5 rotate-180" />
                            <ChevronDown className="w-2.5 h-2.5" />
                        </div>
                    </div>
                </div>

                {/* Drag Settings */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-studio-text-mid font-bold uppercase tracking-wider">Drag:</span>
                    <div className="flex h-6 bg-studio-panel border border-black rounded px-2 items-center justify-between w-[100px] text-[11px] text-studio-text cursor-pointer hover:bg-studio-raised">
                        <span className="font-bold">No Overlap</span>
                        <div className="flex flex-col gap-0.5 opacity-40">
                            <ChevronDown className="w-2.5 h-2.5 rotate-180" />
                            <ChevronDown className="w-2.5 h-2.5" />
                        </div>
                    </div>
                </div>

                <div className="w-px h-5 bg-white/10 mx-1"></div>

                {/* Utility Toggles (Waveform, Scrub, etc.) */}
                <div className="flex items-center gap-1">
                    <ViewToggle icon={Search} active={showSearchAndSelect} onClick={() => toggleSearchAndSelect(!showSearchAndSelect)} />
                </div>

                <div className="w-px h-5 bg-white/10 mx-1"></div>

                {/* Zoom Controls */}
                <div className="flex items-center gap-4">
                    {/* Vertical Zoom */}
                    <ZoomSlider 
                        icon={GripVertical} 
                        value={trackHeight} 
                        min={30} 
                        max={200} 
                        onChange={setTrackHeight} 
                        color="blue" 
                        label="Vertical Zoom"
                    />
                    
                    {/* Horizontal Zoom */}
                    <ZoomSlider 
                        icon={GripVertical} 
                        iconRotate={90}
                        value={zoom} 
                        min={5} 
                        max={200} 
                        onChange={setZoom} 
                        color="red" 
                        label="Horizontal Zoom"
                        width={96}
                    />
                </div>
            </div>

            <ToolsMenu 
                anchorEl={toolMenuAnchorRef.current} 
                open={isToolMenuOpen} 
                onClose={() => setIsToolMenuOpen(false)} 
            />
        </div>
    )
}

function Dropdown({ label }: { label: string }) {
    return (
        <button className="h-7 px-3 flex items-center gap-1 text-[12px] font-bold text-studio-text hover:bg-white/5 rounded transition-all">
            {label}
            <ChevronDown className="w-3 h-3 text-studio-text-dim pt-0.5" />
        </button>
    )
}

function ViewToggle({ icon: Icon, active, onClick }: { icon: any, active: boolean, onClick?: () => void }) {
    return (
        <button 
            onClick={onClick}
            className={`w-7 h-6 flex items-center justify-center rounded-[3px] transition-all ${active ? 'bg-accent-cyan text-white shadow-inner' : 'text-studio-text-mid hover:text-studio-text hover:bg-white/5'}`}
        >
            <Icon className="w-3.5 h-3.5" />
        </button>
    )
}

function ToolButton({ icon: Icon, active, showArrow }: { icon: any, active: boolean, showArrow?: boolean }) {
    return (
        <div className="flex items-center px-1.5 h-6 rounded-[3px] transition-all cursor-pointer group">
            <Icon className={`w-3.5 h-3.5 ${active ? 'text-studio-text' : 'text-studio-text-dim'}`} />
            {showArrow && <ChevronDown className="w-2.5 h-2.5 text-studio-text-dim ml-1 group-hover:text-studio-text-mid" />}
        </div>
    )
}

function ZoomSlider({ icon: Icon, iconRotate = 0, value, min, max, onChange, color, label, width = 64 }: { 
    icon: any, iconRotate?: number, value: number, min: number, max: number, onChange: (v: number) => void, color: 'blue' | 'red', label: string, width?: number 
}) {
    const trackRef = useRef<HTMLDivElement>(null)
    const [isDragging, setIsDragging] = useState(false)

    const handleUpdate = useCallback((e: MouseEvent | React.MouseEvent) => {
        if (!trackRef.current) return
        const rect = trackRef.current.getBoundingClientRect()
        const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        onChange(min + (max - min) * percentage)
    }, [min, max, onChange])

    const onMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true)
        handleUpdate(e)
    }

    useEffect(() => {
        if (!isDragging) return
        const onMouseMove = (e: MouseEvent) => handleUpdate(e)
        const onMouseUp = () => setIsDragging(false)
        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
        return () => {
            window.removeEventListener('mousemove', onMouseMove)
            window.removeEventListener('mouseup', onMouseUp)
        }
    }, [isDragging, handleUpdate])

    const percentage = ((value - min) / (max - min)) * 100

    return (
        <div className="flex items-center gap-2 group/slider" title={label}>
            <Icon className="w-3 h-3 text-studio-text-dim" style={{ transform: `rotate(${iconRotate}deg)` }} />
            <div 
                ref={trackRef}
                onMouseDown={onMouseDown}
                className="h-1 bg-black rounded-full relative cursor-pointer"
                style={{ width: `${width}px` }}
            >
                {/* Track fill */}
                <div 
                    className="absolute inset-y-0 left-0 bg-studio-control rounded-full" 
                    style={{ width: `${percentage}%` }}
                />
                {/* Handle */}
                <div 
                    className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-2.5 rounded-sm border border-studio-line shadow-md transition-shadow group-hover/slider:shadow-lg ${isDragging ? 'scale-110' : ''}`}
                    style={{ 
                        left: `${percentage}%`,
                        background: 'linear-gradient(to bottom, #eeeeee 0%, #bbbbbb 100%)'
                    }}
                >
                    <div className="absolute inset-[1px] border border-white/20 rounded-[1px]" />
                </div>
            </div>
        </div>
    )
}
