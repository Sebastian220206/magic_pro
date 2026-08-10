"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useProjectStore } from "@/store/projectStore"
import { Clip } from "@/models/Clip"
import { X, Music, Type, Check, ChevronDown, Piano } from "lucide-react"
import { audioEngine } from "@/engine/AudioEngineAdapter"

export function StepInputKeyboard() {
    const { 
        showStepInputKeyboard, 
        toggleStepInput, 
        stepInputSettings, 
        updateStepInputSettings,
        clips,
        selectedClipId,
        tracks,
        focusedTrackId,
        addClip,
        addNote,
        updateNote,
        deleteNote,
        selectNote,
        selectedNoteId,
        playhead
    } = useProjectStore()

    const [gridResolution, setGridResolution] = useState<'1/4'|'1/8'|'1/16'|'1/32'|'1/64'>('1/16')
    const [sequenceLength, setSequenceLength] = useState(16)
    const [currentStep, setCurrentStep] = useState(0)
    const [isSequencerRunning, setIsSequencerRunning] = useState(false)
    const [selectedPitch, setSelectedPitch] = useState(60)
    const [stepTool, setStepTool] = useState<'pencil'|'eraser'>('pencil')

    const [rows, setRows] = useState<Array<{id:string, name:string, pitch:number, muted:boolean, solo:boolean}>>([{id:'row-1', name:'Row 1', pitch:60, muted:false, solo:false}])
    const [selectedRowId, setSelectedRowId] = useState('row-1')
    const [monoMode, setMonoMode] = useState(false)
    const [editMode, setEditMode] = useState<'onoff'|'velocity'|'gate'|'note'|'octave'>('onoff')

    if (!showStepInputKeyboard) return null

    const focusedTrack = tracks.find(t => t.id === focusedTrackId)
    const selectedClip = clips.find(c => c.id === selectedClipId && c.type === 'midi')

    const activeClip = useMemo(() => {
        if (selectedClip) return selectedClip
        if (!focusedTrackId) return null
        return clips.find(c => c.trackId === focusedTrackId && c.type === 'midi') || null
    }, [selectedClip, clips, focusedTrackId])

    const lengthMap: Record<string, number> = {
        '1/1': 4, '1/2': 2, '1/4': 1, '1/8': 0.5, '1/16': 0.25, '1/32': 0.125, '1/64': 0.0625
    }

    const gridStepDuration = lengthMap[gridResolution]
    const noteLength = lengthMap[stepInputSettings.length] * (stepInputSettings.triplet ? 2/3 : 1) * (stepInputSettings.dot ? 1.5 : 1)

    useEffect(() => {
        if (!isSequencerRunning || !activeClip || !focusedTrackId) return

        const tempo = useProjectStore.getState().tempo
        const intervalMs = (60 / tempo) * gridStepDuration * 1000

        const step = window.setInterval(() => {
            setCurrentStep((prev) => {
                const next = (prev + 1) % sequenceLength
                return next
            })
        }, intervalMs)

        return () => window.clearInterval(step)
    }, [isSequencerRunning, sequenceLength, gridStepDuration, activeClip, focusedTrackId])

    useEffect(() => {
        if (!isSequencerRunning || !activeClip || !focusedTrackId) return

        const stepNotes = activeClip.notes?.filter(note => Math.abs(note.start - (currentStep * gridStepDuration)) < 0.0001) || []
        const velocityScale = { 'ppp': 16, 'pp': 32, 'p': 48, 'mp': 64, 'mf': 80, 'f': 96, 'ff': 112, 'fff': 127 }
        const velocityValue = velocityScale[stepInputSettings.velocity] || 80
        const toRelease: number[] = []

        stepNotes.forEach(note => {
            audioEngine.triggerNote(focusedTrackId, note.pitch, note.velocity || velocityValue)
            toRelease.push(note.pitch)
        })

        const releaseTimer = window.setTimeout(() => {
            toRelease.forEach(pitch => audioEngine.releaseNote(focusedTrackId, pitch))
        }, (60 / useProjectStore.getState().tempo) * gridStepDuration * 1000 * 0.8)

        return () => window.clearTimeout(releaseTimer)
    }, [currentStep, isSequencerRunning, activeClip, focusedTrackId, stepInputSettings.velocity, gridStepDuration])

    const getOrCreateClip = (): Clip | null => {
        if (activeClip) return activeClip
        if (!focusedTrackId) return null

        const newClip: Clip = {
            id: `clip-step-${Date.now()}`,
            trackId: focusedTrackId,
            type: 'midi',
            name: 'Step Input Region',
            alternativeId: 'alt-1',
            startBeat: Math.floor(playhead),
            start: Math.floor(playhead),
            startTime: Math.floor(playhead),
            duration: 4,
            offset: 0,
            muted: false,
            loop: false,
            transpose: 0,
            velocityOffset: 0,
            qSwing: 0,
            color: focusedTrack?.color || '#66FFA9',
            notes: [],
            fadeIn: { duration: 0, curve: 'linear', gain: 1 },
            fadeOut: { duration: 0, curve: 'linear', gain: 1 },
            playbackRate: 1,
            pitchOffset: 0,
            stretchMode: 'none',
        }

        addClip(newClip)
        return newClip
    }

    const getNotesInStep = (step: number) => {
        const clip = activeClip
        if (!clip || !clip.notes) return []
        return clip.notes.filter(note => Math.abs(note.start - (step * gridStepDuration)) < 0.0001)
    }

    const hasNoteAtStep = (step: number, pitch: number) => {
        return getNotesInStep(step).some(note => note.pitch === pitch)
    }

    const hasNoteAtStepForRow = (step: number, rowPitch: number) => {
        return hasNoteAtStep(step, rowPitch)
    }

    const setClipNote = (step: number, rowPitch?: number) => {
        if (!focusedTrackId) return

        const clip = activeClip || getOrCreateClip()
        if (!clip) return

        const targetPitch = rowPitch ?? selectedPitch

        // erase mode removes any notes at the step for the target pitch
        const existing = clip.notes?.find(note => Math.abs(note.start - (step * gridStepDuration)) < 0.0001 && note.pitch === targetPitch)

        if (stepTool === 'eraser') {
            if (existing) deleteNote(clip.id, existing.id)
            return
        }

        if (existing) {
            deleteNote(clip.id, existing.id)
            return
        }

        const velocityScale = { 'ppp': 16, 'pp': 32, 'p': 48, 'mp': 64, 'mf': 80, 'f': 96, 'ff': 112, 'fff': 127 }
        const velocityValue = velocityScale[stepInputSettings.velocity] || 80

        const pitches = stepInputSettings.chord ? [targetPitch, targetPitch + 4, targetPitch + 7] : [targetPitch]

        if (monoMode) {
            const existingAtStep = clip.notes?.filter(note => Math.abs(note.start - (step * gridStepDuration)) < 0.0001)
            existingAtStep?.forEach(note => deleteNote(clip.id, note.id))
        }

        pitches.forEach(p => {
            const sameStamp = clip!.notes?.find(note => Math.abs(note.start - (step * gridStepDuration)) < 0.0001 && note.pitch === p)
            if (sameStamp) return
            addNote(clip!.id, {
                id: `note-step-${Date.now()}-${p}`,
                pitch: p,
                start: step * gridStepDuration,
                duration: noteLength,
                velocity: velocityValue
            })
        })

        if (!stepInputSettings.chord) {
            setCurrentStep((prev) => (prev + 1) % sequenceLength)
        }
    }

    const selectedNote = useMemo(() => {
        if (!activeClip || !selectedNoteId || !activeClip.notes) return null
        return activeClip.notes.find(n => n.id === selectedNoteId) || null
    }, [activeClip, selectedNoteId])

    const adjustSelectedNoteDuration = (delta: number) => {
        if (!activeClip || !selectedNote) return
        const newDuration = Math.max(0.0625, (selectedNote.duration || 0.25) + delta)
        updateNote(activeClip.id, selectedNote.id, { duration: newDuration })
    }

    const shiftSelectedNote = (direction: -1 | 1) => {
        if (!activeClip || !selectedNote) return
        const nextStart = Math.max(0, (selectedNote.start || 0) + direction * gridStepDuration)
        updateNote(activeClip.id, selectedNote.id, { start: nextStart })
    }

    const deleteSelectedStepNote = () => {
        if (!activeClip || !selectedNote) return
        deleteNote(activeClip.id, selectedNote.id)
        selectNote(null)
    }

    return (
        <div className="fixed bottom-4 right-2 left-2 lg:bottom-32 lg:right-12 lg:left-auto z-[600] w-auto lg:w-[540px] min-w-0 lg:min-w-[420px] animate-in slide-in-from-right-4 duration-300">
            <div className="bg-studio-control/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_30px_90px_rgba(0,0,0,0.8)] overflow-hidden">
                <div className="h-10 flex items-center justify-between px-3 bg-white/5 border-b border-black/30">
                    <div className="flex items-center gap-2">
                        <Piano className="w-3.5 h-3.5 text-accent-cyan" />
                        <span className="text-[11px] font-black uppercase tracking-widest text-studio-text">Step Editor</span>
                        <span className="text-[10px] text-studio-text-mid">{focusedTrack?.name || 'No Track Selected'}</span>
                    </div>
                    <button onClick={() => toggleStepInput(false)} className="p-1.5 hover:bg-white/10 text-studio-text-dim hover:text-white rounded-full transition-all">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>

                <div className="p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-studio-text">
                        <button onClick={() => setIsSequencerRunning(r => !r)} className={`px-2 py-1 rounded ${isSequencerRunning ? 'bg-emerald-500 text-white' : 'bg-white/5 text-studio-text'}`}>
                            {isSequencerRunning ? 'Stop' : 'Play'}
                        </button>
                        <span>Step {currentStep + 1} / {sequenceLength}</span>
                        <span>Grid: {gridResolution}</span>
                        <span>Mode: {editMode.toUpperCase()}</span>
                        <button onClick={() => setMonoMode(m => !m)} className={`px-2 py-1 rounded ${monoMode ? 'bg-violet-500 text-white' : 'bg-white/5 text-studio-text'}`}>Mono {monoMode ? 'On' : 'Off'}</button>
                        <span>Note Dur: {stepInputSettings.length}</span>
                        <span>Velocity: {stepInputSettings.velocity.toUpperCase()}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <label>Resolution</label>
                        <select value={gridResolution} onChange={(e) => setGridResolution(e.target.value as any)} className="bg-studio-sunken border border-white/10 rounded px-2 py-1 text-white">
                            <option value="1/4">1/4</option>
                            <option value="1/8">1/8</option>
                            <option value="1/16">1/16</option>
                            <option value="1/32">1/32</option>
                            <option value="1/64">1/64</option>
                        </select>
                        <label>Size</label>
                        <select value={sequenceLength} onChange={(e) => setSequenceLength(Number(e.target.value))} className="bg-studio-sunken border border-white/10 rounded px-2 py-1 text-white">
                            <option value={8}>8</option>
                            <option value={16}>16</option>
                            <option value={32}>32</option>
                            <option value={64}>64</option>
                        </select>
                        <label>Edit</label>
                        <select value={editMode} onChange={(e) => setEditMode(e.target.value as any)} className="bg-studio-sunken border border-white/10 rounded px-2 py-1 text-white">
                            <option value="onoff">On/Off</option>
                            <option value="velocity">Velocity</option>
                            <option value="gate">Gate</option>
                            <option value="note">Note</option>
                            <option value="octave">Octave</option>
                        </select>
                        <select value={sequenceLength} onChange={(e) => setSequenceLength(Number(e.target.value))} className="bg-studio-sunken border border-white/10 rounded px-2 py-1 text-white">
                            <option value={8}>8</option>
                            <option value={16}>16</option>
                            <option value={32}>32</option>
                            <option value={64}>64</option>
                        </select>
                        <button onClick={() => setStepTool('pencil')} className={`px-2 py-1 rounded ${stepTool === 'pencil' ? 'bg-accent-cyan text-white' : 'bg-white/5 text-studio-text'}`}>Pencil</button>
                        <button onClick={() => setStepTool('eraser')} className={`px-2 py-1 rounded ${stepTool === 'eraser' ? 'bg-rose-500 text-white' : 'bg-white/5 text-studio-text'}`}>Erase</button>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-studio-text">
                            <span className="font-semibold">Rows</span>
                            <button onClick={() => {
                                const id = `row-${Date.now()}`
                                setRows(prev => [...prev, { id, name: `Row ${prev.length + 1}`, pitch: selectedPitch, muted: false, solo: false }])
                            }} className="bg-emerald-500 text-white px-2 py-1 rounded">Add Row</button>
                        </div>
                        {rows.map((row, ridx) => (
                            <div key={row.id} className={`rounded border border-white/10 p-2 ${selectedRowId === row.id ? 'ring-2 ring-accent-cyan' : ''}`}>
                                <div className="flex items-center justify-between gap-2 mb-1 text-xs text-studio-text">
                                    <button onClick={() => setSelectedRowId(row.id)} className="font-semibold text-white">{row.name} ({row.pitch})</button>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => setRows(prev => prev.map(r => r.id === row.id ? { ...r, muted: !r.muted } : r))} className={`px-1 py-0.5 rounded ${row.muted ? 'bg-rose-500 text-white' : 'bg-white/10 text-studio-text'}`}>M</button>
                                        <button onClick={() => setRows(prev => prev.map(r => r.id === row.id ? { ...r, solo: !r.solo } : r))} className={`px-1 py-0.5 rounded ${row.solo ? 'bg-amber-500 text-black' : 'bg-white/10 text-studio-text'}`}>S</button>
                                        <button onClick={() => setRows(prev => prev.filter(r => r.id !== row.id))} className="px-1 py-0.5 rounded bg-rose-500 text-white">Del</button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-16 gap-1 overflow-x-auto"> 
                                    {Array.from({ length: sequenceLength }).map((_, step) => {
                                        const isActive = step === currentStep
                                        const rowHasNote = hasNoteAtStepForRow(step, row.pitch)
                                        const cellActive = rowHasNote && !row.muted && (!rows.some(r => r.solo) || row.solo)
                                        return (
                                            <button
                                                key={`${row.id}-step-${step}`}
                                                onClick={() => setClipNote(step, row.pitch)}
                                                className={`h-8 rounded-sm text-[9px] ${isActive ? 'bg-accent-cyan text-black' : cellActive ? 'bg-emerald-400 text-black' : 'bg-white/10 text-studio-text'} ${stepTool === 'eraser' ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                            >
                                                {step + 1}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-2 bg-studio-sunken rounded border border-white/10">
                        <div className="text-[10px] uppercase text-studio-text-mid mb-1">Pitch Selector</div>
                        <div className="grid grid-cols-14 gap-1">
                            {Array.from({ length: 14 }).map((_, i) => {
                                const pitch = 60 + i
                                const active = pitch === selectedPitch
                                return (
                                    <button
                                        key={`key-${pitch}`}
                                        onClick={() => setSelectedPitch(pitch)}
                                        className={`py-1 text-[10px] rounded ${active ? 'bg-accent-cyan text-white' : 'bg-white/10 text-studio-text hover:bg-white/20'}`}
                                    >
                                        {pitch}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="text-[10px] font-black uppercase text-studio-text-mid">Clip Event List</div>
                    <div className="max-h-44 overflow-y-auto bg-studio-void border border-white/10 rounded text-xs">
                        {(activeClip?.notes || []).sort((a, b) => (a.startBeat ?? a.start) - (b.startBeat ?? b.start)).map(note => (
                            <div 
                                key={note.id} 
                                onClick={() => selectNote(note.id)}
                                className={`flex items-center justify-between px-2 py-1 hover:bg-white/5 cursor-pointer ${selectedNoteId === note.id ? 'bg-accent-cyan/30' : ''}`}
                            >
                                <span>Pitch {note.pitch}</span>
                                <span>Start {note.start.toFixed(2)}</span>
                                <span>Dur {note.duration?.toFixed(2) || '0.00'}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                        <button onClick={() => adjustSelectedNoteDuration(-0.0625)} className="bg-white/10 px-2 py-1 rounded">- Len</button>
                        <button onClick={() => adjustSelectedNoteDuration(0.0625)} className="bg-white/10 px-2 py-1 rounded">+ Len</button>
                        <button onClick={() => shiftSelectedNote(-1)} className="bg-white/10 px-2 py-1 rounded">← Move</button>
                        <button onClick={() => shiftSelectedNote(1)} className="bg-white/10 px-2 py-1 rounded">Move →</button>
                        <button onClick={deleteSelectedStepNote} className="bg-rose-500/70 px-2 py-1 rounded text-white">Delete Note</button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function ModifierButton({ active, label, symbol, onClick }: { active: boolean, label: string, symbol: string, onClick: () => void }) {
    return (
        <button 
            onClick={onClick}
            className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${active ? 'bg-accent-cyan border-accent-cyan text-white shadow-lg' : 'bg-black/20 border-white/5 text-studio-text-dim hover:text-studio-text'}`}
        >
            <span className="text-[14px] font-black h-4 flex items-center">{symbol}</span>
            <span className="text-[8px] font-bold uppercase tracking-tighter opacity-60 mt-1">{label}</span>
        </button>
    )
}
