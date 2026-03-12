"use client"

import React from 'react'
import { useProjectStore } from '@/store/projectStore'
import {
    Piano, Drum, Waves, AudioLines,
    Binary, Square, Music, Keyboard
} from 'lucide-react'

export function CreateNewTrackUsingDialog() {
    const {
        toggleCreateTrackUsing,
        draggedItems,
        dragPosition,
        dropTargetTrackId,
        createTrackFromSamplerType,
        duplicateWithSharedChannelStrip
    } = useProjectStore();

    if (!draggedItems || !dragPosition) return null;

    const options = [
        { id: 'Quick Sampler (Original)', name: 'Quick Sampler (Original)', icon: Keyboard, color: 'text-green-400' },
        { id: 'Quick Sampler (Optimized)', name: 'Quick Sampler (Optimized)', icon: AudioLines, color: 'text-green-500' },
        { id: 'Drum Machine Designer', name: 'Drum Machine Designer', icon: Drum, color: 'text-amber-500' },
        { id: 'Sample Alchemy', name: 'Sample Alchemy', icon: Waves, color: 'text-purple-400' },
        { id: 'Sampler (Zone Per Note)', name: 'Sampler (Zone Per Note)', icon: Piano, color: 'text-emerald-400' },
    ];

    // Calculate position to keep it in view
    const x = Math.min(dragPosition.x, window.innerWidth - 300);
    const y = Math.min(dragPosition.y, window.innerHeight - 350);

    return (
        <div
            className="fixed inset-0 z-[10000] cursor-default"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); toggleCreateTrackUsing(false); }}
            onClick={() => toggleCreateTrackUsing(false)}
        >
            <div
                className="absolute bg-[#1c1c1e] border border-white/10 rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.6)] w-[260px] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                style={{ left: `${x}px`, top: `${y}px` }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-3 py-2 border-b border-white/5 bg-[#2c2c2e]/50 flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-500">Create Track using:</h3>
                    {draggedItems.length > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-sky-500 rounded text-white">{draggedItems.length}</span>}
                </div>

                <div className="py-1">
                    {options.map((opt) => (
                        <button
                            key={opt.id}
                            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-sky-500 group transition-colors text-left"
                            onClick={() => createTrackFromSamplerType(opt.id as any, draggedItems)}
                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-sky-500'); }}
                            onDragLeave={(e) => { e.currentTarget.classList.remove('bg-sky-500'); }}
                            onDrop={(e) => { e.preventDefault(); createTrackFromSamplerType(opt.id as any, draggedItems); }}
                        >
                            <opt.icon className={`w-3.5 h-3.5 ${opt.color} group-hover:text-white transition-colors`} />
                            <span className="text-[12px] font-bold text-gray-200 group-hover:text-white truncate">{opt.name}</span>
                        </button>
                    ))}

                    <div className="h-px bg-white/5 my-1 mx-2" />

                    <button
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-sky-500 group transition-colors text-left"
                        onClick={() => {
                            if (dropTargetTrackId) {
                                duplicateWithSharedChannelStrip(dropTargetTrackId);
                            } else {
                                // Default new MIDI track
                                // ...
                            }
                            toggleCreateTrackUsing(false);
                        }}
                    >
                        <Music className="w-3.5 h-3.5 text-gray-400 group-hover:text-white" />
                        <span className="text-[12px] font-bold text-gray-200 group-hover:text-white">Existing Channel Strip</span>
                    </button>
                </div>

                <div className="px-3 py-1.5 border-t border-white/5 bg-[#2c2c2e]/30">
                    <div className="flex items-center gap-1.5 opacity-40">
                        <Binary className="w-3 h-3 text-gray-400" />
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Advanced Import</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
