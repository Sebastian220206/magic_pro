"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useProjectStore } from "@/store/projectStore"
import { useShallow } from 'zustand/react/shallow'
import { CreateNewTrackUsingDialog } from "./CreateNewTrackUsingDialog"
import { Track } from "@/models/Track"
import { Clip } from "@/models/Clip"
import {
    Plus, ChevronDown, Square, Layout,
    Music, Mic, Drum, CircleDot,
    ChevronRight, Volume2, Music2,
    Settings, MoreHorizontal, Power,
    Keyboard, Activity, Folder, Guitar,
    Layers, ChevronUp, GripVertical, X,
    Search, Copy, Palette, Lock, Snowflake, ArrowUp, Trash2, Check, Star
} from "lucide-react"
import { TrackLevelMeter } from "./TrackLevelMeter"
import { HorizontalMeter } from "./HorizontalMeter"
import { audioEngine } from "@/engine/AudioEngineAdapter"

export function TrackList() {
    const store = useProjectStore(useShallow(s => ({
        tracks: s.tracks, updateTrack: s.updateTrack, trackHeight: s.trackHeight,
        selectedTrackIds: s.selectedTrackIds, focusedTrackId: s.focusedTrackId,
        selectTrack: s.selectTrack, addTrack: s.addTrack, showAutomation: s.showAutomation,
        clips: s.clips, recording: s.recording,
        toggleNewTrackDialog: s.toggleNewTrackDialog,
        toggleCreateTrackUsing: s.toggleCreateTrackUsing,
        showCreateTrackUsing: s.showCreateTrackUsing,
        addClip: s.addClip,
        setDragPosition: s.setDragPosition,
        setDropTargetTrackId: s.setDropTargetTrackId,
        dropTargetTrackId: s.dropTargetTrackId,
        duplicateTracks: s.duplicateTracks,
        createTrackForOverlappedRegions: s.createTrackForOverlappedRegions,
        createTrackForSelectedRegions: s.createTrackForSelectedRegions,
        reorderTracks: s.reorderTracks,
        updateTrackZoom: s.updateTrackZoom,
        resetAllTrackZoom: s.resetAllTrackZoom,
        sortTracks: s.sortTracks, toggleColorPalette: s.toggleColorPalette,
        toggleIconBrowser: s.toggleIconBrowser, toggleDrumReplacement: s.toggleDrumReplacement,
        trackHeaderConfig: s.trackHeaderConfig,
        trackHeaderWidth: s.trackHeaderWidth,
        setTrackHeaderWidth: s.setTrackHeaderWidth,
        toggleTrackHeaderConfig: s.toggleTrackHeaderConfig,
        updateTrackParameter: s.updateTrackParameter,
        renameAlternative: s.renameAlternative,
        swapWithActiveAlternative: s.swapWithActiveAlternative,
        setActiveAlternative: s.setActiveAlternative,
        toggleInactiveAlternatives: s.toggleInactiveAlternatives,
        deleteInactiveAlternatives: s.deleteInactiveAlternatives,
        addTrackAlternative: s.addTrackAlternative,
        hideViewActive: s.hideViewActive,
        toggleHideView: s.toggleHideView,
        setTrackHidden: s.setTrackHidden,
        unhideAllTracks: s.unhideAllTracks,
        createTrackStack: s.createTrackStack, flattenStack: s.flattenStack,
        toggleStackCollapse: s.toggleStackCollapse, convertStackType: s.convertStackType,
        setGrooveTrack: s.setGrooveTrack, toggleMatchGroove: s.toggleMatchGroove,
        toggleArticulationEditor: s.toggleArticulationEditor,
        addArticulationSet: s.addArticulationSet, articulationSets: s.articulationSets,
        toggleBounceTrackDialog: s.toggleBounceTrackDialog,
        toggleBounceRegionsDialog: s.toggleBounceRegionsDialog,
        selectedClipIds: s.selectedClipIds,
        saveHistorySnapshot: s.saveHistorySnapshot,
    })));
    const {
        tracks, updateTrack, trackHeight, selectedTrackIds, focusedTrackId,
        selectTrack, addTrack, showAutomation, clips, recording,
        toggleNewTrackDialog,
        toggleCreateTrackUsing,
        showCreateTrackUsing,
        addClip,
        setDragPosition,
        setDropTargetTrackId,
        dropTargetTrackId,
        duplicateTracks,
        createTrackForOverlappedRegions,
        createTrackForSelectedRegions,
        reorderTracks,
        updateTrackZoom,
        resetAllTrackZoom,
        sortTracks, toggleColorPalette, toggleIconBrowser, toggleDrumReplacement,
        trackHeaderConfig,
        trackHeaderWidth,
        setTrackHeaderWidth,
        toggleTrackHeaderConfig,
        updateTrackParameter,
        renameAlternative,
        swapWithActiveAlternative, setActiveAlternative, toggleInactiveAlternatives, deleteInactiveAlternatives, addTrackAlternative,
        hideViewActive,
        toggleHideView,
        setTrackHidden,
        unhideAllTracks,
        createTrackStack, flattenStack, toggleStackCollapse, convertStackType,
        setGrooveTrack, toggleMatchGroove,
        toggleArticulationEditor, addArticulationSet, articulationSets,
        toggleBounceTrackDialog, toggleBounceRegionsDialog, selectedClipIds,
        saveHistorySnapshot
    } = store

    const [showTrackMenu, setShowTrackMenu] = useState(false)
    const [draggedTrackIndex, setDraggedTrackIndex] = useState<number | null>(null)
    const [zoomDraggingTrackId, setZoomDraggingTrackId] = useState<string | null>(null)
    const [trackContextMenu, setTrackContextMenu] = useState<{ id: string, x: number, y: number } | null>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const contextMenuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowTrackMenu(false)
            }
            if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
                setTrackContextMenu(null)
            }
        }
        if (showTrackMenu || trackContextMenu) {
            window.addEventListener('mousedown', handleClickOutside)
        }
        return () => window.removeEventListener('mousedown', handleClickOutside)
    }, [showTrackMenu, trackContextMenu])

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
            e.dataTransfer.dropEffect = 'copy';
            setDragPosition({ x: e.clientX, y: e.clientY });
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            setDragPosition({ x: e.clientX, y: e.clientY });
            toggleCreateTrackUsing(true, files);
        } else {
            setDragPosition(null);
            setDropTargetTrackId(null);
        }
    };

    const handleAddTrack = (e: React.MouseEvent) => {
        if (e.altKey && e.shiftKey) {
            const focusedTrack = tracks.find(t => t.id === focusedTrackId);
            const type = focusedTrack?.type || 'audio';
            addTrack({
                name: type === 'audio' ? 'Audio' : 'Inst',
                type: type as any,
                color: type === 'audio' ? '#38bdf8' : '#63ed63',
                icon: type === 'audio' ? 'mic' : 'keyboard'
            });
            return;
        }

        if (e.shiftKey && (e.metaKey || e.ctrlKey)) {
            const focusedTrack = tracks.find(t => t.id === focusedTrackId);
            const isInstrument = focusedTrack?.type === 'software-instrument' || focusedTrack?.type === 'midi';
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

    const handleDuplicateTrack = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.altKey) {
            duplicateTracks('shared');
        } else if (e.metaKey || e.ctrlKey) {
            duplicateTracks('content');
        } else {
            duplicateTracks('settings');
        }
    }

    const handleCreateStack = () => {
        if (selectedTrackIds.length > 0) {
            createTrackStack(selectedTrackIds, 'Summing');
        }
    }

    const [resizingHeader, setResizingHeader] = useState(false)
    const [swipingAction, setSwipingAction] = useState<'muted' | 'soloed' | 'recordEnabled' | 'inputMonitoring' | 'protected' | 'frozen' | 'hidden' | null>(null)
    const [swipingTargetValue, setSwipingTargetValue] = useState<boolean>(false)
    const [openAltMenuId, setOpenAltMenuId] = useState<string | null>(null)

    const getIsTrackVisible = (track: Track) => {
        if (hideViewActive && track.hidden) return false;
        
        let currentParentId = track.parentId;
        while (currentParentId) {
            const parent = tracks.find(t => t.id === currentParentId);
            if (parent?.isCollapsed) return false;
            currentParentId = parent?.parentId;
        }
        return true;
    };

    const hasGrooveTrack = tracks.some(t => t.isGrooveTrack);

    const handleSwipeStart = (field: any, value: boolean) => {
        setSwipingAction(field);
        setSwipingTargetValue(value);
    }

    const handleSwipeEnter = (trackId: string) => {
        if (swipingAction) {
            if (swipingAction === 'protected' || swipingAction === 'frozen') {
                updateTrackParameter(trackId, { [swipingAction]: swipingTargetValue });
            } else if (swipingAction === 'hidden') {
                setTrackHidden(trackId, swipingTargetValue);
            } else {
                updateTrack(trackId, { [swipingAction]: swipingTargetValue });
            }
        }
    }

    // Resize Handler
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (resizingHeader) {
                setTrackHeaderWidth(Math.max(180, Math.min(600, e.clientX)));
            }
            if (zoomDraggingTrackId) {
                const trackIdx = tracks.findIndex(t => t.id === zoomDraggingTrackId);
                const trackElems = document.querySelectorAll('.track-row');
                const trackElem = trackElems[trackIdx];
                if (trackElem) {
                    const rect = trackElem.getBoundingClientRect();
                    const newHeight = Math.max(trackHeight, e.clientY - rect.top);
                    const zoomFactor = newHeight / trackHeight;
                    updateTrackZoom(zoomDraggingTrackId, zoomFactor);
                }
            }
        };
        const handleMouseUp = () => {
            setResizingHeader(false);
            setZoomDraggingTrackId(null);
            setSwipingAction(null);
        };

        if (resizingHeader || zoomDraggingTrackId || swipingAction) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizingHeader, zoomDraggingTrackId, swipingAction, tracks, trackHeight, updateTrackZoom, setTrackHeaderWidth]);

    return (
        <div
            className="border-r border-[var(--accent-cyan)] bg-[#111] flex flex-col z-20 shrink-0 select-none shadow-[20px_0_40px_rgba(0,0,0,0.5),0_0_20px_var(--accent-cyan-glow)] relative group"
            style={{ width: trackHeaderWidth }}
            onContextMenu={(e) => {
                e.preventDefault();
                toggleTrackHeaderConfig(true);
            }}
        >
            {/* Resize Handle */}
            <div
                className="absolute top-0 right-0 w-1 h-full cursor-col-resize z-50 hover:bg-[var(--accent-cyan)] transition-colors"
                onMouseDown={() => setResizingHeader(true)}
            />
            {/* Magic Pro Signature Tracks Header */}
            <div className="h-[48px] border-b border-[var(--accent-cyan)]/50 bg-[#1a1a1a] flex items-center px-4 justify-between shrink-0 sticky top-0 z-30 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="flex bg-[#000] rounded-sm border border-[var(--accent-cyan)]/50 p-0.5 h-6">
                        <button onClick={(e) => handleAddTrack(e)} className="w-7 h-full flex items-center justify-center text-gray-400 hover:text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/10 transition-all outline-none" title="New Track..."><Plus className="w-4 h-4" /></button>
                        <div className="w-px h-full bg-[var(--accent-cyan)]/30"></div>
                        <button onClick={(e) => handleDuplicateTrack(e)} className="w-7 h-full flex items-center justify-center text-gray-400 hover:text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/10 transition-all outline-none" title="Duplicate Track"><Copy className="w-3.5 h-3.5" /></button>
                        <div className="w-px h-full bg-[var(--accent-cyan)]/30"></div>
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setShowTrackMenu(!showTrackMenu)}
                                className={`w-7 h-full flex items-center justify-center transition-all outline-none ${showTrackMenu ? 'text-[var(--accent-cyan)] bg-[var(--accent-cyan)]/10' : 'text-gray-400 hover:text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/10'}`}
                            >
                                <ChevronDown className="w-3.5 h-3.5" />
                            </button>

                            {showTrackMenu && (
                                <div className="absolute top-full left-0 mt-1 w-72 bg-[#2c2c2e] border border-[var(--accent-cyan)]/50 rounded-lg shadow-[0_0_20px_var(--accent-cyan-glow)] z-[100] py-1 animate-in fade-in zoom-in-95 duration-100">
                                    <button
                                        className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-gray-200 hover:bg-sky-500 hover:text-white transition-colors flex items-center justify-between group"
                                        onClick={() => { toggleNewTrackDialog(true); setShowTrackMenu(false); }}
                                    >
                                        New Track...
                                        <span className="text-[9px] text-gray-500 group-hover:text-white/70">⌥⌘N</span>
                                    </button>
                                    <div className="h-px bg-white/5 my-1" />
                                    <button
                                        className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-gray-200 hover:bg-sky-500 hover:text-white transition-colors flex items-center justify-between group"
                                        onClick={() => {
                                            duplicateTracks('shared');
                                            setShowTrackMenu(false);
                                        }}
                                    >
                                        New Track with Same Channel Strip
                                        <span className="text-[9px] text-gray-500 group-hover:text-white/70">↩</span>
                                    </button>
                                    <button
                                        className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-gray-200 hover:bg-sky-500 hover:text-white transition-colors flex items-center justify-between group"
                                        onClick={() => {
                                            duplicateTracks('settings');
                                            setShowTrackMenu(false);
                                        }}
                                    >
                                        Duplicate Track (Settings Only)
                                        <span className="text-[9px] text-gray-500 group-hover:text-white/70">⌘D</span>
                                    </button>
                                    <button
                                        className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-gray-200 hover:bg-sky-500 hover:text-white transition-colors flex items-center justify-between group"
                                        onClick={() => {
                                            duplicateTracks('content');
                                            setShowTrackMenu(false);
                                        }}
                                    >
                                        Duplicate Track with Content
                                        <span className="text-[9px] text-gray-500 group-hover:text-white/70">⌥⇧⌘D</span>
                                    </button>
                                    <div className="h-px bg-white/5 my-1" />
                                    <button
                                        className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-gray-200 hover:bg-sky-500 hover:text-white transition-colors group"
                                        onClick={() => {
                                            createTrackForSelectedRegions();
                                            setShowTrackMenu(false);
                                        }}
                                    >
                                        New Track for Selected Regions
                                    </button>
                                    <button
                                        className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-gray-200 hover:bg-sky-500 hover:text-white transition-colors group"
                                        onClick={() => {
                                            if (focusedTrackId) {
                                                const t = tracks.find(track => track.id === focusedTrackId);
                                                if (t?.type === 'audio') toggleDrumReplacement(focusedTrackId);
                                            }
                                            setShowTrackMenu(false);
                                        }}
                                    >
                                        Replace or Double Drum Track...
                                    </button>
                                    <button
                                        className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-gray-200 hover:bg-sky-500 hover:text-white transition-colors flex items-center justify-between group"
                                        onClick={() => {
                                            resetAllTrackZoom();
                                            setShowTrackMenu(false);
                                        }}
                                    >
                                        Reset All Track Zooms
                                        <span className="text-[9px] text-gray-500 group-hover:text-white/70">⇧Z</span>
                                    </button>
                                    <div className="h-px bg-white/5 my-1" />
                                    <div className="px-3 py-1.5 text-[9px] font-black text-gray-500 uppercase tracking-widest">Sort Tracks By</div>
                                    <div className="grid grid-cols-2 gap-1 px-2 pb-2">
                                        {['Name', 'Type', 'Instrument', 'Output', 'MIDI'].map((by) => (
                                            <button
                                                key={by}
                                                className="px-2 py-1 bg-white/5 hover:bg-sky-500 rounded text-[10px] text-gray-400 hover:text-white transition-all text-left"
                                                onClick={() => {
                                                    sortTracks(by.toLowerCase() as any);
                                                    setShowTrackMenu(false);
                                                }}
                                            >
                                                {by}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="h-px bg-white/5 my-1" />
                                    <button
                                        className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-gray-200 hover:bg-sky-500 hover:text-white transition-colors flex items-center justify-between group"
                                        onClick={() => {
                                            toggleColorPalette(true);
                                            setShowTrackMenu(false);
                                        }}
                                    >
                                        Assign Track Color
                                        <span className="text-[9px] text-gray-500 group-hover:text-white/70">⌥C</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    <button className="p-1 hover:bg-[var(--accent-cyan)]/10 rounded-full transition-colors group outline-none" onClick={() => toggleColorPalette(true)}><Palette className="w-3.5 h-3.5 text-gray-500 group-hover:text-[var(--accent-cyan)]" /></button>
                    <button onClick={handleCreateStack} className="p-1 hover:bg-[var(--accent-cyan)]/10 rounded-full transition-colors group outline-none"><Layout className="w-3.5 h-3.5 text-gray-500 group-hover:text-[var(--accent-cyan)]" /></button>
                    <button
                        onClick={() => toggleHideView()}
                        className={`p-1 rounded-full transition-colors group outline-none ${hideViewActive ? 'bg-orange-500 text-black' : 'hover:bg-[var(--accent-cyan)]/10 text-gray-500 hover:text-[var(--accent-cyan)]'}`}
                        title="Hide View"
                    >
                        <span className="text-[10px] font-black w-3.5 h-3.5 flex items-center justify-center">H</span>
                    </button>
                    <button onClick={() => toggleTrackHeaderConfig(true)} className="p-1 hover:bg-[var(--accent-cyan)]/10 rounded-full transition-colors group outline-none"><Settings className="w-3.5 h-3.5 text-gray-500 group-hover:text-[var(--accent-cyan)]" /></button>
                </div>
            </div>

            {/* High-Fidelity Professional Track Column */}
            <div
                className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar-v relative"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragLeave={() => {
                    setDragPosition(null);
                    setDropTargetTrackId(null);
                }}
            >
                {tracks.filter(getIsTrackVisible).map((track, trackIdx) => {
                    const isSelected = selectedTrackIds.includes(track.id);
                    const isFocused = focusedTrackId === track.id;
                    const isFolder = track.isStack;
                    const currentHeight = trackHeight * (track.zoom || 1);

                    const handleTrackAction = (field: any, value: any, e: React.MouseEvent) => {
                        e.stopPropagation();

                        const applyToAll = () => {
                            if (field === 'protected' || field === 'frozen') {
                                tracks.forEach(t => updateTrackParameter(t.id, { [field]: value }));
                            } else if (field === 'hidden') {
                                tracks.forEach(t => setTrackHidden(t.id, value));
                            } else {
                                tracks.forEach(t => updateTrack(t.id, { [field]: value }));
                            }
                        };

                        const applyToSingle = () => {
                            if (field === 'protected' || field === 'frozen') {
                                updateTrackParameter(track.id, { [field]: value });
                            } else if (field === 'hidden') {
                                setTrackHidden(track.id, value);
                            } else {
                                updateTrack(track.id, { [field]: value });
                            }
                            handleSwipeStart(field, value);
                        };

                        // Logic-style modifier behavior for Solo/Mute/On/Off
                        if (field === 'soloed') {
                            if (e.altKey) {
                                // Option-click solo: isolate this track
                                tracks.forEach(t => updateTrack(t.id, { soloed: t.id === track.id }));
                                return;
                            }
                            if (e.metaKey || e.ctrlKey) {
                                // Command-click solo: toggle all solo states
                                const anySolo = tracks.some(t => t.soloed);
                                tracks.forEach(t => updateTrack(t.id, { soloed: !anySolo }));
                                return;
                            }
                        }

                        if (field === 'muted') {
                            if (e.altKey) {
                                // Option-click mute: mute this, others unmute
                                tracks.forEach(t => updateTrack(t.id, { muted: t.id === track.id }));
                                return;
                            }
                            if (e.metaKey || e.ctrlKey) {
                                // Command-click mute: toggle all tracks mute
                                const allMuted = tracks.every(t => t.muted);
                                tracks.forEach(t => updateTrack(t.id, { muted: !allMuted }));
                                return;
                            }
                        }

                        if (field === 'enabled') {
                            if (e.altKey) {
                                // Option-click On/Off: only this track toggles
                                tracks.forEach(t => updateTrack(t.id, { enabled: t.id === track.id ? value : true }));
                                return;
                            }
                            if (e.metaKey || e.ctrlKey) {
                                // Command-click On/Off: toggle all
                                const anyDisabled = tracks.some(t => !t.enabled);
                                tracks.forEach(t => updateTrack(t.id, { enabled: anyDisabled }));
                                return;
                            }
                        }

                        if (e.metaKey || e.ctrlKey) {
                            applyToAll();
                        } else {
                            applyToSingle();
                        }
                    };

                    return (
                        <div key={track.id} className="flex flex-col">
                            <div
                                draggable
                                onDragStart={(e) => {
                                    if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).tagName === 'INPUT') {
                                        e.preventDefault();
                                        return;
                                    }
                                    setDraggedTrackIndex(trackIdx);
                                    e.dataTransfer.effectAllowed = 'move';
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    if (draggedTrackIndex !== null && draggedTrackIndex !== trackIdx) {
                                        reorderTracks(draggedTrackIndex, trackIdx);
                                        setDraggedTrackIndex(trackIdx);
                                    }
                                    if (e.dataTransfer.types.includes('Files')) {
                                        setDropTargetTrackId(track.id);
                                    }
                                }}
                                onDragEnd={() => setDraggedTrackIndex(null)}
                                onMouseEnter={() => handleSwipeEnter(track.id)}
                                onClick={(e) => selectTrack(track.id, e.metaKey || e.ctrlKey, e.shiftKey)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setTrackContextMenu({ id: track.id, x: e.clientX, y: e.clientY });
                                    selectTrack(track.id);
                                }}
                                className={`track-row group relative border-b border-black/50 transition-all cursor-default flex ${isSelected ? 'bg-gradient-to-r from-sky-950/40 via-sky-900/40 to-black z-10 shadow-[inset_0_0_20px_rgba(14,165,233,0.1)] border-r-2 border-[var(--accent-cyan)]' : 'bg-[#111] hover:bg-[#161616]'} ${dropTargetTrackId === track.id ? 'ring-2 ring-inset ring-[var(--accent-cyan)] bg-sky-900/20' : ''} ${isFocused ? 'brightness-110 outline-none ring-1 ring-inset ring-[var(--accent-cyan)] shadow-[inset_0_0_10px_var(--accent-cyan-glow)]' : ''} ${draggedTrackIndex === trackIdx ? 'opacity-50 grayscale scale-[0.98]' : ''} ${recording && track.recordEnabled ? 'ring-inset ring-1 ring-red-500/60 shadow-[inset_0_0_15px_rgba(239,68,68,0.1)]' : ''}`}
                                style={{ height: `${currentHeight}px` }}
                            >
                                <div className="flex shrink-0 h-full overflow-hidden">
                                    {/* Groove Column */}
                                    <div className="w-8 h-full flex items-center justify-center bg-black/10 border-r border-white/5 relative group/groove">
                                        {!track.isGrooveTrack && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setGrooveTrack(track.id); }}
                                                className={`p-1.5 rounded transition-all ${hasGrooveTrack ? 'opacity-0 group-hover/groove:opacity-100' : 'opacity-0 group-hover/groove:opacity-100'}`}
                                            >
                                                <Star className="w-3.5 h-3.5 text-gray-700 hover:text-yellow-500" />
                                            </button>
                                        )}
                                        {track.isGrooveTrack && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setGrooveTrack(null); }}
                                                className="p-1.5 rounded"
                                            >
                                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                                            </button>
                                        )}
                                        {hasGrooveTrack && !track.isGrooveTrack && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); toggleMatchGroove(track.id); }}
                                                className={`absolute inset-0 flex items-center justify-center transition-opacity ${track.matchGrooveTrack ? 'opacity-100' : 'opacity-0 group-hover/groove:opacity-100'}`}
                                            >
                                                <div className={`w-3.5 h-3.5 rounded-sm border border-white/20 flex items-center justify-center transition-colors ${track.matchGrooveTrack ? 'bg-sky-500 border-sky-400' : 'bg-white/5 hover:bg-white/10'}`}>
                                                    {track.matchGrooveTrack && <div className="w-1.5 h-1.5 bg-white rounded-full bg-check" />}
                                                </div>
                                            </button>
                                        )}
                                    </div>

                                    {trackHeaderConfig.showColorBars && (
                                        <div className="w-[4px] h-full" style={{ backgroundColor: track.color }} />
                                    )}
                                    <div className="w-[3px] h-full bg-sky-500/20 shadow-[0_0_10px_rgba(14,165,233,0.3)]" /> {/* Control Surface Bar */}
                                    {trackHeaderConfig.showTrackNumbers && (
                                        <div className="w-7 h-full flex flex-col items-center justify-start pt-3 bg-black/20 border-r border-white/5">
                                            <span className="text-[9px] font-black text-gray-600 tracking-tighter">{tracks.findIndex(t => t.id === track.id) + 1}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 flex flex-col min-w-0 px-2 py-2 gap-1.5 relative overflow-hidden" 
                                     style={{ paddingLeft: track.parentId ? '36px' : '8px' }}>
                                    
                                    {/* Stack Bracket */}
                                    {track.parentId && (
                                        <div className="absolute left-[12px] top-0 bottom-0 w-[12px] border-l border-b border-[var(--accent-cyan)]/30 rounded-bl-lg pointer-events-none" />
                                    )}
                                    {/* Row 1: Icon and Name */}
                                    <div className="flex items-center gap-3 h-8">
                                        {track.isStack && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); toggleStackCollapse(track.id, e.altKey); }}
                                                className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-[var(--accent-cyan)] transition-colors"
                                            >
                                                {track.isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                            </button>
                                        )}
{trackHeaderConfig.showTrackIcons && (
                                            <div
                                                className="w-8 h-8 rounded bg-black/40 border border-[var(--accent-cyan)]/30 flex items-center justify-center shrink-0 hover:border-[var(--accent-cyan)] hover:shadow-[0_0_10px_var(--accent-cyan-glow)] transition-all cursor-pointer"
                                                onClick={(e) => { e.stopPropagation(); toggleIconBrowser(track.id); }}
                                            >
                                                <div className="flex items-center justify-center text-white/40 group-hover:text-white transition-colors">
                                                    {track.icon === 'mic' && <Mic className="w-5 h-5 shadow-2xl" />}
                                                    {track.icon === 'keyboard' && <Keyboard className="w-5 h-5 shadow-2xl" />}
                                                    {track.icon === 'drum' && <Drum className="w-5 h-5 shadow-2xl" />}
                                                    {track.icon === 'guitar' && <Guitar className="w-5 h-5 shadow-2xl" />}
                                                    {track.icon === 'midi' && <Music2 className="w-5 h-5 shadow-2xl" />}
                                                    {!track.icon && <Music className="w-5 h-5" />}
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex flex-col min-w-0 pr-2 flex-1">
                                            <div className="flex items-center justify-between gap-2 overflow-hidden">
                                                <span className={`text-[12px] font-black tracking-tighter truncate uppercase leading-tight ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                                                    {track.name}{track.alternatives?.length > 1 ? ` | ${track.alternatives.find(a => a.id === track.activeAlternativeId)?.name || ''}` : ''}
                                                </span>
                                                {trackHeaderConfig.showAlternatives && (
                                                    <div className="relative">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setOpenAltMenuId(openAltMenuId === track.id ? null : track.id); }}
                                                            className="flex items-center gap-0.5 px-1 py-0.5 bg-black/40 hover:bg-[var(--accent-cyan)]/10 rounded text-[8px] font-black text-gray-500 hover:text-[var(--accent-cyan)] transition-all"
                                                        >
                                                            {track.alternatives.find(a => a.id === track.activeAlternativeId)?.name} <ChevronDown className="w-2 h-2" />
                                                        </button>
                                                        {openAltMenuId === track.id && (
                                                            <div className="absolute top-full right-0 mt-1 w-40 bg-[#2c2c2e] border border-[var(--accent-cyan)]/30 rounded-lg shadow-[0_0_20px_var(--accent-cyan-glow)] z-[100] py-1">
                                                                <div className="px-3 py-1 text-[8px] font-black text-gray-500 uppercase">Alternatives</div>
                                                                {track.alternatives.map(alt => (
                                                                    <button
                                                                        key={alt.id}
                                                                        className={`w-full px-3 py-1.5 text-left text-[11px] font-bold flex items-center justify-between ${alt.id === track.activeAlternativeId ? 'text-[var(--accent-cyan)] bg-[var(--accent-cyan)]/10' : 'text-gray-300 hover:bg-[var(--accent-cyan)]/10 hover:text-[var(--accent-cyan)]'}`}
                                                                        onClick={() => { setActiveAlternative(track.id, alt.id); setOpenAltMenuId(null); }}
                                                                    >
                                                                        {alt.name}
                                                                        {alt.id === track.activeAlternativeId && <Check className="w-3 h-3 text-[var(--accent-cyan)]" />}
                                                                    </button>
                                                                ))}
                                                                <div className="h-px bg-white/5 my-1" />
                                                                <button className="w-full px-3 py-1.5 text-left text-[11px] font-bold text-gray-300 hover:bg-[var(--accent-cyan)]/10 hover:text-[var(--accent-cyan)] transition-colors" onClick={() => { addTrackAlternative(track.id); setOpenAltMenuId(null); }}>New</button>
                                                                <button className="w-full px-3 py-1.5 text-left text-[11px] font-bold text-gray-300 hover:bg-[var(--accent-cyan)]/10 hover:text-[var(--accent-cyan)] transition-colors" onClick={() => { addTrackAlternative(track.id, { duplicate: true }); setOpenAltMenuId(null); }}>Duplicate</button>
                                                                <button className="w-full px-3 py-1.5 text-left text-[11px] font-bold text-gray-300 hover:bg-[var(--accent-cyan)]/10 hover:text-[var(--accent-cyan)] transition-colors" onClick={() => { toggleInactiveAlternatives(track.id); setOpenAltMenuId(null); }}>
                                                                    {track.showInactiveAlternatives ? 'Hide Inactive' : 'Show Inactive'}
                                                                </button>
                                                                <button className="w-full px-3 py-1.5 text-left text-[11px] font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors" onClick={() => { deleteInactiveAlternatives(track.id); setOpenAltMenuId(null); }}>Delete Inactive</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {track.articulationSetId && (
                                                    <div 
                                                        className="flex items-center gap-1.5 bg-[var(--accent-cyan)]/10 border border-[var(--accent-cyan)]/30 rounded-full px-2 py-0.5 h-4.5 hover:bg-[var(--accent-cyan)]/20 hover:shadow-[0_0_10px_var(--accent-cyan-glow)] transition-all cursor-pointer group/art"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleArticulationEditor(true, track.articulationSetId);
                                                        }}
                                                    >
                                                        <Activity className="w-2.5 h-2.5 text-[var(--accent-cyan)] group-hover/art:scale-110 transition-transform" />
                                                        <span className="text-[8.5px] font-black text-[var(--accent-cyan)] uppercase tracking-tighter truncate max-w-[80px]">
                                                            {articulationSets.find(s => s.id === track.articulationSetId)?.articulations.find(a => a.id === track.currentArticulationId)?.name || 'Articulation'}
                                                        </span>
                                                        <ChevronDown className="w-2.5 h-2.5 text-[var(--accent-cyan)]/50" />
                                                    </div>
                                                )}
                                            </div>
                                            {trackHeaderConfig.showOnOff && (
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleTrackAction('enabled', !track.enabled, e);
                                                        }}
                                                        className={`w-3 h-3 rounded-full border border-black/40 flex items-center justify-center ${track.enabled ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-gray-800'}`}
                                                        title="Alt-click isolates track On, Cmd/Ctrl-click toggles all tracks"
                                                    />
                                                    <span className={`text-[8px] font-black uppercase ${track.enabled ? 'text-green-400' : 'text-gray-400'}`}>{track.enabled ? 'On' : 'Off'}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Row 2: MSRI Buttons and Controls */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="flex bg-black/40 rounded border border-white/10 p-0.5 shadow-inner">
                                            {trackHeaderConfig.showMute && (
                                                <button
                                                    onMouseDown={(e) => handleTrackAction('muted', !track.muted, e)}
                                                    className={`w-5 h-4 text-[9px] font-black rounded-[1px] transition-all ${track.muted ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-gray-500 hover:text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/10'}`}
                                                >M</button>
                                            )}
                                            {trackHeaderConfig.showSolo && (
                                                <button
                                                    onMouseDown={(e) => handleTrackAction('soloed', !track.soloed, e)}
                                                    className={`w-5 h-4 text-[9px] font-black rounded-[1px] transition-all ${track.soloed ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20' : 'text-gray-500 hover:text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/10'}`}
                                                >S</button>
                                            )}
                                            {trackHeaderConfig.showRecord && (
                                                <button
                                                    onMouseDown={(e) => handleTrackAction('recordEnabled', !track.recordEnabled, e)}
                                                    className={`w-5 h-4 text-[9px] font-black rounded-[1px] transition-all flex items-center justify-center 
                                                        ${track.recordEnabled ? (recording ? 'bg-red-500 animate-pulse text-white' : 'bg-red-500 text-white shadow-lg shadow-red-500/20') : 
                                                          (isFocused && !tracks.some(t => t.recordEnabled)) ? 'text-red-500' : 
                                                          'text-gray-500 hover:text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/10'}`}
                                                >R</button>
                                            )}
                                            {trackHeaderConfig.showInput && (
                                                <button
                                                    onMouseDown={(e) => handleTrackAction('inputMonitoring', !track.inputMonitoring, e)}
                                                    className={`w-5 h-4 text-[9px] font-black rounded-[1px] transition-all flex items-center justify-center ${track.inputMonitoring ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/20' : 'text-gray-500 hover:text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/10'}`}
                                                >I</button>
                                            )}
                                            {trackHeaderConfig.showProtect && (
                                                <button
                                                    onMouseDown={(e) => handleTrackAction('protected', !track.protected, e)}
                                                    className={`w-5 h-4 flex items-center justify-center transition-all ${track.protected ? 'text-green-500' : 'text-gray-500'} hover:text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/10`}
                                                ><Lock className="w-3 h-3" /></button>
                                            )}
                                            {trackHeaderConfig.showFreeze && (
                                                <button
                                                    onMouseDown={(e) => handleTrackAction('frozen', !track.frozen, e)}
                                                    className={`w-5 h-4 flex items-center justify-center transition-all ${track.frozen ? 'text-sky-400' : 'text-gray-500'} hover:text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/10`}
                                                ><Snowflake className="w-3 h-3" /></button>
                                            )}
                                            {trackHeaderConfig.showHide && (
                                                <button
                                                    onMouseDown={(e) => handleTrackAction('hidden', !track.hidden, e)}
                                                    className={`w-5 h-4 text-[9px] font-black rounded-[1px] transition-all ${track.hidden ? 'bg-[#ff9500] text-black shadow-lg shadow-orange-500/20' : 'text-gray-500 hover:text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/10'}`}
                                                >H</button>
                                            )}
                                        </div>

                                        {(trackHeaderConfig.showVolume || trackHeaderConfig.showPan) && (
                                            <div className="flex items-center gap-2 min-w-0">
                                                {trackHeaderConfig.showVolume && (
                                                    <div className="flex items-center gap-1 min-w-[80px]">
                                                        <div
                                                            className="h-4 flex-1 bg-black/60 rounded-full border border-[var(--accent-cyan)]/30 relative overflow-hidden group/vol cursor-pointer shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
                                                            onClick={(e) => e.stopPropagation()}
                                                            onMouseDown={(e) => {
                                                                if (e.altKey) {
                                                                    updateTrack(track.id, { volume: 0.8 });
                                                                    return;
                                                                }
                                                                const startX = e.clientX;
                                                                const startVol = track.volume || 0.8;
                                                                const move = (me: MouseEvent) => {
                                                                    const delta = (me.clientX - startX) / 100;
                                                                    updateTrack(track.id, { volume: Math.max(0, Math.min(1.5, startVol + delta)) });
                                                                };
                                                                const up = () => { 
                                                                    saveHistorySnapshot();
                                                                    window.removeEventListener('mousemove', move); 
                                                                    window.removeEventListener('mouseup', up); 
                                                                };
                                                                window.addEventListener('mousemove', move);
                                                                window.addEventListener('mouseup', up);
                                                            }}
                                                        >
                                                            <div className="absolute inset-0 z-0">
                                                                <HorizontalMeter 
                                                                    analyzer={audioEngine.getTrackNodes(track.id)?.analyzer || null} 
                                                                    backgroundColor="transparent"
                                                                    meterColor="rgba(34,197,94,0.3)"
                                                                    sensitivity={1.5}
                                                                />
                                                            </div>
                                                            <div
                                                                className="h-full bg-gradient-to-r from-green-600 to-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)] transition-all opacity-40 group-hover/vol:opacity-100 z-10"
                                                                style={{ width: `${((track.volume || 0.8) / 1.5) * 100}%` }}
                                                            />
                                                            <TrackLevelMeter 
                                                                trackId={track.id} 
                                                                isArmed={track.recordEnabled || track.inputMonitoring} 
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                                {trackHeaderConfig.showPan && (
                                                    <div
                                                        className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#111] to-[#2a2a2a] border border-[var(--accent-cyan)]/50 relative shadow-lg hover:border-[var(--accent-cyan)] hover:shadow-[0_0_10px_var(--accent-cyan-glow)] transition-all cursor-pointer group/pan"
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            if (e.altKey) {
                                                                updateTrack(track.id, { pan: 0 });
                                                                return;
                                                            }
                                                            const startY = e.clientY;
                                                            const startPan = track.pan || 0;
                                                            const move = (me: MouseEvent) => {
                                                                const delta = (startY - me.clientY) / 50;
                                                                updateTrack(track.id, { pan: Math.max(-1, Math.min(1, startPan + delta)) });
                                                            };
                                                            const up = () => { 
                                                                saveHistorySnapshot();
                                                                window.removeEventListener('mousemove', move); 
                                                                window.removeEventListener('mouseup', up); 
                                                            };
                                                            window.addEventListener('mousemove', move);
                                                            window.addEventListener('mouseup', up);
                                                        }}
                                                    >
                                                        <div
                                                            className="absolute top-0.5 left-1/2 -translate-x-1/2 w-[1.5px] h-2 bg-gray-500 rounded-full origin-bottom"
                                                            style={{ transform: `translateX(-50%) rotate(${(track.pan || 0) * 135}deg)` }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Drop Indicators */}
                                {dropTargetTrackId === track.id && (
                                    <div className="absolute inset-x-0 -top-px h-[2px] bg-[var(--accent-cyan)] z-50 shadow-[0_0_10px_var(--accent-cyan-glow-strong)]"></div>
                                )}

                                {/* Track Selection Halo */}
                                {isSelected && <div className={`absolute inset-y-0 left-0 w-[3px] shadow-[0_0_12px_var(--accent-cyan-glow)] z-50 ${isFocused ? 'bg-[var(--accent-cyan)]' : 'bg-[var(--accent-cyan)]/70'}`}></div>}

                                {/* Vertical Zoom Handle */}
                                <div
                                    className="absolute bottom-0 right-0 w-6 h-4 cursor-ns-resize z-50 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 border-l border-t border-[var(--accent-cyan)]/30 rounded-tl flex items-center justify-center"
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        setZoomDraggingTrackId(track.id);
                                    }}
                                >
                                    <GripVertical className="w-3 h-3 text-gray-500" />
                                </div>
                            </div>
                            {/* Inactive Alternative Headers */}
                            {track.showInactiveAlternatives && track.alternatives.filter(a => a.id !== track.activeAlternativeId).map(alt => (
                                <div key={alt.id} className="flex h-[30px] bg-black/40 border-b border-[var(--accent-cyan)]/10 group/altrow items-center px-4 gap-3">
                                    <div className="flex shrink-0 h-full">
                                        {trackHeaderConfig.showColorBars && (
                                            <div className="w-[4px] h-full" style={{ backgroundColor: track.color, opacity: 0.3 }} />
                                        )}
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteInactiveAlternatives(track.id); }}
                                        className="opacity-0 group-hover/altrow:opacity-100 text-gray-600 hover:text-red-500 transition-all"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                    <span className="text-[10px] font-black text-gray-500 uppercase flex-1">{alt.name}</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); swapWithActiveAlternative(track.id, alt.id); }}
                                        className="opacity-0 group-hover/altrow:opacity-100 text-gray-600 hover:text-[var(--accent-cyan)] transition-all p-1"
                                        title="Swap with active"
                                    >
                                        <ArrowUp className="w-3 h-3" />
                                    </button>
                                    <button className="text-gray-600 hover:text-[var(--accent-cyan)] transition-all p-1">
                                        <Power className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    );
                })}

                <div
                    className={`h-20 flex items-center justify-center border-t border-[var(--accent-cyan)]/20 opacity-0 hover:opacity-100 transition-all group/drop ${dropTargetTrackId === null && showCreateTrackUsing ? 'opacity-100 bg-[var(--accent-cyan)]/5' : ''}`}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDropTargetTrackId(null);
                        setDragPosition({ x: e.clientX, y: e.clientY });
                    }}
                >
                    <div className={`text-[10px] font-black text-gray-500 uppercase tracking-widest border border-dashed border-[var(--accent-cyan)]/30 px-4 py-2 rounded-lg group-hover/drop:border-[var(--accent-cyan)] group-hover/drop:text-[var(--accent-cyan)] transition-all ${dropTargetTrackId === null && showCreateTrackUsing ? 'border-[var(--accent-cyan)] text-[var(--accent-cyan)] scale-105 shadow-[0_0_20px_var(--accent-cyan-glow)]' : ''}`}>
                        {dropTargetTrackId === null && showCreateTrackUsing ? 'Create New Track at End' : 'Drop to Create Track'}
                    </div>
                </div>
            </div>

            {showCreateTrackUsing && <CreateNewTrackUsingDialog />}

