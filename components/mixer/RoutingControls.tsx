"use client"

/**
 * RoutingControls.tsx
 * The mixer strip's send, output and sidechain controls.
 *
 * The store and engine have supported all three for a while, but the mixer's
 * Sends slot was a hardcoded "Bus 1" label with no handler and the Output row
 * only *displayed* `outputBusId` — so a bus tree, a reverb send and a sidechain
 * were all reachable from code and from nowhere else.
 */

import { useMemo, useState, useCallback, useRef, useEffect } from "react"
import { ChevronDown, Plus, X, Radio } from "lucide-react"
import { useProjectStore } from "@/store/projectStore"
import type { Track } from "@/models/Track"

/** Busses a track may feed without creating a loop. */
export function useRoutableBusses(trackId: string | undefined): Track[] {
    const tracks = useProjectStore(s => s.tracks)

    return useMemo(() => {
        if (!trackId) return []
        const busses = tracks.filter(t => (t.type === 'bus' || t.type === 'folder') && t.id !== trackId)

        // Exclude anything already downstream of this track, which would close
        // a feedback loop. The store refuses these too; hiding them keeps the
        // menu honest rather than offering a choice that silently does nothing.
        return busses.filter(bus => {
            const seen = new Set<string>()
            let hop: string | undefined = bus.id
            while (hop && hop !== 'stereo-out' && !seen.has(hop)) {
                if (hop === trackId) return false
                seen.add(hop)
                hop = tracks.find(t => t.id === hop)?.outputBusId
            }
            return true
        })
    }, [tracks, trackId])
}

/** Small anchored dropdown that closes on outside click or Escape. */
function Popover({
    open, onClose, children, className = "",
}: { open: boolean; onClose: () => void; children: React.ReactNode; className?: string }) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose()
        }
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onDown)
            document.removeEventListener('keydown', onKey)
        }
    }, [open, onClose])

    if (!open) return null
    return (
        <div
            ref={ref}
            onClick={e => e.stopPropagation()}
            className={`absolute z-50 min-w-[160px] max-h-56 overflow-y-auto bg-[#2c2c2e] border border-white/15 rounded-md shadow-2xl p-1 flex flex-col text-[10px] ${className}`}
        >
            {children}
        </div>
    )
}

// ── Sends ──────────────────────────────────────────────────────────────────

export function SendsSlot({ track }: { track: Track | null }) {
    const setTrackSend = useProjectStore(s => s.setTrackSend)
    const removeTrackSend = useProjectStore(s => s.removeTrackSend)
    const tracks = useProjectStore(s => s.tracks)
    const busses = useRoutableBusses(track?.id)
    const [adding, setAdding] = useState(false)

    const sends = track?.sends ?? []
    const busName = useCallback(
        (busId: string) => tracks.find(t => t.id === busId)?.name ?? busId,
        [tracks],
    )

    if (!track) {
        return <div className="h-16 mb-2 flex items-center justify-center text-[8px] font-black text-gray-700 uppercase">No Sends</div>
    }

    const available = busses.filter(b => !sends.some(s => s.busId === b.id))

    return (
        <div className="flex flex-col gap-0.5 h-16 mb-2 overflow-y-auto no-scrollbar">
            {sends.map(send => (
                <div
                    key={send.busId}
                    className="h-5 shrink-0 bg-sky-500/15 border border-sky-400/30 rounded-sm flex items-center px-1.5 gap-1 group/send"
                    title={`${busName(send.busId)} — ${Math.round(send.level * 100)}%`}
                >
                    <span className="text-[8px] font-black text-sky-300 uppercase truncate flex-1">
                        {busName(send.busId)}
                    </span>
                    <input
                        type="range"
                        min={0} max={1} step={0.01}
                        value={send.level}
                        onClick={e => e.stopPropagation()}
                        onChange={e => setTrackSend(track.id, send.busId, Number(e.target.value))}
                        className="w-8 h-1 accent-sky-400 cursor-pointer"
                        aria-label={`Send level to ${busName(send.busId)}`}
                    />
                    <button
                        onClick={e => { e.stopPropagation(); removeTrackSend(track.id, send.busId) }}
                        className="opacity-0 group-hover/send:opacity-100 text-gray-400 hover:text-red-400"
                        aria-label={`Remove send to ${busName(send.busId)}`}
                    >
                        <X className="w-2 h-2" />
                    </button>
                </div>
            ))}

            <div className="relative shrink-0">
                <button
                    onClick={e => { e.stopPropagation(); setAdding(v => !v) }}
                    disabled={available.length === 0}
                    className="w-full h-4 bg-black/20 rounded-sm border border-white/5 text-[7px] font-black text-gray-500 hover:text-sky-300 hover:border-sky-400/30 flex items-center justify-center gap-1 uppercase disabled:opacity-40 disabled:hover:text-gray-500"
                >
                    <Plus className="w-2 h-2" /> Send
                </button>
                <Popover open={adding} onClose={() => setAdding(false)} className="bottom-5 left-0">
                    {available.length === 0 ? (
                        <div className="px-2 py-1 text-gray-500">Create a bus track first</div>
                    ) : available.map(bus => (
                        <button
                            key={bus.id}
                            onClick={() => { setTrackSend(track.id, bus.id, 0.25); setAdding(false) }}
                            className="text-left px-2 py-1 hover:bg-white/10 rounded text-gray-200"
                        >
                            {bus.name}
                        </button>
                    ))}
                </Popover>
            </div>
        </div>
    )
}

