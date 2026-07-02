import { Tool, InteractionEvent } from '@/engine/editor/types/tools';
import { SelectionManager } from '@/engine/editor/SelectionManager';
import { SnapEngine } from '@/engine/editor/SnapEngine';
import { CoordinateSystem } from '@/engine/editor/CoordinateSystem';
import { SelectionController } from '@/engine/interactions/SelectionController';
import { RegionDragController } from '@/engine/interactions/RegionDragController';
import { RegionResizeController } from '@/engine/interactions/RegionResizeController';
import { MarqueeController } from '@/engine/interactions/MarqueeController';
import { useProjectStore } from '@/store/projectStore';

type PointerToolState =
  | 'idle'
  | 'hover'
  | 'selecting'
  | 'dragging'
  | 'resizing'
  | 'marquee'
  | 'context-menu';

interface HitResult {
  clipId: string;
  handle: 'body' | 'left' | 'right';
}

export class PointerTool implements Tool {
  readonly id = 'pointer';

  private state: PointerToolState = 'idle';
  private hoveredClipId: string | null = null;
  private hoveredHandle: 'body' | 'left' | 'right' | null = null;

  get cursor(): string {
    return this.getCursorForState();
  }

  readonly selectionController: SelectionController;
  readonly dragController: RegionDragController;
  readonly resizeController: RegionResizeController;
  readonly marqueeController: MarqueeController;

  private rafId: number | null = null;
  private pendingPointerMove: InteractionEvent | null = null;

  constructor(
    private selectionManager: SelectionManager,
    private snapEngine: SnapEngine,
    private coordinateSystem: CoordinateSystem
  ) {
    this.selectionController = new SelectionController(selectionManager);
    this.dragController = new RegionDragController();
    this.resizeController = new RegionResizeController();
    this.marqueeController = new MarqueeController(selectionManager, coordinateSystem);
  }

  private getCursorForState(): string {
    if (this.state === 'resizing') {
      return this.hoveredHandle === 'left' ? 'ew-resize' : 'ew-resize';
    }
    if (this.state === 'dragging') return 'grabbing';
    if (this.state === 'marquee') return 'crosshair';
    if (this.state === 'hover') {
      if (this.hoveredHandle === 'left' || this.hoveredHandle === 'right') {
        return 'ew-resize';
      }
      if (this.hoveredClipId) return 'pointer';
    }
    return 'default';
  }

  onPointerDown(event: InteractionEvent) {
    const { originalEvent } = event;

    if (originalEvent instanceof MouseEvent && originalEvent.button === 2) {
      this.handleContextMenu(event);
      return;
    }

    if (this.state === 'dragging' || this.state === 'resizing') {
      return;
    }

    const hit = this.hitTest(event);

    if (hit && hit.handle !== 'body') {
      this.transitionTo('resizing');
      this.resizeController.startResize(hit.clipId, hit.handle, event.editorPoint.beat);
      return;
    }

    if (hit) {
      if (!this.selectionManager.isSelected(hit.clipId) && !event.modifiers.shift) {
        this.selectionController.handleClick(hit.clipId, false);
      } else if (!this.selectionManager.isSelected(hit.clipId) && event.modifiers.shift) {
        this.selectionController.handleClick(hit.clipId, true);
      }

      const store = useProjectStore.getState();
      const trackIndex = store.tracks.findIndex(t => t.id === store.clips.find(c => c.id === hit.clipId)?.trackId);

      this.transitionTo('dragging');
      this.dragController.startDrag(
        hit.clipId,
        event.editorPoint.beat,
        Math.max(0, trackIndex),
        event.modifiers.alt
      );
      return;
    }

    if (!hit && !event.modifiers.shift) {
      this.selectionController.clearSelection();
    }

    const trackIndex = Math.floor(event.editorPoint.vertical);
    this.transitionTo('marquee');
    this.marqueeController.startMarquee(
      event.editorPoint.beat,
      trackIndex,
      event.screenPoint.x,
      event.screenPoint.y,
      event.modifiers.shift
    );
  }

