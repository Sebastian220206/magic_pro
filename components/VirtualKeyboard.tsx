"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useProjectStore } from "@/store/projectStore"
import { X, Piano, Keyboard, Minus, Plus, ChevronUp, ChevronDown } from "lucide-react"

const KEY_MAP: Record<string, number> = {
    'a': 0, 'w': 1, 's': 2, 'e': 3, 'd': 4, 'f': 5, 't': 6, 'g': 7, 'y': 8, 'h': 9, 'u': 10, 'j': 11,
    'k': 12, 'o': 13, 'l': 14, 'p': 15, 'ö': 16, 'ä': 17, // Handling some international layouts
    ';': 16, "'": 17, // US layouts
}

export function VirtualKeyboard() {
    const { 
        showVirtualKeyboard, 
        toggleVirtualKeyboard, 
        virtualKeyboardMode, 
        setVirtualKeyboardMode,
        virtualKeyboardOctave,
        virtualKeyboardVelocity,
        virtualKeyboardPitchBend,
        virtualKeyboardModulation,
        virtualKeyboardSustain,
        updateVirtualKeyboardParams,
        triggerNote,
        releaseNote,
        tracks,
        focusedTrackId
    } = useProjectStore()

    const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set())
    const focusedTrack = tracks.find(t => t.id === focusedTrackId)
    const windowRef = useRef<HTMLDivElement>(null)

    // Use refs for frequently-changing values so the keyboard event listeners
    // don't get torn down and re-created on every slider movement (which causes
    // missed keydown/keyup events and a dead zone at slider values 91-127).
    const velocityRef = useRef(virtualKeyboardVelocity)
    const octaveRef = useRef(virtualKeyboardOctave)
    const sustainRef = useRef(virtualKeyboardSustain)
    const sustainedNotesRef = useRef<Set<number>>(new Set())
    velocityRef.current = virtualKeyboardVelocity
    octaveRef.current = virtualKeyboardOctave
    sustainRef.current = virtualKeyboardSustain

    // Release all held notes when sustain is turned OFF
    useEffect(() => {
        if (!virtualKeyboardSustain && sustainedNotesRef.current.size > 0) {
            sustainedNotesRef.current.forEach(pitch => releaseNote(pitch))
            sustainedNotesRef.current.clear()
        }
    }, [virtualKeyboardSustain, releaseNote])

    const handleNoteRelease = useCallback((pitch: number) => {
        if (sustainRef.current) {
            sustainedNotesRef.current.add(pitch)
        } else {
            releaseNote(pitch)
        }
    }, [releaseNote])

    useEffect(() => {
        if (!showVirtualKeyboard || virtualKeyboardMode !== 'musical-typing') return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return
            const key = e.key.toLowerCase()

            // Octave
            if (key === 'z') updateVirtualKeyboardParams({ octave: Math.max(0, octaveRef.current - 1) })
            if (key === 'x') updateVirtualKeyboardParams({ octave: Math.min(8, octaveRef.current + 1) })
            
            // Velocity
            if (key === 'c') updateVirtualKeyboardParams({ velocity: Math.max(0, velocityRef.current - 10) })
            if (key === 'v') updateVirtualKeyboardParams({ velocity: Math.min(127, velocityRef.current + 10) })

            // Sustain
            if (key === 'tab') {
                e.preventDefault()
                updateVirtualKeyboardParams({ sustain: !sustainRef.current })
            }

            // Pitch Bend
            if (key === '1') updateVirtualKeyboardParams({ pitchBend: -1 })
            if (key === '2') updateVirtualKeyboardParams({ pitchBend: 1 })

            // Modulation
            if (['3', '4', '5', '6', '7', '8'].includes(key)) {
                const mod = (parseInt(key) - 3) * (127 / 5)
                updateVirtualKeyboardParams({ modulation: Math.round(mod) })
            }

            // Musical Keys
            if (KEY_MAP[key] !== undefined) {
                const pitch = (octaveRef.current + 1) * 12 + KEY_MAP[key]
                triggerNote(pitch, velocityRef.current)
                setActiveKeys(prev => new Set(prev).add(key))
            }
        }

        const handleKeyUp = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase()
            
            if (key === '1' || key === '2') updateVirtualKeyboardParams({ pitchBend: 0 })

            if (KEY_MAP[key] !== undefined) {
                const pitch = (octaveRef.current + 1) * 12 + KEY_MAP[key]
                handleNoteRelease(pitch)
                setActiveKeys(prev => {
                    const next = new Set(prev)
                    next.delete(key)
                    return next
                })
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
        }
    }, [showVirtualKeyboard, virtualKeyboardMode, triggerNote, releaseNote, updateVirtualKeyboardParams])
    // NOTE: velocityRef/octaveRef/sustainRef deliberately excluded from deps —
    //       they're up-to-date via .current assignment above, and including them
    //       would re-attach listeners on every slider movement, causing missed keys.

    if (!showVirtualKeyboard) return null

    return (
        <div 
            ref={windowRef}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000] animate-in slide-in-from-bottom-4 duration-300"
        >
            <div className="bg-[#2c2c2e]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden w-[720px]">
                {/* Header */}
                <div className="h-10 border-b border-black/20 bg-white/5 flex items-center justify-between px-4">
                    <div className="flex bg-[#1a1a1a] rounded-lg p-0.5 border border-white/5">
                        <button 
                            onClick={() => setVirtualKeyboardMode('piano-keyboard')}
                            className={`p-1.5 rounded-md transition-all ${virtualKeyboardMode === 'piano-keyboard' ? 'bg-sky-500 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <Piano className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => setVirtualKeyboardMode('musical-typing')}
                            className={`p-1.5 rounded-md transition-all ${virtualKeyboardMode === 'musical-typing' ? 'bg-sky-500 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <Keyboard className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        {virtualKeyboardMode === 'musical-typing' ? 'Musical Typing' : 'Keyboard'} 
                        <span className="opacity-40">—</span> 
                        <span className="text-white">{focusedTrack?.name || "No Track Selected"}</span>
                    </div>

                    <button 
                        onClick={() => toggleVirtualKeyboard(false)}
                        className="p-1 hover:bg-white/10 rounded-full transition-colors text-gray-500 hover:text-white"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content Area */}
                <div className="p-8 bg-black/20">
                    {virtualKeyboardMode === 'musical-typing' ? (
                        <MusicalTypingView 
                            activeKeys={activeKeys} 
                            octave={virtualKeyboardOctave}
                            velocity={virtualKeyboardVelocity}
                            sustain={virtualKeyboardSustain}
                        />
                    ) : (
                        <PianoView 
                            octave={virtualKeyboardOctave}
                            triggerNote={triggerNote}
                            releaseNote={handleNoteRelease}
                            velocity={virtualKeyboardVelocity}
                        />
                    )}
                </div>

                {/* Footer / Status Bar */}
                <div className="px-6 py-3 border-t border-white/5 bg-black/40 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">Octave</span>
                            <div className="flex items-center gap-2">
                                <button className="w-6 h-6 rounded bg-[#333] border border-white/5 flex items-center justify-center text-gray-400 hover:text-white" onClick={() => updateVirtualKeyboardParams({ octave: Math.max(0, virtualKeyboardOctave-1) })}><Minus className="w-3 h-3" /></button>
                                <span className="text-xs font-black text-sky-400 w-6 text-center">C{virtualKeyboardOctave}</span>
                                <button className="w-6 h-6 rounded bg-[#333] border border-white/5 flex items-center justify-center text-gray-400 hover:text-white" onClick={() => updateVirtualKeyboardParams({ octave: Math.min(8, virtualKeyboardOctave+1) })}><Plus className="w-3 h-3" /></button>
                            </div>
                        </div>
                        <div className="flex flex-col gap-0.5 min-w-[140px]">
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">Volume</span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min={0}
                                    max={127}
                                    value={virtualKeyboardVelocity}
                                    onChange={(e) => updateVirtualKeyboardParams({ velocity: Number(e.target.value) })}
                                    className="w-full h-1.5 appearance-none bg-[#1a1a1a] rounded-full cursor-pointer
                                        [&::-webkit-slider-thumb]:appearance-none
                                        [&::-webkit-slider-thumb]:w-3.5
                                        [&::-webkit-slider-thumb]:h-3.5
                                        [&::-webkit-slider-thumb]:rounded-full
                                        [&::-webkit-slider-thumb]:bg-orange-400
                                        [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(251,146,60,0.5)]
                                        [&::-webkit-slider-thumb]:cursor-pointer
                                        [&::-webkit-slider-thumb]:border-0
                                        [&::-moz-range-thumb]:w-3.5
                                        [&::-moz-range-thumb]:h-3.5
                                        [&::-moz-range-thumb]:rounded-full
                                        [&::-moz-range-thumb]:bg-orange-400
                                        [&::-moz-range-thumb]:border-0
                                        [&::-moz-range-thumb]:cursor-pointer"
                                />
                                <span className="text-[11px] font-black text-orange-400 w-8 text-right tabular-nums">{virtualKeyboardVelocity}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <StatusPill label="Pitch Bend" value={virtualKeyboardPitchBend === 0 ? "Off" : virtualKeyboardPitchBend > 0 ? "+1" : "-1"} active={virtualKeyboardPitchBend !== 0} />
                        <StatusPill label="Modulation" value={Math.round(virtualKeyboardModulation/1.27) + "%"} active={virtualKeyboardModulation > 0} />
                        <StatusPill 
                            label="Sustain" 
                            value={virtualKeyboardSustain ? "On" : "Off"} 
                            active={virtualKeyboardSustain} 
                            color="bg-emerald-500"
                            onClick={() => updateVirtualKeyboardParams({ sustain: !virtualKeyboardSustain })}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

function StatusPill({ label, value, active, color = "bg-sky-500", onClick }: { label: string, value: string, active: boolean, color?: string, onClick?: () => void }) {
    return (
        <div className="flex flex-col gap-0.5 items-end">
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">{label}</span>
            <div 
                onClick={onClick}
                className={`px-2 py-0.5 rounded text-[10px] font-black transition-all ${onClick ? 'cursor-pointer hover:brightness-125 active:scale-95' : ''} ${active ? `${color} text-white shadow-[0_0_10px_rgba(0,0,0,0.3)]` : 'bg-white/5 text-gray-600'}`}
            >
                {value}
            </div>
        </div>
    )
}

function MusicalTypingView({ activeKeys, octave, velocity, sustain }: { activeKeys: Set<string>, octave: number, velocity: number, sustain: boolean }) {
    const renderKey = (label: string, symbol: string, color: string, isActive: boolean) => (
        <div className={`w-12 h-12 rounded-xl border flex flex-col items-center justify-center transition-all ${isActive ? 'scale-90 brightness-125 shadow-inner' : 'shadow-lg active:scale-95'} ${color}`}>
            <span className="text-[9px] font-bold opacity-60 uppercase">{label}</span>
            <span className="text-sm font-black uppercase">{symbol}</span>
        </div>
    )

    return (
        <div className="flex flex-col gap-6 items-center">
            {/* Control Keys Row */}
            <div className="flex gap-4 items-center mb-2">
                <div className="flex gap-1.5">
                    {renderKey('Pitch', '1', 'bg-blue-600 border-blue-400/30', activeKeys.has('1'))}
                    {renderKey('Bend', '2', 'bg-blue-600 border-blue-400/30', activeKeys.has('2'))}
                </div>
                <div className="w-px h-8 bg-white/10 mx-2"></div>
                <div className="flex gap-1.5">
                    {['3', '4', '5', '6', '7', '8'].map(k => (
                        <div key={k} className={`w-9 h-12 rounded-lg border flex items-center justify-center transition-all bg-purple-600 border-purple-400/30 font-black text-xs ${activeKeys.has(k) ? 'brightness-150 scale-90' : 'opacity-80'}`}>{k}</div>
                    ))}
                    <div className="text-[9px] font-bold text-gray-500 uppercase ml-2 self-center">Modulation</div>
                </div>
            </div>

            {/* Main Key Layout */}
            <div className="relative flex flex-col gap-1.5 items-center">
                <div className="flex gap-1.5 ml-14">
                    {renderKey('tab', 'sustain', sustain ? 'bg-emerald-600 border-emerald-400/30 w-16' : 'bg-gray-700 border-white/10 w-16 opacity-40', false)}
                    <div className="w-6"></div>
                    {renderKey('w', 'C#', activeKeys.has('w') ? 'bg-white border-black text-black' : 'bg-black border-white/20 text-white', activeKeys.has('w'))}
                    {renderKey('e', 'D#', activeKeys.has('e') ? 'bg-white border-black text-black' : 'bg-black border-white/20 text-white', activeKeys.has('e'))}
                    <div className="w-12"></div>
                    {renderKey('t', 'F#', activeKeys.has('t') ? 'bg-white border-black text-black' : 'bg-black border-white/20 text-white', activeKeys.has('t'))}
                    {renderKey('y', 'G#', activeKeys.has('y') ? 'bg-white border-black text-black' : 'bg-black border-white/20 text-white', activeKeys.has('y'))}
                    {renderKey('u', 'A#', activeKeys.has('u') ? 'bg-white border-black text-black' : 'bg-black border-white/20 text-white', activeKeys.has('u'))}
                </div>
                <div className="flex gap-1.5">
                    {renderKey('a', 'C', activeKeys.has('a') ? 'bg-sky-400 border-sky-300 text-white' : 'bg-white/90 border-black/20 text-black', activeKeys.has('a'))}
                    {renderKey('s', 'D', activeKeys.has('s') ? 'bg-sky-400 border-sky-300 text-white' : 'bg-white/90 border-black/20 text-black', activeKeys.has('s'))}
                    {renderKey('d', 'E', activeKeys.has('d') ? 'bg-sky-400 border-sky-300 text-white' : 'bg-white/90 border-black/20 text-black', activeKeys.has('d'))}
                    {renderKey('f', 'F', activeKeys.has('f') ? 'bg-sky-400 border-sky-300 text-white' : 'bg-white/90 border-black/20 text-black', activeKeys.has('f'))}
                    {renderKey('g', 'G', activeKeys.has('g') ? 'bg-sky-400 border-sky-300 text-white' : 'bg-white/90 border-black/20 text-black', activeKeys.has('g'))}
                    {renderKey('h', 'A', activeKeys.has('h') ? 'bg-sky-400 border-sky-300 text-white' : 'bg-white/90 border-black/20 text-black', activeKeys.has('h'))}
                    {renderKey('j', 'B', activeKeys.has('j') ? 'bg-sky-400 border-sky-300 text-white' : 'bg-white/90 border-black/20 text-black', activeKeys.has('j'))}
                    {renderKey('k', 'C', activeKeys.has('k') ? 'bg-sky-400 border-sky-300 text-white' : 'bg-white/90 border-black/20 text-black', activeKeys.has('k'))}
                    {renderKey('l', 'D', activeKeys.has('l') ? 'bg-sky-400 border-sky-300 text-white' : 'bg-white/90 border-black/20 text-black', activeKeys.has('l'))}
                    {renderKey(';', 'E', activeKeys.has(';') ? 'bg-sky-400 border-sky-300 text-white' : 'bg-white/90 border-black/20 text-black', activeKeys.has(';'))}
                </div>
            </div>

            {/* Bottom Row */}
            <div className="flex gap-6 mt-2">
                <div className="flex items-center gap-2">
                    {renderKey('z', '-', 'bg-orange-600 border-orange-400/30', activeKeys.has('z'))}
                    {renderKey('x', '+', 'bg-orange-600 border-orange-400/30', activeKeys.has('x'))}
                    <div className="text-[9px] font-bold text-gray-500 uppercase ml-1">Octave</div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                    {renderKey('c', '-', 'bg-orange-500 border-orange-300/30', activeKeys.has('c'))}
                    {renderKey('v', '+', 'bg-orange-500 border-orange-300/30', activeKeys.has('v'))}
                    <div className="text-[9px] font-bold text-gray-500 uppercase ml-1">Velocity</div>
                </div>
            </div>
        </div>
    )
}

function PianoView({ octave, triggerNote, releaseNote, velocity }: { octave: number, triggerNote: any, releaseNote: any, velocity: number }) {
    const keys = Array.from({ length: 24 }) // 2 octaves
    const startPitch = (octave + 1) * 12

    const isBlack = (p: number) => [1, 3, 6, 8, 10].includes(p%12)

    return (
        <div className="flex flex-col items-center gap-8">
            {/* Overview Ruler (Logic-style) */}
            <div className="w-full h-8 bg-black/40 rounded border border-white/10 relative overflow-hidden flex items-center">
                {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="flex-1 border-r border-white/5 h-full flex items-center justify-center text-[8px] text-gray-600 font-bold">C{i-1}</div>
                ))}
                {/* Active Range Overlay */}
                <div 
                    className="absolute h-full bg-sky-500/40 border-x-2 border-sky-400 shadow-[0_0_20px_rgba(14,165,233,0.3)] transition-all"
                    style={{ left: `${(octave + 1) * 10}%`, width: '20%' }}
                ></div>
            </div>

            {/* Main Keys */}
            <div className="flex h-48 relative">
                {keys.map((_, i) => {
                    const pitch = startPitch + i
                    const black = isBlack(pitch)
                    if (black) return null; // Logic: Render white keys first, then absolute position black keys

                    return (
                        <div 
                            key={pitch}
                            onMouseDown={() => triggerNote(pitch, velocity)}
                            onMouseUp={() => releaseNote(pitch)}
                            onMouseLeave={() => releaseNote(pitch)}
                            className="w-12 border-r border-black/40 bg-white hover:bg-sky-50 transition-colors rounded-b shadow-[0_4px_10px_rgba(0,0,0,0.3)] active:bg-sky-200 cursor-pointer flex items-end justify-center pb-2"
                        >
                            {pitch % 12 === 0 && <span className="text-[9px] font-black text-gray-400">C{Math.floor(pitch/12)-1}</span>}
                        </div>
                    )
                })}
                {/* Black Keys Layer */}
                <div className="absolute inset-0 pointer-events-none flex">
                    {keys.map((_, i) => {
                        const pitch = startPitch + i
                        const black = isBlack(pitch)
                        if (!black) return <div key={pitch} className="w-12 pointer-events-none"></div>

                        return (
                            <div 
                                key={pitch}
                                onMouseDown={(e) => { e.stopPropagation(); triggerNote(pitch, velocity); }}
                                onMouseUp={() => releaseNote(pitch)}
                                onMouseLeave={() => releaseNote(pitch)}
                                className="w-8 h-28 bg-black border border-white/10 hover:bg-[#222] transition-colors rounded-b shadow-2xl absolute pointer-events-auto active:bg-[#111] cursor-pointer"
                                style={{ 
                                    left: `${Math.floor(i / 1.7) * 48 + 32}px`, // Simple approximation
                                    transform: 'translateX(-50%)'
                                }}
                            ></div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
