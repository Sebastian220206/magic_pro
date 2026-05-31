"use client"

import { useEffect, useRef, memo } from 'react';
import { getTimeMarkers } from '@/engine/midi/quantization';

interface MidiCanvasGridProps {
    startBeat: number;
    endBeat: number;
    lowPitch: number;
    highPitch: number;
    pixelPerBeat: number;
    pixelPerSemitone: number;
    gridDivision: number;
    currentBeat?: number;
    width: number;
    height: number;
}

export const MidiCanvasGrid = memo(function MidiCanvasGrid({
    startBeat,
    endBeat,
    lowPitch,
    highPitch,
    pixelPerBeat,
    pixelPerSemitone,
    gridDivision,
    currentBeat = -1,
    width,
    height,
}: MidiCanvasGridProps) {
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

        // 1. Draw Horizontal Pitch Lanes (Black/White keys)
        for (let pitch = lowPitch; pitch <= highPitch; pitch++) {
            const y = (highPitch - pitch) * pixelPerSemitone;
            const isBlackKey = [1, 3, 6, 8, 10].includes(pitch % 12);

            if (isBlackKey) {
                ctx.fillStyle = 'rgba(31, 41, 55, 0.5)';
                ctx.fillRect(0, y, width, pixelPerSemitone);
            }
            
            ctx.strokeStyle = 'rgba(75, 85, 99, 0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, y + pixelPerSemitone);
            ctx.lineTo(width, y + pixelPerSemitone);
            ctx.stroke();
        }

        // 2. Draw Vertical Time Markers
        const markers = getTimeMarkers(startBeat, endBeat, gridDivision as any, { numerator: 4, denominator: 4 });
        
        markers.forEach(marker => {
            const x = (marker.beat - startBeat) * pixelPerBeat;
            const isBar = marker.type === 'bar';
            const isBeat = marker.type === 'beat';

            if (isBar) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 1.5;
            } else if (isBeat) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.lineWidth = 1;
            } else {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.lineWidth = 1;
            }

            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();

            if (isBar && marker.label) {
                ctx.fillStyle = 'rgba(156, 163, 175, 0.8)';
                ctx.font = '10px Inter, sans-serif';
                ctx.fillText(marker.label, x + 4, 12);
            }
        });

        // 3. Draw Playhead
        if (currentBeat >= startBeat && currentBeat <= endBeat) {
            const px = (currentBeat - startBeat) * pixelPerBeat;
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px, 0);
            ctx.lineTo(px, height);
            ctx.stroke();
            
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(px, 0, 4, 0, Math.PI * 2);
            ctx.fill();
        }

    }, [startBeat, endBeat, lowPitch, highPitch, pixelPerBeat, pixelPerSemitone, gridDivision, currentBeat, width, height]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none"
            style={{ width: `${width}px`, height: `${height}px` }}
        />
    );
});
