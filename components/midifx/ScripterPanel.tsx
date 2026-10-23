"use client"

/**
 * Scripter.
 *
 * The catalogue's reason for this one was "written, but has no script editor
 * yet", so the editor is the feature: a preset list, the script itself, and
 * the two things that tell you whether it will do anything — the compiler's
 * error, and which handlers the script actually declared.
 *
 * That second readout matters more than it looks. The sandbox calls handlers by
 * name, so a script that compiles perfectly but spells `onNoteOn` as `onNoteon`
 * is completely silent, with nothing in the UI to say why. Listing what
 * compiled is the difference between a script editor and a text box.
 *
 * The reference image shows the Scripter's *Output Targets* pane, which belongs
 * to Logic's "MIDI to Plugin Parameters" preset rather than to the Scripter
 * shell — it routes a controller onto plugin parameters. That routing does not
 * exist here, so the pane is not drawn; the notice at the foot says so.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, Check, Play } from 'lucide-react';
import { MenuField, PanelButton, PanelSection, ToggleButton, type MenuOption } from './controls';
import { createScripter, SCRIPTER_PRESETS } from '@/engine/midi/fx/scripter';
import { toScripterConfig } from '@/lib/midiFxSettings';
import type { MidiFxPanelProps } from './TransposerPanel';

const PRESET_OPTIONS: readonly MenuOption<string>[] = [
    { value: '', label: 'Custom' },
    ...Object.entries(SCRIPTER_PRESETS).map(([id, preset]) => ({
        value: id,
        label: preset.name,
    })),
];

/** Shown when a track has no script yet, and by the Reset button. */
const STARTER_SCRIPT = `// Runs once when the script compiles.
// Declare any of: onNoteOn, onNoteOff, onTransportStart, onTransportStop.
//
// Inside a handler, call:
//   addNote(pitch, velocity, beat, duration)
//   removeNote(pitch, beat)
//   getCurrentBeat()  getTempo()  isTransportPlaying()

function onNoteOn(pitch, velocity, beat) {
  addNote(pitch, velocity, beat, 0.25);
}
`;

interface CompileResult {
    ok: boolean;
    error: string | null;
    handlers: string[];
}

/** Compile in a throwaway Scripter, so the panel never runs code on the live one. */
function compile(script: string): CompileResult {
    const scripter = createScripter({ script, autoRun: false });
    const ok = scripter.compile();
    return {
        ok,
        error: scripter.getLastError(),
        handlers: ok ? scripter.getHandlerNames() : [],
    };
}

export function ScripterPanel({ settings, onChange }: MidiFxPanelProps) {
    const config = toScripterConfig(settings);
    const script = config.script || STARTER_SCRIPT;

    /** The text being edited, which only reaches the track on Run. */
    const [draft, setDraft] = useState(script);
    const [result, setResult] = useState<CompileResult | null>(null);

    const dirty = draft !== script;

    const run = useCallback(() => {
        const next = compile(draft);
        setResult(next);
        // A script that will not compile is not written to the track: the
        // processor would then throw on every note until it was fixed.
        if (next.ok) onChange({ script: draft });
    }, [draft, onChange]);

    const loadPreset = useCallback((id: string) => {
        const preset = SCRIPTER_PRESETS[id];
        const next = preset ? preset.script.trim() + '\n' : STARTER_SCRIPT;
        setDraft(next);
        setResult(null);
        onChange({ preset: id });
    }, [onChange]);

    const activePreset = useMemo(() => {
        const match = Object.entries(SCRIPTER_PRESETS)
            .find(([, preset]) => preset.script.trim() + '\n' === draft);
        return match?.[0] ?? '';
    }, [draft]);

    return (
        <div className="flex flex-col gap-2 p-2.5 w-[520px] max-w-[calc(100vw-2rem)]">
            <PanelSection className="px-3 py-2.5 flex items-center gap-3">
                <MenuField
                    label="Preset"
                    width={190}
                    value={activePreset}
                    options={PRESET_OPTIONS}
                    onChange={loadPreset}
                    title="Replace the script with a worked example"
                />
                <ToggleButton
                    active={config.enabled}
                    onClick={() => onChange({ enabled: !config.enabled })}
                    title="When off the script is bypassed and notes pass through untouched"
                    className="ml-auto"
                >
                    Active
                </ToggleButton>
            </PanelSection>

            <PanelSection className="p-2.5 flex flex-col gap-2">
                <label htmlFor="scripter-source" className="sr-only">Script source</label>
                <textarea
                    id="scripter-source"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        // The app binds single letters to tools, so keystrokes
                        // must not escape the editor. Cmd/Ctrl+Enter runs, the
                        // convention every code pane in this app follows.
                        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run(); }
                    }}
                    spellCheck={false}
                    rows={16}
                    className="w-full resize-y rounded-[3px] bg-black/60 border border-studio-line-strong p-2.5 font-mono text-[11.5px] leading-[1.55] text-studio-text outline-none focus:border-accent-cyan transition-colors"
                />

                <div className="flex items-center gap-2">
                    <PanelButton
                        onClick={run}
                        title="Compile the script and apply it to this track (Ctrl/Cmd + Enter)"
                        className={dirty ? 'border-accent-cyan text-accent-cyan' : ''}
                    >
                        <span className="flex items-center gap-1.5">
                            <Play className="w-3 h-3" /> Run
                        </span>
                    </PanelButton>
                    <PanelButton
                        onClick={() => { setDraft(STARTER_SCRIPT); setResult(null); }}
                        title="Replace the script with the starting template"
                    >
                        Reset
                    </PanelButton>

                    {dirty && (
                        <span className="text-[10.5px] text-amber-400">
                            Edited — not applied until you run it.
                        </span>
                    )}
                </div>

                {/* Compiler feedback */}
                {result && !result.ok && (
                    <div className="flex items-start gap-2 rounded-[3px] border border-red-500/40 bg-red-500/10 px-2.5 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-px" />
                        <span className="font-mono text-[10.5px] leading-relaxed text-red-300 break-words">
                            {result.error ?? 'Script failed to compile.'}
                        </span>
                    </div>
                )}

                {result?.ok && (
                    <div className="flex items-start gap-2 rounded-[3px] border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-px" strokeWidth={3} />
                        <span className="text-[10.5px] leading-relaxed text-emerald-300">
                            {result.handlers.length > 0
                                ? <>Compiled. Handling <span className="font-mono">{result.handlers.join(', ')}</span>.</>
                                : 'Compiled, but no handler was declared — nothing will run. Check the spelling of onNoteOn.'}
                        </span>
                    </div>
                )}
            </PanelSection>

            <PanelSection className="px-3 py-2.5">
                <p className="text-[10.5px] leading-relaxed text-studio-text-dim">
                    Handlers run on the notes you play. Logic&rsquo;s Output Targets pane, which maps a
                    controller onto plugin parameters, is not drawn: this app&rsquo;s note path carries a
                    pitch and a velocity, so there is no controller to map from.
                </p>
            </PanelSection>
        </div>
    );
}
