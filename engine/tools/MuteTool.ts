import { Tool, InteractionEvent } from '@/engine/editor/types/tools';
import { CoordinateSystem } from '@/engine/editor/CoordinateSystem';
import { useProjectStore } from '@/store/projectStore';

interface MuteHit {
  type: 'clip';
  clipId: string;
}

export class MuteTool implements Tool {
  readonly id = 'mute';

  constructor(private coordinateSystem: CoordinateSystem) {}

  private state: 'idle' | 'hover' = 'idle';
  private hoveredHit: MuteHit | null = null;

  private rafId: number | null = null;
  private pendingPointerMove: InteractionEvent | null = null;

  get cursor(): string {
    if (this.hoveredHit) {
      return 'not-allowed';
    }
    return 'default';
  }

  onPointerDown(event: InteractionEvent) {
    if (this.state !== 'idle' && this.state !== 'hover') return;

    const hit = this.detectHit(event);
    if (!hit) return;

    const store = useProjectStore.getState();
    const clip = store.clips.find(c => c.id === hit.clipId);
    if (!clip) return;

    store.saveHistorySnapshot();

    store.toggleClipMute(hit.clipId);
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
    const hit = this.detectHit(event);
    this.hoveredHit = hit;

    if (hit) {
      this.transitionTo('hover');
    } else {
      this.transitionTo('idle');
    }
  }

  onPointerUp(_event: InteractionEvent) {
    this.transitionTo('idle');
  }

  onKeyDown(key: string, _modifiers: { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean }) {
    if (key === 'Escape') {
      this.cancelCurrentOperation();
    }
  }

  onCancel() {
    this.cancelCurrentOperation();
  }

  renderOverlay(_ctx: CanvasRenderingContext2D) {
  }

  private detectHit(event: InteractionEvent): MuteHit | null {
    return this.hitTestClip(event);
  }

  private hitTestClip(event: InteractionEvent): MuteHit | null {
    const store = useProjectStore.getState();
    const { clips, tracks, trackHeight } = store;

    const screenX = event.screenPoint.x;
    const screenY = event.screenPoint.y;
    const viewport = (this.coordinateSystem as any)?.viewport;
    const zoomX = viewport?.zoomX ?? 100;
    const zoomY = viewport?.zoomY ?? trackHeight;
    const scrollX = viewport?.scrollX ?? 0;
    const scrollY = viewport?.scrollY ?? 0;
    const yOffset = viewport?.yOffset ?? 40;

    for (const clip of clips) {
      const trackIndex = tracks.findIndex(t => t.id === clip.trackId);
      if (trackIndex < 0) continue;

      const clipStart = clip.startBeat ?? clip.start;
      const clipScreenX = clipStart * zoomX - scrollX;
      const clipWidth = Math.max(clip.duration * zoomX, 2);
      const trackScreenY = yOffset + trackIndex * zoomY - scrollY;

      const inVerticalRange = screenY >= trackScreenY && screenY <= trackScreenY + zoomY;
      if (!inVerticalRange) continue;

      if (screenX >= clipScreenX && screenX <= clipScreenX + clipWidth) {
        return { type: 'clip', clipId: clip.id };
      }
    }

    return null;
  }

  getHoveredHit(): MuteHit | null {
    return this.hoveredHit;
  }

  private cancelCurrentOperation() {
    this.hoveredHit = null;
    this.transitionTo('idle');
  }

  private transitionTo(newState: 'idle' | 'hover') {
    if (this.state !== newState) {
      this.state = newState;
    }
  }
}
