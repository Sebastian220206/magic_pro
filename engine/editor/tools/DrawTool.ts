/**
 * DrawTool.ts
 * Tool for drawing new items (clips/notes).
 */

import { Tool, InteractionEvent } from '../types/tools';
import { SnapEngine } from '../SnapEngine';
import { useProjectStore } from '@/store/projectStore';

export class DrawTool implements Tool {
    readonly id = 'draw';
    readonly cursor = 'crosshair';

    constructor(
        private snapEngine: SnapEngine
    ) {}

    onPointerDown(event: InteractionEvent) {
        const { addClip, focusedTrackId, tracks } = useProjectStore.getState();
        
        const trackId = focusedTrackId || tracks[Math.floor(event.editorPoint.vertical)]?.id;
        if (!trackId) return;

        const snappedStart = this.snapEngine.snapBeat(event.editorPoint.beat, 100);
        
        // Simple add clip for now
        addClip({
            id: `clip-${Date.now()}`,
            trackId,
            name: 'New Clip',
            type: 'audio',
            start: snappedStart,
            duration: 4, // Default 1 bar
            color: '#4ade80'
        } as any);
    }

    onPointerMove(event: InteractionEvent) {
        // Preview logic could go here
    }

    onPointerUp(event: InteractionEvent) {
        // Finish drawing
    }
}
