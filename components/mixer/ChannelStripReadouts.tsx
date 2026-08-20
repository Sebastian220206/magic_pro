'use client';

/**
 * The numeric half of a channel strip.
 *
 * The mixer had a fader, a pan knob and two meters, and not one number
 * anywhere: no dB value, no peak reading, no clipping indicator, and no way to
 * type a level in. You could not tell a hot strip from a safe one without
 * listening for distortion. Logic puts a peak display above every meter and a
 * fader-position field beside every fader, and both are how you actually set a
 * mix rather than guess at one.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    gainToDb, dbToGain, formatDb, parseDb, clampGain,
    levelBand, initialPeak, updatePeak, formatPan, parsePan,
    type PeakState,
} from '@/lib/mixerLevel';

/* ─── Peak level display ──────────────────────────────────────────────────
 *
 * Reads the same analyser the meter draws from, holds the loudest value seen,
 * and latches a clip. Click to reset — Logic clears every peak display at
 * once, and so does this, through a shared event.
 */

const PEAK_RESET_EVENT = 'magic-pro:reset-peaks';

/** Clear every peak display in the mixer, the way Logic's does. */
export function resetAllPeakDisplays(): void {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(PEAK_RESET_EVENT));
    }
}

export function PeakDisplay({ analyzer, className = '' }: {
    analyzer: AnalyserNode | null;
    className?: string;
}) {
    const [peak, setPeak] = useState<PeakState>(initialPeak);
    const peakRef = useRef<PeakState>(initialPeak);

    useEffect(() => {
        const clear = () => { peakRef.current = initialPeak; setPeak(initialPeak); };
        window.addEventListener(PEAK_RESET_EVENT, clear);
        return () => window.removeEventListener(PEAK_RESET_EVENT, clear);
    }, []);

    useEffect(() => {
        if (!analyzer) return;
        const data = new Uint8Array(32);
        let raf = 0;
        // Committed a few times a second rather than every frame: the value is
        // a peak hold, so re-rendering at 60fps buys nothing and costs a lot
        // across a wide mixer.
        let lastCommit = 0;

        const tick = () => {
            analyzer.getByteTimeDomainData(data);
            let max = 0;
            for (let i = 0; i < data.length; i++) {
                const v = Math.abs(data[i] - 128);
                if (v > max) max = v;
            }
            const next = updatePeak(peakRef.current, gainToDb(max / 128));
            if (next !== peakRef.current) {
                peakRef.current = next;
                const now = performance.now();
                if (now - lastCommit > 150) {
                    lastCommit = now;
                    setPeak(next);
                }
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [analyzer]);

    const band = peak.clipped ? 'clip' : levelBand(peak.peakDb);

    return (
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); resetAllPeakDisplays(); }}
            title="Peak level — click to reset every peak display"
            aria-label="Peak level"
            data-peak-display
            data-clipped={peak.clipped || undefined}
            className={`h-4 px-1 rounded-[2px] text-[9px] font-black tabular-nums leading-none flex items-center justify-center border transition-colors ${band === 'clip'
                ? 'bg-[#ff4d4d]/25 border-[#ff4d4d] text-[#ff4d4d]'
                : band === 'hot'
                    ? 'bg-[#fbbf24]/15 border-[#fbbf24]/60 text-[#fbbf24]'
                    : 'bg-black/50 border-studio-line text-studio-text-dim'} ${className}`}
        >
            {formatDb(peak.peakDb)}
        </button>
    );
}

/* ─── Fader position field ───────────────────────────────────────────────── */

/**
 * The dB the fader is sitting at. Double-click to type an exact value.
 *
 * Setting a level by dragging alone makes matching two tracks guesswork; this
 * is how you put a strip at exactly -3.
 */
