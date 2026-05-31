"use client"

import { useEffect, useRef } from "react"
import { Clip } from "@/models/Clip"
import { drawWaveform } from "@/engine/waveform"

interface WaveformCanvasProps {
    clip: Clip
    /** Waveform stroke colour. Defaults to semi-transparent black. */
    color?: string
    /** Overall opacity 0‥1. Default: 0.85 */
    opacity?: number
    /**
     * Force a specific layout.
     * 'auto'   → mono if 1 channel, stereo if 2 (default)
     * 'mono'   → always draw channel 0 centred
     * 'stereo' → always draw L top / R bottom
     */
    layout?: 'auto' | 'mono' | 'stereo'
}

/**
 * WaveformCanvas
 *
 * Renders real waveform peak data stored in `clip.waveformPeaks` using the
 * professional drawWaveform() engine (vertical min→max line segments).
 *
 * • Stereo clips: Left channel top half, Right channel bottom half.
 * • Mono clips : single waveform centred in the full height.
 * • Falls back to a subtle SVG placeholder when peaks aren't present yet.
 *
 * A ResizeObserver keeps the canvas at pixel-perfect resolution even as the
 * clip width changes when zooming or resizing.
 */
export function WaveformCanvas({
    clip,
    color = "rgba(0,0,0,0.80)",
    opacity = 0.85,
    layout = 'auto',
}: WaveformCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    // ── Core draw function ──────────────────────────────────────────────────────
    const paint = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const W = canvas.width
        const H = canvas.height
        ctx.clearRect(0, 0, W, H)

        const peaks = clip.waveformPeaks
        if (!peaks?.channels?.length || peaks.resolution === 0) {
            // Placeholder: a faint centre line
            ctx.strokeStyle = color
            ctx.globalAlpha = 0.2
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(0, H / 2)
            ctx.lineTo(W, H / 2)
            ctx.stroke()
            ctx.globalAlpha = 1
            return
        }

        drawWaveform({
            ctx,
            peaks: peaks as any,   // SerializedWaveformPeaks is compatible
            x: 0,
            y: 0,
            width: W,
            height: H,
            color,
            alpha: opacity,
            layout,
            drawCentreLine: true,
        })
    }

    // ── Re-paint whenever peaks or style props change ────────────────────────────
    useEffect(() => { paint() }, [clip.waveformPeaks, color, opacity, layout])

    // ── ResizeObserver: re-size canvas buffer + re-paint on layout change ────────
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ro = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect
                const dpr = window.devicePixelRatio || 1
                // Match canvas buffer to physical pixels for crispness
                const physW = Math.max(1, Math.round(width  * dpr))
                const physH = Math.max(1, Math.round(height * dpr))
                if (canvas.width !== physW || canvas.height !== physH) {
                    canvas.width  = physW
                    canvas.height = physH
                }
                // Scale context for DPR so CSS pixels = logical pixels
                const ctx = canvas.getContext("2d")
                if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
                paint()
            }
        })

        ro.observe(canvas)
        return () => ro.disconnect()
        // paint is intentionally not in the deps — called explicitly above
    }, [clip.waveformPeaks, color, opacity, layout])

    // ── Fallback placeholder (no peaks data yet) ─────────────────────────────────
    if (!clip.waveformPeaks?.channels?.length) {
        return (
            <svg
                viewBox="0 0 200 40"
                preserveAspectRatio="none"
                className="w-full h-full block"
                style={{ opacity: 0.25 }}
            >
                {/* Flat centre line placeholder */}
                <line x1="0" y1="20" x2="200" y2="20" stroke={color} strokeWidth="1" />
                {/* Subtle sine suggestion */}
                <path
                    d="M0 20 Q25 8 50 20 Q75 32 100 20 Q125 8 150 20 Q175 32 200 20"
                    fill="none"
                    stroke={color}
                    strokeWidth="0.8"
                    strokeOpacity="0.4"
                />
            </svg>
        )
    }

    const isStereo = (clip.waveformPeaks.numChannels ?? 1) >= 2

    return (
        <div className="w-full h-full flex flex-col relative">
            {/* Channel labels for stereo clips */}
            {isStereo && layout !== 'mono' && (
                <>
                    <div
                        className="absolute left-1 text-[6px] font-bold leading-none select-none pointer-events-none"
                        style={{ top: '2px', color, opacity: 0.4 }}
                    >
                        L
                    </div>
                    <div
                        className="absolute left-1 text-[6px] font-bold leading-none select-none pointer-events-none"
                        style={{ top: '52%', color, opacity: 0.4 }}
                    >
                        R
                    </div>
                    {/* Stereo divider */}
                    <div
                        className="absolute inset-x-0 pointer-events-none"
                        style={{
                            top: '50%',
                            height: '1px',
                            backgroundColor: color,
                            opacity: 0.08,
                        }}
                    />
                </>
            )}
            <canvas
                ref={canvasRef}
                className="w-full h-full block"
                style={{ imageRendering: "pixelated" }}
                // Initial buffer size — ResizeObserver corrects this on first mount
                width={800}
                height={isStereo ? 80 : 40}
            />
        </div>
    )
}
