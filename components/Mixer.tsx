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
import { ChannelModeButton, AutomationModeButton, VcaSlot, TrackNameField, OutputStripButtons } from "./mixer/ChannelStripSlots"
import { STRIP_ROWS, STRIP_WIDTH, LEGEND_WIDTH, FADER_SCALE, stripTint, type StripRow } from "./mixer/stripLayout"
import { MidiFxMenu } from "./mixer/MidiFxMenu"
import { MixerMenus, type MixerViewOptions } from "./mixer/MixerMenus"
import type { MidiFxId } from "@/lib/midiFxCatalog"
import { isMidiTrackType } from "@/lib/trackKinds"
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

    /*
     * A channel strip is tall. The bottom panel defaults to 320px, which is
     * shared with the piano roll and smart controls and leaves the mixer
     * showing routing slots with the fader below the fold. Opening the mixer
     * grows the panel to fit a strip, and never shrinks it — a height the user
     * chose is left alone.
     */
    const bottomPanelHeight = useProjectStore(s => s.bottomPanelHeight)
    const setBottomPanelHeight = useProjectStore(s => s.setBottomPanelHeight)
    useEffect(() => {
        if (showMixer && bottomPanelHeight < MIXER_MIN_HEIGHT) {
            setBottomPanelHeight(MIXER_MIN_HEIGHT)
        }
    }, [showMixer, bottomPanelHeight, setBottomPanelHeight])

    const [viewOptions, setViewOptions] = useState<MixerViewOptions>({
        showLegend: true,
        longFaders: false,
        autoscrollToSelection: true,
        followTrackStacks: true,
        sendsOnly: false,
    })

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
        // View > Channels with Sends only.
        if (viewOptions.sendsOnly && !(track.sends?.length)) return false
        // View > Follow Track Stacks: off, the members of a stack are listed
        // beside it rather than folded into it.
        if (!viewOptions.followTrackStacks && track.isStack) return false
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
                    <MixerMenus view={viewOptions} onView={patch => setViewOptions(v => ({ ...v, ...patch }))} />

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
                {/* Legend. Renders the same row spec as the strips, so each
                    label sits at exactly the height of the slot it names —
                    which is the only thing that makes a console layout
                    readable. Sticky, so it stays put while the strips scroll
                    sideways. */}
                <div
                    style={{ width: LEGEND_WIDTH, display: viewOptions.showLegend ? undefined : 'none' }}
                    data-mixer-legend
                    className="shrink-0 sticky left-0 z-30 flex flex-col bg-studio-panel border-r border-black shadow-[4px_0_15px_rgba(0,0,0,0.5)]"
                >
                    {STRIP_ROWS.map((row: StripRow) => (
                        <div
                            key={row.key}
                            data-legend-row={row.key}
                            style={row.height === null ? undefined : { height: row.height }}
                            className={`${row.height === null ? 'flex-1 min-h-0' : 'shrink-0'} pr-2 flex items-center justify-end`}
                        >
                            {row.key === 'fader' ? (
                                // The dB scale is printed once, down the side of
                                // the console, and read across every meter at
                                // once — as on the reference desk.
                                <div className="h-full w-full flex flex-col justify-between py-1 items-end">
                                    {FADER_SCALE.map(mark => (
                                        <span key={mark} className="text-[7px] leading-none text-studio-text-dim/60 tabular-nums">
                                            {mark}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-[8px] font-black uppercase tracking-tight text-studio-text-dim">
                                    {row.label}
                                </span>
                            )}
                        </div>
                    ))}
                </div>

                {filteredTracks.map(track => (
                    <TrackMixerChannelStrip
                        key={track.id}
                        track={track}
                        isSelected={track.id === focusedTrackId}
                        // Position in the project, not in the filtered view, so
                        // the number on a strip does not change when a filter
                        // hides the strips before it.
                        trackIndex={tracks.indexOf(track)}
                        longFaders={viewOptions.longFaders}
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

/**
 * How far Dim drops the monitor: -20 dB, the value Logic uses by default.
 * Applied to the output only, so the stored fader value is untouched.
 */
/** Icon per channel type, shown in the strip's icon row. */
const TRACK_GLYPH: Record<string, string> = {
    audio: '🎙', midi: '🎹', 'software-instrument': '🎹', drummer: '🥁',
    'external-midi': '🎛', bus: '🚌', folder: '📁', output: '🔊', video: '🎬',
};

const DIM_FACTOR = 0.1;

/**
 * Enough for a full channel strip.
 *
 * The fixed rows come to about 406px; the fader row takes whatever is left, so
 * anything much under this squeezes the fader down to a stub and the dB scale
 * beside it becomes unreadable. This leaves roughly 180px of fader travel.
 */
const MIXER_MIN_HEIGHT = 640;

interface MixerChannelStripProps {
    track: Track | null;
    isSelected: boolean;
    /** Position in the track list, for the number in the name row. */
    trackIndex?: number;
    /** View > Long Faders: a wider strip with more fader travel. */
    longFaders?: boolean;
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

function TrackMixerChannelStrip({ track, isSelected, trackIndex, longFaders, focusedTrackId }: { track: Track; isSelected: boolean; trackIndex: number; longFaders?: boolean; focusedTrackId: string | null }) {
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
            trackIndex={trackIndex}
            longFaders={longFaders}
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
    track, isSelected, trackIndex = 0, longFaders = false, onSelect, onUpdate, onAddPlugin, onTogglePlugin, setOpenPluginEditor,
    saveHistorySnapshot,
    isMaster = false, masterVolume = 0.8, masterPan = 0, masterMuted = false,
    toggleTrackFreeze, handleAction
}: MixerChannelStripProps) {
    const faderCapRef = useRef<HTMLDivElement>(null);
    // Dim is a monitor-only cut: it never touches the stored fader value, so
    // releasing it restores exactly the level that was set.
    const [dimmed, setDimmed] = useState(false);
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

    const analyser = isMaster
        ? audioEngine.getMasterAnalyzer()
        : (track ? (audioEngine.getTrackNodes(track.id)?.analyzer || null) : null);

    const gain = isMaster ? masterVolume : (track?.volume ?? 0.8);
    const tint = stripTint(track?.type, isMaster);

    const applyGain = (value: number) => {
        onUpdate({ volume: value });
        if (isMaster) audioEngine2.setMasterVolume(value);
        else if (track) audioEngine2.setTrackVolume(track.id, value);
        if (faderCapRef.current) faderCapRef.current.style.bottom = `${Math.min(100, value * 100)}%`;
    };

    const applyPan = (value: number) => {
        onUpdate({ pan: value });
        if (isMaster) audioEngine2.setMasterPan(value);
        else if (track) audioEngine2.setTrackPan(track.id, value);
    };

    /** Alt returns to unity; Shift drags four times finer. */
    const beginFaderDrag = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (e.altKey) { applyGain(1); saveHistorySnapshot(); return; }

        isDraggingRef.current = true;
        const startY = e.clientY;
        const startVol = gain;
        let latest = startVol;

        const onMove = (me: MouseEvent) => {
            const travel = me.shiftKey ? 720 : 180;
            let next = Math.max(0, Math.min(MAX_GAIN, startVol + (startY - me.clientY) / travel));
            // Snap to unity, the one landmark on the scale.
            if (Math.abs(next - 1) < 0.02) next = 1;
            latest = next;
            if (isMaster) audioEngine2.setMasterVolume(next);
            else if (track) audioEngine2.setTrackVolume(track.id, next);
        };

        // Audio follows every move; the cap is repainted once per frame.
        let raf: number | null = null;
        const onRafMove = (me: MouseEvent) => {
            onMove(me);
            if (raf === null && faderCapRef.current) {
                raf = requestAnimationFrame(() => {
                    raf = null;
                    if (faderCapRef.current) faderCapRef.current.style.bottom = `${Math.min(100, latest * 100)}%`;
                });
            }
        };

        const onUp = () => {
            isDraggingRef.current = false;
            if (raf !== null) cancelAnimationFrame(raf);
            applyGain(latest);
            saveHistorySnapshot();
            window.removeEventListener('mousemove', onRafMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onRafMove);
        window.addEventListener('mouseup', onUp);
    };

    /** Alt centres; Shift drags four times finer. */
    const beginPanDrag = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (e.altKey) { applyPan(0); saveHistorySnapshot(); return; }
        const startY = e.clientY;
        const startPan = initialPan;
        const onMove = (me: MouseEvent) => {
            const travel = me.shiftKey ? 400 : 100;
            let next = Math.max(-1, Math.min(1, startPan + (startY - me.clientY) / travel));
            if (Math.abs(next) < 0.05) next = 0;
            applyPan(next);
        };
        const onUp = () => {
            saveHistorySnapshot();
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    /* Every row is rendered at the height the shared spec gives it, so the
     * legend column on the left lines up with the slot it names on every
     * strip. That alignment is the whole point of a console layout. */
    const rows: Record<string, React.ReactNode> = {
        setting: <ChannelStripSettingButton track={track} isMaster={isMaster} />,

        // Reads the gain reduction of the first compressor. Nothing exposes
        // that yet, so the slot is drawn empty and says why rather than
        // animating something invented.
        gainReduction: (
            <div className="h-full rounded-[2px] bg-black/40 border border-white/5"
                title="Gain reduction is not reported by the plug-ins yet" />
        ),

        eq: (
            <div className="h-full rounded-[2px] bg-black/60 border border-white/5 overflow-hidden group/eq">
                <svg viewBox="0 0 100 34" className="w-full h-full opacity-40 group-hover/eq:opacity-70 transition-opacity">
                    <path d="M0,22 Q30,4 60,26 T100,17" fill="none" stroke={tint} strokeWidth="1.5" />
                </svg>
            </div>
        ),

        // Was a dead label. `engine/midi/fx` holds working processors that
        // nothing imported, so this slot is the first way to reach them.
        midiFx: (
            <MidiFxMenu
                inserted={(track?.midiFx ?? null) as MidiFxId | null}
                recordOutput={!!track?.recordMidiFxOutput}
                disabled={isMaster || !track || !isMidiTrackType(track.type)}
                onSelect={(id) => track && onUpdate({ midiFx: id } as Partial<Track>)}
                onToggleRecordOutput={() => track && onUpdate({ recordMidiFxOutput: !track.recordMidiFxOutput } as Partial<Track>)}
            />
        ),

        input: (
            <div className="h-full flex items-center gap-0.5">
                {!isMaster && track && <ChannelModeButton track={track} />}
                <div
                    className="h-full flex-1 min-w-0 rounded-[2px] border flex items-center justify-center px-1 text-[8px] font-black truncate"
                    style={{ background: `${tint}22`, borderColor: `${tint}66`, color: tint }}
                    title={isMaster ? 'Summed output' : (track?.instrument || 'Input 1')}
                >
                    {isMaster ? 'Sum' : (track?.instrument || 'In 1')}
                </div>
            </div>
        ),

        audioFx: (
            <div className="h-full flex flex-col gap-px overflow-y-auto no-scrollbar">
                {fxChain.map((plugin: any) => (
                    <div
                        key={plugin.id}
                        onClick={(e) => { e.stopPropagation(); if (track) setOpenPluginEditor({ trackId: track.id, pluginId: plugin.id }); }}
                        title={plugin.name}
                        className={`h-[13px] shrink-0 rounded-[2px] flex items-center px-1 text-[8px] font-black cursor-pointer truncate transition-all ${plugin.enabled
                            ? 'bg-accent-cyan/80 text-black hover:bg-accent-cyan'
                            : 'bg-studio-panel text-studio-text-dim opacity-60'}`}
                    >
                        {plugin.name}
                    </div>
                ))}
                <PluginMenu
                    onSelect={(type) => addToChain(type)}
                    onBrowse={() => {
                        const id = isMaster ? null : track?.id;
                        if (id) useProjectStore.getState().setPluginBrowserTrack(id, 'effect');
                    }}
                />
            </div>
        ),

        sends: <div className="h-full overflow-hidden"><SendsSlot track={track} /></div>,
        output: <div className="h-full"><OutputRouting track={track} isMaster={isMaster} /></div>,
        group: <div className="h-full"><GroupSlot track={track} /></div>,

        automation: !isMaster && track
            ? <AutomationModeButton track={track} />
            : <div className="h-full rounded-[2px] bg-black/40 border border-white/5" />,

        icon: (
            <div className="h-full flex items-center justify-center">
                <div
                    className="w-6 h-6 rounded-[3px] flex items-center justify-center text-[12px] leading-none"
                    style={{ background: `${tint}30`, border: `1px solid ${tint}80` }}
                    aria-hidden
                >
                    {isMaster ? '🔊' : (TRACK_GLYPH[track?.type ?? 'audio'] ?? '🎚')}
                </div>
            </div>
        ),

        pan: (
            <div className="h-full flex flex-col items-center justify-center gap-0.5">
                <div className="relative cursor-ns-resize" onMouseDown={beginPanDrag} title="Pan — Alt-click to centre, Shift-drag for fine">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-studio-sunken via-studio-raised to-studio-control border border-studio-line shadow-md ring-1 ring-black/50">
                        <div
                            className="absolute top-0.5 left-[11px] w-[2px] h-2 bg-studio-text-mid rounded-full origin-bottom"
                            style={{ transform: `rotate(${initialPan * 45}deg)` }}
                        />
                    </div>
                </div>
                <PanField pan={initialPan} onCommit={(value) => { applyPan(value); saveHistorySnapshot(); }} />
            </div>
        ),

        vca: !isMaster && track
            ? <VcaSlot track={track} />
            : <div className="h-full rounded-[2px] bg-black/40 border border-white/5" />,

        db: (
            <div className="h-full flex items-center gap-0.5">
                <LevelField gain={gain} onCommit={(value) => { applyGain(value); saveHistorySnapshot(); }} className="flex-1" />
                <PeakDisplay analyzer={analyser} className="flex-1" />
            </div>
        ),

        fader: (
            <div className="h-full flex items-end justify-center gap-1 pb-1">
                <div className="h-full w-1.5"><VerticalMeter analyzer={analyser} side="L" className="w-full h-full" /></div>

                <div className="h-full w-5 bg-black/50 rounded-sm border border-studio-line relative cursor-ns-resize">
                    <div className="absolute inset-y-1 inset-x-1 flex flex-col justify-between opacity-10 pointer-events-none">
                        {Array.from({ length: 12 }).map((_, i) => <div key={i} className="w-full h-px bg-white" />)}
                    </div>
                    <div
                        ref={faderCapRef}
                        onMouseDown={beginFaderDrag}
                        title="Volume — Alt-click for unity, Shift-drag for fine"
                        className="absolute -left-0.5 w-6 h-3.5 bg-gradient-to-b from-studio-control to-studio-raised border border-studio-line-strong rounded-[2px] shadow-[0_3px_8px_rgba(0,0,0,0.8)] z-20 flex items-center justify-center"
                    >
                        <div className="w-[70%] h-px bg-white/25" />
                    </div>
                </div>

                {/* Stereo draws two columns; every other format is one signal
                    and draws one, which is what Channel Mode is telling you. */}
                {(isMaster || (track?.channelMode ?? 'stereo') === 'stereo') && (
                    <div className="h-full w-1.5"><VerticalMeter analyzer={analyser} side="R" className="w-full h-full" /></div>
                )}
            </div>
        ),

        recordMonitor: isMaster
            ? (
                <OutputStripButtons
                    dimmed={dimmed}
                    onToggleDim={() => {
                        const next = !dimmed;
                        setDimmed(next);
                        audioEngine2.setMasterVolume(next ? masterVolume * DIM_FACTOR : masterVolume);
                    }}
                    onBounce={() => useProjectStore.getState().toggleExportDialog('all')}
                />
            )
            : track
                ? (
                    <RecordMonitorButtons
                        recordEnabled={!!track.recordEnabled}
                        inputMonitoring={!!track.inputMonitoring}
                        disabled={track.type === 'bus' || track.type === 'output'}
                        onToggleRecord={() => onUpdate({ recordEnabled: !track.recordEnabled } as Partial<Track>)}
                        onToggleMonitor={() => onUpdate({ inputMonitoring: !track.inputMonitoring } as Partial<Track>)}
                    />
                )
                : null,

        muteSolo: (
            <div className="h-full flex gap-0.5 px-1">
                <button
                    id={track ? `mixer-mute-${track.id}` : 'mixer-mute-master'}
                    title="Mute - Cmd-click to switch every strip in the same state"
                    aria-label="Mute"
                    aria-pressed={initialMuted}
                    data-mute-button
                    onClick={(e) => {
                        e.stopPropagation();
                        const next = !initialMuted;
                        if (e.metaKey || e.ctrlKey) {
                            const store = useProjectStore.getState();
                            store.saveHistorySnapshot();
                            store.tracks.filter(t => !!t.muted === initialMuted).forEach(t => {
                                store.updateTrack(t.id, { muted: next });
                                if (next) audioEngine2.muteTrack(t.id); else audioEngine2.unmuteTrack(t.id);
                            });
                            store.updateProjectSettings({ masterMuted: next });
                            audioEngine2.setMasterMuted(next);
                            return;
                        }
                        onUpdate({ muted: next });
                        if (isMaster) audioEngine2.setMasterMuted(next);
                        else if (track) { if (next) audioEngine2.muteTrack(track.id); else audioEngine2.unmuteTrack(track.id); }
                    }}
                    className={`flex-1 rounded-[2px] border text-[9px] font-black transition-all active:scale-95 ${initialMuted
                        ? 'bg-[#ff4d4d]/25 border-[#ff4d4d] text-[#ff4d4d]'
                        : 'bg-studio-panel border-studio-line text-studio-text-dim hover:text-studio-text'}`}
                >M</button>

                <button
                    id={track ? `mixer-solo-${track.id}` : 'mixer-solo-master'}
                    title={isMaster ? 'Dim' : 'Solo - Alt-click to solo only this strip, Ctrl-click for solo-safe'}
                    aria-label={isMaster ? 'Dim' : 'Solo'}
                    aria-pressed={isMaster ? dimmed : !!track?.soloed}
                    data-solo-button
                    data-solo-safe={track?.soloSafe || undefined}
                    onClick={(e) => {
                        e.stopPropagation();
                        // The output strip carries Dim where a track carries
                        // Solo, exactly as in the reference console.
                        if (isMaster) {
                            const next = !dimmed;
                            setDimmed(next);
                            audioEngine2.setMasterVolume(next ? masterVolume * DIM_FACTOR : masterVolume);
                            return;
                        }
                        if (!track) return;
                        const store = useProjectStore.getState();
                        if (e.ctrlKey && !e.metaKey) {
                            store.updateTrack(track.id, { soloSafe: !track.soloSafe } as Partial<Track>);
                            return;
                        }
                        if (e.altKey) {
                            store.saveHistorySnapshot();
                            store.tracks.forEach(t => {
                                const on = t.id === track.id;
                                if (!!t.soloed === on) return;
                                store.updateTrack(t.id, { soloed: on });
                                if (on) audioEngine2.soloTrack(t.id); else audioEngine2.unsoloTrack(t.id);
                            });
                            return;
                        }
                        const next = !track.soloed;
                        onUpdate({ soloed: next });
                        if (next) audioEngine2.soloTrack(track.id); else audioEngine2.unsoloTrack(track.id);
                    }}
                    className={`relative flex-1 rounded-[2px] border text-[9px] font-black transition-all active:scale-95 ${(isMaster ? dimmed : track?.soloed)
                        ? 'bg-[#ffc500]/25 border-[#ffc500] text-[#ffc500]'
                        : 'bg-studio-panel border-studio-line text-studio-text-dim hover:text-studio-text'}`}
                >
                    {isMaster ? 'D' : 'S'}
                    {track?.soloSafe && (
                        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="w-3 h-px bg-[#ff4d4d] rotate-[-45deg]" />
                        </span>
                    )}
                </button>
            </div>
        ),

        name: (
            <div
                className="h-full flex items-center justify-center px-1 text-[8px] font-black uppercase truncate tracking-tight"
                style={{ background: tint, color: '#04070b' }}
                title={isMaster ? 'Master' : track?.name}
                onDoubleClick={(e) => {
                    if (isMaster || !track) return;
                    e.stopPropagation();
                    const name = window.prompt('Track name', track.name);
                    if (name && name.trim()) useProjectStore.getState().updateTrack(track.id, { name: name.trim() });
                }}
                data-track-name-field
            >
                {isMaster ? 'Master' : (track?.name || 'Track')}
            </div>
        ),
    };

    return (
        <div
            onClick={onSelect}
            style={{ width: longFaders ? STRIP_WIDTH * 1.5 : STRIP_WIDTH }}
            className={`h-full flex flex-col border-r border-black shrink-0 transition-colors relative group ${isSelected ? 'bg-accent-cyan/[0.06]' : 'bg-studio-panel/60 hover:bg-white/[0.02]'}`}
        >
            {isSelected && <div className="absolute inset-x-0 top-0 h-0.5 bg-accent-cyan z-10 shadow-[0_0_10px_var(--accent-cyan-glow)]" />}
            {STRIP_ROWS.map((row: StripRow) => (
                <div
                    key={row.key}
                    data-strip-row={row.key}
                    style={row.height === null ? undefined : { height: row.height }}
                    className={`${row.height === null ? 'flex-1 min-h-0' : 'shrink-0'} px-1 ${row.key === 'name' ? 'px-0' : ''}`}
                >
                    {rows[row.key] ?? null}
                </div>
            ))}
        </div>
    );
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
