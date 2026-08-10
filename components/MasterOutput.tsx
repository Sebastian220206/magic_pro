"use client"

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { audioEngine } from '@/engine/AudioEngineAdapter'
import { useProjectStore } from '@/store/projectStore'
import type { LoudnessData } from '@/engine/audioEngine/loudnessMeter'

/** Reference levels for the meter scale, in LUFS / dBTP. */
const METER_FLOOR_LUFS = -60
const METER_CEILING_LUFS = 0

/** Common streaming delivery targets, in LUFS integrated. */
export const LOUDNESS_TARGETS = {
    'Spotify': -14,
    'Apple Music': -16,
    'YouTube': -14,
    'EBU R128': -23,
} as const

export type LoudnessTargetName = keyof typeof LOUDNESS_TARGETS

const EMPTY: LoudnessData = {
    momentary: -Infinity,
    shortTerm: -Infinity,
    integrated: -Infinity,
    truePeakLeft: -Infinity,
    truePeakRight: -Infinity,
    loudnessRange: 0,
    peakHoldLeft: -Infinity,
    peakHoldRight: -Infinity,
    clipLeft: false,
    clipRight: false,
}

/** Map a level in LUFS/dB onto 0..1 across the meter's scale. */
function levelToFraction(db: number): number {
    if (!Number.isFinite(db)) return 0
    const clamped = Math.max(METER_FLOOR_LUFS, Math.min(METER_CEILING_LUFS, db))
    return (clamped - METER_FLOOR_LUFS) / (METER_CEILING_LUFS - METER_FLOOR_LUFS)
}

const formatLufs = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '−∞')

/**
 * Subscribe to master-bus loudness.
 *
 * The meter only runs while the transport is rolling; there is nothing to
 * measure otherwise, and an idle rAF loop is wasted work.
 */
function useLoudness(active: boolean): LoudnessData {
    const [data, setData] = useState<LoudnessData>(EMPTY)
    const frame = useRef<number | null>(null)
    const latest = useRef<LoudnessData>(EMPTY)

    useEffect(() => {
        if (!active) {
            setData(EMPTY)
            return
        }

        const stop = audioEngine.startLoudnessMetering(d => {
            latest.current = d
        })

        // Repaint on a frame cadence rather than on every meter callback.
        const tick = () => {
            setData(latest.current)
            frame.current = requestAnimationFrame(tick)
        }
        frame.current = requestAnimationFrame(tick)

        return () => {
            if (frame.current !== null) cancelAnimationFrame(frame.current)
            stop()
        }
    }, [active])

    return data
}

/** A single channel's bar, coloured by proximity to full scale. */
function MeterBar({ level, segments = 24 }: { level: number; segments?: number }) {
    const lit = Math.round(levelToFraction(level) * segments)

    return (
        <div className="flex h-full w-full gap-[1px]">
            {Array.from({ length: segments }).map((_, i) => {
                const isLit = i < lit
                const colour = i > segments - 3
                    ? 'bg-red-500'
                    : i > segments - 7
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                return (
                    <div
                        key={i}
                        className={`flex-1 h-full rounded-[0.5px] transition-all duration-75 ${isLit ? colour : 'bg-studio-sunken/40'}`}
                    />
                )
            })}
        </div>
    )
}

/**
 * Master output meter driven by real audio.
 *
 * Replaces a placeholder that displayed `Math.random()` — it looked like a
 * working meter but carried no signal information at all.
 */
export function OutputMeter() {
    const playing = useProjectStore(s => s.playing)
    const data = useLoudness(playing)

    const clipping = data.clipLeft || data.clipRight

    return (
        <div
            className={`flex flex-col gap-[2px] w-24 h-6 px-1 py-[2px] bg-black/80 rounded shadow-inner border ${clipping ? 'border-red-500' : 'border-white/5'}`}
            title={`Momentary ${formatLufs(data.momentary)} LUFS · True peak ${formatLufs(Math.max(data.truePeakLeft, data.truePeakRight))} dBTP`}
        >
            <MeterBar level={data.momentary} />
            <MeterBar level={data.shortTerm} />
        </div>
    )
}

/**
 * Full loudness readout: integrated LUFS, true peak and range, with compliance
 * against a delivery target.
 */
export function LoudnessReadout({ target = 'Spotify' }: { target?: LoudnessTargetName }) {
    const playing = useProjectStore(s => s.playing)
    const data = useLoudness(playing)

    const targetLufs = LOUDNESS_TARGETS[target]
    const truePeak = Math.max(data.truePeakLeft, data.truePeakRight)
    const overTarget = Number.isFinite(data.integrated) && data.integrated > targetLufs + 0.5
    const overPeak = Number.isFinite(truePeak) && truePeak > -1

    const reset = useCallback(() => audioEngine.resetLoudnessIntegration(), [])

    return (
        <div className="flex items-center gap-3 px-2 py-1 bg-black/60 rounded border border-white/5 text-[10px] font-mono tabular-nums">
            <Stat label="M" value={formatLufs(data.momentary)} />
            <Stat label="S" value={formatLufs(data.shortTerm)} />
            <Stat label="I" value={formatLufs(data.integrated)} tone={overTarget ? 'bad' : 'good'} />
            <Stat label="LRA" value={data.loudnessRange.toFixed(1)} />
            <Stat label="TP" value={formatLufs(truePeak)} tone={overPeak ? 'bad' : 'good'} />
            <span className="text-studio-text-dim">
                {target} {targetLufs} LUFS
            </span>
            <button
                onClick={reset}
                className="px-1.5 py-0.5 rounded text-studio-text-mid hover:text-white hover:bg-white/10 transition-colors"
                title="Reset integrated loudness"
            >
                Reset
            </button>
        </div>
    )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
    const colour = tone === 'bad' ? 'text-red-400' : tone === 'good' ? 'text-emerald-400' : 'text-studio-text'
    return (
        <span className="flex items-baseline gap-1">
            <span className="text-studio-text-dim">{label}</span>
            <span className={colour}>{value}</span>
        </span>
    )
}

/**
 * Master volume fader. Previously held its value in local state and never
 * reached the engine, so moving it did nothing.
 */
export function MasterVolume() {
    const masterVolume = useProjectStore(s => s.settings.masterVolume)
    const updateProjectSettings = useProjectStore(s => s.updateProjectSettings)

    return (
        <div className="flex items-center gap-2 group">
            <div className="relative w-28 h-5 bg-black/40 rounded-full border border-black px-1.5 flex items-center group-hover:border-accent-cyan/40 transition-all">
                <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.01"
                    value={masterVolume}
                    onChange={(e) => updateProjectSettings({ masterVolume: parseFloat(e.target.value) })}
                    aria-label="Master volume"
                    className="w-full bg-transparent appearance-none cursor-pointer [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-accent-cyan/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-accent-cyan [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(14,165,233,0.5)] h-full"
                />
            </div>
        </div>
    )
}
