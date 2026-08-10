"use client"
import { useProjectStore } from "@/store/projectStore"
import { Clip } from "@/models/Clip"
import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { WaveformSVG } from "./WaveformSVG"
import { neonTrackColor, neonTrackAlpha, neonTrackTextColor } from "@/lib/trackColor"
import {
    ChevronDown, ChevronRight, Search,
    MousePointer2, Pencil, Eraser,
    Scissors, Target, Settings,
    Maximize2, MoreHorizontal,
    Music, Volume2, Power, Flag,
    Layers, CornerLeftDown
} from "lucide-react"
import { advancedScheduler } from "@/engine/audioEngine/scheduler"

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
        addAutomationPoint, updateAutomationPoint, deleteAutomationPoint,
        annotations,
        currentTool, splitClip, deleteClip
    } = useProjectStore()

    const containerRef = useRef<HTMLDivElement>(null)
    const playheadHandleRef = useRef<HTMLDivElement>(null)
    const playheadLineRef = useRef<HTMLDivElement>(null)
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, clipIds: string[] } | null>(null)
    const [takeFolderMenuClipId, setTakeFolderMenuClipId] = useState<string | null>(null)

    const pixelsPerBeat = zoom || 80;
    const playheadX = playhead * pixelsPerBeat;

    useEffect(() => {
        let frameId: number;
        const tick = () => {
            if (playing) {
                const preciseBeat = advancedScheduler.getPreciseCurrentBeat();
                const x = preciseBeat * pixelsPerBeat;
                if (playheadHandleRef.current) {
                    playheadHandleRef.current.style.transform = `translateX(${x}px)`;
                }
                if (playheadLineRef.current) {
                    playheadLineRef.current.style.transform = `translateX(${x}px)`;
                }
            } else {
                const x = playhead * pixelsPerBeat;
                if (playheadHandleRef.current) {
                    playheadHandleRef.current.style.transform = `translateX(${x}px)`;
                }
                if (playheadLineRef.current) {
                    playheadLineRef.current.style.transform = `translateX(${x}px)`;
                }
            }
            frameId = requestAnimationFrame(tick);
        };
        frameId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frameId);
    }, [playing, playhead, pixelsPerBeat]);

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

        // Normalize tool IDs (ToolsMenu uses pointer/pencil/scissors, engine uses select/draw/split)
        const tool = currentTool === 'pointer' ? 'select'
            : currentTool === 'pencil' ? 'draw'
            : currentTool === 'scissors' ? 'split'
            : currentTool;

        // --- Erase tool: delete clip on click ---
        if (tool === 'erase') {
            deleteClip(clip.id);
            return;
        }

        // --- Split tool: split clip at click position ---
        if (tool === 'split') {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const offsetX = e.clientX - rect.left;
            const splitBeat = clip.start + offsetX / pixelsPerBeat;
            splitClip(clip.id, getSnapValue(splitBeat));
            return;
        }

        // --- Mute tool: toggle mute on click ---
        if (tool === 'mute') {
            updateClip(clip.id, { muted: !clip.muted });
            return;
        }

        // --- Default: select (pointer) tool ---
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
        const scrollLeft = containerRef.current?.scrollLeft || 0;
        
        const updatePosition = (clientX: number) => {
            const x = clientX - rect.left + (containerRef.current?.scrollLeft || 0);
            const beat = Math.max(0, x / pixelsPerBeat);
            movePlayhead(beat);
            
            // Instantly update the DOM refs for ultra-smooth scrubbing feedback
            // (bypassing React re-render delay)
            const px = beat * pixelsPerBeat;
            if (playheadHandleRef.current) playheadHandleRef.current.style.transform = `translateX(${px}px)`;
            if (playheadLineRef.current) playheadLineRef.current.style.transform = `translateX(${px}px)`;
        };
        
        updatePosition(e.clientX);

        const onMouseMove = (me: MouseEvent) => {
            updatePosition(me.clientX);
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const handleTimelineMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const startX = e.clientX - rect.left + containerRef.current!.scrollLeft;
        const startY = e.clientY - rect.top + containerRef.current!.scrollTop;
        const startTime = startX / pixelsPerBeat;

        if (currentTool === 'marquee') {
            selectClips([]);
            selectClip(null);
            setMarqueeSelection(null);

            const onMouseMove = (me: MouseEvent) => {
                const currentX = me.clientX - rect.left + containerRef.current!.scrollLeft;
                const currentTime = currentX / pixelsPerBeat;

                const selectionStart = Math.min(startTime, currentTime);
                const selectionEnd = Math.max(startTime, currentTime);

                const currentY = me.clientY - rect.top + containerRef.current!.scrollTop;
                const top = Math.min(startY, currentY);
                const bottom = Math.max(startY, currentY);

                const selectedTrackIds: string[] = [];
                let currentOffset = 48; // Timeline ruler height
                tracks.forEach(track => {
                    const currentHeight = trackHeight * (track.zoom || 1);
                    const activeClips = clips.filter(c => c.trackId === track.id && c.alternativeId === track.activeAlternativeId);
                    const openTakeFolders = activeClips.filter(c => c.isTakeFolder && c.isTakeFolderOpen);
                    const maxTakes = openTakeFolders.reduce((max, c) => Math.max(max, (c.takes?.length || 0)), 0);
                    const trackTotalHeight = currentHeight + (maxTakes * currentHeight);

                    if (currentOffset + trackTotalHeight > top && currentOffset < bottom) {
                        selectedTrackIds.push(track.id);
                    }
                    currentOffset += trackTotalHeight;
                });

                // Find clip IDs within the selection bounds
                const selectedClipIds: string[] = [];
                const selectedLaneIds: string[] = [];
                clips.forEach(clip => {
                    if (!selectedTrackIds.includes(clip.trackId)) return;
                    if (clip.start < selectionEnd && (clip.start + clip.duration) > selectionStart) {
                        selectedClipIds.push(clip.id);
                        if ('subTrackId' in clip && (clip as any).subTrackId) selectedLaneIds.push((clip as any).subTrackId);
                    }
                });

                setMarqueeSelection({
                    id: `marquee-${Date.now()}`,
                    startBeat: getSnapValue(selectionStart),
                    endBeat: getSnapValue(selectionEnd),
                    trackIds: selectedTrackIds,
                    clipIds: selectedClipIds,
                    laneIds: selectedLaneIds
                });
            };

            const onMouseUp = () => {
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        } else if (currentTool === 'pencil' || currentTool === 'draw') {
            const currentY = e.clientY - rect.top + containerRef.current!.scrollTop;
            let currentOffset = 48; // Timeline ruler height
            let clickedTrackId: string | null = null;
            let clickedTrack: any = null;

            for (const track of tracks) {
                const currentHeight = trackHeight * (track.zoom || 1);
                const activeClips = clips.filter(c => c.trackId === track.id && c.alternativeId === track.activeAlternativeId);
                const openTakeFolders = activeClips.filter(c => c.isTakeFolder && c.isTakeFolderOpen);
                const maxTakes = openTakeFolders.reduce((max, c) => Math.max(max, (c.takes?.length || 0)), 0);
                const trackTotalHeight = currentHeight + (maxTakes * currentHeight);

                if (currentY >= currentOffset && currentY < currentOffset + trackTotalHeight) {
                    clickedTrackId = track.id;
                    clickedTrack = track;
                    break;
                }
                currentOffset += trackTotalHeight;
            }

            if (clickedTrackId && clickedTrack) {
                const isMidi = clickedTrack.type === 'midi' || clickedTrack.type === 'software-instrument';
                if (isMidi) {
                    const snappedStart = getSnapValue(startTime);
                    useProjectStore.getState().addClip({
                        id: `clip-${Date.now()}`,
                        trackId: clickedTrackId,
                        name: 'MIDI Region',
                        start: snappedStart,
                        duration: 4,
                        type: 'midi',
                        color: clickedTrack.color || '#63ed63',
                        alternativeId: clickedTrack.activeAlternativeId
                    } as any);
                }
            }
        } else {
            selectClips([]);
            selectClip(null);
            setMarqueeSelection(null);
        }
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

    const TOOL_CURSORS: Record<string, string> = {
        pointer: 'default',
        select: 'default',
        split: 'crosshair',
        scissors: 'crosshair',
        erase: 'not-allowed',
        draw: 'crosshair',
        pencil: 'crosshair',
        zoom: 'zoom-in',
        mute: 'pointer',
        text: 'text',
        marquee: 'crosshair',
        fade: 'col-resize',
        'automation-select': 'default',
        'automation-curve': 'crosshair',
        flex: 'ew-resize',
        solo: 'default',
        glue: 'default',
    };
    const timelineCursor = TOOL_CURSORS[currentTool] || 'default';

    const totalTracksHeight = tracks.reduce((total, track) => {
        const currentHeight = trackHeight * (track.zoom || 1);
        const activeClips = clips.filter(c => c.trackId === track.id && c.alternativeId === track.activeAlternativeId);
        const openTakeFolders = activeClips.filter(c => c.isTakeFolder && c.isTakeFolderOpen);
        const maxTakes = openTakeFolders.reduce((max, c) => Math.max(max, (c.takes?.length || 0)), 0);
        return total + currentHeight + (maxTakes * currentHeight);
    }, 0);

    return (
        <div
            className="flex-1 bg-studio-sunken overflow-x-auto overflow-y-auto relative flex flex-col custom-scrollbar select-none z-10"
            ref={containerRef}
            style={{ cursor: timelineCursor }}
            onMouseDown={handleTimelineMouseDown}
            onContextMenu={(e) => e.preventDefault()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* 1. Logic Pro Time Ruler — Two-Row Design */}
            <div
                className="sticky top-0 z-50 shrink-0 cursor-pointer"
                style={{ height: '48px', width: `${totalWidth}px` }}
                onMouseDown={handleRulerMouseDown}
            >
                {/* ── Top Row: Bar Numbers ── */}
                <div className="absolute inset-x-0 top-0 h-[24px] bg-studio-control border-b border-studio-line">
                    <div className="absolute inset-0 flex" style={{ width: `${totalWidth}px` }}>
                        {[...Array(400)].map((_, i) => (
                            <div key={i} className="relative h-full border-r border-studio-line-strong" style={{ width: `${pixelsPerBeat * 4}px`, flexShrink: 0 }}>
                                <span className="text-[13px] font-bold text-studio-text-mid absolute top-[2px] left-[4px] tabular-nums select-none">
                                    {1 + i}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Bottom Row: Beat Subdivision Ticks ── */}
                <div className="absolute inset-x-0 top-[24px] h-[24px] bg-studio-control border-b border-studio-line">
                    {/* Thin horizontal line at the very top of this row */}
                    <div className="absolute inset-x-0 top-0 h-px bg-studio-control"></div>
                    <div className="absolute inset-0 flex" style={{ width: `${totalWidth}px` }}>
                        {[...Array(400)].map((_, i) => (
                            <div key={i} className="relative h-full border-r border-studio-line-strong" style={{ width: `${pixelsPerBeat * 4}px`, flexShrink: 0 }}>
                                {/* 8 subdivision ticks per bar (every half-beat) */}
                                {[...Array(8)].map((_, j) => (
                                    <div
                                        key={j}
                                        className="absolute top-0 w-px"
                                        style={{
                                            left: `${(j / 8) * 100}%`,
                                            height: j === 0 ? '100%' : j === 4 ? '10px' : '6px',
                                            backgroundColor: j === 0 ? '#4a4a4a' : '#555'
                                        }}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Markers Overlay (if present) */}
                <div className="absolute inset-x-0 top-[24px] h-[24px] pointer-events-none">
                    {globalTracks.markers.map(m => (
                        <div key={m.id} className="absolute h-full border-l border-yellow-500/50 bg-yellow-500/10 px-1" style={{ left: `${m.time * pixelsPerBeat}px`, width: `${m.duration * pixelsPerBeat}px` }}>
                            <span className="text-[8px] font-black text-yellow-500/60 uppercase">{m.text}</span>
                        </div>
                    ))}
                </div>

                {/* Cycle Area */}
                {(cycleEnabled || skipCycleEnabled) && (
                    <div
                        className={`absolute top-0 h-[24px] z-40 transition-all duration-300 rounded-[1px] ${skipCycleEnabled ? 'bg-studio-sunken shadow-[inset_0_0_10px_rgba(0,0,0,0.8)] border-x border-studio-line' : 'bg-yellow-500/80 shadow-[0_4px_10px_rgba(234,179,8,0.2)] border-x border-yellow-400'}`}
                        style={{
                            left: `${locatorLeft * pixelsPerBeat}px`,
                            width: `${(locatorRight - locatorLeft) * pixelsPerBeat}px`,
                            backgroundImage: skipCycleEnabled ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(234,179,8,0.05) 10px, rgba(234,179,8,0.05) 20px)' : 'none'
                        }}
                    >
                        {skipCycleEnabled && (
                            <div className="flex items-center justify-center gap-12 w-full h-full opacity-40">
                                <SkipCycleIcon className="w-3.5 h-3.5 text-yellow-500/80" />
                                <SkipCycleIcon className="w-3.5 h-3.5 text-yellow-500/80 rotate-180" />
                            </div>
                        )}
                        <div className="absolute left-0 top-0 bottom-0 w-1 flex items-center justify-center cursor-ew-resize hover:bg-white/20">
                            <div className="w-[1px] h-3 bg-white/[0.04]"></div>
                        </div>
                        <div className="absolute right-0 top-0 bottom-0 w-1 flex items-center justify-center cursor-ew-resize hover:bg-white/20">
                            <div className="w-[1px] h-3 bg-white/[0.04]"></div>
                        </div>
                    </div>
                )}

                {/* Autopunch Area */}
                {autopunchEnabled && (
                    <div
                        className="absolute h-[8px] top-[8px] z-45 bg-red-600/60 shadow-[0_0_10px_rgba(220,38,38,0.4)] border-x border-red-500 rounded-[1px] cursor-ew-resize"
                        style={{
                            left: `${autopunchStart * pixelsPerBeat}px`,
                            width: `${(autopunchEnd - autopunchStart) * pixelsPerBeat}px`
                        }}
                    >
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-white/20"></div>
                        <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-white/20"></div>
                    </div>
                )}

                {/* Playhead — Teardrop / Pick Shape */}
                <div
                    ref={playheadHandleRef}
                    className="absolute top-0 bottom-0 w-px studio-playhead z-50 pointer-events-none"
                    style={{ transform: `translateX(${playheadX}px)` }}
                >
                    {/* Teardrop SVG */}
                    <svg
                        className="absolute pointer-events-auto"
                        width="16" height="24"
                        viewBox="0 0 16 24"
                        style={{ left: '-8px', top: '24px' }}
                    >
                        <path
                            d="M8 0 C8 0, 15 6, 15 12 C15 16.5 12 20 8 24 C4 20 1 16.5 1 12 C1 6 8 0 8 0Z"
                            fill="#e8fbff"
                            stroke="#22d3ee"
                            strokeWidth="0.5"
                            style={{ filter: 'drop-shadow(0 0 4px #22d3ee)' }}
                        />
                        <line x1="8" y1="6" x2="8" y2="18" stroke="#0d141d" strokeWidth="1" />
                    </svg>
                </div>

                {/* Project Start/End Markers */}
                <div
                    className="absolute top-0 h-[24px] w-2.5 cursor-ew-resize group hover:bg-white/10 z-[55] flex flex-col items-center"
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
                    <div className="w-0.5 h-full bg-studio-control group-hover:bg-studio-control transition-colors"></div>
                    <div className="w-2.5 h-2.5 bg-studio-control rounded-sm border border-black/40 -mt-1 shadow-lg"></div>
                </div>

                <div
                    className="absolute top-0 h-[24px] w-2.5 cursor-ew-resize group hover:bg-white/10 z-[55] flex flex-col items-center"
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
                    <div className="w-0.5 h-full bg-studio-control group-hover:bg-studio-control transition-colors"></div>
                    <div className="w-2.5 h-2.5 bg-studio-control rounded-sm border border-black/40 -mt-1 shadow-lg"></div>
                </div>
            </div>

            {/* 2. Main Grid Rendering Area */}
            <div className="relative flex-1 h-full" style={{ width: `${totalWidth}px` }}>
                {/* Visual Playhead Content Line */}
                <div
                    ref={playheadLineRef}
                    className="absolute inset-y-0 w-px studio-playhead z-50 pointer-events-none"
                    style={{ transform: `translateX(${playheadX}px)` }}
                />

                {/* Marquee Selection Rendering */}
                {marqueeSelection && (
                    <div 
                        className="absolute z-[60] border-2 border-accent-cyan/60 pointer-events-none rounded-sm"
                        style={{
                            left: `${marqueeSelection.startBeat * pixelsPerBeat}px`,
                            width: `${(marqueeSelection.endBeat - marqueeSelection.startBeat) * pixelsPerBeat}px`,
                            top: `${40 + tracks.findIndex(t => t.id === marqueeSelection.trackIds[0]) * trackHeight}px`,
                            height: `${marqueeSelection.trackIds.length * trackHeight}px`,
                        }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-accent-cyan/15 via-accent-cyan/5 to-transparent"></div>
                        <div className="absolute top-0 left-0 px-2 py-0.5 bg-accent-cyan/30 text-accent-cyan text-[10px] font-medium rounded-br">
                            {marqueeSelection.clipIds.length} clips
                        </div>
                    </div>
                )}

                {/* Vertical Rhythm Grids */}
                {tracks.length > 0 && (
                    <div className="absolute left-0 top-0 flex pointer-events-none z-10" style={{ height: `${totalTracksHeight}px` }}>
                        {[...Array(800)].map((_, i) => (
                            <div key={i} className={`h-full border-r ${(i + 1) % 16 === 0 ? 'border-accent-cyan/10' : (i + 1) % 4 === 0 ? 'border-white/[0.03]' : 'border-white/[0.01]'}`} style={{ width: `${pixelsPerBeat}px`, flexShrink: 0 }}></div>
                        ))}
                    </div>
                )}

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
                                                    className={`absolute ${clip.isTakeFolderOpen ? 'z-40 shadow-xl border-white/60' : ''} top-0.5 rounded-[4px] border shadow-2xl group cursor-move overflow-hidden transition-all transform active:scale-[0.99] ${selectedClipIds.includes(clip.id) ? 'ring-2 ring-white/70 ring-inset brightness-125 z-30' : ''} ${clip.muted ? 'opacity-40 grayscale-[0.6]' : 'opacity-100'}`}
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
                                                        color: neonTrackTextColor(clip.color),
                                                        backgroundColor: neonTrackAlpha(clip.color, 0.16),
                                                        borderColor: neonTrackAlpha(clip.color, 0.55),
                                                        boxShadow: `inset 0 0 20px ${neonTrackAlpha(clip.color, 0.14)}`,
                                                        backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,0.35) 100%)'
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
                                                    <div className="absolute top-0 left-0 right-0 h-4.5 px-2.5 flex items-center justify-between z-20 bg-black/35 backdrop-blur-[2px] border-b border-white/10">
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
                                                                    {clip.isTakeFolderOpen ? <ChevronDown className="w-2.5 h-2.5 text-white/80" /> : <ChevronRight className="w-2.5 h-2.5 text-white/80" />}
                                                                </div>
                                                            )}
                                                            {clip.isTakeFolder && (
                                                                <div className="flex items-center gap-1 mr-1.5 bg-white/10 px-1 rounded-sm border border-white/15 pointer-events-auto">
                                                                    <div 
                                                                        className={`p-0.5 cursor-pointer rounded-sm hover:bg-white/10 transition-colors ${clip.quickSwipeComping ? 'bg-white/20 shadow-inner' : ''}`}
                                                                        onMouseDown={(e) => {
                                                                            e.stopPropagation();
                                                                            updateClip(clip.id, { quickSwipeComping: !clip.quickSwipeComping });
                                                                        }}
                                                                        title="Quick Swipe Comping"
                                                                    >
                                                                        <Layers className={`w-2 h-2 ${clip.quickSwipeComping ? 'text-green-300' : 'text-white/60'}`} />
                                                                    </div>
                                                                    <div className="w-px h-3 bg-black/20 mx-0.5" />
                                                                    <div 
                                                                        className="relative p-0.5 cursor-pointer rounded-sm hover:bg-white/10 text-[8px] font-black text-white/80 flex items-center gap-0.5"
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
                                                                            <div className="absolute top-5 left-0 z-50 bg-studio-control text-studio-text rounded-sm border border-black/20 shadow-lg min-w-[220px]">
                                                                                <div className="px-2 py-1 border-b border-black/10 text-[11px] font-bold">Take Folder Menu</div>
                                                                                <button className="w-full px-2 py-1 text-left text-[11px] hover:bg-accent-cyan hover:text-white" onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); updateClip(clip.id, { quickSwipeComping: !clip.quickSwipeComping }); }}>
                                                                                    Quick Swipe Comping: {clip.quickSwipeComping ? 'On' : 'Off'}
                                                                                </button>
                                                                                <button className="w-full px-2 py-1 text-left text-[11px] hover:bg-accent-cyan hover:text-white" onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); saveTakeFolderComp(clip.id); }}>
                                                                                    Save Current Comp
                                                                                </button>
                                                                                <button className="w-full px-2 py-1 text-left text-[11px] hover:bg-accent-cyan hover:text-white" onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); createTakeFolderComp(clip.id); }}>
                                                                                    Create New Comp
                                                                                </button>
                                                                                <div className="px-2 py-1 text-[11px] font-bold text-studio-text-dim border-t border-black/10">Takes</div>
                                                                                {clip.takes.map((take, tIdx) => (
                                                                                    <div key={take.id} className={`px-2 py-1 cursor-pointer hover:bg-accent-cyan hover:text-white ${clip.activeTakeIndex === tIdx ? 'bg-accent-cyan text-white' : ''}`} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setActiveTake(clip, tIdx);
                                                                                        setTakeFolderMenuClipId(null);
                                                                                    }}>
                                                                                        {`Take ${tIdx + 1}`}
                                                                                    </div>
                                                                                ))}
                                                                                {clip.comps && clip.comps.length > 0 && (
                                                                                    <>
                                                                                        <div className="px-2 py-1 text-[11px] font-bold text-studio-text-dim border-t border-black/10">Comps</div>
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
                                                                                        <button className="text-[10px] px-2 py-1 bg-white/10 rounded-sm hover:bg-white/[0.14]" onMouseDown={e => e.stopPropagation()} onClick={e => {
                                                                                            e.stopPropagation();
                                                                                            if (!clip.comps?.length) return;
                                                                                            const compToDelete = clip.comps[clip.comps.length - 1];
                                                                                            deleteTakeFolderComp(clip.id, compToDelete.id);
                                                                                        }}>Delete Last Comp</button>
                                                                                        <button className="text-[10px] px-2 py-1 bg-white/10 rounded-sm hover:bg-white/[0.14]" onMouseDown={e => e.stopPropagation()} onClick={e => {
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
                                                                clip.type === 'audio' ? <Volume2 className="w-2.5 h-2.5 text-white/60 pointer-events-none" /> : <Music className="w-2.5 h-2.5 text-white/60 pointer-events-none" />
                                                            )}
                                                            <span className={`text-[9px] font-black tracking-tight truncate leading-none uppercase pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${clip.aliasOf ? 'italic' : ''}`}>{clip.aliasOf ? (clip.aliasName || clips.find(c => c.id === clip.aliasOf)?.name || clip.name) : clip.name}</span>
                                                            {clip.aliasOf && clips.find(c => c.id === clip.aliasOf) && zoom >= 60 && (
                                                                <span className="text-[7px] text-white/45 block truncate pointer-events-none">{clips.find(c => c.id === clip.aliasOf)?.name || 'Missing original'}</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Media Content Visualization */}
                                                    <div className="absolute inset-x-0 bottom-0 top-[18px] pointer-events-none">
                                                        {clip.type === 'audio' ? (
                                                            <div className="absolute inset-x-0 inset-y-1"><WaveformSVG color={neonTrackColor(clip.color)} peaks={clip.waveformPeaks} /></div>
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
                                                                <div className={`absolute inset-0 rounded-[2px] border ${clip.activeTakeIndex === tIdx ? 'border-accent-cyan/50 mix-blend-screen' : 'border-black/50 opacity-50'} transition-all`} 
                                                                    style={{ backgroundColor: neonTrackAlpha(take.color, 0.16), borderColor: neonTrackAlpha(take.color, 0.5) }}
                                                                    onMouseDown={(e) => {
                                                                        e.stopPropagation();
                                                                        if (clip.quickSwipeComping) {
                                                                            // Logic for QSC selecting this take
                                                                            updateClip(clip.id, { activeTakeIndex: tIdx });
                                                                        }
                                                                    }}>
                                                                    <div className="absolute top-0 left-0 right-0 h-4.5 px-2 flex items-center z-10 bg-black/35 text-[9px] font-black text-white/80">
                                                                        Take {tIdx + 1}
                                                                    </div>
                                                                    <div className="absolute inset-x-0 bottom-0 top-[18px] pointer-events-none">
                                                                        <WaveformSVG color={neonTrackColor(take.color)} peaks={take.waveformPeaks} />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Annotations */}
                                    {annotations.filter(a => a.laneY === tracks.indexOf(track)).map(a => (
                                        <div key={a.id} className="absolute z-25 pointer-events-auto group/annot" style={{ left: `${a.startBeat * pixelsPerBeat}px`, top: '0px', height: `${currentHeight}px` }}>
                                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-yellow-500/20 border-l-2 border-yellow-400 text-yellow-300 text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
                                                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                                                {a.text}
                                            </div>
                                        </div>
                                    ))}
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
                                                    color: neonTrackTextColor(clip.color || track.color),
                                                    backgroundColor: neonTrackAlpha(clip.color || track.color, 0.16),
                                                    borderColor: neonTrackAlpha(clip.color || track.color, 0.4)
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
                    className="fixed z-[200] w-64 bg-studio-control/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-100"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onMouseLeave={() => setContextMenu(null)}
                >
                    <div className="px-3 py-1.5 text-[10px] font-black text-studio-text-dim uppercase tracking-widest border-b border-white/5 mb-1">Region Operations</div>
                    <button
                        className="w-full px-4 py-2 text-left text-[12px] font-bold text-studio-text hover:bg-accent-cyan hover:text-white transition-colors"
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
                        className="w-full px-4 py-2 text-left text-[12px] font-bold text-studio-text hover:bg-accent-cyan hover:text-white transition-colors"
                        onClick={() => {
                            useProjectStore.getState().makeAliasesFromSelection();
                            setContextMenu(null);
                        }}
                    >
                        Repeat Regions as Aliases
                    </button>
                    <button
                        className="w-full px-4 py-2 text-left text-[12px] font-bold text-studio-text hover:bg-accent-cyan hover:text-white transition-colors"
                        onClick={() => {
                            const first = contextMenu.clipIds[0];
                            useProjectStore.getState().selectAliasesOfRegion(first);
                            setContextMenu(null);
                        }}
                    >
                        Select Aliases of Region
                    </button>
                    <button
                        className="w-full px-4 py-2 text-left text-[12px] font-bold text-studio-text hover:bg-accent-cyan hover:text-white transition-colors"
                        onClick={() => {
                            const first = contextMenu.clipIds[0];
                            useProjectStore.getState().selectOriginalOfAlias(first);
                            setContextMenu(null);
                        }}
                    >
                        Select Original of Alias
                    </button>
                    <button
                        className="w-full px-4 py-2 text-left text-[12px] font-bold text-studio-text hover:bg-accent-cyan hover:text-white transition-colors"
                        onClick={() => {
                            const first = contextMenu.clipIds[0];
                            useProjectStore.getState().convertAliasToRegionCopy(first);
                            setContextMenu(null);
                        }}
                    >
                        Convert Selected Alias to Copy
                    </button>
                    <div className="h-px bg-white/5 my-1" />
                    <button className="w-full px-4 py-2 text-left text-[12px] font-bold text-studio-text hover:bg-accent-cyan hover:text-white transition-colors flex items-center justify-between group">
                        Rename Regions...
                        <span className="text-[10px] text-studio-text-dim group-hover:text-white/60">⇧N</span>
                    </button>
                    <button className="w-full px-4 py-2 text-left text-[12px] font-bold text-studio-text hover:bg-accent-cyan hover:text-white transition-colors">
                        Colors
                    </button>
                    <button className="w-full px-4 py-2 text-left text-[12px] font-bold text-studio-text hover:bg-accent-cyan hover:text-white transition-colors"
                        onClick={() => {
                            useProjectStore.getState().selectOrphanAliases();
                            setContextMenu(null);
                        }}
                    >
                        Select Orphan Aliases
                    </button>
                    <button className="w-full px-4 py-2 text-left text-[12px] font-bold text-studio-text hover:bg-accent-cyan hover:text-white transition-colors"
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
                    <button className="w-full px-4 py-2 text-left text-[12px] font-bold text-studio-text hover:bg-accent-cyan hover:text-white transition-colors"
                        onClick={() => {
                            const first = contextMenu.clipIds[0];
                            const preset = prompt('Stem Splitter preset (All Stems, Vocals + Music, Vocals Only, Drums + Bass)', 'All Stems') || 'All Stems';
                            useProjectStore.getState().stemSplitter(first, { preset, includeSubmix: true });
                            setContextMenu(null);
                        }}
                    >
                        Stem Splitter (Quick)
                    </button>
                    <button className="w-full px-4 py-2 text-left text-[12px] font-bold text-studio-text hover:bg-accent-cyan hover:text-white transition-colors"
                        onClick={() => {
                            useProjectStore.getState().convertOrphanAliasesToCopies();
                            setContextMenu(null);
                        }}
                    >
                        Convert Orphan Aliases to Copies
                    </button>
                    <button className="w-full px-4 py-2 text-left text-[12px] font-bold text-studio-text hover:bg-accent-cyan hover:text-white transition-colors"
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
        </div>
    )
}

function MIDIPoints({ clip }: { clip: Clip }) {
    const zoom = useProjectStore(s => s.zoom);
    if (!clip.notes) return null;
    // Notes glow in the clip's own colour, the MIDI counterpart of a tinted
    // waveform. Computed once per clip rather than once per note.
    const tint = neonTrackColor(clip.color);
    const glow = neonTrackAlpha(clip.color, 0.6);
    return (
        <div className="relative w-full h-full flex flex-col justify-center">
            {clip.notes.map(n => (
                <div
                    key={n.id}
                    className="absolute rounded-full"
                    style={{
                        left: `${(n.start || 0) * (zoom || 80)}px`,
                        width: `${Math.max(3, (n.duration * (zoom || 80)) - 1)}px`,
                        top: `${(1 - (n.pitch - 36) / 48) * 100}%`,
                        height: '2px',
                        backgroundColor: tint,
                        boxShadow: `0 0 4px ${glow}`
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
