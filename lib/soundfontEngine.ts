import { getCachedFont, setCachedFont, removeCachedFont } from './soundfontCache'
import { SoundFontInstrument } from '@/engine/instruments/soundfont/SoundFontInstrument'
import type { Sf2ParsedData } from '@/engine/instruments/soundfont/SoundFontParser'
import { PresetManager } from '@/engine/instruments/soundfont/PresetManager'
import { SoundFontLoader } from '@/engine/instruments/soundfont/SoundFontLoader'
import { AudioDecoder } from '@/engine/instruments/soundfont/audioDecoder'
import type { StoredSfFont, SfSelection } from './soundfontStore'
import { audioContextManager } from '@/engine/audioEngine/audioContext'

export interface LoadProgress {
  stage: 'download' | 'parse' | 'decode' | 'ready' | 'error'
  percent: number
  message?: string
  error?: string
}

export type ProgressCallback = (progress: LoadProgress) => void

interface LoadedInstrument {
  fontId: string
  fontName: string
  instrument: SoundFontInstrument
  parsedData: Sf2ParsedData
  presetManager: PresetManager
  decoder: AudioDecoder
  lastAccessed: number
  refCount: number
}

declare global {
  var __sfEngineInstance: SoundFontEngine | null | undefined;
}

const DEFAULT_MEMORY_LIMIT = 512 * 1024 * 1024
const MAX_INSTRUMENTS = 8

let instance: SoundFontEngine | null = null;

export class SoundFontEngine {
  private loaded = new Map<string, LoadedInstrument>()
  private ctx: AudioContext | null = null
  private memoryLimit: number

  static getInstance(): SoundFontEngine {
    if (typeof window !== 'undefined') {
      if (!window.__sfEngineInstance) {
        window.__sfEngineInstance = new SoundFontEngine()
      }
      return window.__sfEngineInstance
    }
    if (!instance) instance = new SoundFontEngine()
    return instance
  }

  private constructor(memoryLimit = DEFAULT_MEMORY_LIMIT) {
    this.memoryLimit = memoryLimit
  }

  private async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      await audioContextManager.initialize()
      this.ctx = audioContextManager.getContext()!
    }
    return this.ctx
  }

  async loadFont(
    font: StoredSfFont,
    presetIndex: number,
    onProgress?: ProgressCallback,
  ): Promise<{ instrument: SoundFontInstrument; fontId: string }> {
    const ctx = await this.ensureContext()

    this.evictIfNeeded()

    const existing = this.loaded.get(font.id)
    if (existing) {
      existing.lastAccessed = Date.now()
      existing.refCount++
      if (presetIndex >= 0) {
        existing.instrument.selectPreset(presetIndex)
      }
      onProgress?.({ stage: 'ready', percent: 100 })
      return { instrument: existing.instrument, fontId: font.id }
    }

    try {
      const cached = await getCachedFont(font.id)
      let data: ArrayBuffer

      if (cached) {
        data = cached.data
      } else {
        onProgress?.({ stage: 'download', percent: 0, message: 'Downloading...' })
        const response = await fetch(font.publicUrl)
        if (!response.ok) throw new Error(`Download failed: ${response.statusText}`)
        data = await response.arrayBuffer()

        const version = font.updatedAt || String(font.createdAt)
        await setCachedFont(font.id, data, version, font.fileSize)
      }

      onProgress?.({ stage: 'parse', percent: 0, message: 'Parsing...' })

      let parsedData: Sf2ParsedData

      try {
        const { SoundFontParser } = await import('@/engine/instruments/soundfont/SoundFontParser')
        const parser = new SoundFontParser()
        parsedData = parser.parse(data)
      } catch (parseErr) {
        throw new Error(`Failed to parse SoundFont: ${parseErr instanceof Error ? parseErr.message : 'Unknown error'}`)
      }

      onProgress?.({ stage: 'parse', percent: 100 })

      const instrument = new SoundFontInstrument(ctx)
      await instrument.loadFontFromBuffer(data, font.name)

      onProgress?.({ stage: 'decode', percent: 0, message: 'Preparing samples...' })

      const decoder = new AudioDecoder(ctx)
      const sampleCount = parsedData.sampleHeaders.length

      await decoder.decodeAllSamples(parsedData, (loaded, total) => {
        const pct = Math.round((loaded / total) * 100)
        onProgress?.({ stage: 'decode', percent: pct, message: `Decoding samples...` })
      })

      const presetManager = new PresetManager()
      presetManager.load(parsedData)

      if (presetIndex >= 0 && presetIndex < parsedData.presets.length) {
        instrument.selectPreset(presetIndex)
      }

      const entry: LoadedInstrument = {
        fontId: font.id,
        fontName: font.name,
        instrument,
        parsedData,
        presetManager,
        decoder,
        lastAccessed: Date.now(),
        refCount: 1,
      }

      this.loaded.set(font.id, entry)

      onProgress?.({ stage: 'ready', percent: 100, message: 'Ready' })

      return { instrument, fontId: font.id }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      onProgress?.({ stage: 'error', percent: 0, error: message })
      throw err
    }
  }

  selectPreset(fontId: string, presetIndex: number): boolean {
    const entry = this.loaded.get(fontId)
    if (!entry) return false
    entry.lastAccessed = Date.now()
    return entry.instrument.selectPreset(presetIndex)
  }

  getInstrument(fontId: string): SoundFontInstrument | undefined {
    const entry = this.loaded.get(fontId)
    if (!entry) return undefined
    entry.lastAccessed = Date.now()
    return entry.instrument
  }

  getPresetList(fontId: string): { name: string; index: number; bank: number; program: number }[] {
    const entry = this.loaded.get(fontId)
    if (!entry) return []
    return entry.presetManager.getPresets().map((p, index) => ({
      name: p.name,
      index,
      bank: p.bank,
      program: p.preset,
    }))
  }

  getParsedData(fontId: string): Sf2ParsedData | undefined {
    return this.loaded.get(fontId)?.parsedData
  }

  releaseFont(fontId: string): void {
    const entry = this.loaded.get(fontId)
    if (!entry) return
    entry.refCount--
  }

  removeCached(fontId: string): void {
    this.releaseFont(fontId)
    removeCachedFont(fontId)
  }

  isLoaded(fontId: string): boolean {
    return this.loaded.has(fontId)
  }

  getTotalLoaded(): number {
    return this.loaded.size
  }

  getMemoryUsage(): number {
    let total = 0
    for (const [, entry] of this.loaded) {
      total += entry.decoder.getMemoryUsage()
    }
    return total
  }

  private evictIfNeeded(): void {
    if (this.loaded.size < MAX_INSTRUMENTS) return

    const sorted = Array.from(this.loaded.entries())
      .filter(([, e]) => e.refCount === 0)
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)

    while (this.loaded.size >= MAX_INSTRUMENTS && sorted.length > 0) {
      const [id, entry] = sorted.shift()!
      entry.decoder.dispose()
      entry.instrument.dispose()
      this.loaded.delete(id)
    }
  }

  disposeAll(): void {
    for (const [, entry] of this.loaded) {
      entry.decoder.dispose()
      entry.instrument.dispose()
    }
    this.loaded.clear()
    this.ctx = null
  }
}
