/**
 * SplitTool.ts
 * Tool for splitting clips at the pointer position.
 */

import { Tool, InteractionEvent } from '../types/tools';
import { SnapEngine } from '../SnapEngine';
import { useProjectStore } from '@/store/projectStore';

export class SplitTool implements Tool {
    readonly id = 'split';
    readonly cursor = 'crosshair'; // Scissors cursor would be better

    constructor(
        private snapEngine: SnapEngine
    ) {}

    onPointerDown(event: InteractionEvent) {
        const { clips, splitClip } = useProjectStore.getState();
        const snappedBeat = this.snapEngine.snapBeat(event.editorPoint.beat, 100);

        // Find clip to split
        const targetClip = clips.find(c => {
            const trackIndex = useProjectStore.getState().tracks.findIndex(t => t.id === c.trackId);
            return snappedBeat > c.startBeat && 
                   snappedBeat < (c.startBeat + c.duration) &&
                   event.editorPoint.vertical >= trackIndex && 
                   event.editorPoint.vertical <= (trackIndex + 1);
        });

        if (targetClip) {
            // dispatch command (assuming splitClip is command-wrapped or we wrap it now)
            splitClip(targetClip.id, snappedBeat);
        }
    }

    onPointerMove(event: InteractionEvent) {}
    onPointerUp(event: InteractionEvent) {}

    renderOverlay(ctx: CanvasRenderingContext2D) {
        // Could draw a vertical line where the split will happen
    }
}
