"use client"

/**
 * The MIDI FX plug-in window.
 *
 * Same chrome as the audio plug-in editors — power, preset menu, previous/next,
 * Compare, then the plug-in's name on a plate along the bottom — so a MIDI
 * effect opens looking like the rest of the app rather than like a dialog that
 * wandered in. Controls with nothing behind them are dimmed and carry the
 * reason, which is the rule `components/Limiter.tsx` set for this chrome.
 *
 * Compare is real: it holds the settings as they were when the window opened
 * and swaps between those and the current ones, which is the only version of
 * A/B worth having. It is per-effect, so switching the slot and coming back
 * does not offer you another effect's settings to compare against.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Power, Redo2, Undo2, X } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { midiFxById, type MidiFxId } from '@/lib/midiFxCatalog';
import { settingsFor, type MidiFxSettings } from '@/lib/midiFxSettings';
import { hasProcessor } from '@/engine/midi/fx/chain';

import { ArpeggiatorPanel } from './ArpeggiatorPanel';
import { ChordTriggerPanel } from './ChordTriggerPanel';
import { ModifierPanel } from './ModifierPanel';
import { ModulatorPanel } from './ModulatorPanel';
import { NoteRepeaterPanel } from './NoteRepeaterPanel';
import { RandomizerPanel } from './RandomizerPanel';
import { ScripterPanel } from './ScripterPanel';
import { TransposerPanel } from './TransposerPanel';
import { VelocityProcessorPanel } from './VelocityProcessorPanel';
import type { MidiFxPanelProps } from './TransposerPanel';

const PANELS: Partial<Record<MidiFxId, React.ComponentType<MidiFxPanelProps>>> = {
    arpeggiator: ArpeggiatorPanel,
    chordTrigger: ChordTriggerPanel,
    modifier: ModifierPanel,
    modulator: ModulatorPanel,
    noteRepeater: NoteRepeaterPanel,
    randomizer: RandomizerPanel,
    scripter: ScripterPanel,
    transposer: TransposerPanel,
    velocityProcessor: VelocityProcessorPanel,
};

export function MidiFxWindow() {
    const openMidiFxEditor = useProjectStore(s => s.openMidiFxEditor);
    const setOpenMidiFxEditor = useProjectStore(s => s.setOpenMidiFxEditor);
    const updateMidiFxSettings = useProjectStore(s => s.updateMidiFxSettings);
    const updateTrackParameter = useProjectStore(s => s.updateTrackParameter);
    const tracks = useProjectStore(s => s.tracks);

    const trackId = openMidiFxEditor?.trackId ?? null;
    const track = tracks.find(t => t.id === trackId);
    const fxId = (track?.midiFx ?? null) as MidiFxId | null;
    const entry = midiFxById(fxId);

    /** Settings held for Compare, captured the first time it is pressed. */
    const heldRef = useRef<{ id: MidiFxId; settings: MidiFxSettings } | null>(null);
    const [comparing, setComparing] = useState(false);

    const settings = useMemo(
        () => (fxId ? settingsFor(track?.midiFxSettings, fxId) : {}),
        [track?.midiFxSettings, fxId],
    );

    const change = useCallback((patch: MidiFxSettings) => {
        if (!trackId || !fxId) return;
        updateMidiFxSettings(trackId, fxId, patch);
    }, [trackId, fxId, updateMidiFxSettings]);

    const toggleCompare = useCallback(() => {
        if (!trackId || !fxId) return;
        const held = heldRef.current;

        if (!held || held.id !== fxId) {
            // First press holds what is on screen now; there is nothing to
            // swap to yet, so the button only arms.
            heldRef.current = { id: fxId, settings: { ...settings } };
            setComparing(true);
            return;
        }

        const current = { ...settings };
        updateMidiFxSettings(trackId, fxId, held.settings, { replace: true });
        heldRef.current = { id: fxId, settings: current };
        setComparing(c => !c);
    }, [trackId, fxId, settings, updateMidiFxSettings]);

    if (!openMidiFxEditor || !trackId || !track) return null;

    if (!fxId || !entry) {
        // The slot emptied while the window was open.
        setOpenMidiFxEditor(null);
        return null;
    }

    const Panel = PANELS[fxId];
    const bypassed = track.midiFxBypass ?? false;
    const live = hasProcessor(fxId);

    return (
        <div className="fixed inset-0 z-[112] flex items-start justify-center p-4 overflow-y-auto bg-black/40 backdrop-blur-[2px] pointer-events-none">
            <div className="pointer-events-auto relative my-auto rounded-xl shadow-[0_40px_120px_rgba(0,0,0,0.9)] bg-studio-panel border border-black overflow-hidden">
                <button
                    onClick={() => setOpenMidiFxEditor(null)}
                    aria-label="Close"
                    className="absolute top-3 right-2.5 z-10 rounded p-1 bg-black/20 text-studio-text-dim hover:text-white transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Header */}
                <div className="px-3 py-2 flex items-center gap-2 border-b border-black/30 bg-black/20">
                    <button
                        onClick={() => updateTrackParameter(trackId, { midiFxBypass: !bypassed })}
                        title={bypassed ? 'Bypassed — click to engage' : 'Engaged — click to bypass'}
                        aria-pressed={!bypassed}
                        className={`w-8 h-8 rounded-full grid place-items-center border transition-colors ${bypassed
                            ? 'border-studio-line text-studio-text-dim bg-black/40'
                            : 'border-accent-cyan text-accent-cyan bg-accent-cyan/15 shadow-[0_0_12px_rgba(34,211,238,0.35)]'}`}
                    >
                        <Power className="w-4 h-4" />
                    </button>

                    <span
                        title="Saved settings for a MIDI effect are not stored yet"
                        className="h-7 min-w-[170px] rounded bg-black/50 border border-studio-line-strong px-2 grid place-items-center text-[11px] text-studio-text-dim opacity-60"
                    >
                        Factory Default
                    </span>

                    <div className="flex gap-0.5">
                        {['‹', '›'].map(glyph => (
                            <span
                                key={glyph}
                                title="Stepping through presets needs a preset store, which does not exist yet"
                                className="h-6 w-6 grid place-items-center rounded bg-black/30 border border-studio-line text-[10px] text-studio-text-dim opacity-40"
                            >
                                {glyph}
                            </span>
                        ))}
                    </div>

                    <button
                        onClick={toggleCompare}
                        title="Swap between these settings and the ones held"
                        className={`h-6 px-3 rounded text-[10px] font-bold border transition-colors ${comparing
                            ? 'bg-accent-cyan/20 border-accent-cyan text-accent-cyan'
                            : 'bg-black/40 border-studio-line-strong text-accent-cyan/80 hover:text-accent-cyan'}`}
                    >
                        Compare
                    </button>

                    {/* Dimmed for the same reasons the audio editors dim them:
                        there is no plugin clipboard, and undo is the project's. */}
                    {['Copy', 'Paste'].map(label => (
                        <span
                            key={label}
                            title="Copying a plug-in's settings is not built yet"
                            className="h-6 px-3 grid place-items-center rounded bg-black/30 border border-studio-line text-[10px] font-bold text-studio-text-dim opacity-40"
                        >
                            {label}
                        </span>
                    ))}
                    <span className="h-6 px-2 grid place-items-center rounded bg-black/30 border border-studio-line text-studio-text-dim opacity-40" title="Use the project's undo">
                        <Undo2 className="w-3 h-3" />
                    </span>
                    <span className="h-6 px-2 grid place-items-center rounded bg-black/30 border border-studio-line text-studio-text-dim opacity-40" title="Use the project's redo">
                        <Redo2 className="w-3 h-3" />
                    </span>

                    <span className="ml-auto mr-7 text-[9px] font-bold uppercase tracking-wider text-studio-text-dim truncate max-w-[140px]">
                        {track.name}
                    </span>
                </div>

                {/* Body */}
                <div className={bypassed ? 'opacity-45 pointer-events-none' : undefined}>
                    {Panel
                        ? <Panel settings={settings} onChange={change} />
                        : (
                            <div className="w-[380px] p-10 flex flex-col items-center gap-3 text-center">
                                <div className="text-[11px] font-bold uppercase tracking-widest text-accent-cyan">
                                    {entry.name}
                                </div>
                                <p className="text-[12px] text-studio-text-dim">
                                    {entry.reason ?? 'This effect has no editor yet.'}
                                </p>
                            </div>
                        )}
                </div>

                {/* Nameplate */}
                <div className="py-1 text-center border-t border-black/30 bg-black/25">
                    <span className="text-[10px] font-medium tracking-wide text-studio-text-mid">
                        {entry.name}
                    </span>
                    {!live && (
                        <span className="ml-2 text-[9px] uppercase tracking-wider text-amber-500/80">
                            settings only
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
