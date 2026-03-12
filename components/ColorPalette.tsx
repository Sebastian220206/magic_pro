"use client"

import { useProjectStore } from "@/store/projectStore"
import { X, RotateCcw } from "lucide-react"

export function ColorPalette() {
    const {
        showColorPalette,
        toggleColorPalette,
        selectedTrackIds,
        updateTrack,
        tracks
    } = useProjectStore()

    if (!showColorPalette) return null

    const colors = [
        // Logic Pro inspired color grid (High Saturated & Professional)
        ['#ff3b30', '#ff9500', '#ffcc00', '#4cd964', '#5ac8fa', '#007aff', '#5856d6', '#ff2d55', '#a2845e', '#8e8e93'],
        ['#c62828', '#ef6c00', '#f9a825', '#2e7d32', '#0277bd', '#1565c0', '#4527a0', '#ad1457', '#6d4c41', '#37474f'],
        ['#ef9a9a', '#ffcc80', '#fff59d', '#a5d6a7', '#81d4fa', '#90caf9', '#b39ddb', '#f48fb1', '#bcaaa4', '#b0bec5'],
        ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#039be5', '#1e88e5', '#5e35b1', '#d81b60', '#795548', '#546e7a'],
        ['#b71c1c', '#e65100', '#f57f17', '#1b5e20', '#01579b', '#0d47a1', '#311b92', '#880e4f', '#3e2723', '#263238'],
        ['#ff5252', '#ff4081', '#e040fb', '#7c4dff', '#536dfe', '#448aff', '#40c4ff', '#18ffff', '#64ffda', '#b2ff59'],
        ['#ff1744', '#f50057', '#d500f9', '#651fff', '#3d5afe', '#2979ff', '#00b0ff', '#00e5ff', '#1de9b6', '#76ff03'],
    ]

    const handleAssignColor = (color: string) => {
        selectedTrackIds.forEach(tid => {
            updateTrack(tid, { color })
        })
    }

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200">
            <div
                className="bg-[#2c2c2e] border border-white/10 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden w-[420px] animate-in zoom-in-95 duration-200"
                onKeyDown={(e) => { if (e.key === 'Escape') toggleColorPalette(false) }}
            >
                <div className="h-10 px-4 flex items-center justify-between border-b border-black/40 bg-[#3a3a3c]">
                    <span className="text-[12px] font-black text-gray-200 uppercase tracking-widest">Color</span>
                    <div className="flex items-center gap-2">
                        <button
                            className="p-1.5 hover:bg-white/10 rounded-full transition-all text-gray-400 hover:text-white"
                            onClick={() => {
                                // Default colors based on track type
                                selectedTrackIds.forEach(tid => {
                                    const t = tracks.find(track => track.id === tid);
                                    if (t) {
                                        const defaultColor = t.type === 'audio' ? '#38bdf8' : '#63ed63';
                                        updateTrack(tid, { color: defaultColor });
                                    }
                                });
                            }}
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => toggleColorPalette(false)} className="p-1.5 hover:bg-white/10 rounded-full transition-all text-gray-400 hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="p-4 grid gap-1.5">
                    {colors.map((row, rowIdx) => (
                        <div key={rowIdx} className="flex gap-1.5 justify-center">
                            {row.map((color, colIdx) => (
                                <button
                                    key={colIdx}
                                    className="w-8 h-6 rounded-sm border border-black/40 hover:scale-110 active:scale-95 transition-all shadow-sm ring-1 ring-white/5"
                                    style={{ backgroundColor: color }}
                                    onClick={() => handleAssignColor(color)}
                                />
                            ))}
                        </div>
                    ))}
                </div>

                <div className="bg-[#1c1c1e] px-4 py-2 border-t border-black/40 flex justify-between items-center">
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-tighter">
                        {selectedTrackIds.length} {selectedTrackIds.length === 1 ? 'Track' : 'Tracks'} selected
                    </span>
                    <button
                        onClick={() => toggleColorPalette(false)}
                        className="bg-sky-500 hover:bg-sky-400 text-white text-[11px] font-bold px-4 py-1 rounded transition-all active:scale-95"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    )
}
