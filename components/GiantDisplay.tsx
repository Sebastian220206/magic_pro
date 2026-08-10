"use client"

import React from 'react'
import { useProjectStore } from '@/store/projectStore'
import { X } from 'lucide-react'

interface GiantDisplayProps {
    type: 'giantBeats' | 'giantTime'
    onClose: () => void
}

export function GiantDisplay({ type, onClose }: GiantDisplayProps) {
    const { playhead } = useProjectStore()

    const formatTime = (beats: number) => {
        const bar = Math.floor(beats / 4) + 1;
        const beat = Math.floor(beats % 4) + 1;
        const div = Math.floor((beats % 1) * 4) + 1;
        const tick = Math.floor((((beats % 1) * 4) % 1) * 240);

        // Mocking time for display
        const totalSeconds = (beats / 120) * 60;
        const mins = Math.floor(totalSeconds / 60);
        const secs = Math.floor(totalSeconds % 60);
        const ms = Math.floor((totalSeconds % 1) * 1000);

        return {
            bar: bar.toString().padStart(4, '0'),
            beat: beat.toString().padStart(1, '0'),
            div: div.toString().padStart(1, '0'),
            tick: tick.toString().padStart(3, '0'),
            mins: mins.toString().padStart(2, '0'),
            secs: secs.toString().padStart(2, '0'),
            ms: ms.toString().padStart(3, '0')
        };
    };

    const { bar, beat, div, tick, mins, secs, ms } = formatTime(playhead);

    return (
        <div className="fixed top-20 left-20 z-[2500] bg-studio-panel rounded-lg border border-black shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 min-w-[320px]">
            {/* Title Bar */}
            <div className="bg-studio-control border-b border-black px-3 py-1 flex items-center justify-between cursor-move">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors cursor-pointer" onClick={onClose}></div>
                    <span className="text-[10px] font-bold text-studio-text-mid uppercase tracking-widest leading-none">
                        {type === 'giantBeats' ? 'Beats Display' : 'Time Display'}
                    </span>
                </div>
                <X className="w-3 h-3 text-studio-text-dim hover:text-white cursor-pointer" onClick={onClose} />
            </div>

            {/* Display Area */}
            <div className="p-8 bg-black flex items-center justify-center font-mono select-none">
                {type === 'giantBeats' ? (
                    <div className="flex gap-4 items-baseline">
                        <span className="text-studio-text text-[80px] absolute">0000 0 0 000</span>
                        <div className="flex gap-4 items-baseline relative">
                            <span className="text-[#32CD32] text-[80px] drop-shadow-[0_0_15px_rgba(50,205,50,0.4)]">{bar}</span>
                            <span className="text-[#32CD32] text-[80px] drop-shadow-[0_0_15px_rgba(50,205,50,0.4)]">{beat}</span>
                            <span className="text-[#32CD32] text-[80px] drop-shadow-[0_0_15px_rgba(50,205,50,0.4)]">{div}</span>
                            <span className="text-[#32CD32] text-[60px] drop-shadow-[0_0_15px_rgba(50,205,50,0.4)] opacity-60 self-end mb-4">{tick}</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-2 items-baseline">
                        <span className="text-studio-text text-[80px] absolute">00:00:00.000</span>
                        <div className="flex gap-2 items-baseline relative text-accent-cyan">
                            <span className="text-[80px] drop-shadow-[0_0_15px_rgba(135,206,235,0.4)]">{mins}</span>
                            <span className="text-[80px] opacity-40">:</span>
                            <span className="text-[80px] drop-shadow-[0_0_15px_rgba(135,206,235,0.4)]">{secs}</span>
                            <span className="text-[80px] opacity-40">.</span>
                            <span className="text-[60px] drop-shadow-[0_0_15px_rgba(135,206,235,0.4)] opacity-60 mb-4">{ms}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Trim */}
            <div className="h-2 bg-studio-control border-t border-black"></div>
        </div>
    )
}
