"use client"
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useProjectStore } from '@/store/projectStore'
import { audioEngine } from '@/engine/AudioEngineAdapter'
import { EqKnob } from './eq/EqKnob'
import { ModulationMatrix } from '@/engine/modulation/ModulationMatrix'
import { Activity, Disc, Sliders, Waves, Zap, Volume2, Shield, Radio } from 'lucide-react'

interface RetroSynthUIProps {
    trackId: string
    pluginId?: string
}

const OSC_SHAPES = [
    { id: 'sawtooth', label: 'Saw', icon: '📐' },
    { id: 'square', label: 'Pulse', icon: '⏹' },
    { id: 'triangle', label: 'Tri', icon: '▲' },
    { id: 'sine', label: 'Sine', icon: '∿' },
    { id: 'rich', label: 'Rich WT', icon: '🌊' },
    { id: 'gritty', label: 'Gritty WT', icon: '⚡' },
    { id: 'smooth', label: 'Smooth WT', icon: '✨' },
]

const FILTER_TYPES = [
    { id: 'lowpass', label: 'LP 24dB' },
    { id: 'highpass', label: 'HP 12dB' },
    { id: 'bandpass', label: 'BP 12dB' },
]

const LFO_TARGETS = [
    { id: 'filter', label: 'Cutoff' },
    { id: 'pitch', label: 'Pitch' },
    { id: 'amplitude', label: 'Amp' },
]

