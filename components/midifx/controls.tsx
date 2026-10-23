"use client"

/**
 * The controls Logic's MIDI FX panels are built from.
 *
 * The reference plugins reuse a small vocabulary — a ruled horizontal slider
 * with a rectangular handle, a rounded readout that opens a menu, an amber
 * latching button, an inset group box, and a piano strip. Building those five
 * once is what keeps seven panels consistent; each panel below is then almost
 * entirely layout.
 *
 * Rendered in this app's palette rather than Logic's brushed aluminium, for the
 * same reason the Limiter and Compressor editors are: the panel opens inside a
 * dark studio window, and a grey plugin floating in it reads as a screenshot
 * someone pasted in. Logic's *layout* is the reference, not its skin.
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

// ─── Group box ───────────────────────────────────────────────────────────────

/** The inset panel the reference groups its controls into. */
export function PanelSection({
    children, className = '', label,
}: { children: React.ReactNode; className?: string; label?: string }) {
    return (
        <div
            className={`rounded-[5px] border border-black/50 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${className}`}
        >
            {label && (
                <div className="px-3 pt-2 text-[9px] font-bold uppercase tracking-[0.14em] text-studio-text-dim">
                    {label}
                </div>
            )}
            {children}
        </div>
    );
}

/** The amber banner the Arpeggiator puts over its Note Order block. */
export function SectionBanner({ children }: { children: React.ReactNode }) {
    return (
        <div className="px-3 py-1.5 text-center text-[12px] font-bold uppercase tracking-[0.2em] text-amber-400 bg-gradient-to-b from-white/[0.06] to-transparent border-b border-black/40">
            {children}
        </div>
    );
}

// ─── Latching button ─────────────────────────────────────────────────────────

/**
 * The amber toggle — Thru, Latch, Single/Multi.
 *
 * `active` is the lit state rather than a `pressed` prop, because several of
 * these are one-of-N selectors where the unlit buttons are still enabled.
 */
export function ToggleButton({
    active, onClick, children, title, disabled, className = '',
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
    title?: string;
    disabled?: boolean;
    className?: string;
}) {
    return (
        <button
            type="button"
            title={title}
            disabled={disabled}
            aria-pressed={active}
            onClick={onClick}
            className={`h-[26px] px-3 rounded-[3px] border text-[11px] font-bold transition-colors ${disabled
                ? 'bg-black/30 border-studio-line text-studio-text-dim/40 cursor-default'
                : active
                    ? 'bg-amber-500/85 border-amber-300 text-black shadow-[0_0_10px_rgba(251,191,36,0.35)]'
                    : 'bg-studio-control border-studio-line-strong text-studio-text-mid hover:text-studio-text hover:border-studio-text-dim'
                } ${className}`}
        >
            {children}
        </button>
    );
}

/** A plain (non-latching) button: Clear, Learn, Delete Last. */
export function PanelButton({
    onClick, children, title, disabled, className = '',
}: {
    onClick: () => void;
    children: React.ReactNode;
    title?: string;
    disabled?: boolean;
    className?: string;
}) {
    return (
        <button
            type="button"
            title={title}
            disabled={disabled}
            onClick={onClick}
            className={`h-[26px] px-3 rounded-[3px] border text-[11px] font-bold transition-colors ${disabled
                ? 'bg-black/30 border-studio-line text-studio-text-dim/40 cursor-default'
                : 'bg-studio-control border-studio-line-strong text-studio-text-mid hover:text-studio-text hover:border-studio-text-dim'
                } ${className}`}
        >
            {children}
        </button>
    );
}

// ─── Menu field ──────────────────────────────────────────────────────────────

export interface MenuOption<T extends string> {
    value: T;
    label: string;
    /** When set the row is dimmed and unselectable, and this is its tooltip. */
    unavailable?: string;
}

/**
 * The rounded readout that opens a menu — "Note Number", "Chromatic".
 *
 * A native `<select>` rather than a portalled popup: it is keyboard and screen
 * reader correct for free, and these panels have no need for the submenus and
 * dividers that made the mixer's own menus worth hand-building. Unavailable
 * options stay in the list, disabled, carrying the reason — the same rule the
 * FX rack follows, so a control that cannot do something says so instead of
 * omitting it and looking incomplete.
 */
