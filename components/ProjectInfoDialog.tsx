"use client"

import React from 'react'
import { useProjectStore } from '@/store/projectStore'
import { X, Cpu, Database, Save, Activity } from 'lucide-react'

interface ProjectInfoDialogProps {
    onClose: () => void
}

export function ProjectInfoDialog({ onClose }: ProjectInfoDialogProps) {
    const { clips, tracks, name, id } = useProjectStore();

    // Stats calculation
    const midiRegions = clips.filter(c => c.type === 'midi').length;
    const audioRegions = clips.filter(c => c.type === 'audio').length;
    const midiEvents = clips.reduce((acc, c) => acc + (c.notes?.length || 0), 0);
    const trackCount = tracks.length;

    // Fake memory calculation for Logic-feel
    const memoryUsed = (midiEvents * 0.12 + (audioRegions * 150)).toFixed(1);

    const stats = [
        { type: 'MIDI Regions', objects: midiRegions, events: midiEvents, memory: `${(midiRegions * 0.8).toFixed(1)} KB` },
        { type: 'Audio Regions', objects: audioRegions, events: '-', memory: `${(audioRegions * 2.4).toFixed(1)} KB` },
        { type: 'Track Count', objects: trackCount, events: '-', memory: '-' },
        { type: 'Automation Points', objects: tracks.reduce((acc, t) => acc + (t.automation?.[0]?.points.length || 0), 0), events: '-', memory: '12 KB' },
    ];

    return (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-studio-panel w-[580px] rounded-xl shadow-[0_30px_90px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden text-studio-text animate-in zoom-in-95 duration-200 border border-white/20">

                {/* Header */}
                <div className="px-4 py-3 flex items-center justify-between border-b border-white/5 bg-white/[0.04]">
                    <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-accent-cyan" />
                        <span className="text-[14px] font-bold">Project Information: {name}</span>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-full transition-colors">
                        <X className="w-4 h-4 text-studio-text-mid" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="bg-studio-control rounded-lg border border-studio-line overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-studio-panel border-b border-studio-line">
                                <tr>
                                    <th className="px-4 py-2 text-[11px] font-black text-studio-text-dim uppercase tracking-widest">Type</th>
                                    <th className="px-4 py-2 text-[11px] font-black text-studio-text-dim uppercase tracking-widest text-right">Objects</th>
                                    <th className="px-4 py-2 text-[11px] font-black text-studio-text-dim uppercase tracking-widest text-right">Events</th>
                                    <th className="px-4 py-2 text-[11px] font-black text-studio-text-dim uppercase tracking-widest text-right">Memory</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/[0.03]">
                                {stats.map((s, i) => (
                                    <tr key={i} className="hover:bg-accent-cyan/10/50 transition-colors">
                                        <td className="px-4 py-2.5 text-[13px] font-medium text-studio-text-dim">{s.type}</td>
                                        <td className="px-4 py-2.5 text-[13px] font-bold text-studio-text text-right tabular-nums">{s.objects}</td>
                                        <td className="px-4 py-2.5 text-[13px] font-medium text-studio-text-dim text-right tabular-nums">{s.events}</td>
                                        <td className="px-4 py-2.5 text-[13px] font-medium text-accent-cyan text-right tabular-nums">{s.memory}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-6 flex gap-4">
                        <div className="flex-1 bg-studio-control p-4 rounded-lg border border-studio-line shadow-sm flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-accent-cyan/15 flex items-center justify-center">
                                <Cpu className="w-5 h-5 text-accent-cyan" />
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-studio-text-mid uppercase tracking-widest leading-none mb-1">Total Memory Usage</div>
                                <div className="text-[18px] font-black text-studio-text tabular-nums">{memoryUsed} MB</div>
                            </div>
                        </div>
                        <div className="flex-1 bg-studio-control p-4 rounded-lg border border-studio-line shadow-sm flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                                <Database className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-studio-text-mid uppercase tracking-widest leading-none mb-1">Project ID</div>
                                <div className="text-[14px] font-bold text-studio-text font-mono opacity-60">{id?.slice(0, 8) || 'unsaved'}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-studio-raised flex justify-between items-center border-t border-white/5">
                    <button
                        className="px-4 py-1.5 rounded bg-studio-control border border-studio-line text-[13px] font-bold text-studio-text-dim shadow-sm hover:bg-white/[0.03] transition-all flex items-center gap-2 active:scale-95"
                        onClick={() => alert("Reorganizing Project Memory...")}
                    >
                        <Activity className="w-4 h-4 text-orange-500" />
                        Reorganize Memory
                    </button>
                    <button onClick={onClose} className="px-8 py-1.5 rounded bg-accent-cyan text-white text-[13px] font-bold shadow-sm active:bg-cyan-300">Done</button>
                </div>
            </div>
        </div>
    )
}
