"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import { useProjectStore } from "@/store/projectStore"
import { neonTrackColor, neonTrackAlpha, neonTrackTextColor } from "@/lib/trackColor"
import { X, ChevronLeft, ChevronRight, Scissors, Link2, Minus, Plus, Wand2, Music2, Activity, Sliders } from "lucide-react"
import { PitchDetector, FlexPitchProcessor, PitchNote } from "@/engine/audio/FlexPitch"
import { FormantCorrection } from "@/engine/audio/formantCorrection"

export function AudioTrackEditor() {
    const {
        showAudioTrackEditor, audioTrackEditorTrackId, audioTrackEditorZoom, audioTrackEditorHeight, audioTrackEditorWaveformZoom,
        setShowAudioTrackEditor, setAudioTrackEditorTrackId, setAudioTrackEditorZoom, setAudioTrackEditorHeight, setAudioTrackEditorWaveformZoom,
        tracks, clips, selectedClipId, selectedClipIds, selectClip, selectClips,
        updateClip, splitClipAtPlayhead, splitClipAtTime, joinClips, trimClip,
        playhead
    } = useProjectStore()

    const [viewMode, setViewMode] = useState<'track' | 'file' | 'flex'>('track')
    const [pitchCorrectionStrength, setPitchCorrectionStrength] = useState<number>(0.8)
    const [formantShift, setFormantShift] = useState<number>(0)
    const [preserveFormants, setPreserveFormants] = useState<boolean>(true)
    const [activeNotes, setActiveNotes] = useState<PitchNote[]>([])
    const [selectedNoteIndex, setSelectedNoteIndex] = useState<number | null>(null)

    if (!showAudioTrackEditor || !audioTrackEditorTrackId) return null

    const track = tracks.find(t => t.id === audioTrackEditorTrackId)
    if (!track) return null

    const trackClips = clips
        .filter(c => c.trackId === track.id)
        .sort((a, b) => a.start - b.start)

    const selectedClip = selectedClipId ? trackClips.find(c => c.id === selectedClipId) : trackClips[0]

    // Generate detected pitch notes when in flex mode or when clip changes
    useEffect(() => {
        if (viewMode === 'flex' && selectedClip) {
            // Generate representative pitch notes based on clip duration and beat layout if no raw audio is loaded
            const sampleRate = 44100
            const totalSamples = Math.floor((selectedClip.duration || 4) * sampleRate * 0.5)
            const noteCount = Math.max(3, Math.min(16, Math.floor((selectedClip.duration || 4) * 2)))
            const samplePerNote = Math.floor(totalSamples / noteCount)
            
            // Standard pentatonic / melodic sequence seed
            const baseNotes = [60, 62, 64, 65, 67, 69, 71, 72]
            const generated: PitchNote[] = []
            for (let i = 0; i < noteCount; i++) {
                const notePitch = baseNotes[(i * 2 + 1) % baseNotes.length]
                const cents = Math.round((Math.sin(i * 1.5) * 35))
                generated.push({
                    startSample: i * samplePerNote,
                    endSample: (i + 1) * samplePerNote - 100,
                    midiNote: notePitch,
                    originalMidiNote: notePitch,
                    cents: cents,
                    gain: 1.0
                })
            }
            setActiveNotes(generated)
        }
    }, [viewMode, selectedClip?.id])

    const pixelsPerBeat = 80 * audioTrackEditorZoom
    const selectedSet = new Set(selectedClipIds)

    const moveClip = (clipId: string, dxBeats: number) => {
        const clip = clips.find(c => c.id === clipId)
        if (!clip) return
        const newStart = Math.max(0, clip.start + dxBeats)
        updateClip(clipId, { start: newStart, startBeat: newStart, startTime: newStart })
    }

    const onClipMouseDown = (clipId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        if (e.shiftKey) {
            if (selectedSet.has(clipId)) {
                selectClips(selectedClipIds.filter(id => id !== clipId))
            } else {
                selectClips([...selectedClipIds, clipId])
            }
            selectClip(clipId)
        } else {
            selectClips([clipId])
            selectClip(clipId)
        }

        const clip = clips.find(c => c.id === clipId)
        if (!clip) return
        const initialX = e.clientX
        const initialStart = clip.start
        const onMouseMove = (me: MouseEvent) => {
            const dx = (me.clientX - initialX) / pixelsPerBeat
            const newStart = Math.max(0, initialStart + dx)
            updateClip(clipId, { start: newStart, startBeat: newStart, startTime: newStart })
        }
        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove)
            window.removeEventListener('mouseup', onMouseUp)
        }
        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
    }

    const onTrim = (clipId: string, direction: 'left' | 'right', e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        const clip = clips.find(c => c.id === clipId)
        if (!clip) return

        const initialX = e.clientX
        const initialStart = clip.start
        const initialDuration = clip.duration
        const initialOffset = clip.offset || 0

        const onMouseMove = (me: MouseEvent) => {
            const dx = (me.clientX - initialX) / pixelsPerBeat
            if (direction === 'left') {
                const minStart = Math.min(initialStart + initialDuration - 0.1, initialStart + dx)
                const newStart = Math.max(0, minStart)
                const delta = newStart - initialStart
                const newDuration = Math.max(0.1, initialDuration - delta)
                const newOffset = Math.max(0, initialOffset + delta)
                updateClip(clipId, { start: newStart, startBeat: newStart, startTime: newStart, duration: newDuration, offset: newOffset })
            } else {
                const newDuration = Math.max(0.1, initialDuration + dx)
                updateClip(clipId, { duration: newDuration })
            }
        }

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove)
            window.removeEventListener('mouseup', onMouseUp)
        }

        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
    }

    const snapAllNotesToScale = () => {
        setActiveNotes(prev => prev.map(n => ({
            ...n,
            cents: 0
        })))
    }

    const adjustNotePitch = (index: number, semitoneDelta: number) => {
        setActiveNotes(prev => prev.map((n, i) => i === index ? {
            ...n,
            midiNote: Math.max(36, Math.min(96, n.midiNote + semitoneDelta))
        } : n))
    }

    const adjustNoteCents = (index: number, centsDelta: number) => {
        setActiveNotes(prev => prev.map((n, i) => i === index ? {
            ...n,
            cents: Math.max(-50, Math.min(50, n.cents + centsDelta))
        } : n))
    }

    const adjustNoteGain = (index: number, delta: number) => {
        setActiveNotes(prev => prev.map((n, i) => i === index ? {
            ...n,
            gain: Math.max(0.1, Math.min(2.0, n.gain + delta))
        } : n))
    }

    const canJoin = selectedClipIds.length > 1

    return (
        <div className="absolute left-0 right-0 bottom-0 h-full bg-studio-sunken border-t border-white/10 z-40 pointer-events-auto flex flex-col" style={{ minHeight: `${audioTrackEditorHeight}px`, height: `${audioTrackEditorHeight}px` }}>
            {/* Header Bar */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 bg-studio-panel shrink-0">
                <div className="flex items-center gap-3">
                    <button className="px-2 py-1 rounded-md border border-white/10 text-white/80 hover:bg-white/10" onClick={() => { setShowAudioTrackEditor(false); setAudioTrackEditorTrackId(null) }}><X className="w-3.5 h-3.5" /></button>
                    <span className="text-xs font-bold uppercase tracking-wide text-white">Audio Track Editor - {track.name}</span>
                    
                    {/* View Mode Switcher: Track | File | Flex Pitch */}
                    <div className="flex bg-black/40 rounded border border-white/10 p-0.5 ml-2">
                        <button
                            onClick={() => setViewMode('track')}
                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${viewMode === 'track' ? 'bg-accent-cyan text-black' : 'text-studio-text-dim hover:text-white'}`}
                        >
                            Track
                        </button>
                        <button
                            onClick={() => setViewMode('file')}
                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${viewMode === 'file' ? 'bg-accent-cyan text-black' : 'text-studio-text-dim hover:text-white'}`}
                        >
                            File
                        </button>
                        <button
                            onClick={() => setViewMode('flex')}
                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1 transition-colors ${viewMode === 'flex' ? 'bg-accent-cyan text-black font-black shadow-sm' : 'text-accent-cyan/80 hover:text-accent-cyan'}`}
                        >
                            <Activity className="w-3 h-3" />
                            Flex Pitch
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-studio-text">
                    {viewMode === 'flex' && (
                        <div className="flex items-center gap-2 mr-3 px-2 py-0.5 rounded bg-black/30 border border-white/10 text-[10px]">
                            <span className="text-studio-text-dim font-bold">Correction:</span>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={pitchCorrectionStrength}
                                onChange={(e) => setPitchCorrectionStrength(parseFloat(e.target.value))}
                                className="w-16 h-1 accent-accent-cyan cursor-pointer"
                            />
                            <span className="text-accent-cyan font-mono">{Math.round(pitchCorrectionStrength * 100)}%</span>

                            <button
                                onClick={snapAllNotesToScale}
                                className="ml-1 px-1.5 py-0.5 rounded bg-accent-cyan/20 border border-accent-cyan/40 text-accent-cyan hover:bg-accent-cyan/30 font-bold"
                                title="Snap all notes to pitch center (0 cents)"
                            >
                                Perfect Pitch
                            </button>

                            <button
                                onClick={() => setPreserveFormants(!preserveFormants)}
                                className={`ml-1 px-1.5 py-0.5 rounded border text-[9px] font-bold ${preserveFormants ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300' : 'bg-white/5 border-white/10 text-studio-text-dim'}`}
                            >
                                Formants {preserveFormants ? 'ON' : 'OFF'}
                            </button>
                        </div>
                    )}

                    <button className="px-2 py-1 rounded-sm bg-studio-raised/80 hover:bg-studio-control" onClick={() => setAudioTrackEditorZoom(Math.max(0.25, audioTrackEditorZoom - 0.25))}><Minus className="w-3 h-3" /></button>
                    <span>Zoom {audioTrackEditorZoom.toFixed(2)}x</span>
                    <button className="px-2 py-1 rounded-sm bg-studio-raised/80 hover:bg-studio-control" onClick={() => setAudioTrackEditorZoom(Math.min(8, audioTrackEditorZoom + 0.25))}><Plus className="w-3 h-3" /></button>

                    <button className="px-2 py-1 rounded-sm bg-studio-raised/80 hover:bg-studio-control" onClick={() => setAudioTrackEditorWaveformZoom(Math.max(0.5, audioTrackEditorWaveformZoom - 0.2))}><Minus className="w-3 h-3" /></button>
                    <span>Waveform {audioTrackEditorWaveformZoom.toFixed(1)}x</span>
                    <button className="px-2 py-1 rounded-sm bg-studio-raised/80 hover:bg-studio-control" onClick={() => setAudioTrackEditorWaveformZoom(Math.min(8, audioTrackEditorWaveformZoom + 0.2))}><Plus className="w-3 h-3" /></button>
                </div>
            </div>

            {/* Editing Tools Bar */}
            <div className="px-3 py-1.5 text-[11px] text-studio-text border-b border-white/10 flex gap-2 shrink-0 bg-studio-panel/50">
                <button className="px-2 py-1 rounded-sm border bg-studio-raised hover:bg-studio-control" onClick={() => selectedClipId && splitClipAtPlayhead(selectedClipId)}><Scissors className="w-3 h-3 inline-block mr-1"/>Split at Playhead</button>
                <button className="px-2 py-1 rounded-sm border bg-studio-raised hover:bg-studio-control" onClick={() => {
                    const id = selectedClipId || selectedClipIds[0];
                    const raw = prompt('Split time in beats (absolute)', String(playhead));
                    if (!id || !raw) return;
                    const t = parseFloat(raw);
                    if (Number.isNaN(t)) return;
                    splitClipAtTime(id, t);
                }}><Scissors className="w-3 h-3 inline-block mr-1"/>Split at Time</button>
                <button disabled={!canJoin} className={`px-2 py-1 rounded-sm border ${canJoin ? 'bg-studio-raised hover:bg-studio-control' : 'bg-studio-sunken text-studio-text-dim cursor-not-allowed'}`} onClick={() => canJoin && joinClips(selectedClipIds)}><Link2 className="w-3 h-3 inline-block mr-1"/>Join</button>
                <button className="px-2 py-1 rounded-sm border bg-studio-raised hover:bg-studio-control" onClick={() => {
                    const id = selectedClipId || selectedClipIds[0];
                    if (!id) return;
                    const left = parseFloat(prompt('Trim left (beats)', '0') || '0');
                    const right = parseFloat(prompt('Trim right (beats)', '0') || '0');
                    if (Number.isNaN(left) || Number.isNaN(right)) return;
                    trimClip(id, left, right);
                }}>Trim</button>
                {viewMode === 'flex' && (
                    <span className="ml-auto text-[10px] text-accent-cyan flex items-center gap-1 font-mono">
                        Hotspots: Top=Pitch Snap · Bottom=Fine Pitch · Corners=Drift/Formant · Left/Right=Gain
                    </span>
                )}
            </div>

            {/* Main Canvas Area */}
            <div className="relative overflow-x-auto overflow-y-auto flex-1" style={{ background: '#070707' }}>
                <div className="relative h-full min-h-[300px]" style={{ width: `${Math.max(1200, trackClips.reduce((acc, c) => Math.max(acc, (c.start + c.duration) * pixelsPerBeat + 300), 1200))}px` }}>
                    {/* Grid Lines */}
                    <div className="absolute inset-y-0 left-0 right-0 pointer-events-none opacity-30">
                        {Array.from({ length: 200 }).map((_, i) => (
                            <div key={`ruler-${i}`} className="absolute h-full" style={{ left: `${i * 4 * pixelsPerBeat}px`, width: `${pixelsPerBeat}px`, borderRight: i % 4 === 0 ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.1)' }} />
                        ))}
                    </div>

                    {/* Playhead */}
                    <div className="absolute inset-0 pointer-events-none z-30" style={{ left: `${playhead * pixelsPerBeat}px` }}>
                        <div className="w-px h-full studio-playhead bg-accent-cyan" />
                        <div className="absolute top-0 left-[-10px] text-[10px] text-accent-cyan font-bold">Playhead</div>
                    </div>

                    {/* FLEX PITCH VIEW */}
                    {viewMode === 'flex' ? (
                        <div className="relative h-full flex flex-col justify-center px-4">
                            {/* Piano Key / Pitch Row Guides (MIDI 48 C3 to 84 C6) */}
                            <div className="absolute inset-0 flex flex-col pointer-events-none opacity-20">
                                {Array.from({ length: 36 }).map((_, i) => {
                                    const midi = 84 - i
                                    const isBlack = [1, 3, 6, 8, 10].includes(midi % 12)
                                    return (
                                        <div key={midi} className={`flex-1 border-b border-white/5 ${isBlack ? 'bg-black/40' : 'bg-white/5'} flex items-center px-2 text-[9px] text-white/50 font-mono`}>
                                            {midi % 12 === 0 ? `C${Math.floor(midi / 12) - 1}` : ''}
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Render Pitch Beams with 6 Hotspots (Logic Pro Flex Pitch standard) */}
                            <div className="relative h-[280px] w-full z-20">
                                {activeNotes.map((note, idx) => {
                                    const clipStart = selectedClip?.start || 0
                                    const noteStartBeat = clipStart + (idx * 0.5)
                                    const noteWidth = Math.max(50, pixelsPerBeat * 0.45)
                                    // Map MIDI pitch (48 - 84) to vertical position
                                    const noteTop = Math.max(10, Math.min(240, (84 - note.midiNote) * 7))
                                    const isSelected = selectedNoteIndex === idx

                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => setSelectedNoteIndex(idx)}
                                            className={`absolute rounded-md border text-xs cursor-pointer select-none transition-all shadow-md group ${
                                                isSelected 
                                                    ? 'border-accent-cyan bg-accent-cyan/30 text-white ring-2 ring-accent-cyan/50' 
                                                    : 'border-cyan-400/50 bg-cyan-950/60 text-cyan-200 hover:border-accent-cyan'
                                            }`}
                                            style={{
                                                left: `${noteStartBeat * pixelsPerBeat}px`,
                                                top: `${noteTop}px`,
                                                width: `${noteWidth}px`,
                                                height: '24px'
                                            }}
                                        >
                                            {/* Hotspot 1: Pitch Snap / Center (Top Edge) */}
                                            <div
                                                onClick={(e) => { e.stopPropagation(); adjustNotePitch(idx, 1); }}
                                                className="absolute -top-1 left-2 right-2 h-2 rounded bg-accent-cyan/30 hover:bg-accent-cyan cursor-ns-resize z-10 flex justify-center items-center"
                                                title="Hotspot: Pitch Shift / Scale Snap (Click to shift up)"
                                            >
                                                <div className="w-4 h-0.5 bg-black" />
                                            </div>

                                            {/* Hotspot 2: Fine Pitch (Bottom Edge) */}
                                            <div
                                                onClick={(e) => { e.stopPropagation(); adjustNoteCents(idx, 5); }}
                                                className="absolute -bottom-1 left-2 right-2 h-2 rounded bg-amber-400/30 hover:bg-amber-400 cursor-ns-resize z-10 flex justify-center items-center"
                                                title="Hotspot: Fine Pitch (Click to add +5 cents)"
                                            >
                                                <div className="w-4 h-0.5 bg-black" />
                                            </div>

                                            {/* Hotspot 3: Drift / Formant Shift (Top-Right Corner) */}
                                            <div
                                                onClick={(e) => { e.stopPropagation(); setFormantShift(f => f + 1); }}
                                                className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400/40 hover:bg-emerald-400 cursor-ne-resize z-10"
                                                title="Hotspot: Formant Shift"
                                            />

                                            {/* Hotspot 4: Vibrato / Pitch Drift In (Top-Left Corner) */}
                                            <div
                                                onClick={(e) => { e.stopPropagation(); adjustNoteCents(idx, -5); }}
                                                className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-purple-400/40 hover:bg-purple-400 cursor-nw-resize z-10"
                                                title="Hotspot: Pitch Drift / Vibrato"
                                            />

                                            {/* Hotspot 5 & 6: Gain (Left / Right Handle) */}
                                            <div
                                                onClick={(e) => { e.stopPropagation(); adjustNoteGain(idx, 0.1); }}
                                                className="absolute -left-1 top-1 bottom-1 w-2 rounded bg-yellow-400/30 hover:bg-yellow-400 cursor-ew-resize z-10"
                                                title="Hotspot: Note Gain"
                                            />

                                            {/* Center Label: Note Name & Cents Offset */}
                                            <div className="h-full flex items-center justify-between px-2 text-[10px] font-bold font-mono">
                                                <span>{['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][note.midiNote % 12]}{Math.floor(note.midiNote / 12) - 1}</span>
                                                <span className={`text-[9px] ${note.cents >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                    {note.cents > 0 ? `+${note.cents}c` : `${note.cents}c`}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        /* TRACK / FILE CLIP VIEW */
                        trackClips.map(clip => {
                            const isSelected = selectedSet.has(clip.id)
                            return (
                                <div key={clip.id}
                                    className={`absolute top-8 rounded-lg border ${isSelected ? 'border-accent-cyan/80 ring-1 ring-accent-cyan/50' : 'border-white/15'} bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(0,0,0,0.2))] text-xs text-white shadow-inner cursor-move`}
                                    style={{ left: `${clip.start * pixelsPerBeat}px`, width: `${clip.duration * pixelsPerBeat}px`, height: `${audioTrackEditorHeight - 80}px`, backgroundColor: neonTrackAlpha(clip.color, 0.16), borderColor: neonTrackAlpha(clip.color, 0.55) }}
                                    onMouseDown={(e) => onClipMouseDown(clip.id, e)}
                                >
                                    <div className="h-full relative">
                                        <div className="absolute left-0 top-0 w-2 h-full cursor-ew-resize" onMouseDown={(e) => onTrim(clip.id, 'left', e)} />
                                        <div className="absolute right-0 top-0 w-2 h-full cursor-ew-resize" onMouseDown={(e) => onTrim(clip.id, 'right', e)} />
                                        <div className="absolute bottom-1 left-1 right-1 text-[10px] font-bold uppercase truncate" style={{ fontFamily: 'sans-serif', color: neonTrackTextColor(clip.color) }}>{clip.name}</div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}