export function MenuField<T extends string>({
    value, options, onChange, label, width = 160, title, disabled,
}: {
    value: T;
    options: readonly MenuOption<T>[];
    onChange: (value: T) => void;
    label?: string;
    width?: number | string;
    title?: string;
    disabled?: boolean;
}) {
    const id = useId();
    return (
        <div className="flex items-center gap-2.5">
            {label && (
                <label htmlFor={id} className="text-[11px] text-studio-text-mid whitespace-nowrap">
                    {label}
                </label>
            )}
            <div className="relative" style={{ width }}>
                <select
                    id={id}
                    value={value}
                    title={title}
                    disabled={disabled}
                    onChange={(e) => onChange(e.target.value as T)}
                    className="w-full h-[24px] appearance-none rounded-full bg-studio-sunken border border-studio-line-strong pl-3 pr-7 text-[11px] text-studio-text outline-none focus:border-accent-cyan disabled:text-studio-text-dim/50 transition-colors"
                >
                    {options.map(opt => (
                        <option
                            key={opt.value}
                            value={opt.value}
                            disabled={!!opt.unavailable}
                            title={opt.unavailable}
                        >
                            {opt.unavailable ? `${opt.label} — ${opt.unavailable}` : opt.label}
                        </option>
                    ))}
                </select>
                <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-studio-text-dim pointer-events-none" />
            </div>
        </div>
    );
}

/** The small rounded numeric readout, e.g. Chord Transpose's `0`. */
export function ValueReadout({
    value, width = 54, align = 'center', title,
}: { value: string; width?: number; align?: 'center' | 'right'; title?: string }) {
    return (
        <span
            title={title}
            style={{ width }}
            className={`inline-block h-[22px] leading-[20px] rounded-full bg-studio-sunken border border-studio-line-strong px-2 text-[11px] tabular-nums text-studio-text text-${align}`}
        >
            {value}
        </span>
    );
}

// ─── Ruled slider ────────────────────────────────────────────────────────────

/** Tick ruler behind the sliders. Drawn with a gradient, not 40 elements. */
const RULER_STYLE: React.CSSProperties = {
    backgroundImage:
        'repeating-linear-gradient(to right, rgba(255,255,255,0.22) 0 1px, transparent 1px 5.55%)',
};

/**
 * The horizontal slider with a ruler and a rectangular handle.
 *
 * Drag, click-to-jump, arrow keys, and Alt-click to return to the default —
 * the same gestures `EqKnob` uses, so the whole app moves controls one way.
 * The fill runs from `origin` rather than from the left end, so a bipolar
 * control like Add or Output Offset shows its deflection from centre.
 */
export function RuledSlider({
    value, min, max, step = 1, defaultValue, onChange, origin, disabled, ariaLabel, format,
}: {
    value: number;
    min: number;
    max: number;
    step?: number;
    defaultValue?: number;
    onChange: (value: number) => void;
    /** Where the fill starts. Defaults to `min`. */
    origin?: number;
    disabled?: boolean;
    ariaLabel: string;
    format?: (value: number) => string;
}) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);

    const span = max - min;
    const fraction = span > 0 ? (value - min) / span : 0;
    const originValue = origin ?? min;
    const originFraction = span > 0 ? (originValue - min) / span : 0;

    const valueAt = useCallback((clientX: number) => {
        const rect = trackRef.current?.getBoundingClientRect();
        if (!rect || rect.width === 0) return value;
        const raw = min + ((clientX - rect.left) / rect.width) * span;
        const snapped = Math.round(raw / step) * step;
        // Rounding to the step can leave a float tail (0.30000000000000004),
        // which then shows up in a readout that formats to one decimal.
        return Number(Math.max(min, Math.min(max, snapped)).toFixed(6));
    }, [min, max, span, step, value]);

    const begin = useCallback((e: React.MouseEvent) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.altKey && defaultValue !== undefined) { onChange(defaultValue); return; }

        setDragging(true);
        onChange(valueAt(e.clientX));

        const move = (me: MouseEvent) => onChange(valueAt(me.clientX));
        const up = () => {
            setDragging(false);
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    }, [disabled, defaultValue, onChange, valueAt]);

    const key = useCallback((e: React.KeyboardEvent) => {
        if (disabled) return;
        const coarse = e.shiftKey ? 10 : 1;
        let next: number | null = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = value + step * coarse;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = value - step * coarse;
        else if (e.key === 'Home') next = min;
        else if (e.key === 'End') next = max;
        if (next === null) return;
        e.preventDefault();
        onChange(Number(Math.max(min, Math.min(max, next)).toFixed(6)));
    }, [disabled, value, step, min, max, onChange]);

    return (
        <div
            ref={trackRef}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label={ariaLabel}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-valuetext={format ? format(value) : undefined}
            aria-disabled={disabled || undefined}
            onMouseDown={begin}
            onKeyDown={key}
            className={`relative h-[26px] select-none rounded-[2px] focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-cyan ${disabled ? 'opacity-40 cursor-default' : 'cursor-ew-resize'}`}
        >
            {/* Ruler */}
            <div className="absolute inset-x-0 top-0 h-[11px] opacity-70" style={RULER_STYLE} />

            {/* Track */}
            <div className="absolute inset-x-0 bottom-[7px] h-[4px] rounded-full bg-black/70 border border-black/60 overflow-hidden">
                <div
                    className="absolute top-0 bottom-0 bg-amber-500/80"
                    style={{
                        left: `${Math.min(fraction, originFraction) * 100}%`,
                        width: `${Math.abs(fraction - originFraction) * 100}%`,
                    }}
                />
            </div>

            {/* Handle */}
            <div
                className={`absolute top-[2px] w-[11px] h-[21px] -ml-[5.5px] rounded-[2px] border pointer-events-none transition-shadow ${dragging
                    ? 'bg-studio-text border-white shadow-[0_0_10px_rgba(34,211,238,0.5)]'
                    : 'bg-gradient-to-b from-studio-text-mid to-studio-control border-black/70'}`}
                style={{ left: `${fraction * 100}%` }}
            />
        </div>
    );
}

