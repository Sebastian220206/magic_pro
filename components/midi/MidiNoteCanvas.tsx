"use client"

import { useEffect, useRef, memo } from 'react';
import { MidiNote } from '@/engine/midi/types';

interface MidiNoteCanvasProps {
    notes: MidiNote[];
    startBeat: number;
    endBeat: number;
    lowPitch: number;
    highPitch: number;
    pixelPerBeat: number;
    pixelPerSemitone: number;
    width: number;
    height: number;
    color: string;
    selectedNoteIds: Set<string>;
    dragStateNoteId?: string;
}

export const MidiNoteCanvas = memo(function MidiNoteCanvas({
    notes,
    startBeat,
    endBeat,
    lowPitch,
    highPitch,
    pixelPerBeat,
    pixelPerSemitone,
    width,
    height,
    color,
    selectedNoteIds,
    dragStateNoteId,
}: MidiNoteCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, height);

        notes.forEach(note => {
            // Culling
            if (note.startBeat + note.duration < startBeat || note.startBeat > endBeat) return;
            if (note.pitch < lowPitch || note.pitch > highPitch) return;

            const x = (note.startBeat - startBeat) * pixelPerBeat;
            const y = (highPitch - note.pitch) * pixelPerSemitone;
            const w = note.duration * pixelPerBeat;
            const h = pixelPerSemitone - 1;

            const isSelected = selectedNoteIds.has(note.id);
            const isDragging = dragStateNoteId === note.id;

// Note Box
          const noteColor = note.color || color;
          ctx.fillStyle = isSelected ? 'white' : noteColor;
          ctx.globalAlpha = isDragging ? 0.6 : 1.0;
          
          // Rounded rect for notes
          roundRect(ctx, x, y + 0.5, Math.max(2, w - 1), h, 2, true, isSelected);

            // Velocity indicator (darker strip at bottom)
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(x, y + h - 2, w - 1, 2);
        });

    }, [notes, startBeat, endBeat, lowPitch, highPitch, pixelPerBeat, pixelPerSemitone, width, height, color, selectedNoteIds, dragStateNoteId]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none"
            style={{ width: `${width}px`, height: `${height}px`, zIndex: 20 }}
        />
    );
});

// Internal helper for rounded rect
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: boolean, stroke: boolean) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}
