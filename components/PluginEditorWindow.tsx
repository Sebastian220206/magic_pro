"use client"
import React, { useCallback, useEffect, useState } from 'react'
import { useProjectStore } from '@/store/projectStore'
import { PluginHost } from '@/components/plugins/PluginHost'
import { ChannelEQ } from '@/components/ChannelEQ'
import { Compressor } from './Compressor'
import { Limiter } from './Limiter'
import { BUILTIN_PLUGIN_IDS, resolvePluginId } from '@/engine/plugins/pluginIds'
import { getBuiltinManifest } from '@/engine/plugins/registerBuiltins'
import { WamGuiMount } from '@/components/plugins/WamGuiMount'
import { AutoGenPluginUI } from '@/components/plugins/AutoGenPluginUI'
import { WamInsertProcessor } from '@/engine/plugins/wam/wamProcessor'
import { wamManifest } from '@/engine/plugins/wam/wamManifest'
import type { InsertProcessor } from '@/engine/audioEngine/insertChain'
import { routingEngine } from '@/engine/audioEngine/routingEngine'
import { Loader2, X } from 'lucide-react'

import { ChromaVerb } from '@/components/ChromaVerb'
import { TapeDelay } from '@/components/TapeDelay'
import { RetroSynthUI } from '@/components/RetroSynthUI'

/** How often to re-check whether a slot's processor exists yet. */
const PROCESSOR_POLL_MS = 250
/** How long to keep calling a missing processor "still loading". */
const PROCESSOR_WAIT_MS = 15_000

/**
 * The live processor for a slot, re-checked until it appears.
 *
 * `InsertChain.setSpecs()` builds processors asynchronously — a Web Audio
 * Module has to be fetched, imported and instantiated — and the engine
 * publishes no readiness event. Reading `getInsertProcessor()` once during
 * render therefore latched whatever happened to be true the instant the window
 * opened: clicking a freshly added effect's slot in the mixer picked the
 * "no processor" branch and stayed on it, showing the Generic Plugin Editor
 * forever for a plugin that had finished loading a fraction of a second later.
 * Only closing and reopening the window ever revealed the real interface.
 *
 * Polling, rather than a subscription, because the engine offers nothing to
 * subscribe to; the cost is one map lookup every quarter second, and only
 * while a plugin editor is open. The identity is tracked rather than merely
 * its presence, so a chain rebuild — which disposes and recreates every
 * processor on the track — hands the editor the live one instead of a
 * disposed instance.
 */
function useInsertProcessor(trackId: string | null, pluginId: string | null) {
    const [processor, setProcessor] = useState<InsertProcessor | null>(null)
    const [timedOut, setTimedOut] = useState(false)

    useEffect(() => {
        if (!trackId || !pluginId) {
            setProcessor(null)
            setTimedOut(false)
            return
        }

        let current: InsertProcessor | null = null
        const read = () => {
            const next = routingEngine.getInsertProcessor(trackId, pluginId)
            if (next !== current) {
                current = next
                setProcessor(next)
            }
            return next
        }

        read()
        setTimedOut(false)

        const startedAt = Date.now()
        const poll = window.setInterval(() => {
            if (!read() && Date.now() - startedAt > PROCESSOR_WAIT_MS) setTimedOut(true)
        }, PROCESSOR_POLL_MS)

        return () => window.clearInterval(poll)
    }, [trackId, pluginId])

    return { processor, timedOut }
}

