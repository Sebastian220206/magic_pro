import { Clip } from '@/models/Clip';
import { Track } from '@/models/Track';
import { drawWaveform } from '@/engine/waveform';
import { waveformCache } from './WaveformCache';
import { RendererContract } from '../rendering/contracts/RendererScheduler';
import { BoundingBox } from '../rendering/invalidation/DirtyRegionManager';
import { ViewportState } from '../navigation/types';
import { useProjectStore } from '@/store/projectStore';
import { globalSpatialCache } from '../rendering/cache/SpatialCache';
import { safeMultiply, safeDivide } from '@/lib/rendering/math/safeMath';
import { isFiniteRect, safeCreateLinearGradient, safeText, safeMoveTo, safeLineTo, safeArcTo } from '@/lib/rendering/math/canvasSafety';

function safeRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return;
  }
  if (width <= 0 || height <= 0) {
    return;
  }
  ctx.rect(x, y, width, height);
}

function safeFillRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return;
  }
  if (width <= 0 || height <= 0) {
    return;
  }
  ctx.fillRect(x, y, width, height);
}

// Legacy viewport interface mapped from ViewportState
export interface TimelineViewport {
    startTime: number; // beats
    endTime: number;
    zoomLevel: number; // pixels per beat
    width: number;
    height: number;
    scrollLeft: number;
    scrollTop: number;
}

export class TimelineRenderer implements RendererContract {
    public priority = 20; // Background grid + clips

    constructor(private ctx: CanvasRenderingContext2D) {}

    // Maps global ViewportState to legacy TimelineViewport math
    private getViewportArgs(viewport: Readonly<ViewportState>): TimelineViewport | null {
        if (!Number.isFinite(viewport.startBeat) || !Number.isFinite(viewport.pixelsPerBeat) || viewport.pixelsPerBeat <= 0) {
            if (process.env.NODE_ENV === 'development') {
                console.warn('[TimelineRenderer] Invalid viewport state', viewport);
            }
            return null;
        }
        return {
            startTime: viewport.startBeat,
            endTime: viewport.startBeat + safeDivide(this.ctx.canvas.width, viewport.pixelsPerBeat),
            zoomLevel: viewport.pixelsPerBeat,
            width: this.ctx.canvas.width,
            height: this.ctx.canvas.height,
            scrollLeft: 0,
            scrollTop: 0
        };
    }

    public renderFull(ctx: CanvasRenderingContext2D, viewportState: Readonly<ViewportState>) {
        const viewport = this.getViewportArgs(viewportState);
        if (!viewport) return;

        const store = useProjectStore.getState();

        // Prebuild spatial cache for O(1) fetching during partial redraws
        globalSpatialCache.buildCache(store.clips);

        ctx.clearRect(0, 0, viewport.width, viewport.height);
        
        this.drawGrid(viewport, ctx);
        this.drawClips(store.tracks, store.clips, viewport, store.trackHeight, store.selectedClipIds, ctx);

        if (store.showAutomation) {
            // this.drawAutomation(store.tracks, viewport, store.trackHeight);
        }

        this.drawPlayhead(store.playhead, viewport, ctx);
    }

    public renderRegion(ctx: CanvasRenderingContext2D, viewportState: Readonly<ViewportState>, region: BoundingBox) {
        const viewport = this.getViewportArgs(viewportState);
        if (!viewport) return;

        const store = useProjectStore.getState();
        
        // Optimize: Only fetch clips that intersect this region's X coordinates
        const startBeat = viewportState.startBeat + safeDivide(region.x, viewportState.pixelsPerBeat);
        const endBeat = viewportState.startBeat + safeDivide(region.x + region.width, viewportState.pixelsPerBeat);
        
        const regionClips = globalSpatialCache.getClipsInRange(startBeat, endBeat);

        // Grid must be redrawn in the cleared region
        this.drawGrid(viewport, ctx);
        
        // Draw only intersecting clips
        this.drawClips(store.tracks, regionClips, viewport, store.trackHeight, store.selectedClipIds, ctx);

        // Only redraw playhead if the playhead intersects the dirty region
        const playheadX = store.playhead * viewport.zoomLevel - (viewport.startTime * viewport.zoomLevel);
        if (playheadX >= region.x && playheadX <= region.x + region.width) {
            this.drawPlayhead(store.playhead, viewport, ctx);
        }
    }

