import { Tool, InteractionEvent } from '../ToolManager';
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
            useProjectStore.getState().setMarqueeSelection(null);
        }
    }

    onPointerMove(event: InteractionEvent) {
        if (!this.startPoint) return;
        this.currentPoint = event;
        this.updateMarqueeSelection();
    }

    onPointerUp(event: InteractionEvent) {
        this.updateMarqueeSelection();
        this.startPoint = null;
        this.currentPoint = null;
    }

    private updateMarqueeSelection() {
        if (!this.startPoint || !this.currentPoint) return;

        const { clips, tracks, trackHeight, setMarqueeSelection } = useProjectStore.getState();

        const startBeat = Math.min(this.startPoint.editorPoint.beat, this.currentPoint.editorPoint.beat);
        const endBeat = Math.max(this.startPoint.editorPoint.beat, this.currentPoint.editorPoint.beat);
        const minVert = Math.min(this.startPoint.editorPoint.vertical, this.currentPoint.editorPoint.vertical);
        const maxVert = Math.max(this.startPoint.editorPoint.vertical, this.currentPoint.editorPoint.vertical);

        const selectedTrackIds: string[] = [];
        let currentOffset = 0;
        tracks.forEach(track => {
            const h = trackHeight * (track.zoom || 1);
            if (currentOffset + h > minVert && currentOffset < maxVert) {
                selectedTrackIds.push(track.id);
            }
            currentOffset += h;
        });

        const selectedClipIds: string[] = [];
        const selectedLaneIds: string[] = [];
        clips.forEach(clip => {
            if (!selectedTrackIds.includes(clip.trackId)) return;
            const sb = clip.start ?? 0;
            const clipEnd = sb + clip.duration;
            if (sb < endBeat && clipEnd > startBeat) {
                selectedClipIds.push(clip.id);
                this.selectionManager.select(clip.id, 'clip', true);
            }
        });

        setMarqueeSelection({
            id: `marquee-${Date.now()}`,
            startBeat: Math.max(0, startBeat),
            endBeat,
            trackIds: selectedTrackIds,
            clipIds: selectedClipIds,
            laneIds: selectedLaneIds
        });
    }

    onKeyDown(key: string, modifiers: { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean }) {
        const state = useProjectStore.getState();
        const { marqueeSelection, splitClip, deleteClip, setLocators, movePlayhead, playing, play, clips } = state;
        if (!marqueeSelection) return;

        switch (key.toLowerCase()) {
            case 's':
                if (marqueeSelection.clipIds.length > 0) {
                    marqueeSelection.clipIds.forEach(cid => {
                        const clip = clips.find(c => c.id === cid);
                        if (!clip) return;
                        const clipEnd = clip.start + clip.duration;
                        if (marqueeSelection.startBeat > clip.start && marqueeSelection.startBeat < clipEnd) {
                            splitClip(clip.id, marqueeSelection.startBeat);
                        }
                        if (marqueeSelection.endBeat > clip.start && marqueeSelection.endBeat < clipEnd) {
                            splitClip(clip.id, marqueeSelection.endBeat);
                        }
                    });
                }
                break;

            case 'delete':
            case 'backspace':
                marqueeSelection.clipIds.forEach(cid => {
                    deleteClip(cid);
                });
                break;

            case '/':
                setLocators(marqueeSelection.startBeat, marqueeSelection.endBeat);
                break;

            case 'enter':
                movePlayhead(marqueeSelection.startBeat);
                if (!playing) {
                    play();
                }
                break;
        }
    }

    onCancel() {
        this.startPoint = null;
        this.currentPoint = null;
        useProjectStore.getState().setMarqueeSelection(null);
    }

    renderOverlay(ctx: CanvasRenderingContext2D) {
        if (!this.startPoint || !this.currentPoint) return;

        const x = this.startPoint.screenPoint.x;
        const y = this.startPoint.screenPoint.y;
        const w = this.currentPoint.screenPoint.x - x;
        const h = this.currentPoint.screenPoint.y - y;

        ctx.fillStyle = 'rgba(14, 165, 233, 0.15)';
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);

        // Corner handles
        const handleSize = 6;
        ctx.fillStyle = 'rgba(14, 165, 233, 0.9)';
        ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(x + w - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(x - handleSize / 2, y + h - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(x + w - handleSize / 2, y + h - handleSize / 2, handleSize, handleSize);
    }
}