/**
 * Two handles on one ruler — the Randomizer's Input Range.
 *
 * The handles do not swap when they cross; `low` stays the low control and the
 * processor sorts the pair. Swapping identity mid-drag makes the handle jump
 * out from under the pointer.
 */
export function RuledRangeSlider({
    low, high, min, max, onChange, ariaLabel,
}: {
    low: number;
    high: number;
    min: number;
    max: number;
    onChange: (low: number, high: number) => void;
    ariaLabel: string;
}) {
    const lowFraction = (low - min) / (max - min);
    const highFraction = (high - min) / (max - min);
    const from = Math.min(lowFraction, highFraction);
    const to = Math.max(lowFraction, highFraction);

    return (
        <div className="relative">
            <div className="absolute inset-x-0 top-0 h-[11px] opacity-70 pointer-events-none" style={RULER_STYLE} />
            <div className="absolute inset-x-0 bottom-[7px] h-[4px] rounded-full bg-black/70 border border-black/60 overflow-hidden pointer-events-none">
                <div
                    className="absolute top-0 bottom-0 bg-amber-500/80"
                    style={{ left: `${from * 100}%`, width: `${(to - from) * 100}%` }}
                />
            </div>
            <div className="relative flex flex-col">
                <RuledSlider
                    value={low} min={min} max={max} onChange={v => onChange(v, high)}
                    ariaLabel={`${ariaLabel} low`}
                />
                <div className="-mt-[26px]">
                    <RuledSlider
                        value={high} min={min} max={max} onChange={v => onChange(low, v)}
                        ariaLabel={`${ariaLabel} high`}
                    />
                </div>
            </div>
        </div>
    );
}

/** Label above, ruled slider below, readout on the right. */
export function SliderRow({
    label, readout, children, hint,
}: { label: string; readout?: string; children: React.ReactNode; hint?: string }) {
    return (
        <div className="flex items-center gap-3">
            <span className="w-[92px] shrink-0 text-[11px] text-studio-text-mid" title={hint}>{label}</span>
            <div className="flex-1 min-w-0">{children}</div>
            {readout !== undefined && <ValueReadout value={readout} />}
        </div>
    );
}

// ─── Piano strip ─────────────────────────────────────────────────────────────

/** Semitones that are black keys, by pitch class. */
const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

export interface KeyboardProps {
    /** Lowest MIDI pitch shown. */
    from: number;
    /** Highest MIDI pitch shown. */
    to: number;
    /** Pitches drawn as active. */
    active?: ReadonlySet<number>;
    onToggle?: (pitch: number) => void;
    /** Tint for active keys. */
    tone?: 'cyan' | 'amber';
    height?: number;
    label?: string;
    ariaLabel: string;
}

