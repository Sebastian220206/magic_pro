"use client"
import { useState } from "react"
import { useProjectStore } from "@/store/projectStore"
import { ProjectSettingsDialog } from "./ProjectSettingsDialog"
import { NewTrackDialog } from "./NewTrackDialog"
import {
    Plus, Scissors, Copy, ClipboardPaste,
    Settings, ChevronDown, Search, LayoutGrid, Pencil,
    VolumeX, HelpCircle, Layout, Maximize2,
    Lock, Layers, Sparkles, Download, FileAudio, Share2, Music
} from "lucide-react"

export function TracksAreaMenuBar() {
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
        selectedClipIds
    } = useProjectStore()
    const [showProjectSettings, setShowProjectSettings] = useState(false)
    const [showExportMenu, setShowExportMenu] = useState(false)

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
        <div className="h-[48px] bg-[#1a1a1a] border-b border-[#000] flex items-center px-4 justify-between shrink-0 z-40">
            {/* Left Section: View & Control cluster (Logic iPad pattern) */}
            <div className="flex items-center gap-1.5">
                <div className="flex bg-[#0a0a0a] rounded-lg p-0.5 border border-[#333] shadow-inner">
                    <button onClick={() => toggleLiveLoops()} className="w-8 h-8 flex items-center justify-center text-sky-400 bg-[#252525] rounded-md shadow-md border border-[#444]" title="Toggle Live Loops Grid">
                        <LayoutGrid className="w-[18px] h-[18px]" />
                    </button>
                    <button onClick={() => toggleTracksArea()} className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-300" title="Toggle Tracks Area">
                        <Layout className="w-[18px] h-[18px]" />
                    </button>
                </div>

                <div className="w-px h-7 bg-[#333] mx-1"></div>

                <button
                    onClick={(e) => handleAddTrack(e)}
                    className="w-9 h-9 flex items-center justify-center text-sky-400 hover:text-sky-300 transition-colors bg-[#252525] rounded-lg border border-[#333] shadow-sm active:scale-95"
                    title="New Tracks"
                >
                    <Plus className="w-4 h-4" />
                </button>

                <button className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-white transition-colors bg-[#252525] rounded-lg border border-[#333] shadow-sm">
                    <Lock className="w-4 h-4" />
                </button>

                <button
                    onClick={toggleAutomation}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-all ${showAutomation ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400 shadow-inner' : 'bg-[#252525] border-[#333] text-gray-500 hover:text-white'}`}
                >
                    <Layers className="w-4 h-4" />
                </button>

                <button
                    onClick={toggleBeatMapping}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-all ${beatMappingMode ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 shadow-inner' : 'bg-[#252525] border-[#333] text-gray-500 hover:text-white'}`}
                    title="Beat Mapping"
                >
                    <Music className="w-4 h-4" />
                </button>
            </div>

            {/* Center Section: iPad-style Tool Palette (Context Buttons) */}
            <div className="flex items-center bg-[#0a0a0a] rounded-xl border border-[#333] px-1.5 py-1 gap-0.5 shadow-2xl">
                <button className="flex items-center gap-2.5 px-3 h-8 text-[11px] font-black uppercase text-gray-300 hover:text-white transition-all bg-[#252525] border border-[#444] rounded-lg shadow-md group">
                    <div className="w-3.5 h-3.5 border border-dashed border-gray-500 group-hover:border-sky-400 rounded-sm"></div>
                    Trim
                    <ChevronDown className="w-3 h-3 text-gray-600" />
                </button>

                <div className="w-px h-5 bg-[#333] mx-1.5"></div>

                <div className="flex items-center gap-0.5">
                    <button title="Search" className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white transition-colors hover:bg-white/5 rounded-lg"><Search className="w-4 h-4" /></button>
                    <button title="Split" className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white transition-colors hover:bg-white/5 rounded-lg"><Scissors className="w-4 h-4" /></button>
                    <button title="Copy" className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white transition-colors hover:bg-white/5 rounded-lg"><Copy className="w-4 h-4" /></button>
                    <button title="Paste" className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white transition-colors hover:bg-white/5 rounded-lg"><ClipboardPaste className="w-4 h-4" /></button>
                    <button 
                        onClick={() => toggleSelectionBasedProcessing()}
                        className={`w-8 h-8 flex items-center justify-center transition-all hover:bg-white/5 rounded-lg ${showSelectionBasedProcessing ? 'text-sky-400 brightness-125' : 'text-gray-500 hover:text-white'}`}
                        title="Selection-Based Processing"
                    >
                        <Sparkles className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => {
                            const state = useProjectStore.getState();
                            const trackId = state.selectedTrackIds[0] || state.focusedTrackId;
                            if (!trackId) return;
                            state.setAudioTrackEditorTrackId(trackId);
                            state.setShowAudioTrackEditor(!state.showAudioTrackEditor);
                        }}
                        className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
                        title="Toggle Audio Track Editor"
                    >
                        <FileAudio className="w-4 h-4" />
                    </button>
                </div>

                <div className="w-px h-5 bg-[#333] mx-1.5"></div>

                <div className="flex items-center gap-1">
                    <button 
                        onClick={() => toggleBounceAllTracksDialog(true)}
                        className="flex items-center gap-1.5 px-3 h-8 text-[11px] font-black uppercase text-gray-400 hover:text-white transition-all hover:bg-white/5 rounded-lg"
                    >
                        Bounce
                        <ChevronDown className="w-3 h-3 pt-0.5" />
                    </button>
                    
                    <div className="w-px h-4 bg-[#333]"></div>

                    <div className="relative">
                        <button 
                            onClick={() => setShowExportMenu(!showExportMenu)}
                            className={`flex items-center gap-1.5 px-3 h-8 text-[11px] font-black uppercase transition-all hover:bg-white/5 rounded-lg ${showExportMenu ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white'}`}
                        >
                            Export
                            <ChevronDown className={`w-3 h-3 pt-0.5 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showExportMenu && (
                            <div className="absolute top-full mt-2 right-0 w-60 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl py-1 z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <button 
                                    onClick={() => { toggleShareDialog(true); setShowExportMenu(false); }}
                                    className="w-full text-left px-4 py-2.5 text-[11px] font-bold text-gray-400 hover:text-white hover:bg-white/5 flex items-center justify-between group"
                                >
                                    Share Project or Song
                                    <Share2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                                <button 
                                    onClick={() => { toggleExportDialog('all'); setShowExportMenu(false); }}
                                    className="w-full text-left px-4 py-2.5 text-[11px] font-bold text-gray-400 hover:text-white hover:bg-white/5 flex items-center justify-between group"
                                >
                                    Export All Tracks
                                    <Share2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                                <button 
                                    onClick={() => { toggleExportDialog('track'); setShowExportMenu(false); }}
                                    className="w-full text-left px-4 py-2.5 text-[11px] font-bold text-gray-400 hover:text-white hover:bg-white/5 flex items-center justify-between group"
                                >
                                    Export Selected Track
                                    <Download className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                                <button 
                                    onClick={() => { toggleExportDialog('regions'); setShowExportMenu(false); }}
                                    className="w-full text-left px-4 py-2.5 text-[11px] font-bold text-gray-400 hover:text-white hover:bg-white/5 flex items-center justify-between group"
                                >
                                    Export Selected Regions
                                    <FileAudio className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Section: Snap & Settings */}
            <div className="flex items-center gap-3">
                <div className="flex flex-col items-end mr-1">
                    <span className="text-[9px] text-gray-600 font-black uppercase tracking-[0.1em] mb-0.5">Snap</span>
                    <div className="flex items-center gap-1.5 cursor-pointer bg-[#0a0a0a] border border-[#333] px-2.5 py-1 rounded-md transition-all hover:border-[#555] active:scale-95 shadow-inner group">
                        <span className="text-[12px] text-sky-400 font-bold tabular-nums">{snap === 'bar' ? '1/1' : snap === 'quarter' ? '1/4' : snap === 'eighth' ? '1/8' : '1/16'}</span>
                        <div className="w-2 h-2 rounded-full border-[1.5px] border-gray-600 group-hover:border-sky-500 transition-colors"></div>
                    </div>
                </div>

                <div className="w-px h-8 bg-[#333]"></div>

                <button
                    onClick={() => setShowProjectSettings(true)}
                    className="w-9 h-9 flex items-center justify-center bg-[#252525] border border-[#333] rounded-lg text-gray-500 hover:text-white transition-all shadow-sm"
                >
                    <Settings className="w-4 h-4" />
                </button>
            </div>

            {showProjectSettings && (
                <ProjectSettingsDialog onClose={() => setShowProjectSettings(false)} />
            )}
        </div>
    )
}
