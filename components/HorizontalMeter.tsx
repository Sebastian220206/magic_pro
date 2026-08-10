"use client"

import { useEffect, useRef } from "react"
import { applyMeterGradient, METER_NOMINAL, METER_PEAK, METER_BED } from "@/lib/meterPalette"

interface HorizontalMeterProps {
  analyzer: AnalyserNode | null
  className?: string
  backgroundColor?: string
  meterColor?: string
  peakHoldColor?: string
  sensitivity?: number
}

/**
 * HorizontalMeter
 * 
 * A high-performance real-time horizontal level meter.
 * Optimized with requestAnimationFrame and minimal React overhead.
 */
export function HorizontalMeter({ 
  analyzer, 
  className = "", 
  backgroundColor = METER_BED,
  meterColor = METER_NOMINAL,
  peakHoldColor = METER_PEAK,
  sensitivity = 1.0
}: HorizontalMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const lastLevel = useRef(0)
  const peak = useRef(0)
  const peakTime = useRef(0)

  useEffect(() => {
    if (!analyzer) {
        // Clear canvas if no analyzer
        const canvas = canvasRef.current
        if (canvas) {
            const ctx = canvas.getContext("2d")
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
        return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const bufferLength = 32 // Small buffer for performance
    const dataArray = new Uint8Array(bufferLength)

    const render = () => {
      analyzer.getByteTimeDomainData(dataArray)

      let max = 128
      for (let i = 0; i < bufferLength; i++) {
        const v = Math.abs(dataArray[i] - 128)
        if (v > max - 128) max = v + 128
      }

      // Calculate instantaneous level (0.0 to 1.0)
      const instantLevel = ((max - 128) / 128) * sensitivity
      
      // Smooth the level for a fluid look (falling edge)
      if (instantLevel > lastLevel.current) {
        lastLevel.current = instantLevel
      } else {
        lastLevel.current *= 0.85 // Decay
      }

      // Peak hold logic
      if (lastLevel.current > peak.current) {
        peak.current = lastLevel.current
        peakTime.current = Date.now()
      } else if (Date.now() - peakTime.current > 1000) {
        peak.current *= 0.95 // Slowly drop after 1 second
      }

      const W = canvas.width
      const H = canvas.height
      
      ctx.clearRect(0, 0, W, H)

      // Background
      ctx.fillStyle = backgroundColor
      ctx.fillRect(0, 0, W, H)

      // Meter Bar
      ctx.fillStyle = applyMeterGradient(ctx.createLinearGradient(0, 0, W, 0), meterColor)
      const fillW = Math.max(0, Math.min(W, lastLevel.current * W))
      ctx.fillRect(0, 0, fillW, H)

      // Peak Hold Line
      if (peak.current > 0) {
        ctx.fillStyle = peakHoldColor
        const peakX = Math.max(0, Math.min(W - 1, peak.current * W))
        ctx.fillRect(peakX, 0, 1, H)
      }

      animationRef.current = requestAnimationFrame(render)
    }

    animationRef.current = requestAnimationFrame(render)

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [analyzer, backgroundColor, meterColor, peakHoldColor, sensitivity])

  return (
    <div className={`relative w-full h-full overflow-hidden rounded-full ${className}`}>
      <canvas 
        ref={canvasRef} 
        width={200} 
        height={20}
        className="w-full h-full block" 
      />
    </div>
  )
}

export default HorizontalMeter;
