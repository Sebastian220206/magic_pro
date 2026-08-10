"use client"

import React, { useState } from 'react'
import { useProjectStore } from '@/store/projectStore'
import { neonTrackColor, neonTrackAlpha, neonTrackTextColor } from '@/lib/trackColor'
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

interface TrackPreset {
    type: 'midi' | 'audio' | 'drummer' | 'external-midi';
    color: string;
    icon: string;
    name: string;
}

/**
 * What a given choice will actually create.
 *
 * The dialog and `handleCreate` both read this, so the colour shown on a card
 * is by construction the colour the track gets. Previously the card chips were
 * a separate hard-coded list and had already drifted — Pattern showed violet
 * but produced a green track.
 */
function trackPreset(category: MainCategory, option: SubOption): TrackPreset {
    if (category === 'Audio') {
        const guitar = option === 'Guitar or Bass';
        return {
            type: 'audio',
            color: guitar ? '#ec4899' : '#22d3ee',
            icon: guitar ? 'guitar' : 'mic',
            name: guitar ? 'Guitar' : 'Audio',
        };
    }
    if (category === 'Session Player') {
        return {
            type: 'drummer',
            color: '#fb923c',
            icon: option === 'Drummer' ? 'drum' : option === 'Bass Player' ? 'guitar' : 'keyboard',
            name: option,
        };
    }
    if (option === 'External MIDI') {
        return { type: 'external-midi', color: '#a78bfa', icon: 'midi', name: 'MIDI' };
    }
    // A Pattern track is a MIDI track, but it gets its own hue so the four
    // categories stay visually distinct.
    if (category === 'Pattern') {
        return { type: 'midi', color: '#e879f9', icon: 'keyboard', name: 'Pattern' };
    }
    return { type: 'midi', color: '#4ade80', icon: 'keyboard', name: 'Inst' };
}

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
        const { type: trackType, color, icon, name } = trackPreset(mainCategory, subOption);

        for (let i = 0; i < trackCount; i++) {
            addTrack({
                name: `${name} ${i + 1}`,
                type: trackType,
                color: color,
                icon: icon as any,
                recordEnabled: mainCategory === 'Audio' ? recordEnable : false,
                inputMonitoring: mainCategory === 'Audio' ? inputMonitoring : false,
                // `'software-instrument'` was also tested here, but this dialog
                // never produced that type — typing the preset made the dead
                // branch visible.
                instrument: trackType === 'midi' || trackType === 'drummer'
                    ? 'Steinway Piano'
                    : undefined,
            });
        }
        onClose();
    };

    const categories: { id: MainCategory; icon: typeof Music; options: SubOption[] }[] = [
        { id: 'MIDI',           icon: Music,      options: ['Software Instrument', 'External MIDI'] },
        { id: 'Pattern',        icon: LayoutGrid, options: ['Software Instrument', 'External MIDI'] },
        { id: 'Session Player', icon: Piano,      options: ['Drummer', 'Bass Player', 'Keyboard Player'] },
        { id: 'Audio',          icon: AudioLines, options: ['Mic or Line', 'Guitar or Bass'] },
    ];

    /** The colour a card previews. It follows whichever option is highlighted. */
    const colorFor = (cat: { id: MainCategory; options: SubOption[] }) =>
        trackPreset(cat.id, mainCategory === cat.id ? subOption : cat.options[0]).color;

    /** The colour of the track the current selection will create. */
    const selectedColor = trackPreset(mainCategory, subOption).color;

    return (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-studio-panel w-[900px] rounded-[18px] shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden text-studio-text animate-in zoom-in-95 duration-300 border border-white/20">

                {/* Header */}
                <div className="px-5 py-3.5 flex items-center justify-center border-b border-white/5 bg-white/[0.04]">
                    <h2 className="text-[13px] font-black tracking-tight text-studio-text uppercase">Create New Track</h2>
                    <button onClick={onClose} className="absolute right-4 p-1.5 hover:bg-black/5 rounded-full transition-colors group">
                        <X className="w-5 h-5 text-studio-text-mid group-hover:text-studio-text" />
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="p-8 bg-studio-raised/50 flex-1 overflow-y-auto">
                    {/* Category Grid */}
                    <div className="grid grid-cols-4 gap-4 mb-8">
                        {categories.map((cat) => {
                            const tint = colorFor(cat);
                            const active = mainCategory === cat.id;
                            return (
                                <div
                                    key={cat.id}
                                    className="border-[3px] rounded-2xl p-5 flex flex-col items-center transition-all duration-300"
                                    style={{
                                        backgroundColor: neonTrackAlpha(tint, active ? 0.14 : 0.06),
                                        borderColor: active ? neonTrackColor(tint) : neonTrackAlpha(tint, 0.25),
                                        boxShadow: active ? `0 0 24px ${neonTrackAlpha(tint, 0.35)}` : 'none',
                                    }}
                                >
                                    <div
                                        className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                                        style={{
                                            backgroundColor: neonTrackColor(tint),
                                            boxShadow: `0 0 18px ${neonTrackAlpha(tint, 0.6)}`,
                                        }}
                                    >
                                        <cat.icon className="w-8 h-8 text-[#04070b]" />
                                    </div>
                                    <span
                                        className="text-[14px] font-black uppercase tracking-tight mb-4"
                                        style={{ color: neonTrackTextColor(tint) }}
                                    >
                                        {cat.id}
                                    </span>

                                    <div className="w-full flex flex-col gap-2">
                                        {cat.options.map((opt) => {
                                            const optTint = trackPreset(cat.id, opt).color;
                                            const chosen = subOption === opt && active;
                                            return (
                                                <button
                                                    key={opt}
                                                    onClick={() => {
                                                        setMainCategory(cat.id);
                                                        setSubOption(opt);
                                                    }}
                                                    className="w-full py-2.5 rounded-lg text-[13px] font-bold transition-all border outline-none active:scale-95"
                                                    style={chosen ? {
                                                        backgroundColor: neonTrackColor(optTint),
                                                        borderColor: neonTrackColor(optTint),
                                                        color: '#04070b',
                                                        boxShadow: `0 0 14px ${neonTrackAlpha(optTint, 0.5)}`,
                                                    } : {
                                                        backgroundColor: 'rgba(4, 7, 11, 0.45)',
                                                        borderColor: neonTrackAlpha(optTint, 0.28),
                                                        color: neonTrackTextColor(optTint),
                                                    }}
                                                >
                                                    {opt}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Details Accordion */}
                    <div className="mt-8 border-t border-white/5 pt-4">
                        <button
                            onClick={() => setDetailsOpen(!detailsOpen)}
                            className="flex items-center gap-1.5 text-[12px] font-bold text-studio-text-dim hover:text-studio-text transition-colors group"
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
                                                <label className="text-[12px] font-black text-studio-text-dim block mb-2 uppercase tracking-tight">Audio Input:</label>
                                                <div className="relative">
                                                    <select 
                                                        value={audioInput}
                                                        onChange={(e) => setAudioInput(e.target.value)}
                                                        className="w-full bg-studio-control/30 border border-studio-line rounded px-3 py-1.5 text-[13px] font-bold text-studio-text appearance-none outline-none focus:ring-2 focus:ring-accent-cyan/30"
                                                    >
                                                        <option>Input 1</option>
                                                        <option>Input 2</option>
                                                        <option>Input 1 + 2</option>
                                                    </select>
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                                        <div className="bg-accent-cyan rounded p-0.5 text-white">
                                                            <ChevronDownSmall className="w-3.5 h-3.5" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-2.5">
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <div className="w-4 h-4 rounded-sm border border-studio-line bg-studio-control flex items-center justify-center group-hover:border-accent-cyan shadow-inner">
                                                        {/* Unchecked */}
                                                    </div>
                                                    <span className="text-[12px] font-bold text-studio-text-dim">Ascending</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <div className="w-4 h-4 rounded-sm border border-studio-line bg-studio-control flex items-center justify-center group-hover:border-accent-cyan shadow-inner">
                                                        {/* Unchecked */}
                                                    </div>
                                                    <span className="text-[12px] font-bold text-studio-text-dim">Load Default Patch</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <div className="w-4 h-4 rounded-sm border border-accent-cyan bg-studio-control flex items-center justify-center shadow-inner">
                                                        <Check className="w-3 h-3 text-accent-cyan" strokeWidth={4} />
                                                    </div>
                                                    <span className="text-[12px] font-bold text-studio-text-dim">Open Library</span>
                                                </label>
                                            </div>

                                            <div className="flex items-center gap-1.5 pt-2">
                                                <span className="text-[11px] font-bold text-studio-text-dim truncate max-w-[140px]">Device: {inputDeviceLabel}</span>
                                                <div 
                                                    onClick={() => useProjectStore.getState().setShowSettingsDialog(true, 'Audio', 'Devices')}
                                                    className="w-3.5 h-3.5 rounded-full border border-studio-line flex items-center justify-center cursor-pointer hover:bg-white/10"
                                                >
                                                    <ChevronDownSmall className="w-2.5 h-2.5 rotate-[-90deg] text-studio-text-dim" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Audio Output Column */}
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[12px] font-black text-studio-text-dim block mb-2 uppercase tracking-tight">Audio Output:</label>
                                                <div className="relative">
                                                    <select className="w-full bg-studio-control/30 border border-studio-line rounded px-3 py-1.5 text-[13px] font-bold text-studio-text appearance-none outline-none focus:ring-2 focus:ring-accent-cyan/30">
                                                        <option>Output 1 + 2</option>
                                                        <option>Output 3 + 4</option>
                                                    </select>
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                                        <div className="bg-accent-cyan rounded p-0.5 text-white">
                                                            <ChevronDownSmall className="w-3.5 h-3.5" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-2.5">
                                                <label className="flex items-center gap-2 cursor-pointer group" onClick={() => setAscending(!ascending)}>
                                                    <div className={`w-4 h-4 rounded-sm border border-studio-line flex items-center justify-center shadow-inner transition-colors ${ascending ? 'bg-accent-cyan border-accent-cyan' : 'bg-studio-control'}`}>
                                                        {ascending && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                                                    </div>
                                                    <span className="text-[12px] font-bold text-studio-text-dim">Ascending</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer group" onClick={() => setInputMonitoring(!inputMonitoring)}>
                                                    <div className={`w-4 h-4 rounded-sm border border-studio-line flex items-center justify-center shadow-inner transition-colors ${inputMonitoring ? 'bg-orange-500 border-orange-600' : 'bg-studio-control'}`}>
                                                        {inputMonitoring && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                                                    </div>
                                                    <span className="text-[12px] font-bold text-studio-text-dim">Input Monitoring</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer group" onClick={() => setRecordEnable(!recordEnable)}>
                                                    <div className={`w-4 h-4 rounded-sm border border-studio-line flex items-center justify-center shadow-inner transition-colors ${recordEnable ? 'bg-red-500 border-red-600' : 'bg-studio-control'}`}>
                                                        {recordEnable && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                                                    </div>
                                                    <span className="text-[12px] font-bold text-studio-text-dim">Record Enable</span>
                                                </label>
                                            </div>

                                            <div className="flex items-center gap-1.5 pt-2">
                                                <span className="text-[11px] font-bold text-studio-text-dim truncate max-w-[140px]">Device: {outputDeviceLabel}</span>
                                                <div 
                                                    onClick={() => useProjectStore.getState().setShowSettingsDialog(true, 'Audio', 'Devices')}
                                                    className="w-3.5 h-3.5 rounded-full border border-studio-line flex items-center justify-center cursor-pointer hover:bg-white/10"
                                                >
                                                    <ChevronDownSmall className="w-2.5 h-2.5 rotate-[-90deg] text-studio-text-dim" />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* Software Instrument / Pattern Details (Original Layout) */}
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[12px] font-black text-studio-text-dim block mb-2">{subOption} Style:</label>
                                                <div className="relative">
                                                    <select className="w-full bg-studio-control border border-studio-line rounded px-3 py-1.5 text-[13px] font-bold text-studio-text appearance-none outline-none focus:ring-2 focus:ring-accent-cyan/30">
                                                        <option>Freely</option>
                                                        <option>Modern Pop</option>
                                                        <option>Vintage Soul</option>
                                                        <option>Electronic</option>
                                                    </select>
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                                        <div className="bg-accent-cyan rounded p-0.5 text-white">
                                                            <ChevronDownSmall className="w-4 h-4" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <div className="w-4 h-4 rounded-sm border border-studio-line bg-studio-control flex items-center justify-center group-hover:border-accent-cyan">
                                                        <Check className="w-3 h-3 text-accent-cyan" />
                                                    </div>
                                                    <span className="text-[13px] font-bold text-studio-text-dim">Use Default Chord Progression</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <div className="w-4 h-4 rounded-sm border border-studio-line bg-studio-control flex items-center justify-center group-hover:border-accent-cyan">
                                                    </div>
                                                    <span className="text-[13px] font-bold text-studio-text-dim">Open Library</span>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[12px] font-black text-studio-text-dim block mb-2">Audio Output:</label>
                                                <div className="relative">
                                                    <select className="w-full bg-studio-control border border-studio-line rounded px-3 py-1.5 text-[13px] font-bold text-studio-text appearance-none outline-none focus:ring-2 focus:ring-accent-cyan/30">
                                                        <option>Output 1 + 2</option>
                                                        <option>Output 3 + 4</option>
                                                        <option>Bus 1 (Surround)</option>
                                                    </select>
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                                        <div className="bg-accent-cyan rounded p-0.5 text-white">
                                                            <ChevronDownSmall className="w-4 h-4" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-[12px] font-bold text-studio-text-dim">
                                                Device: MacBook Pro Speakers
                                                <Settings2 className="w-3.5 h-3.5 cursor-pointer hover:text-studio-text" />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Toolbar */}
                <div className="px-6 py-4 bg-studio-panel border-t border-white/5 flex items-center justify-between">
                    <button className="p-2 hover:bg-black/5 rounded-full transition-colors">
                        <HelpCircle className="w-5 h-5 text-studio-text-mid" />
                    </button>

                    <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-studio-text-dim">Number of tracks to create:</span>
                        <input
                            type="number"
                            min={1}
                            max={99}
                            className="w-14 bg-studio-control border border-studio-line rounded px-2 py-1 text-center font-bold text-[13px] outline-none"
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
                        <button onClick={onClose} className="px-8 py-1.5 rounded-lg bg-studio-control border border-studio-line text-[13px] font-bold text-studio-text hover:bg-studio-panel active:scale-95 transition-all outline-none">Cancel</button>
                        {/* Carries the colour of the track it is about to make. */}
                        <button
                            onClick={handleCreate}
                            className="px-10 py-1.5 rounded-lg text-[13px] font-bold active:scale-95 transition-all outline-none"
                            style={{
                                backgroundColor: neonTrackColor(selectedColor),
                                color: '#04070b',
                                boxShadow: `0 0 18px ${neonTrackAlpha(selectedColor, 0.45)}`,
                            }}
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
