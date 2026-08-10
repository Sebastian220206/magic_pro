"use client"

import React, { useState } from 'react'
import { X, Search, FileDown, Plus, Check, RefreshCw } from 'lucide-react'

interface ImportProjectDialogProps {
    onClose: () => void
}

export function ImportProjectDialog({ onClose }: ImportProjectDialogProps) {
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [importStep, setImportStep] = useState<'browse' | 'select'>('browse');

    const fakeProjects = [
        { id: '1', name: 'Neon Dreams', date: '2026-03-05', size: '6.1 MB', tempo: 112, key: 'C# Major' },
        { id: '2', name: 'Ambient Vibe 2', date: '2026-02-28', size: '12.4 MB', tempo: 90, key: 'G Minor' },
        { id: '3', name: 'Pumping Synth', date: '2026-03-08', size: '4.2 MB', tempo: 124, key: 'E Major' },
    ];

    const fakeTracks = [
        { num: 1, name: 'Marker Track', type: 'Global', content: true, plugins: false, sends: false },
        { num: 2, name: 'Tempo Track', type: 'Global', content: true, plugins: false, sends: false },
        { num: 3, name: 'Kick', type: 'Audio', content: true, plugins: true, sends: true },
        { num: 4, name: 'Snare', type: 'Audio', content: true, plugins: true, sends: true },
        { num: 5, name: 'Synth Lead', type: 'Inst', content: true, plugins: true, sends: true },
        { num: 6, name: 'Bass Loop', type: 'Audio', content: true, plugins: false, sends: true },
    ];

    return (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-studio-panel w-[780px] h-[640px] rounded-xl shadow-[0_30px_90px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden text-studio-text animate-in zoom-in-95 duration-200 border border-white/20">

                {/* Header */}
                <div className="px-5 py-4 flex items-center justify-between border-b border-studio-line bg-white/[0.04] backdrop-blur-md">
                    <div className="flex items-center gap-4">
                        <FileDown className="w-5 h-5 text-accent-cyan" />
                        <h2 className="text-[15px] font-bold">Import Project Data</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-full transition-colors">
                        <X className="w-5 h-5 text-studio-text-mid" />
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex overflow-hidden">
                    {importStep === 'browse' ? (
                        <div className="flex-1 flex flex-col p-6">
                            <div className="mb-6 flex items-center justify-between">
                                <span className="text-[11px] font-black text-studio-text-dim uppercase tracking-widest">Select Source Project</span>
                                <div className="relative">
                                    <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-studio-text-mid" />
                                    <input className="bg-studio-control border border-studio-line rounded-md py-1 pl-7 pr-3 text-[12px] w-48 outline-none focus:ring-1 focus:ring-accent-cyan" placeholder="Search projects..." />
                                </div>
                            </div>

                            <div className="flex-1 bg-studio-control border border-studio-line rounded-lg overflow-hidden flex flex-col">
                                <div className="grid grid-cols-4 bg-studio-panel border-b border-studio-line px-4 py-2">
                                    <span className="text-[10px] font-black text-studio-text-mid uppercase tracking-tight">Name</span>
                                    <span className="text-[10px] font-black text-studio-text-mid uppercase tracking-tight text-center">Modified</span>
                                    <span className="text-[10px] font-black text-studio-text-mid uppercase tracking-tight text-center">Info</span>
                                    <span className="text-[10px] font-black text-studio-text-mid uppercase tracking-tight text-right">Size</span>
                                </div>
                                <div className="flex-1 overflow-y-auto overflow-x-hidden divide-y divide-black/[0.03]">
                                    {fakeProjects.map(p => (
                                        <div
                                            key={p.id}
                                            onClick={() => setSelectedProject(p.id)}
                                            className={`grid grid-cols-4 px-4 py-3 cursor-pointer transition-all ${selectedProject === p.id ? 'bg-accent-cyan text-white' : 'hover:bg-accent-cyan/10 text-studio-text-dim'}`}
                                        >
                                            <span className="text-[13px] font-bold truncate">{p.name}</span>
                                            <span className={`text-[12px] text-center ${selectedProject === p.id ? 'text-white/80' : 'text-studio-text-mid'}`}>{p.date}</span>
                                            <span className={`text-[12px] text-center ${selectedProject === p.id ? 'text-white/80' : 'text-studio-text-mid'}`}>{p.tempo} BPM, {p.key}</span>
                                            <span className={`text-[12px] text-right ${selectedProject === p.id ? 'text-white/80' : 'text-studio-text-mid'}`}>{p.size}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col p-6 overflow-hidden">
                            <div className="mb-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-black text-studio-text-dim uppercase tracking-widest">Import Tracks from:</span>
                                    <span className="text-[12px] font-bold text-accent-cyan">Neon Dreams</span>
                                </div>
                                <div className="flex gap-2">
                                    <button className="px-3 py-1 bg-studio-control border border-studio-line rounded text-[11px] font-bold hover:bg-white/[0.03]">Select All</button>
                                    <button className="px-3 py-1 bg-studio-control border border-studio-line rounded text-[11px] font-bold hover:bg-white/[0.03]">Deselect All</button>
                                </div>
                            </div>

                            <div className="flex-1 bg-studio-control border border-studio-line rounded-lg overflow-hidden flex flex-col group/table text-studio-text">
                                <div className="grid grid-cols-[40px_1fr_80px_60px_60px_60px] bg-studio-panel border-b border-studio-line px-4 py-2">
                                    <span className="text-[10px] font-black text-studio-text-mid uppercase tracking-tight">#</span>
                                    <span className="text-[10px] font-black text-studio-text-mid uppercase tracking-tight">Name</span>
                                    <span className="text-[10px] font-black text-studio-text-mid uppercase tracking-tight text-center">Type</span>
                                    <span className="text-[10px] font-black text-studio-text-mid uppercase tracking-tight text-center">Cont.</span>
                                    <span className="text-[10px] font-black text-studio-text-mid uppercase tracking-tight text-center">Plug.</span>
                                    <span className="text-[10px] font-black text-studio-text-mid uppercase tracking-tight text-center">Sends</span>
                                </div>
                                <div className="flex-1 overflow-y-auto divide-y divide-black/[0.03]">
                                    {fakeTracks.map((t, i) => (
                                        <div key={i} className="grid grid-cols-[40px_1fr_80px_60px_60px_60px] px-4 py-2.5 items-center hover:bg-accent-cyan/10 transition-colors">
                                            <span className="text-[11px] font-bold text-studio-text-mid tabular-nums">{t.num}</span>
                                            <div className="flex items-center gap-3">
                                                <div className="w-3.5 h-3.5 rounded-sm border border-studio-line flex items-center justify-center bg-studio-control cursor-pointer hover:border-accent-cyan">
                                                    <div className="w-1.5 h-1.5 bg-accent-cyan rounded-[1px]"></div>
                                                </div>
                                                <span className="text-[13px] font-bold text-studio-text-dim">{t.name}</span>
                                            </div>
                                            <span className="text-[11px] font-medium text-studio-text-mid text-center">{t.type}</span>
                                            <div className="flex justify-center"><CheckCircle active={t.content} /></div>
                                            <div className="flex justify-center"><CheckCircle active={t.plugins} /></div>
                                            <div className="flex justify-center"><CheckCircle active={t.sends} /></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Toolbar */}
                <div className="p-4 bg-studio-raised flex items-center justify-between border-t border-white/5">
                    {importStep === 'browse' ? (
                        <>
                            <div className="text-[11px] font-medium text-studio-text-dim italic">Select a project to see its tracks...</div>
                            <div className="flex gap-2">
                                <button onClick={onClose} className="px-6 py-1.5 rounded bg-studio-control border border-studio-line text-[13px] font-bold text-studio-text-dim active:scale-95">Cancel</button>
                                <button
                                    disabled={!selectedProject}
                                    onClick={() => setImportStep('select')}
                                    className={`px-8 py-1.5 rounded text-[13px] font-bold shadow-sm active:scale-95 transition-all ${selectedProject ? 'bg-accent-cyan text-white' : 'bg-white/[0.14] text-studio-text-dim cursor-not-allowed'}`}
                                >
                                    Import...
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setImportStep('browse')} className="px-4 py-1.5 rounded bg-studio-control border border-studio-line text-[13px] font-bold text-studio-text-dim active:scale-95 flex items-center gap-2">
                                <RefreshCw className="w-4 h-4" />
                                Back to File
                            </button>
                            <div className="flex gap-2">
                                <button className="px-4 py-1.5 rounded bg-studio-control border border-studio-line text-[13px] font-bold text-studio-text-dim">Replace</button>
                                <button onClick={onClose} className="px-8 py-1.5 rounded bg-accent-cyan text-white text-[13px] font-bold shadow-sm active:rotate-1">Add</button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

function CheckCircle({ active }: { active: boolean }) {
    return (
        <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${active ? 'bg-accent-cyan border-accent-cyan shadow-[0_0_8px_rgba(14,165,233,0.3)]' : 'bg-white/5 border-studio-line'}`}>
            {active && <Check className="w-2.5 h-2.5 text-white stroke-[4]" />}
        </div>
    )
}
