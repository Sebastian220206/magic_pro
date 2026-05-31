"use client"
import { useProjectStore } from "@/store/projectStore"
import { Clip } from "@/models/Clip"
import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { WaveformSVG } from "./WaveformSVG"
import {
    ChevronDown, ChevronRight, Search,
    MousePointer2, Pencil, Eraser,
    Scissors, Target, Settings,
    Maximize2, MoreHorizontal,
    Music, Volume2, Power, Flag,
    Layers, CornerLeftDown
} from "lucide-react"

export function Timeline() {
    const {
        playing, playhead, movePlayhead, tracks, clips, updateClip,
        zoom, snap, selectClip, selectedClipId,
        trackHeight, showAutomation, globalTracks,
        locatorLeft, locatorRight, cycleEnabled, skipCycleEnabled, setLocators,
        settings, updateProjectSettings,
        marqueeSelection, setMarqueeSelection,
        toggleSelectionBasedProcessing,
        selectedClipIds, selectClips,
        setShowAudioTrackEditor, setAudioTrackEditorTrackId,
        toggleBounceRegionsDialog,
        autopunchEnabled, autopunchStart, autopunchEnd, setAutopunchLocators,
        saveTakeFolderComp, createTakeFolderComp, selectTakeFolderComp, renameTakeFolderComp, deleteTakeFolderComp,
        addAutomationPoint, updateAutomationPoint, deleteAutomationPoint
    } = useProjectStore()

    const containerRef = useRef<HTMLDivElement>(null)
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, clipIds: string[] } | null>(null)
    const [takeFolderMenuClipId, setTakeFolderMenuClipId] = useState<string | null>(null)

    const pixelsPerBeat = zoom || 80;
    const playheadX = playhead * pixelsPerBeat;

    const [draggingAutomation, setDraggingAutomation] = useState<null | {
        trackId: string;
        laneIndex: number;
        pointIndex: number;
        startX: number;
        startY: number;
        originalTime: number;
        originalValue: number;
    }>(null);

    const getSnapValue = useCallback((val: number) => {
        let divisor = 1;
        switch (snap) {
            case 'bar': divisor = 4; break;
            case 'half': divisor = 2; break;
            case 'quarter': divisor = 1; break;
            case 'eighth': divisor = 0.5; break;
            case 'sixteenth': divisor = 0.25; break;
        }
        return Math.round(val / divisor) * divisor;
    }, [snap]);

    useEffect(() => {
        if (!draggingAutomation || !containerRef.current) return;

        const onMouseMove = (e: MouseEvent) => {
            const timelineRect = containerRef.current!.getBoundingClientRect();
            const trackIndex = tracks.findIndex(t => t.id === draggingAutomation.trackId);
            if (trackIndex === -1) return;

            const trackOffsetY = tracks.slice(0, trackIndex).reduce((acc, t) => acc + trackHeight * (t.zoom || 1), 0);
            const trackTotalHeight = trackHeight * (tracks[trackIndex].zoom || 1);
            const relativeY = e.clientY - (timelineRect.top + 40 + trackOffsetY);
            const clampedY = Math.max(0, Math.min(trackTotalHeight, relativeY));

            const newTime = getSnapValue((e.clientX - timelineRect.left + containerRef.current!.scrollLeft) / pixelsPerBeat);
            const newValue = Math.max(0, Math.min(100, (1 - clampedY / trackTotalHeight) * 100));

            updateAutomationPoint(draggingAutomation.trackId, draggingAutomation.laneIndex, draggingAutomation.pointIndex, {
                time: newTime,
                value: newValue
            });
        };

        const onMouseUp = () => {
            setDraggingAutomation(null);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [draggingAutomation, tracks, trackHeight, pixelsPerBeat, getSnapValue, updateAutomationPoint]);

    const handleAutomationLayerMouseDown = (track: any, e: React.MouseEvent) => {
        if (e.button !== 0 || !containerRef.current) return;
        const target = e.target as HTMLElement;
        if (target.dataset?.automationPoint === 'true') return;

        e.stopPropagation();

        const timelineRect = containerRef.current.getBoundingClientRect();
        const trackRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const mouseX = e.clientX - timelineRect.left + containerRef.current.scrollLeft;
        const mouseY = e.clientY - trackRect.top;

        const time = getSnapValue(mouseX / pixelsPerBeat);
        const trackTotalHeight = trackHeight * (track.zoom || 1);
        const value = Math.max(0, Math.min(100, (1 - Math.max(0, Math.min(trackTotalHeight, mouseY)) / trackTotalHeight) * 100));

        addAutomationPoint(track.id, 'volume', time, value);
    };

    const handleAutomationPointMouseDown = (trackId: string, laneIndex: number, pointIndex: number, point: any, e: React.MouseEvent) => {
        if (e.button !== 0) return;
        e.stopPropagation();

        setDraggingAutomation({
            trackId,
            laneIndex,
            pointIndex,
            startX: e.clientX,
            startY: e.clientY,
            originalTime: point.time,
            originalValue: point.value
        });
    };

    const openTakeFolderForSelected = () => {
        if (!selectedClipId) return;
        const clip = clips.find(c => c.id === selectedClipId);
        if (!clip || !clip.isTakeFolder) return;

        updateClip(clip.id, { isTakeFolderOpen: !clip.isTakeFolderOpen });
    };

    const setActiveTake = (clip: Clip, takeIndex: number) => {
        if (!clip.isTakeFolder || !clip.takes) return;
        const index = Math.max(0, Math.min(takeIndex, clip.takes.length - 1));
        updateClip(clip.id, { activeTakeIndex: index });
    };

    const setAllTrackTakeFoldersOpen = (trackId: string, open: boolean) => {
        const takeFolders = clips.filter(c => c.trackId === trackId && c.isTakeFolder);
        takeFolders.forEach(tf => updateClip(tf.id, { isTakeFolderOpen: open }));
    };

    const handleClipMouseDown = (clip: Clip, e: React.MouseEvent) => {
        e.stopPropagation();

        if (e.shiftKey) {
            const already = selectedClipIds.includes(clip.id);
            const next = already ? selectedClipIds.filter(id => id !== clip.id) : [...selectedClipIds, clip.id];
            selectClips(next);
            selectClip(clip.id);
        } else {
            selectClips([clip.id]);
            selectClip(clip.id);
        }

        const movingClips = selectedClipIds.includes(clip.id) ? clips.filter(c => selectedClipIds.includes(c.id)) : [clip];
        const originalStarts = movingClips.reduce((acc, c) => ({ ...acc, [c.id]: c.start }), {} as Record<string, number>);

        if (e.altKey && e.shiftKey) {
            const startX = e.clientX;
            const onMouseMove = () => {
                // No real-time ghosting yet; alias created on mouse up.
            };

            const onMouseUp = (me: MouseEvent) => {
                const dx = (me.clientX - startX) / pixelsPerBeat;
                movingClips.forEach(c => {
                    const newStart = getSnapValue(c.start + dx);
                    useProjectStore.getState().makeAlias(c.id, c.trackId, Math.max(0, newStart));
                });
                window.removeEventListener('mouseup', onMouseUp);
                window.removeEventListener('mousemove', onMouseMove);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
            return;
        }

        const startX = e.clientX;

        const onMouseMove = (me: MouseEvent) => {
            const dx = (me.clientX - startX) / pixelsPerBeat;
            movingClips.forEach(c => {
                const base = originalStarts[c.id];
                const next = getSnapValue(base + dx);
                updateClip(c.id, { start: Math.max(0, next) });
            });
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const handleClipResize = (clip: Clip, direction: 'left' | 'right', e: React.MouseEvent) => {
        e.stopPropagation();

        const originalStart = clip.start;
        const originalDuration = clip.duration;
        const startX = e.clientX;

        const onMouseMove = (me: MouseEvent) => {
            const dx = (me.clientX - startX) / pixelsPerBeat;
            if (direction === 'right') {
                const newDuration = Math.max(0.25, getSnapValue(originalDuration + dx));
                updateClip(clip.id, { duration: newDuration });
            } else {
                const desiredStart = Math.max(0, getSnapValue(originalStart + dx));
                const newDuration = Math.max(0.25, originalDuration - (desiredStart - originalStart));
                updateClip(clip.id, { start: desiredStart, duration: newDuration });
            }
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const handleRulerMouseDown = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        movePlayhead(x / pixelsPerBeat);
    };

    const handleTimelineMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const startX = e.clientX - rect.left + containerRef.current!.scrollLeft;
        const startY = e.clientY - rect.top + containerRef.current!.scrollTop;
        const startTime = startX / pixelsPerBeat;

        // Reset selection if clicking empty space
        selectClips([]);
        selectClip(null);

        const onMouseMove = (me: MouseEvent) => {
            const currentX = me.clientX - rect.left + containerRef.current!.scrollLeft;
            const currentTime = currentX / pixelsPerBeat;
            
            const selectionStart = Math.min(startTime, currentTime);
            const selectionDuration = Math.abs(currentTime - startTime);

            // Find tracks within vertical range
            const currentY = me.clientY - rect.top + containerRef.current!.scrollTop;
            const top = Math.min(startY, currentY);
            const bottom = Math.max(startY, currentY);

            const selectedTrackIds: string[] = [];
            let currentOffset = 40; // Height of ruler
            tracks.forEach(track => {
                const h = trackHeight * (track.zoom || 1);
                if (currentOffset + h > top && currentOffset < bottom) {
                    selectedTrackIds.push(track.id);
                }
                currentOffset += h;
            });

            setMarqueeSelection({
                trackIds: selectedTrackIds,
                start: getSnapValue(selectionStart),
                duration: Math.max(0.1, getSnapValue(selectionDuration))
            });
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const totalWidth = 5000 * pixelsPerBeat / 60; // Approx 5000 beats

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
            e.dataTransfer.dropEffect = 'copy';
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            // Logic: dragging to the main area below tracks creates tracks directly
            files.forEach((file, idx) => {
                const isMidi = file.name.endsWith('.mid') || file.name.endsWith('.midi');
                const trackId = Date.now().toString() + idx;

                getProjectStore().addTrack({
                    id: trackId,
                    name: file.name.split('.')[0],
                    type: isMidi ? 'midi' : 'audio',
                    color: isMidi ? '#63ed63' : '#38bdf8',
                    icon: isMidi ? 'keyboard' : 'mic'
                });

                // Add placeholder clip
                getProjectStore().addClip({
                    id: `clip-${trackId}`,
                    trackId: trackId,
                    name: file.name,
                    start: 0,
                    duration: 8,
                    type: isMidi ? 'midi' : 'audio',
                    color: isMidi ? '#63ed63' : '#38bdf8'
                } as any);
            });
        }
    };

    const getProjectStore = () => useProjectStore.getState();

    useEffect(() => {
        // Inject a test take folder to work on Quick Swipe Comping UI
        const store = getProjectStore();
        if (store.tracks.length > 0 && !store.clips.some(c => c.isTakeFolder)) {
            const trackId = store.tracks[0].id; // Audio 1 ideally
            const takeFolderId = 'take-folder-1';
            store.addClip({
                id: takeFolderId,
                trackId: trackId,
                name: 'Audio 2: Comp B',
                type: 'audio',
                color: '#84cc16',
                alternativeId: store.tracks[0].activeAlternativeId,
                start: 1,
                startTime: 1,
                duration: 6,
                offset: 0,
                isTakeFolder: true,
                isTakeFolderOpen: false,
                quickSwipeComping: true,
                activeTakeIndex: 1,
                muted: false, loop: false, qSwing: 0, transpose: 0, velocityOffset: 0,
                fadeIn: { duration: 0, curve: 'linear', gain: 1 },
                fadeOut: { duration: 0, curve: 'linear', gain: 1 },
                playbackRate: 1,
                pitchOffset: 0,
                stretchMode: 'none',
                takes: [] as any,
            });
        }
    }, [tracks.length]);

    useEffect(() => {
        const handleWindowMouseDown = () => setTakeFolderMenuClipId(null);
        window.addEventListener('mousedown', handleWindowMouseDown);
        return () => window.removeEventListener('mousedown', handleWindowMouseDown);
    }, []);

    return (
        <div
            className="flex-1 bg-[#111] overflow-x-auto overflow-y-auto relative flex flex-col custom-scrollbar select-none z-10"
            ref={containerRef}
            onMouseDown={handleTimelineMouseDown}
            onContextMenu={(e) => e.preventDefault()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* 1. Logic Signature High-Fidelity Time Ruler */}
            <div
                className="h-10 sticky top-0 z-50 shrink-0 bg-[#1a1a1a] shadow-lg cursor-pointer border-b border-black"
                onMouseDown={handleRulerMouseDown}
            >
                {/* Yellow Playback Guide Section */}
                <div className="absolute inset-x-0 h-[3px] bg-sky-500/20 top-0"></div>

                {/* Ruler Ticks & Numbers Layer */}
                <div className="absolute inset-0 flex" style={{ width: `${totalWidth}px` }}>
                    {[...Array(400)].map((_, i) => (
                        <div key={i} className="flex h-full border-r border-[#222] relative group/ruler" style={{ width: `${pixelsPerBeat * 4}px`, flexShrink: 0 }}>
                            {/* Bar Label */}
                            <span className="text-[10px] font-black text-gray-500 absolute top-1.5 left-1 z-50 tabular-nums">
                                {1 + i}
                            </span>
                            {/* Beat subdivisions */}
                            {[...Array(4)].map((_, j) => (
                                <div key={j} className={`absolute bottom-0 w-px ${j === 0 ? 'h-full bg-black/10' : 'h-1.5 bg-[#333]'}`} style={{ left: `${j * 25}%` }}></div>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Markers Overlay (if present) */}
                <div className="absolute inset-x-0 bottom-0 h-4 pointer-events-none">
                    {globalTracks.markers.map(m => (
                        <div key={m.id} className="absolute h-full border-l border-yellow-500/50 bg-yellow-500/10 px-1" style={{ left: `${m.time * pixelsPerBeat}px`, width: `${m.duration * pixelsPerBeat}px` }}>
                            <span className="text-[8px] font-black text-yellow-500/60 uppercase">{m.text}</span>
                        </div>
                    ))}
                </div>

                {/* Cycle Area (Logic Signature) */}
                {(cycleEnabled || skipCycleEnabled) && (
                    <div
                        className={`absolute top-0 h-[30px] z-40 transition-all duration-300 rounded-[1px] ${skipCycleEnabled ? 'bg-[#111] shadow-[inset_0_0_10px_rgba(0,0,0,0.8)] border-x border-[#333]' : 'bg-yellow-500/80 shadow-[0_4px_10px_rgba(234,179,8,0.2)] border-x border-yellow-400'}`}
                        style={{
                            left: `${locatorLeft * pixelsPerBeat}px`,
                            width: `${(locatorRight - locatorLeft) * pixelsPerBeat}px`,
                            backgroundImage: skipCycleEnabled ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(234,179,8,0.05) 10px, rgba(234,179,8,0.05) 20px)' : 'none'
                        }}
                    >
                        {/* Skip Cycle Icons */}
                        {skipCycleEnabled && (
                            <div className="flex items-center justify-center gap-12 w-full h-full opacity-40">
                                <SkipCycleIcon className="w-3.5 h-3.5 text-yellow-500/80" />
                                <SkipCycleIcon className="w-3.5 h-3.5 text-yellow-500/80 rotate-180" />
                            </div>
                        )}

                        {/* Handles (Logic Pro Professional Handles) */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 flex items-center justify-center cursor-ew-resize hover:bg-white/20">
                            <div className="w-[1px] h-3 bg-white/40"></div>
                        </div>
                        <div className="absolute right-0 top-0 bottom-0 w-1 flex items-center justify-center cursor-ew-resize hover:bg-white/20">
                            <div className="w-[1px] h-3 bg-white/40"></div>
                        </div>
                    </div>
                )}

                {/* Autopunch Area (Logic Signature) */}
                {autopunchEnabled && (
                    <div
                        className="absolute h-[8px] top-[32%] z-45 bg-red-600/60 shadow-[0_0_10px_rgba(220,38,38,0.4)] border-x border-red-500 rounded-[1px] cursor-ew-resize"
                        style={{
                            left: `${autopunchStart * pixelsPerBeat}px`,
                            width: `${(autopunchEnd - autopunchStart) * pixelsPerBeat}px`
                        }}
                    >
                        {/* Handles */}
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-white/20"></div>
                        <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-white/20"></div>
                    </div>
                )}

                {/* Playhead Anchor Handle (Logic Style) */}
                <div
                    className="absolute top-0 bottom-0 w-px bg-white/40 z-50 pointer-events-none"
                    style={{ transform: `translateX(${playheadX}px)` }}
                >
                    <div className="absolute -top-[1.2rem] -left-[10px] w-5 h-8 bg-gradient-to-b from-[#333] to-[#222] rounded-t-sm border border-[#444] shadow-2xl flex flex-col items-center pointer-events-auto">
                        <div className="w-full h-[6px] bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.8)] rounded-t-[1px]"></div>
                        <div className="flex-1 flex items-center justify-center opacity-40">
                            <div className="w-[1px] h-3 bg-white"></div>
                        </div>
                    </div>
                </div>

                {/* Project Start/End Markers (Logic Professional Implementation) */}
                <div
                    className="absolute top-0 h-[28px] w-2.5 cursor-ew-resize group hover:bg-white/10 z-[55] flex flex-col items-center"
                    style={{ left: `${settings.projectStart * pixelsPerBeat}px` }}
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        const startX = e.clientX;
                        const originalStart = settings.projectStart;
                        const onMove = (me: MouseEvent) => {
                            const dx = (me.clientX - startX) / pixelsPerBeat;
                            const newStart = Math.min(originalStart + dx, settings.projectEnd - 1);
                            updateProjectSettings({ projectStart: Math.max(-16, Math.floor(newStart)) });
                        };
                        const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                        window.addEventListener('mousemove', onMove);
                        window.addEventListener('mouseup', onUp);
                    }}
                >
                    <div className="w-0.5 h-full bg-gray-400 group-hover:bg-white transition-colors"></div>
                    <div className="w-2.5 h-2.5 bg-gray-600 rounded-sm border border-black/40 -mt-1 shadow-lg"></div>
                </div>

                <div
                    className="absolute top-0 h-[28px] w-2.5 cursor-ew-resize group hover:bg-white/10 z-[55] flex flex-col items-center"
                    style={{ left: `${settings.projectEnd * pixelsPerBeat}px` }}
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        const startX = e.clientX;
                        const originalEnd = settings.projectEnd;
                        const onMove = (me: MouseEvent) => {
                            const dx = (me.clientX - startX) / pixelsPerBeat;
                            const newEnd = Math.max(originalEnd + dx, settings.projectStart + 1);
                            updateProjectSettings({ projectEnd: Math.round(newEnd) });
                        };
                        const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                        window.addEventListener('mousemove', onMove);
                        window.addEventListener('mouseup', onUp);
                    }}
                >
                    <div className="w-0.5 h-full bg-gray-400 group-hover:bg-white transition-colors"></div>
                    <div className="w-2.5 h-2.5 bg-gray-600 rounded-sm border border-black/40 -mt-1 shadow-lg"></div>
                </div>
            </div>

            {/* 2. Main Grid Rendering Area */}
            <div className="relative flex-1 h-full" style={{ width: `${totalWidth}px` }}>
                {/* Visual Playhead Content Line */}
                <div
                    className="absolute inset-y-0 w-px bg-sky-500/40 z-50 pointer-events-none shadow-[0_0_20px_rgba(14,165,233,0.4)]"
                    style={{ transform: `translateX(${playheadX}px)` }}
                />

                {/* Marquee Selection Rendering */}
                {marqueeSelection && (
                    <div 
                        className="absolute z-[60] bg-white/10 border border-white/30 backdrop-blur-[1px] pointer-events-none"
                        style={{
                            left: `${marqueeSelection.start * pixelsPerBeat}px`,
                            width: `${marqueeSelection.duration * pixelsPerBeat}px`,
                            top: `${40 + tracks.findIndex(t => t.id === marqueeSelection.trackIds[0]) * trackHeight}px`, // Simplified vertical pos
                            height: `${marqueeSelection.trackIds.length * trackHeight}px`,
                        }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                    </div>
                )}

                {/* Vertical Rhythm Grids */}
                <div className="absolute inset-0 flex pointer-events-none z-10 h-full">
                    {[...Array(800)].map((_, i) => (
                        <div key={i} className={`h-full border-r ${i % 16 === 0 ? 'border-sky-500/10' : i % 4 === 0 ? 'border-white/[0.03]' : 'border-white/[0.01]'}`} style={{ width: `${pixelsPerBeat}px`, flexShrink: 0 }}></div>
                    ))}
                </div>

                {/* Professional Clip & Automation Container Stack */}
                <div className="flex flex-col relative z-20 w-full overflow-hidden">
                    {tracks.map((track) => {
                        const currentHeight = trackHeight * (track.zoom || 1);
                        const activeClips = clips.filter(c => c.trackId === track.id && c.alternativeId === track.activeAlternativeId);
                        const openTakeFolders = activeClips.filter(c => c.isTakeFolder && c.isTakeFolderOpen);
                        const maxTakes = openTakeFolders.reduce((max, c) => Math.max(max, (c.takes?.length || 0)), 0);
                        const trackTotalHeight = currentHeight + (maxTakes * currentHeight);

                        return (
                            <div key={track.id} className="flex flex-col">
                                <div className="relative border-b border-black/40 group/track" style={{ height: `${trackTotalHeight}px` }}>
                                    {/* Track Automation Layer (Logic Signature) */}
                                    {showAutomation && (
                                        <div
                                            className="absolute inset-0 z-30 pointer-events-auto opacity-80 backdrop-grayscale-[0.2]"
                                            onMouseDown={(e) => handleAutomationLayerMouseDown(track, e)}
                                        >
                                            <svg className="w-full h-full pointer-events-none">
                                                {track.automation?.map((lane, lidx) => (
                                                    <path
                                                        key={lidx}
                                                        d={lane.points.length > 1 ?
                                                            `M ${lane.points[0].time * pixelsPerBeat} ${trackTotalHeight * (1 - lane.points[0].value / 100)} ` +
                                                            lane.points.slice(1).map(p => `L ${p.time * pixelsPerBeat} ${trackTotalHeight * (1 - p.value / 100)}`).join(' ')
                                                            : ''
                                                        }
                                                        fill="none"
                                                        stroke={lane.parameter === 'volume' ? '#f59e0b' : '#10b981'}
                                                        strokeWidth="2"
                                                        className="drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]"
                                                    />
                                                ))}
                                            </svg>

                                            {/* Automation Points */}
                                            {track.automation?.[0]?.points.map((p, pidx) => (
                                                <div
                                                    key={pidx}
                                                    data-automation-point="true"
                                                    title={`Time ${p.time.toFixed(2)} – Value ${p.value.toFixed(1)}%`}
                                                    onMouseDown={(e) => handleAutomationPointMouseDown(track.id, 0, pidx, p, e)}
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        deleteAutomationPoint(track.id, 0, pidx);
                                                    }}
                                                    className="absolute w-2 h-2 rounded-full border border-white/60 bg-yellow-500 shadow-[0_0_10px_rgba(245,158,11,0.8)] cursor-ns-resize hover:scale-150 transition-transform"
                                                    style={{
                                                        left: `${p.time * pixelsPerBeat}px`,
                                                        top: `${trackTotalHeight * (1 - p.value / 100)}px`,
                                                        transform: 'translate(-50%, -50%)'
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {/* Regions Layer */}
                                    <div className={`absolute inset-0 z-20 transition-all duration-300 ${showAutomation ? 'opacity-30 blur-[1px] saturate-[0.5]' : 'opacity-100'}`}>
                                        {activeClips.map(clip => (
                                            <div key={clip.id}>
                                                <div
                                                    onMouseDown={(e) => {
                                                        if (clip.isTakeFolder && !clip.quickSwipeComping && e.altKey && clip.takes && clip.takes.length > 0) {
                                                            e.stopPropagation();
                                                            const nextIdx = ((clip.activeTakeIndex ?? 0) + 1) % clip.takes.length;
                                                            updateClip(clip.id, { activeTakeIndex: nextIdx });
                                                            return;
                                                        }
                                                        handleClipMouseDown(clip, e);
                                                    }}
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (!selectedClipIds.includes(clip.id)) {
                                                            selectClips([clip.id]);
                                                            selectClip(clip.id);
                                                        }
                                                        setContextMenu({ x: e.clientX, y: e.clientY, clipIds: selectedClipIds.includes(clip.id) ? selectedClipIds : [clip.id] });
                                                    }}
                                                    className={`absolute ${clip.isTakeFolderOpen ? 'z-40 shadow-xl border-white/60' : ''} top-0.5 rounded-[4px] border shadow-2xl group cursor-move overflow-hidden transition-all transform active:scale-[0.99] ${selectedClipIds.includes(clip.id) ? 'border-white ring-1 ring-white/40 ring-inset brightness-110 z-30 shadow-sky-500/20' : 'border-black/50'} ${clip.muted ? 'opacity-40 grayscale-[0.6]' : 'opacity-100'}`}
                                                    onDoubleClick={(e) => {
                                                        if (clip.type === 'audio') {
                                                            e.stopPropagation();
                                                            setShowAudioTrackEditor(true);
                                                            setAudioTrackEditorTrackId(clip.trackId);
                                                        }
                                                    }}
                                                    style={{
                                                        height: `${currentHeight - 2}px`,
                                                        left: `${clip.start * pixelsPerBeat}px`,

                                                        width: `${clip.duration * pixelsPerBeat}px`,
                                                        backgroundColor: clip.color,
                                                        backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 25%, rgba(0,0,0,0.2) 100%)'
                                                    }}
                                                >
                                                    <div
                                                        className="absolute left-0 top-0 h-full w-2 cursor-ew-resize"
                                                        onMouseDown={(e) => handleClipResize(clip, 'left', e)}
                                                    />
                                                    <div
                                                        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize"
                                                        onMouseDown={(e) => handleClipResize(clip, 'right', e)}
                                                    />
                                                    {/* Professional Region Label */}
                                                    <div className="absolute top-0 left-0 right-0 h-4.5 px-2.5 flex items-center justify-between z-20 bg-black/10 backdrop-blur-[2px] border-b border-black/10">
                                                        <div className="flex items-center gap-1.5 overflow-hidden w-full">
                                                            {clip.isTakeFolder && (
                                                                <div 
                                                                    className="flex items-center justify-center p-0.5 hover:bg-black/20 rounded-sm cursor-pointer mr-1 pointer-events-auto"
                                                                    onMouseDown={(e) => {
                                                                        e.stopPropagation();
                                                                        if (e.altKey) {
                                                                            setAllTrackTakeFoldersOpen(clip.trackId, true);
                                                                        } else {
                                                                            updateClip(clip.id, { isTakeFolderOpen: !clip.isTakeFolderOpen });
                                                                        }
                                                                    }}
                                                                >
                                                                    {clip.isTakeFolderOpen ? <ChevronDown className="w-2.5 h-2.5 text-black/80" /> : <ChevronRight className="w-2.5 h-2.5 text-black/80" />}
                                                                </div>
                                                            )}
                                                            {clip.isTakeFolder && (
                                                                <div className="flex items-center gap-1 mr-1.5 bg-white/20 px-1 rounded-sm border border-black/20 pointer-events-auto">
                                                                    <div 
                                                                        className={`p-0.5 cursor-pointer rounded-sm hover:bg-black/10 transition-colors ${clip.quickSwipeComping ? 'bg-black/20 shadow-inner' : ''}`}
                                                                        onMouseDown={(e) => {
                                                                            e.stopPropagation();
                                                                            updateClip(clip.id, { quickSwipeComping: !clip.quickSwipeComping });
                                                                        }}
                                                                        title="Quick Swipe Comping"
                                                                    >
                                                                        <Layers className={`w-2 h-2 ${clip.quickSwipeComping ? 'text-green-800' : 'text-black/60'}`} />
                                                                    </div>
                                                                    <div className="w-px h-3 bg-black/20 mx-0.5" />
                                                                    <div 
                                                                        className="relative p-0.5 cursor-pointer rounded-sm hover:bg-black/10 text-[8px] font-black text-black/80 flex items-center gap-0.5"
                                                                        title="Take Folder Pop-up Menu"
                                                                        onMouseDown={(e) => {
                                                                            e.stopPropagation();
                                                                        }}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setTakeFolderMenuClipId(takeFolderMenuClipId === clip.id ? null : clip.id);
                                                                        }}
                                                                    >
                                                                        {clip.activeTakeIndex !== undefined ? String.fromCharCode(65 + clip.activeTakeIndex) : 'A'}
                                                                        <MoreHorizontal className="w-2 h-2" />
                                                                        {takeFolderMenuClipId === clip.id && clip.takes && (
                                                                            <div className="absolute top-5 left-0 z-50 bg-white text-black rounded-sm border border-black/20 shadow-lg min-w-[220px]">
                                                                                <div className="px-2 py-1 border-b border-black/10 text-[11px] font-bold">Take Folder Menu</div>
                                                                                <button className="w-full px-2 py-1 text-left text-[11px] hover:bg-sky-500 hover:text-white" onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); updateClip(clip.id, { quickSwipeComping: !clip.quickSwipeComping }); }}>
                                                                                    Quick Swipe Comping: {clip.quickSwipeComping ? 'On' : 'Off'}
                                                                                </button>
                                                                                <button className="w-full px-2 py-1 text-left text-[11px] hover:bg-sky-500 hover:text-white" onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); saveTakeFolderComp(clip.id); }}>
                                                                                    Save Current Comp
                                                                                </button>
                                                                                <button className="w-full px-2 py-1 text-left text-[11px] hover:bg-sky-500 hover:text-white" onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); createTakeFolderComp(clip.id); }}>
                                                                                    Create New Comp
                                                                                </button>
                                                                                <div className="px-2 py-1 text-[11px] font-bold text-gray-500 border-t border-black/10">Takes</div>
                                                                                {clip.takes.map((take, tIdx) => (
                                                                                    <div key={take.id} className={`px-2 py-1 cursor-pointer hover:bg-blue-500 hover:text-white ${clip.activeTakeIndex === tIdx ? 'bg-blue-600 text-white' : ''}`} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setActiveTake(clip, tIdx);
                                                                                        setTakeFolderMenuClipId(null);
                                                                                    }}>
                                                                                        {`Take ${tIdx + 1}`}
                                                                                    </div>
                                                                                ))}
                                                                                {clip.comps && clip.comps.length > 0 && (
                                                                                    <>
                                                                                        <div className="px-2 py-1 text-[11px] font-bold text-gray-500 border-t border-black/10">Comps</div>
                                                                                        {clip.comps.map(comp => (
                                                                                            <div key={comp.id} className={`px-2 py-1 cursor-pointer hover:bg-emerald-500 hover:text-white ${clip.activeCompId === comp.id ? 'bg-emerald-600 text-white' : ''}`} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                selectTakeFolderComp(clip.id, comp.id);
                                                                                                setTakeFolderMenuClipId(null);
                                                                                            }}>
                                                                                                <div className="flex justify-between items-center">
                                                                                                    <span>{comp.name}</span>
                                                                                                    <span className="text-[10px] text-white/80">#{comp.takeIndex + 1}</span>
                                                                                                </div>
                                                                                            </div>
                                                                                        ))}
                                                                                    </>
                                                                                )}
                                                                                {(clip.comps || []).length > 0 && (
                                                                                    <div className="px-2 py-1 flex justify-between gap-1">
                                                                                        <button className="text-[10px] px-2 py-1 bg-gray-200 rounded-sm hover:bg-gray-300" onMouseDown={e => e.stopPropagation()} onClick={e => {
                                                                                            e.stopPropagation();
                                                                                            if (!clip.comps?.length) return;
                                                                                            const compToDelete = clip.comps[clip.comps.length - 1];
                                                                                            deleteTakeFolderComp(clip.id, compToDelete.id);
                                                                                        }}>Delete Last Comp</button>
                                                                                        <button className="text-[10px] px-2 py-1 bg-gray-200 rounded-sm hover:bg-gray-300" onMouseDown={e => e.stopPropagation()} onClick={e => {
                                                                                            e.stopPropagation();
                                                                                            const compToRename = clip.comps?.[clip.comps.length - 1];
                                                                                            if (!compToRename) return;
                                                                                            const newName = prompt('Rename comp', compToRename.name);
                                                                                            if (newName) renameTakeFolderComp(clip.id, compToRename.id, newName);
                                                                                        }}>Rename Last Comp</button>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {!clip.isTakeFolder && (
                                                                clip.type === 'audio' ? <Volume2 className="w-2.5 h-2.5 text-black/60 pointer-events-none" /> : <Music className="w-2.5 h-2.5 text-black/60 pointer-events-none" />
                                                            )}
                                                            <span className={`text-[9px] font-black tracking-tight truncate leading-none uppercase pointer-events-none ${clip.aliasOf ? 'italic' : ''}`}>{clip.aliasOf ? (clip.aliasName || clips.find(c => c.id === clip.aliasOf)?.name || clip.name) : clip.name}</span>
                                                            {clip.aliasOf && clips.find(c => c.id === clip.aliasOf) && zoom >= 60 && (
                                                                <span className="text-[7px] text-black/50 block truncate pointer-events-none">{clips.find(c => c.id === clip.aliasOf)?.name || 'Missing original'}</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Media Content Visualization */}
                                                    <div className="absolute inset-x-0 bottom-0 top-[18px] opacity-70 pointer-events-none">
                                                        {clip.type === 'audio' ? (
                                                            <div className="absolute inset-x-0 inset-y-1"><WaveformSVG color="black" peaks={clip.waveformPeaks} /></div>
                                                        ) : (
                                                            <div className="absolute inset-0 px-2 py-1"><MIDIPoints clip={clip} /></div>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {/* Take Sub-lanes */}
                                                {clip.isTakeFolder && clip.isTakeFolderOpen && clip.takes && (
                                                    <div className="absolute z-10" style={{ left: `${clip.start * pixelsPerBeat}px`, width: `${clip.duration * pixelsPerBeat}px`, top: `${currentHeight}px` }}>
                                                        {clip.takes.map((take, tIdx) => (
                                                            <div key={take.id} className="relative w-full border-b border-black/40 bg-black/40 group overflow-hidden" style={{ height: `${currentHeight}px` }}>
                                                                <div className={`absolute inset-0 rounded-[2px] border ${clip.activeTakeIndex === tIdx ? 'border-sky-500/50 mix-blend-screen' : 'border-black/50 opacity-50'} transition-all`} 
                                                                    style={{ backgroundColor: take.color }}
                                                                    onMouseDown={(e) => {
                                                                        e.stopPropagation();
                                                                        if (clip.quickSwipeComping) {
                                                                            // Logic for QSC selecting this take
                                                                            updateClip(clip.id, { activeTakeIndex: tIdx });
                                                                        }
                                                                    }}>
                                                                    <div className="absolute top-0 left-0 right-0 h-4.5 px-2 flex items-center z-10 bg-black/10 text-[9px] font-black text-black/80">
                                                                        Take {tIdx + 1}
                                                                    </div>
                                                                    <div className="absolute inset-x-0 bottom-0 top-[18px] opacity-70 pointer-events-none">
                                                                        <WaveformSVG color="black" peaks={take.waveformPeaks} />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Inactive Alternatives Sub-lanes */}
                                {track.showInactiveAlternatives && track.alternatives.filter(a => a.id !== track.activeAlternativeId).map(alt => (
                                    <div key={alt.id} className="relative border-b border-white/5 bg-black/20" style={{ height: '30px' }}>
                                        {clips.filter(c => c.trackId === track.id && c.alternativeId === alt.id).map(clip => (
                                            <div
                                                key={clip.id}
                                                onMouseDown={(e) => handleClipMouseDown(clip, e)}
                                                className={`absolute top-0.5 rounded-[2px] border border-black/40 shadow-sm opacity-60 grayscale-[0.4]`}
                                                style={{
                                                    height: '26px',
                                                    left: `${clip.start * pixelsPerBeat}px`,
                                                    width: `${clip.duration * pixelsPerBeat}px`,
                                                    backgroundColor: clip.color || track.color
                                                }}
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                                                <span className="text-[8px] font-black px-1 pointer-events-none opacity-50 block truncate">{clip.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            </div>

            {contextMenu && (
                <div 
                    className="fixed z-[200] w-64 bg-[#2c2c2e]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-100"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onMouseLeave={() => setContextMenu(null)}
                >
                    <div className="px-3 py-1.5 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5 mb-1">Region Operations</div>
                    <button
                        className="w-full px-4 py-2 text-left text-[12px] font-bold text-gray-200 hover:bg-sky-500 hover:text-white transition-colors"
                        onClick={() => {
                            const firstClipId = contextMenu.clipIds[0];
                            const clip = useProjectStore.getState().clips.find(c => c.id === firstClipId);
                            if (!clip) return;
                            useProjectStore.getState().makeAlias(clip.id, clip.trackId, useProjectStore.getState().playhead);
                            setContextMenu(null);
                        }}
                    >
                        Make Alias at Playhead
                    </button>
                    <button
                        className="w-full px-4 py-2 text-left text-[12px] font-bold text-gray-200 hover:bg-sky-500 hover:text-white transition-colors"
                        onClick={() => {
                            useProjectStore.getState().makeAliasesFromSelection();
                            setContextMenu(null);
                        }}
                    >
                        Repeat Regions as Aliases
                    </button>
                    <button
                        className="w-full px-4 py-2 text-left text-[12px] font-bold text-gray-200 hover:bg-sky-500 hover:text-white transition-colors"
                        onClick={() => {
                            const first = contextMenu.clipIds[0];
                            useProjectStore.getState().selectAliasesOfRegion(first);
                            setContextMenu(null);
                        }}
                    >
                        Select Aliases of Region
                    </button>
                    <button
                        className="w-full px-4 py-2 text-left text-[12px] font-bold text-gray-200 hover:bg-sky-500 hover:text-white transition-colors"
                        onClick={() => {
                            const first = contextMenu.clipIds[0];
                            useProjectStore.getState().selectOriginalOfAlias(first);
                            setContextMenu(null);
                        }}
                    >
                        Select Original of Alias
                    </button>
                    <button
                        className="w-full px-4 py-2 text-left text-[12px] font-bold text-gray-200 hover:bg-sky-500 hover:text-white transition-colors"
                        onClick={() => {
                            const first = contextMenu.clipIds[0];
                            useProjectStore.getState().convertAliasToRegionCopy(first);
                            setContextMenu(null);
                        }}
                    >
                        Convert Selected Alias to Copy
                    </button>
                    <div className="h-px bg-white/5 my-1" />
                    <button className="w-full px-4 py-2 text-left text-[12px] font-bold text-gray-200 hover:bg-sky-500 hover:text-white transition-colors flex items-center justify-between group">
                        Rename Regions...
                        <span className="text-[10px] text-gray-500 group-hover:text-white/60">⇧N</span>
                    </button>
                    <button className="w-full px-4 py-2 text-left text-[12px] font-bold text-gray-200 hover:bg-sky-500 hover:text-white transition-colors">
                        Colors
                    </button>
                    <button className="w-full px-4 py-2 text-left text-[12px] font-bold text-gray-200 hover:bg-sky-500 hover:text-white transition-colors"
                        onClick={() => {
                            useProjectStore.getState().selectOrphanAliases();
                            setContextMenu(null);
                        }}
                    >
                        Select Orphan Aliases
                    </button>
                    <button className="w-full px-4 py-2 text-left text-[12px] font-bold text-gray-200 hover:bg-sky-500 hover:text-white transition-colors"
                        onClick={() => {
                            const first = contextMenu.clipIds[0];
                            const threshold = parseFloat(prompt('Threshold (0-1)', '0.02') || '0.02');
                            const minSilence = parseFloat(prompt('Min Silence (beats)', '0.25') || '0.25');
                            useProjectStore.getState().splitRegionBySilence(first, { threshold, minSilence, preAttack: 0.02, postRelease: 0.02, zeroCross: true });
                            setContextMenu(null);
                        }}
                    >
                        Remove Silence (Quick)
                    </button>
                    <button className="w-full px-4 py-2 text-left text-[12px] font-bold text-gray-200 hover:bg-sky-500 hover:text-white transition-colors"
                        onClick={() => {
                            const first = contextMenu.clipIds[0];
                            const preset = prompt('Stem Splitter preset (All Stems, Vocals + Music, Vocals Only, Drums + Bass)', 'All Stems') || 'All Stems';
                            useProjectStore.getState().stemSplitter(first, { preset, includeSubmix: true });
                            setContextMenu(null);
                        }}
                    >
                        Stem Splitter (Quick)
                    </button>
                    <button className="w-full px-4 py-2 text-left text-[12px] font-bold text-gray-200 hover:bg-sky-500 hover:text-white transition-colors"
                        onClick={() => {
                            useProjectStore.getState().convertOrphanAliasesToCopies();
                            setContextMenu(null);
                        }}
                    >
                        Convert Orphan Aliases to Copies
                    </button>
                    <button className="w-full px-4 py-2 text-left text-[12px] font-bold text-gray-200 hover:bg-sky-500 hover:text-white transition-colors"
                        onClick={() => {
                            useProjectStore.getState().deleteOrphanAliases();
                            setContextMenu(null);
                        }}
                    >
                        Delete Orphan Aliases
                    </button>
                    <div className="h-px bg-white/5 my-1" />
                    <button className="w-full px-4 py-2 text-left text-[12px] font-bold text-red-400 hover:bg-red-500 hover:text-white transition-colors">
                        Delete
                    </button>
                </div>
            )}

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #0a0a0a; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #222; border-radius: 10px; border: 2px solid #0a0a0a; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #333; }
            `}</style>
        </div>
    )
}

function MIDIPoints({ clip }: { clip: Clip }) {
    const zoom = useProjectStore(s => s.zoom);
    if (!clip.notes) return null;
    return (
        <div className="relative w-full h-full flex flex-col justify-center">
            {clip.notes.map(n => (
                <div
                    key={n.id}
                    className="absolute bg-black/60 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
                    style={{
                        left: `${(n.start || 0) * (zoom || 80)}px`,
                        width: `${Math.max(3, (n.duration * (zoom || 80)) - 1)}px`,
                        top: `${(1 - (n.pitch - 36) / 48) * 100}%`,
                        height: '2px'
                    }}
                />
            ))}
        </div>
    )
}

function SkipCycleIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M7 6v12M17 6v12" opacity="0.4" />
            <path d="M11 9l-3 3 3 3M13 9l3 3-3 3" />
        </svg>
    )
}