  onPointerMove(event: InteractionEvent) {
    this.pendingPointerMove = event;

    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        this.processPointerMove(this.pendingPointerMove!);
        this.pendingPointerMove = null;
      });
    }
  }

  private processPointerMove(event: InteractionEvent) {
    if (this.state === 'dragging') {
      const trackIndex = Math.floor(event.editorPoint.vertical);
      this.dragController.updateDrag(
        event.editorPoint.beat,
        trackIndex,
        this.snapEngine,
        this.coordinateSystem
      );
      return;
    }

    if (this.state === 'resizing') {
      this.resizeController.updateResize(
        event.editorPoint.beat,
        this.snapEngine,
        this.coordinateSystem
      );
      return;
    }

    if (this.state === 'marquee') {
      const trackIndex = Math.floor(event.editorPoint.vertical);
      this.marqueeController.updateMarquee(
        event.editorPoint.beat,
        trackIndex,
        event.screenPoint.x,
        event.screenPoint.y
      );
      return;
    }

    const hit = this.hitTest(event);
    if (hit) {
      this.hoveredClipId = hit.clipId;
      this.hoveredHandle = hit.handle;
      this.transitionTo('hover');
    } else {
      this.hoveredClipId = null;
      this.hoveredHandle = null;
      this.transitionTo('idle');
    }
  }

  onPointerUp(event: InteractionEvent) {
    if (this.state === 'dragging') {
      this.dragController.endDrag();
      this.transitionTo('idle');

      if (event.originalEvent instanceof MouseEvent && event.originalEvent.button === 2) {
        return;
      }
      return;
    }

    if (this.state === 'resizing') {
      this.resizeController.endResize();
      this.transitionTo('idle');
      return;
    }

    if (this.state === 'marquee') {
      this.marqueeController.endMarquee();
      this.transitionTo('idle');
      return;
    }

    if (this.state === 'selecting') {
      this.transitionTo('idle');
    }
  }

  onKeyDown(key: string, modifiers: { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean }) {
    if (key === 'Escape') {
      this.cancelCurrentOperation();
    }

    if (key === 'Delete' || key === 'Backspace') {
      const store = useProjectStore.getState();
      const selectedIds = store.selectedClipIds;
      if (selectedIds.length > 0) {
        store.saveHistorySnapshot();
        const idsToDelete = [...selectedIds];
        for (const id of idsToDelete) {
          store.deleteClip(id);
        }
        store.deselectAllClips();
      }
    }
  }

  onCancel() {
    this.cancelCurrentOperation();
  }

  private cancelCurrentOperation() {
    if (this.state === 'dragging') {
      this.dragController.cancelDrag();
    } else if (this.state === 'resizing') {
      this.resizeController.cancelResize();
    } else if (this.state === 'marquee') {
      this.marqueeController.endMarquee();
    }
    this.transitionTo('idle');
  }

  private transitionTo(newState: PointerToolState) {
    if (this.state !== newState) {
      this.state = newState;
    }
  }

  private hitTest(event: InteractionEvent): HitResult | null {
    const store = useProjectStore.getState();
    const { clips, tracks, trackHeight } = store;

    const screenX = event.screenPoint.x;
    const screenY = event.screenPoint.y;
    const viewport = this.coordinateSystem['viewport'];
    const zoomX = viewport?.zoomX ?? 100;
    const zoomY = viewport?.zoomY ?? trackHeight;
    const scrollX = viewport?.scrollX ?? 0;
    const scrollY = viewport?.scrollY ?? 0;
    const yOffset = (viewport as any)?.yOffset ?? 40;

    for (const clip of clips) {
      const trackIndex = tracks.findIndex(t => t.id === clip.trackId);
      if (trackIndex < 0) continue;

      const clipStart = clip.startBeat ?? clip.start;
      const clipScreenX = clipStart * zoomX - scrollX;
      const clipWidth = Math.max(clip.duration * zoomX, 2);
      const trackScreenY = yOffset + trackIndex * zoomY - scrollY;

      const inVerticalRange = screenY >= trackScreenY && screenY <= trackScreenY + trackHeight;
      if (!inVerticalRange) continue;

      const localX = screenX - clipScreenX;

      const handleWidth = 6;
      if (localX >= -handleWidth && localX <= handleWidth) {
        return { clipId: clip.id, handle: 'left' };
      }

      if (localX >= clipWidth - handleWidth && localX <= clipWidth + handleWidth) {
        return { clipId: clip.id, handle: 'right' };
      }

      if (localX > handleWidth && localX < clipWidth - handleWidth) {
        return { clipId: clip.id, handle: 'body' };
      }
    }

    return null;
  }

  private handleContextMenu(event: InteractionEvent) {
    const hit = this.hitTest(event);
    const store = useProjectStore.getState();

    if (hit) {
      if (!this.selectionManager.isSelected(hit.clipId)) {
        this.selectionController.handleClick(hit.clipId, false);
      }
      const oe = event.originalEvent as MouseEvent;
      store.showContextMenu(oe?.clientX ?? event.screenPoint.x, oe?.clientY ?? event.screenPoint.y, hit.clipId);
    } else {
      store.hideContextMenu();
    }

    this.transitionTo('context-menu');
  }

  handleDoubleClick(event: InteractionEvent) {
    const hit = this.hitTest(event);
    if (!hit) return;

    const store = useProjectStore.getState();
    const clip = store.clips.find(c => c.id === hit.clipId);
    if (!clip) return;

    if (clip.type === 'midi') {
      store.setBottomPanel('pianoroll');
      store.setPianoRollFocusClipId(hit.clipId);
    } else if (clip.type === 'audio') {
      store.setShowAudioTrackEditor(true);
      store.setAudioTrackEditorTrackId(clip.trackId);
    }
  }

  getState(): PointerToolState {
    return this.state;
  }

  getHoveredClipId(): string | null {
    return this.hoveredClipId;
  }

  renderOverlay(ctx: CanvasRenderingContext2D) {
    if (this.state === 'marquee') {
      const rect = this.marqueeController.getScreenRect();
      if (rect) {
        ctx.fillStyle = 'rgba(14, 165, 233, 0.15)';
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.8)';
        ctx.lineWidth = 1;
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
      }
    }
  }
}
