"use client"
import { useState, useRef, useEffect, useCallback, memo } from "react"
import { useProjectStore } from "@/store/projectStore"
import { audioEngine } from "@/engine/AudioEngineAdapter"
import { VerticalMeter } from "./VerticalMeter"
import { getSoundInfo } from "@/engine/soundLibrary/instruments"
import { SoundFontPanel } from "./SoundFontPanel"
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
        setInternalMidiIn, setInternalMidiInRecordMode,
        setPluginBrowserTrack
    } = useProjectStore()

    const track = tracks.find(t => t.id === focusedTrackId)
    const clip = clips.find(c => c.id === selectedClipId)

    const [regionOpen, setRegionOpen] = useState(true)
    const [trackOpen, setTrackOpen] = useState(true)

    if (!showInspector) return null

    if (!track) {
        return (
            <div className="w-[280px] bg-studio-panel border-r border-[var(--accent-cyan)]/50 flex flex-col items-center justify-center text-studio-text-dim shrink-0 z-40">
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
        <div className="w-[280px] bg-studio-panel border-r border-[var(--accent-cyan)]/50 flex flex-col shrink-0 select-none overflow-y-auto custom-scrollbar-v z-40">
            {/* 1. Region Inspector Section (Professional Logic Implementation) */}
            <div className="flex flex-col border-b border-[var(--accent-cyan)]/30">
                <div
                    onClick={() => setRegionOpen(!regionOpen)}
                    className="h-9 px-3 flex items-center gap-2 hover:bg-white/[0.03] cursor-pointer transition-colors bg-studio-raised/30"
                >
                    {regionOpen ? <ChevronDown className="w-3.5 h-3.5 text-studio-text-dim" /> : <ChevronRight className="w-3.5 h-3.5 text-studio-text-dim" />}
                    <span className="text-[11px] font-bold text-studio-text-mid">Region:</span>
                    <span className="text-[11px] font-black text-white/90 truncate">{clip ? clip.name : "Analog Bass"}</span>
                </div>

                {regionOpen && clip && (
                    <div className="flex flex-col py-1 bg-studio-panel/50">
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
                                className="bg-transparent text-[11px] font-black text-studio-text outline-none cursor-pointer text-right w-[140px] appearance-none focus:ring-1 focus:ring-[var(--accent-cyan)] focus:shadow-[0_0_8px_var(--accent-cyan-glow)] transition-all"
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
                            <span className="text-[11px] font-black text-studio-text">{(clip.flexTimeFactor || 1).toFixed(2)}x</span>
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
                            <ChevronRight className="w-3 h-3 text-studio-text-dim group-hover:text-studio-text-mid" />
                            <span className="text-[9px] font-black text-studio-text-dim group-hover:text-studio-text-mid uppercase">More</span>
                        </div>
                    </div>
                )}
            </div>

            {/* 2. Track Inspector Section (Professional Logic Implementation) */}
            <div className="flex flex-col border-b border-[var(--accent-cyan)]/30">
                <div
                    onClick={() => setTrackOpen(!trackOpen)}
                    className="h-9 px-3 flex items-center gap-2 hover:bg-white/[0.03] cursor-pointer transition-colors bg-studio-raised/30"
                >
                    {trackOpen ? <ChevronDown className="w-3.5 h-3.5 text-studio-text-dim" /> : <ChevronRight className="w-3.5 h-3.5 text-studio-text-dim" />}
                    <span className="text-[11px] font-bold text-studio-text-mid">Track:</span>
                    <span className="text-[11px] font-black text-white/90 truncate">{track.name}</span>
                </div>

                {trackOpen && (
                    <div className="flex flex-col py-2 bg-studio-panel/50">
                        <InspectorField label="Icon">
                            <div className="w-10 h-10 border border-[#63ed63]/40 rounded bg-black/40 flex items-center justify-center shadow-lg">
                                {track.type === 'midi' ? <Keyboard className="w-6 h-6 text-[#63ed63] opacity-80" /> : <Mic className="w-6 h-6 text-accent-cyan opacity-80" />}
                            </div>
                        </InspectorField>
                        {/* The one place to see and change what a track plays.
                            Instrument selection was previously buried in the
                            Library panel and the Audio FX menu, with nothing in
                            the Inspector showing the current instrument. */}
                        {(track.type === 'midi' || track.type === 'software-instrument' || track.type === 'drummer') && (
                            <InspectorField label="Instrument">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPluginBrowserTrack(track.id, 'instrument');
                                    }}
                                    title="Choose an instrument for this track"
                                    className="flex items-center gap-1 max-w-[130px] px-1.5 py-0.5 rounded hover:bg-accent-cyan/20 transition-colors group/inst"
                                >
                                    <span className={`text-[11px] font-black truncate ${track.instrument ? 'text-studio-text' : 'text-studio-text-dim italic'}`}>
                                        {track.instrument || 'None'}
                                    </span>
                                    <ChevronDown className="w-3 h-3 text-studio-text-dim group-hover/inst:text-accent-cyan shrink-0" />
                                </button>
                            </InspectorField>
                        )}
                        <InspectorField label="Channel" value={track.channel || "Inst 1"} hasChevron />
                        <InspectorField label="MIDI Input" value={track.midiInput || "All"} hasChevron />

                        {track.instrument && getSoundInfo(track.instrument)?.engine === 'soundfont' && (
                            <div className="px-2 py-2">
                                <SoundFontPanel trackId={track.id} />
                            </div>
                        )}

                        {/* Internal MIDI In Section */}
                        <div className="flex flex-col border-y border-white/5 my-1 py-1 bg-black/10">
                            <InspectorField label="Internal MIDI In">
                                <select 
                                    className="bg-transparent text-[11px] font-black text-studio-text outline-none cursor-pointer text-right w-[140px] appearance-none focus:ring-1 focus:ring-[var(--accent-cyan)] focus:shadow-[0_0_8px_var(--accent-cyan-glow)] transition-all"
                                    value={track.internalMidiInSourceId || ""}
                                    onChange={(e) => {
                                        const sourceId = e.target.value || undefined;
                                        setInternalMidiIn(track.id, sourceId, sourceId ? 'Instrument Input' : 'Off');
                                    }}
                                >
                                    <option value="" className="bg-studio-panel">Off</option>
                                    <optgroup label="Instrument Input" className="bg-studio-panel">
                                        {tracks.filter(t => t.id !== track.id && (t.type === 'software-instrument' || t.type === 'midi')).map(t => (
                                            <option key={t.id} value={t.id} className="bg-studio-panel">{t.name}</option>
                                        ))}
                                    </optgroup>
                                </select>
                            </InspectorField>

                            {track.internalMidiInSourceId && (
                                <>
                                    <InspectorField label="Record">
                                        <select 
                                            className="bg-transparent text-[11px] font-black text-accent-cyan outline-none cursor-pointer text-right w-[140px] appearance-none"
                                            value={track.internalMidiInRecordMode || "Internal Only"}
                                            onChange={(e) => setInternalMidiInRecordMode(track.id, e.target.value as any)}
                                        >
                                            <option value="Internal Only" className="bg-studio-panel">Internal Only</option>
                                            <option value="Internal + External" className="bg-studio-panel">Int + External</option>
                                        </select>
                                    </InspectorField>
                                </>
                            )}
                        </div>

                        <InspectorField label="MIDI In Channel">
                            <select 
                                className="bg-transparent text-[11px] font-black text-studio-text outline-none cursor-pointer text-right appearance-none focus:ring-1 focus:ring-[var(--accent-cyan)] focus:shadow-[0_0_8px_var(--accent-cyan-glow)] transition-all"
                                value={track.midiInChannel || "All"}
                                onChange={(e) => handleTrackUpdate('midiInChannel', e.target.value === 'All' ? 'All' : Number(e.target.value))}
                            >
                                <option value="All" className="bg-studio-panel">All</option>
                                {Array.from({length: 16}).map((_, i) => (
                                    <option key={i+1} value={i+1} className="bg-studio-panel">{i+1}</option>
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
            <div className="flex-1 flex bg-studio-panel min-h-0">
                <InspectorChannelStrip track={track} />
                <InspectorChannelStrip track={null} isOutput />
            </div>


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
            <span className="text-[11px] font-bold text-studio-text-dim group-hover:text-studio-text-mid truncate pr-2">{label}:</span>
            <div className="flex items-center gap-1 cursor-pointer shrink-0">
                {children}
                {!children && type === 'text' && (
                    <>
                        <span className="text-[11px] font-black text-studio-text tabular-nums">{value}</span>
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
                        className={`w-3 h-3 border border-studio-line rounded-sm transition-colors ${checked ? 'bg-accent-cyan border-accent-cyan' : 'bg-black/40'}`}
                    ></div>
                )}
            </div>
        </div>
    )
}

import { Track } from "@/models/Track";

const InspectorChannelStrip = memo(function InspectorChannelStrip({ track, isOutput = false }: { track: Track | null, isOutput?: boolean }) {
    const { 
        addPlugin, togglePlugin, focusedTrackId, 
        setOpenPluginEditor, settings, updateProjectSettings, saveHistorySnapshot
    } = useProjectStore()
    const updateTrack = useProjectStore(s => s.updateTrack)
    const faderCapRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);

    const currentVolume = isOutput ? settings.masterVolume : (track?.volume || 0.8);
    const currentPan = isOutput ? settings.masterPan : (track?.pan || 0);

    useEffect(() => {
        if (!isDraggingRef.current && faderCapRef.current) {
            faderCapRef.current.style.bottom = `${(currentVolume / 1.5) * 100}%`;
        }
    }, [currentVolume]);

    const handleLevelChange = (v: number) => {
        if (isOutput) {
            audioEngine.setMasterVolume(v);
        } else if (track) {
            audioEngine.setTrackVolume(track.id, v);
        }
    }
    const handlePanChange = (v: number) => {
        if (isOutput) {
            updateProjectSettings({ masterPan: v });
            audioEngine.setMasterPan(v);
        } else if (track) {
            updateTrack(track.id, { pan: v });
        }
    }

    const analyzer = (isOutput ? audioEngine.getMasterAnalyzer() : (track ? audioEngine.getTrackNodes(track.id)?.analyzer : null)) || null;

    return (
        <div className={`flex-1 flex flex-col border-r border-[var(--accent-cyan)]/30 ${isOutput ? 'bg-studio-panel' : 'bg-studio-panel'}`}>
            <div className="flex-1 flex flex-col px-1.5 py-3 gap-0.5">
                <div className="h-6 bg-studio-raised rounded-sm mb-1.5 flex items-center justify-center text-[9px] font-black text-studio-text-mid uppercase tracking-tighter border border-white/5 truncate px-1">
                    {isOutput ? 'Setting' : (track?.name || 'Analog De...')}
                </div>

                <div className="h-10 bg-black/40 rounded-sm mb-1.5 flex items-center justify-center relative overflow-hidden group border border-white/5">
                    <svg viewBox="0 0 100 40" className="w-full h-full opacity-40 group-hover:opacity-80 transition-opacity">
                        <path d="M0,25 Q25,10 50,20 T100,25" fill="none" stroke="#38bdf8" strokeWidth="2" />
                    </svg>
                </div>

                {/* Dynamic Signal Chain (Logic Implementation) */}
                <div className="flex flex-col gap-0.5 mb-2 h-[100px] overflow-y-auto custom-scrollbar-v relative">
                    {!isOutput && <div className="h-4 flex items-center justify-center text-[8px] font-black text-studio-text-dim uppercase tracking-widest relative">
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
                            onClick={() => setOpenPluginEditor({ trackId: track.id, pluginId: p.id })}
                            className={`h-5 rounded-sm flex items-center px-1 text-[9px] font-black shadow-sm border-t border-white/10 cursor-pointer hover:brightness-110 transition-all ${p.enabled ? (p.name.includes('EQ') ? 'bg-accent-cyan text-white' : 'bg-accent-cyan text-white') : 'bg-studio-panel text-studio-text-dim opacity-60'}`}
                        >
                            <div 
                                onClick={(e) => { e.stopPropagation(); togglePlugin(track.id, p.id); }}
                                className="mr-1 p-0.5 hover:bg-white/10 rounded cursor-pointer"
                            >
                                <Circle className={`w-1.5 h-1.5 ${p.enabled ? 'fill-white text-white' : 'text-studio-text-dim'}`} />
                            </div>
                            <span className="truncate">{p.name}</span>
                        </div>
                    ))}

                    {track && track.plugins.length < 5 && (
                        <div className="relative">
                            <PluginMenu onSelect={(type) => addPlugin(track.id, type)} />
                        </div>
                    )}
                </div>

                <div className="h-5 bg-accent-cyan/20 border border-accent-cyan/20 rounded-md flex items-center px-2 justify-between mb-2">
                    <span className="text-[9px] font-black text-accent-cyan uppercase">Bus 1</span>
                    <div className="w-2.5 h-2.5 rounded-full border border-accent-cyan bg-accent-cyan/40"></div>
                </div>

                <div className="h-6 bg-studio-raised rounded-sm flex items-center justify-center text-[9px] font-black text-studio-text-mid uppercase border border-white/5 mb-1">
                    {isOutput ? 'Mastering' : 'Stereo Out'}
                </div>

                <div className="h-6 bg-black/40 rounded-sm flex items-center justify-center text-[9px] font-black text-[#1ed760] uppercase mb-1 border border-white/5">Read</div>

                {/* Control Group: Pan & Fader Area */}
                <div className="flex-1 flex flex-col items-center justify-end pb-4 gap-3 relative">
                    <div className="flex flex-col items-center gap-1 group">
                        <PanKnob 
                            value={currentPan} 
                            onChange={handlePanChange} 
                            isOutput={false} // Now making it a functional knob even for master
                        />
                        <span className="text-[8px] font-black text-studio-text-dim opacity-0 group-hover:opacity-100 transition-opacity">PAN</span>
                    </div>

                    <div className="flex gap-2 items-end relative h-40">
                        <VerticalMeter analyzer={analyzer} side="L" />
                        
                        <div className="h-40 w-5 bg-studio-sunken rounded-sm border border-studio-line/50 relative group shadow-inner">
                            {/* Fader Track Details (Ticks) */}
                            <div className="absolute inset-y-2 left-[45%] w-[1px] bg-white/5 flex flex-col justify-between opacity-30">
                                {[...Array(11)].map((_, i) => (
                                    <div key={i} className={`h-[1px] bg-white/40 ${i % 5 === 0 ? 'w-2 -ml-1' : 'w-1'}`}></div>
                                ))}
                            </div>

                            {/* Fader Handle (Premium Visuals) */}
                            <div
                                ref={faderCapRef}
                                className="absolute -left-1.5 w-8 h-4 cursor-ns-resize z-20 group-hover:brightness-125 transition-all outline-none"
                                style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }}
                                onMouseDown={(e) => {
                                    isDraggingRef.current = true;
                                    const startY = e.clientY;
                                    const startVol = currentVolume;
                                    let lastFlushedVol = startVol;

                                    const onMove = (me: MouseEvent) => {
                                        const delta = (startY - me.clientY) / 150;
                                        const newVol = Math.max(0, Math.min(1.5, startVol + delta));
                                        lastFlushedVol = newVol;
                                        handleLevelChange(newVol);
                                    };

                                    let rafId: number | null = null;
                                    const onRafMove = (me: MouseEvent) => {
                                        onMove(me);
                                        if (rafId === null && faderCapRef.current) {
                                            rafId = requestAnimationFrame(() => {
                                                rafId = null;
                                                if (faderCapRef.current) {
                                                    faderCapRef.current.style.bottom = `${Math.min(100, (lastFlushedVol / 1.5) * 100)}%`;
                                                }
                                            });
                                        }
                                    };

                                    const onUp = () => {
                                        isDraggingRef.current = false;
                                        if (rafId !== null) cancelAnimationFrame(rafId);
                                        if (faderCapRef.current) {
                                            faderCapRef.current.style.bottom = `${Math.min(100, (lastFlushedVol / 1.5) * 100)}%`;
                                        }
                                        if (isOutput) {
                                            updateProjectSettings({ masterVolume: lastFlushedVol });
                                            audioEngine.setMasterVolume(lastFlushedVol);
                                        } else if (track) {
                                            updateTrack(track.id, { volume: lastFlushedVol });
                                            audioEngine.setTrackVolume(track.id, lastFlushedVol);
                                        }
                                        saveHistorySnapshot();
                                        window.removeEventListener('mousemove', onRafMove);
                                        window.removeEventListener('mouseup', onUp);
                                    };
                                    window.addEventListener('mousemove', onRafMove);
                                    window.addEventListener('mouseup', onUp);
                                }}
                            >
                                <div className="w-full h-full bg-gradient-to-b from-studio-control via-studio-raised to-studio-sunken border border-studio-line-strong rounded shadow-xl relative overflow-hidden">
                                    <div className="absolute top-[50%] left-0 right-0 h-[1x] bg-white/20 shadow-[0_0_2px_rgba(255,255,255,0.5)]"></div>
                                    <div className="absolute top-0 left-[2px] right-[2px] h-[1px] bg-white/10"></div>
                                </div>
                            </div>
                        </div>

                        <VerticalMeter analyzer={analyzer} side="R" />
                    </div>

                    <div className="flex gap-1 h-6 w-full px-1 pt-2">
                        <button 
                            className={`flex-1 border rounded-sm text-[10px] font-black transition-colors ${track?.muted ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-studio-panel border-studio-line text-studio-text-dim'}`} 
                            onClick={() => track && updateTrack(track.id, { muted: !track.muted })}
                        >
                            M
                        </button>
                        <button 
                            className={`flex-1 border rounded-sm text-[10px] font-black transition-colors ${track?.soloed ? 'bg-[#ffc500]/20 border-[#ffc500] text-[#ffc500]' : 'bg-studio-panel border-studio-line text-studio-text-dim'}`} 
                            onClick={() => track && updateTrack(track.id, { soloed: !track.soloed })}
                        >
                            S
                        </button>
                    </div>
                </div>
            </div>

            <div className="h-[22px] bg-studio-sunken border-t border-black flex items-center justify-center shrink-0">
                <span className="text-[10px] font-black text-studio-text-dim uppercase truncate px-2 leading-none">
                    {isOutput ? 'Output' : (track?.name || 'Track')}
                </span>
            </div>
        </div>
    )
})

