"use client"
import { useProjectStore } from "@/store/projectStore"
import {
    X, Download, Settings,
    Check, Play, Save,
    Activity, Music, FileAudio
} from "lucide-react"
import { useState } from "react"

export function BounceDialog({ onClose }: { onClose: () => void }) {
    const { name, settings } = useProjectStore()
    const [format, setFormat] = useState<'PCM' | 'MP3' | 'M4A'>('PCM')
    const [resolution, setResolution] = useState<'16' | '24' | '32'>('24')
    const [sampleRate, setSampleRate] = useState(settings.sampleRate)
    const [isBouncing, setIsBouncing] = useState(false)
    const [progress, setProgress] = useState(0)

    const handleBounce = () => {
        setIsBouncing(true);
        let p = 0;
        const interval = setInterval(() => {
            p += 5;
            setProgress(p);
            if (p >= 100) {
                clearInterval(interval);
                setIsBouncing(false);
                setTimeout(onClose, 500);
            }
        }, 100);
    }

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-[520px] bg-[#1a1a1a] border border-black shadow-[0_25px_100px_rgba(0,0,0,1)] rounded-lg overflow-hidden flex flex-col">

                {/* Magic Pro Signature Header */}
                <div className="h-10 bg-gradient-to-b from-[#333] to-[#222] border-b border-black flex items-center px-4 justify-between">
                    <div className="flex items-center gap-2">
                        <Download className="w-4 h-4 text-sky-500" />
                        <span className="text-[12px] font-black text-white uppercase tracking-widest">Bounce: {name}</span>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-all"><X className="w-4 h-4 text-gray-500" /></button>
                </div>

                <div className="p-6 flex flex-col gap-6">
                    {/* Destination/Format Column */}
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Destination</span>
                            <div className="grid grid-cols-3 gap-2">
                                {['PCM', 'MP3', 'M4A'].map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setFormat(f as any)}
                                        className={`h-8 rounded border font-black text-[11px] transition-all ${format === f ? 'bg-sky-500/20 border-sky-500 text-sky-400 shadow-inner' : 'bg-black/40 border-white/5 text-gray-500 hover:border-white/20'}`}
                                    >
                                        <div className="flex items-center justify-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${format === f ? 'bg-sky-400' : 'bg-gray-800'}`}></div>
                                            {f}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Professional Resolution/Rate Settings */}
                        <div className="grid grid-cols-2 gap-6 p-4 bg-black/20 rounded border border-white/5">
                            <div className="flex flex-col gap-3">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Resolution</span>
                                <div className="flex flex-col gap-1">
                                    {['16', '24', '32'].map(r => (
                                        <div key={r} onClick={() => setResolution(r as any)} className="flex items-center justify-between cursor-pointer group">
                                            <span className={`text-[11px] font-black ${resolution === r ? 'text-white' : 'text-gray-600 group-hover:text-gray-400'}`}>{r}-Bit</span>
                                            {resolution === r && <Check className="w-3.5 h-3.5 text-sky-500" />}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col gap-3">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Sample Rate</span>
                                <div className="flex flex-col gap-1">
                                    {[44100, 48000, 88200, 96000].map(s => (
                                        <div key={s} onClick={() => setSampleRate(s as any)} className="flex items-center justify-between cursor-pointer group">
                                            <span className={`text-[11px] font-black ${sampleRate === s ? 'text-white' : 'text-gray-600 group-hover:text-gray-400'}`}>{s / 1000} kHz</span>
                                            {sampleRate === s && <Check className="w-3.5 h-3.5 text-sky-500" />}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Mode Toggles */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 bg-sky-500 rounded flex items-center justify-center"><Check className="w-3 h-3 text-black" /></div>
                            <span className="text-[11px] font-black text-gray-400">Offline Bounce (Highly Recommended)</span>
                        </div>
                        <div className="flex items-center gap-3 opacity-40">
                            <div className="w-4 h-4 rounded border border-white/20"></div>
                            <span className="text-[11px] font-black text-gray-600">Normalization: Overload Protection Only</span>
                        </div>
                    </div>
                </div>

                {/* Industrial Footer with Progress Bar */}
                <div className="bg-[#111] p-6 border-t border-black flex flex-col gap-4">
                    {isBouncing ? (
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-sky-500">
                                <span>Bouncing...</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="h-1.5 bg-black rounded-full overflow-hidden shadow-inner">
                                <div className="h-full bg-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.8)] transition-all duration-100" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-end gap-3">
                            <button onClick={onClose} className="px-5 py-2 rounded text-[11px] font-black text-gray-400 hover:text-white transition-all capitalize">Cancel</button>
                            <button
                                onClick={handleBounce}
                                className="px-8 py-2 bg-gradient-to-b from-sky-500 to-sky-600 rounded text-[11px] font-black text-white shadow-[0_4px_15px_rgba(14,165,233,0.3)] hover:brightness-110 active:scale-95 transition-all uppercase tracking-widest"
                            >
                                OK
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