{trackContextMenu && (
                <div
                    ref={contextMenuRef}
                    className="fixed w-64 bg-[#2c2c2e] border border-[var(--accent-cyan)]/30 rounded-lg shadow-[0_0_20px_var(--accent-cyan-glow)] z-[1000] py-1 animate-in fade-in zoom-in-95 duration-100"
                    style={{ left: trackContextMenu.x, top: trackContextMenu.y }}
                >
                    <div className="px-3 py-1.5 text-[9px] font-black text-gray-500 uppercase tracking-widest border-b border-[var(--accent-cyan)]/20 mb-1">Track Operations</div>
                    <button
                        className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-gray-200 hover:bg-[var(--accent-cyan)]/20 hover:text-[var(--accent-cyan)] transition-colors flex items-center justify-between group"
                        onClick={() => {
                            const t = tracks.find(track => track.id === trackContextMenu.id);
                            if (t) addTrack({ ...t, id: Date.now().toString(), name: `${t.name} copy`, orderIndex: t.orderIndex + 1 });
                            setTrackContextMenu(null);
                        }}
                    >
                        New Track with Same Settings
                    </button>
                    <button
                        className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-gray-200 hover:bg-sky-500 hover:text-white transition-colors flex items-center justify-between group"
                        onClick={() => {
                            duplicateTracks('content');
                            setTrackContextMenu(null);
                        }}
                    >
                        Duplicate Track
                    </button>
                    {(tracks.find(t => t.id === trackContextMenu.id)?.isStack || tracks.find(t => t.id === trackContextMenu.id)?.parentId) && (
                        <>
                            <div className="h-px bg-[var(--accent-cyan)]/10 my-1" />
                            <button
                                className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-gray-200 hover:bg-[var(--accent-cyan)]/20 hover:text-[var(--accent-cyan)] transition-colors flex items-center justify-between group"
                                onClick={() => {
                                    const t = tracks.find(track => track.id === trackContextMenu.id);
                                    if (t) flattenStack(t.isStack ? t.id : t.parentId!);
                                    setTrackContextMenu(null);
                                }}
                            >
                                Flatten Stack
                            </button>
                            {tracks.find(t => t.id === trackContextMenu.id)?.stackType === 'Folder' && (
                                <button
                                    className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-gray-200 hover:bg-[var(--accent-cyan)]/20 hover:text-[var(--accent-cyan)] transition-colors flex items-center justify-between group"
                                    onClick={() => {
                                        convertStackType(trackContextMenu.id, 'Summing');
                                        setTrackContextMenu(null);
                                    }}
                                >
                                    Convert to Summing Stack
                                </button>
                            )}
                        </>
                    )}
                    <div className="h-px bg-[var(--accent-cyan)]/10 my-1" />
                    {tracks.find(t => t.id === trackContextMenu.id)?.articulationSetId ? (
                        <button
                            className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-gray-200 hover:bg-[var(--accent-cyan)]/20 hover:text-[var(--accent-cyan)] transition-colors"
                            onClick={() => {
                                const t = tracks.find(track => track.id === trackContextMenu.id);
                                if (t?.articulationSetId) toggleArticulationEditor(true, t.articulationSetId);
                                setTrackContextMenu(null);
                            }}
                        >
                            Edit Articulation Set...
                        </button>
                    ) : (
                        <button
                            className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-gray-200 hover:bg-[var(--accent-cyan)]/20 hover:text-[var(--accent-cyan)] transition-colors"
                            onClick={() => {
                                addArticulationSet(trackContextMenu.id);
                                setTrackContextMenu(null);
                            }}
                        >
                            Add Articulation Set...
                        </button>
                    )}
                    <div className="h-px bg-[var(--accent-cyan)]/10 my-1" />
                    <button
                        className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-gray-200 hover:bg-[var(--accent-cyan)]/20 hover:text-[var(--accent-cyan)] transition-colors"
                        onClick={() => {
                            toggleBounceTrackDialog(trackContextMenu.id);
                            setTrackContextMenu(null);
                        }}
                    >
                        Bounce Track in Place...
                    </button>
                    {selectedClipIds.length > 0 && tracks.find(t => t.id === trackContextMenu.id)?.id === (clips.find((c: Clip) => c.id === selectedClipIds[0])?.trackId) && (
                        <button
                            className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-gray-200 hover:bg-[var(--accent-cyan)]/20 hover:text-[var(--accent-cyan)] transition-colors"
                            onClick={() => {
                                toggleBounceRegionsDialog(selectedClipIds);
                                setTrackContextMenu(null);
                            }}
                        >
                            Bounce Regions in Place...
                        </button>
                    )}
                    <div className="h-px bg-[var(--accent-cyan)]/10 my-1" />
                    <button
                        className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-red-500 hover:bg-red-500/20 hover:text-red-400 transition-colors flex items-center justify-between group"
                        onClick={() => {
                            const { deleteTrack } = useProjectStore.getState();
                            deleteTrack(trackContextMenu.id);
                            setTrackContextMenu(null);
                        }}
                    >
                        Delete Track
                        <span className="text-[9px] text-gray-500 group-hover:text-white/70">⌘⌫</span>
                    </button>
                    <div className="h-px bg-[var(--accent-cyan)]/10 my-1" />
                    <button
                        className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-gray-200 hover:bg-[var(--accent-cyan)]/20 hover:text-[var(--accent-cyan)] transition-colors flex items-center justify-between group"
                        onClick={() => {
                            toggleTrackHeaderConfig(true);
                            setTrackContextMenu(null);
                        }}
                    >
                        Configure Track Header...
                    </button>
                </div>
            )}
            <style jsx>{`
                .custom-scrollbar-v::-webkit-scrollbar { width: 4px; height: 4px; }
                .custom-scrollbar-v::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar-v::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
            `}</style>
        </div>
    )
}
