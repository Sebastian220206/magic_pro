"use client"

import { useEffect, useRef, useState } from "react"
import { getAudioRecorder } from "@/engine/audioRecording/recorder"
import { LiveWaveformProvider, LiveWaveformCanvasRenderer } from "@/engine/audioRecording/liveWaveform"
import { audioContextManager } from "@/engine/audioEngine/audioContext"

interface LiveRecordingWaveformProps {
  width?: number | string
  height?: number | string
  color?: string
  pointsPerSecond?: number
}

/**
 * LiveRecordingWaveform
 * 
 * A React component that renders a real-time growing waveform
 * during an active audio recording session.
 */
export function LiveRecordingWaveform({
  width = "100%",
  height = 100,
  color = "#ef4444",
  pointsPerSecond = 60
}: LiveRecordingWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isRecording, setIsRecording] = useState(false)
  const providerRef = useRef<LiveWaveformProvider | null>(null)
  const rendererRef = useRef<LiveWaveformCanvasRenderer | null>(null)

  useEffect(() => {
    const recorder = getAudioRecorder()
    const sampleRate = audioContextManager.getSampleRate()
    
    // Initialize provider and renderer
    const provider = new LiveWaveformProvider(sampleRate, pointsPerSecond)
    providerRef.current = provider

    const handleData = (samples: Float32Array) => {
      provider.addSamples(samples)
    }

    // Subscribe to recorder data
    recorder.onData(handleData)

    // Monitor recorder state
    const checkState = () => {
      const state = recorder.getState()
      setIsRecording(state === "recording")
      
      if (state === "recording") {
        if (!rendererRef.current && canvasRef.current) {
          rendererRef.current = new LiveWaveformCanvasRenderer(canvasRef.current, provider, color)
          rendererRef.current.start()
        }
      } else {
        if (rendererRef.current) {
          rendererRef.current.stop()
          rendererRef.current = null
        }
        provider.clear()
      }
    }

    const interval = setInterval(checkState, 100)

    return () => {
      clearInterval(interval)
      if (rendererRef.current) rendererRef.current.stop()
      // Note: we don't unsubscribe from recorder.onData because 
      // recorder.dispose/stop handles the callback cleanup.
      // But adding a way to unsub in recorder.ts would be better.
    }
  }, [color, pointsPerSecond])

  return (
    <div 
      className={`relative overflow-hidden rounded-md border border-red-500/20 bg-black/40 transition-opacity duration-300 ${isRecording ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      style={{ width, height }}
    >
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={200}
        className="w-full h-full block" 
      />
      
      {/* Recording Indicator Overlay */}
      <div className="absolute top-2 left-2 flex items-center gap-2 px-2 py-1 rounded bg-red-600/20 border border-red-600/40">
        <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
        <span className="text-[10px] uppercase font-bold text-red-500 tracking-wider">Recording Live</span>
      </div>
    </div>
  )
}

export default LiveRecordingWaveform;
