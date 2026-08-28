"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Activity } from 'lucide-react'
import { advancedScheduler } from '@/engine/audioEngine/scheduler'
import {
    activityTitle,
    loadFraction,
    CLIP_CEILING,
    VOICE_CEILING,
    type EngineActivity,
} from '@/lib/engineActivity'

/**
 * What the engine is actually doing, beside the LCD.
 *
 * This replaces a block commented "CPU/Drive (Professional Tech Detail)" whose
 * two bars were fixed at `w-[20%]` and `w-[45%]` — one of them animated, so it
 * looked alive — with an `Activity` icon that had no handler. The whole group
 * brightened on hover, which is what made it read as a control rather than as
 * decoration.
 *
 * It reads `advancedScheduler.getPerformanceMetrics()`, a real count of
 * playing sources and scheduled clips, and it says "voices" and "clips"
 * because that is what the numbers are. It does not say CPU: nothing here
 * measures CPU.
 */

/**
 * Poll only while the transport is rolling.
 *
 * 250ms rather than an animation frame: these are integer counts that change
 * on clip boundaries, and re-rendering for them sixty times a second would be
 * waste. Kept inside this component so it re-renders alone instead of dragging
 * the whole transport bar with it.
 */
function useEngineActivity(active: boolean): EngineActivity {
    const [metrics, setMetrics] = useState<EngineActivity>({ activeSources: 0, scheduledClips: 0 })
    const frame = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        if (!active) {
            setMetrics({ activeSources: 0, scheduledClips: 0 })
            return
        }
        const read = () => {
            try {
                setMetrics(advancedScheduler.getPerformanceMetrics())
            } catch {
                // A scheduler that is not up yet is not an error worth showing.
                setMetrics({ activeSources: 0, scheduledClips: 0 })
            }
        }
        read()
        frame.current = setInterval(read, 250)
        return () => { if (frame.current) clearInterval(frame.current) }
    }, [active])

    return metrics
}

export function LcdActivity({ playing }: { playing: boolean }) {
    const metrics = useEngineActivity(playing)
    const voices = loadFraction(metrics.activeSources, VOICE_CEILING)
    const clips = loadFraction(metrics.scheduledClips, CLIP_CEILING)

    return (
        <div
            data-lcd-activity
            /*
              No `group-hover:opacity-100`. The old block brightened under the
              cursor, which is the visual grammar of something you can press.
              This is a readout.
            */
            className="flex items-center gap-2 opacity-60 pr-2"
            title={activityTitle(metrics, playing)}
        >
            <div className="flex flex-col gap-0.5">
                <div className="w-6 h-[1.5px] bg-studio-sunken rounded-full overflow-hidden">
                    <div
                        data-lcd-voices
                        className="h-full bg-accent-cyan transition-[width] duration-200"
                        style={{ width: `${Math.round(voices * 100)}%` }}
                    />
                </div>
                <div className="w-6 h-[1.5px] bg-studio-sunken rounded-full overflow-hidden">
                    <div
                        data-lcd-clips
                        className="h-full bg-green-500 transition-[width] duration-200"
                        style={{ width: `${Math.round(clips * 100)}%` }}
                    />
                </div>
            </div>
            <Activity
                className={`w-3.5 h-3.5 transition-colors ${playing && metrics.activeSources > 0
                    ? 'text-accent-cyan'
                    : 'text-studio-text-dim/50'}`}
                aria-hidden="true"
            />
        </div>
    )
}
