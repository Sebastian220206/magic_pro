import type { Sf2ParsedData, Sf2SampleHeader } from './SoundFontParser'

const DEFAULT_MAX_MEMORY = 256 * 1024 * 1024

interface CachedBuffer {
  key: string
  buffer: AudioBuffer
  size: number
  lastAccess: number
  refCount: number
}

export class AudioDecoder {
  private cache = new Map<string, CachedBuffer>()
  private ctx: AudioContext | OfflineAudioContext
  private maxMemory: number
  private totalMemory = 0
  private decodeQueue: string[] = []
  private decoding = false

  constructor(ctx: AudioContext | OfflineAudioContext, maxMemory = DEFAULT_MAX_MEMORY) {
    this.ctx = ctx
    this.maxMemory = maxMemory
  }

  getOrCreateBuffer(
    key: string,
    sampleData: Float32Array,
    sampleRate: number,
  ): AudioBuffer {
    const cached = this.cache.get(key)
    if (cached) {
      cached.lastAccess = Date.now()
      cached.refCount++
      return cached.buffer
    }

    const buffer = this.ctx.createBuffer(1, sampleData.length, sampleRate)
    buffer.getChannelData(0).set(sampleData)
    const size = sampleData.length * 4

    this.ensureRoom(size)

    this.cache.set(key, {
      key,
      buffer,
      size,
      lastAccess: Date.now(),
      refCount: 1,
    })
    this.totalMemory += size

    return buffer
  }

  releaseBuffer(key: string): void {
    const cached = this.cache.get(key)
    if (!cached) return
    cached.refCount--
    if (cached.refCount <= 0) {
      this.cache.delete(key)
      this.totalMemory -= cached.size
    }
  }

  async decodeAllSamples(
    parsedData: Sf2ParsedData,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<Map<string, AudioBuffer>> {
    const headers = parsedData.sampleHeaders
    const sampleData = parsedData.sampleData
    // Fallback only: each header carries its own rate and they vary widely
    // within one font.
    const fontRate = parsedData.sampleRate
    const total = headers.length
    const result = new Map<string, AudioBuffer>()

    for (let i = 0; i < total; i++) {
      const h = headers[i]
      const sampleRate = h.sampleRate > 0 ? h.sampleRate : fontRate
      const key = `sf2-${i}-${sampleRate}`
      const sampleLen = h.end - h.start
      if (sampleLen <= 0) continue

      const slice = new Float32Array(sampleData.buffer, h.start * 4, sampleLen)
      const buffer = this.getOrCreateBuffer(key, slice, sampleRate)
      result.set(key, buffer)

      if (onProgress && (i % 5 === 0 || i === total - 1)) {
        onProgress(i + 1, total)
      }
    }

    return result
  }

  preDecodeForPreset(
    parsedData: Sf2ParsedData,
    presetIndex: number,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<Map<string, AudioBuffer>> {
    return this.decodeAllSamples(parsedData, onProgress)
  }

  hasBuffer(key: string): boolean {
    return this.cache.has(key)
  }

  getBufferCount(): number {
    return this.cache.size
  }

  getMemoryUsage(): number {
    return this.totalMemory
  }

  getMemoryLimit(): number {
    return this.maxMemory
  }

  setMemoryLimit(bytes: number): void {
    this.maxMemory = Math.max(64 * 1024 * 1024, bytes)
    if (this.totalMemory > this.maxMemory) {
      this.evictLRU()
    }
  }

  private ensureRoom(needed: number): void {
    if (this.totalMemory + needed <= this.maxMemory) return
    this.evictLRU()
  }

  private evictLRU(): void {
    const entries = Array.from(this.cache.values())
      .filter(e => e.refCount === 0)
      .sort((a, b) => a.lastAccess - b.lastAccess)

    for (const entry of entries) {
      if (this.totalMemory <= this.maxMemory * 0.8) break
      this.cache.delete(entry.key)
      this.totalMemory -= entry.size
    }
  }

  clear(): void {
    this.cache.clear()
    this.totalMemory = 0
  }

  dispose(): void {
    this.clear()
  }
}
