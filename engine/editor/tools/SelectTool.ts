/**
 * SelectTool.ts
 * Default tool for selecting and moving items.
 */

import { Tool, InteractionEvent } from '../ToolManager';
import { SelectionManager } from '../SelectionManager';
import { SnapEngine } from '../SnapEngine';
import { CoordinateSystem } from '../CoordinateSystem';
import { useProjectStore } from '@/store/projectStore';
import { MoveClipsCommand } from '@/engine/workflow/MoveClipsCommand';

export class SelectTool implements Tool {
    readonly id = 'select';
    readonly cursor = 'default';

    private dragStartPoint: InteractionEvent | null = null;
    private isDragging = false;
    private initialItemPositions: Map<string, number> = new Map();

    constructor(
        private selectionManager: SelectionManager,
        private snapEngine: SnapEngine,
        private coordinateSystem: CoordinateSystem
    ) {}

    onPointerDown(event: InteractionEvent) {
        this.dragStartPoint = event;
        this.isDragging = false;

        // Hit testing (Simplified for now)
        const hitId = this.findItemAt(event.editorPoint);
        
        if (hitId) {
            if (!this.selectionManager.isSelected(hitId)) {
                this.selectionManager.select(hitId, 'clip', event.modifiers.shift);
            }
            
            // Capture initial positions for move
            const state = useProjectStore.getState();
            this.selectionManager.getSelectedIds().forEach(id => {
                const clip = state.clips.find(c => c.id === id);
                if (clip && clip.startBeat !== undefined) this.initialItemPositions.set(id, clip.startBeat);
            });
        } else {
            if (!event.modifiers.shift) {
                this.selectionManager.clear();
            }
        }
    }

    onPointerMove(event: InteractionEvent) {
        if (!this.dragStartPoint) return;

        const dx = event.editorPoint.beat - this.dragStartPoint.editorPoint.beat;
        const dy = event.editorPoint.vertical - this.dragStartPoint.editorPoint.vertical;

        if (!this.isDragging && (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.1)) {
            this.isDragging = true;
        }

        if (this.isDragging) {
            this.handleMove(dx, dy);
        }
    }

    onPointerUp(event: InteractionEvent) {
        if (this.isDragging) {
            // Commit Command
            const dx = event.editorPoint.beat - this.dragStartPoint!.editorPoint.beat;
            const finalDx = this.snapEngine.snapBeat(dx, 1); // Simple snap for now

            const command = new MoveClipsCommand(
                this.selectionManager.getSelectedIds(),
                finalDx
            );
            // command execution - dispatched via store

        }

        this.dragStartPoint = null;
        this.isDragging = false;
        this.initialItemPositions.clear();
    }

    private handleMove(dx: number, dy: number) {
        const { updateClip } = useProjectStore.getState();
        this.selectionManager.getSelectedIds().forEach(id => {
            const startPos = this.initialItemPositions.get(id);
            if (startPos !== undefined) {
                const newPos = startPos + dx;
                const snappedPos = this.snapEngine.snapBeat(newPos, 100); // Zoom factor dummy
                updateClip(id, { startBeat: Math.max(0, snappedPos) });
            }
        });
    }

    private findItemAt(point: { beat: number, vertical: number }): string | null {
        const { clips, trackHeight } = useProjectStore.getState();
        const hit = clips.find(c => {
            const trackIndex = useProjectStore.getState().tracks.findIndex(t => t.id === c.trackId);
            const sb = c.startBeat ?? c.start ?? 0;
            return point.beat >= sb && 
                   point.beat <= (sb + c.duration) &&
                   point.vertical >= trackIndex && 
                   point.vertical <= (trackIndex + 1);
        });
        return hit?.id || null;
    }
}
