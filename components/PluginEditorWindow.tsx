"use client"
import React from 'react'
import { useProjectStore } from '@/store/projectStore'
import { ChannelEQ } from './ChannelEQ'
import { Compressor } from './Compressor'
import { ChromaVerb } from './ChromaVerb'
import { TapeDelay } from './TapeDelay'
import { X } from 'lucide-react'

export function PluginEditorWindow() {
    const { openPluginEditor, setOpenPluginEditor, tracks } = useProjectStore()

    if (!openPluginEditor) return null

    const { trackId, pluginId } = openPluginEditor
    const track = tracks.find(t => t.id === trackId)
    const plugin = track?.plugins.find(p => p.id === pluginId)

    if (!plugin) {
        // Plugin was removed or track deleted, close window
        setOpenPluginEditor(null)
        return null
    }

    return (
        <div className="fixed inset-0 z-[110] flex items-start justify-center p-4 overflow-y-auto bg-black/40 backdrop-blur-[2px] pointer-events-none">
            <div className="pointer-events-auto relative shadow-[0_40px_120px_rgba(0,0,0,0.9)] rounded-xl my-auto">
                {/* Close Button Overlay */}
                <button 
                    onClick={() => setOpenPluginEditor(null)}
                    className="absolute top-4 right-[10px] z-[150] text-zinc-500 hover:text-white transition-colors bg-black/20 rounded p-1"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Render specific plugin UI */}
                {plugin.pluginId === 'eq' && (
                    <ChannelEQ trackId={trackId} pluginId={pluginId} />
                )}

                {plugin.pluginId === 'comp' && (
                    <Compressor trackId={trackId} pluginId={pluginId} />
                )}

                {plugin.pluginId === 'reverb' && (
                    <ChromaVerb trackId={trackId} pluginId={pluginId} />
                )}

                {plugin.pluginId === 'delay' && (
                    <TapeDelay trackId={trackId} pluginId={pluginId} />
                )}

                {/* Generic fallback for other plugins */}
                {plugin.pluginId !== 'eq' && plugin.pluginId !== 'comp' && plugin.pluginId !== 'reverb' && plugin.pluginId !== 'delay' && (
                    <div className="w-[400px] bg-[#1a1a1a] rounded-lg border border-black p-10 flex flex-col items-center justify-center gap-4 text-white">
                        <div className="text-xl font-bold uppercase tracking-widest text-sky-400">{plugin.name}</div>
                        <div className="text-gray-500 text-sm">Generic Plugin Editor</div>
                        <div className="w-full bg-black/40 rounded p-4 border border-white/5 font-mono text-[10px] text-gray-400">
                             {/* params display */}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
