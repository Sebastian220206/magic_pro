"use client"

import React from 'react'
import { useProjectStore, ControlBarSettings } from '@/store/projectStore'
import { X } from 'lucide-react'

interface CustomizerProps {
    onClose: () => void
}

export function ControlBarCustomizer({ onClose }: CustomizerProps) {
    const { controlBarSettings, updateControlBar } = useProjectStore()

    const toggleGroup = (group: keyof Pick<ControlBarSettings, 'showViews' | 'showTransport' | 'showDisplay' | 'showModes'>) => {
        updateControlBar({ [group]: !controlBarSettings[group] })
    }

    const toggleButton = (group: 'viewButtons' | 'transportButtons' | 'displayOptions' | 'modes', key: string) => {
        const currentGroup = controlBarSettings[group] as any
        updateControlBar({
            [group]: { ...currentGroup, [key]: !currentGroup[key] }
        })
    }

    const setMasterOutput = (val: 'Volume' | 'Meter' | 'None') => {
        updateControlBar({
            modes: { ...controlBarSettings.modes, masterOutput: val }
        })
    }

    const setDisplayMode = (val: ControlBarSettings['displayMode']) => {
        updateControlBar({ displayMode: val })
    }

    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 cursor-default">
            <div className="bg-studio-control w-[920px] rounded-2xl shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden border border-white/10 animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-studio-control border-b border-black/40">
                    <h2 className="text-[17px] font-bold text-white/95">Customize Control Bar and Display</h2>
                    <button onClick={onClose} className="p-1 px-3 text-sm text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors border border-white/5">
                        Close
                    </button>
                </div>

                {/* Content */}
                <div className="flex gap-10 p-8 overflow-y-auto max-h-[75vh] bg-studio-panel">

                    {/* Views Section */}
                    <div className="flex-1 space-y-5">
                        <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                            <input
                                type="checkbox"
                                checked={controlBarSettings.showViews}
                                onChange={() => toggleGroup('showViews')}
                                className="w-4 h-4 rounded border-white/20 bg-black/40 text-accent-cyan focus:ring-offset-black"
                            />
                            <h3 className="text-[12px] font-black uppercase tracking-[0.1em] text-white/40">Views</h3>
                        </div>
                        <div className="space-y-2.5 pl-0.5">
                            {Object.entries(controlBarSettings.viewButtons).map(([key, val]) => (
                                <label key={key} className="flex items-center gap-3 cursor-pointer group">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={val}
                                            onChange={() => toggleButton('viewButtons', key)}
                                            className="w-4 h-4 rounded border-white/10 bg-white/5 text-accent-cyan focus:ring-offset-black"
                                        />
                                    </div>
                                    <span className="text-[13px] text-white/80 group-hover:text-white capitalize transition-colors">{key.replace(/([A-Z])/g, ' $1')}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Transport Section */}
                    <div className="flex-1 space-y-5">
                        <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                            <input
                                type="checkbox"
                                checked={controlBarSettings.showTransport}
                                onChange={() => toggleGroup('showTransport')}
                                className="w-4 h-4 rounded border-white/20 bg-black/40 text-accent-cyan focus:ring-offset-black"
                            />
                            <h3 className="text-[12px] font-black uppercase tracking-[0.1em] text-white/40">Transport</h3>
                        </div>
                        <div className="space-y-2.5 pl-0.5">
                            {Object.entries(controlBarSettings.transportButtons).map(([key, val]) => (
                                <label key={key} className="flex items-center gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={val}
                                        onChange={() => toggleButton('transportButtons', key)}
                                        className="w-4 h-4 rounded border-white/10 bg-white/5 text-accent-cyan focus:ring-offset-black"
                                    />
                                    <span className="text-[13px] text-white/80 group-hover:text-white capitalize transition-colors">{key.replace(/([A-Z])/g, ' $1')}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Display Section */}
                    <div className="flex-1 space-y-5">
                        <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                            <input
                                type="checkbox"
                                checked={controlBarSettings.showDisplay}
                                onChange={() => toggleGroup('showDisplay')}
                                className="w-4 h-4 rounded border-white/20 bg-black/40 text-accent-cyan focus:ring-offset-black"
                            />
                            <h3 className="text-[12px] font-black uppercase tracking-[0.1em] text-white/40">Display</h3>
                        </div>
                        <div className="space-y-5">
                            <div className="relative">
                                <select
                                    value={controlBarSettings.displayMode}
                                    onChange={(e) => setDisplayMode(e.target.value as any)}
                                    className="w-full bg-studio-control border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white/90 focus:outline-none focus:ring-1 focus:ring-accent-cyan appearance-none"
                                >
                                    {[
                                        'Beats & Project',
                                        'Beats & Project (Large)',
                                        'Beats & Time',
                                        'Beats & Time (Large)',
                                        'Beats',
                                        'Time',
                                        'Custom'
                                    ].map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                                </div>
                            </div>

                            <div className="space-y-2.5 pl-0.5">
                                {Object.entries(controlBarSettings.displayOptions).map(([key, val]) => (
                                    <label key={key} className="flex items-center gap-3 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={val}
                                            onChange={() => toggleButton('displayOptions', key)}
                                            className="w-4 h-4 rounded border-white/10 bg-white/5 text-accent-cyan focus:ring-offset-black"
                                        />
                                        <span className="text-[13px] text-white/80 group-hover:text-white capitalize transition-colors">{key.replace(/([A-Z])/g, ' $1')}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Modes and Functions Section */}
                    <div className="flex-1 space-y-5">
                        <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                            <input
                                type="checkbox"
                                checked={controlBarSettings.showModes}
                                onChange={() => toggleGroup('showModes')}
                                className="w-4 h-4 rounded border-white/20 bg-black/40 text-accent-cyan focus:ring-offset-black"
                            />
                            <h3 className="text-[12px] font-black uppercase tracking-[0.1em] text-white/40">Modes & Functions</h3>
                        </div>
                        <div className="space-y-2.5 pl-0.5">
                            {Object.entries(controlBarSettings.modes).filter(([k]) => k !== 'masterOutput').map(([key, val]) => (
                                <label key={key} className="flex items-center gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={val as boolean}
                                        onChange={() => toggleButton('modes', key)}
                                        className="w-4 h-4 rounded border-white/10 bg-white/5 text-accent-cyan focus:ring-offset-black"
                                    />
                                    <span className="text-[13px] text-white/80 group-hover:text-white capitalize transition-colors">{key.replace(/([A-Z])/g, ' $1')}</span>
                                </label>
                            ))}

                            <div className="pt-5 mt-5 border-t border-white/5">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={controlBarSettings.modes.masterOutput !== 'None'}
                                        onChange={() => setMasterOutput(controlBarSettings.modes.masterOutput === 'None' ? 'Meter' : 'None')}
                                        className="w-4 h-4 rounded border-white/10 bg-white/5 text-accent-cyan focus:ring-offset-black"
                                    />
                                    <div className="relative flex-1">
                                        <select
                                            value={controlBarSettings.modes.masterOutput === 'None' ? 'Meter' : controlBarSettings.modes.masterOutput}
                                            onChange={(e) => setMasterOutput(e.target.value as any)}
                                            disabled={controlBarSettings.modes.masterOutput === 'None'}
                                            className="w-full bg-studio-control border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white/90 focus:outline-none focus:ring-1 focus:ring-accent-cyan appearance-none disabled:opacity-30 transition-opacity"
                                        >
                                            <option value="Volume">Master Volume</option>
                                            <option value="Meter">Output Meter</option>
                                        </select>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-6 bg-studio-control flex justify-between items-center border-t border-black/40">
                    <div className="flex gap-2">
                        <button className="px-4 py-1.5 rounded-md bg-white/5 border border-white/10 text-[13px] text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all shadow-sm">Apply Defaults</button>
                        <button className="px-4 py-1.5 rounded-md bg-white/5 border border-white/10 text-[13px] text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all shadow-sm">Save As Default</button>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-1.5 rounded-md bg-white/5 border border-white/10 text-[13px] text-white/80 hover:text-white active:scale-95 transition-all shadow-sm">Cancel</button>
                        <button onClick={onClose} className="px-10 py-1.5 rounded-md bg-accent-cyan text-white text-[13px] font-bold shadow-[0_2px_10px_rgba(0,122,255,0.3)] hover:bg-accent-cyan active:scale-95 transition-all">OK</button>
                    </div>
                </div>
            </div>
        </div>
    )
}

