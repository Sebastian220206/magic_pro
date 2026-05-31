"use client"

import { useEffect, useRef, useState } from "react"
import { getAudioRecorder } from "@/engine/audioRecording/recorder"

interface RecordingInputMeterProps {
  width?: number | string
  height?: number | string
  showDbLabels?: boolean
}

/**
 * RecordingInputMeter
 * 
 * A professional DAW-style input meter that uses real-time 
 * RMS analysis and exponential smoothing for a responsive feel.
 */
export function RecordingInputMeter({
  width = 20,
  height = 150,
  showDbLabels = true
}: RecordingInputMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isRecording, setIsRecording] = useState(false)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    const recorder = getAudioRecorder()
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const render = () => {
      const level = recorder.getInputLevel()
      const state = recorder.getState()
      setIsRecording(state === "recording")

      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)

      // Background
      ctx.fillStyle = "#18181b"
      ctx.fillRect(0, 0, W, H)

      // Meter Bar Logic
      // 0.0 to 1.0 (Linear RMS)
      const barHeight = level * H
      const topSafe = H * 0.7  // Green to Yellow
      const topWarn = H * 0.9  // Yellow to Red

      // Draw segments
      for (let y = H; y > H - barHeight; y -= 3) {
        if (y < H - topWarn) {
          ctx.fillStyle = "#ef4444" // Red (Clipping range)
        } else if (y < H - topSafe) {
          ctx.fillStyle = "#eab308" // Yellow (Warning range)
        } else {
          ctx.fillStyle = "#22c55e" // Green (Safe range)
        }
        ctx.fillRect(2, y - 2, W - 4, 2)
      }

      // Draw dB Tick Marks
      if (showDbLabels) {
          ctx.fillStyle = "rgba(255,255,255,0.3)"
          ctx.font = "8px monospace"
          const tks = [0, -3, -6, -12, -24, -48]
          tks.forEach(db => {
              const linear = Math.pow(10, db / 20)
              const y = H - (linear * H)
              ctx.fillRect(0, y, W, 1)
              if (W > 30) ctx.fillText(`${db}`, W - 15, y + 8)
          })
      }

      animationRef.current = requestAnimationFrame(render)
    }

    animationRef.current = requestAnimationFrame(render)

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [showDbLabels])

  return (
    <div className="flex flex-col items-center gap-1">
      <div 
        className="relative rounded-sm border border-zinc-800 bg-zinc-950 overflow-hidden shadow-inner"
        style={{ width, height }}
      >
        <canvas 
          ref={canvasRef} 
          width={typeof width === 'number' ? width : 40} 
          height={typeof height === 'number' ? height : 200}
          className="w-full h-full block"
        />
        
        {/* Peak Indicator */}
        {isRecording && (
            <div className="absolute top-0 inset-x-0 h-1 bg-red-500 opacity-20 animate-pulse" />
        )}
      </div>
      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">Input</span>
    </div>
  )
}

export default RecordingInputMeter;
