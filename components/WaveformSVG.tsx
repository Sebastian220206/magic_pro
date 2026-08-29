"use client"

import React from 'react'
import { envelopePath, hasPeaks, type PeakSource } from '@/lib/waveformGeometry'

interface WaveformSVGProps {
    color?: string
    peaks?: PeakSource
    /** Rendered width in CSS pixels — the caller already knows it. */
    width: number
    /** Rendered height in CSS pixels. */
    height: number
}

/**
 * A clip's waveform.
 *
 * Three things changed from what this was.
 *
 * It drew 100 hairline strokes with `fill="none"`, so it never had a body —
 * and under `preserveAspectRatio="none"` a 1.2px stroke was scaled
 * anisotropically, which made bar weight depend on the clip's width: wide
 * regions merged into a slab, narrow ones turned to mush. A filled shape has
 * no stroke to distort, so the `viewBox` can simply match the pixel box.
 *
 * The size comes in as numbers rather than being measured. The caller has it
 * already — `clip.duration * pixelsPerBeat` by the lane height — so there is
 * no ResizeObserver and no layout read.
 *
 * And when there were no peaks it drew a hard-coded zig-zag: a convincing
 * picture of audio that does not exist, shown for a file that failed to
 * decode. See `MissingWaveform`.
 */
export const WaveformSVG = React.memo(function WaveformSVG({
    color = '#22d3ee',
    peaks,
    width,
    height,
}: WaveformSVGProps) {
    const w = Math.max(1, Math.round(width))
    const h = Math.max(1, Math.round(height))

    if (!hasPeaks(peaks)) return <MissingWaveform color={color} width={w} height={h} />

    const d = envelopePath(peaks!, { width: w, height: h })
    if (!d) return <MissingWaveform color={color} width={w} height={h} />

    return (
        <svg
            data-waveform
            width={w}
            height={h}
            viewBox={`0 0 ${w} ${h}`}
            className="block w-full h-full"
            aria-hidden="true"
        >
            {/*
                No `drop-shadow` filter. On a filled shape it smears the edge
                into mush, and it costs a filter pass per clip on a timeline
                that can hold hundreds.
            */}
            <path d={d} fill={color} fillOpacity={0.85} />
        </svg>
    )
})

/**
 * What a clip with no waveform data shows.
 *
 * Dashed on purpose. Under the minimum-thickness rule a *solid* hairline is
 * exactly what true digital silence draws, and "there is no data" is a
 * different fact from "this is silent" — the dash separates them without
 * needing a label. The title says which.
 */
function MissingWaveform({ color, width, height }: {
    color: string; width: number; height: number
}) {
    return (
        <svg
            data-waveform-missing
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="block w-full h-full"
        >
            <title>Waveform unavailable — this audio could not be decoded</title>
            <line
                x1={0} y1={height / 2} x2={width} y2={height / 2}
                stroke={color} strokeOpacity={0.4} strokeWidth={1} strokeDasharray="3 3"
            />
        </svg>
    )
}
