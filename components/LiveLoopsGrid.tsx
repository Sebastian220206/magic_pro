"use client"

import React, { useMemo, useState, useEffect, useRef } from "react";
import { useProjectStore } from "@/store/projectStore";
import { audioEngine } from "@/engine/AudioEngineAdapter";
import { PlayCircle, PauseCircle, RotateCcw, LayoutGrid } from "lucide-react";

const DEFAULT_SCENES = 8;

type QuantizeMode = 'off' | 'bar' | 'half' | 'quarter';

interface LiveLoopCellState {
    clipId?: string;
    name?: string;
    quantize?: QuantizeMode;
}

export function LiveLoopsGrid() {
    const tracks = useProjectStore((state) => state.tracks);
    const clips = useProjectStore((state) => state.clips);
    const playing = useProjectStore((state) => state.playing);
    const playhead = useProjectStore((state) => state.playhead);
    const cycleEnabled = useProjectStore((state) => state.cycleEnabled);
    const locatorLeft = useProjectStore((state) => state.locatorLeft);
    const locatorRight = useProjectStore((state) => state.locatorRight);
    const globalTracks = useProjectStore((state) => state.globalTracks);
    const duplicateClip = useProjectStore((state) => state.duplicateClip);
    const deleteClip = useProjectStore((state) => state.deleteClip);

    const [activeCells, setActiveCells] = useState<Record<string, number | null>>({});
    const [queuedCells, setQueuedCells] = useState<Record<string, boolean>>({});
    const [selectedCells, setSelectedCells] = useState<Record<string, boolean>>({});
    const [cellStates, setCellStates] = useState<Record<string, LiveLoopCellState>>({});
    const [sceneNames, setSceneNames] = useState<Record<number, string>>({});
    const [gridStopMode, setGridStopMode] = useState<'stop' | 'pause'>('stop');
    const [sceneCount, setSceneCount] = useState(DEFAULT_SCENES);
    const [barsPerScene, setBarsPerScene] = useState(1);
    const [quantizeMode, setQuantizeMode] = useState<QuantizeMode>('bar');
    const [lastSelectedCell, setLastSelectedCell] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; trackId: string; sceneIndex: number; key: string } | null>(null);

    const previousPlayheadRef = useRef<number>(playhead);

    const trackRows = useMemo(() => {
        if (tracks.length > 0) return tracks;
        return Array.from({ length: 4 }).map((_, i) => ({ id: `track-temp-${i + 1}`, name: `Track ${i + 1}` } as any));
    }, [tracks]);

    const getCellKey = (trackId: string, sceneIndex: number) => `${trackId}:${sceneIndex}`;

    const toggleQueueCell = (trackId: string, sceneIndex: number) => {
        const key = getCellKey(trackId, sceneIndex);
        setQueuedCells((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleSceneQueue = (sceneIndex: number) => {
        const next = { ...queuedCells };
        trackRows.forEach((track) => {
            const key = getCellKey(track.id, sceneIndex);
            next[key] = !next[key];
        });
        setQueuedCells(next);
    };

    const isUpperArea = (e: React.MouseEvent<HTMLButtonElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        return e.clientY - rect.top < rect.height / 2;
    };

    const renameCell = (trackId: string, sceneIndex: number) => {
        const key = getCellKey(trackId, sceneIndex);
        const existing = cellStates[key]?.name;
        const newName = window.prompt('Cell name', existing || `${trackId} - Scene ${sceneIndex + 1}`);
        if (newName !== null) {
            setCellStates((prev) => ({ ...prev, [key]: { ...prev[key], name: newName } }));
        }
    };

    const renameScene = (sceneIndex: number) => {
        const newName = window.prompt('Scene name', sceneNames[sceneIndex] || `Scene ${sceneIndex + 1}`);
        if (newName !== null) {
            setSceneNames((prev) => ({ ...prev, [sceneIndex]: newName }));
        }
    };

    const triggerCell = (trackId: string, sceneIndex: number) => {
        const key = getCellKey(trackId, sceneIndex);
        const cell = cellStates[key];

        if (cell && cell.clipId) {
            const clip = clips.find((c) => c.id === cell.clipId);
            if (clip) {
                audioEngine.playRegion(trackId, clip, playhead);
            }
        }

        setActiveCells((prev) => ({ ...prev, [trackId]: sceneIndex }));
        setQueuedCells((prev) => ({ ...prev, [key]: false }));
    };

    const triggerQueuedCells = () => {
        const queuedKeys = Object.entries(queuedCells).filter(([, queued]) => queued).map(([key]) => key);
        if (!queuedKeys.length) return;

        const nextActive = { ...activeCells };

        queuedKeys.forEach((key) => {
            const [trackId, sceneIndexStr] = key.split(':');
            const sceneIndex = Number(sceneIndexStr);
            const cell = cellStates[key];

            if (cell && cell.clipId) {
                const clip = clips.find((c) => c.id === cell.clipId);
                if (clip) {
                    audioEngine.playRegion(trackId, clip, playhead);
                }
            }
            nextActive[trackId] = sceneIndex;
        });

        setActiveCells(nextActive);
        setQueuedCells({});
    };

    const isQuantizeBoundary = (previous: number, current: number) => {
        const signature = globalTracks.signature[0] || { numerator: 4, denominator: 4 };
        const beatsPerBar = (4 / signature.denominator) * signature.numerator;
        if (quantizeMode === 'off') return false;

        const step = quantizeMode === 'bar' ? beatsPerBar : quantizeMode === 'half' ? beatsPerBar / 2 : beatsPerBar / 4;
        const prevBoundary = Math.floor(previous / step);
        const currentBoundary = Math.floor(current / step);

        return currentBoundary !== prevBoundary;
    };

    useEffect(() => {
        if (!playing) {
            previousPlayheadRef.current = playhead;
            return;
        }

        const previous = previousPlayheadRef.current;
        const current = playhead;
        const cycleJumped = cycleEnabled && previous > locatorRight - 0.01 && current <= locatorLeft + 0.01;
        const quantizedTick = !cycleEnabled && (quantizeMode === 'off' ? false : isQuantizeBoundary(previous, current));

        if (cycleJumped || quantizedTick || (quantizeMode === 'off' && Object.keys(queuedCells).some((k) => queuedCells[k]))) {
            triggerQueuedCells();
        }

        previousPlayheadRef.current = current;
    }, [playhead, playing, cycleEnabled, locatorLeft, locatorRight, quantizeMode, queuedCells]);

    const openCellContextMenu = (trackId: string, sceneIndex: number, e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        const key = getCellKey(trackId, sceneIndex);
        setContextMenu({ x: e.clientX, y: e.clientY, trackId, sceneIndex, key });
    };

    const closeContextMenu = () => setContextMenu(null);

    const applyContextAction = (action: 'play' | 'queue' | 'rename' | 'duplicate' | 'delete' | 'assign') => {
        if (!contextMenu) return;
        const { trackId, sceneIndex, key } = contextMenu;
        const cell = cellStates[key];

        if (action === 'play') {
            triggerCell(trackId, sceneIndex);
        }

        if (action === 'queue') {
            toggleQueueCell(trackId, sceneIndex);
        }

        if (action === 'rename') {
            const newName = window.prompt('Cell name', cell?.name || `${trackId} - Scene ${sceneIndex + 1}`);
            if (newName !== null) {
                setCellStates((prev) => ({ ...prev, [key]: { ...prev[key], name: newName } }));
            }
        }

        if (action === 'duplicate') {
            const nextScene = (sceneIndex + 1) % sceneCount;
            const destKey = getCellKey(trackId, nextScene);
            setCellStates((prev) => ({ ...prev, [destKey]: { ...prev[key], name: `${prev[key]?.name || `Scene ${sceneIndex + 1}`} Copy` } }));
            if (cell?.clipId) {
                duplicateClip(cell.clipId);
            }
        }

        if (action === 'delete') {
            setCellStates((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
            setActiveCells((prev) => ({ ...prev, [trackId]: prev[trackId] === sceneIndex ? null : prev[trackId] }));
            setQueuedCells((prev) => ({ ...prev, [key]: false }));
            setSelectedCells((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
            if (cell?.clipId) {
                deleteClip(cell.clipId);
            }
        }

        if (action === 'assign') {
            const clipIdPrompt = window.prompt('Clip ID to assign to this cell', cell?.clipId || '');
            if (clipIdPrompt) {
                setCellStates((prev) => ({ ...prev, [key]: { ...prev[key], clipId: clipIdPrompt } }));
            }
        }

        closeContextMenu();
    };

    const onCellClick = (trackId: string, sceneIndex: number, e: React.MouseEvent<HTMLButtonElement>) => {
        const key = getCellKey(trackId, sceneIndex);

        if (e.button === 2) {
            return;
        }

        if (e.altKey && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            setSelectedCells((prev) => ({ ...prev, [key]: !prev[key] }));
            setLastSelectedCell(key);
            return;
        }

        if (e.shiftKey) {
            e.preventDefault();
            if (lastSelectedCell) {
                const [startTrack, startSceneRaw] = lastSelectedCell.split(':');
                const startScene = Number(startSceneRaw);
                if (startTrack === trackId) {
                    const from = Math.min(startScene, sceneIndex);
                    const to = Math.max(startScene, sceneIndex);
                    const next = { ...selectedCells };
                    for (let i = from; i <= to; i++) {
                        next[getCellKey(trackId, i)] = true;
                    }
                    setSelectedCells(next);
                    setLastSelectedCell(key);
                    return;
                }
            }
            setSelectedCells((prev) => ({ ...prev, [key]: true }));
            setLastSelectedCell(key);
            return;
        }

        if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            renameCell(trackId, sceneIndex);
            setLastSelectedCell(key);
            return;
        }

        if (e.altKey) {
            e.preventDefault();
            toggleQueueCell(trackId, sceneIndex);
            setLastSelectedCell(key);
            return;
        }

        setLastSelectedCell(key);

        if (quantizeMode === 'off' && !cycleEnabled) {
            setActiveCells((prev) => ({ ...prev, [trackId]: sceneIndex }));
            setQueuedCells((prev) => ({ ...prev, [key]: false }));
            triggerCell(trackId, sceneIndex);
            return;
        }

        setQueuedCells((prev) => ({ ...prev, [key]: true }));
    };

    const triggerScene = (sceneIndex: number) => {
        if (quantizeMode === 'off' && !cycleEnabled) {
            trackRows.forEach((track) => triggerCell(track.id, sceneIndex));
            return;
        }

        const next = { ...queuedCells };
        trackRows.forEach((track) => {
            const key = getCellKey(track.id, sceneIndex);
            next[key] = true;
        });
        setQueuedCells(next);
    };

    const stopAll = () => {
        if (gridStopMode === 'pause') {
            // In pause mode we keep queued cells and clear active
            setActiveCells({});
            return;
        }
        setActiveCells({});
        setQueuedCells({});
    };

    const stopTrack = (trackId: string) => {
        setActiveCells((prev) => ({ ...prev, [trackId]: null }));
    };

    const rowClass = "border-b border-white/10 flex items-center h-14";

    return (
        <div className="flex flex-col h-full bg-[#0f1215] text-white">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-[#111621]">
                <LayoutGrid className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold">Live Loops Grid</h3>
                <div className="flex items-center gap-2 ml-2 text-xs text-slate-200">
                    <label className="flex items-center gap-1">Scenes:
                        <input type="number" min={4} max={32} value={sceneCount} onChange={(e) => setSceneCount(Math.max(4, Math.min(32, Number(e.target.value) || DEFAULT_SCENES)))} className="w-16 p-1 text-black rounded" />
                    </label>
                    <label className="flex items-center gap-1">Bars/Scene:
                        <input type="number" min={1} max={8} value={barsPerScene} onChange={(e) => setBarsPerScene(Math.max(1, Math.min(8, Number(e.target.value) || 1)))} className="w-16 p-1 text-black rounded" />
                    </label>
                    <label className="flex items-center gap-1">Quantize:
                        <select value={quantizeMode} onChange={(e) => setQuantizeMode(e.target.value as QuantizeMode)} className="w-24 p-1 text-black rounded">
                            <option value="off">Off</option>
                            <option value="quarter">1/4</option>
                            <option value="half">1/2</option>
                            <option value="bar">1 Bar</option>
                        </select>
                    </label>
                </div>
                <div className="flex-1" />
                <button
                    onClick={(e) => {
                        if (e.altKey) {
                            setGridStopMode((prev) => (prev === 'stop' ? 'pause' : 'stop'));
                            return;
                        }
                        stopAll();
                    }}
                    className="rounded-md border border-white/20 px-3 py-1 text-xs hover:bg-white/10"
                    title="Alt-click toggles stop mode between stop/pause"
                >
                    Grid Stop ({gridStopMode})
                </button>
                <button onClick={() => setActiveCells({})} className="rounded-md border border-white/20 px-3 py-1 text-xs hover:bg-white/10">
                    Pause All
                </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                <div className="w-32 border-r border-white/10 bg-[#121821]">
                    <div className="h-12 flex items-center justify-center border-b border-white/10 text-[11px] uppercase tracking-wider text-gray-300">Tracks</div>
                    {trackRows.map((track) => (
                        <div key={track.id} className="h-14 px-2 py-1 text-[11px] flex items-center border-b border-white/10 text-left">
                            <div className="flex-1 truncate">{track.name}</div>
                        </div>
                    ))}
                </div>

                <div className="flex-1 overflow-x-auto overflow-y-hidden relative">
                    <div className="flex border-b border-white/10" style={{ minWidth: `${sceneCount * 120}px` }}>
                        {Array.from({ length: sceneCount }).map((_, sceneIndex) => (
                            <div key={sceneIndex} className="w-28 h-10 flex flex-col items-center justify-center border-r border-white/10">
                                <button
                                    onClick={(e) => {
                                        if (e.altKey) {
                                            e.preventDefault();
                                            toggleSceneQueue(sceneIndex);
                                            return;
                                        }
                                        if (e.metaKey || e.ctrlKey) {
                                            e.preventDefault();
                                            renameScene(sceneIndex);
                                            return;
                                        }
                                        triggerScene(sceneIndex);
                                    }}
                                    className="w-20 h-6 bg-gray-700/50 hover:bg-sky-500/30 text-[11px] rounded-md"
                                    title={
                                        sceneNames[sceneIndex]
                                            ? `Scene ${sceneIndex + 1}: ${sceneNames[sceneIndex]}`
                                            : `Scene ${sceneIndex + 1}`
                                    }
                                >
                                    {sceneNames[sceneIndex] || `Scene ${sceneIndex + 1}`}
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col">
                        {trackRows.map((track) => (
                            <div key={track.id} className={rowClass}>
                                {Array.from({ length: sceneCount }).map((_, sceneIndex) => {
                                    const key = getCellKey(track.id, sceneIndex);
                                    const isPlaying = activeCells[track.id] === sceneIndex;
                                    const isQueued = queuedCells[key];
                                    const isSelected = selectedCells[key];
                                    return (
                                        <button
                                            key={sceneIndex}
                                            onClick={(e) => onCellClick(track.id, sceneIndex, e)}
                                            onContextMenu={(e) => openCellContextMenu(track.id, sceneIndex, e)}
                                            className={`h-10 w-28 m-1 rounded-md border border-white/10 text-[11px] text-left px-2 transition ${isPlaying ? 'bg-sky-500/60' : isSelected ? 'bg-amber-500/40' : 'bg-white/10 hover:bg-gray-200/20'}`}
                                            title={isQueued ? 'Queued (Alt+click toggles queue)' : 'Alt+click to queue'}
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="truncate">{isPlaying ? 'Playing' : isQueued ? 'Queued' : 'Stopped'}</span>
                                                <span>{isQueued ? 'Q' : ''}</span>
                                            </div>
                                            <div className="text-[9px] text-gray-200">{cellStates[key]?.name || `${track.name} · Scene ${sceneIndex + 1}`}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="w-32 border-l border-white/10 bg-[#121821]">
                    <div className="h-12 flex items-center justify-center border-b border-white/10 text-[11px] uppercase tracking-wider text-gray-300">Divider</div>
                    {trackRows.map((track) => {
                        const isPlaying = activeCells[track.id] !== undefined && activeCells[track.id] !== null;
                        return (
                            <div key={track.id} className="h-14 px-2 py-1 flex items-center justify-center border-b border-white/10">
                                <button
                                    onClick={(e) => {
                                        if (isPlaying) {
                                            stopTrack(track.id);
                                        } else {
                                            onCellClick(track.id, 0, e);
                                        }
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-white/20 bg-gray-700/40 hover:bg-sky-500/40"
                                >
                                    {isPlaying ? <PauseCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                                    {isPlaying ? "Stop" : "Play"}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {contextMenu && (
                <div className="fixed z-50 bg-[#1a1f2b] border border-white/20 rounded shadow-lg" style={{ top: contextMenu.y, left: contextMenu.x }}>
                    <button className="block w-full text-left px-4 py-2 text-xs hover:bg-white/10" onClick={() => applyContextAction('play')}>Play Now</button>
                    <button className="block w-full text-left px-4 py-2 text-xs hover:bg-white/10" onClick={() => applyContextAction('queue')}>Toggle Queue</button>
                    <button className="block w-full text-left px-4 py-2 text-xs hover:bg-white/10" onClick={() => applyContextAction('rename')}>Rename Clip/Cell</button>
                    <button className="block w-full text-left px-4 py-2 text-xs hover:bg-white/10" onClick={() => applyContextAction('duplicate')}>Duplicate Clip</button>
                    <button className="block w-full text-left px-4 py-2 text-xs hover:bg-white/10" onClick={() => applyContextAction('delete')}>Delete Clip</button>
                    <button className="block w-full text-left px-4 py-2 text-xs hover:bg-white/10" onClick={() => applyContextAction('assign')}>Assign Clip</button>
                </div>
            )}

            <div className="h-8 border-t border-white/10 px-3 flex items-center gap-2 text-[11px] text-gray-400">
                <RotateCcw className="w-3.5 h-3.5" />
                Alt-click cell = Queue/Unqueue, Shift-click upper half = select multiple, Cmd/Ctrl-click cell = rename; Alt-click Scene = queue scene; Cmd/Ctrl-click Scene = rename scene; Alt-click Grid Stop toggles stop/pause mode.
            </div>
        </div>
    );
}
