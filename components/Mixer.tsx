"use client"
import { useState } from "react"
import { useProjectStore } from "@/store/projectStore"
import { Track } from "@/models/Track"
import {
    ChevronDown, Filter, MoreHorizontal,
    Settings2, Sliders, LayoutList,
    Circle, Volume2, Music, Mic, Keyboard,
    Plus, Power
} from "lucide-react"

export function Mixer() {
    const {
        showMixer, tracks, focusedTrackId,
        selectTrack, updateTrack, addPlugin, togglePlugin
    } = useProjectStore()

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

    return (
        <div className="h-full flex flex-col bg-[#1a1a1a] select-none text-gray-400 border-t border-black shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
            {/* 1. Mixer Command Header (High Fidelity Menu Bar) */}
            <div className="h-9 bg-[#222] border-b border-black flex items-center px-4 justify-between shrink-0">
                <div className="flex items-center gap-1">
                    <div className="flex items-center gap-1.5 bg-[#000] border border-[#333] rounded px-2.5 h-7 cursor-pointer hover:border-gray-500 transition-colors group">
                        <span className="text-[10px] font-black text-gray-400 group-hover:text-white uppercase tracking-tighter">Edit</span>
                        <ChevronDown className="w-3 h-3 text-gray-600" />
                    </div>
                    <div className="flex items-center gap-1.5 bg-[#000] border border-[#333] rounded px-2.5 h-7 cursor-pointer hover:border-gray-500 transition-colors group">
                        <span className="text-[10px] font-black text-gray-400 group-hover:text-white uppercase tracking-tighter">Options</span>
                        <ChevronDown className="w-3 h-3 text-gray-600" />
                    </div>
                    <div className="flex items-center gap-1.5 bg-[#000] border border-[#333] rounded px-2.5 h-7 cursor-pointer hover:border-gray-500 transition-colors group">
                        <span className="text-[10px] font-black text-gray-400 group-hover:text-white uppercase tracking-tighter">View</span>
                        <ChevronDown className="w-3 h-3 text-gray-600" />
                    </div>

                    <div className="w-px h-5 bg-[#333] mx-2"></div>

                    <div className="flex bg-[#000] rounded-md border border-[#333] p-0.5 h-7 shadow-inner">
                        <button
                            onClick={() => setMixerMode('single')}
                            className={`px-3 h-full text-[10px] font-black uppercase rounded transition-all ${mixerMode === 'single' ? 'text-sky-400 bg-[#333] shadow-md border border-[#444]' : 'text-gray-500 hover:text-white'}`}
                        >Single</button>
                        <button
                            onClick={() => setMixerMode('tracks')}
                            className={`px-3 h-full text-[10px] font-black uppercase rounded transition-all ${mixerMode === 'tracks' ? 'text-sky-400 bg-[#333] shadow-md border border-[#444]' : 'text-gray-500 hover:text-white'}`}
                        >Tracks</button>
                        <button
                            onClick={() => setMixerMode('all')}
                            className={`px-3 h-full text-[10px] font-black uppercase rounded transition-all ${mixerMode === 'all' ? 'text-sky-400 bg-[#333] shadow-md border border-[#444]' : 'text-gray-500 hover:text-white'}`}
                        >All</button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-[#000] rounded-md border border-[#333] p-0.5 h-7">
                        {filterTypes.map(type => (
                            <button
                                key={type}
                                onClick={() => setTrackTypeFilter(type as any)}
                                className={`px-2.5 h-full text-[9px] font-black uppercase rounded transition-all ${trackTypeFilter === type ? 'text-sky-400 bg-[#333]' : 'text-gray-500 hover:text-white'}`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                    <div className="w-px h-5 bg-[#333] mx-1"></div>
                    <button
                        onClick={() => setShowTrackStacks(!showTrackStacks)}
                        className={`p-1 rounded transition-all ${showTrackStacks ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                        title="Show/Hide track stacks"
                    >
                        {showTrackStacks ? 'Stacks On' : 'Stacks Off'}
                    </button>
                    <button className="p-1 hover:bg-white/5 rounded transition-all"><MoreHorizontal className="w-4 h-4 text-gray-500" /></button>
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
                    <MixerChannelStrip
                        key={track.id}
                        track={track}
                        isSelected={track.id === focusedTrackId}
                        onSelect={() => selectTrack(track.id)}
                        onUpdate={(updates) => updateTrack(track.id, updates)}
                        onAddPlugin={(type) => addPlugin(track.id, type)}
                        onTogglePlugin={(pid) => togglePlugin(track.id, pid)}
                    />
                ))}

                {/* Master Output Strip */}
                <MixerChannelStrip
                    track={null}
                    isMaster
                    isSelected={false}
                    onSelect={() => { }}
                    onUpdate={() => { }}
                    onAddPlugin={() => { }}
                    onTogglePlugin={() => { }}
                />
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
    const {
        channelStripSettings,
        channelStripCopyBuffer,
        loadChannelStripSetting,
        chooseNextChannelStripSetting,
        choosePreviousChannelStripSetting,
        copyChannelStripSetting,
        pasteChannelStripSetting,
        pasteChannelStripPluginsOnly,
        pasteChannelStripSendsOnly,
        removeAllChannelStripPlugins,
        removeEmptyInsertSlots,
        removeBypassedPlugins,
        removeAllChannelStripSends,
        resetChannelStrip,
        saveChannelStripSetting,
        deleteChannelStripSetting,
        saveChannelStripPerformance,
        channelStripPerformances,
        loadChannelStripPerformance
    } = useProjectStore();

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
            {open && !isMaster && (
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
                                    <button className="text-[9px] text-gray-300 hover:text-white truncate" onClick={(e) => { e.stopPropagation(); setOpen(false); loadChannelStripSetting(track!.id, s.id); }}>{s.name}</button>
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
                                    <button className="text-[9px] text-gray-300 hover:text-white truncate" onClick={(e) => { e.stopPropagation(); setOpen(false); loadChannelStripPerformance(track!.id, p.program); }}>PC {p.program} - {p.name}</button>
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
    onSelect: () => void;
    onUpdate: (updates: Partial<Track>) => void;
    onAddPlugin: (type: 'comp' | 'eq' | 'reverb' | 'delay') => void;
    onTogglePlugin: (pid: string) => void;
    isMaster?: boolean;
}

function MixerChannelStrip({ track, isSelected, onSelect, onUpdate, onAddPlugin, onTogglePlugin, isMaster = false }: MixerChannelStripProps) {
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
                <div className="flex flex-col gap-0.5 h-[100px] mb-1">
                    {track?.plugins.map((p: any) => (
                        <div
                            key={p.id}
                            onClick={(e) => { e.stopPropagation(); onTogglePlugin(p.id); }}
                            className={`h-5 rounded-sm flex items-center px-2 text-[9px] font-black shadow-sm border-t border-white/10 cursor-pointer hover:brightness-125 transition-all ${p.enabled ? (p.name.includes('EQ') ? 'bg-sky-500 text-white shadow-[0_0_10px_rgba(14,165,233,0.3)]' : 'bg-sky-600 text-white') : 'bg-gray-800 text-gray-500 opacity-60'}`}
                        >
                            <Power className={`w-2 h-2 mr-1.5 ${p.enabled ? 'text-white' : 'text-gray-600'}`} fill="currentColor" />
                            <span className="truncate">{p.name}</span>
                        </div>
                    ))}

                    {track && track.plugins.length < 5 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onAddPlugin('comp'); }}
                            className="h-5 bg-black/20 rounded-sm border border-white/5 text-[8px] font-black text-gray-700 hover:text-gray-400 uppercase flex items-center justify-center transition-colors"
                        >
                            Audio FX
                        </button>
                    )}
                </div>

                {/* Sends Slot */}
                <div className="flex flex-col gap-0.5 h-16 mb-2">
                    <div className="h-5 bg-sky-500/10 border border-sky-400/20 rounded-sm flex items-center px-1.5 justify-between opacity-50 hover:opacity-100 transition-opacity">
                        <span className="text-[8px] font-black text-sky-400 uppercase">Bus 1</span>
                        <div className="w-2 h-2 rounded-full bg-sky-500 shadow-sm"></div>
                    </div>
                    <button className="h-4 bg-black/10 rounded-sm border border-white/5 text-[7px] font-black text-gray-700 flex items-center justify-center uppercase">Sends</button>
                </div>

                {/* Output Routing */}
                <div className="h-6 bg-[#252525] border border-white/5 rounded-sm flex items-center px-2 justify-between text-[9px] font-black text-gray-400 shadow-sm mb-1 group-hover:border-gray-500 transition-colors">
                    <span className="truncate uppercase">{isMaster ? 'Output' : (track?.outputBusId || 'Stereo Out')}</span>
                    <ChevronDownSmall className="w-2.5 h-2.5 text-gray-600" />
                </div>

                <div className="h-6 bg-black/40 border border-white/5 rounded-sm flex items-center justify-center text-[9px] font-black text-gray-600 uppercase mb-1">None</div>

                <div className="h-6 bg-black/60 border border-sky-500/20 rounded-sm flex items-center justify-center text-[9px] font-black text-[#63ed63] uppercase mb-4 shadow-inner">Read</div>

                {/* Fader & Metering Area */}
                <div className="flex-1 flex flex-col items-center justify-end pb-4 gap-3">
                    {/* Pan Knob */}
                    <div className="relative group/pan cursor-pointer">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#111] via-[#222] to-[#3a3a3a] border border-[#333] shadow-xl relative ring-1 ring-black/50">
                            <div className="absolute top-1 left-[16.5px] w-[2px] h-3 bg-gray-500 rounded-full origin-bottom rotate-0 transition-transform duration-200"></div>
                        </div>
                        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-black text-gray-600 group-hover/pan:text-sky-400 uppercase">Pan</span>
                    </div>

                    {/* Fader Stack */}
                    <div className="flex gap-2 items-end h-[180px]">
                        {/* Peak Meter (Left) */}
                        <div className="h-full w-2 bg-black/80 rounded border border-white/5 relative overflow-hidden group-hover:border-white/10">
                            <div className="absolute bottom-0 w-full bg-gradient-to-t from-green-500 via-green-400 to-yellow-400 shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all duration-75" style={{ height: isMaster ? '75%' : '45%' }}></div>
                            <div className="absolute top-0 w-full h-px bg-red-500/50 opacity-20"></div>
                        </div>

                        {/* Fader Track */}
                        <div className="h-full w-6 bg-black/40 rounded border border-[#2a2a2a] relative group/fader cursor-ns-resize">
                            {/* Fader Markings */}
                            <div className="absolute inset-y-2 inset-x-1 flex flex-col justify-between opacity-10 py-1 pointer-events-none">
                                {[...Array(15)].map((_, i) => <div key={i} className="w-full h-px bg-white"></div>)}
                            </div>

                            {/* Fader Cap */}
                            <div
                                className="absolute -left-1 w-8 h-4 bg-gradient-to-b from-[#444] to-[#222] border border-[#555] rounded shadow-[0_4px_10px_rgba(0,0,0,0.8)] z-20 flex items-center justify-center"
                                style={{ bottom: `${(track?.volume || 0.8) * 100}%` }}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    const startY = e.clientY;
                                    const startVol = track?.volume || 0.8;
                                    const onMove = (me: MouseEvent) => {
                                        const delta = (startY - me.clientY) / 200;
                                        onUpdate({ volume: Math.max(0, Math.min(1, startVol + delta)) });
                                    }
                                    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
                                    window.addEventListener('mousemove', onMove);
                                    window.addEventListener('mouseup', onUp);
                                }}
                            >
                                <div className="w-[80%] h-px bg-white/20"></div>
                            </div>
                        </div>

                        {/* Peak Meter (Right) */}
                        <div className="h-full w-2 bg-black/80 rounded border border-white/5 relative overflow-hidden group-hover:border-white/10">
                            <div className="absolute bottom-0 w-full bg-gradient-to-t from-green-500 via-green-400 to-yellow-400 shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all duration-75" style={{ height: isMaster ? '74%' : '44%' }}></div>
                        </div>
                    </div>

                    {/* M/S Commands */}
                    <div className="flex gap-1.5 h-7 w-full px-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); onUpdate({ muted: !track?.muted }); }}
                            className={`flex-1 border rounded-md text-[10px] font-black transition-all transform active:scale-95 ${track?.muted ? 'bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'bg-[#1a1a1a] border-[#333] text-gray-600 hover:text-gray-400 group-hover:border-gray-700'}`}
                        >M</button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onUpdate({ soloed: !track?.soloed }); }}
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
}

function ChevronDownSmall({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 100 100" className={className} fill="currentColor">
            <polygon points="20,40 80,40 50,70" />
        </svg>
    )
}
