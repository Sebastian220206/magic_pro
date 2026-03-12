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
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#f2f2f7] w-[900px] rounded-xl shadow-[0_30px_90px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden text-[#1c1c1e] animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#d1d1d6]">
                    <h2 className="text-[17px] font-bold">Customize Control Bar and Display</h2>
                    <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex gap-8 p-8 overflow-y-auto max-h-[70vh]">

                    {/* Views Section */}
                    <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <input
                                type="checkbox"
                                checked={controlBarSettings.showViews}
                                onChange={() => toggleGroup('showViews')}
                                className="w-4 h-4 rounded border-[#d1d1d6] text-[#007aff]"
                            />
                            <h3 className="text-[14px] font-bold uppercase tracking-wider text-gray-500">Views</h3>
                        </div>
                        <div className="space-y-2 pl-6">
                            {Object.entries(controlBarSettings.viewButtons).map(([key, val]) => (
                                <label key={key} className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={val}
                                        onChange={() => toggleButton('viewButtons', key)}
                                        className="w-4 h-4 rounded border-[#d1d1d6] text-[#007aff]"
                                    />
                                    <span className="text-[13px] capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Transport Section */}
                    <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <input
                                type="checkbox"
                                checked={controlBarSettings.showTransport}
                                onChange={() => toggleGroup('showTransport')}
                                className="w-4 h-4 rounded border-[#d1d1d6] text-[#007aff]"
                            />
                            <h3 className="text-[14px] font-bold uppercase tracking-wider text-gray-500">Transport</h3>
                        </div>
                        <div className="space-y-2 pl-6">
                            {Object.entries(controlBarSettings.transportButtons).map(([key, val]) => (
                                <label key={key} className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={val}
                                        onChange={() => toggleButton('transportButtons', key)}
                                        className="w-4 h-4 rounded border-[#d1d1d6] text-[#007aff]"
                                    />
                                    <span className="text-[13px] capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Display Section */}
                    <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <input
                                type="checkbox"
                                checked={controlBarSettings.showDisplay}
                                onChange={() => toggleGroup('showDisplay')}
                                className="w-4 h-4 rounded border-[#d1d1d6] text-[#007aff]"
                            />
                            <h3 className="text-[14px] font-bold uppercase tracking-wider text-gray-500">Display</h3>
                        </div>
                        <div className="pl-6 space-y-4">
                            <select
                                value={controlBarSettings.displayMode}
                                onChange={(e) => setDisplayMode(e.target.value as any)}
                                className="w-full bg-white border border-[#d1d1d6] rounded-md px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#007aff]"
                            >
                                <option>Beats & Project</option>
                                <option>Beats & Time</option>
                                <option>Beats</option>
                                <option>Time</option>
                                <option>Custom</option>
                            </select>

                            <div className="space-y-2">
                                {Object.entries(controlBarSettings.displayOptions).map(([key, val]) => (
                                    <label key={key} className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={val}
                                            onChange={() => toggleButton('displayOptions', key)}
                                            className="w-4 h-4 rounded border-[#d1d1d6] text-[#007aff]"
                                        />
                                        <span className="text-[13px] capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Modes and Functions Section */}
                    <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <input
                                type="checkbox"
                                checked={controlBarSettings.showModes}
                                onChange={() => toggleGroup('showModes')}
                                className="w-4 h-4 rounded border-[#d1d1d6] text-[#007aff]"
                            />
                            <h3 className="text-[14px] font-bold uppercase tracking-wider text-gray-500">Modes and Functions</h3>
                        </div>
                        <div className="space-y-2 pl-6">
                            {Object.entries(controlBarSettings.modes).filter(([k]) => k !== 'masterOutput').map(([key, val]) => (
                                <label key={key} className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={val as boolean}
                                        onChange={() => toggleButton('modes', key)}
                                        className="w-4 h-4 rounded border-[#d1d1d6] text-[#007aff]"
                                    />
                                    <span className="text-[13px] capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                                </label>
                            ))}

                            <div className="pt-4 border-t border-gray-300 mt-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <input
                                        type="checkbox"
                                        checked={controlBarSettings.modes.masterOutput !== 'None'}
                                        onChange={() => setMasterOutput(controlBarSettings.modes.masterOutput === 'None' ? 'Meter' : 'None')}
                                        className="w-4 h-4 rounded border-[#d1d1d6] text-[#007aff]"
                                    />
                                    <select
                                        value={controlBarSettings.modes.masterOutput === 'None' ? 'Meter' : controlBarSettings.modes.masterOutput}
                                        onChange={(e) => setMasterOutput(e.target.value as any)}
                                        disabled={controlBarSettings.modes.masterOutput === 'None'}
                                        className="bg-white border border-[#d1d1d6] rounded-md px-2 py-1 text-[13px] flex-1 disabled:opacity-50"
                                    >
                                        <option value="Volume">Master Volume</option>
                                        <option value="Meter">Output Meter</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-6 bg-[#e5e5ea] flex justify-between gap-4">
                    <div className="flex gap-2">
                        <button className="px-4 py-1.5 rounded bg-white border border-[#d1d1d6] text-[13px] active:bg-gray-100 shadow-sm">Apply Defaults</button>
                        <button className="px-4 py-1.5 rounded bg-white border border-[#d1d1d6] text-[13px] active:bg-gray-100 shadow-sm">Save As Default</button>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-6 py-1.5 rounded bg-white border border-[#d1d1d6] text-[13px] shadow-sm">Revert</button>
                        <button onClick={onClose} className="px-8 py-1.5 rounded bg-[#007aff] text-white text-[13px] font-bold shadow-sm active:bg-[#0062cc]">OK</button>
                    </div>
                </div>
            </div>
        </div>
    )
}