function PluginMenu({ onSelect }: { onSelect: (type: 'comp' | 'eq' | 'reverb' | 'delay') => void }) {
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
        { id: 'eq', name: 'Channel EQ', category: 'EQ' },
        { id: 'reverb', name: 'ChromaVerb', category: 'Reverb' },
        { id: 'delay', name: 'Delay Designer', category: 'Delay' },
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
                </div>
            )}
        </div>
    );
}

function PanKnob({ value, onChange, isOutput }: { value: number, onChange: (v: number) => void, isOutput?: boolean }) {
    if (isOutput) {
        return (
             <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-studio-sunken to-studio-raised border border-white/5 relative shadow-inner flex items-center justify-center">
                 <div className="w-7 h-7 rounded-full bg-studio-sunken border border-black flex items-center justify-center text-[7px] font-black text-studio-text-dim uppercase">Mst</div>
        </div>
    )
}

    const rotation = value * 135; // Pan -1 to 1 maps to -135 to 135 degrees

    return (
        <div 
            className="w-3 h-3 rounded-full bg-gradient-to-tr from-studio-void to-studio-control border border-[var(--accent-cyan)]/50 relative shadow-2xl cursor-pointer group active:scale-95 transition-transform"
            onMouseDown={(e) => {
                const startY = e.clientY;
                const startVal = value;
                const onMove = (me: MouseEvent) => {
                    const delta = (startY - me.clientY) / 100;
                    onChange(Math.max(-1, Math.min(1, startVal + delta)));
                }
                const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
            }}
        >
            <div className="absolute inset-1 rounded-full border border-[var(--accent-cyan)]/30 shadow-inner bg-gradient-to-tr from-studio-sunken via-studio-raised to-studio-control"></div>
            <div 
                className="absolute top-1.5 left-[17px] w-[2px] h-3 bg-[var(--accent-cyan)] rounded-full origin-[1px_16.5px] transition-transform duration-100 ease-out"
                style={{ transform: `rotate(${rotation}deg)` }}
            >
                <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-[var(--accent-cyan)]/20 blur-sm rounded-full"></div>
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
