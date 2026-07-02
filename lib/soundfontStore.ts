import { supabase } from './supabase'
import { SoundFontEngine, type LoadProgress } from './soundfontEngine'
import type { SoundFontInstrument } from '@/engine/instruments/soundfont/SoundFontInstrument'
import { removeCachedFont } from './soundfontCache'

declare global {
  var __sfManagerInstance: SoundFontManager | null | undefined;
}

let instance: SoundFontManager | null = null;

export interface StoredSfFont {
  id: string
  userId: string
  name: string
  storagePath: string
  publicUrl: string
  presetCount: number
  presets: { name: string; bank: number; program: number }[]
  fileSize: number
  createdAt: string
  updatedAt?: string
}

export interface SfSelection {
  fontId: string
  presetIndex: number
  bank?: number
  program?: number
}

export type ProgressCallback = (progress: LoadProgress) => void

type Listener = () => void

const STORAGE_BUCKET = 'soundfonts'

export class SoundFontManager {
  private fonts: Map<string, StoredSfFont> = new Map()
  private selections: Map<string, SfSelection> = new Map()
  private listeners = new Set<Listener>()

  static getInstance(): SoundFontManager {
    if (typeof window !== 'undefined') {
      if (!window.__sfManagerInstance) {
        window.__sfManagerInstance = new SoundFontManager()
      }
      return window.__sfManagerInstance
    }
    if (!instance) instance = new SoundFontManager()
    return instance
  }

  async ensureBucket(): Promise<void> {
    const res = await fetch('/api/storage/ensure-bucket', { method: 'POST' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      console.warn('[SoundFont] could not ensure bucket:', body.error ?? res.statusText)
    }
  }

  async listFonts(userId: string): Promise<StoredSfFont[]> {
    const { data, error } = await supabase
      .from('Soundfont')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false })

    if (error) {
      console.error('[SoundFont] list error:', error)
      return []
    }

    const fonts: StoredSfFont[] = (data ?? []).map((r: any) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      storagePath: r.storagePath,
      publicUrl: r.publicUrl,
      presetCount: r.presetCount,
      presets: r.presets as { name: string; bank: number; program: number }[],
      fileSize: r.fileSize,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))

    for (const f of fonts) {
      this.fonts.set(f.id, f)
    }

    return fonts
  }

  async uploadFont(file: File, userId: string): Promise<StoredSfFont> {
    await this.ensureBucket()

    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `users/${userId}/${timestamp}-${safeName}`

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) {
      console.error('[SoundFont] Upload error:', uploadError)
      throw uploadError
    }

    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath)

    const now = new Date().toISOString()
    const { data: insertData, error: insertError } = await supabase
      .from('Soundfont')
      .insert({
        id: `sf-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
        userId,
        name: file.name.replace(/\.sf2$/i, ''),
        storagePath,
        publicUrl,
        presetCount: 0,
        presets: [],
        fileSize: file.size,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[SoundFont] DB insert error:', insertError)
      throw insertError
    }

    const entry: StoredSfFont = {
      id: insertData.id,
      userId: insertData.userId,
      name: insertData.name,
      storagePath: insertData.storagePath,
      publicUrl: insertData.publicUrl,
      presetCount: insertData.presetCount,
      presets: [],
      fileSize: insertData.fileSize,
      createdAt: insertData.createdAt,
      updatedAt: insertData.updatedAt,
    }

    this.fonts.set(entry.id, entry)
    this.notify()

    return entry
  }

  async updatePresets(id: string, presetCount: number, presets: { name: string; bank: number; program: number }[]): Promise<void> {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('Soundfont')
      .update({ presetCount, presets, updatedAt: now })
      .eq('id', id)

    if (error) {
      console.error('[SoundFont] update preset error:', error)
      return
    }

    const existing = this.fonts.get(id)
    if (existing) {
      existing.presetCount = presetCount
      existing.presets = presets
    }

    this.notify()
  }

  async deleteFont(id: string, userId: string): Promise<void> {
    const entry = this.fonts.get(id)
    if (!entry) return

    await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([entry.storagePath])

    await supabase
      .from('Soundfont')
      .delete()
      .eq('id', id)
      .eq('userId', userId)

    const engine = SoundFontEngine.getInstance()
    engine.removeCached(id)

    removeCachedFont(id)
    this.fonts.delete(id)

    for (const [trackId, sel] of this.selections.entries()) {
      if (sel.fontId === id) {
        this.selections.delete(trackId)
      }
    }

    this.notify()
  }

  async loadFont(
    font: StoredSfFont,
    presetIndex: number,
    onProgress?: ProgressCallback,
  ): Promise<{ instrument: SoundFontInstrument; fontId: string }> {
    const engine = SoundFontEngine.getInstance()
    return engine.loadFont(font, presetIndex, onProgress)
  }

  selectPreset(fontId: string, presetIndex: number, bank?: number, program?: number): boolean {
    const engine = SoundFontEngine.getInstance()
    this.selections.set(`_global_`, { fontId, presetIndex, bank, program })
    return engine.selectPreset(fontId, presetIndex)
  }

  getPresetList(fontId: string): { name: string; index: number; bank: number; program: number }[] {
    const engine = SoundFontEngine.getInstance()
    return engine.getPresetList(fontId)
  }

  isLoaded(fontId: string): boolean {
    const engine = SoundFontEngine.getInstance()
    return engine.isLoaded(fontId)
  }

  getInstrument(fontId: string): SoundFontInstrument | undefined {
    const engine = SoundFontEngine.getInstance()
    return engine.getInstrument(fontId)
  }

  getFont(id: string): StoredSfFont | undefined {
    return this.fonts.get(id)
  }

  getAllFonts(): StoredSfFont[] {
    return Array.from(this.fonts.values())
  }

  selectPresetForTrack(trackId: string, fontId: string, presetIndex: number, bank?: number, program?: number) {
    this.selections.set(trackId, { fontId, presetIndex, bank, program })
    this.notify()
  }

  getSelection(trackId: string): SfSelection | undefined {
    return this.selections.get(trackId)
  }

  clearTrack(trackId: string) {
    this.selections.delete(trackId)
    this.notify()
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    this.listeners.forEach(fn => fn())
  }
}
