"use client"
import { useState } from "react"
import { useProjectStore } from "@/store/projectStore"
import {
    ChevronDown, ChevronRight,
    ChevronUp, Settings2, Sliders,
    MoreHorizontal, Circle, MousePointer2,
    Keyboard, Drum, Mic, Speaker
} from "lucide-react"

export function Inspector() {
    const {
        focusedTrackId, tracks, clips, selectedClipId,
        showInspector, updateTrack, updateClip,
        setInternalMidiIn, setInternalMidiInRecordMode
    } = useProjectStore()

    const track = tracks.find(t => t.id === focusedTrackId)
    const clip = clips.find(c => c.id === selectedClipId)

    const [regionOpen, setRegionOpen] = useState(true)
    const [trackOpen, setTrackOpen] = useState(true)

    if (!showInspector) return null

    if (!track) {
        return (
            <div className="w-[280px] bg-[#1a1a1a] border-r border-black flex flex-col items-center justify-center text-gray-700 shrink-0 z-40">
                <span className="text-[10px] uppercase font-black tracking-widest">No Track Selected</span>
            </div>
        )
    }

    const handleTrackUpdate = (field: keyof Track, value: any) => {
        if (!focusedTrackId) return
        updateTrack(focusedTrackId, { [field]: value })
    }

    const handleClipUpdate = (field: string, value: any) => {
        if (!selectedClipId) return
        updateClip(selectedClipId, { [field]: value })
    }

    return (
        <div className="w-[280px] bg-[#1a1a1a] border-r border-black flex flex-col shrink-0 select-none overflow-y-auto custom-scrollbar-v z-40">
            {/* 1. Region Inspector Section (Professional Logic Implementation) */}
            <div className="flex flex-col border-b border-black/40">
                <div
                    onClick={() => setRegionOpen(!regionOpen)}
                    className="h-9 px-3 flex items-center gap-2 hover:bg-white/[0.03] cursor-pointer transition-colors bg-[#252525]/30"
                >
                    {regionOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
                    <span className="text-[11px] font-bold text-gray-400">Region:</span>
                    <span className="text-[11px] font-black text-white/90 truncate">{clip ? clip.name : "Analog Bass"}</span>
                </div>

                {regionOpen && clip && (
                    <div className="flex flex-col py-1 bg-[#161616]/50">
                        <InspectorField label="Mute" type="checkbox" checked={clip.muted} onChange={(v: boolean) => handleClipUpdate('muted', v)} />
                        <InspectorField label="Loop" type="checkbox" checked={clip.loop} onChange={(v: boolean) => handleClipUpdate('loop', v)} />
                        <InspectorField label="Quantize" value={clip.quantize || "Off"} hasChevron />
                        <InspectorField label="Q-Swing" value={`${clip.qSwing || 0}%`} />
                        <InspectorField
                            label="Transpose"
                            value={clip.transpose ? (clip.transpose > 0 ? `+${clip.transpose}` : clip.transpose) : "0"}
                            hasChevron
                            onUpdate={(inc: number) => handleClipUpdate('transpose', (clip.transpose || 0) + inc)}
                        />
                        <InspectorField label="Pitch Source" value={clip.pitchSource || "Off"} hasChevron />                        <InspectorField label="Flex Enabled" type="checkbox" checked={clip.flexEnabled || false} onChange={(v: boolean) => handleClipUpdate('flexEnabled', v)} />
                        <InspectorField label="Flex Mode">
                            <select
                                className="bg-transparent text-[11px] font-black text-gray-200 outline-none cursor-pointer text-right w-[140px] appearance-none"
                                value={clip.flexMode || 'off'}
                                onChange={(e) => handleClipUpdate('flexMode', e.target.value as any)}
                            >
                                <option value="off">Off</option>
                                <option value="time">Flex Time</option>
                                <option value="pitch">Flex Pitch</option>
                                <option value="time+pitch">Time + Pitch</option>
                            </select>
                        </InspectorField>
                        <InspectorField label="Flex Time Factor">
                            <input
                                type="range"
                                min={0.25}
                                max={4}
                                step={0.05}
                                value={clip.flexTimeFactor || 1}
                                onChange={(e) => handleClipUpdate('flexTimeFactor', parseFloat(e.target.value))}
                                className="w-[140px]"
                            />
                            <span className="text-[11px] font-black text-gray-200">{(clip.flexTimeFactor || 1).toFixed(2)}x</span>
                        </InspectorField>
                        <InspectorField
                            label="Flex Pitch Offset"
                            value={clip.flexPitchOffset ? (clip.flexPitchOffset > 0 ? `+${clip.flexPitchOffset}` : clip.flexPitchOffset) : "0"}
                            hasChevron
                            onUpdate={(inc: number) => handleClipUpdate('flexPitchOffset', (clip.flexPitchOffset || 0) + inc)}
                        />                        <InspectorField
                            label="Velocity Offset"
                            value={clip.velocityOffset ? (clip.velocityOffset > 0 ? `+${clip.velocityOffset}` : clip.velocityOffset) : "0"}
                            onUpdate={(inc: number) => handleClipUpdate('velocityOffset', (clip.velocityOffset || 0) + inc * 5)}
                        />
                        <div className="px-6 py-1 flex items-center gap-1 cursor-pointer group">
                            <ChevronRight className="w-3 h-3 text-gray-600 group-hover:text-gray-400" />
                            <span className="text-[9px] font-black text-gray-500 group-hover:text-gray-400 uppercase">More</span>
                        </div>
                    </div>
                )}
            </div>

            {/* 2. Track Inspector Section (Professional Logic Implementation) */}
            <div className="flex flex-col border-b border-black/40">
                <div
                    onClick={() => setTrackOpen(!trackOpen)}
                    className="h-9 px-3 flex items-center gap-2 hover:bg-white/[0.03] cursor-pointer transition-colors bg-[#252525]/30"
                >
                    {trackOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
                    <span className="text-[11px] font-bold text-gray-400">Track:</span>
                    <span className="text-[11px] font-black text-white/90 truncate">{track.name}</span>
                </div>

                {trackOpen && (
                    <div className="flex flex-col py-2 bg-[#161616]/50">
                        <InspectorField label="Icon">
                            <div className="w-10 h-10 border border-[#63ed63]/40 rounded bg-black/40 flex items-center justify-center shadow-lg">
                                {track.type === 'midi' ? <Keyboard className="w-6 h-6 text-[#63ed63] opacity-80" /> : <Mic className="w-6 h-6 text-sky-400 opacity-80" />}
                            </div>
                        </InspectorField>
                        <InspectorField label="Channel" value={track.channel || "Inst 1"} hasChevron />
                        <InspectorField label="MIDI Input" value={track.midiInput || "All"} hasChevron />
                        <InspectorField label="Channel" value={track.channel || "Inst 1"} hasChevron />
                        <InspectorField label="MIDI Input" value={track.midiInput || "All"} hasChevron />
                        
                        {/* Internal MIDI In Section */}
                        <div className="flex flex-col border-y border-white/5 my-1 py-1 bg-black/10">
                            <InspectorField label="Internal MIDI In">
                                <select 
                                    className="bg-transparent text-[11px] font-black text-gray-200 outline-none cursor-pointer text-right w-[140px] appearance-none"
                                    value={track.internalMidiInSourceId || ""}
                                    onChange={(e) => {
                                        const sourceId = e.target.value || undefined;
                                        setInternalMidiIn(track.id, sourceId, sourceId ? 'Instrument Input' : 'Off');
                                    }}
                                >
                                    <option value="" className="bg-[#1a1a1a]">Off</option>
                                    <optgroup label="Instrument Input" className="bg-[#1a1a1a]">
                                        {tracks.filter(t => t.id !== track.id && (t.type === 'software-instrument' || t.type === 'midi')).map(t => (
                                            <option key={t.id} value={t.id} className="bg-[#1a1a1a]">{t.name}</option>
                                        ))}
                                    </optgroup>
                                </select>
                            </InspectorField>

                            {track.internalMidiInSourceId && (
                                <>
                                    <InspectorField label="Record">
                                        <select 
                                            className="bg-transparent text-[11px] font-black text-sky-400 outline-none cursor-pointer text-right w-[140px] appearance-none"
                                            value={track.internalMidiInRecordMode || "Internal Only"}
                                            onChange={(e) => setInternalMidiInRecordMode(track.id, e.target.value as any)}
                                        >
                                            <option value="Internal Only" className="bg-[#1a1a1a]">Internal Only</option>
                                            <option value="Internal + External" className="bg-[#1a1a1a]">Int + External</option>
                                        </select>
                                    </InspectorField>
                                </>
                            )}
                        </div>

                        <InspectorField label="MIDI In Channel">
                            <select 
                                className="bg-transparent text-[11px] font-black text-gray-200 outline-none cursor-pointer text-right appearance-none"
                                value={track.midiInChannel || "All"}
                                onChange={(e) => handleTrackUpdate('midiInChannel', e.target.value === 'All' ? 'All' : Number(e.target.value))}
                            >
                                <option value="All" className="bg-[#1a1a1a]">All</option>
                                {Array.from({length: 16}).map((_, i) => (
                                    <option key={i+1} value={i+1} className="bg-[#1a1a1a]">{i+1}</option>
                                ))}
                            </select>
                        </InspectorField>
                        <InspectorField label="MIDI Out Chan..." value={track.midiOutChannel || "All"} hasChevron />
                        {(track.type === 'software-instrument' || track.type === 'drummer') && (
                            <InspectorField
                                label="Def. Region Type"
                                value={track.defaultRegionType === 'pattern' ? 'Pattern' : track.defaultRegionType === 'session-player' ? 'Session Player' : 'MIDI'}
                                hasChevron
                            />
                        )}
                        <InspectorField
                            label="Transpose"
                            value={track.transpose ? (track.transpose > 0 ? `+${track.transpose}` : track.transpose) : "0"}
                            hasChevron
                            onUpdate={(inc: number) => handleTrackUpdate('transpose', (track.transpose || 0) + inc)}
                        />
                        <InspectorField
                            label="Velocity Offset"
                            value={track.velocityOffset ? (track.velocityOffset > 0 ? `+${track.velocityOffset}` : track.velocityOffset) : "0"}
                            onUpdate={(inc: number) => handleTrackUpdate('velocityOffset', (track.velocityOffset || 0) + inc * 5)}
                        />
                        <InspectorField label="Key Limit" value={`${track.keyLimit?.[0] || 'C-2'} ${track.keyLimit?.[1] || 'G8'}`} />
                        <InspectorField label="Velocity Limit" value={`${track.velocityLimit?.[0] || '1'} ${track.velocityLimit?.[1] || '127'}`} />
                        <InspectorField label="Delay" value={`${track.delay || 0} ms`} hasChevron onUpdate={(inc: number) => handleTrackUpdate('delay', (track.delay || 0) + inc)} />
                        {track.type === 'midi' && (
                            <InspectorField label="No Transpose" type="checkbox" checked={track.noTranspose || false} onChange={(v: boolean) => handleTrackUpdate('noTranspose', v)} />
                        )}
                    </div>
                )}
            </div>

            {/* 3. Dual Channel Strips Area */}
            <div className="flex-1 flex bg-[#1a1a1a] min-h-0">
                <InspectorChannelStrip track={track} />
                <InspectorChannelStrip track={null} isOutput />
            </div>

            <style jsx>{`
                .custom-scrollbar-v::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar-v::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar-v::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
            `}</style>
        </div>
    )
}

interface InspectorFieldProps {
    label: string;
    value?: string | number;
    children?: React.ReactNode;
    hasChevron?: boolean;
    type?: 'text' | 'checkbox';
    checked?: boolean;
    onChange?: (val: boolean) => void;
    onUpdate?: (inc: number) => void;
}

function InspectorField({ label, value, children, hasChevron, type = 'text', checked, onChange, onUpdate }: InspectorFieldProps) {
    return (
        <div className="flex items-center justify-between px-6 h-6 leading-none group hover:bg-white/[0.02]">
            <span className="text-[11px] font-bold text-gray-500 group-hover:text-gray-400 truncate pr-2">{label}:</span>
            <div className="flex items-center gap-1 cursor-pointer shrink-0">
                {children}
                {!children && type === 'text' && (
                    <>
                        <span className="text-[11px] font-black text-gray-200 tabular-nums">{value}</span>
                        {hasChevron && (
                            <div className="flex flex-col -gap-1 opacity-40 group-hover:opacity-80">
                                <button onClick={(e) => { e.stopPropagation(); onUpdate?.(1); }}><ChevronUpSmall className="w-2 h-2" /></button>
                                <button onClick={(e) => { e.stopPropagation(); onUpdate?.(-1); }}><ChevronDownSmall className="w-2 h-2" /></button>
                            </div>
                        )}
                    </>
                )}
                {!children && type === 'checkbox' && (
                    <div
                        onClick={() => onChange?.(!checked)}
                        className={`w-3 h-3 border border-gray-700 rounded-sm transition-colors ${checked ? 'bg-sky-500 border-sky-400' : 'bg-black/40'}`}
                    ></div>
                )}
            </div>
        </div>
    )
}

import { Track } from "@/models/Track";

function InspectorChannelStrip({ track, isOutput = false }: { track: Track | null, isOutput?: boolean }) {
    const { updateTrack, addPlugin, togglePlugin, focusedTrackId } = useProjectStore()

    const handleTrackUpdate = (field: keyof Track, value: any) => {
        if (focusedTrackId) updateTrack(focusedTrackId, { [field]: value });
    };

    const handleLevelChange = (v: number) => handleTrackUpdate('volume', v);
    const handlePanChange = (v: number) => handleTrackUpdate('pan', v);

    return (
        <div className={`flex-1 flex flex-col border-r border-black/40 ${isOutput ? 'bg-[#1e1e1e]' : 'bg-[#1a1a1a]'}`}>
            <div className="flex-1 flex flex-col px-1.5 py-3 gap-0.5">
                <div className="h-6 bg-[#252525] rounded-sm mb-1.5 flex items-center justify-center text-[9px] font-black text-gray-400 uppercase tracking-tighter border border-white/5 truncate px-1">
                    {isOutput ? 'Setting' : (track?.name || 'Analog De...')}
                </div>

                <div className="h-10 bg-black/40 rounded-sm mb-1.5 flex items-center justify-center relative overflow-hidden group border border-white/5">
                    <svg viewBox="0 0 100 40" className="w-full h-full opacity-40 group-hover:opacity-80 transition-opacity">
                        <path d="M0,25 Q25,10 50,20 T100,25" fill="none" stroke="#38bdf8" strokeWidth="2" />
                    </svg>
                </div>

                {/* Dynamic Signal Chain (Logic Implementation) */}
                <div className="flex flex-col gap-0.5 mb-2 h-[100px] overflow-y-auto custom-scrollbar-v relative">
                    {!isOutput && <div className="h-4 flex items-center justify-center text-[8px] font-black text-gray-600 uppercase tracking-widest relative">
                        MIDI FX
                        {track && track.midiOutToTrackSlot === -1 && (
                            <div className="absolute right-0 top-1 w-0 h-0 border-t-[4px] border-t-transparent border-l-[6px] border-l-orange-500 border-b-[4px] border-b-transparent" title="Record MIDI to Track Here"></div>
                        )}
                    </div>}

                    {/* Fake MIDI Effect Slot for demonstration of the tap point feature */}
                    {!isOutput && track && (track.type === 'software-instrument' || track.type === 'midi') && (
                        <div 
                            className="h-5 rounded-sm flex items-center px-1 text-[9px] font-black shadow-sm border-t border-white/10 cursor-pointer hover:brightness-110 bg-green-700/80 text-white relative group"
                        >
                            ChordTrigger
                            <div className="absolute right-1 hidden group-hover:flex items-center gap-1">
                                <button className="text-[7px]" onClick={() => useProjectStore.getState().setMidiOutToTrackSlot(track.id, 0)}>Tap</button>
                            </div>
                            {track.midiOutToTrackSlot === 0 && (
                                <div className="absolute right-[-2px] inset-y-0 flex items-center">
                                    <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[6px] border-l-orange-500 border-b-[4px] border-b-transparent" title="Record MIDI to Track Here"></div>
                                </div>
                            )}
                        </div>
                    )}

                    {track?.plugins.map((p: any) => (
                        <div
                            key={p.id}
                            onClick={() => togglePlugin(track.id, p.id)}
                            className={`h-5 rounded-sm flex items-center px-1 text-[9px] font-black shadow-sm border-t border-white/10 cursor-pointer hover:brightness-110 transition-all ${p.enabled ? (p.name.includes('EQ') ? 'bg-sky-500 text-white' : 'bg-sky-600 text-white') : 'bg-gray-800 text-gray-500 opacity-60'}`}
                        >
                            {p.name}
                        </div>
                    ))}

                    {track && track.plugins.length < 5 && (
                        <button
                            onClick={() => addPlugin(track.id, 'comp')}
                            className="h-5 bg-black/20 rounded-sm border border-white/5 text-[8px] font-black text-gray-700 hover:text-gray-400 uppercase flex items-center justify-center"
                        >
                            Audio FX
                        </button>
                    )}
                </div>

                <div className="h-5 bg-[#2563eb]/20 border border-blue-500/20 rounded-md flex items-center px-2 justify-between mb-2">
                    <span className="text-[9px] font-black text-blue-400 uppercase">Bus 1</span>
                    <div className="w-2.5 h-2.5 rounded-full border border-blue-400 bg-blue-500/40"></div>
                </div>

                <div className="h-6 bg-[#252525] rounded-sm flex items-center justify-center text-[9px] font-black text-gray-400 uppercase border border-white/5 mb-1">
                    {isOutput ? 'Mastering' : 'Stereo Out'}
                </div>

                <div className="h-6 bg-black/40 rounded-sm flex items-center justify-center text-[9px] font-black text-[#1ed760] uppercase mb-1 border border-white/5">Read</div>

                {/* Control Group: Pan & Fader Area */}
                <div className="flex-1 flex flex-col items-center justify-end pb-4 gap-2">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#111] to-[#2a2a2a] border border-[#333] relative shadow-2xl">
                        <div className="absolute top-1 left-[16px] w-[2px] h-2.5 bg-gray-500 rounded-full origin-bottom rotate-0 shadow-lg"></div>
                    </div>

                    <div className="flex gap-2 items-end">
                        <div className="h-32 w-1.5 bg-black/60 rounded-full border border-white/5 relative overflow-hidden"><div className="absolute bottom-0 w-full h-[65%] bg-green-500"></div></div>
                        <div className="h-32 w-4 bg-black/40 rounded-sm border border-[#222] relative group">
                            <div className="absolute inset-y-1 inset-x-0.5 flex flex-col justify-between opacity-10">{[...Array(12)].map((_, i) => <div key={i} className="w-full h-px bg-white"></div>)}</div>
                            <div
                                className="absolute -left-1 w-6 h-3 bg-[#333] border border-[#444] rounded shadow-2xl z-20 transition-all cursor-ns-resize"
                                style={{ bottom: `${(track?.volume || 0.8) * 100}%` }}
                                onMouseDown={(e) => {
                                    const startY = e.clientY;
                                    const startVol = track?.volume || 0.8;
                                    const onMove = (me: MouseEvent) => {
                                        const delta = (startY - me.clientY) / 100;
                                        handleLevelChange(Math.max(0, Math.min(1, startVol + delta)));
                                    }
                                    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
                                    window.addEventListener('mousemove', onMove);
                                    window.addEventListener('mouseup', onUp);
                                }}
                            ></div>
                        </div>
                        <div className="h-32 w-1.5 bg-black/60 rounded-full border border-white/5 relative overflow-hidden"><div className="absolute bottom-0 w-full h-[60%] bg-green-500"></div></div>
                    </div>

                    <div className="flex gap-1 h-6 w-full px-1 pt-2">
                        <button className={`flex-1 border rounded-sm text-[10px] font-black transition-colors ${track?.muted ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`} onClick={() => handleTrackUpdate('muted', !track?.muted)}>M</button>
                        <button className={`flex-1 border rounded-sm text-[10px] font-black transition-colors ${track?.soloed ? 'bg-[#ffc500]/20 border-[#ffc500] text-[#ffc500]' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`} onClick={() => handleTrackUpdate('soloed', !track?.soloed)}>S</button>
                    </div>
                </div>
            </div>

            <div className="h-[22px] bg-[#111] border-t border-black flex items-center justify-center shrink-0">
                <span className="text-[10px] font-black text-[#888] uppercase truncate px-2 leading-none">
                    {isOutput ? 'Output' : (track?.name || 'Track')}
                </span>
            </div>
        </div>
    )
}

function ChevronUpSmall({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 100 100" className={className} fill="currentColor"><polygon points="50,30 80,60 20,60" /></svg>
    )
}

function ChevronDownSmall({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 100 100" className={className} fill="currentColor"><polygon points="20,40 80,40 50,70" /></svg>
    )
}
