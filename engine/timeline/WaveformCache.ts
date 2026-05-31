import { Clip } from '@/models/Clip';

export class WaveformCache {
    private cache: Map<string, HTMLCanvasElement> = new Map();
    private dpr: number;

    constructor() {
        this.dpr = window.devicePixelRatio || 1;
    }

    getWaveform(clip: Clip, width: number, height: number, color: string): HTMLCanvasElement {
        const key = `${clip.id}-${width}-${height}-${color}-${clip.waveformPeaks?.resolution}`;
        if (this.cache.has(key)) {
            return this.cache.get(key)!;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width * this.dpr;
        canvas.height = height * this.dpr;
        const ctx = canvas.getContext('2d');

        if (ctx && clip.waveformPeaks) {
            ctx.scale(this.dpr, this.dpr);
            // We'll use the existing drawWaveform but render to this offscreen canvas
            // Importing drawWaveform here or passing it as a callback
            this.drawToCanvas(ctx, clip, width, height, color);
        }

        this.cache.set(key, canvas);
        
        // Limit cache size
        if (this.cache.size > 100) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        return canvas;
    }

    private drawToCanvas(ctx: CanvasRenderingContext2D, clip: Clip, width: number, height: number, color: string) {
        // Implementation of drawWaveform logic or import
        // For now, let's assume we import it in the renderer and pass the offscreen canvas
    }

    clear() {
        this.cache.clear();
    }
}

export const waveformCache = new WaveformCache();
