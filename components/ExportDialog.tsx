"use client"

import { useState } from "react"
import { useProjectStore } from "@/store/projectStore"
import { X, RotateCcw, ChevronDown, Check, GripVertical, Plus } from "lucide-react"

export function ExportDialog() {
    const { 
        showExportDialog, 
        toggleExportDialog, 
        exportAsAudioFiles, 
        tracks, 
        focusedTrackId,
        selectedClipIds 
    } = useProjectStore()

    const [settings, setSettings] = useState({
        range: "Trim Silence at File End",
        fileType: "WAVE",
        bitDepth: "24-bit",
        multiOutput: "One File per Track",
        bypassEffects: false,
        includeTail: true,
        includeAutomation: false,
        includeTempo: true,
        normalize: "Overload Protection Only",
        addToProject: true,
        customName: ""
    })

    const [pattern, setPattern] = useState(["Track Name", "Custom"])

    if (!showExportDialog) return null

    const handleExport = () => {
        exportAsAudioFiles(settings)
    }

    const title = showExportDialog === 'track' 
        ? "Export Selected Track" 
        : showExportDialog === 'all' 
            ? "Export All Tracks" 
            : "Export Selected Regions"

    const availableElements = [
        "Custom", "Project Name", "Alternative Name", "Region Name", 
        "Track Name", "Track Number", "Year", "Month", "Day"
    ]

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[9000] flex items-center justify-center p-4 selection:bg-sky-500/30">
            <div className="bg-[#2c2c2e] w-full max-w-3xl rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-8 py-5 flex items-center justify-between border-b border-black/40 bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]"></div>
                        <h2 className="text-sm font-black text-white tracking-tight uppercase opacity-90">{title}</h2>
                    </div>
                    <button onClick={() => toggleExportDialog(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-gray-500 hover:text-white active:scale-90">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#1c1c1e]">
                    <div className="p-10 grid grid-cols-1 gap-y-8">
                        {/* Main Settings Grid */}
                        <div className="grid grid-cols-[200px_1fr] gap-y-4 items-center">
                            <label className="text-[11px] font-bold text-gray-400 text-right pr-6">Range:</label>
                            <Dropdown value={settings.range} onChange={(v) => setSettings({ ...settings, range: v })} options={["Trim Silence at File End", "Cycle Range", "Project End"]} />

                            <label className="text-[11px] font-bold text-gray-400 text-right pr-6">File Type:</label>
                            <Dropdown value={settings.fileType} onChange={(v) => setSettings({ ...settings, fileType: v })} options={["WAVE", "AIFF", "CAF"]} />

                            <label className="text-[11px] font-bold text-gray-400 text-right pr-6">Bit Depth:</label>
                            <Dropdown value={settings.bitDepth} onChange={(v) => setSettings({ ...settings, bitDepth: v })} options={["16-bit", "24-bit", "32-bit (float)"]} />

                            <label className="text-[11px] font-bold text-gray-400 text-right pr-6">Multi-Output Software Instruments:</label>
                            <Dropdown value={settings.multiOutput} onChange={(v) => setSettings({ ...settings, multiOutput: v })} options={["One File per Track", "One File per Channel Strip"]} />

                            <div></div>
                            <div className="space-y-3 pt-2">
                                <Checkbox label="Bypass Effect Plug-ins" checked={settings.bypassEffects} onChange={(v) => setSettings({ ...settings, bypassEffects: v })} />
                                <Checkbox label="Include Audio Tail" checked={settings.includeTail} onChange={(v) => setSettings({ ...settings, includeTail: v })} />
                                <Checkbox label="Include Volume/Pan Automation" checked={settings.includeAutomation} onChange={(v) => setSettings({ ...settings, includeAutomation: v })} />
                                <Checkbox label="Include Tempo Information" checked={settings.includeTempo} onChange={(v) => setSettings({ ...settings, includeTempo: v })} />
                            </div>

                            <label className="text-[11px] font-bold text-gray-400 text-right pr-6 mt-4">Normalize:</label>
                            <div className="mt-4">
                                <Dropdown value={settings.normalize} onChange={(v) => setSettings({ ...settings, normalize: v })} options={["Off", "Overload Protection Only", "On"]} />
                            </div>

                            <div></div>
                            <div className="pt-2">
                                <Checkbox label="Add resulting files to Project Audio Browser" checked={settings.addToProject} onChange={(v) => setSettings({ ...settings, addToProject: v })} />
                            </div>
                        </div>

                        {/* Naming Pattern Section */}
                        <div className="mt-4 pt-8 border-t border-white/5 flex flex-col gap-6">
                            <div className="text-[11px] font-bold text-gray-500 text-center uppercase tracking-widest">Filename Pattern Editor</div>
                            
                            {/* Pattern Field */}
                            <div className="bg-black/40 border border-white/10 rounded-xl p-3 flex flex-wrap gap-2 min-h-[44px] shadow-inner items-center">
                                {pattern.map((p, i) => (
                                    <div key={i} className="flex items-center gap-1.5 px-3 py-1 bg-sky-500/20 border border-sky-400/30 rounded text-[11px] font-bold text-sky-400 shadow-sm transition-all hover:bg-sky-500/30 cursor-default">
                                        {p}
                                        <X className="w-3 h-3 opacity-50 hover:opacity-100 cursor-pointer" onClick={() => setPattern(pattern.filter((_, idx) => idx !== i))} />
                                    </div>
                                ))}
                                <div className="text-gray-600 text-[10px] italic ml-auto pr-2">Drag elements here...</div>
                            </div>

                            {/* Elements Bank */}
                            <div className="flex flex-wrap gap-1.5 justify-center">
                                {availableElements.map(el => (
                                    <button 
                                        key={el}
                                        onClick={() => setPattern([...pattern, el])}
                                        className="px-2.5 py-1 bg-[#333] border border-white/5 rounded text-[10px] font-medium text-gray-300 hover:bg-[#444] hover:text-white transition-all active:scale-95 shadow-sm"
                                    >
                                        {el}
                                    </button>
                                ))}
                            </div>

                            {/* Custom Name Input */}
                            {pattern.includes("Custom") && (
                                <div className="flex items-center gap-4 px-12">
                                    <label className="text-[11px] font-bold text-gray-500 whitespace-nowrap">Custom Text:</label>
                                    <input 
                                        type="text" 
                                        placeholder="Enter custom text..."
                                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-xs text-white focus:ring-1 focus:ring-sky-500 focus:outline-none transition-all shadow-inner"
                                        value={settings.customName}
                                        onChange={(e) => setSettings({ ...settings, customName: e.target.value })}
                                    />
                                </div>
                            )}

                            <div className="text-center">
                                <span className="text-[11px] text-gray-500">Example filename: </span>
                                <span className="text-[11px] font-bold text-gray-300">MyAwesomeTrack_Export.wav</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-6 bg-black/20 border-t border-black/40 flex items-center justify-between">
                    <button className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-white transition-all group">
                        <RotateCcw className="w-4 h-4 transition-transform group-hover:rotate-45" /> Restore Defaults
                    </button>
                    <div className="flex gap-4">
                        <button 
                            onClick={() => toggleExportDialog(null)}
                            className="px-8 py-2.5 rounded-xl text-xs font-black text-gray-400 hover:text-white transition-all active:scale-95"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleExport}
                            className="px-12 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-black shadow-[0_10px_20px_rgba(14,165,233,0.3)] active:scale-95 transition-all outline-none ring-offset-2 ring-offset-[#2c2c2e] focus:ring-2 focus:ring-sky-500"
                        >
                            EXPORT
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function Dropdown({ value, options, onChange }: { value: string, options: string[], onChange: (v: string) => void }) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div className="relative group max-w-[280px]">
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white flex items-center justify-between cursor-pointer hover:bg-black/60 transition-all shadow-inner group-hover:border-white/20"
            >
                <span className="truncate">{value}</span>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {isOpen && (
                <div className="absolute top-full mt-1 w-full bg-[#333] border border-white/10 rounded-lg shadow-2xl z-[9001] overflow-hidden py-1 animate-in slide-in-from-top-1 duration-150">
                    {options.map(opt => (
                        <div 
                            key={opt}
                            onClick={() => { onChange(opt); setIsOpen(false); }}
                            className={`px-3 py-2 text-[11px] font-medium cursor-pointer transition-colors flex items-center justify-between ${value === opt ? 'bg-sky-500 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                        >
                            {opt}
                            {value === opt && <Check className="w-3 h-3" />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function Checkbox({ label, checked, onChange }: { label: string, checked: boolean, onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-center gap-3 cursor-pointer group w-fit">
            <div 
                onClick={() => onChange(!checked)}
                className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${checked ? 'bg-sky-500 border-sky-400 shadow-[0_0_8px_rgba(14,165,233,0.3)]' : 'bg-black/40 border-white/10 group-hover:border-white/30'}`}
            >
                {checked && <Check className="w-3 h-3 text-white stroke-[3px]" />}
            </div>
            <span className="text-[11px] text-gray-400 group-hover:text-gray-200 transition-colors font-medium">{label}</span>
        </label>
    )
}
