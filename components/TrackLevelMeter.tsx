"use client"

import { useEffect, useRef, useState } from "react"
import { getAudioRecorder } from "@/engine/audioRecording/recorder"
import { applyMeterGradient } from "@/lib/meterPalette"

interface TrackLevelMeterProps {
  trackId: string
  isArmed: boolean
}

/**
 * TrackLevelMeter
 * 
 * A horizontal real-time level meter that displays signal intensity
 * when a track is armed or monitoring is active.
 */
export function TrackLevelMeter({ trackId, isArmed }: TrackLevelMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isArmed) {
        if (animationRef.current) cancelAnimationFrame(animationRef.current)
        return
    }

    const recorder = getAudioRecorder()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const render = () => {
      const level = recorder.getInputLevel()
      const W = canvas.width
      const H = canvas.height
      
      ctx.clearRect(0, 0, W, H)

      ctx.fillStyle = applyMeterGradient(ctx.createLinearGradient(0, 0, W, 0))
      const fillW = level * W
      ctx.fillRect(0, 0, fillW, H)

      animationRef.current = requestAnimationFrame(render)
    }

    animationRef.current = requestAnimationFrame(render)

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [isArmed])

  if (!isArmed) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-full">
      <canvas 
        ref={canvasRef} 
        width={200} 
        height={20}
        className="w-full h-full block opacity-80" 
      />
    </div>
  )
}

export default TrackLevelMeter;
