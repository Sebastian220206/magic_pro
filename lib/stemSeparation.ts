export interface StemResult {
  name: string
  buffer: AudioBuffer
}

const BAND_CONFIGS = [
  { name: 'bass', type: 'lowpass' as const, freq: 250 },
  { name: 'drums', type: 'bandpass' as const, lowFreq: 250, highFreq: 2000 },
  { name: 'vocals', type: 'bandpass' as const, lowFreq: 200, highFreq: 4000 },
  { name: 'other', type: 'highpass' as const, freq: 4000 },
]

function renderBand(
  inputBuffer: AudioBuffer,
  band: typeof BAND_CONFIGS[number],
  sampleRate: number,
): Promise<AudioBuffer> {
  const numChannels = inputBuffer.numberOfChannels
  const duration = inputBuffer.duration
  const length = Math.ceil(sampleRate * duration)

  const ctx = new OfflineAudioContext(numChannels, length, sampleRate)
  const source = ctx.createBufferSource()
  source.buffer = inputBuffer

  if (band.type === 'lowpass') {
    const f1 = ctx.createBiquadFilter(); f1.type = 'lowpass'; f1.frequency.value = band.freq; f1.Q.value = 0.707
    const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = band.freq; f2.Q.value = 0.707
    source.connect(f1); f1.connect(f2); f2.connect(ctx.destination)
  } else if (band.type === 'highpass') {
    const f1 = ctx.createBiquadFilter(); f1.type = 'highpass'; f1.frequency.value = band.freq; f1.Q.value = 0.707
    const f2 = ctx.createBiquadFilter(); f2.type = 'highpass'; f2.frequency.value = band.freq; f2.Q.value = 0.707
    source.connect(f1); f1.connect(f2); f2.connect(ctx.destination)
  } else {
    const hp1 = ctx.createBiquadFilter(); hp1.type = 'highpass'; hp1.frequency.value = band.lowFreq; hp1.Q.value = 0.707
    const hp2 = ctx.createBiquadFilter(); hp2.type = 'highpass'; hp2.frequency.value = band.lowFreq; hp2.Q.value = 0.707
    const lp1 = ctx.createBiquadFilter(); lp1.type = 'lowpass'; lp1.frequency.value = band.highFreq; lp1.Q.value = 0.707
    const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = band.highFreq; lp2.Q.value = 0.707
    source.connect(hp1); hp1.connect(hp2); hp2.connect(lp1); lp1.connect(lp2); lp2.connect(ctx.destination)
  }

  source.start()
  return ctx.startRendering()
}

export async function separateStems(inputBuffer: AudioBuffer, sampleRate?: number): Promise<StemResult[]> {
  const sr = sampleRate || inputBuffer.sampleRate
  const results: StemResult[] = []

  for (const cfg of BAND_CONFIGS) {
    const buffer = await renderBand(inputBuffer, cfg, sr)
    results.push({ name: cfg.name, buffer })
  }

  return results
}

export const STEM_PRESETS: Record<string, string[]> = {
  'All Stems': ['bass', 'drums', 'vocals', 'other'],
  'Vocals + Music': ['vocals', 'bass', 'drums', 'other'],
  'Vocals Only': ['vocals'],
  'Drums + Bass': ['drums', 'bass'],
} as const
