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
    <div className={`mastering-panel ${className}`}
      style={{
        background: '#111',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '12px',
        width: '320px',
        fontSize: '11px',
        color: '#ccc',
        fontFamily: 'monospace',
      }}
    >
      {/* Preset Section */}
      <SectionHeader title="Mastering Chain" expanded={expandedSection === 'preset'} onToggle={() => toggleSection('preset')} />
      {expandedSection === 'preset' && (
        <div style={{ padding: '4px 0' }}>
          <select
            value={state.presetId !== 'custom' ? state.presetId : 'streaming'}
            onChange={e => applyPreset(e.target.value)}
            style={{
              width: '100%',
              background: '#222',
              color: '#fff',
              border: '1px solid #444',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '11px',
            }}
          >
            {presets.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* EQ Section */}
      <SectionHeader title="EQ (4-Band)" expanded={expandedSection === 'eq'} onToggle={() => toggleSection('eq')} />
      {expandedSection === 'eq' && (
        <div style={{ padding: '4px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <EQBand label="Low Shelf" freq={state.eq.lowShelfFreq} gain={state.eq.lowShelfGain}
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
          <EQBand label="High Shelf" freq={state.eq.highShelfFreq} gain={state.eq.highShelfGain}
            onFreqChange={v => updateEQ({ highShelfFreq: v })}
            onGainChange={v => updateEQ({ highShelfGain: v })}
            freqMin={1000} freqMax={20000} />
        </div>
      )}

      {/* Multiband Compressor Section */}
      <SectionHeader title="Multiband Compressor" expanded={expandedSection === 'mbcomp'} onToggle={() => toggleSection('mbcomp')} />
      {expandedSection === 'mbcomp' && (
        <div style={{ padding: '4px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <KnobRow label="Crossovers" v1={state.multiband.crossoverLow} v2={state.multiband.crossoverMid}
            l1="Low" l2="Mid" unit="Hz"
            onV1={v => updateMultiband({ crossoverLow: v })}
            onV2={v => updateMultiband({ crossoverMid: v })} />
          <BandRow label="Low" threshold={state.multiband.lowThreshold} ratio={state.multiband.lowRatio}
            onThreshold={v => updateMultiband({ lowThreshold: v })}
            onRatio={v => updateMultiband({ lowRatio: v })} />
          <BandRow label="Mid" threshold={state.multiband.midThreshold} ratio={state.multiband.midRatio}
            onThreshold={v => updateMultiband({ midThreshold: v })}
            onRatio={v => updateMultiband({ midRatio: v })} />
          <BandRow label="High" threshold={state.multiband.highThreshold} ratio={state.multiband.highRatio}
            onThreshold={v => updateMultiband({ highThreshold: v })}
            onRatio={v => updateMultiband({ highRatio: v })} />
        </div>
      )}

      {/* Limiter Section */}
      <SectionHeader title="Limiter" expanded={expandedSection === 'limiter'} onToggle={() => toggleSection('limiter')} />
      {expandedSection === 'limiter' && (
        <div style={{ padding: '4px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <SliderRow label="Threshold" value={state.limiter.threshold} min={-30} max={0} step={0.1} unit="dB"
            onChange={v => updateLimiter({ threshold: v })} />
          <SliderRow label="Attack" value={state.limiter.attack} min={0.001} max={0.05} step={0.001} unit="s"
            onChange={v => updateLimiter({ attack: v })} />
          <SliderRow label="Release" value={state.limiter.release} min={0.01} max={0.5} step={0.001} unit="s"
            onChange={v => updateLimiter({ release: v })} />
          <SliderRow label="Lookahead" value={state.limiter.lookahead} min={0} max={10} step={0.1} unit="ms"
            onChange={v => updateLimiter({ lookahead: v })} />
        </div>
      )}

      {/* Stereo Width & Loudness Target */}
      <SectionHeader title="Master" expanded={expandedSection === 'master'} onToggle={() => toggleSection('master')} />
      {expandedSection === 'master' && (
        <div style={{ padding: '4px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <SliderRow label="Stereo Width" value={state.stereoWidth} min={0} max={2} step={0.01} unit="x"
            onChange={v => { chain.setStereoWidth(v); updateState({ stereoWidth: v }) }} />
          <SliderRow label="Target Loudness" value={state.loudnessTarget} min={-30} max={0} step={0.5} unit="LUFS"
            onChange={v => { chain.setLoudnessTarget(v); updateState({ loudnessTarget: v }) }} />
        </div>
      )}

      {/* Loudness Meter */}
      <SectionHeader title="Loudness Meter" expanded={expandedSection === 'meter'} onToggle={() => toggleSection('meter')} />
      {expandedSection === 'meter' && loudnessData && (
        <div style={{ padding: '6px 0' }}>
          <MeterRow label="Momentary" value={loudnessData.momentary} format={lufsToStr} unit="LUFS" />
          <MeterRow label="Short Term" value={loudnessData.shortTerm} format={lufsToStr} unit="LUFS" />
          <MeterRow label="Integrated" value={loudnessData.integrated} format={lufsToStr} unit="LUFS" />
          <MeterRow label="True Peak L" value={loudnessData.truePeakLeft} format={dbToStr} unit="dB" />
          <MeterRow label="True Peak R" value={loudnessData.truePeakRight} format={dbToStr} unit="dB" />
          <MeterRow label="Loudness Range" value={loudnessData.loudnessRange} format={v => v.toFixed(1)} unit="LU" />
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <span style={{ color: loudnessData.clipLeft ? '#e94560' : '#666' }}>
              {loudnessData.clipLeft ? 'CLIP L' : 'OK L'}
            </span>
            <span style={{ color: loudnessData.clipRight ? '#e94560' : '#666' }}>
              {loudnessData.clipRight ? 'CLIP R' : 'OK R'}
            </span>
          </div>
        </div>
      )}
      {expandedSection === 'meter' && !loudnessData && (
        <div style={{ padding: '6px 0', color: '#666' }}>No meter data (connect via setMeterCallback)</div>
      )}
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
