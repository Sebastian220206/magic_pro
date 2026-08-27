"use client"
import React, { useCallback, useRef } from 'react';

/**
 * A drag-to-turn knob.
 *
 * Vertical drag rather than rotary tracking: rotary feels precise on a mouse
 * only when the pointer is far from the centre, and these are small. Shift
 * drags four times finer, Alt returns to the default — the same gestures the
 * mixer's fader and pan already use, so the whole app turns knobs one way.
 */
export function EqKnob({
    value, min, max, defaultValue = 0, size = 34, color = '#22d3ee',
    label, onChange, onCommit, disabled, title,
}: {
    value: number;
    min: number;
    max: number;
    defaultValue?: number;
    size?: number;
    color?: string;
    label?: string;
    onChange: (value: number) => void;
    onCommit?: () => void;
    disabled?: boolean;
    title?: string;
}) {
    const dragging = useRef(false);

    const begin = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (disabled) return;
        if (e.altKey) { onChange(defaultValue); onCommit?.(); return; }

        dragging.current = true;
        const startY = e.clientY;
        const startValue = value;
        const span = max - min;

        const onMove = (me: MouseEvent) => {
            // 180px of travel covers the whole range; Shift stretches it to 720.
            const travel = me.shiftKey ? 720 : 180;
            const next = startValue + ((startY - me.clientY) / travel) * span;
            onChange(Math.max(min, Math.min(max, next)));
        };
        const onUp = () => {
            dragging.current = false;
            onCommit?.();
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [value, min, max, defaultValue, onChange, onCommit, disabled]);

    // The pointer sweeps 270 degrees, leaving a gap at the bottom so the ends
    // of the range are distinguishable from each other.
    const fraction = max > min ? (value - min) / (max - min) : 0;
    const angle = -135 + fraction * 270;
    const radius = size / 2;
    const ARC = 2 * Math.PI * (radius - 3) * 0.75;

    return (
        <div className="flex flex-col items-center gap-0.5 select-none">
            <div
                onMouseDown={begin}
                title={title}
                style={{ width: size, height: size }}
                className={`relative ${disabled ? 'opacity-30 cursor-default' : 'cursor-ns-resize'}`}
            >
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <circle
                        cx={radius} cy={radius} r={radius - 3}
                        fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3"
                        strokeDasharray={`${ARC} ${ARC * 2}`}
                        transform={`rotate(135 ${radius} ${radius})`}
                        strokeLinecap="round"
                    />
                    <circle
                        cx={radius} cy={radius} r={radius - 3}
                        fill="none" stroke={color} strokeWidth="3"
                        strokeDasharray={`${ARC * fraction} ${ARC * 4}`}
                        transform={`rotate(135 ${radius} ${radius})`}
                        strokeLinecap="round"
                    />
                    <circle cx={radius} cy={radius} r={radius - 7} fill="#0b1119" stroke="rgba(255,255,255,0.06)" />
                    <line
                        x1={radius} y1={radius}
                        x2={radius + Math.sin((angle * Math.PI) / 180) * (radius - 9)}
                        y2={radius - Math.cos((angle * Math.PI) / 180) * (radius - 9)}
                        stroke={color} strokeWidth="2" strokeLinecap="round"
                    />
                </svg>
            </div>
            {label && (
                <span className="text-[7px] font-bold uppercase tracking-wide text-studio-text-dim">{label}</span>
            )}
        </div>
    );
}
