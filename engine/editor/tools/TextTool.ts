import { Tool, InteractionEvent } from '../types/tools';
import { SnapEngine } from '../SnapEngine';
import { useProjectStore } from '@/store/projectStore';
import type { TimelineAnnotation } from '@/models/Annotation';

export class TextTool implements Tool {
    readonly id = 'text';
    readonly cursor = 'text';

    constructor(
        private snapEngine: SnapEngine
    ) {}

    onPointerDown(event: InteractionEvent) {
        const { addAnnotation, tracks, zoom } = useProjectStore.getState();
        const pixelsPerBeat = zoom || 80;

        const trackIndex = Math.floor(event.editorPoint.vertical);
        if (trackIndex < 0 || trackIndex >= tracks.length) return;

        const snappedBeat = this.snapEngine.snapBeat(event.editorPoint.beat, pixelsPerBeat);
        const laneY = trackIndex;

        const annotation: TimelineAnnotation = {
            id: `annotation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            text: 'Annotation',
            startBeat: snappedBeat,
            laneY,
            color: '#facc15',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        addAnnotation(annotation);
    }

    onPointerMove(_event: InteractionEvent) {}

    onPointerUp(_event: InteractionEvent) {}
}
