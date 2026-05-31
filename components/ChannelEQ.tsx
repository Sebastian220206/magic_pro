"use client"
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useProjectStore } from '@/store/projectStore'
import { audioEngine } from '@/engine/AudioEngineAdapter'
import { 
    ChevronDown, Power, Maximize2
} from 'lucide-react'

type BandType = 'highpass' | 'lowshelf' | 'peaking' | 'highshelf' | 'lowpass';

interface EQBand {
    type: BandType
    freq: number
    gain: number
    q: number
    enabled: boolean
    color: string
}

export function ChannelEQ({ trackId, pluginId }: { trackId: string, pluginId: string }) {
    const { updatePluginParams, tracks } = useProjectStore()
    const track = tracks.find(t => t.id === trackId)
    const plugin = track?.plugins.find(p => p.id === pluginId)

    const [bands, setBands] = useState<EQBand[]>([
        { type: 'highpass', freq: 30, gain: plugin?.params?.band1_gain ?? 0, q: plugin?.params?.band1_q ?? 0.71, enabled: (plugin?.params?.band1_enabled ?? 1) === 1, color: '#4A90E2' },
        { type: 'lowshelf', freq: 78, gain: plugin?.params?.band2_gain ?? 7.5, q: plugin?.params?.band2_q ?? 1.10, enabled: (plugin?.params?.band2_enabled ?? 1) === 1, color: '#F5A623' },
        { type: 'peaking', freq: 200, gain: plugin?.params?.band3_gain ?? 0, q: plugin?.params?.band3_q ?? 0.98, enabled: (plugin?.params?.band3_enabled ?? 1) === 1, color: '#F8E71C' },
        { type: 'peaking', freq: 890, gain: plugin?.params?.band4_gain ?? -9.5, q: plugin?.params?.band4_q ?? 0.71, enabled: (plugin?.params?.band4_enabled ?? 1) === 1, color: '#7ED321' },
        { type: 'peaking', freq: 1200, gain: plugin?.params?.band5_gain ?? 0, q: plugin?.params?.band5_q ?? 0.71, enabled: (plugin?.params?.band5_enabled ?? 1) === 1, color: '#50E3C2' },
        { type: 'peaking', freq: 2800, gain: plugin?.params?.band6_gain ?? 3.5, q: plugin?.params?.band6_q ?? 0.71, enabled: (plugin?.params?.band6_enabled ?? 1) === 1, color: '#4A90E2' },
        { type: 'highshelf', freq: 7400, gain: plugin?.params?.band7_gain ?? 7.0, q: plugin?.params?.band7_q ?? 0.71, enabled: (plugin?.params?.band7_enabled ?? 1) === 1, color: '#9013FE' },
        { type: 'lowpass', freq: 17000, gain: plugin?.params?.band8_gain ?? 0, q: plugin?.params?.band8_q ?? 0.71, enabled: (plugin?.params?.band8_enabled ?? 1) === 1, color: '#929CAD' },
    ])

    const [masterGain, setMasterGain] = useState(plugin?.params?.master_gain ?? 0)
    const [analyzerEnabled, setAnalyzerEnabled] = useState(true)
    const [analyzerPost, setAnalyzerPost] = useState(false)
    const [qCouple, setQCouple] = useState(false)
    const [viewZoom, setViewZoom] = useState(1.25)
    
    const [draggingBandIndex, setDraggingBandIndex] = useState<number | null>(null)
    const [dragMode, setDragMode] = useState<'freq-gain' | 'q'>('freq-gain')
    const [originalBands, setOriginalBands] = useState<EQBand[] | null>(null)
    const [processingMode, setProcessingMode] = useState<'Stereo' | 'Mono' | 'Side' | 'Mid'>('Stereo')
    const [showPresets, setShowPresets] = useState(false)

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const requestRef = useRef<number>()

    const [isPowered, setIsPowered] = useState(plugin?.enabled ?? true)

    // Dependencies Ref for the animation loop
    const stateRef = useRef({ bands, analyzerEnabled, analyzerPost, qCouple, viewZoom });
    useEffect(() => {
        stateRef.current = { bands, analyzerEnabled, analyzerPost, qCouple, viewZoom };
    }, [bands, analyzerEnabled, analyzerPost, qCouple, viewZoom]);

    const PRESETS: Array<{ name: string, bands: Partial<EQBand>[], master: number }> = [
        { name: 'Default', bands: [
            { type: 'highpass', freq: 30, gain: 0, q: 0.71, enabled: true },
            { type: 'lowshelf', freq: 80, gain: 0, q: 0.71, enabled: true },
            { type: 'peaking', freq: 200, gain: 0, q: 0.71, enabled: true },
            { type: 'peaking', freq: 500, gain: 0, q: 0.71, enabled: true },
            { type: 'peaking', freq: 1200, gain: 0, q: 0.71, enabled: true },
            { type: 'peaking', freq: 3000, gain: 0, q: 0.71, enabled: true },
            { type: 'highshelf', freq: 8000, gain: 0, q: 0.71, enabled: true },
            { type: 'lowpass', freq: 18000, gain: 0, q: 0.71, enabled: true },
        ], master: 0 },
        { name: 'Vocal Boost', bands: [
            { type: 'highpass', freq: 80, gain: 0, q: 0.71, enabled: true },
            { type: 'peaking' as const, freq: 300, gain: -3, q: 0.8, enabled: true },
            { type: 'peaking' as const, freq: 3000, gain: 4, q: 0.71, enabled: true },
            { type: 'highshelf' as const, freq: 10000, gain: 3, q: 0.71, enabled: true },
        ], master: -2 },
        { name: 'Bass Cut', bands: [
            { type: 'highpass' as const, freq: 120, gain: 0, q: 0.9, enabled: true },
        ], master: 0 },
    ]

    const applyPreset = (preset: typeof PRESETS[0]) => {
        const newBands = bands.map((b, i) => {
            const p = preset.bands[i] || {};
            return { ...b, ...p } as EQBand;
        });
        setBands(newBands);
        setMasterGain(preset.master);
        syncBandsToStore(newBands, preset.master);
        setShowPresets(false);
    }

    useEffect(() => {
        if (!plugin?.params) return;
        setBands(b => b.map((band, i) => {
            const prefix = `band${i+1}`;
            return {
                ...band,
                freq: plugin.params[`${prefix}_freq`] ?? band.freq,
                gain: plugin.params[`${prefix}_gain`] ?? band.gain,
                q: plugin.params[`${prefix}_q`] ?? band.q,
                enabled: plugin.params[`${prefix}_enabled`] !== undefined ? plugin.params[`${prefix}_enabled`] === 1 : band.enabled
            };
        }));
        setMasterGain(plugin.params.master_gain ?? 0);
        setIsPowered(plugin.enabled ?? true);
    }, [pluginId, trackId, plugin?.params, plugin?.enabled]);

    const handlePowerToggle = () => {
        const newState = !isPowered;
        setIsPowered(newState);
        syncBandsToStore(bands, masterGain);
    }

    const logScale = useCallback((freq: number, width: number) => {
        const minFreq = 20
        const maxFreq = 20000
        return (Math.log10(freq / minFreq) / Math.log10(maxFreq / minFreq)) * width
    }, [])

    const xToFreq = useCallback((x: number, width: number) => {
        const minFreq = 20
        const maxFreq = 20000
        return minFreq * Math.pow(maxFreq / minFreq, x / width)
    }, [])

    const gainToY = useCallback((gain: number, height: number) => {
        const mid = height / 2
        return mid - (gain / 30) * (height / 2)
    }, [])

    const yToGain = useCallback((y: number, height: number) => {
        const mid = height / 2;
        return ((mid - y) / (height / 2)) * 30;
    }, []);

    const syncBandsToStore = (bandsToSync: EQBand[], mGain: number) => {
        const params: Record<string, number> = {}
        bandsToSync.forEach((b, i) => {
            const prefix = `band${i+1}`
            params[`${prefix}_freq`] = b.freq
            params[`${prefix}_gain`] = b.gain
            params[`${prefix}_q`] = b.q
            params[`${prefix}_enabled`] = b.enabled ? 1 : 0
        })
        params['master_gain'] = mGain
        updatePluginParams(trackId, pluginId, params)
    }

    const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / viewZoom;
        const y = (e.clientY - rect.top) / viewZoom;

        const radius = 25;
        for (let i = 0; i < bands.length; i++) {
            if (!bands[i].enabled) continue;
            const nodeX = logScale(bands[i].freq, 880);
            const nodeY = gainToY(bands[i].gain, 320);
            const dist = Math.sqrt((x - nodeX) ** 2 + (y - nodeY) ** 2);
            if (dist < radius) {
                setDraggingBandIndex(i);
                setDragMode(e.shiftKey ? 'q' : 'freq-gain');
                return;
            }
        }
    };

    const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (draggingBandIndex === null) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / viewZoom;
        const y = (e.clientY - rect.top) / viewZoom;

        const newBands = [...bands];
        const band = { ...newBands[draggingBandIndex] };

        if (dragMode === 'freq-gain') {
            const newFreq = Math.max(20, Math.min(20000, xToFreq(x, 880)));
            const newGain = Math.max(-24, Math.min(24, yToGain(y, 320)));
            band.freq = newFreq;
            band.gain = newGain;

            if (qCouple) {
                const gainRatio = Math.abs(newGain) / 10;
                band.q = Math.max(0.1, Math.min(10, 0.71 * (1 + gainRatio)));
            }
        } else {
            const deltaX = (x - logScale(band.freq, 880)) / 50;
            const prevQ = band.q;
            band.q = Math.max(0.1, Math.min(24, band.q + deltaX));
            
            if (qCouple && prevQ > 0) {
                const ratio = band.q / prevQ;
                newBands.forEach((b, idx) => {
                    if (idx !== draggingBandIndex && b.enabled) {
                        b.q = Math.max(0.1, Math.min(24, b.q * ratio));
                    }
                });
            }
        }

        newBands[draggingBandIndex] = band;
        setBands(newBands);
        syncBandsToStore(newBands, masterGain);
    };

    const onMouseUp = () => setDraggingBandIndex(null);

    // Sub-drawing functions
    const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
        ctx.lineWidth = 1
        ctx.font = 'bold 9px "Inter", sans-serif'
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'

        const freqs = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
        freqs.forEach(f => {
            const x = logScale(f, width)
            ctx.beginPath()
            ctx.setLineDash([2, 4])
            ctx.moveTo(x, 0)
            ctx.lineTo(x, height)
            ctx.stroke()
            ctx.setLineDash([])
            ctx.fillText(f >= 1000 ? `${f/1000}k` : f.toString(), x - 5, height - 82)
        })

        const gains = [30, 20, 10, 5, 0, -5, -10, -20, -30]
        gains.forEach(g => {
            const y = gainToY(g, height)
            ctx.beginPath()
            ctx.strokeStyle = g === 0 ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)'
            ctx.moveTo(0, y)
            ctx.lineTo(width, y)
            ctx.stroke()
            ctx.fillText(g.toString(), 8, y + 3)
            ctx.fillText(g.toString(), width - 20, y + 3)
        })
    }

    const drawAnalyzer = (ctx: CanvasRenderingContext2D, width: number, height: number, post: boolean) => {
        const analyzer = audioEngine.getEQAnalyzer(trackId, pluginId, post)
        if (!analyzer) return
        analyzer.fftSize = 4096
        const bufferLength = analyzer.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)
        analyzer.getByteFrequencyData(dataArray)

        ctx.beginPath()
        ctx.strokeStyle = post ? '#ff00ff' : '#00f2ff' // Bright neon colors
        ctx.lineWidth = 1.5
        ctx.fillStyle = post ? 'rgba(255, 0, 255, 0.15)' : 'rgba(0, 242, 255, 0.08)'

        const sampleRate = audioEngine.getSampleRate();
        let hasSignal = false;
        
        for (let i = 0; i < bufferLength; i++) {
            const freq = i * sampleRate / (bufferLength * 2)
            if (freq < 20) continue
            if (freq > 20000) break
            const x = logScale(freq, width)
            const val = dataArray[i] / 255
            if (val > 0.01) hasSignal = true;
            
            // Logarithmic volume curve for more visibility in quiet parts
            const y = height - (Math.pow(val, 0.6) * height * 0.8)
            
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
        }
        ctx.lineTo(width, height)
        ctx.lineTo(0, height)
        ctx.stroke()
        ctx.fill()
        
        // Signal Indicator
        ctx.fillStyle = hasSignal ? '#4ade80' : '#ef4444'
        ctx.beginPath()
        ctx.arc(width - 20, 20, 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.font = '10px sans-serif'
        ctx.fillText(hasSignal ? 'SIGNAL OK' : 'NO SIGNAL', width - 85, 24)
    }

    const freqArrayRef = useRef<Float32Array>(new Float32Array(820))
    useEffect(() => {
        const arr = new Float32Array(820)
        for (let x = 0; x < 820; x++) arr[x] = xToFreq(x, 820)
        freqArrayRef.current = arr
    }, [])

    const calculateFullResponse = useCallback((width: number): number[] => {
        const magResponse = audioEngine.getEQFrequencyResponse(trackId, pluginId, freqArrayRef.current)
        const data: number[] = []
        for (let x = 0; x < magResponse.length; x++) {
            const mag = Math.max(0.001, magResponse[x])
            const db = 20 * Math.log10(mag)
            data.push(db)
        }
        return data
    }, [trackId, pluginId]);

    const drawFilledCurve = (ctx: CanvasRenderingContext2D, data: number[], width: number, height: number) => {
        const gradient = ctx.createLinearGradient(0, 0, 0, height)
        gradient.addColorStop(0, 'rgba(100, 150, 200, 0.15)')
        gradient.addColorStop(0.5, 'rgba(100, 150, 200, 0.1)')
        gradient.addColorStop(1, 'rgba(100, 150, 200, 0.02)')
        ctx.beginPath()
        ctx.fillStyle = gradient
        for (let x = 0; x < data.length; x++) {
            const y = gainToY(data[x], height)
            if (x === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
        }
        ctx.lineTo(width, height)
        ctx.lineTo(0, height)
        ctx.closePath()
        ctx.fill()
    }

    const drawGlowLine = (ctx: CanvasRenderingContext2D, data: number[], width: number) => {
        ctx.beginPath()
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
        ctx.lineWidth = 1.5
        for (let x = 0; x < data.length; x++) {
            const y = gainToY(data[x], 320)
            if (x === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
        }
        ctx.stroke()
    }

    const drawBandInfluence = (ctx: CanvasRenderingContext2D, width: number, height: number, localBands: EQBand[]) => {
        localBands.forEach(b => {
            if (!b.enabled || Math.abs(b.gain) < 0.5) return
            const x = logScale(b.freq, width)
            const y = gainToY(b.gain, height)
            const midY = height / 2
            ctx.beginPath()
            ctx.fillStyle = `${b.color}22`
            if (b.type === 'peaking') {
                const spread = 150 / b.q
                ctx.moveTo(x - spread, midY)
                ctx.quadraticCurveTo(x, y, x + spread, midY)
            } else {
                const grad = ctx.createRadialGradient(x, y, 0, x, y, 200)
                grad.addColorStop(0, `${b.color}33`)
                grad.addColorStop(1, 'transparent')
                ctx.fillStyle = grad
                ctx.fillRect(0, 0, width, height)
                return;
            }
            ctx.fill()
        })
    }

    const drawNodes = (ctx: CanvasRenderingContext2D, width: number, height: number, localBands: EQBand[]) => {
        localBands.forEach((b, i) => {
            if (!b.enabled) return
            const x = logScale(b.freq, width)
            const y = gainToY(b.gain, height)
            ctx.beginPath()
            ctx.arc(x, y, 6, 0, Math.PI * 2)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
            ctx.lineWidth = 1.5
            ctx.stroke()
            ctx.beginPath()
            ctx.arc(x, y, 2, 0, Math.PI * 2)
            ctx.fillStyle = 'white'
            ctx.fill()
        })
    }

    const animate = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const { bands: localBands, analyzerEnabled: aEn, analyzerPost: aPost } = stateRef.current;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Background
        const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height)
        bgGrad.addColorStop(0, '#0d1520')
        bgGrad.addColorStop(1, '#081016')
        ctx.fillStyle = bgGrad
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        drawGrid(ctx, canvas.width, canvas.height)
        if (aEn) drawAnalyzer(ctx, canvas.width, canvas.height, aPost)
        
        const responseData = calculateFullResponse(canvas.width)
        drawFilledCurve(ctx, responseData, canvas.width, canvas.height)
        drawBandInfluence(ctx, canvas.width, canvas.height, localBands)
        drawGlowLine(ctx, responseData, canvas.width)
        drawNodes(ctx, canvas.width, canvas.height, localBands)
        
        requestRef.current = requestAnimationFrame(animate)
    }, [calculateFullResponse]);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate)
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current)
        }
    }, [animate])

    const handleParamChange = (index: number, key: keyof EQBand, value: any) => {
        const newBands = [...bands]
        newBands[index] = { ...newBands[index], [key]: value } as EQBand
        setBands(newBands)
        syncBandsToStore(newBands, masterGain)
    }

    const handleMasterGainChange = (val: number) => {
        setMasterGain(val)
        syncBandsToStore(bands, val)
    }

    const handleCopy = () => localStorage.setItem('daw_eq_clipboard', JSON.stringify({ bands, masterGain }))
    const handlePaste = () => {
        const raw = localStorage.getItem('daw_eq_clipboard')
        if (raw) {
            const data = JSON.parse(raw)
            setBands(data.bands); setMasterGain(data.masterGain);
            syncBandsToStore(data.bands, data.masterGain)
        }
    }
    const handleCompare = () => {
        if (originalBands) { setBands(originalBands); syncBandsToStore(originalBands, masterGain); setOriginalBands(null); }
        else { setOriginalBands([...bands]); }
    }

    return (
        <div 
            className="flex flex-col bg-[#1a1a1e] rounded-xl border border-black shadow-[0_40px_100px_rgba(0,0,0,1)] overflow-hidden font-sans select-none text-white ring-1 ring-white/10 origin-top-left"
            style={{ width: '880px', height: '580px', transform: `scale(${viewZoom})` }}
        >
            <div className="h-[52px] bg-gradient-to-b from-[#2a2a2e] to-[#1e1e22] border-b border-black flex items-center px-4 justify-between relative shadow-lg">
                <div className="flex items-center gap-4">
                    <button onClick={handlePowerToggle} className={`flex items-center justify-center w-7 h-7 rounded-full ring-1 shadow-inner transition-all ${isPowered ? 'bg-sky-500/80 ring-sky-400 text-white shadow-[0_0_10px_rgba(56,189,248,0.5)]' : 'bg-white/10 ring-white/20 text-gray-500'}`}>
                        <Power className={`w-3.5 h-3.5 ${isPowered ? 'animate-pulse' : ''}`} />
                    </button>
                    <div className="flex flex-col relative">
                        <div onClick={() => setShowPresets(!showPresets)} className="flex items-center gap-2 bg-black/40 px-3 h-8 rounded-md border border-white/5 shadow-inner cursor-pointer hover:bg-black/60 transition-colors">
                            <span className="text-[12px] font-bold text-gray-300">Loudness EQ</span>
                            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                        </div>
                        {showPresets && (
                            <div className="absolute top-10 left-0 w-48 bg-[#2a2a2e] border border-black rounded-md shadow-2xl z-[100] py-1">
                                {PRESETS.map(p => (
                                    <div key={p.name} onClick={() => applyPreset(p)} className="px-4 py-2 hover:bg-sky-500/20 cursor-pointer text-[12px] font-bold text-gray-300">
                                        {p.name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-px bg-black/20 p-px rounded border border-white/5 mx-2">
                        <button onClick={handleCompare} className={`px-2 h-6 text-[9px] font-black uppercase transition-colors border-r border-white/5 ${originalBands ? 'text-sky-400' : 'text-gray-500'}`}>Compare</button>
                        <button onClick={handleCopy} className="px-3 h-6 text-[9px] font-black uppercase text-gray-300 hover:text-white transition-colors border-r border-white/5">Copy</button>
                        <button onClick={handlePaste} className="px-3 h-6 text-[9px] font-black uppercase text-gray-300 hover:text-white transition-colors">Paste</button>
                    </div>
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
                    <div className="text-[11px] font-bold tracking-tight text-gray-400">
                        {track?.name || 'Unknown Track'} • Channel EQ
                    </div>
                    <div className="text-[7px] text-gray-600 font-mono tracking-tighter">
                        TRK: {trackId.slice(0,8)}... FX: {pluginId.slice(0,8)}...
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-[11px] text-gray-500 font-bold cursor-pointer" onClick={() => setViewZoom(prev => prev === 1 ? 1.25 : 1)}>
                        View: <span className="text-gray-300 bg-black/40 px-2 py-0.5 rounded ml-1 tracking-tight">{(viewZoom * 100).toFixed(0)}%</span>
                    </div>
                    <Maximize2 className="w-4 h-4 text-gray-500 hover:text-white cursor-pointer transition-colors" />
                </div>
            </div>

            <div className="flex justify-around items-center h-16 bg-[#161b22] border-b border-black px-12 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
                {bands.map((b, i) => (
                    <button key={i} onClick={() => handleParamChange(i, 'enabled', !b.enabled)} className={`transition-all duration-300 ${b.enabled ? 'filter drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]' : 'opacity-20 translate-y-1'}`}>
                        <FilterIcon type={b.type} color={b.enabled ? b.color : '#666'} />
                    </button>
                ))}
            </div>

            <div className="relative flex-1 bg-black overflow-hidden group">
                <canvas ref={canvasRef} width={880} height={320} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} className="relative z-10 w-full h-full cursor-crosshair" />
                <div className="absolute bottom-4 left-6 z-20 flex items-center gap-2">
                    <div className="flex bg-black/60 backdrop-blur-md rounded-lg p-0.5 border border-white/10 shadow-2xl overflow-hidden">
                        <button onClick={() => setAnalyzerEnabled(!analyzerEnabled)} className={`px-3 py-1.5 text-[9px] font-black uppercase rounded transition-all ${analyzerEnabled ? 'text-sky-400 bg-sky-500/20' : 'text-gray-600'}`}>Analyzer</button>
                        <button onClick={() => setAnalyzerPost(false)} className={`px-3 py-1.5 text-[9px] font-black uppercase rounded transition-all ${!analyzerPost ? 'bg-white/10 text-white' : 'text-gray-600'}`}>Pre</button>
                        <button onClick={() => setAnalyzerPost(true)} className={`px-3 py-1.5 text-[9px] font-black uppercase rounded transition-all ${analyzerPost ? 'bg-white/10 text-white' : 'text-gray-600'}`}>Post</button>
                    </div>
                    <button onClick={() => setQCouple(!qCouple)} className={`px-4 py-2 text-[9px] font-black uppercase bg-black/40 backdrop-blur-md rounded-lg border transition-all shadow-xl ${qCouple ? 'text-sky-400 border-sky-400/50' : 'text-gray-400 border-white/10'}`}>Q-Couple</button>
                    <div className="flex items-center gap-2 px-4 py-2 text-[9px] font-black bg-black/40 backdrop-blur-md rounded-lg border border-white/10 ml-2 cursor-pointer" onClick={() => {
                        const modes: Array<'Stereo' | 'Mono' | 'Side' | 'Mid'> = ['Stereo', 'Mono', 'Side', 'Mid'];
                        const next = modes[(modes.indexOf(processingMode) + 1) % modes.length];
                        setProcessingMode(next);
                    }}>
                        <span className="text-gray-600">Processing:</span>
                        <span className="text-gray-300">{processingMode}</span>
                        <ChevronDown className="w-2.5 h-2.5 text-gray-500" />
                    </div>
                </div>

                <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-4 h-3/4 py-4 group/side">
                    <div className="flex-1 w-px bg-white/10 relative">
                        <input type="range" min="-30" max="30" step="0.1" value={masterGain} onChange={(e) => handleMasterGainChange(parseFloat(e.target.value))} className="absolute -left-[50px] w-[180px] h-1 -rotate-90 top-1/2 accent-gray-400 opacity-20 group-hover/side:opacity-100 transition-opacity" />
                        <div className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border border-gray-400 bg-[#1a1a1e] shadow-lg flex items-center justify-center" style={{ bottom: `${((masterGain + 30) / 60) * 100}%` }}>
                             <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                        </div>
                    </div>
                    <div className="text-[10px] font-black text-gray-500 vertical-text mt-2 uppercase tracking-tight">Gain</div>
                    <div className="text-[11px] font-extrabold text-white bg-black/80 px-2 py-0.5 rounded border border-white/10">{masterGain.toFixed(1)}</div>
                </div>
            </div>

            <div className="grid grid-cols-9 h-[160px] bg-[#12161b] border-t border-black p-4 gap-0 px-6">
                {bands.map((b, i) => (
                    <div key={i} className="flex flex-col items-center justify-between py-2 border-r border-white/5 last:border-0 relative group">
                        <div className="text-[11px] font-bold" style={{ color: b.enabled ? b.color : '#555' }}>
                            {b.freq >= 1000 ? `${(b.freq/1000).toFixed(1)}k Hz` : `${b.freq} Hz`}
                        </div>
                        <div className="text-[11px] font-bold" style={{ color: b.enabled ? b.color : '#555' }}>
                            {i === 0 || i === 7 ? '24dB/Oct' : `${b.gain > 0 ? '+' : ''}${b.gain.toFixed(1)} dB`}
                        </div>
                        <div className="text-[11px] font-bold" style={{ color: b.enabled ? b.color : '#555' }}>
                            {b.q.toFixed(2)}
                        </div>
                    </div>
                ))}
                <div className="flex flex-col items-center justify-between py-2 bg-black/20 rounded-lg ml-4">
                    <span className="text-gray-600 uppercase font-black text-[9px] tracking-widest mt-2">Gain</span>
                    <div className="text-white font-extrabold text-[12px] mb-2">{masterGain.toFixed(1)} dB</div>
                </div>
            </div>
        </div>
    )
}

function FilterIcon({ type, color }: { type: BandType, color: string }) {
    return (
        <svg width="34" height="34" viewBox="0 0 34 34" className="transition-all">
            {type === 'highpass' && <path d="M6 28 Q17 28 17 17 Q17 6 28 6" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />}
            {type === 'lowshelf' && <path d="M6 24 L14 24 Q20 24 20 17 L28 17" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />}
            {type === 'peaking' && <path d="M6 24 L10 24 Q17 6 24 24 L28 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />}
            {type === 'highshelf' && <path d="M6 17 L14 17 Q14 24 20 24 L28 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />}
            {type === 'lowpass' && <path d="M6 6 Q17 6 17 17 Q17 28 28 28" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />}
        </svg>
    )
}