export function PluginEditorWindow() {
    const { openPluginEditor, setOpenPluginEditor, tracks, updatePluginParams } = useProjectStore()

    const handleParamChange = useCallback(
        (trackId: string, pluginId: string) => (paramId: string, value: number) => {
            updatePluginParams(trackId, pluginId, { [paramId]: value })
        },
        [updatePluginParams]
    )

    const trackId = openPluginEditor?.trackId ?? null
    const pluginId = openPluginEditor?.pluginId ?? null
    const isMaster = trackId === 'master'
    const masterPlugins = useProjectStore(s => s.masterPlugins)
    const track = isMaster ? null : tracks.find(t => t.id === trackId)
    const plugin = isMaster
        ? masterPlugins.find(p => p.id === pluginId)
        : track?.plugins.find(p => p.id === pluginId)

    useEffect(() => {
        if (openPluginEditor && (!trackId || !pluginId || !plugin)) {
            setOpenPluginEditor(null)
        }
    }, [openPluginEditor, trackId, pluginId, plugin, setOpenPluginEditor])

    // Hooks run before the early returns below, so the order stays stable
    // whether or not an editor is open.
    const { processor, timedOut } = useInsertProcessor(trackId, pluginId)

    if (!openPluginEditor || !trackId || !pluginId || !plugin) return null

    const manifest = getBuiltinManifest(plugin.pluginId)
    /*
     * The Channel EQ has a purpose-built editor — eight draggable bands over a
     * live analyser — that nothing rendered. Opening an EQ fell through to the
     * manifest-driven host, i.e. a column of numeric sliders for a curve.
     */
    const isChannelEq = resolvePluginId(plugin.pluginId) === BUILTIN_PLUGIN_IDS.eq
    /*
     * The compressor has a purpose-built editor too, and it was in the
     * unreachable baseline: nothing imported it, so opening a compressor fell
     * through to the manifest-driven list of sliders.
     */
    const isCompressor = resolvePluginId(plugin.pluginId) === BUILTIN_PLUGIN_IDS.compressor
    /* The limiter had no editor at all, so it opened as generated sliders. */
    const isLimiter = resolvePluginId(plugin.pluginId) === BUILTIN_PLUGIN_IDS.limiter
    const isReverb = resolvePluginId(plugin.pluginId) === BUILTIN_PLUGIN_IDS.reverb
    const isDelay = resolvePluginId(plugin.pluginId) === BUILTIN_PLUGIN_IDS.delay
    const isRetroSynth = resolvePluginId(plugin.pluginId) === BUILTIN_PLUGIN_IDS.retroSynth
    const onParamChange = handleParamChange(trackId, pluginId)

    // A Web Audio Module is described by nothing but its live processor: no
    // built-in manifest exists for it, so the editor has to wait for one rather
    // than conclude there is nothing to draw.
    const isWam = plugin.format === 'wam'
    const wamProcessor = processor instanceof WamInsertProcessor ? processor : null
    const loadingWam = isWam && !wamProcessor && !timedOut
    const failedWam = isWam && !wamProcessor && timedOut

    return (
        <div className="fixed inset-0 z-[110] flex items-start justify-center p-4 overflow-y-auto bg-black/40 backdrop-blur-[2px] pointer-events-none">
            <div className="pointer-events-auto relative shadow-[0_40px_120px_rgba(0,0,0,0.9)] rounded-xl my-auto">
                <button
                    onClick={() => setOpenPluginEditor(null)}
                    className="absolute top-4 right-[10px] z-[150] text-studio-text-dim hover:text-white transition-colors bg-black/20 rounded p-1"
                >
                    <X className="w-4 h-4" />
                </button>

                {isChannelEq ? (
                    <ChannelEQ trackId={trackId} pluginId={pluginId} />
                ) : isCompressor ? (
                    <Compressor trackId={trackId} pluginId={pluginId} />
                ) : isLimiter ? (
                    <Limiter trackId={trackId} pluginId={pluginId} />
                ) : isReverb ? (
                    <ChromaVerb trackId={trackId} pluginId={pluginId} />
                ) : isDelay ? (
                    <TapeDelay trackId={trackId} pluginId={pluginId} />
                ) : isRetroSynth ? (
                    <RetroSynthUI trackId={trackId} pluginId={pluginId} />
                ) : loadingWam ? (
                    <div className="w-[380px] bg-studio-panel rounded-lg border border-black p-10 flex flex-col items-center justify-center gap-3 text-white">
                        <Loader2 className="w-5 h-5 animate-spin text-accent-cyan" />
                        <div className="text-[11px] font-bold uppercase tracking-widest text-accent-cyan">{plugin.name}</div>
                        <div className="text-studio-text-dim text-xs">Loading plug-in…</div>
                    </div>
                ) : failedWam ? (
                    <div className="w-[380px] bg-studio-panel rounded-lg border border-black p-10 flex flex-col items-center justify-center gap-3 text-center text-white">
                        <div className="text-[11px] font-bold uppercase tracking-widest text-accent-cyan">{plugin.name}</div>
                        <div className="text-studio-text-dim text-xs">
                            This plug-in could not be loaded, so it is not processing audio.
                        </div>
                        {plugin.wam?.url && (
                            <div className="w-full font-mono text-[10px] text-studio-text-mid break-all">{plugin.wam.url}</div>
                        )}
                    </div>
                ) : wamProcessor ? (
                    // A Web Audio Module ships its own interface; prefer it over
                    // anything we could generate, and generate one from the
                    // parameters it reports when it ships none.
                    <div className="bg-studio-panel rounded-lg border border-black p-4 min-w-[380px]">
                        <div className="text-[11px] font-bold uppercase tracking-widest text-accent-cyan mb-3">
                            {plugin.name}
                        </div>
                        <WamGuiMount
                            processor={wamProcessor}
                            fallback={
                                <AutoGenPluginUI
                                    trackId={trackId}
                                    pluginId={pluginId}
                                    manifest={wamManifest(plugin.pluginId, plugin.name, wamProcessor.getParameterInfo())}
                                    params={plugin.params}
                                    onParamChange={onParamChange}
                                />
                            }
                        />
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
