'use client'

import React, { useState, useCallback } from 'react'
import { MasteringChain, MasteringChainState, MasteringPresetId, LoudnessData } from '@/engine/audioEngine/index'

interface MasteringPanelProps {
  onStateChange?: (state: MasteringChainState) => void
  loudnessData?: LoudnessData
  className?: string
}

export function MasteringPanel({ onStateChange, loudnessData, className = '' }: MasteringPanelProps) {
  const [chain] = useState(() => new MasteringChain())
  const [presets] = useState(() => chain.getPresets())
  const [state, setState] = useState(() => chain.getState())
  const [expandedSection, setExpandedSection] = useState<string | null>('preset')

  const applyPreset = useCallback((presetId: string) => {
    chain.loadPreset(presetId as MasteringPresetId)
    const newState = chain.getState()
    setState(newState)
    onStateChange?.(newState)
  }, [chain, onStateChange])

  const updateState = useCallback((partial: Partial<MasteringChainState>) => {
    chain.setState(partial)
    const newState = chain.getState()
    setState(newState)
    onStateChange?.(newState)
  }, [chain, onStateChange])

  const updateLimiter = useCallback((partial: Partial<typeof state.limiter>) => {
    chain.setLimiter(partial)
    const newState = chain.getState()
    setState(newState)
    onStateChange?.(newState)
  }, [chain, onStateChange])

  const updateEQ = useCallback((partial: Partial<typeof state.eq>) => {
    chain.setEQ(partial)
    const newState = chain.getState()
    setState(newState)
    onStateChange?.(newState)
  }, [chain, onStateChange])

  const updateMultiband = useCallback((partial: Partial<typeof state.multiband>) => {
    chain.setMultiband(partial)
    const newState = chain.getState()
    setState(newState)
    onStateChange?.(newState)
  }, [chain, onStateChange])

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section)
  }

  const dbToStr = (v: number) => v <= -60 ? '-∞' : v.toFixed(1)
  const lufsToStr = (v: number) => !isFinite(v) ? '-∞' : v.toFixed(1)

  return (
    <div className={`mastering-panel flex flex-col gap-3 text-studio-text select-none ${className}`}
      style={{
        background: 'linear-gradient(180deg, #181a1d 0%, #111214 100%)',
        border: '1px solid #2b2e33',
        borderRadius: '6px',
        padding: '14px',
        width: '100%',
        boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
      }}
    >
      {/* Logic Pro Character Profiles (Clean, Valve, Punch, Transparent) */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[9px] font-black uppercase tracking-wider text-[#8e9094]">Character</span>
        <div className="grid grid-cols-4 gap-1 p-0.5 rounded-[4px] bg-[#0c0d0e] border border-white/5">
          {[
            { id: 'streaming', label: 'Clean' },
            { id: 'club', label: 'Valve' },
            { id: 'broadcast', label: 'Punch' },
            { id: 'audiophile', label: 'Transparent' },
          ].map(char => {
            const active = (state.presetId === char.id) || (state.presetId === 'custom' && char.id === 'streaming');
            return (
              <button
                key={char.id}
                type="button"
                onClick={() => applyPreset(char.id)}
                className={`py-1.5 px-1 rounded-[3px] text-[10px] font-bold transition-all ${active
                  ? 'bg-gradient-to-b from-[#2998c7] to-[#1a6687] text-white shadow-[0_1px_4px_rgba(41,152,199,0.5)]'
                  : 'text-[#8e9094] hover:text-white hover:bg-white/5'}`}
              >
                {char.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Auto EQ & Spectral Shape Display */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-[#8e9094]">
          <span>Auto EQ Spectral Balance</span>
          <span className="text-[#52a9ff] font-mono lowercase">±2.5 dB curve</span>
        </div>
        <div className="h-16 w-full rounded-[4px] bg-[#0b0d0f] border border-[#1f2226] relative overflow-hidden flex items-center justify-center p-1">
          <svg className="w-full h-full" viewBox="0 0 200 60" preserveAspectRatio="none">
            <line x1="0" y1="30" x2="200" y2="30" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3 3" />
            <path
              d="M0 32 Q50 25 100 28 T200 24"
              fill="none"
              stroke="#52a9ff"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* EQ 4-Band Sliders */}
      <div className="p-2.5 rounded-[4px] bg-[#141618] border border-white/5 flex flex-col gap-2">
        <span className="text-[9px] font-black uppercase text-[#8e9094]">Fine EQ Adjustment</span>
        <EQBand label="Low" freq={state.eq.lowShelfFreq} gain={state.eq.lowShelfGain}
          onFreqChange={v => updateEQ({ lowShelfFreq: v })}
          onGainChange={v => updateEQ({ lowShelfGain: v })}
          freqMin={20} freqMax={500} />
        <EQBand label="Low-Mid" freq={state.eq.lowMidFreq} gain={state.eq.lowMidGain} q={state.eq.lowMidQ}
          onFreqChange={v => updateEQ({ lowMidFreq: v })}
          onGainChange={v => updateEQ({ lowMidGain: v })}
          freqMin={20} freqMax={2000} />
        <EQBand label="High-Mid" freq={state.eq.highMidFreq} gain={state.eq.highMidGain} q={state.eq.highMidQ}
          onFreqChange={v => updateEQ({ highMidFreq: v })}
          onGainChange={v => updateEQ({ highMidGain: v })}
          freqMin={500} freqMax={20000} />
        <EQBand label="High" freq={state.eq.highShelfFreq} gain={state.eq.highShelfGain}
          onFreqChange={v => updateEQ({ highShelfFreq: v })}
          onGainChange={v => updateEQ({ highShelfGain: v })}
          freqMin={1000} freqMax={20000} />
      </div>

      {/* Dynamics & True Peak Limiter */}
      <div className="p-2.5 rounded-[4px] bg-[#141618] border border-white/5 flex flex-col gap-2">
        <span className="text-[9px] font-black uppercase text-[#8e9094]">Dynamics & Limiter</span>
        <SliderRow label="Threshold" value={state.limiter.threshold} min={-30} max={0} step={0.1} unit="dB"
          onChange={v => updateLimiter({ threshold: v })} />
        <SliderRow label="Release" value={state.limiter.release} min={0.01} max={0.5} step={0.001} unit="s"
          onChange={v => updateLimiter({ release: v })} />
      </div>

      {/* Spatial Spread & Loudness Target */}
      <div className="p-2.5 rounded-[4px] bg-[#141618] border border-white/5 flex flex-col gap-2">
        <span className="text-[9px] font-black uppercase text-[#8e9094]">Output & Target</span>
        <SliderRow label="Spread (Width)" value={state.stereoWidth} min={0} max={2} step={0.01} unit="x"
          onChange={v => { chain.setStereoWidth(v); updateState({ stereoWidth: v }); }} />
        <SliderRow label="Target Loudness" value={state.loudnessTarget} min={-30} max={0} step={0.5} unit="LUFS"
          onChange={v => { chain.setLoudnessTarget(v); updateState({ loudnessTarget: v }); }} />
      </div>
    </div>
  )
}

function SectionHeader({ title, expanded, onToggle }: { title: string; expanded: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 4px',
        cursor: 'pointer',
        borderTop: '1px solid #222',
        userSelect: 'none',
        fontWeight: 'bold',
        fontSize: '10px',
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}
    >
      {title}
      <span style={{ color: expanded ? '#63ed63' : '#555' }}>{expanded ? '▼' : '▶'}</span>
    </div>
  )
}

function EQBand({ label, freq, gain, q, onFreqChange, onGainChange, freqMin, freqMax }:
  { label: string; freq: number; gain: number; q?: number; onFreqChange: (v: number) => void; onGainChange: (v: number) => void; freqMin: number; freqMax: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ width: '60px', fontSize: '10px', color: '#999' }}>{label}</span>
      <input type="range" min={freqMin} max={freqMax} step={1} value={freq}
        onChange={e => onFreqChange(parseFloat(e.target.value))}
        style={{ flex: 1, height: '3px' }} />
      <span style={{ width: '45px', textAlign: 'right', fontSize: '10px' }}>{freq} Hz</span>
      <input type="range" min={-24} max={24} step={0.5} value={gain}
        onChange={e => onGainChange(parseFloat(e.target.value))}
        style={{ width: '50px', height: '3px' }} />
      <span style={{ width: '35px', textAlign: 'right', fontSize: '10px', color: gain >= 0 ? '#63ed63' : '#e94560' }}>{gain > 0 ? '+' : ''}{gain.toFixed(1)}</span>
    </div>
  )
}

function SliderRow({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ width: '80px', fontSize: '10px', color: '#999' }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, height: '3px' }} />
      <span style={{ width: '50px', textAlign: 'right', fontSize: '10px' }}>{value.toFixed(step < 0.1 ? 2 : 1)} {unit}</span>
    </div>
  )
}