    private drawGrid(viewport: TimelineViewport, ctx: CanvasRenderingContext2D) {
        const { width, height, zoomLevel, startTime, endTime } = viewport;
        if (![width, height, zoomLevel, startTime, endTime].every(Number.isFinite)) {
            console.warn('[TimelineRenderer] Invalid viewport for grid, skipping');
            return;
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;

        const startBeat = Math.floor(startTime);
        const endBeat = Math.ceil(endTime);

        ctx.beginPath();
        for (let b = startBeat; b <= endBeat; b++) {
            const x = safeMultiply(b - startTime, zoomLevel);
            if (Number.isFinite(x)) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
            }
        }
        ctx.stroke();

        // Draw Bar lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        const startBar = Math.floor(startTime / 4) * 4;
        for (let b = startBar; b <= endBeat; b += 4) {
            const x = safeMultiply(b - startTime, zoomLevel);
            if (Number.isFinite(x)) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
            }
        }
        ctx.stroke();
    }

    private drawClips(
        tracks: Track[],
        clips: Clip[],
        viewport: TimelineViewport,
        trackHeight: number,
        selectedClipIds: string[],
        ctx: CanvasRenderingContext2D
    ) {
        const { zoomLevel, startTime, endTime } = viewport;

        clips.forEach(clip => {
            const sb = clip.startBeat ?? clip.start ?? 0;
            const clipStart = Number.isFinite(sb) ? sb : 0;
            const clipDuration = Number.isFinite(clip.duration) ? clip.duration : 0;
            if (!Number.isFinite(clipStart) || !Number.isFinite(clipDuration)) {
                if (process.env.NODE_ENV === 'development') {
                    console.warn('[TimelineRenderer] Invalid clip data, skipping', { id: clip.id, clipStart, clipDuration });
                }
                return;
            }

            const clipEnd = clipStart + clipDuration;
            if (clipEnd < startTime || clipStart > endTime) return;

            const trackIndex = tracks.findIndex(t => t.id === clip.trackId);
            if (trackIndex === -1) return;

            const y = safeMultiply(trackIndex, trackHeight);
            const x = safeMultiply(clipStart - startTime, zoomLevel);
            const w = safeMultiply(clipDuration, zoomLevel);
            const h = trackHeight - 2;

            if (!isFiniteRect(x, y, w, h)) {
                if (process.env.NODE_ENV === 'development') {
                    console.warn('[TimelineRenderer] Non-finite bounds, skipping clip', { id: clip.id, x, y, w, h });
                }
                return;
            }

            // Box shadow/glow for selection
            ctx.shadowBlur = selectedClipIds.includes(clip.id) ? 10 : 0;
            ctx.shadowColor = 'rgba(14, 165, 233, 0.5)';

            // Draw Region Box with Gradient
            const gradient = safeCreateLinearGradient(ctx, x, y, x, y + h);
            if (gradient) {
                gradient.addColorStop(0, this.lightenColor(clip.color || '#4ade80', 0.2));
                gradient.addColorStop(1, clip.color || '#4ade80');
                ctx.fillStyle = gradient;
                ctx.globalAlpha = clip.muted ? 0.4 : 0.9;
                this.roundRect(ctx, x, y + 1, w, h, 4, true, true);
                ctx.shadowBlur = 0;

                // Border
                ctx.strokeStyle = selectedClipIds.includes(clip.id) ? 'white' : 'rgba(0,0,0,0.3)';
                ctx.lineWidth = selectedClipIds.includes(clip.id) ? 1.5 : 1;
                ctx.stroke();

                // Draw Waveform for Audio Clips
                if (clip.type === 'audio' && clip.waveformPeaks) {
                    const waveH = h - 20;
                    const waveY = y + 18;
                    if (Number.isFinite(w) && Number.isFinite(waveH)) {
                        const cachedWave = waveformCache.getWaveform(clip, w, waveH, 'rgba(0,0,0,0.5)');
                        ctx.drawImage(cachedWave, x, waveY, w, waveH);
                    }
                }

                // Draw Label Area
                safeFillRect(ctx, x + 1, y + 1, w - 2, 16);

                ctx.fillStyle = 'white';
                ctx.font = '900 9px "Inter", sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                const label = clip.name?.toUpperCase() ?? '';
                const textWidth = ctx.measureText(label).width;
                if (textWidth < w - 10) {
                    safeText(ctx, label, x + 6, y + 10);
                }
            }
        });

        ctx.globalAlpha = 1.0;
    }

    private drawPlayhead(playhead: number, viewport: TimelineViewport, ctx: CanvasRenderingContext2D) {
        if (!Number.isFinite(playhead)) return;
        const { zoomLevel, height, startTime } = viewport;
        if (![zoomLevel, height, startTime].every(Number.isFinite)) return;
        const x = safeMultiply(playhead - startTime, zoomLevel);
        if (!Number.isFinite(x)) return;

        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 1;
        ctx.beginPath();
        safeMoveTo(ctx, x, 0);
        safeLineTo(ctx, x, height);
        ctx.stroke();

        // Playhead Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(14, 165, 233, 0.8)';
        ctx.fillStyle = '#0ea5e9';
        ctx.beginPath();
        safeRect(ctx, x - 1, 0, 2, height);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: boolean, stroke: boolean) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        if (!isFiniteRect(x, y, w, h) || !Number.isFinite(r)) return;
        ctx.beginPath();
        safeMoveTo(ctx, x + r, y);
        safeArcTo(ctx, x + w, y, x + w, y + h, r);
        safeArcTo(ctx, x + w, y + h, x, y + h, r);
        safeArcTo(ctx, x, y + h, x, y, r);
        safeArcTo(ctx, x, y, x + w, y, r);
        ctx.closePath();
        if (fill) ctx.fill();
        if (stroke) ctx.stroke();
    }

    private lightenColor(color: string, amount: number): string {
        // Simple hex/rgba lighten logic
        return color; // Placeholder
    }
}
