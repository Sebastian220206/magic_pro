"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Music, Upload, FileAudio, Loader2, Check, Trash2, ChevronDown, Play } from "lucide-react"
import { SoundFontManager, type StoredSfFont, type SfSelection } from "@/lib/soundfontStore"
import { useSession } from "next-auth/react"
import type { LoadProgress } from "@/lib/soundfontEngine"

interface SoundFontPanelProps {
  trackId: string
}

interface LoadingState {
  fontId: string
  progress: LoadProgress
}

function ProgressBar({ progress }: { progress: LoadProgress }) {
  const stageLabels: Record<string, string> = {
    download: 'Downloading',
    parse: 'Parsing',
    decode: 'Preparing Samples',
    ready: 'Ready',
    error: 'Error',
  }

  const colorMap: Record<string, string> = {
    download: 'bg-sky-500',
    parse: 'bg-amber-500',
    decode: 'bg-green-500',
    ready: 'bg-emerald-500',
    error: 'bg-red-500',
  }

  return (
    <div className="w-full space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-gray-400">{stageLabels[progress.stage] || progress.stage}</span>
        <span className="text-gray-500 tabular-nums">{progress.percent}%</span>
      </div>
      <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${colorMap[progress.stage] || 'bg-sky-500'}`}
          style={{ width: `${Math.max(2, progress.percent)}%` }}
        />
      </div>
      {progress.error && (
        <div className="text-[10px] text-red-400">{progress.error}</div>
      )}
    </div>
  )
}

export function SoundFontPanel({ trackId }: SoundFontPanelProps) {
  const { data: session } = useSession()
  const userId = session?.user?.id
  const sfManager = SoundFontManager.getInstance()
  const [, forceUpdate] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fonts, setFonts] = useState<StoredSfFont[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [loadingState, setLoadingState] = useState<LoadingState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [presetDropdownOpen, setPresetDropdownOpen] = useState<string | null>(null)

  const selection = sfManager.getSelection(trackId)
  const activeFontId = selection?.fontId
  const activePresetIndex = selection?.presetIndex

  const cachedPresets = activeFontId ? sfManager.getPresetList(activeFontId) : []
  const isLoaded = activeFontId ? sfManager.isLoaded(activeFontId) : false

  useEffect(() => {
    return sfManager.subscribe(() => forceUpdate(n => n + 1))
  }, [sfManager])

  useEffect(() => {
    if (!userId) {
      setLoadingList(false)
      return
    }
    setLoadingList(true)
    sfManager.listFonts(userId).then((list) => {
      setFonts(list)
      setLoadingList(false)
    }).catch(() => {
      setLoadingList(false)
    })
  }, [userId, sfManager])

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    if (!file.name.endsWith('.sf2')) {
      setError('Only .sf2 files are supported')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const entry = await sfManager.uploadFont(file, userId)
      setFonts(prev => [entry, ...prev])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [userId, sfManager])

  const handleLoad = useCallback(async (font: StoredSfFont, presetIdx: number = 0) => {
    setError(null)
    setLoadingState({ fontId: font.id, progress: { stage: 'download', percent: 0 } })
    try {
      const result = await sfManager.loadFont(font, presetIdx, (progress) => {
        setLoadingState(prev => prev?.fontId === font.id ? { fontId: font.id, progress } : prev)
      })

      const presetList = sfManager.getPresetList(font.id)

      sfManager.selectPresetForTrack(trackId, font.id, presetIdx)

      if (presetList.length > 0 && font.presetCount === 0) {
        await sfManager.updatePresets(font.id, presetList.length, presetList)
        setFonts(prev => prev.map(f =>
          f.id === font.id
            ? { ...f, presetCount: presetList.length, presets: presetList }
            : f
        ))
      }

      // Clear loading state on success
      setLoadingState(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load SoundFont'
      setError(msg)
      setLoadingState({
        fontId: font.id,
        progress: { stage: 'error', percent: 0, error: msg },
      })
    }
  }, [trackId, sfManager])

  const handleSelectPreset = useCallback((font: StoredSfFont, presetIndex: number) => {
    sfManager.selectPreset(font.id, presetIndex)
    sfManager.selectPresetForTrack(trackId, font.id, presetIndex)
    setPresetDropdownOpen(null)
  }, [trackId, sfManager])

  const handleDelete = useCallback(async (font: StoredSfFont, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!userId) return
    await sfManager.deleteFont(font.id, userId)
    setFonts(prev => prev.filter(f => f.id !== font.id))
  }, [userId, sfManager])

  const isFontLoading = (fontId: string) => loadingState?.fontId === fontId && loadingState.progress.stage !== 'error'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-[11px] font-bold text-gray-300">SoundFonts</span>
        </div>
        {userId && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".sf2"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1 px-2 py-1 bg-[#252525] hover:bg-[#333] border border-dashed border-[#444] rounded text-[10px] text-gray-400 hover:text-gray-200 transition-all disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="text-[10px] text-red-400 bg-red-400/10 rounded px-2 py-1">{error}</div>
      )}

      {!userId ? (
        <div className="text-[10px] text-gray-500 text-center py-4">
          Sign in to upload SoundFonts
        </div>
      ) : loadingList ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        </div>
      ) : fonts.length === 0 ? (
        <div className="text-[10px] text-gray-500 text-center py-4">
          No SoundFonts uploaded. Click Upload to add one.
        </div>
      ) : (
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {fonts.map((font) => {
            const loading = loadingState?.fontId === font.id
            const isActive = activeFontId === font.id
            const fontLoaded = isActive && isLoaded
            return (
              <div key={font.id}>
                <button
                  onClick={() => {
                    if (!isActive && !loading) {
                      handleLoad(font, 0)
                    } else if (fontLoaded && cachedPresets.length > 0) {
                      setPresetDropdownOpen(presetDropdownOpen === font.id ? null : font.id)
                    }
                  }}
                  disabled={loading}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border text-[11px] text-left transition-all ${
                    isActive
                      ? 'bg-orange-500/10 border-orange-500/30 text-orange-300'
                      : 'bg-[#252525] border-[#333] text-gray-400 hover:text-gray-200 hover:border-gray-600'
                  } disabled:opacity-50`}
                >
                  <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-orange-500/20' : 'bg-[#1a1a1a]'
                  }`}>
                    {loading ? (
                      <Loader2 className="w-3 h-3 animate-spin text-gray-500" />
                    ) : isActive ? (
                      <Check className="w-3 h-3 text-orange-400" />
                    ) : (
                      <FileAudio className="w-3 h-3 text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{font.name}</div>
                    <div className="text-[9px] text-gray-600 mt-0.5">
                      {isActive && isLoaded && cachedPresets.length > 0
                        ? cachedPresets[activePresetIndex ?? 0]?.name ?? `${font.presetCount} presets`
                        : font.presetCount > 0
                          ? `${font.presetCount} presets`
                          : `${(font.fileSize / 1024 / 1024).toFixed(1)} MB`
                      }
                    </div>
                  </div>
                  {fontLoaded && cachedPresets.length > 1 && (
                    <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" />
                  )}
                  <button
                    onClick={(e) => handleDelete(font, e)}
                    className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </button>

                {loading && loadingState && (
                  <div className="px-1 pt-1.5">
                    <ProgressBar progress={loadingState.progress} />
                  </div>
                )}

                {presetDropdownOpen === font.id && fontLoaded && cachedPresets.length > 0 && (
                  <div className="mt-1 ml-8 border-l-2 border-orange-500/30 pl-2 space-y-0.5">
                    {cachedPresets.map((p) => (
                      <button
                        key={p.index}
                        onClick={() => handleSelectPreset(font, p.index)}
                        className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-left transition-all ${
                          activePresetIndex === p.index
                            ? 'bg-orange-500/15 text-orange-300'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                        }`}
                      >
                        <Play className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{p.name}</span>
                        <span className="text-[8px] text-gray-600 tabular-nums shrink-0 ml-auto">
                          {p.bank}:{p.program}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {activeFontId && selection && (
        <div className="text-[10px] text-gray-500 pt-1 border-t border-[#333]">
          {fonts.find(f => f.id === activeFontId)?.name ?? 'Unknown'}
          {isLoaded && cachedPresets[activePresetIndex ?? 0] && (
            <> &middot; {cachedPresets[activePresetIndex!].name}</>
          )}
        </div>
      )}
    </div>
  )
}