function KnobRow({ label, v1, v2, l1, l2, unit, onV1, onV2 }: {
  label: string; v1: number; v2: number; l1: string; l2: string; unit: string; onV1: (v: number) => void; onV2: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ width: '60px', fontSize: '10px', color: '#999' }}>{label}</span>
      <input type="range" min={20} max={20000} step={1} value={v1}
        onChange={e => onV1(parseFloat(e.target.value))}
        style={{ flex: 1, height: '3px' }} />
      <span style={{ width: '50px', textAlign: 'right', fontSize: '10px' }}>{v1} {unit}</span>
      <input type="range" min={20} max={20000} step={1} value={v2}
        onChange={e => onV2(parseFloat(e.target.value))}
        style={{ flex: 1, height: '3px' }} />
      <span style={{ width: '50px', textAlign: 'right', fontSize: '10px' }}>{v2} {unit}</span>
    </div>
  )
}

function BandRow({ label, threshold, ratio, onThreshold, onRatio }: {
  label: string; threshold: number; ratio: number; onThreshold: (v: number) => void; onRatio: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ width: '30px', fontSize: '10px', color: '#999' }}>{label}</span>
      <input type="range" min={-60} max={0} step={0.5} value={threshold}
        onChange={e => onThreshold(parseFloat(e.target.value))}
        style={{ flex: 1, height: '3px' }} />
      <span style={{ width: '35px', textAlign: 'right', fontSize: '10px' }}>{threshold.toFixed(1)} dB</span>
      <input type="range" min={1} max={20} step={0.1} value={ratio}
        onChange={e => onRatio(parseFloat(e.target.value))}
        style={{ flex: 1, height: '3px' }} />
      <span style={{ width: '30px', textAlign: 'right', fontSize: '10px' }}>{ratio.toFixed(1)}:1</span>
    </div>
  )
}

function MeterRow({ label, value, format, unit }: {
  label: string; value: number; format: (v: number) => string; unit: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '10px' }}>
      <span style={{ color: '#888' }}>{label}</span>
      <span style={{ color: '#fff', fontWeight: 'bold' }}>{format(value)} {unit}</span>
    </div>
  )
}

export default MasteringPanel
