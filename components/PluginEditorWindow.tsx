"use client"
import React, { useCallback } from 'react'
import { useProjectStore } from '@/store/projectStore'
import { PluginHost } from '@/components/plugins/PluginHost'
import { getBuiltinManifest } from '@/engine/plugins/registerBuiltins'
import { WamGuiMount } from '@/components/plugins/WamGuiMount'
import { WamInsertProcessor } from '@/engine/plugins/wam/wamProcessor'
import { routingEngine } from '@/engine/audioEngine/routingEngine'
import { X } from 'lucide-react'

export function PluginEditorWindow() {
    const { openPluginEditor, setOpenPluginEditor, tracks, updatePluginParams } = useProjectStore()

    const handleParamChange = useCallback(
        (trackId: string, pluginId: string) => (paramId: string, value: number) => {
            updatePluginParams(trackId, pluginId, { [paramId]: value })
        },
        [updatePluginParams]
    )

    if (!openPluginEditor) return null

    const { trackId, pluginId } = openPluginEditor
    const track = tracks.find(t => t.id === trackId)
    const plugin = track?.plugins.find(p => p.id === pluginId)

    if (!plugin) {
        setOpenPluginEditor(null)
        return null
    }

    const manifest = getBuiltinManifest(plugin.pluginId)
    const onParamChange = handleParamChange(trackId, pluginId)

    // Live processor for this slot, so a WAM can render its own GUI.
    const processor = routingEngine.getInsertProcessor(trackId, pluginId)
    const wamProcessor = processor instanceof WamInsertProcessor ? processor : null

    return (
        <div className="fixed inset-0 z-[110] flex items-start justify-center p-4 overflow-y-auto bg-black/40 backdrop-blur-[2px] pointer-events-none">
            <div className="pointer-events-auto relative shadow-[0_40px_120px_rgba(0,0,0,0.9)] rounded-xl my-auto">
                <button
                    onClick={() => setOpenPluginEditor(null)}
                    className="absolute top-4 right-[10px] z-[150] text-studio-text-dim hover:text-white transition-colors bg-black/20 rounded p-1"
                >
                    <X className="w-4 h-4" />
                </button>

                {wamProcessor ? (
                    // A Web Audio Module ships its own interface; prefer it over
                    // anything we could generate.
                    <div className="bg-studio-panel rounded-lg border border-black p-4 min-w-[380px]">
                        <div className="text-[11px] font-bold uppercase tracking-widest text-accent-cyan mb-3">
                            {plugin.name}
                        </div>
                        <WamGuiMount processor={wamProcessor} />
                    </div>
                ) : manifest ? (
                    <PluginHost
                        trackId={trackId}
                        pluginId={pluginId}
                        manifest={manifest}
                        params={plugin.params}
                        onParamChange={onParamChange}
                    />
                ) : (
                    <div className="w-[400px] bg-studio-panel rounded-lg border border-black p-10 flex flex-col items-center justify-center gap-4 text-white">
                        <div className="text-xl font-bold uppercase tracking-widest text-accent-cyan">{plugin.name}</div>
                        <div className="text-studio-text-dim text-sm">Generic Plugin Editor</div>
                        <div className="w-full bg-black/40 rounded p-4 border border-white/5 font-mono text-[10px] text-studio-text-mid">
                            {Object.entries(plugin.params).map(([key, val]) => (
                                <div key={key} className="flex justify-between">
                                    <span>{key}</span>
                                    <span className="text-amber-500">{String(val)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
