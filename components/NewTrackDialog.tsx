"use client"

import React, { useState } from 'react'
import { useProjectStore } from '@/store/projectStore'
import {
    X, Music, Mic, Drum, Keyboard,
    Guitar, LayoutGrid, Check, Settings2,
    Volume2, Cpu, Activity, HelpCircle,
    ChevronDown, Waves, AudioLines, Binary,
    Piano
} from 'lucide-react'

interface NewTrackDialogProps {
    onClose: () => void
}

type MainCategory = 'MIDI' | 'Pattern' | 'Session Player' | 'Audio';
type SubOption =
    | 'Software Instrument' | 'External MIDI'
    | 'Drummer' | 'Bass Player' | 'Keyboard Player'
    | 'Mic or Line' | 'Guitar or Bass';

export function NewTrackDialog({ onClose }: NewTrackDialogProps) {
    const {
        addTrack,
        toggleNewTrackDialog,
        newTrackDefaults,
        setNewTrackDefaults
    } = useProjectStore();

    // Initialize trackCount independently from store to avoid resets
    const [trackCount, setTrackCount] = useState(1);
    const [mainCategory, setMainCategory] = useState<MainCategory>(newTrackDefaults.mainCategory);
    const [subOption, setSubOption] = useState<SubOption>(newTrackDefaults.subOption as SubOption);
    const [detailsOpen, setDetailsOpen] = useState(true);

    // Audio Routing State
    const [audioInput, setAudioInput] = useState('Input 1');
    const [audioOutput, setAudioOutput] = useState('Output 1 + 2');
    const [inputMonitoring, setInputMonitoring] = useState(false);
    const [recordEnable, setRecordEnable] = useState(true);
    const [ascending, setAscending] = useState(false);

    const { globalSettings } = useProjectStore();
    const inputDeviceLabel = globalSettings.audio.inputDevice === 'default' ? 'System Setting' : (globalSettings.audio.inputDevice || 'None');
    const outputDeviceLabel = globalSettings.audio.outputDevice === 'default' ? 'System Setting' : (globalSettings.audio.outputDevice || 'None');

    const handleCategoryClick = (cat: MainCategory, opt: SubOption) => {
        setMainCategory(cat);
        setSubOption(opt);
        setNewTrackDefaults({ mainCategory: cat, subOption: opt });
    };

    const handleCreate = () => {
        for (let i = 0; i < trackCount; i++) {
            let trackType: any = 'midi';
            let color = '#63ed63';
            let icon = 'keyboard';
            let name = 'Inst';

            if (mainCategory === 'Audio') {
                trackType = 'audio';
                color = subOption === 'Guitar or Bass' ? '#f87171' : '#38bdf8';
                icon = subOption === 'Guitar or Bass' ? 'guitar' : 'mic';
                name = subOption === 'Guitar or Bass' ? 'Guitar' : 'Audio';
            } else if (mainCategory === 'Session Player') {
                trackType = 'drummer';
                color = '#fbbf24';
                icon = subOption === 'Drummer' ? 'drum' : subOption === 'Bass Player' ? 'guitar' : 'keyboard';
                name = subOption;
            } else if (subOption === 'External MIDI') {
                trackType = 'external-midi';
                color = '#10b981';
                icon = 'midi';
                name = 'MIDI';
            }

            addTrack({
                name: `${name} ${i + 1}`,
                type: trackType,
                color: color,
                icon: icon as any,
                recordEnabled: mainCategory === 'Audio' ? recordEnable : false,
                inputMonitoring: mainCategory === 'Audio' ? inputMonitoring : false,
                instrument: trackType === 'midi' || trackType === 'software-instrument' || trackType === 'drummer'
                    ? 'Steinway Piano'
                    : undefined,
            });
        }
        onClose();
    };

    const categories = [
        {
            id: 'MIDI',
            icon: Music,
            color: 'bg-[#22c55e]',
            options: ['Software Instrument', 'External MIDI']
        },
        {
            id: 'Pattern',
            icon: LayoutGrid,
            color: 'bg-[#6366f1]',
            options: ['Software Instrument', 'External MIDI']
        },
        {
            id: 'Session Player',
            icon: Piano,
            color: 'bg-[#a16207]',
            options: ['Drummer', 'Bass Player', 'Keyboard Player']
        },
        {
            id: 'Audio',
            icon: AudioLines,
            color: 'bg-[#3b82f6]',
            options: ['Mic or Line', 'Guitar or Bass']
        },
    ];

    return (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[#f2f2f7] w-[900px] rounded-[18px] shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden text-[#1c1c1e] animate-in zoom-in-95 duration-300 border border-white/20">

                {/* Header */}
                <div className="px-5 py-3.5 flex items-center justify-center border-b border-black/[0.05] bg-white/40">
                    <h2 className="text-[13px] font-black tracking-tight text-gray-800 uppercase">Create New Track</h2>
                    <button onClick={onClose} className="absolute right-4 p-1.5 hover:bg-black/5 rounded-full transition-colors group">
                        <X className="w-5 h-5 text-gray-400 group-hover:text-gray-900" />
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="p-8 bg-[#e5e5ea]/50 flex-1 overflow-y-auto">
                    {/* Category Grid */}
                    <div className="grid grid-cols-4 gap-4 mb-8">
                        {categories.map((cat) => (
                            <div
                                key={cat.id}
                                className={`border-[3px] rounded-2xl p-5 flex flex-col items-center transition-all duration-300 bg-white shadow-sm ${mainCategory === cat.id ? 'border-[#a16207] ring-4 ring-[#a16207]/10' : 'border-transparent opacity-80'}`}
                            >
                                <div className={`w-14 h-14 rounded-full ${cat.color} flex items-center justify-center mb-4 shadow-lg`}>
                                    <cat.icon className="w-8 h-8 text-white" />
                                </div>
                                <span className="text-[14px] font-black uppercase tracking-tight mb-4 text-gray-900">{cat.id}</span>

                                <div className="w-full flex flex-col gap-2">
                                    {cat.options.map((opt) => (
                                        <button
                                            key={opt}
                                            onClick={() => {
                                                setMainCategory(cat.id as MainCategory);
                                                setSubOption(opt as SubOption);
                                            }}
                                            className={`w-full py-2.5 rounded-lg text-[13px] font-bold transition-all border outline-none active:scale-95 ${subOption === opt && mainCategory === cat.id
                                                ? 'bg-[#a16207] text-white border-[#a16207] shadow-md'
                                                : 'bg-[#f2f2f7] text-gray-700 border-[#d1d1d6] hover:bg-white'
                                                }`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Details Accordion */}
                    <div className="mt-8 border-t border-black/[0.05] pt-4">
                        <button
                            onClick={() => setDetailsOpen(!detailsOpen)}
                            className="flex items-center gap-1.5 text-[12px] font-bold text-gray-500 hover:text-gray-800 transition-colors group"
                        >
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${detailsOpen ? '' : '-rotate-90'}`} />
                            Details
                        </button>

                        {detailsOpen && (
                            <div className="grid grid-cols-2 gap-x-12 gap-y-6 mt-6 pb-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                {mainCategory === 'Audio' ? (
                                    <>
                                        {/* Audio Input Column */}
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[12px] font-black text-gray-500 block mb-2 uppercase tracking-tight">Audio Input:</label>
                                                <div className="relative">
                                                    <select 
                                                        value={audioInput}
                                                        onChange={(e) => setAudioInput(e.target.value)}
                                                        className="w-full bg-[#d1d1d6]/30 border border-[#d1d1d6] rounded px-3 py-1.5 text-[13px] font-bold text-gray-800 appearance-none outline-none focus:ring-2 focus:ring-sky-500/30"
                                                    >
                                                        <option>Input 1</option>
                                                        <option>Input 2</option>
                                                        <option>Input 1 + 2</option>
                                                    </select>
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                                        <div className="bg-[#007aff] rounded p-0.5 text-white">
                                                            <ChevronDownSmall className="w-3.5 h-3.5" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-2.5">
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <div className="w-4 h-4 rounded-sm border border-[#d1d1d6] bg-white flex items-center justify-center group-hover:border-sky-500 shadow-inner">
                                                        {/* Unchecked */}
                                                    </div>
                                                    <span className="text-[12px] font-bold text-gray-700">Ascending</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <div className="w-4 h-4 rounded-sm border border-[#d1d1d6] bg-white flex items-center justify-center group-hover:border-sky-500 shadow-inner">
                                                        {/* Unchecked */}
                                                    </div>
                                                    <span className="text-[12px] font-bold text-gray-700">Load Default Patch</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <div className="w-4 h-4 rounded-sm border border-sky-500 bg-white flex items-center justify-center shadow-inner">
                                                        <Check className="w-3 h-3 text-sky-500" strokeWidth={4} />
                                                    </div>
                                                    <span className="text-[12px] font-bold text-gray-700">Open Library</span>
                                                </label>
                                            </div>

                                            <div className="flex items-center gap-1.5 pt-2">
                                                <span className="text-[11px] font-bold text-gray-500 truncate max-w-[140px]">Device: {inputDeviceLabel}</span>
                                                <div 
                                                    onClick={() => useProjectStore.getState().setShowSettingsDialog(true, 'Audio', 'Devices')}
                                                    className="w-3.5 h-3.5 rounded-full border border-gray-400 flex items-center justify-center cursor-pointer hover:bg-gray-200"
                                                >
                                                    <ChevronDownSmall className="w-2.5 h-2.5 rotate-[-90deg] text-gray-500" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Audio Output Column */}
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[12px] font-black text-gray-500 block mb-2 uppercase tracking-tight">Audio Output:</label>
                                                <div className="relative">
                                                    <select className="w-full bg-[#d1d1d6]/30 border border-[#d1d1d6] rounded px-3 py-1.5 text-[13px] font-bold text-gray-800 appearance-none outline-none focus:ring-2 focus:ring-sky-500/30">
                                                        <option>Output 1 + 2</option>
                                                        <option>Output 3 + 4</option>
                                                    </select>
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                                        <div className="bg-[#007aff] rounded p-0.5 text-white">
                                                            <ChevronDownSmall className="w-3.5 h-3.5" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-2.5">
                                                <label className="flex items-center gap-2 cursor-pointer group" onClick={() => setAscending(!ascending)}>
                                                    <div className={`w-4 h-4 rounded-sm border border-[#d1d1d6] flex items-center justify-center shadow-inner transition-colors ${ascending ? 'bg-sky-500 border-sky-600' : 'bg-white'}`}>
                                                        {ascending && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                                                    </div>
                                                    <span className="text-[12px] font-bold text-gray-700">Ascending</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer group" onClick={() => setInputMonitoring(!inputMonitoring)}>
                                                    <div className={`w-4 h-4 rounded-sm border border-[#d1d1d6] flex items-center justify-center shadow-inner transition-colors ${inputMonitoring ? 'bg-orange-500 border-orange-600' : 'bg-white'}`}>
                                                        {inputMonitoring && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                                                    </div>
                                                    <span className="text-[12px] font-bold text-gray-700">Input Monitoring</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer group" onClick={() => setRecordEnable(!recordEnable)}>
                                                    <div className={`w-4 h-4 rounded-sm border border-[#d1d1d6] flex items-center justify-center shadow-inner transition-colors ${recordEnable ? 'bg-red-500 border-red-600' : 'bg-white'}`}>
                                                        {recordEnable && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                                                    </div>
                                                    <span className="text-[12px] font-bold text-gray-700">Record Enable</span>
                                                </label>
                                            </div>

                                            <div className="flex items-center gap-1.5 pt-2">
                                                <span className="text-[11px] font-bold text-gray-500 truncate max-w-[140px]">Device: {outputDeviceLabel}</span>
                                                <div 
                                                    onClick={() => useProjectStore.getState().setShowSettingsDialog(true, 'Audio', 'Devices')}
                                                    className="w-3.5 h-3.5 rounded-full border border-gray-400 flex items-center justify-center cursor-pointer hover:bg-gray-200"
                                                >
                                                    <ChevronDownSmall className="w-2.5 h-2.5 rotate-[-90deg] text-gray-500" />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* Software Instrument / Pattern Details (Original Layout) */}
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[12px] font-black text-gray-500 block mb-2">{subOption} Style:</label>
                                                <div className="relative">
                                                    <select className="w-full bg-white border border-[#d1d1d6] rounded px-3 py-1.5 text-[13px] font-bold text-gray-800 appearance-none outline-none focus:ring-2 focus:ring-sky-500/30">
                                                        <option>Freely</option>
                                                        <option>Modern Pop</option>
                                                        <option>Vintage Soul</option>
                                                        <option>Electronic</option>
                                                    </select>
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                                        <div className="bg-sky-500 rounded p-0.5 text-white">
                                                            <ChevronDownSmall className="w-4 h-4" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <div className="w-4 h-4 rounded-sm border border-[#d1d1d6] bg-white flex items-center justify-center group-hover:border-sky-500">
                                                        <Check className="w-3 h-3 text-sky-500" />
                                                    </div>
                                                    <span className="text-[13px] font-bold text-gray-700">Use Default Chord Progression</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <div className="w-4 h-4 rounded-sm border border-[#d1d1d6] bg-white flex items-center justify-center group-hover:border-sky-500">
                                                    </div>
                                                    <span className="text-[13px] font-bold text-gray-700">Open Library</span>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[12px] font-black text-gray-500 block mb-2">Audio Output:</label>
                                                <div className="relative">
                                                    <select className="w-full bg-white border border-[#d1d1d6] rounded px-3 py-1.5 text-[13px] font-bold text-gray-800 appearance-none outline-none focus:ring-2 focus:ring-sky-500/30">
                                                        <option>Output 1 + 2</option>
                                                        <option>Output 3 + 4</option>
                                                        <option>Bus 1 (Surround)</option>
                                                    </select>
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                                        <div className="bg-sky-500 rounded p-0.5 text-white">
                                                            <ChevronDownSmall className="w-4 h-4" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-[12px] font-bold text-gray-500">
                                                Device: MacBook Pro Speakers
                                                <Settings2 className="w-3.5 h-3.5 cursor-pointer hover:text-gray-800" />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Toolbar */}
                <div className="px-6 py-4 bg-[#f2f2f7] border-t border-black/[0.05] flex items-center justify-between">
                    <button className="p-2 hover:bg-black/5 rounded-full transition-colors">
                        <HelpCircle className="w-5 h-5 text-gray-400" />
                    </button>

                    <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-gray-600">Number of tracks to create:</span>
                        <input
                            type="number"
                            min={1}
                            max={99}
                            className="w-14 bg-white border border-[#d1d1d6] rounded px-2 py-1 text-center font-bold text-[13px] outline-none"
                            value={trackCount}
                            onChange={(e) => {
                                const value = e.target.value

                                if (value === "") {
                                    setTrackCount("" as any)
                                    return
                                }

                                const num = Number(value)
                                if (!isNaN(num)) {
                                    setTrackCount(num)
                                }
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    handleCreate()
                                }
                            }}
                        />
                    </div>

                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-8 py-1.5 rounded-lg bg-white border border-[#d1d1d6] text-[13px] font-bold text-gray-800 hover:bg-[#fafafa] active:scale-95 transition-all outline-none">Cancel</button>
                        <button
                            onClick={handleCreate}
                            className="px-10 py-1.5 rounded-lg bg-[#007aff] text-white text-[13px] font-bold shadow-md hover:bg-[#0062cc] active:scale-95 transition-all outline-none"
                        >
                            Create
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function ChevronDownSmall({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="m6 9 6 6 6-6" />
        </svg>
    )
}
