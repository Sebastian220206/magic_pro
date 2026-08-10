"use client"

/**
 * Step sequencer.
 *
 * Not a parallel data structure: a cell is on when the clip has a note at that
 * pitch and step, and toggling one adds or deletes that note. Open the piano
 * roll on the same clip and the pattern is there, because it is the same
 * pattern. A grid that looked right but edited a private copy would be the
 * worst of both — convincing and inert.
 *
 * The step sequencer tab has existed as a button since before this component;
 * it rendered nothing, because none of the four editor tabs ever switched
 * content.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useMidiStore } from '@/store/midiStore';
import { DRUM_LANES, STEP_RESOLUTIONS, type StepResolution } from '@/lib/drumLanes';
import { Eraser, Shuffle, Volume2, ToggleLeft } from 'lucide-react';

type EditMode = 'onoff' | 'velocity';

const STEP_COUNTS = [8, 16, 32, 64];
const DEFAULT_VELOCITY = 100;

/** A note sits in a step if its start rounds into that step's slot. */
function stepOf(startBeat: number, stepBeats: number): number {
    return Math.round(startBeat / stepBeats);
}

export function StepSequencer() {
    const notes = useMidiStore(s => s.getCurrentClip()?.notes ?? null);
    const addNote = useMidiStore(s => s.addNote);
    const deleteNote = useMidiStore(s => s.deleteNote);
    const currentBeat = useMidiStore(s => s.currentBeat);
    const isPlaying = useMidiStore(s => s.isPlaying);

    const [mode, setMode] = useState<EditMode>('onoff');
    const [resolution, setResolution] = useState<StepResolution>('1/16');
    const [stepCount, setStepCount] = useState(16);
    const [muted, setMuted] = useState<Set<number>>(new Set());
    const [soloed, setSoloed] = useState<Set<number>>(new Set());

    const stepBeats = STEP_RESOLUTIONS[resolution];

    /**
     * pitch -> step -> the note occupying it.
     * Rebuilt whenever the clip's notes change; the grid reads it O(1) per cell
     * rather than scanning every note for each of up to 1,024 cells.
     */
    const grid = useMemo(() => {
        const map = new Map<number, Map<number, { id: string; velocity: number }>>();
        for (const n of notes ?? []) {
            const step = stepOf(n.startBeat, stepBeats);
            if (step < 0 || step >= stepCount) continue;
            if (!map.has(n.pitch)) map.set(n.pitch, new Map());
            map.get(n.pitch)!.set(step, { id: n.id, velocity: n.velocity });
        }
        return map;
    }, [notes, stepBeats, stepCount]);

    const playingStep = isPlaying ? stepOf(currentBeat, stepBeats) % stepCount : -1;

    const toggle = useCallback((pitch: number, step: number) => {
        const existing = grid.get(pitch)?.get(step);
        if (existing) deleteNote(existing.id);
        else addNote(pitch, step * stepBeats, stepBeats, DEFAULT_VELOCITY);
    }, [grid, addNote, deleteNote, stepBeats]);

    /** In velocity mode a click cycles through four levels rather than erasing. */
    const cycleVelocity = useCallback((pitch: number, step: number) => {
        const existing = grid.get(pitch)?.get(step);
        if (!existing) {
            addNote(pitch, step * stepBeats, stepBeats, 40);
            return;
        }
        const next = existing.velocity >= 120 ? 0 : Math.min(127, existing.velocity + 40);
        deleteNote(existing.id);
        if (next > 0) addNote(pitch, step * stepBeats, stepBeats, next);
    }, [grid, addNote, deleteNote, stepBeats]);

    /** Drag-paint: the first cell decides whether the drag draws or erases. */
    const paint = useRef<{ drawing: boolean } | null>(null);

    const onCellDown = (pitch: number, step: number) => {
        if (mode === 'velocity') { cycleVelocity(pitch, step); return; }
        const on = Boolean(grid.get(pitch)?.get(step));
        paint.current = { drawing: !on };
        toggle(pitch, step);
    };

    const onCellEnter = (pitch: number, step: number) => {
        if (!paint.current || mode === 'velocity') return;
        const on = Boolean(grid.get(pitch)?.get(step));
        if (paint.current.drawing !== on) toggle(pitch, step);
    };

    const clearAll = () => {
        for (const perPitch of grid.values()) {
            for (const cell of perPitch.values()) deleteNote(cell.id);
        }
    };

    const anySoloed = soloed.size > 0;
    const toggleIn = (set: Set<number>, apply: (s: Set<number>) => void, pitch: number) => {
        const next = new Set(set);
        next.has(pitch) ? next.delete(pitch) : next.add(pitch);
        apply(next);
    };

    if (!notes) {
        return (
            <div className="flex-1 flex items-center justify-center flex-col gap-1 bg-studio-sunken">
                <div className="text-studio-text font-bold text-[13px]">No MIDI Region Selected</div>
                <div className="text-studio-text-dim text-[11px]">Select a MIDI clip in the timeline to edit its steps</div>
            </div>
        );
    }

    return (
        <div
            className="flex-1 flex flex-col min-h-0 bg-studio-sunken select-none"
            onMouseUp={() => { paint.current = null; }}
            onMouseLeave={() => { paint.current = null; }}
        >
            {/* ── Toolbar ── */}
            <div className="flex items-center gap-3 h-9 px-3 shrink-0 bg-studio-control border-b border-studio-line">
                <div className="flex rounded-md overflow-hidden border border-studio-line">
                    <button
                        onClick={() => setMode('onoff')}
                        className={`px-3 h-6 text-[11px] font-bold flex items-center gap-1.5 transition-colors ${mode === 'onoff' ? 'bg-accent-cyan text-[#04070b]' : 'text-studio-text-dim hover:text-studio-text'}`}
                    >
                        <ToggleLeft className="w-3.5 h-3.5" /> On/Off
                    </button>
                    <button
                        onClick={() => setMode('velocity')}
                        className={`px-3 h-6 text-[11px] font-bold flex items-center gap-1.5 transition-colors ${mode === 'velocity' ? 'bg-accent-cyan text-[#04070b]' : 'text-studio-text-dim hover:text-studio-text'}`}
                    >
                        <Volume2 className="w-3.5 h-3.5" /> Velocity
                    </button>
                </div>

                <div className="w-px h-5 bg-white/10" />

                <label className="flex items-center gap-1.5 text-[11px] font-bold text-studio-text-dim">
                    Steps
                    <select
                        value={stepCount}
                        onChange={e => setStepCount(Number(e.target.value))}
                        className="bg-studio-raised border border-studio-line rounded px-1.5 py-0.5 text-studio-text outline-none"
                    >
                        {STEP_COUNTS.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                </label>

                <label className="flex items-center gap-1.5 text-[11px] font-bold text-studio-text-dim">
                    Grid
                    <select
                        value={resolution}
                        onChange={e => setResolution(e.target.value as StepResolution)}
                        className="bg-studio-raised border border-studio-line rounded px-1.5 py-0.5 text-studio-text outline-none"
                    >
                        {Object.keys(STEP_RESOLUTIONS).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </label>

                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={clearAll}
                        className="flex items-center gap-1.5 px-2.5 h-6 rounded border border-studio-line text-[11px] font-bold text-studio-text-dim hover:text-studio-text hover:border-studio-line-strong transition-colors"
                    >
                        <Eraser className="w-3.5 h-3.5" /> Clear
                    </button>
                </div>
            </div>

            {/* ── Grid ── */}
            <div className="flex-1 overflow-auto custom-scrollbar-v">
                <div className="min-w-max">
                    {/* Step ruler */}
                    <div className="flex sticky top-0 z-20 bg-studio-raised border-b border-studio-line">
                        <div className="w-[190px] shrink-0 border-r border-studio-line" />
                        {Array.from({ length: stepCount }, (_, s) => (
                            <div
                                key={s}
                                className={`w-[38px] shrink-0 text-center text-[9px] font-black py-1 ${s % 4 === 0 ? 'text-studio-text' : 'text-studio-text-dim'}`}
                            >
                                {s % 4 === 0 ? s / 4 + 1 : ''}
                            </div>
                        ))}
                    </div>

                    {DRUM_LANES.map(lane => {
                        const isMuted = muted.has(lane.pitch) || (anySoloed && !soloed.has(lane.pitch));
                        const row = grid.get(lane.pitch);
                        return (
                            <div
                                key={lane.pitch}
                                className={`flex items-stretch ${lane.startsGroup ? 'border-t border-studio-line-strong' : 'border-t border-white/5'}`}
                                style={{ opacity: isMuted ? 0.4 : 1 }}
                            >
                                {/* Lane header */}
                                <div className="w-[190px] shrink-0 flex items-center gap-2 px-2 py-1 border-r border-studio-line bg-studio-panel">
                                    <span
                                        className="w-2 h-6 rounded-sm shrink-0"
                                        style={{ backgroundColor: lane.color, boxShadow: `0 0 8px ${lane.color}80` }}
                                    />
                                    <span className="text-[11px] font-bold text-studio-text truncate flex-1">{lane.name}</span>
                                    <button
                                        onClick={() => toggleIn(muted, setMuted, lane.pitch)}
                                        className={`w-5 h-5 rounded text-[9px] font-black transition-colors ${muted.has(lane.pitch) ? 'bg-amber-500 text-[#04070b]' : 'text-studio-text-dim hover:text-studio-text'}`}
                                        title="Mute lane"
                                    >M</button>
                                    <button
                                        onClick={() => toggleIn(soloed, setSoloed, lane.pitch)}
                                        className={`w-5 h-5 rounded text-[9px] font-black transition-colors ${soloed.has(lane.pitch) ? 'bg-accent-cyan text-[#04070b]' : 'text-studio-text-dim hover:text-studio-text'}`}
                                        title="Solo lane"
                                    >S</button>
                                </div>

                                {/* Steps */}
                                {Array.from({ length: stepCount }, (_, s) => {
                                    const cell = row?.get(s);
                                    const onBeat = s % 4 === 0;
                                    const playing = s === playingStep;
                                    // In velocity mode the fill height carries the value,
                                    // so a quiet step reads as quiet without a number.
                                    const fill = cell ? (mode === 'velocity' ? cell.velocity / 127 : 1) : 0;
                                    return (
                                        <div
                                            key={s}
                                            onMouseDown={() => onCellDown(lane.pitch, s)}
                                            onMouseEnter={() => onCellEnter(lane.pitch, s)}
                                            className="w-[38px] shrink-0 h-[30px] p-[2px] cursor-pointer"
                                            style={{
                                                backgroundColor: playing
                                                    ? 'rgba(232, 251, 255, 0.10)'
                                                    : onBeat ? 'rgba(255,255,255,0.03)' : 'transparent',
                                                borderLeft: onBeat
                                                    ? '1px solid rgba(34,211,238,0.22)'
                                                    : '1px solid rgba(255,255,255,0.05)',
                                            }}
                                        >
                                            <div className="w-full h-full rounded-[3px] flex items-end overflow-hidden"
                                                style={{ backgroundColor: `${lane.color}1a` }}
                                            >
                                                {cell && (
                                                    <div
                                                        className="w-full transition-all"
                                                        style={{
                                                            height: `${Math.max(18, fill * 100)}%`,
                                                            backgroundColor: lane.color,
                                                            boxShadow: `0 0 8px ${lane.color}b0`,
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
