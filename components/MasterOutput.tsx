"use client"

import React, { useState, useEffect } from 'react'

export function OutputMeter() {
    const [levels, setLevels] = useState({ left: 40, right: 38 })

    // Simulate metering for demo
    useEffect(() => {
        const interval = setInterval(() => {
            setLevels({
                left: 30 + Math.random() * 20,
                right: 28 + Math.random() * 22
            })
        }, 120)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="flex flex-col gap-[2px] w-24 h-6 px-1 py-[2px] bg-black/80 rounded shadow-inner border border-white/5">
            <div className="flex h-full w-full gap-[1px]">
                {[...Array(24)].map((_, i) => (
                    <div
                        key={i}
                        className={`flex-1 h-full rounded-[0.5px] transition-all duration-100 ${i < levels.left / 4
                                ? (i > 18 ? 'bg-red-500' : (i > 14 ? 'bg-yellow-500' : 'bg-green-500'))
                                : 'bg-gray-900/40'
                            }`}
                    />
                ))}
            </div>
            <div className="flex h-full w-full gap-[1px]">
                {[...Array(24)].map((_, i) => (
                    <div
                        key={i}
                        className={`flex-1 h-full rounded-[0.5px] transition-all duration-100 ${i < levels.right / 4
                                ? (i > 18 ? 'bg-red-500' : (i > 14 ? 'bg-yellow-500' : 'bg-green-500'))
                                : 'bg-gray-900/40'
                            }`}
                    />
                ))}
            </div>
        </div>
    )
}

export function MasterVolume() {
    const [value, setValue] = useState(0.8)
    return (
        <div className="flex items-center gap-2 group">
            <div className="relative w-28 h-5 bg-black/40 rounded-full border border-black px-1.5 flex items-center group-hover:border-sky-500/40 transition-all">
                <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.01"
                    value={value}
                    onChange={(e) => setValue(parseFloat(e.target.value))}
                    className="w-full bg-transparent appearance-none cursor-pointer [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-sky-500/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-sky-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(14,165,233,0.5)] h-full"
                />
            </div>
        </div>
    )
}
