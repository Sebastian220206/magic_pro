"use client"
import { useState, useRef, useEffect, memo } from "react"
import { useProjectStore } from "@/store/projectStore"
import { audioEngine } from "@/engine/AudioEngineAdapter"
import { VerticalMeter } from "./VerticalMeter"
import { ChevronDown, ChevronRight, Link2 } from "lucide-react"
import type { Track } from "@/models/Track"

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
function midiToName(n: number): string {
    const name = NOTE_NAMES[((n % 12) + 12) % 12]
    const oct = Math.floor(n / 12) - 2
    return `${name}${oct}`
}
function limitToNames(limit: unknown, fallback: [string, string]): [string, string] {
    if (Array.isArray(limit) && limit.length >= 2 && typeof limit[0] === 'number' && typeof limit[1] === 'number') {
        return [midiToName(limit[0] as number), midiToName(limit[1] as number)]
    }
    return fallback
}

export function Inspector() {
    const {
        focusedTrackId, tracks, clips, selectedClipId,
        showInspector, updateTrack, updateClip,
        setInternalMidiIn,
    } = useProjectStore()

    const track = tracks.find(t => t.id === focusedTrackId)
    const clip = clips.find(c => c.id === selectedClipId)

    const [regionOpen, setRegionOpen] = useState(true)
    const [trackOpen, setTrackOpen] = useState(true)
    const [regionMore, setRegionMore] = useState(false)

    if (!showInspector) return null

    if (!track) {
        return (
            <div className="w-[280px] bg-[#1e1f21] border-r border-[#161718] flex flex-col items-center justify-center shrink-0 z-40">
                <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">No Track Selected</span>
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

    const regionName = clip ? clip.name : "Analog Bass"
    const trackName = track.name || "Deep Bass"

    // Track inspector derived values (match reference defaults)
    const defaultRegionLabel = track.defaultRegionType === 'pattern'
        ? 'Pattern'
        : track.defaultRegionType === 'session-player'
            ? 'Session Plyr'
            : track.defaultRegionType === 'midi'
                ? 'MIDI'
                : '(Undefi...'
    const [keyLo, keyHi] = limitToNames((track as any).keyLimit, ['C-2', 'G8'])
    const velLimit = (track as any).velocityLimit
    const velLo = Array.isArray(velLimit) ? velLimit[0] : 1
    const velHi = Array.isArray(velLimit) ? velLimit[1] : 127
    const articulation = (track as any).articulationSetId ? String((track as any).articulationSetId) : 'None'

    return (
        <div className="w-[280px] bg-[#1e1f21] border-r border-[#161718] flex flex-col shrink-0 select-none overflow-y-auto custom-scrollbar-v z-40">
            {/* ============ 1. Region inspector ============ */}
            <div className="flex flex-col border-b border-[#161718]">
                <button
                    onClick={() => setRegionOpen(!regionOpen)}
                    className="h-8 px-3 flex items-center gap-2 bg-[#262729] hover:bg-[#2d2e30] border-b border-[#1b1c1e] transition-colors text-left w-full"
                >
                    {regionOpen
                        ? <ChevronDown className="w-3.5 h-3.5 text-white/50 shrink-0" />
                        : <ChevronRight className="w-3.5 h-3.5 text-white/50 shrink-0" />}
                    <span className="text-[11px] font-bold text-white/60">Region:</span>
                    <span className="text-[11px] font-bold text-white/90 truncate">{regionName}</span>
                </button>

                {regionOpen && (
                    <div className="flex flex-col py-1 bg-[#1a1b1d]">
                        <LogicCheckRow
                            label="Mute"
                            checked={!!clip?.muted}
                            onChange={(v) => handleClipUpdate('muted', v)}
                            disabled={!clip}
                        />
                        <LogicCheckRow
                            label="Loop"
                            checked={!!clip?.loop}
                            onChange={(v) => handleClipUpdate('loop', v)}
                            disabled={!clip}
                        />
                        <LogicSelectRow
                            label="Quantize"
                            value={clip?.quantize ? String(clip.quantize) : 'Off'}
                            options={['Off', '1/16', '1/8', '1/4', '1/2', 'None']}
                            disabled={!clip}
                            onChange={(v) => handleClipUpdate('quantize', v === 'Off' ? undefined : v)}
                        />
                        <LogicValueRow label="Q-Swing" value="" dimmed />
                        <LogicStepperRow
                            label="Transpose"
                            value={clip?.transpose ? (clip.transpose > 0 ? `+${clip.transpose}` : `${clip.transpose}`) : ''}
                            disabled={!clip}
                            onStep={(d) => handleClipUpdate('transpose', (clip?.transpose || 0) + d)}
                        />
                        <div className="h-[18px] flex items-center justify-center text-[11px] text-white/30 tracking-[6px]">--</div>
                        <LogicSelectRow
                            label="Pitch Source"
                            value={clip?.pitchSource || 'Off'}
                            options={['Off', 'On']}
                            disabled={!clip}
                            onChange={(v) => handleClipUpdate('pitchSource', v)}
                        />
                        <div className="h-[18px] flex items-center justify-center text-[11px] text-white/30 tracking-[6px]">--</div>
                        <LogicStepperRow
                            label="Velocity Offset"
                            value={clip?.velocityOffset ? (clip.velocityOffset > 0 ? `+${clip.velocityOffset}` : `${clip.velocityOffset}`) : ''}
                            disabled={!clip}
                            onStep={(d) => handleClipUpdate('velocityOffset', (clip?.velocityOffset || 0) + d * 5)}
                        />
                        <button
                            onClick={() => setRegionMore(!regionMore)}
                            className="h-6 pl-[26px] flex items-center gap-1 hover:bg-white/[0.02] text-left group"
                        >
                            {regionMore
                                ? <ChevronDown className="w-3 h-3 text-white/40 group-hover:text-white/70" />
                                : <ChevronRight className="w-3 h-3 text-white/40 group-hover:text-white/70" />}
                            <span className="text-[11px] font-bold text-white/40 group-hover:text-white/70">More</span>
                        </button>
                        {regionMore && clip && (
                            <div className="border-t border-white/5 mt-1 pt-1">
                                <LogicCheckRow label="Flex Enabled" checked={!!(clip as any).flexEnabled} onChange={(v) => handleClipUpdate('flexEnabled', v)} small />
                                <LogicSelectRow
                                    label="Flex Mode"
                                    small
                                    value={(clip as any).flexMode || 'off'}
                                    options={['off', 'time', 'pitch', 'time+pitch']}
                                    onChange={(v) => handleClipUpdate('flexMode', v)}
                                />
                                <LogicValueRow small label="Flex Factor" value={`${((clip as any).flexTimeFactor || 1).toFixed(2)}x`} />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ============ 2. Track inspector ============ */}
            <div className="flex flex-col border-b border-[#161718]">
                <button
                    onClick={() => setTrackOpen(!trackOpen)}
                    className="h-8 px-3 flex items-center gap-2 bg-[#262729] hover:bg-[#2d2e30] border-b border-[#1b1c1e] transition-colors text-left w-full"
                >
                    {trackOpen
                        ? <ChevronDown className="w-3.5 h-3.5 text-white/50 shrink-0" />
                        : <ChevronRight className="w-3.5 h-3.5 text-white/50 shrink-0" />}
                    <span className="text-[11px] font-bold text-white/60">Track:</span>
                    <span className="text-[11px] font-bold text-white/90 truncate">{trackName}</span>
                </button>

                {trackOpen && (
                    <div className="flex flex-col py-1.5 bg-[#1a1b1d]">
                        {/* Icon */}
                        <div className="h-10 flex items-center group hover:bg-white/[0.02]">
                            <div className="flex-1 text-right pr-2 text-[11px] font-bold text-white/50 group-hover:text-white/80 truncate">Icon:</div>
                            <div className="w-[104px] flex items-center justify-start pl-1 shrink-0">
                                <div className="border border-white/10 rounded-[3px] bg-black/40 flex items-center justify-center px-1.5 py-1 shadow-sm">
                                    <svg viewBox="0 0 48 32" className="w-[36px] h-[22px]">
                                        <g stroke="#2ca05a" strokeWidth="1.4" fill="none" opacity="0.9">
                                            <rect x="8" y="4" width="32" height="10" rx="1" />
                                            {Array.from({ length: 8 }).map((_, i) => (
                                                <line key={i} x1={11 + i * 3.7} y1="4" x2={11 + i * 3.7} y2="9" />
                                            ))}
                                            <line x1="8" y1="9" x2="40" y2="9" />
                                            <line x1="14" y1="14" x2="24" y2="28" />
                                            <line x1="34" y1="14" x2="24" y2="28" />
                                            <line x1="10" y1="28" x2="38" y2="28" />
                                        </g>
                                    </svg>
                                </div>
                            </div>
                            <div className="w-[22px]" />
                        </div>

                        <LogicValueRow label="Default Region..." value={defaultRegionLabel} stepper />
                        <LogicValueRow label="Channel" value={track.channel || 'Inst 1'} stepper />
                        <LogicSelectRow
                            label="MIDI Input"
                            value={track.midiInput || 'All'}
                            options={['All', 'Keyboard', 'External']}
                            onChange={(v) => handleTrackUpdate('midiInput', v)}
                        />
                        <LogicSelectRow
                            label="Internal MIDI In"
                            value={track.internalMidiInSourceId ? (tracks.find(t => t.id === track.internalMidiInSourceId)?.name || 'On') : 'Off'}
                            options={['Off', ...tracks.filter(t => t.id !== track.id && (t.type === 'software-instrument' || t.type === 'midi')).map(t => t.name)]}
                            onChange={(v) => {
                                if (v === 'Off') setInternalMidiIn(track.id, undefined, 'Off')
                                else {
                                    const src = tracks.find(t => t.name === v && t.id !== track.id)
                                    setInternalMidiIn(track.id, src?.id, 'Instrument Input')
                                }
                            }}
                        />
                        <LogicSelectRow
                            label="MIDI In Channel"
                            value={String(track.midiInChannel || 'All')}
                            options={['All', ...Array.from({ length: 16 }).map((_, i) => String(i + 1))]}
                            onChange={(v) => handleTrackUpdate('midiInChannel', v === 'All' ? 'All' : Number(v))}
                        />
                        <LogicSelectRow
                            label="MIDI Out Chan..."
                            value={String((track as any).midiOutChannel || 'All')}
                            options={['All', ...Array.from({ length: 16 }).map((_, i) => String(i + 1))]}
                            onChange={(v) => handleTrackUpdate('midiOutChannel' as any, v === 'All' ? 'All' : Number(v))}
                        />
                        <LogicSelectRow
                            label="Freeze Mode"
                            value={track.freezeMode || 'Pre Fader'}
                            options={['Pre Fader', 'Source Only']}
                            onChange={(v) => handleTrackUpdate('freezeMode', v)}
                        />
                        <LogicStepperRow
                            label="Transpose"
                            value={track.transpose ? (track.transpose > 0 ? `+${track.transpose}` : `${track.transpose}`) : ''}
                            onStep={(d) => handleTrackUpdate('transpose', (track.transpose || 0) + d)}
                        />
                        <LogicStepperRow
                            label="Velocity Offset"
                            value={(track.velocityOffset || 0) !== 0 ? `${(track.velocityOffset || 0) > 0 ? '+' : ''}${track.velocityOffset}` : ''}
                            onStep={(d) => handleTrackUpdate('velocityOffset', (track.velocityOffset || 0) + d * 5)}
                        />
                        <LogicValueRow label="Key Limit" value={`${keyLo}  ${keyHi}`} />
                        <LogicValueRow label="Velocity Limit" value={`${velLo}   ${velHi}`} mono />
                        <LogicStepperRow
                            label="Delay"
                            value={(track.delay || 0) !== 0 ? `${track.delay} ms` : ''}
                            onStep={(d) => handleTrackUpdate('delay', (track.delay || 0) + d)}
                        />
                        <LogicCheckRow label="No Transpose" checked={!!track.noTranspose} onChange={(v) => handleTrackUpdate('noTranspose', v)} />
                        <LogicCheckRow label="No Reset" checked={!!track.noReset} onChange={(v) => handleTrackUpdate('noReset', v)} />
                        <LogicSelectRow label="Staff Style" value="Auto" options={['Auto', 'Treble', 'Bass', 'Grand Staff']} onChange={() => { }} />
                        <LogicSelectRow
                            label="Articulation Set"
                            value={articulation}
                            options={['None', articulation !== 'None' ? articulation : undefined].filter(Boolean) as string[]}
                            onChange={() => { }}
                        />
                    </div>
                )}
            </div>

            {/* ============ 3. Inspector channel strips ============ */}
            <div className="flex-1 flex bg-[#202123] border-t border-[#18191a] min-h-[420px]">
                <LogicChannelStrip track={track} variant="track" />
                <LogicChannelStrip track={null} variant="output" />
            </div>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/* Studio-themed rows                                                  */
/* ------------------------------------------------------------------ */

function RowShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-[24px] flex items-center hover:bg-white/[0.02] pr-[4px] group">
            {children}
        </div>
    )
}

function Label({ text, dimmed, small }: { text: string; dimmed?: boolean; small?: boolean }) {
    return (
        <div className={`flex-1 text-right pr-2 truncate ${small ? 'text-[10px]' : 'text-[11px]'} font-bold ${dimmed ? 'text-studio-text-dim opacity-60' : 'text-studio-text-dim group-hover:text-studio-text-mid'}`}>
            {text}:
        </div>
    )
}

function Stepper({ onStep }: { onStep?: (d: number) => void }) {
    return (
        <div className="flex flex-col leading-none ml-[3px] opacity-40 group-hover:opacity-80 w-[10px] items-center justify-center shrink-0 transition-opacity">
            <button className="h-[8px] text-studio-text-dim hover:text-white text-[8px] leading-none" onClick={(e) => { e.stopPropagation(); onStep?.(1) }}>▲</button>
            <button className="h-[8px] text-studio-text-dim hover:text-white text-[8px] leading-none" onClick={(e) => { e.stopPropagation(); onStep?.(-1) }}>▼</button>
        </div>
    )
}

function LogicCheckRow({ label, checked, onChange, disabled, small }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; small?: boolean }) {
    return (
        <RowShell>
            <div className={`flex-1 text-center ${small ? 'text-[10px]' : 'text-[11px]'} font-bold ${disabled ? 'text-studio-text-dim opacity-60' : 'text-studio-text-dim group-hover:text-studio-text-mid'}`}>{label}:</div>
            <div className="w-[104px] flex items-center justify-start pl-1 shrink-0">
                <button
                    disabled={disabled}
                    onClick={() => onChange(!checked)}
                    className={`w-3 h-3 border border-studio-line rounded-sm transition-colors ${checked ? 'bg-accent-cyan border-accent-cyan shadow-[0_0_6px_var(--accent-cyan-glow)]' : 'bg-black/40'} ${disabled ? 'opacity-50' : ''}`}
                    aria-pressed={checked}
                />
            </div>
            <div className="w-[22px]" />
        </RowShell>
    )
}

function LogicValueRow({ label, value, stepper, dimmed, small, mono }: { label: string; value: string; stepper?: boolean; dimmed?: boolean; small?: boolean; mono?: boolean }) {
    return (
        <RowShell>
            <Label text={label} dimmed={dimmed} small={small} />
            <div className="w-[104px] flex items-center justify-start shrink-0">
                <span className={`${small ? 'text-[10px]' : 'text-[11px]'} font-black truncate tabular-nums ${mono ? 'tracking-wide' : ''} ${dimmed ? 'text-studio-text-dim opacity-60' : 'text-studio-text'}`}>{value}</span>
            </div>
            <div className="w-[22px] shrink-0">{stepper && !dimmed ? <Stepper /> : null}</div>
        </RowShell>
    )
}

function LogicStepperRow({ label, value, onStep, disabled }: { label: string; value: string; onStep: (d: number) => void; disabled?: boolean }) {
    return (
        <RowShell>
            <Label text={label} dimmed={disabled} />
            <div className="w-[104px] flex items-center justify-start shrink-0">
                <span className={`text-[11px] font-black tabular-nums ${disabled ? 'text-studio-text-dim opacity-60' : 'text-studio-text'}`}>{value}</span>
            </div>
            <div className="w-[22px] shrink-0">{!disabled ? <Stepper onStep={onStep} /> : null}</div>
        </RowShell>
    )
}

function LogicSelectRow({ label, value, options, onChange, disabled, small }: { label: string; value: string; options: string[]; onChange: (v: string) => void; disabled?: boolean; small?: boolean }) {
    return (
        <RowShell>
            <Label text={label} dimmed={disabled} small={small} />
            <div className="w-[104px] flex items-center justify-start shrink-0 relative">
                <select
                    disabled={disabled}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={`${small ? 'text-[10px]' : 'text-[11px]'} font-black bg-transparent outline-none cursor-pointer appearance-none max-w-[86px] truncate transition-all focus:ring-1 focus:ring-[var(--accent-cyan)] focus:shadow-[0_0_8px_var(--accent-cyan-glow)] ${disabled ? 'text-studio-text-dim opacity-60' : 'text-studio-text'}`}
                >
                    {options.map(o => (
                        <option key={o} value={o} className="bg-studio-panel">{o}</option>
                    ))}
                </select>
            </div>
            <div className="w-[22px] shrink-0">{!disabled ? <Stepper onStep={(d) => {
                const i = options.indexOf(value)
                const n = i < 0 ? 0 : Math.min(options.length - 1, Math.max(0, i + d))
                onChange(options[n])
            }} /> : null}</div>
        </RowShell>
    )
}

/* ------------------------------------------------------------------ */
/* Studio-themed channel strips                                        */
/* ------------------------------------------------------------------ */

const FADER_SCALE = [0, 3, 6, 9, 12, 15, 18, 21, 24, 30, 35, 40, 45, 50, 60]

const LogicChannelStrip = memo(function LogicChannelStrip({ track, variant }: { track: Track | null; variant: 'track' | 'output' }) {
    const isOutput = variant === 'output'
    const {
        addPlugin, addMasterPlugin, masterPlugins, setOpenPluginEditor,
        settings, updateProjectSettings, saveHistorySnapshot, setPluginBrowserTrack,
    } = useProjectStore()
    const updateTrack = useProjectStore(s => s.updateTrack)
    const faderCapRef = useRef<HTMLDivElement>(null)
    const isDraggingRef = useRef(false)

    const currentVolume = isOutput ? settings.masterVolume : (track?.volume ?? 0.8)
    const currentPan = isOutput ? (settings.masterPan ?? 0) : (track?.pan ?? 0)

    useEffect(() => {
        if (!isDraggingRef.current && faderCapRef.current) {
            faderCapRef.current.style.bottom = `${(currentVolume / 1.5) * 100}%`
        }
    }, [currentVolume])

    const commitVolume = (v: number) => {
        if (isOutput) {
            updateProjectSettings({ masterVolume: v })
            audioEngine.setMasterVolume(v)
        } else if (track) {
            updateTrack(track.id, { volume: v })
            audioEngine.setTrackVolume(track.id, v)
        }
    }
    const liveVolume = (v: number) => {
        if (isOutput) audioEngine.setMasterVolume(v)
        else if (track) audioEngine.setTrackVolume(track.id, v)
    }
    const handlePanChange = (v: number) => {
        const nv = Math.max(-1, Math.min(1, v))
        if (isOutput) {
            updateProjectSettings({ masterPan: nv })
            audioEngine.setMasterPan(nv)
        } else if (track) {
            updateTrack(track.id, { pan: nv })
        }
    }

    const analyzer = (isOutput ? audioEngine.getMasterAnalyzer() : (track ? audioEngine.getTrackNodes(track.id)?.analyzer : null)) || null

    const topLabel = isOutput ? 'Setting' : ((track?.instrument || track?.name || 'Analog Bass').slice(0, 12))
    const instrumentLabel = (track?.instrument || 'ES2').slice(0, 12)
    const volumeDb = currentVolume <= 0.001 ? '-∞' : (20 * Math.log10(currentVolume)).toFixed(1)

    return (
        <div className="flex-1 flex flex-col border-r border-[#161718] bg-[#202123] min-w-0">
            <div className="flex-1 flex flex-col px-[6px] pt-[6px] pb-1 min-h-0">
                {/* setting / patch */}
                <div className="h-6 bg-[#28292c] rounded-[2px] border border-white/10 flex items-center justify-center px-1">
                    <span className="text-[9px] font-bold text-white/70 uppercase tracking-tight truncate leading-none">{topLabel}</span>
                </div>

                {/* EQ thumbnail */}
                <div className="h-[42px] mt-[5px] rounded-[2px] bg-[#141517] border border-white/10 relative overflow-hidden group">
                    <svg viewBox="0 0 100 40" className="w-full h-full opacity-80 group-hover:opacity-100 transition-opacity" preserveAspectRatio="none">
                        {isOutput
                            ? <path d="M0,20 L100,20" fill="none" stroke="#288c3d" strokeWidth="1.5" />
                            : <path d="M0,14 C15,14 20,28 35,26 C50,24 55,16 70,18 L100,20" fill="none" stroke="#288c3d" strokeWidth="1.5" />}
                    </svg>
                </div>

                {/* MIDI FX / link row */}
                {!isOutput ? (
                    <div className="h-[18px] flex items-center justify-center">
                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">MIDI FX</span>
                    </div>
                ) : (
                    <div className="flex flex-col gap-[3px] mt-[5px]">
                        <div className="h-[19px] rounded-[2px] bg-[#28292c] border border-white/10 flex items-center justify-center">
                            <Link2 className="w-3 h-3 text-white/50" />
                        </div>
                        <div className="h-[19px] rounded-[2px] bg-[#28292c] border border-white/10 flex items-center justify-center">
                            <Link2 className="w-3 h-3 text-white/50" />
                        </div>
                    </div>
                )}

                {/* Instrument (track only) */}
                {!isOutput && track && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const synthPlugin = track.plugins?.find(p => p.pluginId === 'magic.retroSynth' || p.pluginId === 'retroSynth');
                            if (synthPlugin) {
                                setOpenPluginEditor({ trackId: track.id, pluginId: synthPlugin.id });
                            } else {
                                setPluginBrowserTrack(track.id, 'instrument');
                            }
                        }}
                        title="Click to open synthesizer or choose an instrument for this track"
                        className="h-[20px] mt-[3px] rounded-[2px] bg-[#205530] border border-[#2ca05a]/60 flex items-center justify-center px-1 hover:bg-[#28663a] transition-all"
                    >
                        <span className="text-[10px] font-bold text-[#64e08c] truncate leading-none">{instrumentLabel}</span>
                    </button>
                )}

                {/* Audio FX slots */}
                <div className="flex flex-col gap-[3px] mt-[3px]">
                    {!isOutput ? (
                        <>
                            {(track?.plugins || []).map((p: any) => (
                                <div
                                    key={p.id}
                                    onClick={() => track && setOpenPluginEditor({ trackId: track.id, pluginId: p.id })}
                                    className={`h-[19px] rounded-[2px] border flex items-center px-1.5 cursor-pointer hover:brightness-110 transition-all ${p.enabled ? 'bg-[#1b3552] border-[#2670b8] text-[#7ec2ff]' : 'bg-[#28292c] border-white/10 text-white/40'}`}
                                >
                                    <span className="text-[10px] font-bold truncate leading-none">{p.name}</span>
                                </div>
                            ))}
                            {track && track.plugins.length < 5 && (
                                <PluginAddSlot onSelect={(type) => addPlugin(track.id, type)} />
                            )}
                        </>
                    ) : (
                        <>
                            {(masterPlugins || []).map((p: any) => (
                                <div
                                    key={p.id}
                                    onClick={() => setOpenPluginEditor({ trackId: 'master', pluginId: p.id })}
                                    className={`h-[19px] rounded-[2px] border flex items-center px-1.5 cursor-pointer hover:brightness-110 transition-all ${p.enabled !== false ? 'bg-[#1b3552] border-[#2670b8] text-[#7ec2ff]' : 'bg-[#28292c] border-white/10 text-white/40'}`}
                                >
                                    <span className="text-[10px] font-bold truncate leading-none">{p.name || p.pluginId}</span>
                                </div>
                            ))}
                            {(masterPlugins || []).length < 5 && (
                                <PluginAddSlot onSelect={(type) => addMasterPlugin(type)} />
                            )}
                        </>
                    )}
                </div>

                <div className="flex-1" />

                {/* Bus send */}
                {!isOutput ? (
                    <div className="flex items-center gap-1 mt-2">
                        <div className="flex-1 h-[19px] rounded-[2px] bg-[#1a2d42] border border-[#276eb8]/60 flex items-center px-1.5">
                            <span className="text-[9px] font-bold text-[#59a6ff] uppercase leading-none">Bus 2</span>
                        </div>
                        <div className="w-[16px] h-[16px] rounded-full bg-[#2a2b2e] border border-white/20 shadow-inner" />
                    </div>
                ) : (
                    <div className="h-[19px] mt-2" />
                )}

                {/* Output / mastering */}
                {!isOutput ? (
                    <div className="h-[19px] mt-[3px] rounded-[2px] bg-[#28292c] border border-white/10 flex items-center px-1.5">
                        <span className="text-[9px] font-bold text-white/70 uppercase truncate leading-none">Stereo Out</span>
                    </div>
                ) : (
                    <div className="h-[19px] mt-[3px]" />
                )}
                <div className="h-[18px] flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white/40 uppercase">{isOutput ? 'Mastering' : 'Group'}</span>
                </div>
                {!isOutput && (
                    <div className="h-[16px] flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white/40 uppercase opacity-0">Group</span>
                    </div>
                )}
                {isOutput && (
                    <div className="h-[18px] flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white/40 uppercase">Group</span>
                    </div>
                )}

                {/* Automation mode */}
                <div className="h-[19px] rounded-[2px] bg-black/40 border border-white/10 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-[#2ca05a] uppercase leading-none">Read</span>
                </div>

                {/* Pan pot with Logic Pro cyan sweep arc */}
                <div className="flex flex-col items-center justify-center mt-2 group/knob">
                    <div 
                        className="w-8 h-8 relative flex items-center justify-center cursor-ns-resize"
                        title="Pan — Drag vertically to adjust, Alt-click for Center"
                        onMouseDown={(e) => {
                            if (e.altKey) {
                                handlePanChange(0)
                                saveHistorySnapshot()
                                return
                            }
                            const startY = e.clientY
                            const startVal = currentPan
                            const onMove = (me: MouseEvent) => {
                                const delta = (startY - me.clientY) / 100
                                handlePanChange(startVal + delta)
                            }
                            const onUp = () => {
                                saveHistorySnapshot()
                                window.removeEventListener('mousemove', onMove)
                                window.removeEventListener('mouseup', onUp)
                            }
                            window.addEventListener('mousemove', onMove)
                            window.addEventListener('mouseup', onUp)
                        }}
                    >
                        {/* Outer Precision Track Gauge */}
                        <svg className="w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 32 32">
                            <circle
                                cx="16" cy="16" r="12"
                                fill="#1c1d1f"
                                stroke="#35373a"
                                strokeWidth="2.2"
                            />
                            {/* Directional Active Sweep Arc (Cyan) */}
                            {currentPan !== 0 && (
                                <circle
                                    cx="16" cy="16" r="12"
                                    fill="none"
                                    stroke="#52a9ff"
                                    strokeWidth="2.2"
                                    strokeDasharray={`${Math.abs(currentPan) * 37.7} 75.4`}
                                    strokeDashoffset={currentPan < 0 ? 0 : -37.7}
                                    strokeLinecap="round"
                                />
                            )}
                        </svg>
                        {/* Precision Metallic Center Knob Cap with Indicator Notch */}
                        <div 
                            className="w-5 h-5 rounded-full bg-gradient-to-b from-[#4d4f53] via-[#353638] to-[#252628] border border-[#5a5c60] shadow-[0_1px_3px_rgba(0,0,0,0.7)] flex items-center justify-center relative transition-transform"
                            style={{ transform: `rotate(${currentPan * 135}deg)` }}
                        >
                            <div className="absolute top-0.5 w-[1.5px] h-1.5 bg-[#ffffff] rounded-full shadow-[0_0_2px_#ffffff]" />
                        </div>
                    </div>
                    <span className="text-[9px] font-bold text-white/60 tabular-nums mt-0.5">
                        {currentPan === 0 ? 'C' : currentPan < 0 ? `L ${Math.round(Math.abs(currentPan) * 63)}` : `R ${Math.round(currentPan * 63)}`}
                    </span>
                </div>

                {/* Value readouts */}
                <div className="flex justify-center gap-1 mt-1.5">
                    <div className="w-[42px] h-[18px] rounded-[2px] bg-[#141517] border border-[#2b2c2f] flex items-center justify-center shadow-inner">
                        <span className="text-[10px] font-bold text-white/90 tabular-nums leading-none">{volumeDb}</span>
                    </div>
                    <div className="w-[28px] h-[18px] rounded-[2px] bg-[#141517] border border-[#2b2c2f] flex items-center justify-center shadow-inner">
                        <span className="text-[9px] font-semibold text-white/40 leading-none">0.0</span>
                    </div>
                </div>

                {/* Fader + dual meters + scale */}
                <div className="flex justify-center items-stretch gap-1 mt-2 relative">
                    <div className="flex items-end pb-[2px] w-2">
                        <VerticalMeter analyzer={analyzer} side="L" className="w-full h-full" />
                    </div>
                    {/* Logic Pro Fader Track */}
                    <div className="h-[150px] w-6 bg-[#121315] border border-[#2a2b2d] rounded-[2px] relative cursor-ns-resize shadow-[inset_0_0_6px_rgba(0,0,0,0.85)] flex justify-center">
                        {/* Center Slot Guide */}
                        <div className="absolute inset-y-1 w-[2px] bg-[#000000] rounded-full border-r border-white/5 pointer-events-none" />
                        {/* Unity (0 dB) Guide Notch */}
                        <div
                            className="absolute w-full h-[1px] bg-white/25 pointer-events-none"
                            style={{ bottom: '70%' }}
                            title="0 dB Unity Marker"
                        />
                        {/* Brushed Aluminum Fader Cap with Grip Stripe */}
                        <div
                            ref={faderCapRef}
                            className="absolute -left-0.5 w-7 h-4.5 cursor-ns-resize z-20 hover:brightness-105 transition-[filter]"
                            style={{
                                bottom: `${Math.min(100, (currentVolume / 1.5) * 100)}%`,
                                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.85))'
                            }}
                            onMouseDown={(e) => {
                                if (e.altKey) {
                                    liveVolume(1.0)
                                    commitVolume(1.0)
                                    saveHistorySnapshot()
                                    return
                                }
                                isDraggingRef.current = true
                                const startY = e.clientY
                                const startVol = currentVolume
                                let lastVol = startVol
                                const fine = e.shiftKey
                                const onMove = (me: MouseEvent) => {
                                    const delta = (startY - me.clientY) / (fine ? 600 : 150)
                                    const nv = Math.max(0, Math.min(1.5, startVol + delta))
                                    lastVol = nv
                                    liveVolume(nv)
                                    if (faderCapRef.current) {
                                        faderCapRef.current.style.bottom = `${Math.min(100, (nv / 1.5) * 100)}%`
                                    }
                                }
                                const onUp = () => {
                                    isDraggingRef.current = false
                                    commitVolume(lastVol)
                                    saveHistorySnapshot()
                                    window.removeEventListener('mousemove', onMove)
                                    window.removeEventListener('mouseup', onUp)
                                }
                                window.addEventListener('mousemove', onMove)
                                window.addEventListener('mouseup', onUp)
                            }}
                        >
                            <div className="w-full h-full rounded-[2px] bg-gradient-to-b from-[#d0d3d6] via-[#9da0a3] to-[#717376] border border-[#4a4c4f] relative overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] flex items-center justify-center">
                                <div className="w-[82%] h-[1.5px] bg-[#1a1b1d] shadow-[0_1px_0_rgba(255,255,255,0.5)] rounded-full" />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-end pb-[2px] w-2">
                        <VerticalMeter analyzer={analyzer} side="R" className="w-full h-full" />
                    </div>
                    <div className="flex flex-col justify-between py-[2px] pl-0.5">
                        {FADER_SCALE.map(v => (
                            <span key={v} className="text-[7px] leading-[1] text-white/35 tabular-nums">{v}</span>
                        ))}
                    </div>
                    {isOutput && (
                        <div className="absolute -top-[2px] right-0 h-[16px] px-1.5 rounded-[2px] bg-[#28292c] border border-white/10 flex items-center hover:bg-white/10 cursor-pointer">
                            <span className="text-[9px] font-bold text-white/70 uppercase leading-none">Bnc</span>
                        </div>
                    )}
                </div>

                {/* Mute and Solo with Logic Pro illuminated state */}
                <div className="flex gap-1 mt-2 px-1">
                    <button
                        className={`h-5.5 flex-1 rounded-[3px] text-[10px] font-bold transition-all border flex items-center justify-center shadow-sm ${
                            (isOutput ? settings.masterMuted : track?.muted)
                                ? 'bg-gradient-to-b from-[#e5a824] to-[#b37812] text-black border-[#ffd54f] shadow-[0_0_8px_rgba(229,168,36,0.55)] font-black'
                                : 'bg-gradient-to-b from-[#2e3034] to-[#202123] text-[#8b8e93] border-[#3e4045] hover:text-white hover:border-[#52555a]'
                        }`}
                        onClick={() => {
                            if (isOutput) {
                                updateProjectSettings({ masterMuted: !settings.masterMuted })
                            } else if (track) {
                                updateTrack(track.id, { muted: !track.muted })
                            }
                        }}
                    >
                        M
                    </button>
                    {!isOutput ? (
                        <button
                            className={`h-5.5 flex-1 rounded-[3px] text-[10px] font-bold transition-all border flex items-center justify-center shadow-sm ${
                                track?.soloed
                                    ? 'bg-gradient-to-b from-[#ffd203] to-[#d4a800] text-black border-[#fff066] shadow-[0_0_8px_rgba(255,210,3,0.55)] font-black'
                                    : 'bg-gradient-to-b from-[#2e3034] to-[#202123] text-[#8b8e93] border-[#3e4045] hover:text-white hover:border-[#52555a]'
                            }`}
                            onClick={() => track && updateTrack(track.id, { soloed: !track.soloed })}
                        >
                            S
                        </button>
                    ) : (
                        <button
                            className="h-5.5 flex-1 rounded-[3px] text-[9px] font-bold bg-[#28292c] border border-white/10 text-white/70 hover:text-white uppercase flex items-center justify-center"
                            onClick={() => useProjectStore.getState().toggleExportDialog('all')}
                        >
                            Bnc
                        </button>
                    )}
                </div>
            </div>

            <div className="h-[22px] bg-[#1a1b1d] border-t border-[#141517] flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-white/60 uppercase truncate px-2 leading-none">{isOutput ? 'Output' : (track?.name || 'Deep Bass')}</span>
            </div>
        </div>
    )
})

function PluginAddSlot({ onSelect }: { onSelect: (type: 'comp' | 'eq' | 'reverb' | 'delay') => void }) {
    const [open, setOpen] = useState(false)
    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="h-[14px] rounded-[3px] border border-dashed border-white/10 text-[8px] font-black text-studio-text-dim hover:text-studio-text-mid hover:border-white/25 uppercase transition-colors"
            >
                +
            </button>
        )
    }
    return (
        <div className="flex flex-col gap-[2px] bg-studio-panel border border-studio-line-strong rounded-[3px] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
            {([
                { id: 'comp', name: 'Compressor' },
                { id: 'eq', name: 'Channel EQ' },
                { id: 'reverb', name: 'ChromaVerb' },
                { id: 'delay', name: 'Delay' },
            ] as const).map(p => (
                <button
                    key={p.id}
                    onClick={() => { onSelect(p.id); setOpen(false) }}
                    className="text-left px-1 py-[1px] text-[10px] font-bold text-studio-text hover:bg-accent-cyan hover:text-white rounded-[2px] transition-colors"
                >
                    {p.name}
                </button>
            ))}
        </div>
    )
}
