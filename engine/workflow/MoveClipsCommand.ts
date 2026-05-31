import { Command } from './Command';
import { useProjectStore } from '@/store/projectStore';
import { Clip } from '@/models/Clip';

export class MoveClipsCommand implements Command {
    readonly id = 'move-clips';
    readonly label: string;

    private clipIds: string[];
    private dx: number; // change in beats
    private dy: number; // change in tracks (if applicable)
    private originalStates: { id: string, startBeat: number, trackId: string }[];

    constructor(clipIds: string[], dx: number, dy: number = 0) {
        this.clipIds = clipIds;
        this.dx = dx;
        this.dy = dy;
        this.label = clipIds.length > 1 ? `Move ${clipIds.length} Clips` : 'Move Clip';

        // Capture original state for undo
        const state = useProjectStore.getState();
        this.originalStates = clipIds.map(id => {
            const clip = state.clips.find(c => c.id === id);
            return {
                id,
                startBeat: clip?.startBeat ?? 0,
                trackId: clip?.trackId ?? ''
            };
        });
    }

    execute() {
        const { updateClip, clips } = useProjectStore.getState();
        this.clipIds.forEach(id => {
            const original = this.originalStates.find(os => os.id === id);
            if (original) {
                updateClip(id, { startBeat: Math.max(0, original.startBeat + this.dx) });
                // Note: track change (dy) not fully implemented in updateClip yet
            }
        });
    }

    undo() {
        const { updateClip } = useProjectStore.getState();
        this.originalStates.forEach(os => {
            updateClip(os.id, { startBeat: os.startBeat });
        });
    }

    merge(other: Command): boolean {
        if (other instanceof MoveClipsCommand && 
            other.clipIds.length === this.clipIds.length &&
            other.clipIds.every((id, i) => id === this.clipIds[i])) {
            
            this.dx += other.dx;
            this.dy += other.dy;
            return true;
        }
        return false;
    }
}
