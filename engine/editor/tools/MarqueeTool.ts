/**
 * MarqueeTool.ts
 * Tool for drawing a marquee selection box.
 */

import { Tool, InteractionEvent } from '../types/tools';
import { SelectionManager } from '../SelectionManager';
import { CoordinateSystem } from '../CoordinateSystem';
import { useProjectStore } from '@/store/projectStore';

export class MarqueeTool implements Tool {
    readonly id = 'marquee';
    readonly cursor = 'crosshair';

    private startPoint: InteractionEvent | null = null;
    private currentPoint: InteractionEvent | null = null;

    constructor(
        private selectionManager: SelectionManager,
        private coordinateSystem: CoordinateSystem
    ) {}

    onPointerDown(event: InteractionEvent) {
        this.startPoint = event;
        this.currentPoint = event;
        if (!event.modifiers.shift) {
            this.selectionManager.clear();
        }
    }

    onPointerMove(event: InteractionEvent) {
        if (!this.startPoint) return;
        this.currentPoint = event;
        
        // Real-time selection update (optional, but professional)
        this.updateSelection();
    }

    onPointerUp(event: InteractionEvent) {
        this.updateSelection();
        this.startPoint = null;
        this.currentPoint = null;
    }

    private updateSelection() {
        if (!this.startPoint || !this.currentPoint) return;

        const { clips, tracks, trackHeight } = useProjectStore.getState();
        
        const minBeat = Math.min(this.startPoint.editorPoint.beat, this.currentPoint.editorPoint.beat);
        const maxBeat = Math.max(this.startPoint.editorPoint.beat, this.currentPoint.editorPoint.beat);
        const minVert = Math.min(this.startPoint.editorPoint.vertical, this.currentPoint.editorPoint.vertical);
        const maxVert = Math.max(this.startPoint.editorPoint.vertical, this.currentPoint.editorPoint.vertical);

        clips.forEach(clip => {
            const trackIndex = tracks.findIndex(t => t.id === clip.trackId);
            const clipEnd = clip.startBeat + clip.duration;
            
            const overlapsBeat = clip.startBeat < maxBeat && clipEnd > minBeat;
            const overlapsTrack = trackIndex < maxVert && (trackIndex + 1) > minVert;

            if (overlapsBeat && overlapsTrack) {
                this.selectionManager.select(clip.id, 'clip', true);
            }
        });
    }

    renderOverlay(ctx: CanvasRenderingContext2D) {
        if (!this.startPoint || !this.currentPoint) return;

        const x = this.startPoint.screenPoint.x;
        const y = this.startPoint.screenPoint.y;
        const w = this.currentPoint.screenPoint.x - x;
        const h = this.currentPoint.screenPoint.y - y;

        ctx.fillStyle = 'rgba(14, 165, 233, 0.2)';
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.8)';
        ctx.lineWidth = 1;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
    }
}