/**
 * A piano strip with C markers, used by the Chord Trigger and Transposer.
 *
 * White keys lay out in a flex row and black keys are positioned over the
 * seams between them, which is the only way to get the real spacing — a piano
 * octave is seven white keys wide, not twelve equal ones, and drawing twelve
 * equal keys is the tell that a keyboard was faked.
 */
export function MiniKeyboard({
    from, to, active, onToggle, tone = 'cyan', height = 56, label, ariaLabel,
}: KeyboardProps) {
    const pitches: number[] = [];
    for (let p = from; p <= to; p++) pitches.push(p);
    const whites = pitches.filter(p => !BLACK_KEYS.has(((p % 12) + 12) % 12));

    const activeTone = tone === 'amber'
        ? { white: 'bg-amber-400 border-amber-300', black: 'bg-amber-500 border-amber-300' }
        : { white: 'bg-accent-cyan border-cyan-200', black: 'bg-cyan-500 border-cyan-300' };

    return (
        <div className="flex flex-col gap-1">
            {label && (
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-studio-text-dim text-center">
                    {label}
                </span>
            )}
            <div
                role="group"
                aria-label={ariaLabel}
                className="relative rounded-[3px] border border-black/60 bg-black/40 overflow-hidden"
                style={{ height }}
            >
                {/* White keys */}
                <div className="absolute inset-0 flex">
                    {whites.map(pitch => {
                        const on = active?.has(pitch);
                        return (
                            <button
                                key={pitch}
                                type="button"
                                tabIndex={onToggle ? 0 : -1}
                                aria-label={`${noteName(pitch)}`}
                                aria-pressed={onToggle ? !!on : undefined}
                                onClick={onToggle ? () => onToggle(pitch) : undefined}
                                className={`flex-1 min-w-0 border-r border-black/70 last:border-r-0 relative transition-colors ${on ? activeTone.white : 'bg-gradient-to-b from-studio-text to-studio-text-mid'} ${onToggle ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                                {((pitch % 12) + 12) % 12 === 0 && (
                                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[7px] font-bold text-black/55 pointer-events-none">
                                        {noteName(pitch)}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Black keys, over the seams */}
                <div className="absolute inset-0 pointer-events-none">
                    {pitches.filter(p => BLACK_KEYS.has(((p % 12) + 12) % 12)).map(pitch => {
                        // Position by how many white keys precede it, so the
                        // offset stays right whatever pitch the strip starts on.
                        const whitesBefore = whites.filter(w => w < pitch).length;
                        const on = active?.has(pitch);
                        return (
                            <button
                                key={pitch}
                                type="button"
                                tabIndex={onToggle ? 0 : -1}
                                aria-label={noteName(pitch)}
                                aria-pressed={onToggle ? !!on : undefined}
                                onClick={onToggle ? () => onToggle(pitch) : undefined}
                                style={{
                                    left: `calc(${(whitesBefore / whites.length) * 100}% - ${100 / whites.length / 3.2}%)`,
                                    width: `${(100 / whites.length) * 0.62}%`,
                                    height: '62%',
                                }}
                                className={`absolute top-0 rounded-b-[2px] border border-black/80 pointer-events-auto transition-colors ${on ? activeTone.black : 'bg-gradient-to-b from-[#20303f] to-black'} ${onToggle ? 'cursor-pointer' : 'cursor-default'}`}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function noteName(pitch: number): string {
    return `${NOTE_NAMES[((pitch % 12) + 12) % 12]}${Math.floor(pitch / 12) - 1}`;
}

// ─── Notice ──────────────────────────────────────────────────────────────────

/**
 * The strip a panel shows when part of it cannot work yet.
 *
 * Kept as a component rather than written into each panel so the wording stays
 * uniform and so there is one place to delete when a limitation is lifted.
 */
export function PanelNotice({ children }: { children: React.ReactNode }) {
    return (
        <p className="px-3 py-2 text-[10.5px] leading-relaxed text-studio-text-dim border-t border-black/40 bg-black/20">
            {children}
        </p>
    );
}

/** Re-runs `fn` on every animation frame while `active`. */
export function useAnimationFrame(active: boolean, fn: () => void): void {
    const ref = useRef(fn);
    ref.current = fn;
    useEffect(() => {
        if (!active) return;
        let raf = 0;
        const loop = () => { ref.current(); raf = requestAnimationFrame(loop); };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [active]);
}
