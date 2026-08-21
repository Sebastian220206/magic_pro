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
import { SendSlotMenu } from './SendSlotMenu'
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
            className={`absolute z-50 min-w-[160px] max-h-56 overflow-y-auto bg-studio-control border border-white/15 rounded-md shadow-2xl p-1 flex flex-col text-[10px] ${className}`}
        >
            {children}
        </div>
    )
}

// ── Sends ──────────────────────────────────────────────────────────────────

export function SendsSlot({ track }: { track: Track | null }) {
    const setTrackSend = useProjectStore(s => s.setTrackSend)
    const setTrackSendPosition = useProjectStore(s => s.setTrackSendPosition)
    const removeTrackSend = useProjectStore(s => s.removeTrackSend)
    const ensureBusTrack = useProjectStore(s => s.ensureBusTrack)
    const tracks = useProjectStore(s => s.tracks)
    const busses = useRoutableBusses(track?.id)

    const sends = track?.sends ?? []
    const busName = useCallback(
        (busId: string) => tracks.find(t => t.id === busId)?.name ?? busId,
        [tracks],
    )

    if (!track) {
        return <div className="h-full flex items-center justify-center text-[8px] font-black text-studio-text-dim uppercase">No Sends</div>
    }

    /*
     * One slot per send plus an empty one, which is how a console works: the
     * empty slot is where the next send is made. Each slot opens the same menu
     * — its own settings first, then the bus list — so choosing a bus and
     * changing where the send taps are the same gesture.
     */
    const slots: (typeof sends[number] | null)[] = [...sends, null]
    const taken = new Set(sends.map(x => x.busId))

    return (
        <div className="flex flex-col gap-px h-full overflow-y-auto no-scrollbar">
            {slots.map((send, i) => (
                <SendSlotMenu
                    key={send?.busId ?? `empty-${i}`}
                    busses={busses
                        .filter(b => b.id === send?.busId || !taken.has(b.id))
                        .map(b => ({ id: b.id, name: b.name, busNumber: b.busNumber }))}
                    busId={send?.busId ?? null}
                    position={send?.position ?? 'postPan'}
                    level={send?.level ?? 0}
                    busName={busName}
                    onPick={(busNumber) => {
                        // Choosing an unused bus brings its aux strip into
                        // being, the way a console's buses already exist.
                        const busId = ensureBusTrack(busNumber)
                        // Moving an existing slot to another bus, rather than
                        // stacking a second send on the same channel.
                        if (send && send.busId !== busId) removeTrackSend(track.id, send.busId)
                        setTrackSend(track.id, busId, send?.level ?? 0.25)
                        if (send?.position) setTrackSendPosition(track.id, busId, send.position)
                    }}
                    onPosition={(position) => {
                        if (send) setTrackSendPosition(track.id, send.busId, position)
                    }}
                    onRemove={() => { if (send) removeTrackSend(track.id, send.busId) }}
                >
                    <div
                        className={`h-[15px] w-full rounded-[2px] border flex items-center px-1 gap-1 text-[8px] font-black uppercase ${send
                            ? 'bg-accent-cyan/15 border-accent-cyan/40 text-accent-cyan'
                            : 'bg-black/30 border-white/5 text-studio-text-dim hover:border-accent-cyan/30 hover:text-accent-cyan'}`}
                    >
                        <span className="truncate flex-1 text-left">
                            {send ? busName(send.busId) : 'Send'}
                        </span>
                        {send && (
                            <span className="tabular-nums shrink-0 opacity-70">
                                {Math.round(send.level * 100)}
                            </span>
                        )}
                    </div>
                </SendSlotMenu>
            ))}
        </div>
    )
}
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
                className="w-full h-6 bg-studio-raised border border-white/5 rounded-sm flex items-center px-2 justify-between text-[9px] font-black text-studio-text-mid shadow-sm hover:border-studio-line-strong disabled:hover:border-white/5 transition-colors"
                title={isMaster ? 'Master output' : 'Route this channel to a bus'}
            >
                <span className="truncate uppercase">{label}</span>
                <ChevronDown className="w-2.5 h-2.5 text-studio-text-dim shrink-0" />
            </button>

            <Popover open={open} onClose={() => setOpen(false)} className="top-6 left-0">
                <button
                    onClick={() => { if (track) routeTrackTo(track.id, 'stereo-out'); setOpen(false) }}
                    className="text-left px-2 py-1 hover:bg-white/10 rounded text-studio-text"
                >
                    Stereo Out
                </button>
                {busses.map(bus => (
                    <button
                        key={bus.id}
                        onClick={() => { if (track) routeTrackTo(track.id, bus.id); setOpen(false) }}
                        className="text-left px-2 py-1 hover:bg-white/10 rounded text-studio-text"
                    >
                        {bus.name}
                    </button>
                ))}
                {busses.length === 0 && (
                    <div className="px-2 py-1 text-studio-text-dim">No busses yet</div>
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
                    : 'bg-black/20 border-white/5 text-studio-text-dim hover:text-amber-300 hover:border-amber-400/30'}`}
                title="Sidechain key input"
            >
                <Radio className="w-2 h-2 shrink-0" />
                <span className="truncate">{sourceName ? `SC: ${sourceName}` : 'Sidechain'}</span>
            </button>

            <Popover open={open} onClose={() => setOpen(false)} className="top-5 left-0">
                <button
                    onClick={() => { clearSidechainSource(track.id, pluginId); setOpen(false) }}
                    className="text-left px-2 py-1 hover:bg-white/10 rounded text-studio-text-mid"
                >
                    None
                </button>
                {candidates.map(t => (
                    <button
                        key={t.id}
                        onClick={() => { setSidechainSource(track.id, pluginId, t.id); setOpen(false) }}
                        className="text-left px-2 py-1 hover:bg-white/10 rounded text-studio-text"
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
                    : 'bg-black/30 border-white/10 text-studio-text-mid hover:text-studio-text'}`}
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
