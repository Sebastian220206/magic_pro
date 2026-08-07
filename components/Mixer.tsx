"use client"
import { useState, useRef, useEffect, memo, useCallback } from "react"
import { useProjectStore } from "@/store/projectStore"
import { Track } from "@/models/Track"
import { audioEngine2 } from "@/engine/AudioEngineAdapter"
import { audioEngine } from "@/engine/AudioEngineAdapter"
import { VerticalMeter } from "./VerticalMeter"
import { LoudnessReadout } from "./MasterOutput"
import { SendsSlot, OutputRouting, MonitorControls, SidechainPicker } from "./mixer/RoutingControls"
import { BUILTIN_PLUGIN_IDS } from "@/engine/plugins/pluginIds"
import {
    ChevronDown, Filter, MoreHorizontal,
    Settings2, Sliders, LayoutList,
    Circle, Volume2, Music, Mic, Keyboard,
    Plus, Power
} from "lucide-react"

export function Mixer() {
    const showMixer = useProjectStore(s => s.showMixer);
    const tracks = useProjectStore(s => s.tracks);
    const focusedTrackId = useProjectStore(s => s.focusedTrackId);
    const settings = useProjectStore(s => s.settings);
    // Actions are stable references — safe to extract individually
    const selectTrack = useProjectStore(s => s.selectTrack);
    const updateTrack = useProjectStore(s => s.updateTrack);
    const addPlugin = useProjectStore(s => s.addPlugin);
    const togglePlugin = useProjectStore(s => s.togglePlugin);
    const updateProjectSettings = useProjectStore(s => s.updateProjectSettings);
    const setOpenPluginEditor = useProjectStore(s => s.setOpenPluginEditor);
    const saveHistorySnapshot = useProjectStore(s => s.saveHistorySnapshot);

    const noop = useCallback(() => {}, []);
    const onMasterUpdate = useCallback((updates: Partial<Track>) => {
        if (updates.volume !== undefined) {
            updateProjectSettings({ masterVolume: updates.volume });
        }
        if (updates.pan !== undefined) {
            updateProjectSettings({ masterPan: updates.pan });
        }
        if (updates.muted !== undefined) {
            updateProjectSettings({ masterMuted: updates.muted });
        }
    }, [updateProjectSettings]);

    const [mixerMode, setMixerMode] = useState<'single' | 'tracks' | 'all'>('all')
    const [trackTypeFilter, setTrackTypeFilter] = useState<'All' | 'Audio' | 'Inst' | 'Aux' | 'Bus' | 'VCA' | 'Output' | 'Master'>('All')
    const [showTrackStacks, setShowTrackStacks] = useState(true)

    if (!showMixer) return null

    const filterTypes = ['All', 'Audio', 'Inst', 'Aux', 'Bus', 'VCA', 'Output', 'Master']

    const normalizeType = (track: Track) => {
        if (track.type === 'audio') return 'Audio'
        if (track.type === 'software-instrument' || track.type === 'midi' || track.type === 'drummer') return 'Inst'
        if (track.type === 'bus' || track.type === 'folder') return 'Bus'
        if (track.type === 'output') return 'Output'
        if (track.type === 'external-midi') return 'MIDI'
        return 'Other'
    }

    const filteredTracks = tracks.filter(track => {
        if (!showTrackStacks && (track.parentId || track.isStack)) return false
        if (mixerMode === 'single') {
            return track.id === focusedTrackId
        }
        if (mixerMode === 'tracks') {
            if (track.type === 'output' || track.type === 'bus') return false
        }
        const trackType = normalizeType(track)
        if (trackTypeFilter !== 'All' && trackType !== trackTypeFilter) return false
        return true
    })

    const handleAction = (field: keyof Track, value: any, e: React.MouseEvent) => {
        e.stopPropagation();
    }

    return (
        <div className="h-full flex flex-col bg-[#1a1a1a] select-none text-gray-400 border-t border-[var(--accent-cyan)]/50 shadow-[0_-10px_30px_var(--accent-cyan-glow),0_-10px_30px_rgba(0,0,0,0.3)]">
            {/* 1. Mixer Command Header (High Fidelity Menu Bar) */}
            <div className="h-9 bg-[#222] border-b border-[var(--accent-cyan)]/30 flex items-center px-4 justify-between shrink-0">
                <div className="flex items-center gap-1">
                    <div className="flex items-center gap-1.5 bg-[#000] border border-[var(--accent-cyan)]/40 rounded px-2.5 h-7 cursor-pointer hover:border-[var(--accent-cyan)] hover:shadow-[0_0_8px_var(--accent-cyan-glow)] transition-all group">
                        <span className="text-[10px] font-black text-gray-400 group-hover:text-white uppercase tracking-tighter">Edit</span>
                        <ChevronDown className="w-3 h-3 text-gray-600" />
                    </div>
                    <div className="flex items-center gap-1.5 bg-[#000] border border-[var(--accent-cyan)]/40 rounded px-2.5 h-7 cursor-pointer hover:border-[var(--accent-cyan)] hover:shadow-[0_0_8px_var(--accent-cyan-glow)] transition-all group">
                        <span className="text-[10px] font-black text-gray-400 group-hover:text-[var(--accent-cyan)] uppercase tracking-tighter">Options</span>
                        <ChevronDown className="w-3 h-3 text-gray-600" />
                    </div>
                    <div className="flex items-center gap-1.5 bg-[#000] border border-[var(--accent-cyan)]/40 rounded px-2.5 h-7 cursor-pointer hover:border-[var(--accent-cyan)] hover:shadow-[0_0_8px_var(--accent-cyan-glow)] transition-all group">
                        <span className="text-[10px] font-black text-gray-400 group-hover:text-[var(--accent-cyan)] uppercase tracking-tighter">View</span>
                        <ChevronDown className="w-3 h-3 text-gray-600" />
                    </div>

                    <div className="w-px h-5 bg-[var(--accent-cyan)]/30 mx-2"></div>

                    {/* Monitor path — mono-sum phase check and reference direct-out. */}
                    <MonitorControls />

                    <div className="w-px h-5 bg-[var(--accent-cyan)]/30 mx-2"></div>

                    <div className="flex bg-[#000] rounded-md border border-[var(--accent-cyan)]/50 p-0.5 h-7 shadow-inner">
                        <button
                            onClick={() => setMixerMode('single')}
                            className={`px-3 h-full text-[10px] font-black uppercase rounded transition-all ${mixerMode === 'single' ? 'text-[var(--accent-cyan)] bg-[#333] shadow-md border border-[var(--accent-cyan)]/50' : 'text-gray-500 hover:text-[var(--accent-cyan)]'}`}
                        >Single</button>
                        <button
                            onClick={() => setMixerMode('tracks')}
                            className={`px-3 h-full text-[10px] font-black uppercase rounded transition-all ${mixerMode === 'tracks' ? 'text-[var(--accent-cyan)] bg-[#333] shadow-md border border-[var(--accent-cyan)]/50' : 'text-gray-500 hover:text-[var(--accent-cyan)]'}`}
                        >Tracks</button>
                        <button
                            onClick={() => setMixerMode('all')}
                            className={`px-3 h-full text-[10px] font-black uppercase rounded transition-all ${mixerMode === 'all' ? 'text-[var(--accent-cyan)] bg-[#333] shadow-md border border-[var(--accent-cyan)]/50' : 'text-gray-500 hover:text-[var(--accent-cyan)]'}`}
                        >All</button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-[#000] rounded-md border border-[var(--accent-cyan)]/50 p-0.5 h-7">
                        {filterTypes.map(type => (
                            <button
                                key={type}
                                onClick={() => setTrackTypeFilter(type as any)}
                                className={`px-2.5 h-full text-[9px] font-black uppercase rounded transition-all ${trackTypeFilter === type ? 'text-[var(--accent-cyan)] bg-[#333]' : 'text-gray-500 hover:text-[var(--accent-cyan)]'}`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                    <div className="w-px h-5 bg-[var(--accent-cyan)]/30 mx-1"></div>
                    <button
                        onClick={() => setShowTrackStacks(!showTrackStacks)}
                        className={`p-1 rounded transition-all ${showTrackStacks ? 'bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]' : 'text-gray-400 hover:text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/10'}`}
                        title="Show/Hide track stacks"
                    >
                        {showTrackStacks ? 'Stacks On' : 'Stacks Off'}
                    </button>
                    <button className="p-1 hover:bg-[var(--accent-cyan)]/10 rounded transition-all"><MoreHorizontal className="w-4 h-4 text-gray-500 hover:text-[var(--accent-cyan)]" /></button>
                </div>
            </div>

            {/* 2. Main Console View */}
            <div className="flex-1 flex overflow-x-auto custom-scrollbar-h relative">

                {/* Fixed Label Column (Pro Look) */}
                <div className="w-[100px] bg-[#1a1a1a] border-r border-black flex flex-col shrink-0 sticky left-0 z-30 shadow-[4px_0_15px_rgba(0,0,0,0.5)]">
                    <div className="h-10 border-b border-black/20"></div> {/* Setting */}
                    <div className="h-12 border-b border-black/20"></div> {/* EQ Visual */}
                    <div className="flex-1 flex flex-col py-2 px-3 gap-0.5">
                        <LabelRow label="Midi FX" />
                        <div className="h-[100px] relative border-b border-black/20 mb-2">
                            <LabelRow label="Audio FX" />
                        </div>
                        <LabelRow label="Sends" />
                        <div className="h-16 border-b border-black/20 mb-2"></div>
                        <LabelRow label="Output" />
                        <LabelRow label="Group" />
                        <LabelRow label="Automation" />
                    </div>
                </div>

                {/* Dynamic Channel Strips */}
                {filteredTracks.map(track => (
                    <TrackMixerChannelStrip
                        key={track.id}
                        track={track}
                        isSelected={track.id === focusedTrackId}
                        focusedTrackId={focusedTrackId}
                    />
                ))}

                {/* Master Output Strip */}
                <MixerChannelStrip
                    track={null}
                    isMaster
                    isSelected={false}
                    onSelect={noop}
                    onUpdate={onMasterUpdate}
                    onAddPlugin={noop}
                    onTogglePlugin={noop}
                    setOpenPluginEditor={setOpenPluginEditor}
                    saveHistorySnapshot={saveHistorySnapshot}
                    masterVolume={settings.masterVolume}
                    masterPan={settings.masterPan}
                    masterMuted={settings.masterMuted}
                />
            </div>

            {/* EBU R128 loudness on the master bus — the figures needed to
                master to a streaming target rather than by eye. */}
            <div className="shrink-0 border-t border-white/5 px-2 py-1 flex justify-end">
                <LoudnessReadout />
            </div>

            <style jsx>{`
                .custom-scrollbar-h::-webkit-scrollbar { height: 6px; }
                .custom-scrollbar-h::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar-h::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
            `}</style>
        </div>
    )
}

function LabelRow({ label }: { label: string }) {
    return (
        <div className="h-4 flex items-center justify-end pr-2">
            <span className="text-[8px] font-black text-gray-700 uppercase tracking-widest leading-none truncate">{label}</span>
        </div>
    )
}

function ChannelStripSettingButton({ track, isMaster }: { track: Track | null; isMaster?: boolean }) {
    const [open, setOpen] = useState(false);
    const channelStripSettings = useProjectStore(s => s.channelStripSettings);
    const channelStripCopyBuffer = useProjectStore(s => s.channelStripCopyBuffer);
    const channelStripPerformances = useProjectStore(s => s.channelStripPerformances);
    const loadChannelStripSetting = useProjectStore(s => s.loadChannelStripSetting);
    const chooseNextChannelStripSetting = useProjectStore(s => s.chooseNextChannelStripSetting);
    const choosePreviousChannelStripSetting = useProjectStore(s => s.choosePreviousChannelStripSetting);
    const copyChannelStripSetting = useProjectStore(s => s.copyChannelStripSetting);
    const pasteChannelStripSetting = useProjectStore(s => s.pasteChannelStripSetting);
    const pasteChannelStripPluginsOnly = useProjectStore(s => s.pasteChannelStripPluginsOnly);
    const pasteChannelStripSendsOnly = useProjectStore(s => s.pasteChannelStripSendsOnly);
    const removeAllChannelStripPlugins = useProjectStore(s => s.removeAllChannelStripPlugins);
    const removeEmptyInsertSlots = useProjectStore(s => s.removeEmptyInsertSlots);
    const removeBypassedPlugins = useProjectStore(s => s.removeBypassedPlugins);
    const removeAllChannelStripSends = useProjectStore(s => s.removeAllChannelStripSends);
    const resetChannelStrip = useProjectStore(s => s.resetChannelStrip);
    const saveChannelStripSetting = useProjectStore(s => s.saveChannelStripSetting);
    const deleteChannelStripSetting = useProjectStore(s => s.deleteChannelStripSetting);
    const saveChannelStripPerformance = useProjectStore(s => s.saveChannelStripPerformance);
    const loadChannelStripPerformance = useProjectStore(s => s.loadChannelStripPerformance);

    const trackType = track ? (track.type === 'audio' ? 'audio' : (track.type === 'bus' || track.type === 'output' ? 'output' : 'instrument')) : 'output';
    const settingsForTrack = channelStripSettings.filter(s => s.type === trackType);
    const selectedSetting = track?.channelStripId ? channelStripSettings.find(s => s.id === track.channelStripId) : null;

    const currentPerf = track ? channelStripPerformances.filter(p => p.trackId === track.id) : [];

    const handleSaveSetting = () => {
        if (!track) return;
        const name = prompt('Save Channel Strip Setting as', `${track.name} Setting`);
        if (!name) return;
        saveChannelStripSetting(track.id, name);
    };

    const handleSavePerformance = () => {
        if (!track) return;
        const name = prompt('Performance Name', `${track.name} Perf`);
        if (!name) return;
        const programStr = prompt('MIDI Program Change (0-127)', '1');
        if (!programStr) return;
        const program = Math.max(0, Math.min(127, parseInt(programStr, 10) || 1));
        saveChannelStripPerformance(track.id, name, program);
    };

    if (!isMaster && !track) return null;

    return (
        <div className="relative w-full">
            <button
                onClick={(e) => { e.stopPropagation(); setOpen(op => !op); }}
                className="h-7 bg-[#000] border border-[#333] rounded-sm w-full text-[9px] font-black text-gray-400 uppercase tracking-tighter shadow-inner"
            >
                {isMaster ? 'Stereo Out' : track?.name || 'Empty'}
            </button>
            {open && !isMaster && track && (
                <div className="absolute z-50 left-0 top-full mt-1 w-[220px] bg-[#111] border border-[#444] rounded shadow-lg p-2 text-xs">
                    <div className="flex flex-col gap-1">
                        <button className="text-left px-2 py-1 hover:bg-white/10 rounded" onClick={(e) => { e.stopPropagation(); setOpen(false); handleSaveSetting(); }}>Save Setting</button>
                        <button className="text-left px-2 py-1 hover:bg-white/10 rounded" onClick={(e) => { e.stopPropagation(); setOpen(false); handleSavePerformance(); }}>Save as Performance</button>
                        <button className="text-left px-2 py-1 hover:bg-white/10 rounded" onClick={(e) => { e.stopPropagation(); setOpen(false); copyChannelStripSetting(track.id); }}>Copy Setting</button>
                        <button disabled={!channelStripCopyBuffer} className="text-left px-2 py-1 hover:bg-white/10 rounded disabled:opacity-40" onClick={(e) => { e.stopPropagation(); setOpen(false); pasteChannelStripSetting(track.id); }}>Paste Setting</button>
                        <button disabled={!channelStripCopyBuffer} className="text-left px-2 py-1 hover:bg-white/10 rounded disabled:opacity-40" onClick={(e) => { e.stopPropagation(); setOpen(false); pasteChannelStripPluginsOnly(track.id); }}>Paste Plugins Only</button>
                        <button disabled={!channelStripCopyBuffer} className="text-left px-2 py-1 hover:bg-white/10 rounded disabled:opacity-40" onClick={(e) => { e.stopPropagation(); setOpen(false); pasteChannelStripSendsOnly(track.id); }}>Paste Sends Only</button>
                        <button className="text-left px-2 py-1 hover:bg-white/10 rounded" onClick={(e) => { e.stopPropagation(); setOpen(false); removeAllChannelStripPlugins(track.id); }}>Remove All Effect Plug-ins</button>
                        <button className="text-left px-2 py-1 hover:bg-white/10 rounded" onClick={(e) => { e.stopPropagation(); setOpen(false); removeEmptyInsertSlots(track.id); }}>Remove Empty Insert Slots</button>
                        <button className="text-left px-2 py-1 hover:bg-white/10 rounded" onClick={(e) => { e.stopPropagation(); setOpen(false); removeBypassedPlugins(track.id); }}>Remove Bypassed Plug-ins</button>
                        <button className="text-left px-2 py-1 hover:bg-white/10 rounded" onClick={(e) => { e.stopPropagation(); setOpen(false); removeAllChannelStripSends(track.id); }}>Remove All Sends</button>
                        <button className="text-left px-2 py-1 hover:bg-white/10 rounded" onClick={(e) => { e.stopPropagation(); setOpen(false); resetChannelStrip(track.id); }}>Reset Channel Strip</button>
                        <button className="text-left px-2 py-1 hover:bg-white/10 rounded" onClick={(e) => { e.stopPropagation(); setOpen(false); choosePreviousChannelStripSetting(track.id); }}>Prev Channel Strip Setting</button>
                        <button className="text-left px-2 py-1 hover:bg-white/10 rounded" onClick={(e) => { e.stopPropagation(); setOpen(false); chooseNextChannelStripSetting(track.id); }}>Next Channel Strip Setting</button>
                    </div>

                    {settingsForTrack.length > 0 && (
                        <div className="mt-2 p-1 border border-white/10 rounded bg-[#0f0f0f]">
                            <div className="text-[8px] uppercase text-gray-500 mb-1">Saved Settings</div>
                            {settingsForTrack.map(s => (
                                <div key={s.id} className="flex justify-between items-center px-1 py-0.5"> 
                                    <button className="text-[9px] text-gray-300 hover:text-white truncate" onClick={(e) => { e.stopPropagation(); setOpen(false); loadChannelStripSetting(track.id, s.id); }}>{s.name}</button>
                                    <button className="text-[8px] text-red-400" onClick={(e) => { e.stopPropagation(); deleteChannelStripSetting(s.id); }}>Del</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {currentPerf.length > 0 && (
                        <div className="mt-2 p-1 border border-white/10 rounded bg-[#0f0f0f]">
                            <div className="text-[8px] uppercase text-gray-500 mb-1">Performances</div>
                            {currentPerf.map(p => (
                                <div key={p.id} className="flex justify-between items-center px-1 py-0.5">
                                    <button className="text-[9px] text-gray-300 hover:text-white truncate" onClick={(e) => { e.stopPropagation(); setOpen(false); loadChannelStripPerformance(track.id, p.program); }}>PC {p.program} - {p.name}</button>
                                </div>
                            ))}
                        </div>
                    )}

                </div>
            )}

        </div>
    );
}

interface MixerChannelStripProps {
    track: Track | null;
    isSelected: boolean;
    onSelect: (e?: React.MouseEvent) => void;
    onUpdate: (updates: Partial<Track>) => void;
    onAddPlugin: (type: string) => void;
    onTogglePlugin: (pid: string) => void;
    setOpenPluginEditor: (editor: { trackId: string, pluginId: string } | null) => void;
    saveHistorySnapshot: () => void;
    isMaster?: boolean;
    masterVolume?: number;
    masterPan?: number;
    masterMuted?: boolean;
    toggleTrackFreeze?: (trackId: string) => void;
    handleAction?: (field: keyof Track, value: any, e: React.MouseEvent) => void;
}

function TrackMixerChannelStrip({ track, isSelected, focusedTrackId }: { track: Track; isSelected: boolean; focusedTrackId: string | null }) {
    const selectTrack = useProjectStore(s => s.selectTrack);
    const updateTrack = useProjectStore(s => s.updateTrack);
    const addPlugin = useProjectStore(s => s.addPlugin);
    const togglePlugin = useProjectStore(s => s.togglePlugin);
    const setOpenPluginEditor = useProjectStore(s => s.setOpenPluginEditor);
    const saveHistorySnapshot = useProjectStore(s => s.saveHistorySnapshot);

    const onSelect = useCallback((e?: React.MouseEvent) => selectTrack(track.id, e?.metaKey || e?.ctrlKey, e?.shiftKey), [track.id, selectTrack]);
    const onUpdate = useCallback((updates: Partial<Track>) => updateTrack(track.id, updates), [track.id, updateTrack]);
    const onAddPluginFn = useCallback((type: string) => addPlugin(track.id, type), [track.id, addPlugin]);
    const onTogglePluginFn = useCallback((pid: string) => togglePlugin(track.id, pid), [track.id, togglePlugin]);

    return (
        <MixerChannelStrip
            track={track}
            isSelected={isSelected}
            onSelect={onSelect}
            onUpdate={onUpdate}
            onAddPlugin={onAddPluginFn}
            onTogglePlugin={onTogglePluginFn}
            setOpenPluginEditor={setOpenPluginEditor}
            saveHistorySnapshot={saveHistorySnapshot}
        />
    );
}

const MixerChannelStrip = memo(function MixerChannelStrip({ 
    track, isSelected, onSelect, onUpdate, onAddPlugin, onTogglePlugin, setOpenPluginEditor,
    saveHistorySnapshot,
    isMaster = false, masterVolume = 0.8, masterPan = 0, masterMuted = false,
    toggleTrackFreeze, handleAction
}: MixerChannelStripProps) {
    const faderCapRef = useRef<HTMLDivElement>(null);
    const initialVolume = isMaster ? masterVolume : (track?.volume || 0.8);
    const initialPan = isMaster ? masterPan : (track?.pan || 0);
    const initialMuted = isMaster ? masterMuted : (track?.muted || false);
    const isDraggingRef = useRef(false);

    // The master strip has no Track, so its inserts come from `masterPlugins`.
    // Before this it read `track?.plugins` — always undefined — so the master
    // rack rendered empty however many plugins the chain actually held.
    const masterPlugins = useProjectStore(s => s.masterPlugins);
    const addMasterPlugin = useProjectStore(s => s.addMasterPlugin);
    const toggleMasterPlugin = useProjectStore(s => s.toggleMasterPlugin);
    const fxChain = isMaster ? (masterPlugins ?? []) : (track?.plugins ?? []);
    const addToChain = isMaster ? addMasterPlugin : onAddPlugin;
    const toggleInChain = isMaster ? toggleMasterPlugin : onTogglePlugin;

    useEffect(() => {
        if (!isDraggingRef.current && faderCapRef.current) {
            faderCapRef.current.style.bottom = `${initialVolume * 100}%`;
        }
    }, [initialVolume]);

    return (
        <div
            onClick={onSelect}
            className={`w-[120px] h-full flex flex-col border-r border-black shrink-0 transition-colors relative group ${isSelected ? 'bg-sky-500/[0.04]' : 'bg-[#1e1e1e]/50 hover:bg-white/[0.02]'}`}
        >
            <div className="flex-1 flex flex-col px-2 py-3 gap-1 overflow-y-auto custom-scrollbar-v no-scrollbar">

                {/* Setting / Icon Spot */}
                <ChannelStripSettingButton
                    track={track}
                    isMaster={isMaster}
                />

                {/* EQ Visualizer Slot */}
                <div className="h-10 bg-black/60 border border-white/5 rounded-sm flex items-center justify-center relative overflow-hidden group/eq">
                    <div className="absolute inset-0 bg-gradient-to-t from-sky-950/20 to-transparent"></div>
                    <svg viewBox="0 0 100 40" className="w-full h-full opacity-30 group-hover/eq:opacity-60 transition-opacity">
                        <path d="M0,25 Q30,5 60,30 T100,20" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
                    </svg>
                </div>

                {/* MIDI FX Slot */}
                <div className="h-5 bg-black/40 rounded-sm border border-white/5 flex items-center justify-center text-[8px] font-black text-gray-700 uppercase">
                    Midi FX
                </div>

                {/* FX Rack (Professional Dynamic Stack) */}
                <div className="flex flex-col gap-0.5 h-[100px] mb-1 overflow-y-auto no-scrollbar">
                    {fxChain.map((p: any) => (
                        <div
                            key={p.id}
                            onClick={(e) => { e.stopPropagation(); if (track) setOpenPluginEditor({ trackId: track.id, pluginId: p.id }); }}
                            className={`h-5 rounded-sm flex items-center px-2 text-[9px] font-black shadow-sm border-t border-white/10 cursor-pointer hover:brightness-125 transition-all ${p.enabled ? (p.name.includes('EQ') ? 'bg-sky-500 text-white shadow-[0_0_10px_rgba(14,165,233,0.3)]' : 'bg-sky-600 text-white') : 'bg-gray-800 text-gray-500 opacity-60'}`}
                        >
                            <div 
                                onClick={(e) => { e.stopPropagation(); toggleInChain(p.id); }}
                                className="mr-1.5 p-0.5 hover:bg-white/10 rounded"
                            >
                                <Power className={`w-2 h-2 ${p.enabled ? 'text-white' : 'text-gray-600'}`} fill="currentColor" />
                            </div>
                            <span className="truncate">{p.name}</span>
                        </div>
                    ))}

                    {/* Dynamics plugins can be keyed from another track. */}
                    {track && fxChain
                        .filter((p: any) => p.pluginId === BUILTIN_PLUGIN_IDS.sidechainCompressor)
                        .map((p: any) => (
                            <SidechainPicker key={`sc-${p.id}`} track={track} pluginId={p.id} />
                        ))}

                    {fxChain.length < 8 && (
                        <PluginMenu
                            onSelect={(type) => addToChain(type)}
                            onBrowse={() => {
                                const id = isMaster ? null : track?.id;
                                // The FX menu is about effects; instruments are
                                // chosen from the Inspector's Instrument slot.
                                if (id) useProjectStore.getState().setPluginBrowserTrack(id, 'effect');
                            }}
                        />
                    )}
                </div>

                {/* Sends */}
                <SendsSlot track={track} />

                {/* Output Routing */}
                <OutputRouting track={track} isMaster={isMaster} />

                <div className="h-6 bg-black/40 border border-white/5 rounded-sm flex items-center justify-center text-[9px] font-black text-gray-600 uppercase mb-1">None</div>

                <div className="h-6 bg-black/60 border border-sky-500/20 rounded-sm flex items-center justify-center text-[9px] font-black text-[#63ed63] uppercase mb-4 shadow-inner">Read</div>

                {/* Fader & Metering Area */}
                <div className="flex-1 flex flex-col items-center justify-end pb-4 gap-3">
                    {/* Pan Knob */}
                    <div 
                        className="relative group/pan cursor-pointer"
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            const startY = e.clientY;
                            const startPan = initialPan;
                            const onMove = (me: MouseEvent) => {
                                const delta = (startY - me.clientY) / 100;
                                let newPan = Math.max(-1, Math.min(1, startPan + delta));
                                // Snap to center
                                if (Math.abs(newPan) < 0.05) newPan = 0;
                                
                                onUpdate({ pan: newPan });
                                if (isMaster) {
                                    audioEngine2.setMasterPan(newPan);
                                } else if (track) {
                                    audioEngine2.setTrackPan(track.id, newPan);
                                }
                            };
                            const onUp = () => {
                                saveHistorySnapshot();
                                window.removeEventListener('mousemove', onMove);
                                window.removeEventListener('mouseup', onUp);
                            };
                            window.addEventListener('mousemove', onMove);
                            window.addEventListener('mouseup', onUp);
                        }}
                    >
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#111] via-[#222] to-[#3a3a3a] border border-[#333] shadow-xl relative ring-1 ring-black/50">
                            <div 
                                className="absolute top-1 left-[16.5px] w-[2px] h-3 bg-gray-500 rounded-full origin-bottom transition-transform duration-75" 
                                style={{ transform: `rotate(${initialPan * 45}deg)` }}
                            ></div>
                        </div>
                        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-black text-gray-600 group-hover/pan:text-sky-400 uppercase">
                            {initialPan === 0 ? 'Center' : (initialPan < 0 ? `L${Math.abs(Math.round(initialPan * 64))}` : `R${Math.round(initialPan * 64)}`)}
                        </span>
                    </div>

                    {/* Fader Stack */}
                    <div className="flex gap-2 items-end h-[180px]">
                        <div className="h-full w-2 relative flex flex-col justify-end">
                            <VerticalMeter 
                                analyzer={isMaster ? audioEngine.getMasterAnalyzer() : (track ? (audioEngine.getTrackNodes(track.id)?.analyzer || null) : null)} 
                                side="L" 
                                className="w-full h-full"
                            />
                        </div>

                        {/* Fader Track */}
                        <div className="h-full w-6 bg-black/40 rounded border border-[#2a2a2a] relative group/fader cursor-ns-resize">
                            {/* Fader Markings */}
                            <div className="absolute inset-y-2 inset-x-1 flex flex-col justify-between opacity-10 py-1 pointer-events-none">
                                {[...Array(15)].map((_, i) => <div key={i} className="w-full h-px bg-white"></div>)}
                            </div>

                            {/* Fader Cap */}
                            <div
                                ref={faderCapRef}
                                className="absolute -left-1 w-8 h-4 bg-gradient-to-b from-[#444] to-[#222] border border-[#555] rounded shadow-[0_4px_10px_rgba(0,0,0,0.8)] z-20 flex items-center justify-center"
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    isDraggingRef.current = true;
                                    const startY = e.clientY;
                                    const startVol = isMaster ? masterVolume : (track?.volume || 0.8);
                                    let lastFlushedVol = startVol;

                                    // Audio updated on EVERY mousemove (no throttle) — O(1) Web Audio API call
                                    const onMove = (me: MouseEvent) => {
                                        let newVol = Math.max(0, Math.min(1.2, startVol + (startY - me.clientY) / 180));
                                        if (Math.abs(newVol - 0.8) < 0.02) newVol = 0.8;
                                        lastFlushedVol = newVol;
                                        if (isMaster) {
                                            audioEngine2.setMasterVolume(newVol);
                                        } else if (track) {
                                            audioEngine2.setTrackVolume(track.id, newVol);
                                        }
                                    };

                                    // Visual updates batched via RAF
                                    let rafId: number | null = null;
                                    const onRafMove = (me: MouseEvent) => {
                                        onMove(me);
                                        if (rafId === null && faderCapRef.current) {
                                            rafId = requestAnimationFrame(() => {
                                                rafId = null;
                                                if (faderCapRef.current) {
                                                    faderCapRef.current.style.bottom = `${Math.min(100, lastFlushedVol * 100)}%`;
                                                }
                                            });
                                        }
                                    };

                                    const onUp = () => {
                                        isDraggingRef.current = false;
                                        if (rafId !== null) cancelAnimationFrame(rafId);
                                        if (faderCapRef.current) {
                                            faderCapRef.current.style.bottom = `${Math.min(100, lastFlushedVol * 100)}%`;
                                        }
                                        if (isMaster) {
                                            audioEngine2.setMasterVolume(lastFlushedVol);
                                        } else if (track) {
                                            audioEngine2.setTrackVolume(track.id, lastFlushedVol);
                                        }
                                        saveHistorySnapshot(); 
                                        window.removeEventListener('mousemove', onRafMove);
                                        window.removeEventListener('mouseup', onUp);
                                        onUpdate({ volume: lastFlushedVol });
                                    };
                                    window.addEventListener('mousemove', onRafMove);
                                    window.addEventListener('mouseup', onUp);
                                }}
                            >
                                <div className="w-[80%] h-px bg-white/20"></div>
                            </div>
                        </div>

                        <div className="h-full w-2 relative flex flex-col justify-end">
                            <VerticalMeter 
                                analyzer={isMaster ? audioEngine.getMasterAnalyzer() : (track ? (audioEngine.getTrackNodes(track.id)?.analyzer || null) : null)} 
                                side="R" 
                                className="w-full h-full"
                            />
                        </div>
                    </div>

                    {/* M/S Commands */}
                    <div className="flex gap-1.5 h-7 w-full px-2">
                        <button
                            id={track ? `mixer-mute-${track.id}` : 'mixer-mute-master'}
                            onClick={(e) => {
                                e.stopPropagation();
                                const nextMuted = !initialMuted;
                                onUpdate({ muted: nextMuted });
                                // Drive Web Audio mute bus immediately.
                                if (isMaster) {
                                    audioEngine2.setMasterMuted(nextMuted);
                                } else if (track) {
                                    if (nextMuted) audioEngine2.muteTrack(track.id);
                                    else           audioEngine2.unmuteTrack(track.id);
                                }
                            }}
                            className={`flex-1 border rounded-md text-[10px] font-black transition-all transform active:scale-95 ${initialMuted ? 'bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'bg-[#1a1a1a] border-[#333] text-gray-600 hover:text-gray-400 group-hover:border-gray-700'}`}
                        >M</button>
                        <button
                            id={track ? `mixer-solo-${track.id}` : 'mixer-solo-master'}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isMaster) return; // Master usually doesn't have a solo button
                                if (!track) return;
                                const nextSoloed = !track.soloed;
                                onUpdate({ soloed: nextSoloed });
                                // Drive Web Audio solo group immediately.
                                if (nextSoloed) audioEngine2.soloTrack(track.id);
                                else            audioEngine2.unsoloTrack(track.id);
                            }}
                            className={`flex-1 border rounded-md text-[10px] font-black transition-all transform active:scale-95 ${track?.soloed ? 'bg-[#ffc500]/20 border-[#ffc500] text-[#ffc500] shadow-[0_0_10px_rgba(255,197,0,0.3)]' : 'bg-[#1a1a1a] border-[#333] text-gray-600 hover:text-gray-400 group-hover:border-gray-700'}`}
                        >S</button>
                    </div>
                </div>
            </div>

            {/* Bottom Label Bar */}
            <div className={`h-8 border-t border-black flex items-center px-4 justify-between shrink-0 relative ${isSelected ? 'bg-sky-500/20' : 'bg-[#111]'}`}>
                {isSelected && <div className="absolute top-0 left-0 right-0 h-0.5 bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.8)]"></div>}

                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-white/90 truncate uppercase tracking-tighter">
                        {isMaster ? 'Master' : (track?.name || 'Track')}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                    {track?.type === 'midi' ? <Keyboard className="w-3.5 h-3.5 text-green-400" /> : <Mic className="w-3.5 h-3.5 text-sky-400" />}
                    <span className="text-[9px] font-black text-gray-600 uppercase tabular-nums">{`1`}</span>
                </div>
            </div>

            <style jsx>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .custom-scrollbar-v::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar-v::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar-v::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
            `}</style>
        </div>
    )
})

function PluginMenu({ onSelect, onBrowse }: {
    onSelect: (type: string) => void;
    /** Open the full third-party plugin catalogue. */
    onBrowse: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node) && buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        window.addEventListener('mousedown', handleClick);
        return () => window.removeEventListener('mousedown', handleClick);
    }, [open]);

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setCoords({ top: rect.bottom + 2, left: rect.left });
        }
        setOpen(!open);
    };

    const plugins = [
        { id: 'comp', name: 'Compressor', category: 'Dynamics' },
        { id: 'sidechain', name: 'Sidechain Comp', category: 'Dynamics' },
        { id: 'limiter', name: 'Limiter', category: 'Dynamics' },
        { id: 'eq', name: 'Channel EQ', category: 'EQ' },
        { id: 'reverb', name: 'ChromaVerb', category: 'Reverb' },
        { id: 'delay', name: 'Delay Designer', category: 'Delay' },
        { id: 'widener', name: 'Stereo Widener', category: 'Imaging' },
    ];

    return (
        <div className="relative w-full">
            <button
                ref={buttonRef}
                onClick={handleToggle}
                className="h-5 bg-black/20 rounded-sm border border-white/5 text-[8px] font-black text-gray-700 hover:text-gray-400 hover:bg-white/5 uppercase flex items-center justify-center transition-all w-full"
            >
                Audio FX
            </button>
            {open && (
                <div 
                    ref={menuRef}
                    style={{ top: coords.top, left: coords.left }}
                    className="fixed z-[999] w-[180px] bg-[#1a1a1a] border border-[#444] rounded shadow-[0_15px_50px_rgba(0,0,0,1)] p-1 overflow-hidden"
                >
                    <div className="text-[7px] uppercase text-gray-600 font-black px-2 py-1 border-b border-white/5 mb-1 tracking-widest">Plug-ins</div>
                    {plugins.map(p => (
                        <button
                            key={p.id}
                            onClick={(e) => { e.stopPropagation(); onSelect(p.id as any); setOpen(false); }}
                            className="w-full text-left px-3 py-1.5 hover:bg-sky-500 hover:text-white text-[10px] font-black text-gray-300 transition-colors flex items-center justify-between group"
                        >
                            <span>{p.name}</span>
                            <span className="text-[8px] text-gray-600 group-hover:text-sky-200">{p.category}</span>
                        </button>
                    ))}
                    <div className="mt-1 pt-1 border-t border-white/5">
                        <button
                            onClick={(e) => { e.stopPropagation(); onBrowse(); setOpen(false); }}
                            className="w-full text-left px-3 py-1 hover:bg-sky-500 hover:text-white text-[9px] font-bold text-gray-500 uppercase transition-colors"
                        >
                            Browse Plug-ins…
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function ChevronDownSmall({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 100 100" className={className} fill="currentColor">
            <polygon points="20,40 80,40 50,70" />
        </svg>
    )
}
