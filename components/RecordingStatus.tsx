"use client"

import React, { useEffect, useRef, useState } from 'react'
import { AlertTriangle, X, Mic } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import { getAudioRecorder } from '@/engine/audioRecording/recorder'

/**
 * What the input is doing, where someone can see it.
 *
 * Two things had no representation on screen at all:
 *
 *   `recordingError` was written by the store and rendered by nothing. Every
 *   way recording can fail — a blocked microphone prompt, a device that is
 *   gone, a device another application is holding — produced a rolling
 *   transport, a lit record button, and silence.
 *
 *   Input level had no meter. `RecordingInputMeter` and `LiveRecordingWaveform`
 *   exist and are mounted nowhere, so there was no way to tell "the input is
 *   open and quiet" from "the input never opened".
 *
 * This is deliberately small and only present when an audio track is armed or
 * monitoring — the rest of the time there is nothing to say.
 */
export function RecordingStatus() {
    const recordingError = useProjectStore(s => s.recordingError)
    const tracks = useProjectStore(s => s.tracks)
    const recording = useProjectStore(s => s.recording)
    const [dismissed, setDismissed] = useState<string | null>(null)

    const armed = tracks.filter(t => t.type === 'audio' && (t.recordEnabled || t.inputMonitoring))
    const monitoring = armed.some(t => t.inputMonitoring)
    const showError = !!recordingError && recordingError !== dismissed

    if (!showError && armed.length === 0) return null

    return (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[120] flex flex-col items-center gap-2 pointer-events-none">
            {showError && (
                <div
                    data-recording-error
                    role="alert"
                    className="pointer-events-auto flex items-start gap-2.5 max-w-[520px] rounded-md border border-amber-500/40 bg-[#1a1408]/95 backdrop-blur-sm px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.7)]"
                >
                    <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    <span className="text-[12px] leading-relaxed text-studio-text">{recordingError}</span>
                    <button
                        onClick={() => setDismissed(recordingError)}
                        aria-label="Dismiss"
                        className="ml-1 shrink-0 text-studio-text-dim hover:text-white transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {armed.length > 0 && (
                <div
                    data-input-status
                    className="pointer-events-auto flex items-center gap-2.5 rounded-md border border-studio-line bg-studio-panel/95 backdrop-blur-sm px-3 py-1.5 shadow-lg"
                >
                    <Mic className={`w-3.5 h-3.5 ${recording ? 'text-red-500' : 'text-accent-cyan'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-studio-text-dim">
                        {recording ? 'Recording' : monitoring ? 'Monitoring' : 'Armed'}
                    </span>
                    <InputMeter />
                    {!monitoring && (
                        <span className="text-[10px] text-studio-text-dim">
                            monitoring off
                        </span>
                    )}
                </div>
            )}
        </div>
    )
}

/**
 * The input level, read straight off the recorder's analyser.
 *
 * A meter at zero while the input is open is a different problem from a meter
 * that never appears, and both were previously invisible.
 */
function InputMeter() {
    const barRef = useRef<HTMLDivElement>(null)
    const peakRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const recorder = getAudioRecorder()
        let frame = 0
        let peak = 0
        const tick = () => {
            const level = recorder.getInputLevel()
            if (barRef.current) barRef.current.style.width = `${Math.round(level * 100)}%`
            peak = level > peak ? level : peak * 0.99
            if (peakRef.current) peakRef.current.style.left = `${Math.round(peak * 100)}%`
            frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
    }, [])

    return (
        <div className="relative w-[120px] h-2 rounded-sm bg-studio-sunken border border-studio-line overflow-hidden">
            <div
                ref={barRef}
                data-input-level
                className="absolute inset-y-0 left-0 w-0 bg-gradient-to-r from-green-500 via-green-400 to-amber-400"
            />
            <div ref={peakRef} className="absolute inset-y-0 w-px bg-white/70" style={{ left: 0 }} />
        </div>
    )
}
