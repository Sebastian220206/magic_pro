"use client"
import { useState, useRef, useEffect, useCallback, useMemo } from "react"
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
import { neonTrackColor, neonTrackAlpha, neonTrackTextColor } from "@/lib/trackColor"
import { visibleTracks } from '@/lib/trackVisibility'
import { isMidiTrackType } from '@/lib/trackKinds'
import { playerForTrackType, PLAYER_LABEL } from "@/lib/sessionStyles"
export function TrackList() {
    const store = useProjectStore(useShallow(s => ({
        tracks: s.tracks, updateTrack: s.updateTrack, trackHeight: s.trackHeight,
        selectedTrackIds: s.selectedTrackIds, focusedTrackId: s.focusedTrackId,
        selectTrack: s.selectTrack, addTrack: s.addTrack,
        clips: s.clips, recording: s.recording,
        toggleNewTrackDialog: s.toggleNewTrackDialog,
        toggleCreateTrackUsing: s.toggleCreateTrackUsing,
        showCreateTrackUsing: s.showCreateTrackUsing,
        setDragPosition: s.setDragPosition,
        setDropTargetTrackId: s.setDropTargetTrackId,
        dropTargetTrackId: s.dropTargetTrackId,
        duplicateTracks: s.duplicateTracks,
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
        swapWithActiveAlternative: s.swapWithActiveAlternative,
        setActiveAlternative: s.setActiveAlternative,
        toggleInactiveAlternatives: s.toggleInactiveAlternatives,
        deleteInactiveAlternatives: s.deleteInactiveAlternatives,
        addTrackAlternative: s.addTrackAlternative,
        hideViewActive: s.hideViewActive,
        toggleHideView: s.toggleHideView,
        setTrackHidden: s.setTrackHidden,
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
        selectTrack, addTrack, clips, recording,
        toggleNewTrackDialog,
        toggleCreateTrackUsing,
        showCreateTrackUsing,
        setDragPosition,
        setDropTargetTrackId,
        dropTargetTrackId,
        duplicateTracks,
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
        swapWithActiveAlternative, setActiveAlternative, toggleInactiveAlternatives, deleteInactiveAlternatives, addTrackAlternative,
        hideViewActive,
        toggleHideView,
        setTrackHidden,
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

    /*
     * Shared with the Timeline.
     *
     * This test lived only here, and the lanes rendered `tracks.map` with no
     * test at all — so hiding a track, or collapsing a stack, left every header
     * below it pointing at the wrong track's clips.
     */
    const rows = visibleTracks(tracks, hideViewActive);

    /*
     * Track number by id, built once.
     *
     * The badge used `tracks.findIndex(...)` inside the row map — O(n) per row,
     * O(n²) down the column. The absolute index is deliberate: hiding a track
     * should not renumber the ones below it.
     */
    const trackIndexById = useMemo(
        () => new Map(tracks.map((t, i) => [t.id, i])),
        [tracks],
    );

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
                /*
                 * By id, not by index.
                 *
                 * This took an unfiltered `findIndex` into a *filtered* list of
                 * `.track-row` nodes, so with anything hidden or collapsed it
                 * measured against a different track's row and resized the
                 * wrong one.
                 */
                // A distinct attribute: the M/S/R/I pills already carry
                // `data-track-id`, and querySelector takes the first match.
                const trackElem = document.querySelector(
                    `[data-track-row="${zoomDraggingTrackId}"]`);
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
            /*
                No cyan edge.

                A full-height accent border plus a cyan glow drew a neon line
                down the middle of the arrangement, cutting the header column
                off from the lanes it names. The black depth shadow already
                separates them, and each track's card carries its own border —
                the line was doing the job twice, in the loudest colour
                available.
            */
            className="bg-studio-sunken flex flex-col z-20 shrink-0 select-none shadow-[20px_0_40px_rgba(0,0,0,0.5)] relative group"
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
            {/* Logic Pro Signature Tracks Header Bar */}
            <div className="h-[36px] border-b border-[#18191a] bg-[#262729] flex items-center px-3 justify-between shrink-0 sticky top-0 z-30">
                <div className="flex items-center gap-1.5">
                    <div className="flex bg-[#1c1d1f] rounded-[3px] border border-white/10 p-0.5 h-6">
                        <button onClick={(e) => handleAddTrack(e)} className="w-6 h-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all outline-none rounded-[2px]" title="New Track..."><Plus className="w-3.5 h-3.5" /></button>
                        <div className="w-px h-full bg-white/10"></div>
                        <button onClick={(e) => handleDuplicateTrack(e)} className="w-6 h-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all outline-none rounded-[2px]" title="Duplicate Track"><Copy className="w-3 h-3" /></button>
                        <div className="w-px h-full bg-white/10"></div>
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setShowTrackMenu(!showTrackMenu)}
                                className={`w-6 h-full flex items-center justify-center transition-all outline-none rounded-[2px] ${showTrackMenu ? 'text-white bg-white/20' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                            >
                                <ChevronDown className="w-3 h-3" />
                            </button>

                            {showTrackMenu && (
                                <div className="absolute top-full left-0 mt-1 w-64 bg-[#252628] border border-[#38393c] rounded-md shadow-2xl z-[100] py-1 text-white">
                                    <button
                                        className="w-full px-3 py-1.5 text-left text-[11px] font-medium text-white/90 hover:bg-[#35373a] hover:text-white transition-colors flex items-center justify-between"
                                        onClick={() => { toggleNewTrackDialog(true); setShowTrackMenu(false); }}
                                    >
                                        New Track...
                                        <span className="text-[9px] text-white/40">⌥⌘N</span>
                                    </button>
                                    <div className="h-px bg-white/10 my-1" />
                                    <button
                                        className="w-full px-3 py-1.5 text-left text-[11px] font-medium text-white/90 hover:bg-[#35373a] hover:text-white transition-colors flex items-center justify-between"
                                        onClick={() => {
                                            duplicateTracks('shared');
                                            setShowTrackMenu(false);
                                        }}
                                    >
                                        New Track with Same Channel Strip
                                        <span className="text-[9px] text-white/40">↩</span>
                                    </button>
                                    <button
                                        className="w-full px-3 py-1.5 text-left text-[11px] font-medium text-white/90 hover:bg-[#35373a] hover:text-white transition-colors flex items-center justify-between"
                                        onClick={() => {
                                            duplicateTracks('settings');
                                            setShowTrackMenu(false);
                                        }}
                                    >
                                        Duplicate Track (Settings Only)
                                        <span className="text-[9px] text-white/40">⌘D</span>
                                    </button>
                                    <button
                                        className="w-full px-3 py-1.5 text-left text-[11px] font-medium text-white/90 hover:bg-[#35373a] hover:text-white transition-colors flex items-center justify-between"
                                        onClick={() => {
                                            duplicateTracks('content');
                                            setShowTrackMenu(false);
                                        }}
                                    >
                                        Duplicate Track with Content
                                        <span className="text-[9px] text-white/40">⌥⇧⌘D</span>
                                    </button>
                                    <div className="h-px bg-white/10 my-1" />
                                    <button
                                        className="w-full px-3 py-1.5 text-left text-[11px] font-medium text-white/90 hover:bg-[#35373a] hover:text-white transition-colors"
                                        onClick={() => {
                                            createTrackForSelectedRegions();
                                            setShowTrackMenu(false);
                                        }}
                                    >
                                        New Track for Selected Regions
                                    </button>
                                    <button
                                        className="w-full px-3 py-1.5 text-left text-[11px] font-medium text-white/90 hover:bg-[#35373a] hover:text-white transition-colors"
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
                                        className="w-full px-3 py-1.5 text-left text-[11px] font-medium text-white/90 hover:bg-[#35373a] hover:text-white transition-colors flex items-center justify-between"
                                        onClick={() => {
                                            resetAllTrackZoom();
                                            setShowTrackMenu(false);
                                        }}
                                    >
                                        Reset All Track Zooms
                                        <span className="text-[9px] text-white/40">⇧Z</span>
                                    </button>
                                    <div className="h-px bg-white/10 my-1" />
                                    <button
                                        className="w-full px-3 py-1.5 text-left text-[11px] font-medium text-white/90 hover:bg-[#35373a] hover:text-white transition-colors flex items-center justify-between"
                                        onClick={() => {
                                            toggleColorPalette(true);
                                            setShowTrackMenu(false);
                                        }}
                                    >
                                        Assign Track Color
                                        <span className="text-[9px] text-white/40">⌥C</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <button className="p-1 hover:bg-white/10 rounded-[3px] text-white/60 hover:text-white transition-colors outline-none" onClick={() => toggleColorPalette(true)}><Palette className="w-3.5 h-3.5" /></button>
                    <button onClick={handleCreateStack} className="p-1 hover:bg-white/10 rounded-[3px] text-white/60 hover:text-white transition-colors outline-none"><Layout className="w-3.5 h-3.5" /></button>
                    <button
                        onClick={() => toggleHideView()}
                        className={`px-1.5 py-0.5 rounded-[3px] transition-colors outline-none text-[10px] font-bold ${hideViewActive ? 'bg-[#bc6718] text-white' : 'hover:bg-white/10 text-white/60 hover:text-white'}`}
                        title="Hide View"
                    >
                        H
                    </button>
                    <button onClick={() => toggleTrackHeaderConfig(true)} className="p-1 hover:bg-white/10 rounded-[3px] text-white/60 hover:text-white transition-colors outline-none"><Settings className="w-3.5 h-3.5" /></button>
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
                {rows.map((track, trackIdx) => {
                    const isSelected = selectedTrackIds.includes(track.id);
                    const isFocused = focusedTrackId === track.id;
                    const isFolder = track.isStack;
                    const currentHeight = trackHeight * (track.zoom || 1);
                    /*
                     * `showColorBars` now means something.
                     *
                     * A 4px stripe beside a card already in the track's colour
                     * would be redundant, so the flag governs whether the card,
                     * the badge and the pills carry the hue at all. Off gives a
                     * neutral panel — the flag keeps a visible consequence
                     * rather than being deleted for having nothing to gate.
                     */
                    const tinted = trackHeaderConfig.showColorBars;

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
                                data-track-row={track.id}
                                /*
                                    The row keeps the height; the card inside it
                                    carries the look.

                                    The 6px gutter between two cards is 3px of
                                    padding from each row's own box, so
                                    `trackHeight * (track.zoom || 1)` is
                                    untouched and the lanes still line up
                                    exactly. `onMouseEnter` stays on this
                                    element, not the card, so the swipe-paint
                                    gesture keeps firing while the pointer
                                    crosses the gap.

                                    Three of the old classes here were
                                    `from-accent-cyan/20/40`-style double
                                    opacity modifiers, which Tailwind cannot
                                    compile — so a selected row rendered
                                    transparent-to-black and selection made it
                                    *darker*.
                                */
                                className={`track-row group relative cursor-default flex border-b border-[#1b1c1e] ${draggedTrackIndex === trackIdx ? 'opacity-50 grayscale scale-[0.98]' : ''}`}
                                style={{ height: `${currentHeight}px` }}
                            >
                                <div
                                    data-track-card
                                    className="relative flex h-full w-full overflow-hidden transition-colors"
                                    style={{
                                        backgroundColor: isSelected
                                            ? '#36383b'
                                            : isFocused
                                                ? '#2c2d30'
                                                : trackIdx % 2 === 0
                                                    ? '#242527'
                                                    : '#212224',
                                        boxShadow: isSelected
                                            ? 'inset 0 0 0 1px #4e5054, inset 0 1px 0 rgba(255,255,255,0.08)'
                                            : undefined,
                                    }}
                                >
                                {trackHeaderConfig.showColorBars && (
                                    <div
                                        className="w-[4px] shrink-0 h-full"
                                        style={{ backgroundColor: track.color || '#2ca05a' }}
                                    />
                                )}
                                {/*
                                    The number badge, in its own panel.

                                    A permanent 32px groove column and an
                                    ungated 3px "Control Surface Bar" — the
                                    latter with no state, no flag and no
                                    handler — used to sit in front of this. The
                                    star moved into the card as a hover control;
                                    the decorative bar is gone.
                                */}
                                {trackHeaderConfig.showTrackNumbers && (
                                    <div
                                        className="w-7 shrink-0 h-full flex items-center justify-center bg-black/20 border-r border-[#1c1d1f]"
                                    >
                                        <span
                                            data-track-number
                                            className="text-[12px] font-bold leading-none tabular-nums text-white/50"
                                        >
                                            {String((trackIndexById.get(track.id) ?? 0) + 1)}
                                        </span>
                                    </div>
                                )}

                                 {/*
                                     Two rows, not three.
                                 */}
                                 <div className="flex-1 flex flex-col min-w-0 justify-center px-2 py-1.5 gap-1.5 relative overflow-hidden" 
                                      style={{ paddingLeft: track.parentId ? '28px' : '8px' }}>
                                     
                                     {/* Stack Bracket */}
                                     {track.parentId && (
                                         <div className="absolute left-[10px] top-0 bottom-0 w-[10px] border-l border-b border-white/20 rounded-bl-sm pointer-events-none" />
                                     )}
                                     {/* Row 1: Icon and Name */}
                                     <div className="flex items-center gap-2 h-7 shrink-0">
                                         {track.isStack && (
                                             <button 
                                                 onClick={(e) => { e.stopPropagation(); toggleStackCollapse(track.id, e.altKey); }}
                                                 className="w-4 h-4 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                                             >
                                                 {track.isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                             </button>
                                         )}
                                         {trackHeaderConfig.showTrackIcons && (
                                             <div
                                                 className="w-6 h-6 rounded bg-black/30 border border-white/10 flex items-center justify-center shrink-0 hover:border-white/30 transition-all cursor-pointer"
                                                 onClick={(e) => { e.stopPropagation(); toggleIconBrowser(track.id); }}
                                             >
                                                 <div className="flex items-center justify-center text-white/60 group-hover:text-white transition-colors">
                                                     {track.icon === 'mic' && <Mic className="w-3.5 h-3.5" />}
                                                     {track.icon === 'keyboard' && <Keyboard className="w-3.5 h-3.5" />}
                                                     {track.icon === 'drum' && <Drum className="w-3.5 h-3.5" />}
                                                     {track.icon === 'guitar' && <Guitar className="w-3.5 h-3.5" />}
                                                     {track.icon === 'midi' && <Music2 className="w-3.5 h-3.5" />}
                                                     {!track.icon && <Music className="w-3.5 h-3.5" />}
                                                 </div>
                                             </div>
                                         )}
                                         <div className="flex flex-col min-w-0 pr-2 flex-1">
                                             <div className="flex items-center justify-between gap-2 overflow-hidden">
                                                 <span data-track-name className={`text-[13px] font-semibold tracking-tight truncate leading-tight ${isSelected ? 'text-white' : 'text-[#d6d8db]'}`}>
                                                     {track.name}{track.alternatives?.length > 1 ? ` | ${track.alternatives.find(a => a.id === track.activeAlternativeId)?.name || ''}` : ''}
                                                 </span>
                                                 {trackHeaderConfig.showAlternatives && (
                                                     <div className="relative">
                                                         <button
                                                             onClick={(e) => { e.stopPropagation(); setOpenAltMenuId(openAltMenuId === track.id ? null : track.id); }}
                                                             className="flex items-center gap-0.5 px-1 py-0.5 bg-[#18191b] hover:bg-[#28292c] border border-white/10 rounded-[2px] text-[8px] font-bold text-white/60 hover:text-white transition-all"
                                                         >
                                                             {track.alternatives.find(a => a.id === track.activeAlternativeId)?.name} <ChevronDown className="w-2 h-2" />
                                                         </button>
                                                         {openAltMenuId === track.id && (
                                                             <div className="absolute top-full right-0 mt-1 w-40 bg-[#252628] border border-[#38393c] rounded shadow-xl z-[100] py-1">
                                                                 <div className="px-3 py-1 text-[8px] font-bold text-white/40 uppercase">Alternatives</div>
                                                                 {track.alternatives.map(alt => (
                                                                     <button
                                                                         key={alt.id}
                                                                         className={`w-full px-3 py-1 text-left text-[11px] font-medium flex items-center justify-between ${alt.id === track.activeAlternativeId ? 'text-white bg-[#35373a]' : 'text-white/80 hover:bg-[#313235]'}`}
                                                                         onClick={() => { setActiveAlternative(track.id, alt.id); setOpenAltMenuId(null); }}
                                                                     >
                                                                         {alt.name}
                                                                         {alt.id === track.activeAlternativeId && <Check className="w-3 h-3 text-white" />}
                                                                     </button>
                                                                 ))}
                                                             </div>
                                                         )}
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
                                                         className={`w-2.5 h-2.5 rounded-full border border-black/50 flex items-center justify-center ${track.enabled ? 'bg-[#2ca05a] shadow-[0_0_6px_rgba(44,160,90,0.6)]' : 'bg-[#18191b]'}`}
                                                         title="Alt-click isolates track On, Cmd/Ctrl-click toggles all tracks"
                                                     />
                                                     <span className={`text-[8px] font-bold uppercase ${track.enabled ? 'text-[#2ca05a]' : 'text-white/30'}`}>{track.enabled ? 'On' : 'Off'}</span>
                                                 </div>
                                             )}
                                         </div>
                                     </div>

                                    {/* Row 2: MSRI Buttons and Controls */}
                                    <div className="flex items-center gap-2 flex-nowrap min-w-0 shrink-0">
                                        <div className="flex items-center gap-1">
                                            {trackHeaderConfig.showMute && (
                                                <button
                                                    onMouseDown={(e) => handleTrackAction('muted', !track.muted, e)}
                                                    data-track-action="muted"
                                                    data-track-id={track.id}
                                                    aria-pressed={!!track.muted}
                                                    aria-label={`Mute ${track.name}`}
                                                    title="Alt-click isolates, Cmd/Ctrl-click applies to every track"
                                                    className="h-[19px] min-w-[26px] px-2 rounded-[3px] text-[10px] font-bold leading-none flex items-center justify-center border transition-colors shadow-sm"
                                                    style={track.muted
                                                        ? { backgroundColor: '#b58c2b', color: '#000000', borderColor: '#d8aa38' }
                                                        : { backgroundColor: '#202123', color: '#8b8e93', borderColor: 'rgba(255,255,255,0.1)' }}
                                                >M</button>
                                            )}
                                            {trackHeaderConfig.showSolo && (
                                                 <button
                                                     onMouseDown={(e) => handleTrackAction('soloed', !track.soloed, e)}
                                                     data-track-action="soloed"
                                                     data-track-id={track.id}
                                                     aria-pressed={!!track.soloed}
                                                     aria-label={`Solo ${track.name}`}
                                                     title="Alt-click isolates, Cmd/Ctrl-click applies to every track"
                                                     className="h-[19px] min-w-[26px] px-2 rounded-[3px] text-[10px] font-bold leading-none flex items-center justify-center border transition-colors shadow-sm"
                                                     style={track.soloed
                                                         ? { backgroundColor: '#bc6718', color: '#ffffff', borderColor: '#e58529' }
                                                         : { backgroundColor: '#202123', color: '#8b8e93', borderColor: 'rgba(255,255,255,0.1)' }}
                                                >S</button>
                                            )}
                                            {trackHeaderConfig.showRecord && (
                                                 <button
                                                     onMouseDown={(e) => handleTrackAction('recordEnabled', !track.recordEnabled, e)}
                                                     data-track-action="recordEnabled"
                                                     data-track-id={track.id}
                                                     aria-pressed={!!track.recordEnabled}
                                                     aria-label={`Record enable ${track.name}`}
                                                     title="Record Enable — opens this track's input"
                                                     className={`h-[19px] min-w-[26px] px-2 rounded-[3px] text-[10px] font-bold leading-none flex items-center justify-center border transition-colors shadow-sm ${track.recordEnabled && recording ? 'animate-pulse' : ''}`}
                                                     style={track.recordEnabled
                                                         ? { backgroundColor: '#d32f2f', color: '#ffffff', borderColor: '#ef5350' }
                                                         : (isFocused && !tracks.some(t => t.recordEnabled))
                                                             ? { backgroundColor: 'rgba(211,47,47,0.15)', color: '#ef5350', borderColor: 'rgba(211,47,47,0.5)' }
                                                             : { backgroundColor: '#202123', color: '#8b8e93', borderColor: 'rgba(255,255,255,0.1)' }}
                                                 >R</button>
                                            )}
                                            {trackHeaderConfig.showInput && (
                                                <button
                                                    onMouseDown={(e) => handleTrackAction('inputMonitoring', !track.inputMonitoring, e)}
                                                    data-track-action="inputMonitoring"
                                                    data-track-id={track.id}
                                                    aria-pressed={!!track.inputMonitoring}
                                                    aria-label={`Input monitoring ${track.name}`}
                                                    title="Alt-click isolates, Cmd/Ctrl-click applies to every track"
                                                    className="h-[19px] min-w-[26px] px-2 rounded-full text-[10px] font-bold leading-none flex items-center justify-center border transition-colors"
                                                    style={track.inputMonitoring
                                                        ? { backgroundColor: '#fb923c', color: '#05080c', borderColor: 'transparent' }
                                                        : { backgroundColor: tinted ? neonTrackAlpha(track.color, 0.16) : 'rgba(255,255,255,0.06)', color: tinted ? neonTrackTextColor(track.color) : 'rgba(255,255,255,0.55)', borderColor: tinted ? neonTrackAlpha(track.color, 0.35) : 'rgba(255,255,255,0.12)' }}
                                                >I</button>
                                            )}
                                            {trackHeaderConfig.showProtect && (
                                                <button
                                                    onMouseDown={(e) => handleTrackAction('protected', !track.protected, e)}
                                                    className={`w-5 h-4 flex items-center justify-center transition-all ${track.protected ? 'text-green-500' : 'text-studio-text-dim'} hover:text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/10`}
                                                ><Lock className="w-3 h-3" /></button>
                                            )}
                                            {trackHeaderConfig.showFreeze && (
                                                <button
                                                    onMouseDown={(e) => handleTrackAction('frozen', !track.frozen, e)}
                                                    className={`w-5 h-4 flex items-center justify-center transition-all ${track.frozen ? 'text-accent-cyan' : 'text-studio-text-dim'} hover:text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/10`}
                                                ><Snowflake className="w-3 h-3" /></button>
                                            )}
                                            {trackHeaderConfig.showHide && (
                                                <button
                                                    onMouseDown={(e) => handleTrackAction('hidden', !track.hidden, e)}
                                                    data-track-action="hidden"
                                                    data-track-id={track.id}
                                                    aria-pressed={!!track.hidden}
                                                    aria-label={`Hide ${track.name}`}
                                                    title="Alt-click isolates, Cmd/Ctrl-click applies to every track"
                                                    className="h-[19px] min-w-[26px] px-2 rounded-full text-[10px] font-bold leading-none flex items-center justify-center border transition-colors"
                                                    style={track.hidden
                                                        ? { backgroundColor: '#ff9500', color: '#05080c', borderColor: 'transparent' }
                                                        : { backgroundColor: tinted ? neonTrackAlpha(track.color, 0.16) : 'rgba(255,255,255,0.06)', color: tinted ? neonTrackTextColor(track.color) : 'rgba(255,255,255,0.55)', borderColor: tinted ? neonTrackAlpha(track.color, 0.35) : 'rgba(255,255,255,0.12)' }}
                                                >H</button>
                                            )}
                                        </div>
                                        {(trackHeaderConfig.showVolume || trackHeaderConfig.showPan) && (
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                {trackHeaderConfig.showVolume && (
                                                    <div className="flex items-center gap-1.5 flex-1 min-w-[60px]">
                                                        <div
                                                            className="h-[14px] flex-1 bg-[#141517] rounded-[2px] border border-[#2b2c2f] relative overflow-hidden group/vol cursor-pointer shadow-inner"
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
                                                                    meterColor="rgba(44,160,90,0.4)"
                                                                    sensitivity={1.5}
                                                                />
                                                            </div>
                                                            <div
                                                                className="h-full bg-gradient-to-r from-[#20663a] to-[#2ca05a] border-r border-white/40 shadow-sm transition-all z-10"
                                                                style={{ width: `${((track.volume || 0.8) / 1.5) * 100}%` }}
                                                            />
                                                            <TrackLevelMeter 
                                                                trackId={track.id} 
                                                                isArmed={track.recordEnabled || track.inputMonitoring} 
                                                            />
                                                        </div>
                                                        <span className="text-[9px] font-bold text-white/50 tabular-nums shrink-0 w-7 text-right">
                                                            {track.volume !== undefined ? `${(20 * Math.log10(Math.max(0.001, track.volume))).toFixed(0)}dB` : '0dB'}
                                                        </span>
                                                    </div>
                                                )}
                                                {trackHeaderConfig.showPan && (
                                                    <div
                                                        className="w-[18px] h-[18px] rounded-full bg-[#1e1f21] border border-[#383a3d] relative shadow-inner hover:border-white/40 transition-all cursor-pointer group/pan shrink-0 flex items-center justify-center"
                                                        title="Pan"
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
                                                            className="w-[1.5px] h-2 bg-white/90 rounded-full origin-bottom"
                                                            style={{ transform: `rotate(${(track.pan || 0) * 135}deg)` }}
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

                                {/*
                                    The 3px selection halo is gone. It sat at
                                    `left-0` over the groove column, so
                                    focus-versus-selection was a 30% opacity
                                    difference on a bar behind a star button.
                                    The card's own border and glow carry it now.
                                */}

                                {/*
                                    The groove star.

                                    It had a permanent 32px column of its own,
                                    which cost a ninth of a 280px header for a
                                    control that was already hover-only. Its
                                    match-groove checkbox was `absolute inset-0`
                                    — inside a card that would have swallowed
                                    every click, so it is bounded now.
                                */}
                                <div className="absolute top-1 right-1 z-40 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                    {hasGrooveTrack && !track.isGrooveTrack && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleMatchGroove(track.id); }}
                                            title="Match this track to the groove track"
                                            aria-label={`Match groove for ${track.name}`}
                                            className="w-3.5 h-3.5 rounded-sm border border-white/20 flex items-center justify-center transition-colors"
                                            style={track.matchGrooveTrack
                                                ? { backgroundColor: 'var(--accent-cyan)', borderColor: 'var(--accent-cyan)' }
                                                : { backgroundColor: 'rgba(255,255,255,0.06)' }}
                                        >
                                            {track.matchGrooveTrack && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setGrooveTrack(track.isGrooveTrack ? null : track.id); }}
                                        title={track.isGrooveTrack ? 'Stop using this as the groove track' : 'Use as the groove track'}
                                        aria-label={`Groove track: ${track.name}`}
                                        className="p-0.5 rounded"
                                    >
                                        <Star className={`w-3.5 h-3.5 ${track.isGrooveTrack ? 'text-yellow-500 fill-yellow-500' : 'text-studio-text-dim hover:text-yellow-500'}`} />
                                    </button>
                                </div>

                                {/* Vertical Zoom Handle */}
                                <div
                                    className="absolute bottom-0 right-0 w-6 h-4 cursor-ns-resize z-50 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 border-l border-t border-[var(--accent-cyan)]/30 rounded-tl flex items-center justify-center"
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        setZoomDraggingTrackId(track.id);
                                    }}
                                >
                                    <GripVertical className="w-3 h-3 text-studio-text-dim" />
                                </div>
                                </div>
                            </div>
                            {/* Inactive Alternative Headers */}
                            {track.showInactiveAlternatives && track.alternatives.filter(a => a.id !== track.activeAlternativeId).map(alt => (
                                <div key={alt.id} className="flex h-[30px] bg-black/40 border-b border-[var(--accent-cyan)]/10 group/altrow items-center px-4 gap-3">
                                    <div className="flex shrink-0 h-full">
                                        {trackHeaderConfig.showColorBars && (
                                            <div className="w-[4px] h-full" style={{ backgroundColor: neonTrackColor(track.color), opacity: 0.3 }} />
                                        )}
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteInactiveAlternatives(track.id); }}
                                        className="opacity-0 group-hover/altrow:opacity-100 text-studio-text-dim hover:text-red-500 transition-all"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                    <span className="text-[10px] font-black text-studio-text-dim uppercase flex-1">{alt.name}</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); swapWithActiveAlternative(track.id, alt.id); }}
                                        className="opacity-0 group-hover/altrow:opacity-100 text-studio-text-dim hover:text-[var(--accent-cyan)] transition-all p-1"
                                        title="Swap with active"
                                    >
                                        <ArrowUp className="w-3 h-3" />
                                    </button>
                                    {/*
                                        A <Power> button with no onClick used to
                                        sit here — it hovered and did nothing.
                                    */}
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
                    <div className={`text-[10px] font-black text-studio-text-dim uppercase tracking-widest border border-dashed border-[var(--accent-cyan)]/30 px-4 py-2 rounded-lg group-hover/drop:border-[var(--accent-cyan)] group-hover/drop:text-[var(--accent-cyan)] transition-all ${dropTargetTrackId === null && showCreateTrackUsing ? 'border-[var(--accent-cyan)] text-[var(--accent-cyan)] scale-105 shadow-[0_0_20px_var(--accent-cyan-glow)]' : ''}`}>
                        {dropTargetTrackId === null && showCreateTrackUsing ? 'Create New Track at End' : 'Drop to Create Track'}
                    </div>
                </div>
            </div>

            {showCreateTrackUsing && <CreateNewTrackUsingDialog />}

{trackContextMenu && (
                <div
                    ref={contextMenuRef}
                    className="fixed w-64 bg-studio-control border border-[var(--accent-cyan)]/30 rounded-lg shadow-[0_0_20px_var(--accent-cyan-glow)] z-[1000] py-1 animate-in fade-in zoom-in-95 duration-100"
                    style={{ left: trackContextMenu.x, top: trackContextMenu.y }}
                >
                    <div className="px-3 py-1.5 text-[9px] font-black text-studio-text-dim uppercase tracking-widest border-b border-[var(--accent-cyan)]/20 mb-1">Track Operations</div>
                    {(() => {
                        const targetTrack = tracks.find(track => track.id === trackContextMenu.id);
                        if (!targetTrack || !isMidiTrackType(targetTrack.type)) return null;
                        return (
                            <button
                                className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-accent-cyan hover:bg-accent-cyan/20 transition-colors flex items-center justify-between group"
                                onClick={() => {
                                    const storeState = useProjectStore.getState();
                                    const beatsPerBar = Number(storeState.timeSignature?.split('/')[0]) || 4;
                                    const bars = Math.max(1, Math.round(4 / beatsPerBar)) * beatsPerBar;
                                    const player = playerForTrackType(targetTrack.type);
                                    const duration = player ? beatsPerBar * 4 : bars;
                                    const clipId = `clip-${Date.now()}`;
                                    storeState.addClip({
                                        id: clipId,
                                        trackId: targetTrack.id,
                                        name: player ? PLAYER_LABEL[player] : 'MIDI Region',
                                        start: storeState.playhead || 0,
                                        startBeat: storeState.playhead || 0,
                                        startTime: 0,
                                        duration,
                                        durationBeats: duration,
                                        type: 'midi',
                                        color: targetTrack.color || '#63ed63',
                                        alternativeId: targetTrack.activeAlternativeId,
                                    } as any);
                                    storeState.selectClip(clipId);
                                    storeState.selectClips([clipId]);
                                    if (!storeState.showEditors) {
                                        storeState.toggleEditors();
                                    }
                                    setTrackContextMenu(null);
                                }}
                            >
                                Create MIDI Region at Playhead
                            </button>
                        );
                    })()}
                    <button
                        className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-studio-text hover:bg-[var(--accent-cyan)]/20 hover:text-[var(--accent-cyan)] transition-colors flex items-center justify-between group"
                        onClick={() => {
                            const t = tracks.find(track => track.id === trackContextMenu.id);
                            if (t) addTrack({ ...t, id: Date.now().toString(), name: `${t.name} copy`, orderIndex: t.orderIndex + 1 });
                            setTrackContextMenu(null);
                        }}
                    >
                        New Track with Same Settings
                    </button>
                    <button
                        className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-studio-text hover:bg-accent-cyan hover:text-white transition-colors flex items-center justify-between group"
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
                                className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-studio-text hover:bg-[var(--accent-cyan)]/20 hover:text-[var(--accent-cyan)] transition-colors flex items-center justify-between group"
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
                                    className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-studio-text hover:bg-[var(--accent-cyan)]/20 hover:text-[var(--accent-cyan)] transition-colors flex items-center justify-between group"
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
                            className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-studio-text hover:bg-[var(--accent-cyan)]/20 hover:text-[var(--accent-cyan)] transition-colors"
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
                            className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-studio-text hover:bg-[var(--accent-cyan)]/20 hover:text-[var(--accent-cyan)] transition-colors"
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
                        className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-studio-text hover:bg-[var(--accent-cyan)]/20 hover:text-[var(--accent-cyan)] transition-colors"
                        onClick={() => {
                            toggleBounceTrackDialog(trackContextMenu.id);
                            setTrackContextMenu(null);
                        }}
                    >
                        Bounce Track in Place...
                    </button>
                    {selectedClipIds.length > 0 && tracks.find(t => t.id === trackContextMenu.id)?.id === (clips.find((c: Clip) => c.id === selectedClipIds[0])?.trackId) && (
                        <button
                            className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-studio-text hover:bg-[var(--accent-cyan)]/20 hover:text-[var(--accent-cyan)] transition-colors"
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
                        <span className="text-[9px] text-studio-text-dim group-hover:text-white/70">⌘⌫</span>
                    </button>
                    <div className="h-px bg-[var(--accent-cyan)]/10 my-1" />
                    <button
                        className="w-full px-3 py-1.5 text-left text-[11.5px] font-bold text-studio-text hover:bg-[var(--accent-cyan)]/20 hover:text-[var(--accent-cyan)] transition-colors flex items-center justify-between group"
                        onClick={() => {
                            toggleTrackHeaderConfig(true);
                            setTrackContextMenu(null);
                        }}
                    >
                        Configure Track Header...
                    </button>
                </div>
            )}
        </div>
    )
}
