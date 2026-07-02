"use client"
import React, { useState, useEffect, useRef } from 'react'
import { useProjectStore } from '@/store/projectStore'
import {
    X, Settings, Activity, Circle, Piano, Music, Film,
    Share2, SlidersHorizontal, Eye, User, Settings2, Check, AlertCircle, Loader2,
    RotateCcw, ChevronDown, ChevronUp
} from 'lucide-react'

// --- Reusable Components (Premium Refined) ---

interface DropdownOption {
    label: string;
    value: any;
}

interface DropdownProps {
    label: string;
    value: any;
    options: (string | number | DropdownOption)[];
    onChange: (value: any) => void;
    suffix?: string;
    disabled?: boolean;
}

function Dropdown({ label, value, options, onChange, suffix, disabled }: DropdownProps) {
    const [isOpen, setIsOpen] = useState(false);

    const normalizedOptions = options.map(opt =>
        typeof opt === 'object' ? opt : { label: opt.toString(), value: opt }
    );

    const displayLabel = normalizedOptions.find(o => o.value === value)?.label || value;

    return (
        <div className={`flex items-center justify-between transition-all ${disabled ? 'opacity-30 pointer-events-none' : ''}`}>
            <span className="text-[12px] font-medium text-gray-300 w-1/3 text-right pr-6">{label}:</span>
            <div className="flex items-center gap-3 relative w-2/3">
                <div
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    className="w-[240px] h-6 bg-[#1a1a1a] border border-[#444] rounded-md flex items-center justify-between px-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] cursor-pointer hover:border-sky-500/50 transition-all group"
                >
                    <span className="text-[11px] text-gray-200 truncate">{displayLabel}</span>
                    <div className="flex flex-col items-center justify-center h-full">
                        <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 fill-sky-400 group-hover:fill-sky-300 transition-colors">
                            <path d="M5 2L8 5L2 5L5 2Z" fillOpacity="0.8" />
                            <path d="M5 8L8 5L2 5L5 8Z" fillOpacity="0.8" />
                        </svg>
                    </div>
                </div>
                {suffix && <span className="text-[11px] text-gray-500 w-16">{suffix}</span>}

                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                        <div className="absolute top-7 left-0 w-[240px] bg-[#222] border border-[#444] rounded-md shadow-2xl z-50 overflow-hidden py-1.5 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/50">
                            {normalizedOptions.length > 0 ? normalizedOptions.map((opt) => (
                                <div
                                    key={opt.value}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setIsOpen(false);
                                    }}
                                    className={`px-3 py-1.5 text-[11px] flex items-center justify-between transition-colors cursor-pointer hover:bg-sky-500 hover:text-white ${value === opt.value ? 'bg-sky-500/10 text-sky-400' : 'text-gray-300'}`}
                                >
                                    {opt.label}
                                    {value === opt.value && <Check className="w-3 h-3" />}
                                </div>
                            )) : (
                                <div className="px-3 py-2 text-[10px] text-gray-600 italic text-center">
                                    No options
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

interface ToggleProps { label: string; enabled: boolean; onChange: (enabled: boolean) => void; }
function Toggle({ label, enabled, onChange }: ToggleProps) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-gray-300 w-1/3 text-right pr-6">{label}:</span>
            <div className="w-2/3 flex items-center">
                <div
                    onClick={() => onChange(!enabled)}
                    className="flex items-center gap-2 cursor-pointer group"
                >
                    <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${enabled ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                        {enabled && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                    </div>
                    <span className={`text-[12px] transition-colors ${enabled ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>
                        {enabled ? 'Enabled' : 'Disabled'}
                    </span>
                </div>
            </div>
        </div>
    );
}

interface SliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
    suffix?: string;
    disabled?: boolean;
}

function Slider({ label, value, min, max, onChange, suffix, disabled }: SliderProps) {
    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div className={`flex items-center justify-between transition-all ${disabled ? 'opacity-30 pointer-events-none' : ''}`}>
            <span className="text-[12px] font-medium text-gray-300 w-1/3 text-right pr-6">{label}:</span>
            <div className="w-2/3 flex items-center gap-4">
                <div className="flex-1 relative h-6 flex items-center group">
                    {/* Tick Marks Overlay */}
                    <div className="absolute inset-0 flex items-center justify-between px-0.5 pointer-events-none">
                        {[...Array(11)].map((_, i) => (
                            <div key={i} className={`w-[1px] h-1.5 ${i === 5 ? 'bg-gray-500 h-2.5' : 'bg-gray-700'}`} />
                        ))}
                    </div>

                    <div className="w-full h-[3px] bg-[#111] rounded-full overflow-hidden border-t border-black/50">
                        <div
                            className="h-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.4)]"
                            style={{ width: `${percentage}%` }}
                        />
                    </div>

                    <input
                        type="range"
                        min={min}
                        max={max}
                        value={value}
                        onChange={(e) => onChange(parseInt(e.target.value))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />

                    <div
                        className="absolute top-1/2 -translate-y-1/2 w-[14px] h-[14px] bg-[#f0f0f0] border border-gray-400 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.5)] transition-transform group-active:scale-95"
                        style={{ left: `calc(${percentage}% - 7px)` }}
                    >
                        <div className="absolute inset-[3px] rounded-full bg-gray-300 border-t border-white/50" />
                    </div>
                </div>

                <div className="w-[80px] h-6 bg-[#1a1a1a] border border-[#444] rounded-md flex items-center justify-between px-2 shadow-inner">
                    <input
                        type="number"
                        value={value}
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) onChange(Math.max(min, Math.min(max, val)));
                        }}
                        className="text-[11px] text-gray-200 bg-transparent outline-none w-full font-mono"
                    />
                    <div className="flex flex-col gap-0.5 pointer-events-none opacity-40">
                        <ChevronUp className="w-2.5 h-2.5 text-gray-300" />
                        <ChevronDown className="w-2.5 h-2.5 text-gray-300" />
                    </div>
                </div>
                <span className="text-[11px] text-gray-500 w-16">{suffix}</span>
            </div>
        </div>
    );
}

// --- Main Component ---

export function PreferencesDialog() {
    const {
        showSettingsDialog,
        setShowSettingsDialog,
        settingsActiveTab,
        settingsActiveSubTab,
        globalSettings,
        updateGlobalSettings
    } = useProjectStore();

    const [isApplying, setIsApplying] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
    const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
    const [hasPermission, setHasPermission] = useState(false);
    const midiAccessRef = useRef<MIDIAccess | null>(null);

    const refreshMidiDevices = async () => {
        if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) return;
        try {
            const access = await navigator.requestMIDIAccess();
            midiAccessRef.current = access;

            const inputs: { name: string; enabled: boolean }[] = [];
            access.inputs.forEach(input => {
                inputs.push({ name: input.name || 'Unknown MIDI Device', enabled: true });
            });

            const currentMidi = globalSettings.midi || {};
            const existingInputs = (currentMidi.inputs || []) as { name: string; enabled: boolean }[];
            const mergedInputs = inputs.map(newInput => {
                const existing = existingInputs.find(e => e.name === newInput.name);
                return existing ? { ...newInput, enabled: existing.enabled } : newInput;
            });

            updateMidi({ ...currentMidi, inputs: mergedInputs });

            access.onstatechange = () => {
                const updatedInputs: { name: string; enabled: boolean }[] = [];
                access.inputs.forEach(input => {
                    updatedInputs.push({ name: input.name || 'Unknown MIDI Device', enabled: true });
                });
                const merged = updatedInputs.map(newInput => {
                    const existing = (globalSettings.midi?.inputs || []).find((e: any) => e.name === newInput.name);
                    return existing ? { ...newInput, enabled: existing.enabled } : newInput;
                });
                updateMidi({ ...globalSettings.midi, inputs: merged });
            };
        } catch (e) {
            console.warn('[Preferences] MIDI access failed', e);
        }
    };

    const refreshDevices = async () => {
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
                let devices = await navigator.mediaDevices.enumerateDevices();
                const needsPermission = devices.some(d => !d.label);

                if (needsPermission && !hasPermission) {
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        stream.getTracks().forEach(track => track.stop());
                        setHasPermission(true);
                        devices = await navigator.mediaDevices.enumerateDevices();
                    } catch (e) {
                        console.warn("Permission denied or microphone not found:", e);
                    }
                }

                const inputs = devices.filter(d => d.kind === 'audioinput' && d.label);
                const outputs = devices.filter(d => d.kind === 'audiooutput' && d.label);

                const uniqueInputs = Array.from(new Map(inputs.map(d => [d.label, d])).values());
                const uniqueOutputs = Array.from(new Map(outputs.map(d => [d.label, d])).values());

                setInputDevices(uniqueInputs);
                setOutputDevices(uniqueOutputs);
            }
        } catch (err) {
            console.error("Error enumerating devices:", err);
        }
    };

    useEffect(() => {
        if (showSettingsDialog) {
            refreshDevices();
        }
        navigator.mediaDevices?.addEventListener('devicechange', refreshDevices);
        return () => {
            navigator.mediaDevices?.removeEventListener('devicechange', refreshDevices);
        };
    }, [showSettingsDialog]);

    useEffect(() => {
        if (showSettingsDialog && globalSettings.midi?.activeSubTab === 'Inputs') {
            refreshMidiDevices();
        }
    }, [showSettingsDialog, globalSettings.midi?.activeSubTab]);

    if (!showSettingsDialog) return null;

    const audio = globalSettings.audio;
    const recording = globalSettings.recording;
    const midi = globalSettings.midi;
    const score = globalSettings.score;
    const movie = globalSettings.movie;
    const automation = globalSettings.automation;
    const controlSurfaces = globalSettings.controlSurfaces;
    const view = globalSettings.view;
    const advanced = globalSettings.advanced;
    const myInfo = globalSettings.myInfo;
    const general = globalSettings.general;

    const updateAudio = (updates: Partial<typeof audio>) => {
        updateGlobalSettings({ audio: { ...audio, ...updates } });
    };

    const updateRecording = (updates: Partial<typeof recording>) => {
        updateGlobalSettings({ recording: { ...recording, ...updates } });
    };

    const updateMidi = (updates: Partial<typeof midi>) => {
        updateGlobalSettings({ midi: { ...midi, ...updates } });
    };

    const updateScore = (updates: Partial<typeof score>) => {
        updateGlobalSettings({ score: { ...score, ...updates } });
    };

    const updateMovie = (updates: Partial<typeof movie>) => {
        updateGlobalSettings({ movie: { ...movie, ...updates } });
    };

    const updateAutomation = (updates: Partial<typeof automation>) => {
        updateGlobalSettings({ automation: { ...automation, ...updates } });
    };

    const updateControlSurfaces = (updates: Partial<typeof controlSurfaces>) => {
        updateGlobalSettings({ controlSurfaces: { ...controlSurfaces, ...updates } });
    };

    const updateView = (updates: Partial<typeof view>) => {
        updateGlobalSettings({ view: { ...view, ...updates } });
    };

    const updateAdvanced = (updates: Partial<typeof advanced>) => {
        updateGlobalSettings({ advanced: { ...advanced, ...updates } });
    };

    const updateMyInfo = (updates: Partial<typeof myInfo>) => {
        updateGlobalSettings({ myInfo: { ...myInfo, ...updates } });
    };

    const updateGeneral = (updates: Partial<typeof general>) => {
        updateGlobalSettings({ general: { ...general, ...updates } });
    };

    const outputLatency = (audio.ioBufferSize / audio.sampleRate) * 1000;
    const roundTripLatency = outputLatency * 2;
    const isLowBuffer = audio.ioBufferSize <= 64;

    const mainTabs = [
        { name: 'General', icon: Settings },
        { name: 'Audio', icon: Activity },
        { name: 'Recording', icon: Circle },
        { name: 'MIDI', icon: Piano },
        { name: 'Score', icon: Music },
        { name: 'Movie', icon: Film },
        { name: 'Automation', icon: Share2 },
        { name: 'Control Surfaces', icon: SlidersHorizontal },
        { name: 'View', icon: Eye },
        { name: 'My Info', icon: User },
        { name: 'Advanced', icon: Settings2 },
    ]

    const subTabs = settingsActiveTab === 'General'
        ? ['Project Handling', 'Editing', 'Cycle', 'Catch', 'Notifications', 'Accessibility']
        : settingsActiveTab === 'Audio'
            ? ['Devices', 'General', 'Sampler', 'Editing', 'I/O Assignments', 'File Editor']
            : settingsActiveTab === 'Control Surfaces'
                ? ['General', 'Help Tags', 'MIDI Controllers']
                : settingsActiveTab === 'View'
                    ? ['General', 'Tracks', 'Mixer', 'Editors']
                    : settingsActiveTab === 'MIDI'
                    ? ['General', 'Reset Messages', 'Sync', 'Inputs']
                    : ['General'];

    const handleApply = () => {
        setIsApplying(true);
        setTimeout(() => {
            setIsApplying(false);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        }, 800);
    };

    const bufferSizeOptions = [32, 64, 128, 256, 512, 1024];
    const threadOptions = ["Automatic (Recommended)", "2", "4", "8", "16"];
    const bufferRangeOptions = ["Small", "Medium", "Large"];
    const multithreadingOptions = ["Playback & Live Tracks", "Playback Tracks only", "Off"];
    const summingOptions = ["Standard (32-bit)", "High Precision (64-bit)"];

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[#2a2a2e]/95 w-[820px] rounded-xl shadow-[0_30px_90px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden border border-white/10 select-none font-sans text-gray-200 backdrop-blur-2xl">

                {/* Header / Title Bar */}
                <div className="h-10 flex items-center justify-between px-4 bg-gradient-to-b from-[#3a3a3e] to-[#2a2a2e] border-b border-black/40 shadow-sm relative z-10">
                    <div className="flex gap-2 items-center">
                        <button onClick={() => setShowSettingsDialog(false)} className="w-3 h-3 rounded-full bg-[#ff5f56] border border-black/20 hover:brightness-110 transition-all shadow-inner" />
                        <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-black/20 shadow-inner" />
                        <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-black/20 shadow-inner" />
                    </div>
                    <span className="text-[12px] font-semibold text-gray-300 tracking-tight">Settings</span>
                    <div className="w-16" />
                </div>

                {/* Top Nav Icons */}
                <div className="px-2 py-3 flex items-center justify-center gap-1 border-b border-black/20 bg-[#252529]">
                    {mainTabs.map((tab) => (
                        <button
                            key={tab.name}
                            onClick={() => setShowSettingsDialog(true, tab.name)}
                            className={`flex flex-col items-center gap-1.5 min-w-[64px] py-1 transition-all rounded-lg ${settingsActiveTab === tab.name ? 'bg-white/5' : 'hover:bg-white/5'}`}
                        >
                            <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${settingsActiveTab === tab.name ? 'bg-sky-500 text-white shadow-[0_0_15px_rgba(14,165,233,0.3)]' : 'text-gray-500'}`}>
                                <tab.icon className={`w-[22px] h-[22px] ${settingsActiveTab === tab.name ? 'animate-in zoom-in-75 duration-300' : ''}`} />
                            </div>
                            <span className={`text-[9px] whitespace-nowrap font-semibold tracking-wide transition-colors ${settingsActiveTab === tab.name ? 'text-sky-400' : 'text-gray-500'}`}>{tab.name}</span>
                        </button>
                    ))}
                </div>

                {/* Sub-Tabs (Horizontal) */}
                <div className="bg-[#1e1e22] px-4 py-2 border-b border-black/40 flex justify-center gap-1 shadow-inner">
                    {subTabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setShowSettingsDialog(true, undefined, tab)}
                            className={`px-3 py-1 rounded-[4px] text-[11px] font-semibold transition-all ${settingsActiveSubTab === tab ? 'bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/30' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-12 bg-[#252529] relative min-h-[480px]">
                    {settingsActiveTab === 'General' && settingsActiveSubTab === 'Project Handling' && (
                        <div className="max-w-2xl mx-auto space-y-8">
                            <Dropdown
                                label="Startup Action"
                                value={general.startupAction}
                                options={['Select a Template', 'Do Nothing', 'Open Most Recent Project', 'Open New Project']}
                                onChange={(val) => updateGeneral({ startupAction: val })}
                            />
                            
                            <div className="flex items-center justify-between">
                                <span className="text-[12px] font-medium text-gray-300 w-1/3 text-right pr-6">Default Template:</span>
                                <div className="w-2/3">
                                    <button className="px-10 py-1 bg-[#1a1a1a] hover:bg-[#222] border border-[#444] rounded text-[11px] text-gray-400 transition-all shadow-sm">
                                        {general.defaultTemplate}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3 pl-[33.33%]">
                                {[
                                    { label: 'When opening a project, ask whether current project should be closed.', key: 'askToCloseProject' },
                                    { label: 'Export MIDI File command saves single MIDI region as format 0.', key: 'exportMidiFormat0' },
                                    { label: 'Save undo history with project', key: 'saveUndoHistoryWithProject' }
                                ].map((item) => (
                                    <div 
                                        key={item.key}
                                        onClick={() => updateGeneral({ [item.key]: !general[item.key as keyof typeof general] })}
                                        className="flex items-center gap-2 cursor-pointer group"
                                    >
                                        <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${general[item.key as keyof typeof general] ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                            {general[item.key as keyof typeof general] && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                        </div>
                                        <span className={`text-[12px] transition-colors ${general[item.key as keyof typeof general] ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>{item.label}</span>
                                    </div>
                                ))}
                            </div>

                            <Dropdown
                                label="Auto Backup"
                                value={general.autoBackup}
                                options={['Last 10 Alternative Versions', 'None', 'Last 5 Versions', 'Last 32 Versions']}
                                onChange={(val) => updateGeneral({ autoBackup: val })}
                            />

                            <Dropdown
                                label="Recent Items"
                                value={general.recentItems}
                                options={['System Default', 'None', '5', '10', '20', '30']}
                                onChange={(val) => updateGeneral({ recentItems: val })}
                            />
                        </div>
                    )}

                    {settingsActiveTab === 'General' && settingsActiveSubTab === 'Editing' && (
                        <div className="max-w-2xl mx-auto space-y-8">
                            <div className="flex items-center justify-between">
                                <span className="text-[12px] font-medium text-gray-300 w-1/3 text-right pr-6">Number of Undo Steps:</span>
                                <div className="w-2/3">
                                    <div className="w-[80px] h-6 bg-[#1a1a1a] border border-[#444] rounded-md flex items-center justify-between px-2 shadow-inner">
                                        <input
                                            type="number"
                                            value={general.undoSteps}
                                            onChange={(e) => updateGeneral({ undoSteps: parseInt(e.target.value) || 0 })}
                                            className="text-[11px] text-gray-200 bg-transparent outline-none w-full font-mono"
                                        />
                                        <div className="flex flex-col gap-0.5 pointer-events-none opacity-40">
                                            <ChevronUp className="w-2.5 h-2.5 text-gray-300" />
                                            <ChevronDown className="w-2.5 h-2.5 text-gray-300" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 pl-[33.33%] border-b border-white/5 pb-6">
                                {[
                                    { label: 'Groove template edits immediately update all associated regions', key: 'grooveTemplateUpdate' },
                                    { label: 'Create new regions after splitting loops', key: 'createRegionsAfterSplittingLoops' },
                                    { label: 'Select regions on track selection', key: 'selectRegionsOnTrackSelection' },
                                    { label: 'Select tracks on region/marquee selection', key: 'selectTracksOnRegionSelection' }
                                ].map((item) => (
                                    <div 
                                        key={item.key}
                                        onClick={() => updateGeneral({ [item.key]: !general[item.key as keyof typeof general] })}
                                        className="flex items-center gap-2 cursor-pointer group"
                                    >
                                        <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${general[item.key as keyof typeof general] ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                            {general[item.key as keyof typeof general] && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                        </div>
                                        <span className={`text-[12px] transition-colors ${general[item.key as keyof typeof general] ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>{item.label}</span>
                                    </div>
                                ))}
                            </div>

                            <Dropdown
                                label="Right Mouse Button"
                                value={general.rightMouseButtonAction}
                                options={['Opens Shortcut Menu', 'Opens Tool Menu', 'Assignable to a Tool']}
                                onChange={(val) => updateGeneral({ rightMouseButtonAction: val })}
                            />

                            <div className="space-y-3 pl-[33.33%] border-b border-white/5 pb-6">
                                <div 
                                    onClick={() => updateGeneral({ enableForceTouchTrackpad: !general.enableForceTouchTrackpad })}
                                    className="flex items-center gap-2 cursor-pointer group"
                                >
                                    <span className="text-[12px] font-medium text-gray-300 w-16 text-right pr-2">Trackpad:</span>
                                    <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${general.enableForceTouchTrackpad ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                        {general.enableForceTouchTrackpad && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                    </div>
                                    <span className={`text-[12px] transition-colors ${general.enableForceTouchTrackpad ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Enable Force Touch trackpad</span>
                                </div>
                            </div>

                            <div className="flex items-start justify-between">
                                <span className="text-[12px] font-medium text-gray-300 w-1/3 text-right pr-6 pt-1">Pointer Tool in Tracks Provides:</span>
                                <div className="w-2/3 space-y-3">
                                    {[
                                        { label: 'Fade tool click zones', key: 'fadeToolClickZones' },
                                        { label: 'Marquee tool click zones', key: 'marqueeToolClickZones' },
                                        { label: 'Quick Swipe and Take Editing click zones', key: 'quickSwipeClickZones' }
                                    ].map((item) => (
                                        <div 
                                            key={item.key}
                                            onClick={() => updateGeneral({ [item.key]: !general[item.key as keyof typeof general] })}
                                            className="flex items-center gap-2 cursor-pointer group"
                                        >
                                            <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${general[item.key as keyof typeof general] ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                                {general[item.key as keyof typeof general] && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                            </div>
                                            <span className={`text-[12px] transition-colors ${general[item.key as keyof typeof general] ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-start justify-between">
                                <span className="text-[12px] font-medium text-gray-300 w-1/3 text-right pr-6 pt-1">Limit Dragging to One Direction In:</span>
                                <div className="w-2/3 space-y-3">
                                    <div 
                                        onClick={() => updateGeneral({ limitDraggingOneDirectionPianoRollScore: !general.limitDraggingOneDirectionPianoRollScore })}
                                        className="flex items-center gap-2 cursor-pointer group"
                                    >
                                        <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${general.limitDraggingOneDirectionPianoRollScore ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                            {general.limitDraggingOneDirectionPianoRollScore && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                        </div>
                                        <span className={`text-[12px] transition-colors ${general.limitDraggingOneDirectionPianoRollScore ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Piano Roll Editor and Score Editor</span>
                                    </div>
                                    <div className="relative group/tooltip">
                                        <div 
                                            onClick={() => updateGeneral({ limitDraggingOneDirectionTracks: !general.limitDraggingOneDirectionTracks })}
                                            className="flex items-center gap-2 cursor-pointer group"
                                        >
                                            <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${general.limitDraggingOneDirectionTracks ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                                {general.limitDraggingOneDirectionTracks && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                            </div>
                                            <span className={`text-[12px] transition-colors ${general.limitDraggingOneDirectionTracks ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Tracks area</span>
                                        </div>
                                        {/* Tooltip implementation */}
                                        <div className="absolute left-[120px] top-[-10px] w-48 opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-[1100]">
                                            <div className="bg-[#1a1a1a] border border-[#444] rounded p-2 shadow-2xl text-[10px] text-gray-300 leading-tight">
                                                Press Shift while dragging in the editor or Tracks area to quickly switch between the two behaviors.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Dropdown
                                label="Double-Clicking a MIDI Region Opens"
                                value={general.doubleClickMidiRegionOpens}
                                options={['Piano Roll Editor', 'Score Editor', 'Step Editor', 'Event List']}
                                onChange={(val) => updateGeneral({ doubleClickMidiRegionOpens: val })}
                            />

                            <div className="space-y-3 pl-[33.33%]">
                                <div 
                                    onClick={() => updateGeneral({ pianoRollRegionBorderTrimming: !general.pianoRollRegionBorderTrimming })}
                                    className="flex items-center gap-2 cursor-pointer group"
                                >
                                    <span className="text-[12px] font-medium text-gray-300 w-24 text-right pr-2">Piano Roll Editor:</span>
                                    <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${general.pianoRollRegionBorderTrimming ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                        {general.pianoRollRegionBorderTrimming && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                    </div>
                                    <span className={`text-[12px] transition-colors ${general.pianoRollRegionBorderTrimming ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Region border trimming</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {settingsActiveTab === 'General' && settingsActiveSubTab === 'Cycle' && (
                        <div className="max-w-2xl mx-auto space-y-8">
                            <Dropdown
                                label="Cycle Pre-Processing"
                                value={general.cyclePreProcessing}
                                options={['Off', '1/96 Beat', '1/192 Beat', '1/384 Beat']}
                                onChange={(val) => updateGeneral({ cyclePreProcessing: val })}
                            />
                            
                            <div className="space-y-3 pl-[33.33%]">
                                <div 
                                    onClick={() => updateGeneral({ smoothCycleAlgorithm: !general.smoothCycleAlgorithm })}
                                    className="flex items-center gap-2 cursor-pointer group"
                                >
                                    <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${general.smoothCycleAlgorithm ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                        {general.smoothCycleAlgorithm && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                    </div>
                                    <span className={`text-[12px] transition-colors ${general.smoothCycleAlgorithm ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Smooth Cycle Algorithm</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {settingsActiveTab === 'General' && settingsActiveSubTab === 'Notifications' && (
                        <div className="max-w-3xl mx-auto space-y-6">
                            <p className="text-[12px] text-gray-400 font-medium pb-2 border-b border-white/5">
                                Warnings and alerts set previously to "Do not show again."
                            </p>

                            <div className="bg-[#1a1a1a] rounded overflow-hidden border border-[#333] shadow-inner">
                                <div className="grid grid-cols-4 bg-[#212125] border-b border-[#333] px-4 py-2">
                                    <span className="col-span-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Text</span>
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Triggered Button</span>
                                </div>
                                <div className="h-48 overflow-y-auto bg-black/10">
                                    {general.resetWarnings.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-[11px] text-gray-600 italic">
                                            No warnings set to "Do not show again"
                                        </div>
                                    ) : (
                                        (general.resetWarnings as any[]).map((w: any, i: number) => (
                                            <div key={i} className="grid grid-cols-4 px-4 py-2 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group">
                                                <span className="col-span-3 text-[11px] text-gray-300">{w.text}</span>
                                                <span className="text-[11px] text-sky-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">{w.triggeredButton}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-between pt-4">
                                <button className="px-5 py-1.5 bg-[#1a1a1a] hover:bg-[#222] text-[11px] text-gray-400 font-medium rounded border border-[#444] transition-all disabled:opacity-30" disabled>
                                    Reset Selected Warnings
                                </button>
                                <button className="px-5 py-1.5 bg-[#1a1a1a] hover:bg-[#222] text-[11px] text-gray-200 font-medium rounded border border-[#444] transition-all">
                                    Reset All Warnings
                                </button>
                            </div>
                        </div>
                    )}

                    {settingsActiveTab === 'General' && (settingsActiveSubTab === 'Catch' || settingsActiveSubTab === 'Accessibility') && (
                        <div className="max-w-2xl mx-auto flex flex-col items-center justify-center h-64 text-gray-500">
                           <Settings className="w-12 h-12 opacity-10 mb-4" />
                           <p className="text-[13px] font-medium">This configuration section is not available in this version.</p>
                        </div>
                    )}
                    {settingsActiveTab === 'Audio' && settingsActiveSubTab === 'Devices' && (
                        <div className="max-w-2xl mx-auto space-y-6">
                            <div className="space-y-4 pb-4 border-b border-white/5">
                                <Toggle
                                    label="Core Audio"
                                    enabled={audio.coreAudioEnabled}
                                    onChange={(val) => updateAudio({ coreAudioEnabled: val })}
                                />

                                <Dropdown
                                    label="Output Device"
                                    value={audio.outputDevice || 'default'}
                                    options={[
                                        { label: 'System Setting', value: 'default' },
                                        ...outputDevices.map(d => ({ label: d.label || 'Unknown Device', value: d.deviceId }))
                                    ]}
                                    onChange={(val) => updateAudio({ outputDevice: val })}
                                    disabled={!audio.coreAudioEnabled}
                                />

                                <Dropdown
                                    label="Input Device"
                                    value={audio.inputDevice || 'default'}
                                    options={[
                                        { label: 'System Setting', value: 'default' },
                                        ...inputDevices.map(d => ({ label: d.label || 'Unknown Device', value: d.deviceId }))
                                    ]}
                                    onChange={(val) => updateAudio({ inputDevice: val })}
                                    disabled={!audio.coreAudioEnabled}
                                />

                                <Dropdown
                                    label="I/O Buffer Size"
                                    value={audio.ioBufferSize}
                                    options={bufferSizeOptions}
                                    onChange={(val) => updateAudio({ ioBufferSize: val })}
                                    suffix="Samples"
                                    disabled={!audio.coreAudioEnabled}
                                />
                            </div>

                            <div className="space-y-4">
                                <div className={`flex flex-col gap-1 transition-opacity ${!audio.coreAudioEnabled ? 'opacity-30' : ''}`}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[12px] font-medium text-gray-300 w-1/3 text-right pr-6">Resulting Latency:</span>
                                        <div className="w-2/3 flex items-center gap-2">
                                            <span className="text-[11px] text-sky-400 font-mono bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                                                {roundTripLatency.toFixed(1)} ms Roundtrip
                                            </span>
                                            <span className="text-[11px] text-gray-500">
                                                ({outputLatency.toFixed(1)} ms Output)
                                            </span>
                                        </div>
                                    </div>
                                    {isLowBuffer && audio.coreAudioEnabled && (
                                        <div className="flex items-center gap-1.5 text-orange-400 animate-pulse mt-2 pl-[33.33%]">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Warning: Low buffer may cause clicks/pops</span>
                                        </div>
                                    )}
                                </div>

                                <Slider
                                    label="Recording Delay"
                                    value={audio.recordingDelay}
                                    min={-1000}
                                    max={1000}
                                    onChange={(val) => updateAudio({ recordingDelay: val })}
                                    suffix="Samples"
                                    disabled={!audio.coreAudioEnabled}
                                />

                                <Dropdown
                                    label="Processing Threads"
                                    value={audio.processingThreads}
                                    options={threadOptions}
                                    onChange={(val) => updateAudio({ processingThreads: val })}
                                    disabled={!audio.coreAudioEnabled}
                                />

                                <Dropdown
                                    label="Process Buffer Range"
                                    value={audio.processBufferRange}
                                    options={bufferRangeOptions}
                                    onChange={(val) => updateAudio({ processBufferRange: val })}
                                    disabled={!audio.coreAudioEnabled}
                                />

                                <Dropdown
                                    label="Multithreading"
                                    value={audio.multithreading}
                                    options={multithreadingOptions}
                                    onChange={(val) => updateAudio({ multithreading: val })}
                                    disabled={!audio.coreAudioEnabled}
                                />

                                <Dropdown
                                    label="Summing"
                                    value={audio.summing}
                                    options={summingOptions}
                                    onChange={(val) => updateAudio({ summing: val })}
                                    disabled={!audio.coreAudioEnabled}
                                />
                            </div>
                        </div>
                    )}

                    {settingsActiveTab === 'Audio' && settingsActiveSubTab === 'General' && (
                        <div className="max-w-2xl mx-auto space-y-6">
                            <div className="space-y-4 pb-6 border-b border-white/5">
                                <Toggle
                                    label="Display audio engine overload message"
                                    enabled={audio.displayOverloadMessage}
                                    onChange={(val) => updateAudio({ displayOverloadMessage: val })}
                                />

                                <Dropdown
                                    label="Sample Accurate Automation"
                                    value={audio.sampleAccurateAutomation}
                                    options={[
                                        { label: 'Off', value: 'Off' },
                                        { label: 'Volume, Pan, Sends', value: 'VolumePanSends' },
                                        { label: 'Volume, Pan, Sends, Plug-in Parameters', value: 'All' }
                                    ]}
                                    onChange={(val) => updateAudio({ sampleAccurateAutomation: val })}
                                />

                                <Dropdown
                                    label="Automatic Bus Assignment Uses"
                                    value={audio.automaticBusAssignment}
                                    options={['All Busses', 'Free Busses Only']}
                                    onChange={(val) => updateAudio({ automaticBusAssignment: val })}
                                />

                                <div className="space-y-4 pt-2">
                                    <Toggle
                                        label="Software monitoring"
                                        enabled={audio.softwareMonitoring}
                                        onChange={(val) => updateAudio({ softwareMonitoring: val })}
                                    />
                                    <div className="pl-[33.33%] space-y-3">
                                        <Toggle
                                            label="Input monitoring only for the focused track, and only when input monitoring is enabled (as in GarageBand)"
                                            enabled={audio.inputMonitoringOnlyFocused}
                                            onChange={(val) => updateAudio({ inputMonitoringOnlyFocused: val })}
                                        />
                                        <Toggle
                                            label="Independent monitoring level for record-enabled channel strips"
                                            enabled={audio.independentMonitoringLevel}
                                            onChange={(val) => updateAudio({ independentMonitoringLevel: val })}
                                        />
                                    </div>
                                </div>

                                <Slider
                                    label="Dim Level"
                                    value={audio.dimLevel}
                                    min={-60}
                                    max={0}
                                    onChange={(val) => updateAudio({ dimLevel: val })}
                                    suffix="dB"
                                />
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest pl-[33.33%] mb-4">Plug-in Latency</h3>

                                <Dropdown
                                    label="Compensation"
                                    value={audio.pluginLatencyCompensation}
                                    options={[
                                        { label: 'Off', value: 'Off' },
                                        { label: 'Audio and Software Instrument Tracks', value: 'AudioAndSI' },
                                        { label: 'All', value: 'All' }
                                    ]}
                                    onChange={(val) => updateAudio({ pluginLatencyCompensation: val })}
                                />

                                <Toggle
                                    label="Playback pre-roll"
                                    enabled={audio.playbackPreRoll}
                                    onChange={(val) => updateAudio({ playbackPreRoll: val })}
                                />

                                <Toggle
                                    label="Low Latency Monitoring Mode"
                                    enabled={audio.lowLatencyMonitoring}
                                    onChange={(val) => updateAudio({ lowLatencyMonitoring: val })}
                                />

                                <Slider
                                    label="Limit"
                                    value={audio.lowLatencyLimitMs}
                                    min={0}
                                    max={100}
                                    onChange={(val) => updateAudio({ lowLatencyLimitMs: val })}
                                    suffix="ms"
                                    disabled={!audio.lowLatencyMonitoring}
                                />
                            </div>
                        </div>
                    )}

                    {settingsActiveTab === 'Audio' && settingsActiveSubTab === 'Sampler' && (
                        <div className="max-w-2xl mx-auto flex flex-col items-center">
                            {/* Sub-Sub Tabs: Misc / Virtual Memory */}
                            <div className="flex bg-[#1a1a1a] rounded-md p-0.5 mb-8 border border-black/20 shadow-inner">
                                {['Misc', 'Virtual Memory'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => updateAudio({ samplerActiveSubTab: tab as any })}
                                        className={`px-4 py-1 text-[11px] font-semibold rounded-[4px] transition-all ${audio?.samplerActiveSubTab === tab ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            {audio?.samplerActiveSubTab === 'Misc' && (
                                <div className="w-full space-y-4">
                                    <Dropdown
                                        label="Sample Storage"
                                        value={audio?.sampler?.sampleStorage || 'Original'}
                                        options={['Original', '32-bit Float', '24-bit']}
                                        onChange={(val) => updateAudio({ sampler: { ...audio?.sampler, sampleStorage: val } })}
                                    />

                                    <Dropdown
                                        label="Search Samples On"
                                        value={audio?.sampler?.searchSamplesOn || 'Local Volumes'}
                                        options={['Local Volumes', 'External Volumes', 'All Volumes']}
                                        onChange={(val) => updateAudio({ sampler: { ...audio?.sampler, searchSamplesOn: val } })}
                                    />

                                    <Dropdown
                                        label="Read Root Key From"
                                        value={audio?.sampler?.readRootKeyFrom || 'File/Analysis'}
                                        options={['File/Analysis', 'Metadata', 'None']}
                                        onChange={(val) => updateAudio({ sampler: { ...audio?.sampler, readRootKeyFrom: val } })}
                                    />

                                    <Dropdown
                                        label="Root Key at File Name Position"
                                        value={audio?.sampler?.rootKeyFilenamePosition || 'Auto'}
                                        options={['Auto', 'Position 1', 'Position 2']}
                                        onChange={(val) => updateAudio({ sampler: { ...audio?.sampler, rootKeyFilenamePosition: val } })}
                                    />

                                    <div className="pt-2">
                                        <Toggle
                                            label="Keep common samples in memory when switching projects"
                                            enabled={audio?.sampler?.keepCommonSamplesInMemory || false}
                                            onChange={(val) => updateAudio({ sampler: { ...audio?.sampler, keepCommonSamplesInMemory: val } })}
                                        />
                                    </div>
                                </div>
                            )}

                            {audio?.samplerActiveSubTab === 'Virtual Memory' && (
                                <div className="w-full space-y-8">
                                    <div className="flex justify-center mb-6">
                                        <Toggle
                                            label="Active"
                                            enabled={audio?.sampler?.virtualMemory?.active || false}
                                            onChange={(val) => updateAudio({ sampler: { ...audio?.sampler, virtualMemory: { ...audio?.sampler?.virtualMemory, active: val } } })}
                                        />
                                    </div>

                                    <div className={`space-y-6 transition-opacity ${!audio?.sampler?.virtualMemory?.active ? 'opacity-30 pointer-events-none' : ''}`}>
                                        <div className="space-y-4">
                                            <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest pl-[33.33%] mb-4">Settings</h3>

                                            <Dropdown
                                                label="Buffer Range"
                                                value={audio?.sampler?.virtualMemory?.bufferRange || 'Medium'}
                                                options={['Small', 'Medium', 'Large']}
                                                onChange={(val) => updateAudio({ sampler: { ...audio?.sampler, virtualMemory: { ...audio?.sampler?.virtualMemory, bufferRange: val } } })}
                                            />

                                            <Dropdown
                                                label="Host Disk Activity"
                                                value={audio?.sampler?.virtualMemory?.hostDiskActivity || 'Average'}
                                                options={['Low', 'Average', 'High', 'Turbo']}
                                                onChange={(val) => updateAudio({ sampler: { ...audio?.sampler, virtualMemory: { ...audio?.sampler?.virtualMemory, hostDiskActivity: val } } })}
                                            />

                                            <div className="flex items-center justify-between">
                                                <span className="text-[12px] font-medium text-gray-400 w-1/3 text-right pr-6">Requires Constant RAM Allocation Of:</span>
                                                <div className="w-2/3">
                                                    <span className="text-[12px] text-gray-200">81.0 MB</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4 pt-4">
                                            <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest pl-[33.33%] mb-4">Statistics</h3>

                                            <div className="flex items-center justify-between">
                                                <span className="text-[12px] font-medium text-gray-400 w-1/3 text-right pr-6">Disk I/O Traffic:</span>
                                                <div className="w-2/3">
                                                    <span className="text-[12px] text-gray-200">0</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <span className="text-[12px] font-medium text-gray-400 w-1/3 text-right pr-6">Not Read from Disk in Time:</span>
                                                <div className="w-2/3">
                                                    <span className="text-[12px] text-gray-200">0</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-6 border-t border-white/5">
                                        <button
                                            className="px-6 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-[12px] font-medium rounded border border-white/10 transition-colors shadow-sm disabled:opacity-30"
                                            disabled={!audio?.sampler?.virtualMemory?.active}
                                        >
                                            Apply
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {settingsActiveTab === 'Audio' && settingsActiveSubTab === 'Editing' && (
                        <div className="max-w-2xl mx-auto space-y-8">
                            <div className="space-y-6 pb-6 border-b border-white/5">
                                <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest pl-[33.33%] mb-4">Crossfades for Merge and Take Comping</h3>

                                <Slider
                                    label="Crossfade Time"
                                    value={audio?.editing?.crossfadeTime || 20}
                                    min={0}
                                    max={100}
                                    onChange={(val) => updateAudio({ editing: { ...audio?.editing, crossfadeTime: val } })}
                                    suffix="ms"
                                />

                                <Slider
                                    label="Crossfade Curve"
                                    value={audio?.editing?.crossfadeCurve || 0}
                                    min={-100}
                                    max={100}
                                    onChange={(val) => updateAudio({ editing: { ...audio?.editing, crossfadeCurve: val } })}
                                />
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest pl-[33.33%] mb-4">Scrubbing</h3>

                                <div className="pt-2">
                                    <Toggle
                                        label="Scrubbing with audio in Tracks area"
                                        enabled={audio?.editing?.scrubbingEnabled || false}
                                        onChange={(val) => updateAudio({ editing: { ...audio?.editing, scrubbingEnabled: val } })}
                                    />
                                </div>

                                <Dropdown
                                    label="Maximum Scrub Speed"
                                    value={audio?.editing?.maxScrubSpeed || 'Normal'}
                                    options={['Normal', 'Double', 'Max']}
                                    onChange={(val) => updateAudio({ editing: { ...audio?.editing, maxScrubSpeed: val } })}
                                />

                                <Dropdown
                                    label="Scrub Response"
                                    value={audio?.editing?.scrubResponse || 'Normal'}
                                    options={['Fast', 'Normal', 'Slow']}
                                    onChange={(val) => updateAudio({ editing: { ...audio?.editing, scrubResponse: val } })}
                                />
                            </div>
                        </div>
                    )}

                    {settingsActiveTab === 'Audio' && settingsActiveSubTab === 'I/O Assignments' && (
                        <div className="max-w-3xl mx-auto flex flex-col items-center">
                            {/* Sub-Sub Tabs */}
                            <div className="flex bg-[#1a1a1a] rounded-md p-0.5 mb-8 border border-black/20 shadow-inner">
                                {['Output', 'Bounce Extensions', 'Input'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => updateAudio({ ioAssignments: { ...audio?.ioAssignments, activeSubTab: tab as any } })}
                                        className={`px-4 py-1 text-[11px] font-semibold rounded-[4px] transition-all ${audio?.ioAssignments?.activeSubTab === tab ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            {audio?.ioAssignments?.activeSubTab === 'Output' && (
                                <div className="w-full space-y-8">
                                    <div className="space-y-4 pb-6 border-b border-white/5">
                                        <h3 className="text-[12px] font-bold text-gray-300 mb-4 pl-4 border-l-2 border-sky-500">Stereo</h3>
                                        <Dropdown
                                            label="Output"
                                            value={audio?.ioAssignments?.stereoOutput || '1/2'}
                                            options={['1/2', '3/4', '5/6', '7/8']}
                                            onChange={(val) => updateAudio({ ioAssignments: { ...audio?.ioAssignments, stereoOutput: val } })}
                                        />
                                        <div className="pt-2 opacity-50 pointer-events-none">
                                            <Toggle
                                                label="Mirroring"
                                                enabled={audio?.ioAssignments?.stereoMirroring || false}
                                                onChange={() => { }}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-[12px] font-bold text-gray-300 mb-4 pl-4 border-l-2 border-sky-500">Surround</h3>
                                        <Dropdown
                                            label="Show as"
                                            value={audio?.ioAssignments?.surroundShowAs || '5.1 (ITU 775)'}
                                            options={['5.1 (ITU 775)', '7.1', '7.1.4 (Dolby Atmos)']}
                                            onChange={(val) => updateAudio({ ioAssignments: { ...audio?.ioAssignments, surroundShowAs: val } })}
                                        />
                                        <div className="flex items-center justify-between">
                                            <span className="text-[12px] font-medium text-gray-400 w-1/3 text-right pr-6">Initialize:</span>
                                            <div className="w-2/3 flex gap-1">
                                                {['Default', 'ITU', 'WG-4'].map(mode => (
                                                    <button key={mode} className="px-3 py-0.5 bg-white/5 hover:bg-white/10 text-[10px] text-gray-300 rounded border border-white/10 transition-colors">
                                                        {mode}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Surround Mapping Grid */}
                                        <div className="mt-8 bg-black/20 rounded-xl p-6 border border-white/5">
                                            <div className="grid grid-cols-3 gap-x-8 gap-y-6">
                                                {/* Left Column */}
                                                <div className="space-y-4">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Left:</label>
                                                        <select className="w-full bg-[#1e1e1e] border border-black/40 rounded px-2 py-0.5 text-[11px] text-sky-400 outline-none shadow-inner">
                                                            <option>{audio?.ioAssignments?.surroundMapping?.left}</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase">L. mid:</label>
                                                        <select disabled className="w-full bg-[#1e1e1e] border border-black/40 rounded px-2 py-0.5 text-[11px] text-gray-600 outline-none shadow-inner opacity-50">
                                                            <option>{audio?.ioAssignments?.surroundMapping?.lm}</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase">L. surround:</label>
                                                        <select className="w-full bg-[#1e1e1e] border border-black/40 rounded px-2 py-0.5 text-[11px] text-sky-400 outline-none shadow-inner">
                                                            <option>{audio?.ioAssignments?.surroundMapping?.ls}</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Center Column */}
                                                <div className="space-y-4 text-center">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Center:</label>
                                                        <select className="w-full bg-[#1e1e1e] border border-black/40 rounded px-2 py-0.5 text-[11px] text-sky-400 outline-none shadow-inner text-center">
                                                            <option>{audio?.ioAssignments?.surroundMapping?.center}</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase">LFE:</label>
                                                        <select className="w-full bg-[#1e1e1e] border border-black/40 rounded px-2 py-0.5 text-[11px] text-sky-400 outline-none shadow-inner text-center">
                                                            <option>{audio?.ioAssignments?.surroundMapping?.lfe}</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Surround:</label>
                                                        <select disabled className="w-full bg-[#1e1e1e] border border-black/40 rounded px-2 py-0.5 text-[11px] text-gray-600 outline-none shadow-inner text-center opacity-50">
                                                            <option>{audio?.ioAssignments?.surroundMapping?.surround || '---'}</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Right Column */}
                                                <div className="space-y-4 text-right">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Right:</label>
                                                        <select className="w-full bg-[#1e1e1e] border border-black/40 rounded px-2 py-0.5 text-[11px] text-sky-400 outline-none shadow-inner">
                                                            <option>{audio?.ioAssignments?.surroundMapping?.right}</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase">R. mid:</label>
                                                        <select disabled className="w-full bg-[#1e1e1e] border border-black/40 rounded px-2 py-0.5 text-[11px] text-gray-600 outline-none shadow-inner opacity-50">
                                                            <option>{audio?.ioAssignments?.surroundMapping?.rm}</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase">R. surround:</label>
                                                        <select className="w-full bg-[#1e1e1e] border border-black/40 rounded px-2 py-0.5 text-[11px] text-sky-400 outline-none shadow-inner">
                                                            <option>{audio?.ioAssignments?.surroundMapping?.rs}</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Bottom Atmos/Top rows */}
                                            <div className="grid grid-cols-2 gap-x-12 mt-8 px-12">
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-[9px] font-bold text-gray-600 uppercase w-20 text-right">L. top:</label>
                                                        <select disabled className="flex-1 bg-[#1a1a1a] border border-white/5 rounded px-2 py-0.5 text-[10px] text-gray-700 outline-none"><option>{audio?.ioAssignments?.surroundMapping?.lt}</option></select>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-[9px] font-bold text-gray-600 uppercase w-20 text-right">L. top mid:</label>
                                                        <select disabled className="flex-1 bg-[#1a1a1a] border border-white/5 rounded px-2 py-0.5 text-[10px] text-gray-700 outline-none"><option>{audio?.ioAssignments?.surroundMapping?.ltm}</option></select>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <select disabled className="flex-1 bg-[#1a1a1a] border border-white/5 rounded px-2 py-0.5 text-[10px] text-gray-700 outline-none text-right"><option>{audio?.ioAssignments?.surroundMapping?.rt}</option></select>
                                                        <label className="text-[9px] font-bold text-gray-600 uppercase w-20 text-left">R. top:</label>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <select disabled className="flex-1 bg-[#1a1a1a] border border-white/5 rounded px-2 py-0.5 text-[10px] text-gray-700 outline-none text-right"><option>{audio?.ioAssignments?.surroundMapping?.rtm}</option></select>
                                                        <label className="text-[9px] font-bold text-gray-600 uppercase w-20 text-left">R. top mid:</label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {audio?.ioAssignments?.activeSubTab === 'Bounce Extensions' && (
                                <div className="w-full space-y-8">
                                    <div className="space-y-4 pb-6 border-b border-white/5">
                                        <h3 className="text-[12px] font-bold text-gray-300 mb-4 pl-4 border-l-2 border-sky-500">Stereo</h3>
                                        <div className="flex gap-12 pl-[33.33%]">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase">Left:</label>
                                                <input
                                                    type="text"
                                                    value={audio?.ioAssignments?.bounceExtensions?.mapping?.left || ''}
                                                    onChange={(e) => updateAudio({ ioAssignments: { ...audio.ioAssignments, bounceExtensions: { mapping: { ...audio.ioAssignments.bounceExtensions.mapping, left: e.target.value } } } })}
                                                    className="w-24 bg-[#1e1e1e] border border-black/40 rounded px-2 py-0.5 text-[11px] text-sky-400 outline-none shadow-inner"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase">Right:</label>
                                                <input
                                                    type="text"
                                                    value={audio?.ioAssignments?.bounceExtensions?.mapping?.right || ''}
                                                    onChange={(e) => updateAudio({ ioAssignments: { ...audio.ioAssignments, bounceExtensions: { mapping: { ...audio.ioAssignments.bounceExtensions.mapping, right: e.target.value } } } })}
                                                    className="w-24 bg-[#1e1e1e] border border-black/40 rounded px-2 py-0.5 text-[11px] text-sky-400 outline-none shadow-inner"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-[12px] font-bold text-gray-300 mb-4 pl-4 border-l-2 border-sky-500">Surround</h3>
                                        <Dropdown
                                            label="Show as"
                                            value={audio?.ioAssignments?.surroundShowAs || '5.1 (ITU 775)'}
                                            options={['5.1 (ITU 775)', '7.1', '7.1.4 (Dolby Atmos)']}
                                            onChange={(val) => updateAudio({ ioAssignments: { ...audio?.ioAssignments, surroundShowAs: val } })}
                                        />
                                        <div className="flex items-center justify-between">
                                            <span className="text-[12px] font-medium text-gray-400 w-1/3 text-right pr-6">Initialize:</span>
                                            <div className="w-2/3">
                                                <button className="px-3 py-0.5 bg-white/5 hover:bg-white/10 text-[10px] text-gray-300 rounded border border-white/10 transition-colors">
                                                    Reset Extensions
                                                </button>
                                            </div>
                                        </div>

                                        {/* Extensions Mapping Grid */}
                                        <div className="mt-8 bg-black/20 rounded-xl p-6 border border-white/5">
                                            <div className="grid grid-cols-3 gap-x-8 gap-y-6">
                                                {/* Mapping Helper */}
                                                {[
                                                    { label: 'Left:', key: 'left' }, { label: 'L. center:', key: 'lc' }, { label: 'Center:', key: 'center' }, { label: 'R. center:', key: 'rc' }, { label: 'Right:', key: 'right' },
                                                    { label: 'L. mid:', key: 'lm' }, { label: 'LFE:', key: 'lfe' }, { label: 'R. mid:', key: 'rm' },
                                                    { label: 'L. surround:', key: 'ls' }, { label: 'Surround:', key: 'surround' }, { label: 'R. surround:', key: 'rs' }
                                                ].map((item, idx) => (
                                                    <div key={idx} className={`space-y-1 ${idx % 3 === 1 ? 'text-center' : idx % 3 === 2 ? 'text-right' : ''}`}>
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase">{item.label}</label>
                                                        <input
                                                            type="text"
                                                            value={audio?.ioAssignments?.bounceExtensions?.mapping?.[item.key] || ''}
                                                            onChange={(e) => updateAudio({ ioAssignments: { ...audio.ioAssignments, bounceExtensions: { mapping: { ...audio.ioAssignments.bounceExtensions.mapping, [item.key]: e.target.value } } } })}
                                                            className={`w-full bg-[#1e1e1e] border border-black/40 rounded px-2 py-0.5 text-[11px] text-sky-400/70 outline-none shadow-inner ${idx % 3 === 1 ? 'text-center' : idx % 3 === 2 ? 'text-right' : ''}`}
                                                        />
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Top rows */}
                                            <div className="grid grid-cols-2 gap-x-12 mt-8 px-12">
                                                {[
                                                    { label: 'L. top:', key: 'lt' }, { label: 'R. top:', key: 'rt', reverse: true },
                                                    { label: 'L. top mid:', key: 'ltm' }, { label: 'R. top mid:', key: 'rtm', reverse: true },
                                                    { label: 'L. top surround:', key: 'lts' }, { label: 'R. top surround:', key: 'rts', reverse: true }
                                                ].map((item, idx) => (
                                                    <div key={idx} className={`flex items-center gap-2 ${item.reverse ? 'flex-row-reverse' : ''}`}>
                                                        <label className={`text-[9px] font-bold text-gray-600 uppercase w-24 ${item.reverse ? 'text-left' : 'text-right'}`}>{item.label}</label>
                                                        <input
                                                            type="text"
                                                            value={audio?.ioAssignments?.bounceExtensions?.mapping?.[item.key] || ''}
                                                            onChange={(e) => updateAudio({ ioAssignments: { ...audio.ioAssignments, bounceExtensions: { mapping: { ...audio.ioAssignments.bounceExtensions.mapping, [item.key]: e.target.value } } } })}
                                                            className={`flex-1 bg-[#1a1a1a] border border-white/5 rounded px-2 py-0.5 text-[10px] text-gray-500 outline-none ${item.reverse ? 'text-right' : ''}`}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-gray-500 leading-relaxed max-w-lg mt-4 pl-4">
                                            The above extensions will be appended to audio file names when bouncing in split format. They will also determine how split audio files are handled when imported.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {audio?.ioAssignments?.activeSubTab === 'Input' && (
                                <div className="w-full space-y-8">
                                    <div className="space-y-4">
                                        <h3 className="text-[12px] font-bold text-gray-300 mb-4 pl-4 border-l-2 border-sky-500">Surround</h3>
                                        <Dropdown
                                            label="Show as"
                                            value={audio?.ioAssignments?.surroundShowAs || '5.1 (ITU 775)'}
                                            options={['5.1 (ITU 775)', '7.1', '7.1.4 (Dolby Atmos)']}
                                            onChange={(val) => updateAudio({ ioAssignments: { ...audio?.ioAssignments, surroundShowAs: val } })}
                                        />
                                        <div className="flex items-center justify-between">
                                            <span className="text-[12px] font-medium text-gray-400 w-1/3 text-right pr-6">Initialize:</span>
                                            <div className="w-2/3 flex gap-1">
                                                {['Default', 'ITU', 'WG-4'].map(mode => (
                                                    <button key={mode} className="px-3 py-0.5 bg-white/5 hover:bg-white/10 text-[10px] text-gray-300 rounded border border-white/10 transition-colors">
                                                        {mode}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Input Mapping Grid */}
                                        <div className="mt-8 bg-black/20 rounded-xl p-6 border border-white/5">
                                            <div className="grid grid-cols-3 gap-x-8 gap-y-6">
                                                {/* Left Column */}
                                                <div className="space-y-4">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Left:</label>
                                                        <select className="w-full bg-[#1e1e1e] border border-black/40 rounded px-2 py-0.5 text-[11px] text-sky-400 outline-none shadow-inner">
                                                            <option>{audio?.ioAssignments?.inputMapping?.left}</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase">L. center:</label>
                                                        <select disabled className="w-full bg-[#1e1e1e] border border-black/40 rounded px-2 py-0.5 text-[11px] text-gray-600 outline-none shadow-inner opacity-40">
                                                            <option>{audio?.ioAssignments?.inputMapping?.lc}</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase">L. surround:</label>
                                                        <select className="w-full bg-[#1e1e1e] border border-black/40 rounded px-2 py-0.5 text-[11px] text-sky-400 outline-none shadow-inner">
                                                            <option>{audio?.ioAssignments?.inputMapping?.ls}</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Center Column */}
                                                <div className="space-y-4 text-center">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Center:</label>
                                                        <select className="w-full bg-[#1e1e1e] border border-black/40 rounded px-2 py-0.5 text-[11px] text-sky-400 outline-none shadow-inner text-center">
                                                            <option>{audio?.ioAssignments?.inputMapping?.center}</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase">LFE:</label>
                                                        <select className="w-full bg-[#1e1e1e] border border-black/40 rounded px-2 py-0.5 text-[11px] text-sky-400 outline-none shadow-inner text-center">
                                                            <option>{audio?.ioAssignments?.inputMapping?.lfe}</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Surround:</label>
                                                        <select disabled className="w-full bg-[#1e1e1e] border border-black/40 rounded px-2 py-0.5 text-[11px] text-gray-600 outline-none shadow-inner text-center opacity-40">
                                                            <option>{audio?.ioAssignments?.inputMapping?.surround || 'Input 7'}</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Right Column */}
                                                <div className="space-y-4 text-right">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Right:</label>
                                                        <select className="w-full bg-[#1e1e1e] border border-black/40 rounded px-2 py-0.5 text-[11px] text-sky-400 outline-none shadow-inner">
                                                            <option>{audio?.ioAssignments?.inputMapping?.right}</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase">R. center:</label>
                                                        <select disabled className="w-full bg-[#1e1e1e] border border-black/40 rounded px-2 py-0.5 text-[11px] text-gray-600 outline-none shadow-inner opacity-40">
                                                            <option>{audio?.ioAssignments?.inputMapping?.rc}</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase">R. surround:</label>
                                                        <select className="w-full bg-[#1e1e1e] border border-black/40 rounded px-2 py-0.5 text-[11px] text-sky-400 outline-none shadow-inner">
                                                            <option>{audio?.ioAssignments?.inputMapping?.rs}</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Bottom rows */}
                                            <div className="grid grid-cols-2 gap-x-12 mt-8 px-12 opacity-30">
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-[9px] font-bold text-gray-600 uppercase w-20 text-right">L. top:</label>
                                                        <select disabled className="flex-1 bg-[#1a1a1a] border border-white/5 rounded px-2 py-0.5 text-[10px] text-gray-700 outline-none"><option>{audio?.ioAssignments?.inputMapping?.lt}</option></select>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-[9px] font-bold text-gray-600 uppercase w-20 text-right">L. top mid:</label>
                                                        <select disabled className="flex-1 bg-[#1a1a1a] border border-white/5 rounded px-2 py-0.5 text-[10px] text-gray-700 outline-none"><option>{audio?.ioAssignments?.inputMapping?.ltm}</option></select>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <select disabled className="flex-1 bg-[#1a1a1a] border border-white/5 rounded px-2 py-0.5 text-[10px] text-gray-700 outline-none text-right"><option>{audio?.ioAssignments?.inputMapping?.rt}</option></select>
                                                        <label className="text-[9px] font-bold text-gray-600 uppercase w-20 text-left">R. top:</label>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <select disabled className="flex-1 bg-[#1a1a1a] border border-white/5 rounded px-2 py-0.5 text-[10px] text-gray-700 outline-none text-right"><option>{audio?.ioAssignments?.inputMapping?.rtm}</option></select>
                                                        <label className="text-[9px] font-bold text-gray-600 uppercase w-20 text-left">R. top mid:</label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {settingsActiveTab === 'Audio' && settingsActiveSubTab === 'File Editor' && (
                        <div className="max-w-2xl mx-auto space-y-6">
                            <div className="space-y-3 pb-6 border-b border-white/5 pl-[33.33%]">
                                <Toggle
                                    label="Warning before processing function by key command"
                                    enabled={audio?.fileEditor?.warnBeforeProcessing || false}
                                    onChange={(val) => updateAudio({ fileEditor: { ...audio.fileEditor, warnBeforeProcessing: val } })}
                                />
                                <Toggle
                                    label="Clear Undo History when closing project"
                                    enabled={audio?.fileEditor?.clearUndoOnClose || false}
                                    onChange={(val) => updateAudio({ fileEditor: { ...audio.fileEditor, clearUndoOnClose: val } })}
                                />
                                <Toggle 
                                    label="Record selection changes in Undo History" 
                                    enabled={audio?.fileEditor?.recordSelectionChanges || false} 
                                    onChange={(val) => updateAudio({ fileEditor: { ...audio.fileEditor, recordSelectionChanges: val } })} 
                                />
                                <Toggle 
                                    label="Record Normalize operations in Undo History" 
                                    enabled={audio?.fileEditor?.recordNormalizeInUndo || false} 
                                    onChange={(val) => updateAudio({ fileEditor: { ...audio.fileEditor, recordNormalizeInUndo: val } })} 
                                />
                            </div>

                            <div className="space-y-4">
                                <Dropdown 
                                    label="Number of Undo Steps"
                                    value={audio?.fileEditor?.undoSteps || 5}
                                    options={[1, 5, 10, 20, 50, 100]}
                                    onChange={(val) => updateAudio({ fileEditor: { ...audio.fileEditor, undoSteps: Number(val) } })}
                                />

                                <div className="flex items-center justify-between">
                                    <span className="text-[12px] font-medium text-gray-400 w-1/3 text-right pr-6">External Sample Editor:</span>
                                    <div className="w-2/3 flex items-center gap-2">
                                        <div className="flex-1 bg-[#1a1a1a] border border-black/40 rounded px-3 py-1.5 min-h-[32px] text-[11px] text-gray-400 shadow-inner flex items-center">
                                            {audio?.fileEditor?.externalSampleEditorPath || ''}
                                        </div>
                                        <button className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-[11px] text-gray-300 rounded border border-white/10 transition-colors shadow-sm whitespace-nowrap">
                                            Choose...
                                        </button>
                                    </div>
                                </div>
                                <div className="flex justify-end pl-[33.33%] pt-1">
                                    <button className="px-4 py-1 bg-white/5 hover:bg-white/10 text-[10px] text-gray-400 rounded border border-white/10 transition-colors">
                                        Remove
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {settingsActiveTab === 'Audio' && settingsActiveSubTab === 'MP3' && (
                        <div className="max-w-xl mx-auto space-y-6">
                            <div className="space-y-4">
                                <Dropdown 
                                    label="Bit Rate Mono"
                                    value={audio?.mp3?.bitRateMono || '80 kbit/s'}
                                    options={['32 kbit/s', '64 kbit/s', '80 kbit/s', '128 kbit/s', '160 kbit/s']}
                                    onChange={(val) => updateAudio({ mp3: { ...audio?.mp3, bitRateMono: val } })}
                                />
                                <Dropdown 
                                    label="Bit Rate Stereo"
                                    value={audio?.mp3?.bitRateStereo || '160 kbit/s'}
                                    options={['128 kbit/s', '160 kbit/s', '192 kbit/s', '256 kbit/s', '320 kbit/s']}
                                    onChange={(val) => updateAudio({ mp3: { ...audio?.mp3, bitRateStereo: val } })}
                                />
                                <div className="pl-[33.33%] pt-2">
                                    <Toggle 
                                        label="Use Variable Bit Rate (VBR) encoding" 
                                        enabled={audio?.mp3?.useVBR || false} 
                                        onChange={(val) => updateAudio({ mp3: { ...audio?.mp3, useVBR: val } })} 
                                    />
                                </div>
                            </div>

                            <div className="space-y-4 border-t border-white/5 pt-6">
                                <Dropdown 
                                    label="Quality"
                                    value={audio?.mp3?.quality || 'Highest'}
                                    options={['Low', 'Medium', 'High', 'Highest']}
                                    onChange={(val) => updateAudio({ mp3: { ...audio?.mp3, quality: val } })}
                                />
                                <div className="pl-[33.33%] space-y-3 pt-2">
                                    <Toggle 
                                        label="Use best encoding" 
                                        enabled={audio?.mp3?.useBestEncoding || true} 
                                        onChange={(val) => updateAudio({ mp3: { ...audio?.mp3, useBestEncoding: val } })} 
                                    />
                                    <Toggle 
                                        label="Filter frequencies below 10 Hz" 
                                        enabled={audio?.mp3?.filterBelow10Hz || true} 
                                        onChange={(val) => updateAudio({ mp3: { ...audio?.mp3, filterBelow10Hz: val } })} 
                                    />
                                </div>
                            </div>

                            <div className="pt-4">
                                <Dropdown 
                                    label="Stereo Mode"
                                    value={audio?.mp3?.stereoMode || 'Joint Stereo'}
                                    options={['Stereo', 'Joint Stereo', 'Mono']}
                                    onChange={(val) => updateAudio({ mp3: { ...audio?.mp3, stereoMode: val } })}
                                />
                            </div>
                        </div>
                    )}

                    {settingsActiveTab === 'Recording' && (
                        <div className="max-w-4xl mx-auto space-y-10">
                            {/* Audio Recording */}
                            <div className="space-y-4">
                                <h3 className="text-[12px] font-bold text-gray-300 mb-4 pl-4 border-l-2 border-sky-500">Audio Recording</h3>
                                <Dropdown 
                                    label="File Type"
                                    value={recording?.audioFileType || 'WAVE (BWF)'}
                                    options={['WAVE (BWF)', 'AIFF', 'CAF']}
                                    onChange={(val) => updateRecording({ audioFileType: val })}
                                />
                                <Dropdown 
                                    label="Bit Depth"
                                    value={recording?.bitDepth || 24}
                                    options={[16, 24]}
                                    onChange={(val) => updateRecording({ bitDepth: Number(val) })}
                                    suffix="-bit"
                                />
                            </div>

                            {/* MIDI Recording */}
                            <div className="space-y-4 pt-6 border-t border-white/5">
                                <h3 className="text-[12px] font-bold text-gray-300 mb-4 pl-4 border-l-2 border-sky-500">MIDI Recording</h3>
                                <Dropdown 
                                    label="Auto Record Enable"
                                    value={recording?.autoRecordEnable || 'The Focused Track'}
                                    options={['The Focused Track', 'Off', 'On']}
                                    onChange={(val) => updateRecording({ autoRecordEnable: val })}
                                />
                            </div>

                            {/* Overlapping Track Recordings */}
                            <div className="space-y-6 pt-6 border-t border-white/5">
                                <h3 className="text-[12px] font-bold text-gray-300 mb-4 pl-4 border-l-2 border-sky-500">Overlapping Track Recordings</h3>
                                
                                <div className="grid grid-cols-3 gap-8 pl-[33.33%] items-center mb-2">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">MIDI</div>
                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">Audio</div>
                                </div>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-8 items-center">
                                        <span className="text-[12px] font-medium text-gray-400 text-right pr-6">Cycle Off:</span>
                                        <select 
                                            value={recording?.overlapping?.midiCycleOff} 
                                            onChange={(e) => updateRecording({ overlapping: { ...recording.overlapping, midiCycleOff: e.target.value } })}
                                            className="bg-[#1e1e1e] border border-black/40 rounded px-2 py-1 text-[11px] text-gray-200 outline-none shadow-inner"
                                        >
                                            <option>Merge</option>
                                            <option>Replace</option>
                                            <option>Create Take Folder</option>
                                        </select>
                                        <select 
                                            value={recording?.overlapping?.audioCycleOff} 
                                            onChange={(e) => updateRecording({ overlapping: { ...recording.overlapping, audioCycleOff: e.target.value } })}
                                            className="bg-[#1e1e1e] border border-black/40 rounded px-2 py-1 text-[11px] text-gray-200 outline-none shadow-inner"
                                        >
                                            <option>Create Take Folder</option>
                                            <option>Merge</option>
                                            <option>Replace</option>
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-3 gap-8 items-center">
                                        <span className="text-[12px] font-medium text-gray-400 text-right pr-6">Cycle On:</span>
                                        <select 
                                            value={recording?.overlapping?.midiCycleOn} 
                                            onChange={(e) => updateRecording({ overlapping: { ...recording.overlapping, midiCycleOn: e.target.value } })}
                                            className="bg-[#1e1e1e] border border-black/40 rounded px-2 py-1 text-[11px] text-gray-200 outline-none shadow-inner"
                                        >
                                            <option>Merge</option>
                                            <option>Replace</option>
                                            <option>Create Take Folder</option>
                                        </select>
                                        <select 
                                            value={recording?.overlapping?.audioCycleOn} 
                                            onChange={(e) => updateRecording({ overlapping: { ...recording.overlapping, audioCycleOn: e.target.value } })}
                                            className="bg-[#1e1e1e] border border-black/40 rounded px-2 py-1 text-[11px] text-gray-200 outline-none shadow-inner"
                                        >
                                            <option>Create Take Folder</option>
                                            <option>Merge</option>
                                            <option>Replace</option>
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-3 gap-8 items-center">
                                        <span className="text-[12px] font-medium text-gray-400 text-right pr-6">Replace:</span>
                                        <select 
                                            value={recording?.overlapping?.midiReplace} 
                                            onChange={(e) => updateRecording({ overlapping: { ...recording.overlapping, midiReplace: e.target.value } })}
                                            className="bg-[#1e1e1e] border border-black/40 rounded px-2 py-1 text-[11px] text-gray-200 outline-none shadow-inner"
                                        >
                                            <option>Region Erase</option>
                                            <option>Region Punch</option>
                                        </select>
                                        <div className="text-[11px] text-gray-600 italic">No option available</div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-8">
                                <button className="px-5 py-1.5 bg-white/5 hover:bg-white/10 text-[12px] text-gray-300 font-medium rounded border border-white/10 transition-colors shadow-sm">
                                    Recording Project Settings...
                                </button>
                            </div>
                        </div>
                    )}

                    {settingsActiveTab === 'MIDI' && (
                        <div className="max-w-4xl mx-auto flex flex-col items-center">
                            {/* Sub Tabs */}
                            <div className="flex bg-[#1a1a1a] rounded-md p-0.5 mb-10 border border-black/20 shadow-inner">
                                {['General', 'Reset Messages', 'Sync', 'Inputs'].map((tab) => (
                                    <button 
                                        key={tab}
                                        onClick={() => updateMidi({ activeSubTab: tab as any })}
                                        className={`px-4 py-1.5 text-[11px] font-semibold rounded-[4px] transition-all ${midi?.activeSubTab === tab ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            {midi?.activeSubTab === 'General' && (
                                <div className="w-full space-y-12">
                                    <div className="space-y-4 pb-12 border-b border-white/5 flex flex-col items-center">
                                        <div className="space-y-4 w-full">
                                            <Toggle 
                                                label="MIDI 2.0" 
                                                enabled={midi?.midi20Enabled || false} 
                                                onChange={(val) => updateMidi({ midi20Enabled: val })} 
                                            />
                                            <Toggle 
                                                label="External stop message ends recording" 
                                                enabled={midi?.externalStopEndsRecording || false} 
                                                onChange={(val) => updateMidi({ externalStopEndsRecording: val })} 
                                            />
                                        </div>
                                        <div className="pt-6 w-full flex justify-center">
                                            <div className="w-1/3" />
                                            <div className="w-2/3">
                                                <button className="px-5 py-1 bg-white/5 hover:bg-white/10 text-[11px] text-gray-300 font-medium rounded border border-white/10 transition-colors shadow-sm">
                                                    Reset All MIDI Drivers
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <h3 className="text-[12px] font-bold text-gray-300 mb-6 pl-4 border-l-2 border-sky-500">Articulation Switches</h3>
                                        
                                        <div className="grid grid-cols-2 gap-x-8 pl-[33.33%] mb-2">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-left">Set</div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center gap-4">
                                                <span className="text-[12px] font-medium text-gray-400 w-1/3 text-right pr-6">MIDI Remote:</span>
                                                <div className="w-2/3 flex gap-2">
                                                    <select 
                                                        value={midi?.articulationSwitches?.remote?.value} 
                                                        onChange={(e) => updateMidi({ articulationSwitches: { ...midi.articulationSwitches, remote: { ...midi.articulationSwitches.remote, value: e.target.value } } })}
                                                        className="w-1/3 bg-[#1a1a1a] border border-black/40 rounded px-2 py-0.5 text-[11px] text-sky-400 outline-none shadow-inner"
                                                    >
                                                        <option>Off</option>
                                                        <option>On</option>
                                                    </select>
                                                    <select 
                                                        value={midi?.articulationSwitches?.remote?.set} 
                                                        onChange={(e) => updateMidi({ articulationSwitches: { ...midi.articulationSwitches, remote: { ...midi.articulationSwitches.remote, set: e.target.value } } })}
                                                        className="w-2/3 bg-[#1a1a1a] border border-black/40 rounded px-2 py-0.5 text-[11px] text-gray-300 outline-none shadow-inner"
                                                    >
                                                        <option>Global</option>
                                                        <option>Project</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <span className="text-[12px] font-medium text-gray-400 w-1/3 text-right pr-6">MIDI Channel:</span>
                                                <div className="w-2/3 flex gap-2">
                                                    <select 
                                                        value={midi?.articulationSwitches?.channel?.value} 
                                                        onChange={(e) => updateMidi({ articulationSwitches: { ...midi.articulationSwitches, channel: { ...midi.articulationSwitches.channel, value: e.target.value } } })}
                                                        className="w-1/3 bg-[#1a1a1a] border border-black/40 rounded px-2 py-0.5 text-[11px] text-sky-400 outline-none shadow-inner"
                                                    >
                                                        <option>All</option>
                                                        <option>1</option>
                                                        <option>2</option>
                                                    </select>
                                                    <select 
                                                        value={midi?.articulationSwitches?.channel?.set} 
                                                        onChange={(e) => updateMidi({ articulationSwitches: { ...midi.articulationSwitches, channel: { ...midi.articulationSwitches.channel, set: e.target.value } } })}
                                                        className="w-2/3 bg-[#1a1a1a] border border-black/40 rounded px-2 py-0.5 text-[11px] text-gray-300 outline-none shadow-inner"
                                                    >
                                                        <option>Global</option>
                                                        <option>Project</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <span className="text-[12px] font-medium text-gray-400 w-1/3 text-right pr-6">Octave Offset:</span>
                                                <div className="w-2/3 flex gap-2">
                                                    <input 
                                                        type="number"
                                                        value={midi?.articulationSwitches?.octaveOffset?.value} 
                                                        onChange={(e) => updateMidi({ articulationSwitches: { ...midi.articulationSwitches, octaveOffset: { ...midi.articulationSwitches.octaveOffset, value: Number(e.target.value) } } })}
                                                        className="w-1/3 bg-[#1a1a1a] border border-black/40 rounded px-3 py-0.5 text-[11px] text-gray-400 outline-none shadow-inner"
                                                    />
                                                    <select 
                                                        value={midi?.articulationSwitches?.octaveOffset?.set} 
                                                        onChange={(e) => updateMidi({ articulationSwitches: { ...midi.articulationSwitches, octaveOffset: { ...midi.articulationSwitches.octaveOffset, set: e.target.value } } })}
                                                        className="w-2/3 bg-[#1a1a1a] border border-black/40 rounded px-2 py-0.5 text-[11px] text-gray-300 outline-none shadow-inner"
                                                    >
                                                        <option>Per Channel Strip</option>
                                                        <option>Global</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {midi?.activeSubTab === 'Reset Messages' && (
                                <div className="w-full space-y-8">
                                    <div className="space-y-4 pb-8 border-b border-white/5">
                                        <h3 className="text-[12px] font-bold text-gray-300 mb-4 pl-[33.33%]">Software Instruments</h3>
                                        <div className="space-y-3 pl-[33.33%]">
                                            {[
                                                { label: 'Control 64 (Sustain) off', key: 'sustainOff' },
                                                { label: 'Control 4 (Foot Control) to zero', key: 'footToZero' },
                                                { label: 'Control 2 (Breath) to zero', key: 'breathToZero' },
                                                { label: 'Control 1 (Modulation) to zero', key: 'modToZero' },
                                                { label: 'Aftertouch to zero', key: 'aftertouchToZero' },
                                                { label: 'Pitch Bend to center position', key: 'pitchToCenter' }
                                            ].map((item) => (
                                                <Toggle 
                                                    key={item.key}
                                                    label={item.label}
                                                    enabled={midi?.resetMessages?.softwareInstruments?.[item.key] || false}
                                                    onChange={(val) => updateMidi({ resetMessages: { ...midi.resetMessages, softwareInstruments: { ...midi.resetMessages.softwareInstruments, [item.key]: val } } })}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-[12px] font-bold text-gray-300 mb-4 pl-[33.33%]">External MIDI</h3>
                                        <div className="space-y-3 pl-[33.33%]">
                                            {[
                                                { label: 'Control 123 (All Notes Off)', key: 'allNotesOff' },
                                                { label: 'Control 121 (Reset Controls)', key: 'resetControls' },
                                                { label: 'Control 64 (Sustain) off', key: 'sustainOff' },
                                                { label: 'Control 4 (Foot Control) to zero', key: 'footToZero' },
                                                { label: 'Control 2 (Breath) to zero', key: 'breathToZero' },
                                                { label: 'Control 1 (Modulation) to zero', key: 'modToZero' },
                                                { label: 'Aftertouch to zero', key: 'aftertouchToZero' },
                                                { label: 'Pitch Bend to center position', key: 'pitchToCenter' },
                                                { label: 'Send used instrument settings on reset', key: 'sendUsedSettings' }
                                            ].map((item) => (
                                                <Toggle 
                                                    key={item.key}
                                                    label={item.label}
                                                    enabled={midi?.resetMessages?.externalMidi?.[item.key] || false}
                                                    onChange={(val) => updateMidi({ resetMessages: { ...midi.resetMessages, externalMidi: { ...midi.resetMessages.externalMidi, [item.key]: val } } })}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {midi?.activeSubTab === 'Sync' && (
                                <div className="w-full space-y-10">
                                    {/* All MIDI Output */}
                                    <div className="space-y-4">
                                        <h3 className="text-[12px] font-bold text-gray-300 mb-4 pl-4 border-l-2 border-sky-500">All MIDI Output</h3>
                                        <div className="flex items-center gap-3 pl-[33.33%]">
                                            <span className="text-[12px] font-medium text-gray-400 w-[120px] text-right pr-4">Delay:</span>
                                            <input 
                                                type="number" 
                                                value={midi?.sync?.outputDelay || 0}
                                                onChange={(e) => updateMidi({ sync: { ...midi.sync, outputDelay: Number(e.target.value) } })}
                                                className="w-20 bg-[#1a1a1a] border border-black/40 rounded px-2 py-0.5 text-[11px] text-gray-300 outline-none shadow-inner text-center"
                                            />
                                            <span className="text-[11px] text-gray-500">ms</span>
                                        </div>
                                    </div>

                                    {/* MIDI Time Code (MTC) */}
                                    <div className="space-y-4 pt-6 border-t border-white/5">
                                        <h3 className="text-[12px] font-bold text-gray-300 mb-4 pl-4 border-l-2 border-sky-500">MIDI Time Code (MTC)</h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3 pl-[33.33%]">
                                                <span className="text-[12px] font-medium text-gray-400 w-[120px] text-right pr-4">MTC Pickup Delay:</span>
                                                <input 
                                                    type="number" 
                                                    value={midi?.sync?.mtcPickupDelay || 0}
                                                    onChange={(e) => updateMidi({ sync: { ...midi.sync, mtcPickupDelay: Number(e.target.value) } })}
                                                    className="w-20 bg-[#1a1a1a] border border-black/40 rounded px-2 py-0.5 text-[11px] text-gray-300 outline-none shadow-inner text-center"
                                                />
                                                <span className="text-[11px] text-gray-500">Frames</span>
                                            </div>
                                            <div className="flex items-center gap-3 pl-[33.33%]">
                                                <span className="text-[12px] font-medium text-gray-400 w-[120px] text-right pr-4">Delay MTC Transmission By:</span>
                                                <input 
                                                    type="number" 
                                                    value={midi?.sync?.mtcTransmissionDelay || 0}
                                                    onChange={(e) => updateMidi({ sync: { ...midi.sync, mtcTransmissionDelay: Number(e.target.value) } })}
                                                    className="w-20 bg-[#1a1a1a] border border-black/40 rounded px-2 py-0.5 text-[11px] text-gray-300 outline-none shadow-inner text-center"
                                                />
                                                <span className="text-[11px] text-gray-500">ms</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* MIDI Machine Control (MMC) */}
                                    <div className="space-y-6 pt-6 border-t border-white/5">
                                        <h3 className="text-[12px] font-bold text-gray-300 mb-4 pl-4 border-l-2 border-sky-500">MIDI Machine Control (MMC)</h3>
                                        <Dropdown 
                                            label="MMC Uses"
                                            value={midi?.sync?.mmcUses || 'MMC Standard Messages'}
                                            options={['MMC Standard Messages', 'Alesis ADAT']}
                                            onChange={(val) => updateMidi({ sync: { ...midi.sync, mmcUses: val } })}
                                        />
                                        
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3 pl-[33.33%]">
                                                <span className="text-[12px] font-medium text-gray-400 w-[120px] text-right pr-4">Output ID (Transport):</span>
                                                <div className={`flex items-center gap-2 px-1.5 py-0.5 rounded border border-black/20 ${midi?.sync?.mmcOutputId?.all ? 'bg-sky-500/10' : 'bg-black/20'}`}>
                                                    <input 
                                                        type="checkbox"
                                                        checked={midi?.sync?.mmcOutputId?.all}
                                                        onChange={(e) => updateMidi({ sync: { ...midi.sync, mmcOutputId: { ...midi.sync.mmcOutputId, all: e.target.checked } } })}
                                                        className="w-3.5 h-3.5 rounded bg-black/40 border-black/60 checked:bg-sky-500 transition-colors"
                                                    />
                                                    <span className="text-[11px] font-bold text-gray-300 pr-2 border-r border-white/10">All</span>
                                                    <input 
                                                        type="number" 
                                                        disabled={midi?.sync?.mmcOutputId?.all}
                                                        value={midi?.sync?.mmcOutputId?.value}
                                                        onChange={(e) => updateMidi({ sync: { ...midi.sync, mmcOutputId: { ...midi.sync.mmcOutputId, value: Number(e.target.value) } } })}
                                                        className="w-16 bg-transparent border-none text-[11px] text-gray-300 outline-none text-center disabled:opacity-30"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 pl-[33.33%]">
                                                <span className="text-[12px] font-medium text-gray-400 w-[120px] text-right pr-4">Input ID (Transport):</span>
                                                <div className={`flex items-center gap-2 px-1.5 py-0.5 rounded border border-black/20 ${midi?.sync?.mmcInputId?.all ? 'bg-sky-500/10' : 'bg-black/20'}`}>
                                                    <input 
                                                        type="checkbox"
                                                        checked={midi?.sync?.mmcInputId?.all}
                                                        onChange={(e) => updateMidi({ sync: { ...midi.sync, mmcInputId: { ...midi.sync.mmcInputId, all: e.target.checked } } })}
                                                        className="w-3.5 h-3.5 rounded bg-black/40 border-black/60 checked:bg-sky-500 transition-colors"
                                                    />
                                                    <span className="text-[11px] font-bold text-gray-300 pr-2 border-r border-white/10">All</span>
                                                    <input 
                                                        type="number" 
                                                        disabled={midi?.sync?.mmcInputId?.all}
                                                        value={midi?.sync?.mmcInputId?.value}
                                                        onChange={(e) => updateMidi({ sync: { ...midi.sync, mmcInputId: { ...midi.sync.mmcInputId, value: Number(e.target.value) } } })}
                                                        className="w-16 bg-transparent border-none text-[11px] text-gray-300 outline-none text-center disabled:opacity-30"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3 pt-4 border-t border-white/5 pl-[33.33%]">
                                            <span className="text-[12px] font-medium text-gray-400 block mb-2 -ml-24">Transmit Locate Commands When:</span>
                                            <Toggle 
                                                label="Pressing Stop twice" 
                                                enabled={midi?.sync?.locatePressingStopTwice || false} 
                                                onChange={(val) => updateMidi({ sync: { ...midi.sync, locatePressingStopTwice: val } })}
                                            />
                                            <Toggle 
                                                label="Dragging regions or events" 
                                                enabled={midi?.sync?.locateDragging || false} 
                                                onChange={(val) => updateMidi({ sync: { ...midi.sync, locateDragging: val } })}
                                            />
                                            <Toggle 
                                                label="Transmit record-enable commands for audio tracks" 
                                                enabled={midi?.sync?.transmitRecordEnable || false} 
                                                onChange={(val) => updateMidi({ sync: { ...midi.sync, transmitRecordEnable: val } })}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-4">
                                        <button className="px-5 py-1.5 bg-white/5 hover:bg-white/10 text-[12px] text-gray-300 font-medium rounded border border-white/10 transition-colors shadow-sm">
                                            MIDI Sync Project Settings...
                                        </button>
                                    </div>
                                </div>
                            )}

                            {midi?.activeSubTab === 'Inputs' && (
                                <div className="w-full space-y-4">
                                    <p className="text-[11px] text-gray-400 mb-6">Enable MIDI ports to use as inputs in Logic</p>
                                    
                                    <div className="border border-black/60 rounded overflow-hidden shadow-2xl">
                                        <div className="grid grid-cols-[60px_1fr] bg-[#1a1a1a] border-b border-black/40 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-1.5 px-4">
                                            <div className="text-center">On</div>
                                            <div>Device or Port</div>
                                        </div>
                                        <div className="max-h-[300px] overflow-y-auto bg-[#252529]">
                                            {(midi?.inputs || []).length > 0 ? ((midi.inputs as any[]).map((input: any, idx: number) => (
                                                <div 
                                                    key={input.name} 
                                                    className={`grid grid-cols-[60px_1fr] items-center py-2 px-4 border-b border-black/20 ${idx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'}`}
                                                >
                                                    <div className="flex justify-center">
                                                        <input 
                                                            type="checkbox"
                                                            checked={input.enabled}
                                                            onChange={(e) => {
                                                                const newInputs = [...midi.inputs];
                                                                newInputs[idx] = { ...input, enabled: e.target.checked };
                                                                updateMidi({ inputs: newInputs });
                                                            }}
                                                            className="w-3.5 h-3.5 rounded bg-black/40 border-black/60 checked:bg-sky-500 transition-colors cursor-pointer"
                                                        />
                                                    </div>
                                                    <span className="text-[11px] text-gray-200 font-medium">{input.name}</span>
                                                </div>
                                            ))) : (
                                                <div className="py-20 text-center text-gray-600 italic text-[11px]">No MIDI input devices detected</div>
                                            )}

                                        </div>
                                    </div>
                                </div>
                            )}

                            {midi?.activeSubTab !== 'General' && midi?.activeSubTab !== 'Reset Messages' && midi?.activeSubTab !== 'Sync' && midi?.activeSubTab !== 'Inputs' && (
                                <div className="w-full py-20 flex flex-col items-center justify-center text-gray-600 opacity-50 bg-black/10 rounded-2xl border border-dashed border-white/5">
                                    <Activity className="w-10 h-10 mb-4" />
                                    <span className="text-[13px] font-medium">MIDI {midi?.activeSubTab} settings not available in this version</span>
                                </div>
                            )}
                        </div>
                    )}

                    {settingsActiveTab === 'Score' && (
                        <div className="max-w-4xl mx-auto space-y-12">
                            {/* Display */}
                            <div className="space-y-4">
                                <h3 className="text-[12px] font-bold text-gray-300 mb-6 pl-4 border-l-2 border-sky-500">Display</h3>
                                <div className="space-y-4">
                                    <Toggle 
                                        label="Show region selection in color" 
                                        enabled={score?.display?.showRegionSelectionInColor || false} 
                                        onChange={(val) => updateScore({ display: { ...score.display, showRegionSelectionInColor: val } })} 
                                    />
                                    <Toggle 
                                        label="Display distance values in inches" 
                                        enabled={score?.display?.displayInInches || false} 
                                        onChange={(val) => updateScore({ display: { ...score.display, displayInInches: val } })} 
                                    />
                                    <Dropdown 
                                        label="Double-Click to Open"
                                        value={score?.display?.doubleClickToOpen || 'Note Attributes'}
                                        options={['Note Attributes', 'Staff Style', 'Score Project Settings']}
                                        onChange={(val) => updateScore({ display: { ...score.display, doubleClickToOpen: val } })}
                                    />
                                    <div className="flex items-center justify-between">
                                        <span className="text-[12px] font-medium text-gray-400 w-1/3 text-right pr-6">Selection Color:</span>
                                        <div className="w-2/3 flex items-center gap-3">
                                            <div 
                                                className="w-10 h-4 rounded border border-black/40 shadow-inner" 
                                                style={{ backgroundColor: score?.display?.selectionColor || '#7ed321' }}
                                            />
                                            <button 
                                                onClick={() => updateScore({ display: { ...score.display, selectionColor: '#7ed321' } })}
                                                className="px-3 py-0.5 bg-white/5 hover:bg-white/10 text-[10px] text-gray-400 rounded border border-white/10 transition-colors"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Camera Tool */}
                            <div className="space-y-4 pt-8 border-t border-white/5">
                                <h3 className="text-[12px] font-bold text-gray-300 mb-6 pl-4 border-l-2 border-sky-500">Camera Tool</h3>
                                <div className="flex items-start justify-between">
                                    <span className="text-[12px] font-medium text-gray-400 w-1/3 text-right pr-6 pt-1">Write To:</span>
                                    <div className="w-2/3 space-y-3">
                                        {['Clipboard', 'PDF file'].map((mode) => (
                                            <div 
                                                key={mode}
                                                onClick={() => updateScore({ cameraTool: { ...score.cameraTool, writeTo: mode as any } })}
                                                className="flex items-center gap-2 cursor-pointer group"
                                            >
                                                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${score?.cameraTool?.writeTo === mode ? 'border-sky-500 bg-sky-500/20' : 'border-gray-600 bg-transparent group-hover:border-gray-500'}`}>
                                                    {score?.cameraTool?.writeTo === mode && <div className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]" />}
                                                </div>
                                                <span className={`text-[11px] font-medium transition-colors ${score?.cameraTool?.writeTo === mode ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>{mode}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Split */}
                            <div className="space-y-6 pt-8 border-t border-white/5">
                                <h3 className="text-[12px] font-bold text-gray-300 mb-6 pl-4 border-l-2 border-sky-500">Split</h3>
                                <div className="space-y-6">
                                    <Toggle 
                                        label="Auto split notes in polyphonic staff styles" 
                                        enabled={score?.split?.autoSplit || false} 
                                        onChange={(val) => updateScore({ split: { ...score.split, autoSplit: val } })} 
                                    />
                                    <div className="flex items-center justify-between">
                                        <span className="text-[12px] font-medium text-gray-400 w-1/3 text-right pr-6">Split Notes At:</span>
                                        <div className="w-2/3 flex items-center gap-4">
                                            <input 
                                                type="range"
                                                min="0" max="127"
                                                className="flex-1 accent-sky-500 h-1 bg-black/40 rounded-lg appearance-none cursor-pointer"
                                                onChange={(e) => {
                                                    // Logic for converting note number to string (simplified)
                                                    updateScore({ split: { ...score.split, splitNotesAt: `C${Math.floor(Number(e.target.value)/12)}` } });
                                                }}
                                            />
                                            <div className="bg-[#1a1a1a] border border-black/40 rounded px-3 py-1 text-[11px] text-sky-400 font-bold shadow-inner min-w-[50px] text-center">
                                                {score?.split?.splitNotesAt || 'C3'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-8">
                                <button className="px-5 py-1.5 bg-white/5 hover:bg-white/10 text-[12px] text-gray-300 font-medium rounded border border-white/10 transition-colors shadow-sm">
                                    Score Project Settings...
                                </button>
                            </div>
                        </div>
                    )}

                    {settingsActiveTab === 'Movie' && (
                        <div className="max-w-4xl mx-auto space-y-12">
                            {/* Adjustments */}
                            <div className="space-y-4">
                                <h3 className="text-[12px] font-bold text-gray-300 mb-6 pl-4 border-l-2 border-sky-500">Adjustments</h3>
                                <div className="flex items-center justify-between">
                                    <span className="text-[12px] font-medium text-gray-400 w-1/3 text-right pr-6">Movie to Project:</span>
                                    <div className="w-2/3 flex items-center gap-4">
                                        <input 
                                            type="range"
                                            min="-1000" max="1000"
                                            value={movie?.adjustments?.movieToProjectOffset || 0}
                                            className="flex-1 accent-sky-500 h-1 bg-black/40 rounded-lg appearance-none cursor-pointer"
                                            onChange={(e) => updateMovie({ adjustments: { ...movie.adjustments, movieToProjectOffset: Number(e.target.value) } })}
                                        />
                                        <div className="bg-[#1a1a1a] border border-black/40 rounded flex items-center shadow-inner overflow-hidden">
                                            <input 
                                                type="number"
                                                value={movie?.adjustments?.movieToProjectOffset || 0}
                                                onChange={(e) => updateMovie({ adjustments: { ...movie.adjustments, movieToProjectOffset: Number(e.target.value) } })}
                                                className="w-12 bg-transparent text-[11px] text-gray-300 outline-none text-center py-1"
                                            />
                                            <div className="bg-black/20 px-2 py-1 text-[10px] text-gray-500 border-l border-black/40">Quarter Frames</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Movie Track */}
                            <div className="space-y-6 pt-8 border-t border-white/5">
                                <h3 className="text-[12px] font-bold text-gray-300 mb-6 pl-4 border-l-2 border-sky-500">Movie Track</h3>
                                <div className="space-y-6">
                                    <Dropdown 
                                        label="Cache Resolution"
                                        value={movie?.movieTrack?.cacheResolution || 'Medium'}
                                        options={['Low', 'Medium', 'High', 'Original']}
                                        onChange={(val) => updateMovie({ movieTrack: { ...movie.movieTrack, cacheResolution: val } })}
                                    />
                                    <div className="flex items-center justify-between">
                                        <span className="text-[12px] font-medium text-gray-400 w-1/3 text-right pr-6">Maximum Cache Size:</span>
                                        <div className="w-2/3 flex items-center gap-4">
                                            <input 
                                                type="range"
                                                min="10" max="1000"
                                                value={movie?.movieTrack?.maxCacheSize || 40}
                                                className="flex-1 accent-sky-500 h-1 bg-black/40 rounded-lg appearance-none cursor-pointer"
                                                onChange={(e) => updateMovie({ movieTrack: { ...movie.movieTrack, maxCacheSize: Number(e.target.value) } })}
                                            />
                                            <div className="bg-[#1a1a1a] border border-black/40 rounded flex items-center shadow-inner overflow-hidden">
                                                <input 
                                                    type="number"
                                                    value={movie?.movieTrack?.maxCacheSize || 40}
                                                    onChange={(e) => updateMovie({ movieTrack: { ...movie.movieTrack, maxCacheSize: Number(e.target.value) } })}
                                                    className="w-12 bg-transparent text-[11px] text-gray-300 outline-none text-center py-1"
                                                />
                                                <div className="bg-black/20 px-2 py-1 text-[10px] text-gray-500 border-l border-black/40">MB</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pl-[33.33%] space-y-4">
                                        <Toggle 
                                            label="Use Magic Pro audio output" 
                                            enabled={movie?.movieTrack?.useDawAudioOutput || false} 
                                            onChange={(val) => updateMovie({ movieTrack: { ...movie.movieTrack, useDawAudioOutput: val } })} 
                                        />
                                        <Toggle 
                                            label="Lock movie window when changing screensets" 
                                            enabled={movie?.movieTrack?.lockMovieWindow || false} 
                                            onChange={(val) => updateMovie({ movieTrack: { ...movie.movieTrack, lockMovieWindow: val } })} 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-8">
                                <button className="px-5 py-1.5 bg-white/5 hover:bg-white/10 text-[12px] text-gray-300 font-medium rounded border border-white/10 transition-colors shadow-sm">
                                    Movie Project Settings...
                                </button>
                            </div>
                        </div>
                    )}

                    {settingsActiveTab === 'Automation' && (
                        <div className="max-w-4xl mx-auto space-y-8">
                            <div className="space-y-4">
                                <Dropdown 
                                    label="Move Track Automation with Regions"
                                    value={automation?.moveWithRegions || 'Ask'}
                                    options={['Always', 'Never', 'Ask']}
                                    onChange={(val) => updateAutomation({ moveWithRegions: val })}
                                />
                                <div className="pl-[33.33%] space-y-3">
                                    <Toggle 
                                        label="Include trails, if possible" 
                                        enabled={automation?.includeTrails || false} 
                                        onChange={(val) => updateAutomation({ includeTrails: val })} 
                                    />
                                    <Toggle 
                                        label="Create Node when cutting at constant values" 
                                        enabled={automation?.regionAutomationNode || false} 
                                        onChange={(val) => updateAutomation({ regionAutomationNode: val })} 
                                    />
                                </div>
                            </div>

                            <div className="space-y-4 pt-6 border-t border-white/5">
                                <Dropdown 
                                    label="Pencil Tool"
                                    value={automation?.pencilToolMode || 'Hold Option for Stepped Editing'}
                                    options={['Standard', 'Stepped', 'Hold Option for Stepped Editing']}
                                    onChange={(val) => updateAutomation({ pencilToolMode: val })}
                                />
                                <div className="flex items-center justify-between">
                                    <span className="text-[12px] font-medium text-gray-400 w-1/3 text-right pr-6">Snap Offset:</span>
                                    <div className="w-2/3 flex items-center gap-3">
                                        <div className="bg-[#1a1a1a] border border-black/40 rounded flex items-center shadow-inner overflow-hidden">
                                            <input 
                                                type="number"
                                                value={automation?.snapOffset || 0}
                                                onChange={(e) => updateAutomation({ snapOffset: Number(e.target.value) })}
                                                className="w-12 bg-transparent text-[11px] text-gray-300 outline-none text-center py-1"
                                            />
                                            <div className="bg-black/20 px-2 py-1 text-[10px] text-gray-500 border-l border-black/40">Ticks</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[12px] font-medium text-gray-400 w-1/3 text-right pr-6">Ramp Time:</span>
                                    <div className="w-2/3 flex items-center gap-3">
                                        <div className="bg-[#1a1a1a] border border-black/40 rounded flex items-center shadow-inner overflow-hidden">
                                            <input 
                                                type="number"
                                                value={automation?.rampTime || 200}
                                                onChange={(e) => updateAutomation({ rampTime: Number(e.target.value) })}
                                                className="w-12 bg-transparent text-[11px] text-gray-300 outline-none text-center py-1"
                                            />
                                            <div className="bg-black/20 px-2 py-1 text-[10px] text-gray-500 border-l border-black/40">ms</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-6 border-t border-white/5">
                                <Dropdown 
                                    label="Write Mode Changes To"
                                    value={automation?.writeModeChange || 'Touch'}
                                    options={['Touch', 'Latch', 'Write', 'Off']}
                                    onChange={(val) => updateAutomation({ writeModeChange: val })}
                                />
                                <div className="flex items-start justify-between">
                                    <span className="text-[12px] font-medium text-gray-400 w-1/3 text-right pr-6 pt-1">Write Automation For:</span>
                                    <div className="w-2/3 grid grid-cols-2 gap-x-8 gap-y-3">
                                        {[
                                            { label: 'Volume', key: 'volume' },
                                            { label: 'Pan', key: 'pan' },
                                            { label: 'Mute', key: 'mute' },
                                            { label: 'Send', key: 'send' },
                                            { label: 'Plug-in', key: 'plugin' },
                                            { label: 'Solo', key: 'solo' }
                                        ].map((item) => (
                                            <div 
                                                key={item.key}
                                                onClick={() => updateAutomation({ writeFor: { ...automation.writeFor, [item.key]: !automation.writeFor[item.key as keyof typeof automation.writeFor] } })}
                                                className="flex items-center gap-2 cursor-pointer group"
                                            >
                                                <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${automation?.writeFor?.[item.key as keyof typeof automation.writeFor] ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                                    {automation?.writeFor?.[item.key as keyof typeof automation.writeFor] && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                                </div>
                                                <span className={`text-[11px] transition-colors ${automation?.writeFor?.[item.key as keyof typeof automation.writeFor] ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>{item.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6 pt-6 border-t border-white/5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[12px] font-medium text-gray-400 w-1/3 text-right pr-6">Automation Quick Access:</span>
                                    <div className="w-2/3 flex items-center gap-6">
                                        {['Off', 'On'].map((mode) => (
                                            <div 
                                                key={mode}
                                                onClick={() => updateAutomation({ quickAccess: mode as any })}
                                                className="flex items-center gap-2 cursor-pointer group"
                                            >
                                                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${automation?.quickAccess === mode ? 'border-sky-500 bg-sky-500/20' : 'border-gray-600 bg-transparent group-hover:border-gray-500'}`}>
                                                    {automation?.quickAccess === mode && <div className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]" />}
                                                </div>
                                                <span className={`text-[11px] font-medium transition-colors ${automation?.quickAccess === mode ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>{mode}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="pl-[33.33%] space-y-4">
                                    <div className="flex items-center gap-3">
                                        <button className="px-5 py-1 bgColor-white/5 hover:bg-white/10 text-[11px] text-gray-300 font-medium rounded border border-white/10 transition-colors shadow-sm bg-white/5">
                                            Learn Message
                                        </button>
                                        <span className="text-[10px] text-gray-500">Click the Learn Message button to assign a new control.</span>
                                    </div>
                                    <button disabled className="px-10 py-1 bg-white/5 text-[11px] text-gray-600 font-medium rounded border border-white/5 transition-colors shadow-sm cursor-not-allowed">
                                        Edit...
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {settingsActiveTab === 'Control Surfaces' && settingsActiveSubTab === 'General' && (
                        <div className="max-w-2xl mx-auto space-y-8">
                            <div className="space-y-4 pb-6 border-b border-white/5">
                                <Toggle
                                    label="Bypass all while in background"
                                    enabled={controlSurfaces.bypassWhileInBackground}
                                    onChange={(val) => updateControlSurfaces({ bypassWhileInBackground: val })}
                                />

                                <Slider
                                    label="Resolution of Relative Controls"
                                    value={controlSurfaces.resolutionOfRelativeControls}
                                    min={1}
                                    max={256}
                                    onChange={(val) => updateControlSurfaces({ resolutionOfRelativeControls: val })}
                                />

                                <Slider
                                    label="Maximum MIDI Bandwidth"
                                    value={controlSurfaces.maxMidiBandwidth}
                                    min={0}
                                    max={100}
                                    onChange={(val) => updateControlSurfaces({ maxMidiBandwidth: val })}
                                    suffix="%"
                                />
                            </div>

                            <div className="space-y-3 pl-[33.33%] pb-6 border-b border-white/5">
                                <div className="flex items-center gap-2 cursor-pointer group" onClick={() => updateControlSurfaces({ touchingFaderSelectsTrack: !controlSurfaces.touchingFaderSelectsTrack })}>
                                    <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${controlSurfaces.touchingFaderSelectsTrack ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                        {controlSurfaces.touchingFaderSelectsTrack && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                    </div>
                                    <span className={`text-[12px] transition-colors ${controlSurfaces.touchingFaderSelectsTrack ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Touching fader selects track</span>
                                </div>
                                
                                <div className="flex items-center gap-2 cursor-pointer group" onClick={() => updateControlSurfaces({ followTrackSelection: !controlSurfaces.followTrackSelection })}>
                                    <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${controlSurfaces.followTrackSelection ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                        {controlSurfaces.followTrackSelection && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                    </div>
                                    <span className={`text-[12px] transition-colors ${controlSurfaces.followTrackSelection ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Control surface follows track selection</span>
                                </div>

                                <div className="flex items-center gap-2 cursor-pointer group" onClick={() => updateControlSurfaces({ openPluginWindowOnSelection: !controlSurfaces.openPluginWindowOnSelection })}>
                                    <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${controlSurfaces.openPluginWindowOnSelection ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                        {controlSurfaces.openPluginWindowOnSelection && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                    </div>
                                    <span className={`text-[12px] transition-colors ${controlSurfaces.openPluginWindowOnSelection ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Open plug-in window on track selection</span>
                                </div>

                                <div className="flex items-center gap-2 cursor-pointer group" onClick={() => updateControlSurfaces({ jogResolutionDependsOnZoom: !controlSurfaces.jogResolutionDependsOnZoom })}>
                                    <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${controlSurfaces.jogResolutionDependsOnZoom ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                        {controlSurfaces.jogResolutionDependsOnZoom && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                    </div>
                                    <span className={`text-[12px] transition-colors ${controlSurfaces.jogResolutionDependsOnZoom ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Jog resolution depends on horizontal zoom</span>
                                </div>

                                <div className="flex items-center gap-2 cursor-pointer group" onClick={() => updateControlSurfaces({ pickupMode: !controlSurfaces.pickupMode })}>
                                    <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${controlSurfaces.pickupMode ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                        {controlSurfaces.pickupMode && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                    </div>
                                    <span className={`text-[12px] transition-colors ${controlSurfaces.pickupMode ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Pickup mode</span>
                                </div>

                                <div className="flex items-center gap-2 cursor-pointer group" onClick={() => updateControlSurfaces({ flashMuteSoloButtons: !controlSurfaces.flashMuteSoloButtons })}>
                                    <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${controlSurfaces.flashMuteSoloButtons ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                        {controlSurfaces.flashMuteSoloButtons && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                    </div>
                                    <span className={`text-[12px] transition-colors ${controlSurfaces.flashMuteSoloButtons ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Flash Mute and Solo buttons</span>
                                </div>
                            </div>

                            <Dropdown
                                label="Multiple Controls per Parameter"
                                value={controlSurfaces.multipleControlsPerParameter}
                                options={[1, 2, 4, 8]}
                                onChange={(val) => updateControlSurfaces({ multipleControlsPerParameter: val })}
                            />

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-[33.33%]">For Longer Labels and Value Displays</h4>
                                <div className="pl-[33.33%]">
                                    <div className="flex items-center gap-2 cursor-pointer group" onClick={() => updateControlSurfaces({ longerLabelsOnlyIfFit: !controlSurfaces.longerLabelsOnlyIfFit })}>
                                        <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${controlSurfaces.longerLabelsOnlyIfFit ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                            {controlSurfaces.longerLabelsOnlyIfFit && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                        </div>
                                        <span className={`text-[12px] transition-colors ${controlSurfaces.longerLabelsOnlyIfFit ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Only when all parameters fit on one page</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-[33.33%]">Show Value Units For</h4>
                                <div className="pl-[33.33%] space-y-3">
                                    <div className="flex items-center gap-2 cursor-pointer group" onClick={() => updateControlSurfaces({ showValueUnitsForInstrument: !controlSurfaces.showValueUnitsForInstrument })}>
                                        <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${controlSurfaces.showValueUnitsForInstrument ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                            {controlSurfaces.showValueUnitsForInstrument && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                        </div>
                                        <span className={`text-[12px] transition-colors ${controlSurfaces.showValueUnitsForInstrument ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Instrument/plug-in parameters</span>
                                    </div>
                                    <div className="flex items-center gap-2 cursor-pointer group" onClick={() => updateControlSurfaces({ showValueUnitsForVolume: !controlSurfaces.showValueUnitsForVolume })}>
                                        <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${controlSurfaces.showValueUnitsForVolume ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                            {controlSurfaces.showValueUnitsForVolume && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                        </div>
                                        <span className={`text-[12px] transition-colors ${controlSurfaces.showValueUnitsForVolume ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Volume and other parameters</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button className="px-4 py-1.5 bg-[#1a1a1a] hover:bg-[#222] text-[11px] text-gray-300 font-medium rounded border border-[#444] transition-all shadow-sm">
                                    Controller Assignments...
                                </button>
                                <button className="px-4 py-1.5 bg-[#1a1a1a] hover:bg-[#222] text-[11px] text-gray-300 font-medium rounded border border-[#444] transition-all shadow-sm">
                                    Setup...
                                </button>
                            </div>
                        </div>
                    )}

                    {settingsActiveTab === 'Control Surfaces' && settingsActiveSubTab === 'Help Tags' && (
                        <div className="max-w-2xl mx-auto space-y-8">
                            <div className="space-y-4 pb-6 border-b border-white/5">
                                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-[33.33%]">While Editing Show Long Names For</h4>
                                <div className="pl-[33.33%] space-y-3">
                                    <div className="flex items-center gap-2 cursor-pointer group" onClick={() => updateControlSurfaces({ helpTags: { ...(controlSurfaces.helpTags || {}), parameterName: !controlSurfaces.helpTags?.parameterName } })}>
                                        <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${controlSurfaces.helpTags?.parameterName ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                            {controlSurfaces.helpTags?.parameterName && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                        </div>
                                        <span className={`text-[12px] transition-colors ${controlSurfaces.helpTags?.parameterName ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Parameter name</span>
                                    </div>
                                    <div className="flex items-center gap-2 cursor-pointer group" onClick={() => updateControlSurfaces({ helpTags: { ...(controlSurfaces.helpTags || {}), parameterValue: !controlSurfaces.helpTags?.parameterValue } })}>
                                        <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${controlSurfaces.helpTags?.parameterValue ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                            {controlSurfaces.helpTags?.parameterValue && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                        </div>
                                        <span className={`text-[12px] transition-colors ${controlSurfaces.helpTags?.parameterValue ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Parameter value</span>
                                    </div>
                                </div>
                            </div>

                            <Slider
                                label="Display Duration"
                                value={controlSurfaces.helpTags?.displayDuration ?? 2.0}
                                min={0}
                                max={10}
                                onChange={(val) => updateControlSurfaces({ helpTags: { ...(controlSurfaces.helpTags || {}), displayDuration: val } })}
                                suffix="s"
                            />

                            <div className="space-y-3 pl-[33.33%] pb-6 border-b border-white/5">
                                <div className="flex items-center gap-2 cursor-pointer group" onClick={() => updateControlSurfaces({ helpTags: { ...(controlSurfaces.helpTags || {}), showInfoMultiple: !controlSurfaces.helpTags?.showInfoMultiple } })}>
                                    <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${controlSurfaces.helpTags?.showInfoMultiple ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                        {controlSurfaces.helpTags?.showInfoMultiple && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                    </div>
                                    <span className={`text-[12px] transition-colors ${controlSurfaces.helpTags?.showInfoMultiple ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Show info for multiple parameters</span>
                                </div>
                                <div className="flex items-center gap-2 cursor-pointer group" onClick={() => updateControlSurfaces({ helpTags: { ...(controlSurfaces.helpTags || {}), showInfoTrackSelection: !controlSurfaces.helpTags?.showInfoTrackSelection } })}>
                                    <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${controlSurfaces.helpTags?.showInfoTrackSelection ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                        {controlSurfaces.helpTags?.showInfoTrackSelection && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                    </div>
                                    <span className={`text-[12px] transition-colors ${controlSurfaces.helpTags?.showInfoTrackSelection ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Show info when selecting tracks</span>
                                </div>
                                <div className="flex items-center gap-2 cursor-pointer group" onClick={() => updateControlSurfaces({ helpTags: { ...(controlSurfaces.helpTags || {}), showInfoVolume: !controlSurfaces.helpTags?.showInfoVolume } })}>
                                    <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${controlSurfaces.helpTags?.showInfoVolume ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                        {controlSurfaces.helpTags?.showInfoVolume && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                    </div>
                                    <span className={`text-[12px] transition-colors ${controlSurfaces.helpTags?.showInfoVolume ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Show info when editing volume</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-[33.33%]">Show Value Units For</h4>
                                <div className="pl-[33.33%] space-y-3">
                                    <div className="flex items-center gap-2 cursor-pointer group" onClick={() => updateControlSurfaces({ showValueUnitsForInstrument: !controlSurfaces.showValueUnitsForInstrument })}>
                                        <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${controlSurfaces.showValueUnitsForInstrument ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                            {controlSurfaces.showValueUnitsForInstrument && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                        </div>
                                        <span className={`text-[12px] transition-colors ${controlSurfaces.showValueUnitsForInstrument ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Instrument/plug-in parameters</span>
                                    </div>
                                    <div className="flex items-center gap-2 cursor-pointer group" onClick={() => updateControlSurfaces({ showValueUnitsForVolume: !controlSurfaces.showValueUnitsForVolume })}>
                                        <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${controlSurfaces.showValueUnitsForVolume ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                            {controlSurfaces.showValueUnitsForVolume && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                        </div>
                                        <span className={`text-[12px] transition-colors ${controlSurfaces.showValueUnitsForVolume ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Volume and other parameters</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button className="px-4 py-1.5 bg-[#1a1a1a] hover:bg-[#222] text-[11px] text-gray-300 font-medium rounded border border-[#444] transition-all shadow-sm">
                                    Controller Assignments...
                                </button>
                                <button className="px-4 py-1.5 bg-[#1a1a1a] hover:bg-[#222] text-[11px] text-gray-300 font-medium rounded border border-[#444] transition-all shadow-sm">
                                    Setup...
                                </button>
                            </div>
                        </div>
                    )}
                    {settingsActiveTab === 'Control Surfaces' && settingsActiveSubTab === 'MIDI Controllers' && (
                        <div className="max-w-3xl mx-auto space-y-6">
                            <p className="text-[12px] text-gray-400 leading-relaxed bg-white/5 p-4 rounded-lg border border-white/5">
                                The buttons, knobs and other controls on the following USB MIDI Controllers can be automatically assigned to Smart Controls and other functions. Select Auto to enable automatic assignment for a device.
                            </p>

                            <div className="bg-[#1a1a1a] rounded-lg border border-[#333] overflow-hidden shadow-2xl">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-[#252529] border-b border-[#333]">
                                            <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest w-16 text-center">Auto</th>
                                            <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Manufacturer</th>
                                            <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Model Name</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {controlSurfaces.usbMidiControllers.map((ctrl) => (
                                            <tr key={ctrl.id} className="hover:bg-white/5 transition-colors group">
                                                <td className="px-4 py-2 text-center">
                                                    <div 
                                                        onClick={() => {
                                                            const newCtrls = controlSurfaces.usbMidiControllers.map(c => 
                                                                c.id === ctrl.id ? { ...c, autoAssign: !c.autoAssign } : c
                                                            );
                                                            updateControlSurfaces({ usbMidiControllers: newCtrls });
                                                        }}
                                                        className="flex justify-center cursor-pointer"
                                                    >
                                                        <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${ctrl.autoAssign ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                                            {ctrl.autoAssign && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 text-[12px] text-gray-300 font-medium">{ctrl.manufacturer}</td>
                                                <td className="px-4 py-2 text-[12px] text-gray-200">{ctrl.modelName}</td>
                                            </tr>
                                        ))}
                                        {controlSurfaces.usbMidiControllers.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="px-4 py-12 text-center text-[11px] text-gray-600 italic">
                                                    No USB MIDI Controllers detected
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button className="px-4 py-1.5 bg-[#1a1a1a] hover:bg-[#222] text-[11px] text-gray-300 font-medium rounded border border-[#444] transition-all shadow-sm">
                                    Controller Assignments...
                                </button>
                                <button className="px-4 py-1.5 bg-[#1a1a1a] hover:bg-[#222] text-[11px] text-gray-300 font-medium rounded border border-[#444] transition-all shadow-sm">
                                    Setup...
                                </button>
                            </div>
                        </div>
                    )}

                    {settingsActiveTab === 'View' && settingsActiveSubTab === 'General' && (
                        <div className="max-w-2xl mx-auto space-y-8">
                            <Dropdown
                                label="Appearance"
                                value={view.appearance}
                                options={['System Setting', 'Light', 'Dark']}
                                onChange={(val) => updateView({ appearance: val })}
                            />

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-[33.33%]">Windows</h4>
                                <div className="pl-[33.33%] space-y-3">
                                    {[
                                        { label: 'Large local window menus', key: 'largeLocalWindowMenus' },
                                        { label: 'Large inspectors', key: 'largeInspectors' },
                                        { label: 'Wide playhead', key: 'widePlayhead' },
                                        { label: 'Show help tags', key: 'showHelpTags' },
                                        { label: 'Show beats and time in help tags', key: 'showBeatsAndTimeInHelpTags' },
                                        { label: 'Show default values', key: 'showDefaultValues' },
                                        { label: 'Show animations', key: 'showAnimations' },
                                    ].map((item) => (
                                        <div 
                                            key={item.key}
                                            onClick={() => updateView({ [item.key]: !view[item.key as keyof typeof view] })}
                                            className="flex items-center gap-2 cursor-pointer group"
                                        >
                                            <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${view[item.key as keyof typeof view] ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                                {view[item.key as keyof typeof view] && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                            </div>
                                            <span className={`text-[12px] transition-colors ${view[item.key as keyof typeof view] ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-[33.33%]">Displays</h4>
                                <div className="space-y-4">
                                    <Dropdown
                                        label="Display Middle C As"
                                        value={view.displayMiddleCAs}
                                        options={['C3 (Yamaha)', 'C4 (Roland)']}
                                        onChange={(val) => updateView({ displayMiddleCAs: val })}
                                    />

                                    <div className="flex items-center justify-between">
                                        <span className="text-[12px] font-medium text-gray-300 w-1/3 text-right pr-6">Display Time As:</span>
                                        <div className="w-2/3 flex items-center gap-6">
                                            <div className="flex-1">
                                                <select 
                                                    value={view.displayTimeAs}
                                                    onChange={(e) => updateView({ displayTimeAs: e.target.value })}
                                                    className="w-full bg-[#1a1a1a] border border-[#444] rounded px-2 py-1 text-[11px] text-gray-200 focus:outline-none focus:ring-1 focus:ring-sky-500/50 appearance-none shadow-sm cursor-pointer hover:border-gray-500 transition-all font-medium"
                                                >
                                                    <option>SMPTE/EBU with Subframes</option>
                                                    <option>Beats</option>
                                                    <option>Samples</option>
                                                </select>
                                            </div>
                                            <div 
                                                onClick={() => updateView({ zerosAsSpaces: !view.zerosAsSpaces })}
                                                className="flex items-center gap-2 cursor-pointer group"
                                            >
                                                <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${view.zerosAsSpaces ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                                    {view.zerosAsSpaces && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                                </div>
                                                <span className={`text-[12px] transition-colors ${view.zerosAsSpaces ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Zeros as spaces</span>
                                            </div>
                                        </div>
                                    </div>

                                    <Dropdown
                                        label="Display Tempo As"
                                        value={view.displayTempoAs}
                                        options={['Beats per Minute (BPM, Maelzel)', 'Frames per Click']}
                                        onChange={(val) => updateView({ displayTempoAs: val })}
                                    />

                                    <Dropdown
                                        label="Clock Format"
                                        value={view.clockFormat}
                                        options={['1 1 1 1', '1:1:1:1']}
                                        onChange={(val) => updateView({ clockFormat: val })}
                                    />

                                    <Dropdown
                                        label="Display MIDI Data As"
                                        value={view.displayMidiDataAs}
                                        options={['MIDI 1.0', 'MIDI 2.0']}
                                        onChange={(val) => updateView({ displayMidiDataAs: val })}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {settingsActiveTab === 'View' && settingsActiveSubTab === 'Tracks' && (
                        <div className="max-w-2xl mx-auto space-y-8">
                            <div className="space-y-4 pb-6 border-b border-white/5">
                                <div 
                                    onClick={() => updateView({ showTrackNumberWhileScrolling: !view.showTrackNumberWhileScrolling })}
                                    className="flex items-center gap-2 cursor-pointer group pl-[33.33%]"
                                >
                                    <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${view.showTrackNumberWhileScrolling ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                        {view.showTrackNumberWhileScrolling && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                    </div>
                                    <span className={`text-[12px] transition-colors ${view.showTrackNumberWhileScrolling ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Show track or bar number while scrolling</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-[33.33%]">Appearance</h4>
                                <div className="space-y-4">
                                    <Dropdown
                                        label="Track Color"
                                        value={view.trackColorMode}
                                        options={['Static', 'Auto', 'By Track']}
                                        onChange={(val) => updateView({ trackColorMode: val })}
                                    />
                                    <Dropdown
                                        label="Region Color"
                                        value={view.regionColorMode}
                                        options={['Individual', 'By Track']}
                                        onChange={(val) => updateView({ regionColorMode: val })}
                                    />
                                    <Dropdown
                                        label="Marker Color"
                                        value={view.markerColorMode}
                                        options={['Static', 'Individual']}
                                        onChange={(val) => updateView({ markerColorMode: val })}
                                    />
                                    <Dropdown
                                        label="Background"
                                        value={view.backgroundMode}
                                        options={['Dark', 'Light', 'Custom']}
                                        onChange={(val) => updateView({ backgroundMode: val })}
                                    />
                                    <div className="pl-[33.33%]">
                                        <div 
                                            onClick={() => updateView({ gridLinesAutomatic: !view.gridLinesAutomatic })}
                                            className="flex items-center gap-2 cursor-pointer group"
                                        >
                                            <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${view.gridLinesAutomatic ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                                {view.gridLinesAutomatic && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                            </div>
                                            <span className={`text-[12px] transition-colors ${view.gridLinesAutomatic ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Grid Lines: Automatic</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-[33.33%]">Regions</h4>
                                <div className="pl-[33.33%] space-y-3">
                                    <div 
                                        onClick={() => updateView({ shadedLoops: !view.shadedLoops })}
                                        className="flex items-center gap-2 cursor-pointer group"
                                    >
                                        <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${view.shadedLoops ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                            {view.shadedLoops && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                        </div>
                                        <span className={`text-[12px] transition-colors ${view.shadedLoops ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Shaded loops</span>
                                    </div>
                                    <div 
                                        onClick={() => updateView({ showSessionPlayerPlusButton: !view.showSessionPlayerPlusButton })}
                                        className="flex items-center gap-2 cursor-pointer group"
                                    >
                                        <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${view.showSessionPlayerPlusButton ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                            {view.showSessionPlayerPlusButton && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                        </div>
                                        <span className={`text-[12px] transition-colors ${view.showSessionPlayerPlusButton ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Show "+" button next to Session Player regions</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {settingsActiveTab === 'View' && settingsActiveSubTab === 'Mixer' && (
                        <div className="max-w-2xl mx-auto space-y-8">
                            <div className="space-y-4 pb-6 border-b border-white/5">
                                <div 
                                    onClick={() => updateView({ showMasteringAssistantButton: !view.showMasteringAssistantButton })}
                                    className="flex items-center gap-2 cursor-pointer group pl-[33.33%]"
                                >
                                    <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${view.showMasteringAssistantButton ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                        {view.showMasteringAssistantButton && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                    </div>
                                    <span className={`text-[12px] transition-colors ${view.showMasteringAssistantButton ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Show "Mastering Assistant" Button in Stereo Output</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-[33.33%]">Plug-in Window</h4>
                                <div className="pl-[33.33%] space-y-3">
                                    <div 
                                        onClick={() => updateView({ openPluginWindowOnInsertion: !view.openPluginWindowOnInsertion })}
                                        className="flex items-center gap-2 cursor-pointer group"
                                    >
                                        <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${view.openPluginWindowOnInsertion ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                            {view.openPluginWindowOnInsertion && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                        </div>
                                        <span className={`text-[12px] transition-colors ${view.openPluginWindowOnInsertion ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Open plug-in window on insertion</span>
                                    </div>
                                    <div 
                                        onClick={() => updateView({ showRecentPluginList: !view.showRecentPluginList })}
                                        className="flex items-center gap-2 cursor-pointer group"
                                    >
                                        <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${view.showRecentPluginList ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                            {view.showRecentPluginList && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                        </div>
                                        <span className={`text-[12px] transition-colors ${view.showRecentPluginList ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Show recent plug-in list in plug-in menu</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-[33.33%]">Level Meters</h4>
                                <div className="space-y-4">
                                    <Dropdown
                                        label="Peak Hold Time"
                                        value={view.peakHoldTime}
                                        options={['No Hold', '200 ms', '400 ms', '800 ms', '1.6 s', '3.2 s', '6.4 s', 'Infinite']}
                                        onChange={(val) => updateView({ peakHoldTime: val })}
                                    />
                                    <Dropdown
                                        label="Return Time"
                                        value={view.returnTime}
                                        options={['IEC Type I (11.8 dB/s)—Recommended', 'IEC Type II (1.5 dB/s)']}
                                        onChange={(val) => updateView({ returnTime: val })}
                                    />
                                    <Dropdown
                                        label="Channel Order"
                                        value={view.channelOrder}
                                        options={['Clockwise (Ls L C R Rs LFE)', 'SMPTE (L R C LFE Ls Rs)']}
                                        onChange={(val) => updateView({ channelOrder: val })}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {settingsActiveTab === 'View' && settingsActiveSubTab === 'Editors' && (
                        <div className="max-w-2xl mx-auto space-y-8">
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-[33.33%]">Piano Roll</h4>
                                <div className="pl-[33.33%]">
                                    <div 
                                        onClick={() => updateView({ brightBackground: !view.brightBackground })}
                                        className="flex items-center gap-2 cursor-pointer group"
                                    >
                                        <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${view.brightBackground ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                            {view.brightBackground && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                        </div>
                                        <span className={`text-[12px] transition-colors ${view.brightBackground ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>Bright background</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {settingsActiveTab === 'My Info' && (
                        <div className="max-w-2xl mx-auto space-y-8">
                            <p className="text-[12px] text-gray-400 leading-relaxed bg-white/5 p-4 rounded-lg border border-white/5 mb-2">
                                Magic Pro will use this information to identify your songs when sharing them.
                            </p>
                            
                            <div className="space-y-4">
                                {[
                                    { label: 'Composer Name', key: 'composerName' },
                                    { label: 'Artist Name', key: 'artistName' },
                                    { label: 'Album Name', key: 'albumName' },
                                    { label: 'Playlist', key: 'playlist' },
                                ].map((field) => (
                                    <div key={field.key} className="flex items-center">
                                        <span className="text-[12px] font-medium text-gray-300 w-1/3 text-right pr-6">{field.label}:</span>
                                        <div className="w-2/3">
                                            <input 
                                                type="text"
                                                value={myInfo[field.key as keyof typeof myInfo]}
                                                onChange={(e) => updateMyInfo({ [field.key]: e.target.value })}
                                                className="w-full bg-[#1a1a1a] border border-[#444] rounded px-3 py-1.5 text-[11px] text-gray-200 focus:outline-none focus:ring-1 focus:ring-sky-500/50 transition-all font-medium"
                                                placeholder={`Enter ${field.label.toLowerCase()}...`}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {settingsActiveTab === 'Advanced' && (
                        <div className="max-w-2xl mx-auto space-y-6">
                            <div 
                                onClick={() => updateAdvanced({ enableCompleteFeatures: !advanced.enableCompleteFeatures })}
                                className="flex items-center gap-2 cursor-pointer group bg-white/5 p-4 rounded-lg border border-white/5"
                            >
                                <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center transition-all ${advanced.enableCompleteFeatures ? 'bg-sky-500 border-sky-400' : 'bg-[#1a1a1a] border-[#444]'}`}>
                                    {advanced.enableCompleteFeatures && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[12px] font-bold text-gray-200 uppercase tracking-wide">Enable Complete Features</span>
                                    <span className="text-[10px] text-gray-500 group-hover:text-gray-400 transition-colors">Expands simplified features to include all available features, including the following:</span>
                                </div>
                            </div>

                            <div className="bg-[#1a1a1a] rounded-lg border border-[#333] p-6 space-y-5 shadow-2xl opacity-80">
                                {[
                                    { title: 'Customization and Control', desc: 'Customize key commands, screensets, region colors, control bar, track headers, zoom levels, and controller assignments.' },
                                    { title: 'Editing', desc: 'Enable Undo History, List editors, Quick Swipe Comping, drum replacement, in-place bouncing, and additional tools.' },
                                    { title: 'Audio', desc: 'Reveal the Project Audio Browser, Audio File Editor, Surround, and other advanced audio features.' },
                                    { title: 'Mixing', desc: 'Enable advanced automation features, Mixer views, automation groups, and advanced plug-in window controls.' },
                                    { title: 'Score Editor', desc: 'Enable multiple tracks, score sets, and Page view.' },
                                ].map((feature) => (
                                    <div key={feature.title} className="space-y-1">
                                        <h5 className="text-[12px] font-bold text-gray-300">{feature.title}</h5>
                                        <p className="text-[11px] text-gray-500 leading-relaxed">{feature.desc}</p>
                                    </div>
                                ))}

                                <div className="pt-4">
                                    <button className="px-4 py-1.5 bg-[#252529] hover:bg-[#2a2a2e] text-[11px] text-gray-300 font-medium rounded border border-[#444] transition-all shadow-sm">
                                        Learn More
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {settingsActiveTab !== 'Audio' && settingsActiveTab !== 'Recording' && settingsActiveTab !== 'MIDI' && settingsActiveTab !== 'Score' && settingsActiveTab !== 'Movie' && settingsActiveTab !== 'Automation' && settingsActiveTab !== 'Control Surfaces' && settingsActiveTab !== 'View' && settingsActiveTab !== 'My Info' && settingsActiveTab !== 'Advanced' && (
                        <div className="flex flex-col items-center justify-center h-full gap-5 text-gray-600 opacity-50">
                            <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-700 flex items-center justify-center">
                                <Settings className="w-10 h-10" />
                            </div>
                            <span className="text-sm font-medium tracking-wide">Settings for "{settingsActiveTab}" not available in this version</span>
                        </div>
                    )}

                    {/* Toast Notification */}
                    {showSuccess && (
                        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-sky-500 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-4 duration-300 ring-1 ring-sky-400">
                            <Check className="w-4 h-4 stroke-[3]" />
                            Configuration Updated
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 bg-[#2a2a2e] flex items-center justify-between border-t border-black/40">
                    <div className="flex gap-4">
                        <button
                            onClick={refreshDevices}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-sky-400 transition-all border border-transparent hover:border-sky-500/20"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-bold uppercase tracking-wider">Refresh Devices</span>
                        </button>
                    </div>

                    <div className="flex gap-3">
        <button
            onClick={() => setShowSettingsDialog(false)}
            className="px-6 py-1.5 rounded-lg bg-gray-700/50 border border-white/5 text-[12px] font-bold text-gray-300 shadow-sm active:scale-95 hover:bg-gray-700 transition-all"
        >
            Close
        </button>
        <button
            onClick={handleApply}
            disabled={isApplying}
            className="px-10 py-1.5 rounded-lg bg-sky-500 text-white border border-sky-400 text-[12px] font-bold shadow-[0_5px_15px_rgba(14,165,233,0.3)] active:scale-95 hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50"
        >
            {isApplying ? (
                <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Updating...
                </>
            ) : 'Save'}
        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
