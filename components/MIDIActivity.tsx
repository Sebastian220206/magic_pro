"use client"

import React, { useState, useEffect } from 'react'

export function MIDIActivity({ customStyle = false }) {
    const [lastIn, setLastIn] = useState<{ msg: string } | null>(null)
    const [lastOut, setLastOut] = useState<{ msg: string } | null>(null)
    const [blinkIn, setBlinkIn] = useState(false)
    const [blinkOut, setBlinkOut] = useState(false)

    useEffect(() => {
        // Mock MIDI activity for demo
        const interval = setInterval(() => {
            if (Math.random() > 0.7) {
                setLastIn({ msg: `Note On: C3 ${Math.floor(Math.random() * 127)}` })
                setBlinkIn(true)
                setTimeout(() => setBlinkIn(false), 80)
            }
            if (Math.random() > 0.8) {
                setLastOut({ msg: `Control Change: 1 ${Math.floor(Math.random() * 127)}` })
                setBlinkOut(true)
                setTimeout(() => setBlinkOut(false), 80)
            }
        }, 800)
        return () => clearInterval(interval)
    }, [])

    const handlePanic = () => {
        console.log("MIDI Panic - Resetting all controllers and notes");
        setLastOut({ msg: "SEND ALL NOTES OFF" })
        setBlinkOut(true)
        setTimeout(() => setBlinkOut(false), 200)
    }

    if (customStyle) {
        return (
            <div
                className="flex flex-col justify-center px-2 min-w-[100px] border-l border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={handlePanic}
                title="Double-click for MIDI Panic"
                onDoubleClick={handlePanic}
            >
                <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.5)] ${blinkIn ? 'bg-green-400' : 'bg-green-900/40'}`}></div>
                    <span className="text-[7px] text-studio-text-dim font-mono truncate max-w-[80px] uppercase">
                        {lastIn?.msg || 'No MIDI In'}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_5px_rgba(234,179,8,0.5)] ${blinkOut ? 'bg-yellow-400' : 'bg-yellow-900/40'}`}></div>
                    <span className="text-[7px] text-studio-text-dim font-mono truncate max-w-[80px] uppercase">
                        {lastOut?.msg || 'No MIDI Out'}
                    </span>
                </div>
            </div>
        )
    }

    return (
        <div className="flex items-center gap-1 opacity-60">
            <div className={`w-1.5 h-1.5 rounded-full ${blinkIn ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 'bg-studio-panel'}`}></div>
            <div className={`w-1.5 h-1.5 rounded-full ${blinkOut ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]' : 'bg-studio-panel'}`}></div>
        </div>
    )
}
