"use client"
import { useState, useRef, useEffect, memo, useCallback } from "react"
import { useProjectStore } from "@/store/projectStore"
import { Track } from "@/models/Track"
import { audioEngine2 } from "@/engine/AudioEngineAdapter"
import { audioEngine } from "@/engine/AudioEngineAdapter"
import { VerticalMeter } from "./VerticalMeter"
import { LoudnessReadout } from "./MasterOutput"
import { SendsSlot, OutputRouting, MonitorControls, SidechainPicker } from "./mixer/RoutingControls"
import { PeakDisplay, LevelField, PanField, RecordMonitorButtons, resetAllPeakDisplays } from "./mixer/ChannelStripReadouts"
import { MAX_GAIN } from "@/lib/mixerLevel"
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
        <div className="h-full flex flex-col bg-studio-panel select-none text-studio-text-mid border-t border-[var(--accent-cyan)]/50 shadow-[0_-10px_30px_var(--accent-cyan-glow),0_-10px_30px_rgba(0,0,0,0.3)]">
            {/* 1. Mixer Command Header (High Fidelity Menu Bar) */}
            <div className="h-9 bg-studio-raised border-b border-[var(--accent-cyan)]/30 flex items-center px-4 justify-between shrink-0">
                <div className="flex items-center gap-1">
                    <div className="flex items-center gap-1.5 bg-studio-void border border-[var(--accent-cyan)]/40 rounded px-2.5 h-7 cursor-pointer hover:border-[var(--accent-cyan)] hover:shadow-[0_0_8px_var(--accent-cyan-glow)] transition-all group">
                        <span className="text-[10px] font-black text-studio-text-mid group-hover:text-white uppercase tracking-tighter">Edit</span>
                        <ChevronDown className="w-3 h-3 text-studio-text-dim" />
                    </div>
                    <div className="flex items-center gap-1.5 bg-studio-void border border-[var(--accent-cyan)]/40 rounded px-2.5 h-7 cursor-pointer hover:border-[var(--accent-cyan)] hover:shadow-[0_0_8px_var(--accent-cyan-glow)] transition-all group">
                        <span className="text-[10px] font-black text-studio-text-mid group-hover:text-[var(--accent-cyan)] uppercase tracking-tighter">Options</span>
                        <ChevronDown className="w-3 h-3 text-studio-text-dim" />
                    </div>
                    <div className="flex items-center gap-1.5 bg-studio-void border border-[var(--accent-cyan)]/40 rounded px-2.5 h-7 cursor-pointer hover:border-[var(--accent-cyan)] hover:shadow-[0_0_8px_var(--accent-cyan-glow)] transition-all group">
                        <span className="text-[10px] font-black text-studio-text-mid group-hover:text-[var(--accent-cyan)] uppercase tracking-tighter">View</span>
                        <ChevronDown className="w-3 h-3 text-studio-text-dim" />
                    </div>

                    <div className="w-px h-5 bg-[var(--accent-cyan)]/30 mx-2"></div>

                    {/* Monitor path — mono-sum phase check and reference direct-out. */}
                    <MonitorControls />

                    <div className="w-px h-5 bg-[var(--accent-cyan)]/30 mx-2"></div>

                    <div className="flex bg-studio-void rounded-md border border-[var(--accent-cyan)]/50 p-0.5 h-7 shadow-inner">
                        <button
                            onClick={() => setMixerMode('single')}
                            className={`px-3 h-full text-[10px] font-black uppercase rounded transition-all ${mixerMode === 'single' ? 'text-[var(--accent-cyan)] bg-studio-control shadow-md border border-[var(--accent-cyan)]/50' : 'text-studio-text-dim hover:text-[var(--accent-cyan)]'}`}
                        >Single</button>
                        <button
                            onClick={() => setMixerMode('tracks')}
                            className={`px-3 h-full text-[10px] font-black uppercase rounded transition-all ${mixerMode === 'tracks' ? 'text-[var(--accent-cyan)] bg-studio-control shadow-md border border-[var(--accent-cyan)]/50' : 'text-studio-text-dim hover:text-[var(--accent-cyan)]'}`}
                        >Tracks</button>
                        <button
                            onClick={() => setMixerMode('all')}
                            className={`px-3 h-full text-[10px] font-black uppercase rounded transition-all ${mixerMode === 'all' ? 'text-[var(--accent-cyan)] bg-studio-control shadow-md border border-[var(--accent-cyan)]/50' : 'text-studio-text-dim hover:text-[var(--accent-cyan)]'}`}
                        >All</button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-studio-void rounded-md border border-[var(--accent-cyan)]/50 p-0.5 h-7">
                        {filterTypes.map(type => (
                            <button
                                key={type}
                                onClick={() => setTrackTypeFilter(type as any)}
                                className={`px-2.5 h-full text-[9px] font-black uppercase rounded transition-all ${trackTypeFilter === type ? 'text-[var(--accent-cyan)] bg-studio-control' : 'text-studio-text-dim hover:text-[var(--accent-cyan)]'}`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                    <div className="w-px h-5 bg-[var(--accent-cyan)]/30 mx-1"></div>
                    <button
                        onClick={() => setShowTrackStacks(!showTrackStacks)}
                        className={`p-1 rounded transition-all ${showTrackStacks ? 'bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]' : 'text-studio-text-mid hover:text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/10'}`}
                        title="Show/Hide track stacks"
                    >
                        {showTrackStacks ? 'Stacks On' : 'Stacks Off'}
                    </button>
                    <button className="p-1 hover:bg-[var(--accent-cyan)]/10 rounded transition-all"><MoreHorizontal className="w-4 h-4 text-studio-text-dim hover:text-[var(--accent-cyan)]" /></button>
                </div>
            </div>

            {/* 2. Main Console View */}
            <div className="flex-1 flex overflow-x-auto custom-scrollbar-h relative">

                {/* Dynamic Channel Strips */}
                {filteredTracks.map(track => (
                    <TrackMixerChannelStrip
                        key={track.id}
                        track={track}
                        isSelected={track.id === focusedTrackId}
                        focusedTrackId={focusedTrackId}
                    />
                ))}

                <VcaStrips />

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
                className="h-7 bg-studio-void border border-studio-line rounded-sm w-full text-[9px] font-black text-studio-text-mid uppercase tracking-tighter shadow-inner"
            >
                {isMaster ? 'Stereo Out' : track?.name || 'Empty'}
            </button>
            {open && !isMaster && track && (
                <div className="absolute z-50 left-0 top-full mt-1 w-[220px] bg-studio-sunken border border-studio-line-strong rounded shadow-lg p-2 text-xs">
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
                        <div className="mt-2 p-1 border border-white/10 rounded bg-studio-void">
                            <div className="text-[8px] uppercase text-studio-text-dim mb-1">Saved Settings</div>
                            {settingsForTrack.map(s => (
                                <div key={s.id} className="flex justify-between items-center px-1 py-0.5"> 
                                    <button className="text-[9px] text-studio-text hover:text-white truncate" onClick={(e) => { e.stopPropagation(); setOpen(false); loadChannelStripSetting(track.id, s.id); }}>{s.name}</button>
                                    <button className="text-[8px] text-red-400" onClick={(e) => { e.stopPropagation(); deleteChannelStripSetting(s.id); }}>Del</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {currentPerf.length > 0 && (
                        <div className="mt-2 p-1 border border-white/10 rounded bg-studio-void">
                            <div className="text-[8px] uppercase text-studio-text-dim mb-1">Performances</div>
                            {currentPerf.map(p => (
                                <div key={p.id} className="flex justify-between items-center px-1 py-0.5">
                                    <button className="text-[9px] text-studio-text hover:text-white truncate" onClick={(e) => { e.stopPropagation(); setOpen(false); loadChannelStripPerformance(track.id, p.program); }}>PC {p.program} - {p.name}</button>
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
            className={`w-[120px] h-full flex flex-col border-r border-black shrink-0 transition-colors relative group ${isSelected ? 'bg-accent-cyan/[0.04]' : 'bg-studio-panel/50 hover:bg-white/[0.02]'}`}
        >
            {/* Routing slots scroll; the mixing controls below do not. The
                strip used to be one scrolling column, so at the mixer's
                default height the fader, meters and buttons were all below the
                fold and the panel showed only routing. */}
            <div className="flex-1 min-h-0 flex flex-col px-2 pt-3 gap-1 overflow-y-auto custom-scrollbar-v no-scrollbar">

                {/* Setting / Icon Spot */}
                <ChannelStripSettingButton
                    track={track}
                    isMaster={isMaster}
                />

                {/* EQ Visualizer Slot */}
                <div className="h-10 bg-black/60 border border-white/5 rounded-sm flex items-center justify-center relative overflow-hidden group/eq">
                    <div className="absolute inset-0 bg-gradient-to-t from-accent-cyan/20/20 to-transparent"></div>
                    <svg viewBox="0 0 100 40" className="w-full h-full opacity-30 group-hover/eq:opacity-60 transition-opacity">
                        <path d="M0,25 Q30,5 60,30 T100,20" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
                    </svg>
                </div>

                {/* MIDI FX Slot */}
                <div className="h-5 bg-black/40 rounded-sm border border-white/5 flex items-center justify-center text-[8px] font-black text-studio-text-dim uppercase">
                    Midi FX
                </div>

                {/* FX Rack (Professional Dynamic Stack) */}
                <div className="flex flex-col gap-0.5 h-[100px] mb-1 overflow-y-auto no-scrollbar">
                    {fxChain.map((p: any) => (
                        <div
                            key={p.id}
                            onClick={(e) => { e.stopPropagation(); if (track) setOpenPluginEditor({ trackId: track.id, pluginId: p.id }); }}
                            className={`h-5 rounded-sm flex items-center px-2 text-[9px] font-black shadow-sm border-t border-white/10 cursor-pointer hover:brightness-125 transition-all ${p.enabled ? (p.name.includes('EQ') ? 'bg-accent-cyan text-white shadow-[0_0_10px_rgba(14,165,233,0.3)]' : 'bg-accent-cyan text-white') : 'bg-studio-panel text-studio-text-dim opacity-60'}`}
                        >
                            <div 
                                onClick={(e) => { e.stopPropagation(); toggleInChain(p.id); }}
                                className="mr-1.5 p-0.5 hover:bg-white/10 rounded"
                            >
                                <Power className={`w-2 h-2 ${p.enabled ? 'text-white' : 'text-studio-text-dim'}`} fill="currentColor" />
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

                <GroupSlot track={track} />

                <div className="h-6 bg-black/60 border border-accent-cyan/20 rounded-sm flex items-center justify-center text-[9px] font-black text-[#63ed63] uppercase mb-4 shadow-inner">Read</div>

            </div>

            {/* Always visible: the controls a mix is actually made with. */}
            <div className="shrink-0 px-2 pb-2">
                <div className="flex flex-col items-center justify-end gap-1.5">
                    {/* Pan Knob */}
                    <div 
                        className="relative group/pan cursor-pointer"
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            // Alt-click returns the knob to centre, as in Logic.
                            // Without it the only way back to dead centre was to
                            // nudge until the snap caught, which is not a way to
                            // work.
                            if (e.altKey) {
                                onUpdate({ pan: 0 });
                                if (isMaster) audioEngine2.setMasterPan(0);
                                else if (track) audioEngine2.setTrackPan(track.id, 0);
                                saveHistorySnapshot();
                                return;
                            }
                            const startY = e.clientY;
                            const startPan = initialPan;
                            const onMove = (me: MouseEvent) => {
                                // Shift drags finer, for placing something just
                                // off centre without fighting the control.
                                const travel = me.shiftKey ? 400 : 100;
                                const delta = (startY - me.clientY) / travel;
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
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-studio-sunken via-studio-raised to-studio-control border border-studio-line shadow-xl relative ring-1 ring-black/50">
                            <div 
                                className="absolute top-1 left-[16.5px] w-[2px] h-3 bg-studio-control rounded-full origin-bottom transition-transform duration-75" 
                                style={{ transform: `rotate(${initialPan * 45}deg)` }}
                            ></div>
                        </div>
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                            <PanField
                                pan={initialPan}
                                onCommit={(value) => {
                                    onUpdate({ pan: value });
                                    if (isMaster) audioEngine2.setMasterPan(value);
                                    else if (track) audioEngine2.setTrackPan(track.id, value);
                                    saveHistorySnapshot();
                                }}
                            />
                        </div>
                    </div>

                    {/* Peak level and fader position — the numbers a mix is
                        actually set by. Neither existed before. */}
                    <div className="w-full px-2 flex items-center gap-1">
                        <LevelField
                            gain={isMaster ? masterVolume : (track?.volume ?? 0.8)}
                            onCommit={(gain) => {
                                onUpdate({ volume: gain });
                                if (isMaster) audioEngine2.setMasterVolume(gain);
                                else if (track) audioEngine2.setTrackVolume(track.id, gain);
                                if (faderCapRef.current) faderCapRef.current.style.bottom = `${Math.min(100, gain * 100)}%`;
                                saveHistorySnapshot();
                            }}
                            className="flex-1"
                        />
                        <PeakDisplay
                            analyzer={isMaster ? audioEngine.getMasterAnalyzer() : (track ? (audioEngine.getTrackNodes(track.id)?.analyzer || null) : null)}
                            className="flex-1"
                        />
                    </div>

                    {/* Fader Stack */}
                    <div className="flex gap-2 items-end h-[76px]">
                        <div className="h-full w-2 relative flex flex-col justify-end">
                            <VerticalMeter 
                                analyzer={isMaster ? audioEngine.getMasterAnalyzer() : (track ? (audioEngine.getTrackNodes(track.id)?.analyzer || null) : null)} 
                                side="L" 
                                className="w-full h-full"
                            />
                        </div>

                        {/* Fader Track */}
                        <div className="h-full w-6 bg-black/40 rounded border border-studio-line relative group/fader cursor-ns-resize">
                            {/* Fader Markings */}
                            <div className="absolute inset-y-2 inset-x-1 flex flex-col justify-between opacity-10 py-1 pointer-events-none">
                                {[...Array(15)].map((_, i) => <div key={i} className="w-full h-px bg-white"></div>)}
                            </div>

                            {/* Fader Cap */}
                            <div
                                ref={faderCapRef}
                                className="absolute -left-1 w-8 h-4 bg-gradient-to-b from-studio-control to-studio-raised border border-studio-line-strong rounded shadow-[0_4px_10px_rgba(0,0,0,0.8)] z-20 flex items-center justify-center"
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    // Alt-click returns the fader to unity gain,
                                    // as in Logic. There was no way to get back
                                    // to a known level once you had moved it.
                                    if (e.altKey) {
                                        const unity = 1;
                                        onUpdate({ volume: unity });
                                        if (isMaster) audioEngine2.setMasterVolume(unity);
                                        else if (track) audioEngine2.setTrackVolume(track.id, unity);
                                        if (faderCapRef.current) faderCapRef.current.style.bottom = `${unity * 100}%`;
                                        saveHistorySnapshot();
                                        return;
                                    }
                                    isDraggingRef.current = true;
                                    const startY = e.clientY;
                                    const startVol = isMaster ? masterVolume : (track?.volume || 0.8);
                                    let lastFlushedVol = startVol;

                                    // Audio updated on EVERY mousemove (no throttle) — O(1) Web Audio API call
                                    const onMove = (me: MouseEvent) => {
                                        // Shift drags in finer increments.
                                        const travel = me.shiftKey ? 720 : 180;
                                        let newVol = Math.max(0, Math.min(MAX_GAIN, startVol + (startY - me.clientY) / travel));
                                        // Snap to unity — the landmark worth
                                        // finding. It used to snap to 0.8, which
                                        // is -1.9 dB and means nothing.
                                        if (Math.abs(newVol - 1) < 0.02) newVol = 1;
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

                    {/* Record enable and input monitoring. Both flags existed
                        on every track but the mixer showed neither, so setting
                        a record level meant leaving the panel you set it in.
                        Disabled where there is no input to arm. */}
                    {!isMaster && track && (
                        <RecordMonitorButtons
                            recordEnabled={!!track.recordEnabled}
                            inputMonitoring={!!track.inputMonitoring}
                            disabled={track.type === 'bus' || track.type === 'output'}
                            onToggleRecord={() => onUpdate({ recordEnabled: !track.recordEnabled } as Partial<Track>)}
                            onToggleMonitor={() => onUpdate({ inputMonitoring: !track.inputMonitoring } as Partial<Track>)}
                        />
                    )}

                    {/* M/S Commands */}
                    <div className="flex gap-1.5 h-7 w-full px-2">
                        <button
                            id={track ? `mixer-mute-${track.id}` : 'mixer-mute-master'}
                            title="Mute - Cmd-click to switch every strip in the same state"
                            aria-label="Mute"
                            aria-pressed={initialMuted}
                            data-mute-button
                            onClick={(e) => {
                                e.stopPropagation();
                                const nextMuted = !initialMuted;

                                // Cmd/Ctrl-click switches every strip matching
                                // the clicked strip state, as in Logic.
                                if (e.metaKey || e.ctrlKey) {
                                    const store = useProjectStore.getState();
                                    store.saveHistorySnapshot();
                                    store.tracks
                                        .filter(t => !!t.muted === initialMuted)
                                        .forEach(t => {
                                            store.updateTrack(t.id, { muted: nextMuted });
                                            if (nextMuted) audioEngine2.muteTrack(t.id);
                                            else audioEngine2.unmuteTrack(t.id);
                                        });
                                    store.updateProjectSettings({ masterMuted: nextMuted });
                                    audioEngine2.setMasterMuted(nextMuted);
                                    return;
                                }

                                onUpdate({ muted: nextMuted });
                                // Drive Web Audio mute bus immediately.
                                if (isMaster) {
                                    audioEngine2.setMasterMuted(nextMuted);
                                } else if (track) {
                                    if (nextMuted) audioEngine2.muteTrack(track.id);
                                    else           audioEngine2.unmuteTrack(track.id);
                                }
                            }}
                            className={`flex-1 border rounded-md text-[10px] font-black transition-all transform active:scale-95 ${initialMuted ? 'bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'bg-studio-panel border-studio-line text-studio-text-dim hover:text-studio-text-mid group-hover:border-studio-line'}`}
                        >M</button>
                        <button
                            id={track ? `mixer-solo-${track.id}` : 'mixer-solo-master'}
                            title="Solo - Alt-click to solo only this strip, Ctrl-click for solo-safe"
                            aria-label="Solo"
                            aria-pressed={!!track?.soloed}
                            data-solo-button
                            data-solo-safe={track?.soloSafe || undefined}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isMaster) return; // The master has no solo of its own.
                                if (!track) return;
                                const store = useProjectStore.getState();

                                // Ctrl-click marks the strip solo-safe: it keeps
                                // playing when something else is soloed, which is
                                // what a reverb return needs.
                                if (e.ctrlKey && !e.metaKey) {
                                    store.updateTrack(track.id, { soloSafe: !track.soloSafe } as Partial<Track>);
                                    return;
                                }

                                // Alt-click solos this strip alone.
                                if (e.altKey) {
                                    store.saveHistorySnapshot();
                                    store.tracks.forEach(t => {
                                        const on = t.id === track.id;
                                        if (!!t.soloed === on) return;
                                        store.updateTrack(t.id, { soloed: on });
                                        if (on) audioEngine2.soloTrack(t.id);
                                        else audioEngine2.unsoloTrack(t.id);
                                    });
                                    return;
                                }

                                const nextSoloed = !track.soloed;
                                onUpdate({ soloed: nextSoloed });
                                // Drive Web Audio solo group immediately.
                                if (nextSoloed) audioEngine2.soloTrack(track.id);
                                else            audioEngine2.unsoloTrack(track.id);
                            }}
                            className={`relative flex-1 border rounded-md text-[10px] font-black transition-all transform active:scale-95 ${track?.soloed ? 'bg-[#ffc500]/20 border-[#ffc500] text-[#ffc500] shadow-[0_0_10px_rgba(255,197,0,0.3)]' : 'bg-studio-panel border-studio-line text-studio-text-dim hover:text-studio-text-mid group-hover:border-studio-line'}`}
                        >
                            S
                            {track?.soloSafe && (
                                <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <span className="w-4 h-px bg-[#ff4d4d] rotate-[-45deg]" />
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Bottom Label Bar */}
            <div className={`h-8 border-t border-black flex items-center px-4 justify-between shrink-0 relative ${isSelected ? 'bg-accent-cyan/20' : 'bg-studio-sunken'}`}>
                {isSelected && <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent-cyan shadow-[0_0_10px_rgba(14,165,233,0.8)]"></div>}

                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-white/90 truncate uppercase tracking-tighter">
                        {isMaster ? 'Master' : (track?.name || 'Track')}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                    {track?.type === 'midi' ? <Keyboard className="w-3.5 h-3.5 text-green-400" /> : <Mic className="w-3.5 h-3.5 text-accent-cyan" />}
                    <span className="text-[9px] font-black text-studio-text-dim uppercase tabular-nums">{`1`}</span>
                </div>
            </div>


        </div>
    )
})

/**
 * The channel strip's Group slot.
 *
 * Was a static "None" label. Mute/solo groups existed as a 492-line manager
 * that nothing imported, so a Logic user looking for the Group slot found a
 * word that never changed.
 *
 * Muting a group mutes its members through the store, so the M buttons on the
 * individual strips update too — the group is not a separate mute that could
 * disagree with the track's own.
 */
function GroupSlot({ track }: { track: any }) {
    const {
        muteSoloGroups, createMuteSoloGroup, setMuteSoloGroupTracks,
        toggleMuteSoloGroupMute, toggleMuteSoloGroupSolo, deleteMuteSoloGroup,
    } = useProjectStore()
    const [open, setOpen] = useState(false)

    if (!track) {
        return <div className="h-6 bg-black/40 border border-white/5 rounded-sm flex items-center justify-center text-[9px] font-black text-studio-text-dim uppercase mb-1">None</div>
    }

    const mine = muteSoloGroups.filter((g: any) => g.trackIds.includes(track.id))
    const label = mine.length === 0 ? 'None' : mine.length === 1 ? mine[0].name : `${mine.length} groups`
    const active = mine.some((g: any) => g.muted || g.soloed)

    const assign = (groupId: string, on: boolean) => {
        const group = muteSoloGroups.find((g: any) => g.id === groupId)
        if (!group) return
        setMuteSoloGroupTracks(
            groupId,
            on ? [...group.trackIds, track.id] : group.trackIds.filter((id: string) => id !== track.id)
        )
    }

    return (
        <div className="relative mb-1">
            <button
                onClick={() => setOpen(v => !v)}
                title="Mute/solo group"
                className={`w-full h-6 rounded-sm flex items-center justify-center text-[9px] font-black uppercase truncate px-1 border transition-colors ${
                    active
                        ? 'bg-accent-cyan/20 border-accent-cyan/50 text-accent-cyan'
                        : mine.length
                            ? 'bg-black/40 border-studio-line text-studio-text'
                            : 'bg-black/40 border-white/5 text-studio-text-dim'
                }`}
            >
                {label}
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute z-50 left-0 top-full mt-1 w-[210px] bg-studio-raised border border-studio-line-strong rounded shadow-2xl p-2 text-xs">
                        <div className="text-[8px] uppercase tracking-widest text-studio-text-dim mb-1.5 px-1">Groups</div>

                        {muteSoloGroups.length === 0 && (
                            <div className="px-1 py-2 text-[10px] text-studio-text-dim">No groups yet.</div>
                        )}

                        {muteSoloGroups.map((g: any) => {
                            const member = g.trackIds.includes(track.id)
                            return (
                                <div key={g.id} className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-white/5">
                                    <button
                                        onClick={() => assign(g.id, !member)}
                                        className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                                    >
                                        <span
                                            className="w-3 h-3 rounded-sm border shrink-0 flex items-center justify-center"
                                            style={{ borderColor: g.color, backgroundColor: member ? g.color : 'transparent' }}
                                        />
                                        <span className="truncate text-[11px] text-studio-text">{g.name}</span>
                                    </button>
                                    <button
                                        onClick={() => toggleMuteSoloGroupMute(g.id)}
                                        title="Mute group"
                                        className={`w-5 h-5 rounded text-[9px] font-black ${g.muted ? 'bg-amber-500 text-[#04070b]' : 'text-studio-text-dim hover:text-studio-text'}`}
                                    >M</button>
                                    <button
                                        onClick={() => toggleMuteSoloGroupSolo(g.id)}
                                        title="Solo group"
                                        className={`w-5 h-5 rounded text-[9px] font-black ${g.soloed ? 'bg-accent-cyan text-[#04070b]' : 'text-studio-text-dim hover:text-studio-text'}`}
                                    >S</button>
                                    <button
                                        onClick={() => deleteMuteSoloGroup(g.id)}
                                        title="Delete group"
                                        className="w-4 h-5 text-[11px] text-studio-text-dim hover:text-red-400"
                                    >&times;</button>
                                </div>
                            )
                        })}

                        <button
                            onClick={() => createMuteSoloGroup(`Group ${muteSoloGroups.length + 1}`, [track.id])}
                            className="w-full mt-1.5 px-2 py-1 rounded border border-studio-line text-[10px] font-bold text-studio-text hover:border-accent-cyan hover:text-accent-cyan transition-colors"
                        >
                            + New group with this track
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}

/**
 * VCA strips.
 *
 * The mixer already had a VCA filter tab with nothing behind it — no VCA could
 * be created, so the tab was always empty. A VCA scales its members' output
 * without moving their faders, which is the whole point: pull it down and back
 * up and every member is exactly where it was.
 */
function VcaStrips() {
    const { vcaFaders, createVcaFader, deleteVcaFader, setVcaFaderGain, tracks } = useProjectStore()

    return (
        <>
            {vcaFaders.map((vca: any) => (
                <div
                    key={vca.id}
                    className="w-[120px] h-full flex flex-col border-r border-black shrink-0 bg-studio-panel"
                >
                    <div className="p-2 flex flex-col gap-1.5 h-full">
                        <div
                            className="h-6 rounded-sm flex items-center justify-center text-[9px] font-black uppercase truncate px-1"
                            style={{ backgroundColor: `${vca.color}33`, color: vca.color, border: `1px solid ${vca.color}66` }}
                            title={`${vca.trackIds.length} track(s)`}
                        >
                            {vca.name}
                        </div>

                        <div className="text-[8px] text-center text-studio-text-dim uppercase tracking-widest">
                            VCA · {vca.trackIds.length}
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-end pb-4 gap-2">
                            <div className="text-[10px] font-black tabular-nums" style={{ color: vca.color }}>
                                {vca.gain > 0 ? '+' : ''}{vca.gain.toFixed(1)} dB
                            </div>
                            <input
                                type="range"
                                min={-60}
                                max={12}
                                step={0.5}
                                value={vca.gain}
                                onChange={e => setVcaFaderGain(vca.id, Number(e.target.value))}
                                title="VCA gain"
                                className="h-[140px] cursor-pointer"
                                style={{ writingMode: 'vertical-lr' as any, direction: 'rtl', accentColor: vca.color }}
                            />
                            <button
                                onClick={() => deleteVcaFader(vca.id)}
                                className="text-[9px] font-black text-studio-text-dim hover:text-red-400 uppercase"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            ))}

            <div className="w-[120px] h-full flex items-center justify-center border-r border-black shrink-0 bg-studio-panel/50">
                <button
                    onClick={() => createVcaFader(`VCA ${vcaFaders.length + 1}`, tracks.map((t: any) => t.id))}
                    title="Create VCA fader"
                    className="px-3 py-2 rounded border border-studio-line text-[10px] font-black uppercase text-studio-text-dim hover:text-accent-cyan hover:border-accent-cyan transition-colors"
                >
                    + VCA
                </button>
            </div>
        </>
    )
}

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
                className="h-5 bg-black/20 rounded-sm border border-white/5 text-[8px] font-black text-studio-text-dim hover:text-studio-text-mid hover:bg-white/5 uppercase flex items-center justify-center transition-all w-full"
            >
                Audio FX
            </button>
            {open && (
                <div 
                    ref={menuRef}
                    style={{ top: coords.top, left: coords.left }}
                    className="fixed z-[999] w-[180px] bg-studio-panel border border-studio-line-strong rounded shadow-[0_15px_50px_rgba(0,0,0,1)] p-1 overflow-hidden"
                >
                    <div className="text-[7px] uppercase text-studio-text-dim font-black px-2 py-1 border-b border-white/5 mb-1 tracking-widest">Plug-ins</div>
                    {plugins.map(p => (
                        <button
                            key={p.id}
                            onClick={(e) => { e.stopPropagation(); onSelect(p.id as any); setOpen(false); }}
                            className="w-full text-left px-3 py-1.5 hover:bg-accent-cyan hover:text-white text-[10px] font-black text-studio-text transition-colors flex items-center justify-between group"
                        >
                            <span>{p.name}</span>
                            <span className="text-[8px] text-studio-text-dim group-hover:text-accent-cyan">{p.category}</span>
                        </button>
                    ))}
                    <div className="mt-1 pt-1 border-t border-white/5">
                        <button
                            onClick={(e) => { e.stopPropagation(); onBrowse(); setOpen(false); }}
                            className="w-full text-left px-3 py-1 hover:bg-accent-cyan hover:text-white text-[9px] font-bold text-studio-text-dim uppercase transition-colors"
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