export function LevelField({ gain, onCommit, className = '' }: {
    gain: number;
    onCommit: (gain: number) => void;
    className?: string;
}) {
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editing) inputRef.current?.select();
    }, [editing]);

    const commit = useCallback(() => {
        const db = parseDb(text);
        setEditing(false);
        // Unreadable input leaves the fader where it was, rather than
        // collapsing it to silence.
        if (db === null) return;
        onCommit(clampGain(dbToGain(db)));
    }, [text, onCommit]);

    if (editing) {
        return (
            <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') setEditing(false);
                }}
                onClick={(e) => e.stopPropagation()}
                aria-label="Fader level in decibels"
                className={`h-4 w-full px-1 rounded-[2px] bg-black text-[9px] font-black tabular-nums text-center text-accent-cyan border border-accent-cyan outline-none ${className}`}
            />
        );
    }

    return (
        <button
            type="button"
            onDoubleClick={(e) => {
                e.stopPropagation();
                setText(formatDb(gainToDb(gain)));
                setEditing(true);
            }}
            onClick={(e) => e.stopPropagation()}
            title="Fader level — double-click to type a value"
            aria-label="Fader level"
            data-level-field
            className={`h-4 px-1 rounded-[2px] bg-black/50 border border-studio-line text-[9px] font-black tabular-nums text-studio-text leading-none flex items-center justify-center ${className}`}
        >
            {formatDb(gainToDb(gain))}
        </button>
    );
}

/* ─── Pan value ─────────────────────────────────────────────────────────── */

/** The pan position, typed as `L32`, `R32`, `-32` or `C`. */
export function PanField({ pan, onCommit, className = '' }: {
    pan: number;
    onCommit: (pan: number) => void;
    className?: string;
}) {
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

    const commit = useCallback(() => {
        const value = parsePan(text);
        setEditing(false);
        if (value === null) return;
        onCommit(value);
    }, [text, onCommit]);

    if (editing) {
        return (
            <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') setEditing(false);
                }}
                onClick={(e) => e.stopPropagation()}
                aria-label="Pan position"
                className={`h-4 w-12 px-1 rounded-[2px] bg-black text-[9px] font-black tabular-nums text-center text-accent-cyan border border-accent-cyan outline-none ${className}`}
            />
        );
    }

    return (
        <button
            type="button"
            onDoubleClick={(e) => { e.stopPropagation(); setText(formatPan(pan)); setEditing(true); }}
            onClick={(e) => e.stopPropagation()}
            title="Pan — double-click to type, Alt-click the knob to centre"
            aria-label="Pan position"
            data-pan-field
            className={`text-[8px] font-black uppercase text-studio-text-dim hover:text-accent-cyan tabular-nums ${className}`}
        >
            {formatPan(pan)}
        </button>
    );
}

/* ─── Record enable and input monitoring ─────────────────────────────────── */

/**
 * The two buttons Logic puts under the fader.
 *
 * Both flags already existed on every track and were settable from the track
 * header, but the mixer showed neither — so arming a track meant leaving the
 * mixer, which is the one place you are looking when setting record levels.
 */
export function RecordMonitorButtons({ recordEnabled, inputMonitoring, disabled, onToggleRecord, onToggleMonitor }: {
    recordEnabled: boolean;
    inputMonitoring: boolean;
    disabled?: boolean;
    onToggleRecord: () => void;
    onToggleMonitor: () => void;
}) {
    const base = 'flex-1 h-4 rounded-[2px] border text-[8px] font-black transition-all disabled:opacity-30 disabled:cursor-default';
    return (
        <div className="flex gap-1 w-full px-2">
            <button
                type="button"
                disabled={disabled}
                title={disabled ? 'No input on this channel strip' : 'Record Enable'}
                aria-label="Record Enable"
                aria-pressed={recordEnabled}
                data-record-enable
                onClick={(e) => { e.stopPropagation(); onToggleRecord(); }}
                className={`${base} ${recordEnabled
                    ? 'bg-[#ff4d4d]/25 border-[#ff4d4d] text-[#ff4d4d] shadow-[0_0_8px_rgba(255,77,77,0.35)]'
                    : 'bg-studio-panel border-studio-line text-studio-text-dim hover:text-studio-text'}`}
            >R</button>
            <button
                type="button"
                disabled={disabled}
                title={disabled ? 'No input on this channel strip' : 'Input Monitoring'}
                aria-label="Input Monitoring"
                aria-pressed={inputMonitoring}
                data-input-monitor
                onClick={(e) => { e.stopPropagation(); onToggleMonitor(); }}
                className={`${base} ${inputMonitoring
                    ? 'bg-accent-cyan/25 border-accent-cyan text-accent-cyan shadow-[0_0_8px_var(--accent-cyan-glow)]'
                    : 'bg-studio-panel border-studio-line text-studio-text-dim hover:text-studio-text'}`}
            >I</button>
        </div>
    );
}
