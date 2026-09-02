"use client"

/**
 * The Session Player button and its dialog.
 *
 * The manual's: a Type pop-up across the three players, a Change Patch switch,
 * and the styles for that type grouped by genre. Choosing a style loads its
 * settings; choosing a type changes which player performs the region.
 *
 * Change Patch off is the manual's "keep the instrument patch when choosing a
 * new style" — worth having, because a style is a way of playing and the sound
 * it happens to ship with is not always the one you want.
 */
import React, { useRef, useState } from 'react'
import { Popover, MenuHeading } from './controls'
import {
    PLAYER_LABEL, styleGroups, type SessionPlayerKind, type SessionStyle,
} from '@/lib/sessionStyles'

const KINDS: SessionPlayerKind[] = ['drummer', 'bass', 'keyboard']

export function PlayerDialog({
    kind, style, changePatch, graphic, name,
    onKind, onStyle, onChangePatch,
}: {
    kind: SessionPlayerKind
    style: string | null
    changePatch: boolean
    /** The instrument drawing, which is also the button. */
    graphic: React.ReactNode
    /** What the panel calls this player right now. */
    name: string
    onKind: (kind: SessionPlayerKind) => void
    onStyle: (style: SessionStyle<never>) => void
    onChangePatch: (on: boolean) => void
}) {
    const ref = useRef<HTMLButtonElement>(null)
    const [open, setOpen] = useState(false)

    return (
        <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-studio-text-dim">{PLAYER_LABEL[kind]}</span>
            <span data-session-style className="text-[12px] font-semibold text-amber-300">{name}</span>
            <button
                ref={ref}
                data-session-player-button
                aria-haspopup="menu"
                title="Choose a Session Player and a style"
                aria-label="Session Player"
                onClick={() => setOpen(o => !o)}
                className="rounded transition-opacity hover:opacity-80"
            >
                {graphic}
            </button>

            <Popover open={open} anchorRef={ref} width={260} onClose={() => setOpen(false)}
                data-session-player-dialog>
                <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-[11px] text-studio-text">Type</span>
                    <div className="flex gap-0.5">
                        {KINDS.map(k => (
                            <button
                                key={k}
                                data-session-kind={k}
                                aria-pressed={k === kind}
                                title={`Perform this region with the ${PLAYER_LABEL[k]}`}
                                onClick={() => { onKind(k); setOpen(false) }}
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${k === kind
                                    ? 'bg-amber-400/20 text-amber-300'
                                    : 'text-studio-text-dim hover:text-white'}`}
                            >
                                {k === 'drummer' ? 'Drums' : k === 'bass' ? 'Bass' : 'Keys'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-[11px] text-studio-text">Change Patch</span>
                    <button
                        data-session-change-patch
                        role="switch"
                        aria-checked={changePatch}
                        title={changePatch
                            ? 'Choosing a style also loads its instrument'
                            : 'Choosing a style leaves the instrument alone'}
                        onClick={() => onChangePatch(!changePatch)}
                        className={`h-4 w-7 rounded-full p-[2px] transition-colors ${changePatch ? 'bg-amber-400' : 'bg-white/15'}`}
                    >
                        <span className={`block h-3 w-3 rounded-full bg-white transition-transform ${changePatch ? 'translate-x-3' : ''}`} />
                    </button>
                </div>

                {styleGroups(kind).map(group => (
                    <div key={group.group}>
                        <MenuHeading label={group.group} />
                        {group.styles.map(s => (
                            <button
                                key={s.name}
                                data-session-style-row={s.name}
                                onClick={() => { onStyle(s); setOpen(false) }}
                                title={`${s.name} — ${s.patch}`}
                                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] transition-colors ${s.name === style
                                    ? 'bg-white/10 text-white'
                                    : 'text-studio-text hover:bg-white/10 hover:text-white'}`}
                            >
                                <span className="w-3 shrink-0 text-amber-300">{s.name === style ? '✓' : ''}</span>
                                <span className="flex-1 truncate">{s.name}</span>
                                <span className="shrink-0 text-[9px] text-studio-text-dim">{s.patch}</span>
                            </button>
                        ))}
                    </div>
                ))}
            </Popover>
        </div>
    )
}
