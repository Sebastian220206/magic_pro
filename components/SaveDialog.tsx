"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Cloud, HardDrive, AlertTriangle } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'

interface SaveDialogProps {
    projectName: string
    /** Which command opened this — they save to different places. */
    mode?: 'saveAs' | 'saveCopy'
    onClose: () => void
    onSave: (data: SaveData) => void
}

/**
 * What the save actually consumes.
 *
 * This used to carry an `organization` ('Package' | 'Folder') and seven asset
 * flags — Alchemy data, Ultrabeat data, Space Designer impulse responses,
 * Apple Sound Library content. `saveAs` and `saveCopyAs` read `data.name` and
 * nothing else, and never have; there are no packages on the web and no
 * instruments here by those names. Eleven controls, none connected.
 */
export interface SaveData {
    name: string
}

/**
 * Save As, for a DAW that saves to an account rather than to a disk.
 *
 * The dialog this replaces was a macOS save sheet: a Where: picker pointing at
 * a folder called "Logic", a Tags field with no column behind it, and a
 * Package/Folder choice describing a bundle format this app does not produce.
 * None of it could work in a browser, and the name it handed back carried a
 * ".magicx" extension that went straight into the project's name — so projects
 * were stored and listed as "New Project.magicx".
 *
 * What is left is the one field that is real, an honest statement of the two
 * places the save goes, and the warning that matters: audio lives in this
 * browser and does not travel with the project.
 */
export function SaveDialog({ projectName, mode = 'saveAs', onClose, onSave }: SaveDialogProps) {
    // The extension was a filename artifact from the macOS sheet. A project has
    // a name, not a filename — and this one was being stored verbatim.
    const [name, setName] = useState(() => (projectName || 'Magic Pro Project').replace(/\.magicx$/i, ''))
    const inputRef = useRef<HTMLInputElement>(null)

    const clips = useProjectStore(s => s.clips)

    /*
     * Audio is held in this browser's IndexedDB under a storage key and
     * referenced by the clip. Nothing uploads it — `lib/storage-s3.ts` is not
     * reachable from the app — so the project JSON that reaches the account
     * carries references to files only this machine has. Worth saying out loud
     * at the moment someone makes a second copy expecting it to be complete.
     */
    const browserOnlyAudio = useMemo(
        () => new Set(
            clips.filter(c => c.type === 'audio').map(c => c.storageKey).filter(Boolean)
        ).size,
        [clips]
    )

    useEffect(() => {
        inputRef.current?.select()
    }, [])

    const trimmed = name.trim()
    const canSave = trimmed.length > 0

    const handleSave = () => {
        if (!canSave) return
        onSave({ name: trimmed })
    }

    const title = mode === 'saveCopy' ? 'Save a Copy As' : 'Save As'
    const confirmLabel = mode === 'saveCopy' ? 'Save Copy' : 'Save'

    return (
        <div
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
            onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
        >
            <div
                className="bg-studio-panel w-[460px] rounded-xl border border-studio-line-strong shadow-[0_24px_70px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden text-studio-text animate-in fade-in zoom-in-95 duration-200"
                onKeyDown={e => {
                    if (e.key === 'Escape') { e.stopPropagation(); onClose() }
                    if (e.key === 'Enter') { e.stopPropagation(); handleSave() }
                }}
            >
                <div className="px-5 py-3 border-b border-studio-line">
                    <h2 className="text-[14px] font-bold">{title}</h2>
                </div>

                <div className="p-5 space-y-5">
                    <div className="space-y-1.5">
                        <label htmlFor="save-name" className="block text-[11px] font-bold uppercase tracking-wider text-studio-text-dim">
                            Project name
                        </label>
                        <input
                            id="save-name"
                            ref={inputRef}
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            autoFocus
                            className="w-full bg-studio-control border border-studio-line rounded-md px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-accent-cyan focus:border-transparent transition-all"
                        />
                        {!canSave && (
                            <p className="text-[11px] text-amber-400/90">A project needs a name.</p>
                        )}
                    </div>

                    {/*
                        Where it goes — a readout, not a picker. Both of these
                        happen on every save; there is no third option and no
                        folder to choose, so offering a control would be
                        offering a decision that does not exist.
                    */}
                    <div className="space-y-1.5">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-studio-text-dim">
                            Saves to
                        </span>
                        <div className="rounded-md border border-studio-line bg-studio-sunken divide-y divide-studio-line">
                            <div className="flex items-start gap-3 px-3 py-2.5">
                                <Cloud className="w-4 h-4 text-accent-cyan mt-0.5 shrink-0" />
                                <div>
                                    <div className="text-[13px]">Your account</div>
                                    <div className="text-[11px] text-studio-text-dim">Opens on any device you sign in from.</div>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 px-3 py-2.5">
                                <HardDrive className="w-4 h-4 text-accent-cyan mt-0.5 shrink-0" />
                                <div>
                                    <div className="text-[13px]">This browser</div>
                                    <div className="text-[11px] text-studio-text-dim">Kept offline, so the project opens without a connection.</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {browserOnlyAudio > 0 && (
                        <div
                            data-audio-warning
                            className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2.5"
                        >
                            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                            <div className="text-[11px] leading-relaxed text-studio-text-dim">
                                <span className="text-amber-300 font-semibold">
                                    {browserOnlyAudio} audio {browserOnlyAudio === 1 ? 'file stays' : 'files stay'} on this browser.
                                </span>{' '}
                                Recordings and imports are held locally and are not uploaded, so this
                                project will open on another device without them.
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-5 py-4 border-t border-studio-line flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-md border border-studio-line bg-studio-control text-[13px] hover:bg-white/[0.04] active:bg-white/[0.07] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        data-save-confirm
                        onClick={handleSave}
                        disabled={!canSave}
                        className="px-5 py-1.5 rounded-md bg-accent-cyan text-[#04070b] text-[13px] font-semibold transition-colors hover:bg-cyan-300 active:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
