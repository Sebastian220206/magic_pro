"use client"

import { useMemo, useState } from "react"
import { useProjectStore } from "@/store/projectStore"
import { WaveformSVG } from "./WaveformSVG"
import { neonTrackColor, neonTrackAlpha, neonTrackTextColor } from "@/lib/trackColor"
import { X, ChevronLeft, ChevronRight, Scissors, Link2, Minus, Plus } from "lucide-react"

export function AudioTrackEditor() {
    const {
        showAudioTrackEditor, audioTrackEditorTrackId, audioTrackEditorZoom, audioTrackEditorHeight, audioTrackEditorWaveformZoom,
        setShowAudioTrackEditor, setAudioTrackEditorTrackId, setAudioTrackEditorZoom, setAudioTrackEditorHeight, setAudioTrackEditorWaveformZoom,
        tracks, clips, selectedClipId, selectedClipIds, selectClip, selectClips,
        updateClip, splitClipAtPlayhead, splitClipAtTime, joinClips, trimClip,
        playhead
    } = useProjectStore()

    if (!showAudioTrackEditor || !audioTrackEditorTrackId) return null

    const track = tracks.find(t => t.id === audioTrackEditorTrackId)
    if (!track) return null

    const trackClips = clips
        .filter(c => c.trackId === track.id)
        .sort((a, b) => a.start - b.start)

    const pixelsPerBeat = 80 * audioTrackEditorZoom

    const selectedSet = new Set(selectedClipIds)

    const moveClip = (clipId: string, dxBeats: number) => {
        const clip = clips.find(c => c.id === clipId)
        if (!clip) return
        updateClip(clipId, { start: Math.max(0, clip.start + dxBeats) })
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
            updateClip(clipId, { start: newStart })
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

        const onMouseMove = (me: MouseEvent) => {
            const dx = (me.clientX - initialX) / pixelsPerBeat
            if (direction === 'left') {
                const minStart = Math.min(clip.start + clip.duration - 0.1, initialStart + dx)
                const newStart = Math.max(0, minStart)
                const newDuration = Math.max(0.1, initialDuration - (newStart - initialStart))
                updateClip(clipId, { start: newStart, duration: newDuration })
            } else {
                const newDuration = Math.max(0.1, Math.max(0.1, initialDuration + dx))
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

    const selectedDuringEditor = selectedClipId ? clips.find(c => c.id === selectedClipId) : undefined
    const canJoin = selectedClipIds.length > 1

    return (
        <div className="absolute left-0 right-0 bottom-0 h-full bg-studio-sunken border-t border-white/10 z-40 pointer-events-auto" style={{ minHeight: `${audioTrackEditorHeight}px`, height: `${audioTrackEditorHeight}px` }}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-studio-panel">
                <div className="flex items-center gap-2">
                    <button className="px-2 py-1 rounded-md border border-white/10 text-white/80 hover:bg-white/10" onClick={() => { setShowAudioTrackEditor(false); setAudioTrackEditorTrackId(null) }}><X className="w-3.5 h-3.5" /></button>
                    <span className="text-xs font-bold uppercase tracking-wide">Audio Track Editor - {track.name}</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-studio-text">
                    <button className="px-2 py-1 rounded-sm bg-studio-raised/80 hover:bg-studio-control" onClick={() => setAudioTrackEditorZoom(Math.max(0.25, audioTrackEditorZoom - 0.25))}><Minus className="w-3 h-3" /></button>
                    <span>Zoom {audioTrackEditorZoom.toFixed(2)}x</span>
                    <button className="px-2 py-1 rounded-sm bg-studio-raised/80 hover:bg-studio-control" onClick={() => setAudioTrackEditorZoom(Math.min(8, audioTrackEditorZoom + 0.25))}><Plus className="w-3 h-3" /></button>

                    <button className="px-2 py-1 rounded-sm bg-studio-raised/80 hover:bg-studio-control" onClick={() => setAudioTrackEditorWaveformZoom(Math.max(0.5, audioTrackEditorWaveformZoom - 0.2))}><Minus className="w-3 h-3" /></button>
                    <span>Waveform {audioTrackEditorWaveformZoom.toFixed(1)}x</span>
                    <button className="px-2 py-1 rounded-sm bg-studio-raised/80 hover:bg-studio-control" onClick={() => setAudioTrackEditorWaveformZoom(Math.min(8, audioTrackEditorWaveformZoom + 0.2))}><Plus className="w-3 h-3" /></button>
                </div>
            </div>

            <div className="px-3 py-2 text-[11px] text-studio-text border-b border-white/10 flex gap-2">
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
            </div>

            <div className="relative overflow-x-auto overflow-y-hidden h-full" style={{ background: '#070707' }}>
                <div className="relative h-full" style={{ width: `${Math.max(800, 1500)}px` }}>
                    <div className="absolute inset-y-0 left-0 right-0 pointer-events-none opacity-30">
                        {Array.from({ length: 200 }).map((_, i) => (
                            <div key={`ruler-${i}`} className="absolute h-full" style={{ left: `${i * 4 * pixelsPerBeat}px`, width: `${pixelsPerBeat}px`, borderRight: i % 4 === 0 ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.1)' }} />
                        ))}
                    </div>
                    <div className="absolute inset-0 pointer-events-none" style={{ left: `${playhead * pixelsPerBeat}px` }}>
                        <div className="w-px h-full studio-playhead" />
                        <div className="absolute -top-4 left-[-10px] text-[10px] text-cyan-200">Playhead</div>
                    </div>

                    {trackClips.map(clip => {
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
                    })}
                </div>
            </div>
        </div>
    )
}