export function RetroSynthUI({ trackId, pluginId }: RetroSynthUIProps) {
    const tracks = useProjectStore(s => s.tracks)
    const updatePluginParams = useProjectStore(s => s.updatePluginParams)
    const track = tracks.find(t => t.id === trackId)
    const plugin = track?.plugins.find(p => p.id === pluginId)

    // Synth Parameters State
    const [osc1Shape, setOsc1Shape] = useState<string>('sawtooth')
    const [osc1Detune, setOsc1Detune] = useState<number>(0)
    const [osc1Mix, setOsc1Mix] = useState<number>(0.5)

    const [osc2Shape, setOsc2Shape] = useState<string>('square')
    const [osc2Detune, setOsc2Detune] = useState<number>(7)
    const [osc2Mix, setOsc2Mix] = useState<number>(0.5)

    const [filterCutoff, setFilterCutoff] = useState<number>(1800)
    const [filterResonance, setFilterResonance] = useState<number>(2.5)
    const [filterType, setFilterType] = useState<BiquadFilterType>('lowpass')

    const [attack, setAttack] = useState<number>(0.02)
    const [decay, setDecay] = useState<number>(0.3)
    const [sustain, setSustain] = useState<number>(0.7)
    const [release, setRelease] = useState<number>(0.4)

    const [lfoRate, setLfoRate] = useState<number>(3.5)
    const [lfoDepth, setLfoDepth] = useState<number>(0.35)
    const [lfoTarget, setLfoTarget] = useState<string>('filter')

    const [glide, setGlide] = useState<number>(0.0)
    const [volume, setVolume] = useState<number>(0.8)

    // Load initial parameters from plugin if available
    useEffect(() => {
        if (plugin?.params) {
            const p = plugin.params
            if (p.osc1Detune !== undefined) setOsc1Detune(p.osc1Detune)
            if (p.osc1Mix !== undefined) setOsc1Mix(p.osc1Mix)
            if (p.osc2Detune !== undefined) setOsc2Detune(p.osc2Detune)
            if (p.osc2Mix !== undefined) setOsc2Mix(p.osc2Mix)
            if (p.filterCutoff !== undefined) setFilterCutoff(p.filterCutoff)
            if (p.filterResonance !== undefined) setFilterResonance(p.filterResonance)
            if (p.attack !== undefined) setAttack(p.attack)
            if (p.decay !== undefined) setDecay(p.decay)
            if (p.sustain !== undefined) setSustain(p.sustain)
            if (p.release !== undefined) setRelease(p.release)
            if (p.lfoRate !== undefined) setLfoRate(p.lfoRate)
            if (p.lfoDepth !== undefined) setLfoDepth(p.lfoDepth)
            if (p.glide !== undefined) setGlide(p.glide)
        }
    }, [plugin])

    const commitParams = useCallback(() => {
        if (!pluginId) return
        updatePluginParams(trackId, pluginId, {
            osc1Detune,
            osc1Mix,
            osc2Detune,
            osc2Mix,
            filterCutoff,
            filterResonance,
            attack,
            decay,
            sustain,
            release,
            lfoRate,
            lfoDepth,
            glide,
        })
    }, [trackId, pluginId, updatePluginParams, osc1Detune, osc1Mix, osc2Detune, osc2Mix, filterCutoff, filterResonance, attack, decay, sustain, release, lfoRate, lfoDepth, glide])

    // Mini Waveform visualizer canvas
    const canvasRef = useRef<HTMLCanvasElement>(null)
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const w = canvas.width
        const h = canvas.height
        ctx.fillStyle = '#0a0d14'
        ctx.fillRect(0, 0, w, h)

        ctx.strokeStyle = '#06b6d4'
        ctx.lineWidth = 2
        ctx.beginPath()

        const cycles = 3
        for (let x = 0; x < w; x++) {
            const t = (x / w) * Math.PI * 2 * cycles
            let yVal = 0
            if (osc1Shape === 'sawtooth') yVal += (1 - (t % (Math.PI * 2)) / Math.PI) * osc1Mix
            else if (osc1Shape === 'square') yVal += (Math.sin(t) >= 0 ? 1 : -1) * osc1Mix
            else if (osc1Shape === 'triangle') yVal += (Math.asin(Math.sin(t)) / (Math.PI / 2)) * osc1Mix
            else yVal += Math.sin(t) * osc1Mix

            const t2 = t * (1 + osc2Detune / 2400)
            if (osc2Shape === 'sawtooth') yVal += (1 - (t2 % (Math.PI * 2)) / Math.PI) * osc2Mix
            else if (osc2Shape === 'square') yVal += (Math.sin(t2) >= 0 ? 1 : -1) * osc2Mix
            else if (osc2Shape === 'triangle') yVal += (Math.asin(Math.sin(t2)) / (Math.PI / 2)) * osc2Mix
            else yVal += Math.sin(t2) * osc2Mix

            const y = h / 2 - (yVal * (h * 0.35)) / Math.max(1, osc1Mix + osc2Mix)
            if (x === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
        }
        ctx.stroke()
    }, [osc1Shape, osc1Mix, osc2Shape, osc2Mix, osc2Detune])

    return (
        <div className="w-[740px] bg-studio-panel border border-studio-border rounded-xl shadow-2xl overflow-hidden select-none text-white">
            {/* Header */}
            <div className="h-11 px-4 bg-black/60 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded bg-accent-cyan/20 border border-accent-cyan/40 flex items-center justify-center">
                        <Waves className="w-3.5 h-3.5 text-accent-cyan" />
                    </div>
                    <span className="font-bold text-sm tracking-wide text-white">Retro Synth</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-studio-text-dim uppercase font-semibold">
                        Polyphonic Wavetable
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-studio-text-dim">Voice Polyphony: 8</span>
                    <div className="h-4 w-px bg-white/10" />
                    <button
                        onClick={() => audioEngine.triggerNote(trackId, 60, 100, undefined, 'analog_pad')}
                        className="px-2.5 py-1 text-[11px] font-bold rounded bg-accent-cyan/20 border border-accent-cyan/40 text-accent-cyan hover:bg-accent-cyan hover:text-black transition-all flex items-center gap-1.5"
                    >
                        <Zap className="w-3 h-3" /> Audition C3
                    </button>
                </div>
            </div>

            {/* Main Synth Sections */}
            <div className="p-4 grid grid-cols-4 gap-3 bg-[#0d1219]">
                {/* OSCILLATORS SECTION */}
                <div className="col-span-2 bg-black/40 border border-white/5 rounded-lg p-3.5 flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                        <span className="text-xs font-black uppercase tracking-wider text-accent-cyan flex items-center gap-1.5">
                            <Disc className="w-3.5 h-3.5" /> Oscillators
                        </span>
                        <canvas ref={canvasRef} width={140} height={32} className="rounded border border-white/10 bg-black/80" />
                    </div>

                    {/* OSC 1 */}
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-studio-text-mid">Oscillator 1</span>
                            <span className="text-[10px] font-mono text-studio-text-dim">{osc1Shape}</span>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {OSC_SHAPES.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => { setOsc1Shape(s.id); commitParams(); }}
                                    className={`py-1 text-[10px] rounded border font-semibold flex flex-col items-center justify-center transition-all ${
                                        osc1Shape === s.id
                                            ? 'bg-accent-cyan/30 border-accent-cyan text-white shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                                            : 'bg-white/5 border-white/5 text-studio-text-dim hover:bg-white/10'
                                    }`}
                                >
                                    <span className="text-xs">{s.icon}</span>
                                    <span className="text-[8px] truncate max-w-full">{s.label.split(' ')[0]}</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center justify-around pt-1">
                            <EqKnob
                                label="Detune"
                                value={osc1Detune}
                                min={-100}
                                max={100}
                                defaultValue={0}
                                color="#22d3ee"
                                onChange={v => setOsc1Detune(Math.round(v))}
                                onCommit={commitParams}
                            />
                            <EqKnob
                                label="Mix"
                                value={osc1Mix}
                                min={0}
                                max={1}
                                defaultValue={0.5}
                                color="#22d3ee"
                                onChange={v => setOsc1Mix(v)}
                                onCommit={commitParams}
                            />
                        </div>
                    </div>

                    <div className="h-px bg-white/5" />

                    {/* OSC 2 */}
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-studio-text-mid">Oscillator 2</span>
                            <span className="text-[10px] font-mono text-studio-text-dim">{osc2Shape}</span>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {OSC_SHAPES.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => { setOsc2Shape(s.id); commitParams(); }}
                                    className={`py-1 text-[10px] rounded border font-semibold flex flex-col items-center justify-center transition-all ${
                                        osc2Shape === s.id
                                            ? 'bg-accent-cyan/30 border-accent-cyan text-white shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                                            : 'bg-white/5 border-white/5 text-studio-text-dim hover:bg-white/10'
                                    }`}
                                >
                                    <span className="text-xs">{s.icon}</span>
                                    <span className="text-[8px] truncate max-w-full">{s.label.split(' ')[0]}</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center justify-around pt-1">
                            <EqKnob
                                label="Detune"
                                value={osc2Detune}
                                min={-1200}
                                max={1200}
                                defaultValue={7}
                                color="#22d3ee"
                                onChange={v => setOsc2Detune(Math.round(v))}
                                onCommit={commitParams}
                            />
                            <EqKnob
                                label="Mix"
                                value={osc2Mix}
                                min={0}
                                max={1}
                                defaultValue={0.5}
                                color="#22d3ee"
                                onChange={v => setOsc2Mix(v)}
                                onCommit={commitParams}
                            />
                        </div>
                    </div>
                </div>

                {/* FILTER SECTION */}
                <div className="bg-black/40 border border-white/5 rounded-lg p-3.5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-3">
                            <span className="text-xs font-black uppercase tracking-wider text-accent-cyan flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5" /> Filter
                            </span>
                        </div>

                        <div className="flex gap-1 mb-4">
                            {FILTER_TYPES.map(ft => (
                                <button
                                    key={ft.id}
                                    onClick={() => { setFilterType(ft.id as BiquadFilterType); commitParams(); }}
                                    className={`flex-1 py-1 text-[9px] font-bold rounded border transition-all ${
                                        filterType === ft.id
                                            ? 'bg-accent-cyan text-black border-accent-cyan font-black'
                                            : 'bg-white/5 border-white/10 text-studio-text-dim hover:bg-white/10'
                                    }`}
                                >
                                    {ft.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-col items-center gap-4">
                            <EqKnob
                                label="Cutoff (Hz)"
                                value={filterCutoff}
                                min={40}
                                max={16000}
                                defaultValue={1800}
                                size={44}
                                color="#10b981"
                                onChange={v => setFilterCutoff(Math.round(v))}
                                onCommit={commitParams}
                            />
                            <EqKnob
                                label="Resonance Q"
                                value={filterResonance}
                                min={0.1}
                                max={20}
                                defaultValue={2.5}
                                size={40}
                                color="#10b981"
                                onChange={v => setFilterResonance(v)}
                                onCommit={commitParams}
                            />
                        </div>
                    </div>

                    <div className="pt-2 border-t border-white/10 flex justify-center">
                        <EqKnob
                            label="Glide (s)"
                            value={glide}
                            min={0}
                            max={1.0}
                            defaultValue={0}
                            size={32}
                            color="#f59e0b"
                            onChange={v => setGlide(v)}
                            onCommit={commitParams}
                        />
                    </div>
                </div>

                {/* MODULATION & ENVELOPE SECTION */}
                <div className="bg-black/40 border border-white/5 rounded-lg p-3.5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2.5">
                            <span className="text-xs font-black uppercase tracking-wider text-accent-cyan flex items-center gap-1.5">
                                <Radio className="w-3.5 h-3.5" /> LFO Mod
                            </span>
                        </div>

                        <div className="flex gap-1 mb-2">
                            {LFO_TARGETS.map(lt => (
                                <button
                                    key={lt.id}
                                    onClick={() => { setLfoTarget(lt.id); commitParams(); }}
                                    className={`flex-1 py-1 text-[9px] font-bold rounded border transition-all ${
                                        lfoTarget === lt.id
                                            ? 'bg-accent-cyan text-black border-accent-cyan font-black'
                                            : 'bg-white/5 border-white/10 text-studio-text-dim hover:bg-white/10'
                                    }`}
                                >
                                    {lt.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center justify-around py-1">
                            <EqKnob
                                label="Rate (Hz)"
                                value={lfoRate}
                                min={0.1}
                                max={20}
                                defaultValue={3.5}
                                size={34}
                                color="#ec4899"
                                onChange={v => setLfoRate(v)}
                                onCommit={commitParams}
                            />
                            <EqKnob
                                label="Depth"
                                value={lfoDepth}
                                min={0}
                                max={1}
                                defaultValue={0.35}
                                size={34}
                                color="#ec4899"
                                onChange={v => setLfoDepth(v)}
                                onCommit={commitParams}
                            />
                        </div>
                    </div>

                    {/* ADSR Envelope */}
                    <div className="border-t border-white/10 pt-2 flex flex-col gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-studio-text-dim">
                            ADSR Envelope
                        </span>
                        <div className="grid grid-cols-4 gap-1">
                            <EqKnob
                                label="A"
                                value={attack}
                                min={0.001}
                                max={3}
                                defaultValue={0.02}
                                size={28}
                                color="#38bdf8"
                                onChange={v => setAttack(v)}
                                onCommit={commitParams}
                            />
                            <EqKnob
                                label="D"
                                value={decay}
                                min={0.01}
                                max={3}
                                defaultValue={0.3}
                                size={28}
                                color="#38bdf8"
                                onChange={v => setDecay(v)}
                                onCommit={commitParams}
                            />
                            <EqKnob
                                label="S"
                                value={sustain}
                                min={0}
                                max={1}
                                defaultValue={0.7}
                                size={28}
                                color="#38bdf8"
                                onChange={v => setSustain(v)}
                                onCommit={commitParams}
                            />
                            <EqKnob
                                label="R"
                                value={release}
                                min={0.01}
                                max={5}
                                defaultValue={0.4}
                                size={28}
                                color="#38bdf8"
                                onChange={v => setRelease(v)}
                                onCommit={commitParams}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RetroSynthUI;
