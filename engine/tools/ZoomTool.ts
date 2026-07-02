import { Tool, InteractionEvent } from '@/engine/editor/types/tools';
import { CoordinateSystem } from '@/engine/editor/CoordinateSystem';
import { ZoomController, DRAG_THRESHOLD } from '@/engine/viewport/ZoomController';
import { ViewportManager, getViewportScrollX, getViewportWidth } from '@/engine/viewport/ViewportManager';
import { useProjectStore } from '@/store/projectStore';

type ZoomToolState = 'idle' | 'dragging';

interface DragData {
  startScreenX: number;
  startScreenY: number;
  startBeat: number;
  currentScreenX: number;
  currentScreenY: number;
  currentBeat: number;
}

export class ZoomTool implements Tool {
  readonly id = 'zoom';

  private state: ZoomToolState = 'idle';
  private dragData: DragData | null = null;
  private lastAltState = false;
  private ignorePointerUp = false;

  constructor(
    private coordinateSystem: CoordinateSystem,
    private zoomController: ZoomController,
    private viewportManager: ViewportManager
  ) {}

  get cursor(): string {
    if (this.state === 'dragging') return 'crosshair';
    return this.lastAltState ? 'zoom-out' : 'zoom-in';
  }

  onPointerDown(event: InteractionEvent): void {
    const { alt } = event.modifiers;
    this.lastAltState = alt;

    if (alt) {
      this.zoomOut(event);
      return;
    }

    this.dragData = {
      startScreenX: event.screenPoint.x,
      startScreenY: event.screenPoint.y,
      startBeat: event.editorPoint.beat,
      currentScreenX: event.screenPoint.x,
      currentScreenY: event.screenPoint.y,
      currentBeat: event.editorPoint.beat,
    };
    this.state = 'dragging';
  }

  onPointerMove(event: InteractionEvent): void {
    this.lastAltState = event.modifiers.alt;

    if (this.state !== 'dragging' || !this.dragData) return;

    this.dragData.currentScreenX = event.screenPoint.x;
    this.dragData.currentScreenY = event.screenPoint.y;
    this.dragData.currentBeat = event.editorPoint.beat;
  }

  onPointerUp(event: InteractionEvent): void {
    if (this.state !== 'dragging' || !this.dragData) {
      this.state = 'idle';
      return;
    }

    const dx = Math.abs(this.dragData.currentScreenX - this.dragData.startScreenX);
    const dy = Math.abs(this.dragData.currentScreenY - this.dragData.startScreenY);

    if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) {
      this.zoomIn(event);
    } else {
      this.zoomToArea();
    }

    this.dragData = null;
    this.state = 'idle';
  }

  onKeyDown(key: string, modifiers: { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean }): void {
    if (key === 'Z' && modifiers.shift) {
      this.zoomToFit();
    }
  }

  handleDoubleClick(event: InteractionEvent): void {
    const store = useProjectStore.getState();
    const hitClip = store.clips.find((clip) => {
      const trackIndex = store.tracks.findIndex((t) => t.id === clip.trackId);
      if (trackIndex < 0) return false;
      const clipStart = clip.startBeat ?? clip.start;
      const clipEnd = clipStart + clip.duration;
      const trackY = 40 + trackIndex * store.trackHeight;
      return (
        event.editorPoint.beat >= clipStart &&
        event.editorPoint.beat <= clipEnd &&
        event.screenPoint.y >= trackY &&
        event.screenPoint.y <= trackY + store.trackHeight
      );
    });
    if (!hitClip) {
      this.zoomToFit();
    }
  }

  onCancel(): void {
    this.dragData = null;
    this.state = 'idle';
    this.viewportManager.cancelAnimation();
  }

  renderOverlay(ctx: CanvasRenderingContext2D): void {
    if (this.state !== 'dragging' || !this.dragData) return;

    const x = Math.min(this.dragData.startScreenX, this.dragData.currentScreenX);
    const y = Math.min(this.dragData.startScreenY, this.dragData.currentScreenY);
    const w = Math.abs(this.dragData.currentScreenX - this.dragData.startScreenX);
    const h = Math.abs(this.dragData.currentScreenY - this.dragData.startScreenY);

    if (w < 2 || h < 2) return;

    ctx.fillStyle = 'rgba(34, 197, 94, 0.12)';
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.7)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(34, 197, 94, 0.85)';
    ctx.font = '11px monospace';
    const startBeat = Math.min(this.dragData.startBeat, this.dragData.currentBeat);
    const endBeat = Math.max(this.dragData.startBeat, this.dragData.currentBeat);
    const duration = endBeat - startBeat;
    const label = `${startBeat.toFixed(2)} - ${endBeat.toFixed(2)}  (${duration.toFixed(2)} beats)`;

    const textX = x + 6;
    const textY = y - 8;
    const textW = ctx.measureText(label).width + 12;
    const textH = 20;

    const drawY = textY - textH < 0 ? y + h - textH - 4 : textY;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(textX - 4, drawY, textW, textH);
    ctx.fillStyle = 'rgba(34, 197, 94, 0.95)';
    ctx.fillText(label, textX, drawY + 14);
  }

  private zoomIn(event: InteractionEvent): void {
    const currentZoom = useProjectStore.getState().zoom || 80;
    const scrollX = getViewportScrollX();
    const viewportWidth = getViewportWidth();
    const anchorBeat = event.editorPoint.beat;

    const params = this.zoomController.zoomIn(anchorBeat, currentZoom, scrollX, viewportWidth);
    this.viewportManager.animateTo(params.zoom, params.scrollX, 150);
  }

  private zoomOut(event: InteractionEvent): void {
    const currentZoom = useProjectStore.getState().zoom || 80;
    const scrollX = getViewportScrollX();
    const viewportWidth = getViewportWidth();
    const anchorBeat = event.editorPoint.beat;

    const params = this.zoomController.zoomOut(anchorBeat, currentZoom, scrollX, viewportWidth);
    this.viewportManager.animateTo(params.zoom, params.scrollX, 150);
  }

  private zoomToArea(): void {
    if (!this.dragData) return;

    const viewportWidth = getViewportWidth();
    const startBeat = Math.min(this.dragData.startBeat, this.dragData.currentBeat);
    const endBeat = Math.max(this.dragData.startBeat, this.dragData.currentBeat);

    const params = this.zoomController.zoomToArea(startBeat, endBeat, viewportWidth);
    this.viewportManager.animateTo(params.zoom, params.scrollX, 200);
  }

  private zoomToFit(): void {
    const store = useProjectStore.getState();
    const viewportWidth = getViewportWidth();
    const currentZoom = store.zoom || 80;

    const clipStartBeats: number[] = [];
    const clipEndBeats: number[] = [];

    for (const clip of store.clips) {
      if (clip.alternativeId && clip.alternativeId !== store.tracks.find(t => t.id === clip.trackId)?.activeAlternativeId) continue;
      const start = clip.startBeat ?? clip.start;
      clipStartBeats.push(start);
      clipEndBeats.push(start + clip.duration);
    }

    const params = this.zoomController.zoomToFit(clipStartBeats, clipEndBeats, viewportWidth, currentZoom);
    this.viewportManager.animateTo(params.zoom, params.scrollX, 250);
  }
}