// ── Output routing ─────────────────────────────────────────────────────────

export function OutputRouting({ track, isMaster }: { track: Track | null; isMaster?: boolean }) {
    const routeTrackTo = useProjectStore(s => s.routeTrackTo)
    const tracks = useProjectStore(s => s.tracks)
    const busses = useRoutableBusses(track?.id)
    const [open, setOpen] = useState(false)

    const label = isMaster
        ? 'Output'
        : (tracks.find(t => t.id === track?.outputBusId)?.name ?? 'Stereo Out')

    return (
        <div className="relative mb-1">
            <button
                disabled={isMaster || !track}
                onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
                className="w-full h-6 bg-[#252525] border border-white/5 rounded-sm flex items-center px-2 justify-between text-[9px] font-black text-gray-400 shadow-sm hover:border-gray-500 disabled:hover:border-white/5 transition-colors"
                title={isMaster ? 'Master output' : 'Route this channel to a bus'}
            >
                <span className="truncate uppercase">{label}</span>
                <ChevronDown className="w-2.5 h-2.5 text-gray-600 shrink-0" />
            </button>

            <Popover open={open} onClose={() => setOpen(false)} className="top-6 left-0">
                <button
                    onClick={() => { if (track) routeTrackTo(track.id, 'stereo-out'); setOpen(false) }}
                    className="text-left px-2 py-1 hover:bg-white/10 rounded text-gray-200"
                >
                    Stereo Out
                </button>
                {busses.map(bus => (
                    <button
                        key={bus.id}
                        onClick={() => { if (track) routeTrackTo(track.id, bus.id); setOpen(false) }}
                        className="text-left px-2 py-1 hover:bg-white/10 rounded text-gray-200"
                    >
                        {bus.name}
                    </button>
                ))}
                {busses.length === 0 && (
                    <div className="px-2 py-1 text-gray-500">No busses yet</div>
                )}
            </Popover>
        </div>
    )
}

// ── Sidechain ──────────────────────────────────────────────────────────────

/**
 * Pick the track that keys a dynamics plugin — the kick that ducks the sub.
 * Only shown for plugins that respond to one.
 */
export function SidechainPicker({
    track, pluginId,
}: { track: Track; pluginId: string }) {
    const setSidechainSource = useProjectStore(s => s.setSidechainSource)
    const clearSidechainSource = useProjectStore(s => s.clearSidechainSource)
    const tracks = useProjectStore(s => s.tracks)
    const [open, setOpen] = useState(false)

    const plugin = track.plugins.find(p => p.id === pluginId)
    const sourceId = plugin?.sidechainSourceId
    const sourceName = tracks.find(t => t.id === sourceId)?.name

    const candidates = tracks.filter(t =>
        t.id !== track.id && t.type !== 'folder' && t.type !== 'output')

    return (
        <div className="relative">
            <button
                onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
                className={`w-full h-5 rounded-sm border flex items-center px-1.5 gap-1 text-[8px] font-black uppercase transition-colors ${sourceId
                    ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                    : 'bg-black/20 border-white/5 text-gray-500 hover:text-amber-300 hover:border-amber-400/30'}`}
                title="Sidechain key input"
            >
                <Radio className="w-2 h-2 shrink-0" />
                <span className="truncate">{sourceName ? `SC: ${sourceName}` : 'Sidechain'}</span>
            </button>

            <Popover open={open} onClose={() => setOpen(false)} className="top-5 left-0">
                <button
                    onClick={() => { clearSidechainSource(track.id, pluginId); setOpen(false) }}
                    className="text-left px-2 py-1 hover:bg-white/10 rounded text-gray-400"
                >
                    None
                </button>
                {candidates.map(t => (
                    <button
                        key={t.id}
                        onClick={() => { setSidechainSource(track.id, pluginId, t.id); setOpen(false) }}
                        className="text-left px-2 py-1 hover:bg-white/10 rounded text-gray-200"
                    >
                        {t.name}
                    </button>
                ))}
            </Popover>
        </div>
    )
}

// ── Monitor controls ───────────────────────────────────────────────────────

/**
 * Mono-sum and reference direct-out. Both are monitor-path only: they change
 * what you hear, never the mix or the bounce.
 */
export function MonitorControls() {
    const monitorMode = useProjectStore(s => s.monitorMode)
    const setMonitorMode = useProjectStore(s => s.setMonitorMode)
    const tracks = useProjectStore(s => s.tracks)
    const setTrackMonitorMode = useProjectStore(s => s.setTrackMonitorMode)

    const referenceTracks = tracks.filter(t => t.monitorMode === 'direct')

    return (
        <div className="flex items-center gap-1">
            <button
                onClick={() => setMonitorMode(monitorMode === 'mono' ? 'stereo' : 'mono')}
                className={`px-2 h-6 rounded text-[9px] font-black uppercase border transition-colors ${monitorMode === 'mono'
                    ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                    : 'bg-black/30 border-white/10 text-gray-400 hover:text-gray-200'}`}
                title="Fold the monitor to mono — a vocal that vanishes has a phase problem"
            >
                Mono
            </button>

            {referenceTracks.map(t => (
                <button
                    key={t.id}
                    onClick={() => setTrackMonitorMode(t.id, 'normal')}
                    className="px-2 h-6 rounded text-[9px] font-black uppercase border bg-emerald-500/20 border-emerald-400/50 text-emerald-300"
                    title={`${t.name} is bypassing the master chain — click to return it to the mix`}
                >
                    Ref: {t.name}
                </button>
            ))}
        </div>
    )
}
