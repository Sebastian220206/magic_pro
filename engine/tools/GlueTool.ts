import { Tool, InteractionEvent } from '@/engine/editor/ToolManager';
import { CoordinateSystem } from '@/engine/editor/CoordinateSystem';
import { useProjectStore } from '@/store/projectStore';

interface GlueHit {
  type: 'region';
  clipId: string;
}

export class GlueTool implements Tool {
  readonly id = 'glue';

  private state: 'idle' | 'hover' | 'armed' = 'idle';
  private hoveredHit: GlueHit | null = null;
  private armedClipId: string | null = null;
  private highlightedClipIds: Set<string> = new Set();

  private rafId: number | null = null;
  private pendingPointerMove: InteractionEvent | null = null;

  constructor(private coordinateSystem: CoordinateSystem) {}

  get cursor(): string {
    if (this.hoveredHit) {
      return 'copy';
    }
    return 'default';
  }

  onPointerDown(event: InteractionEvent) {
    const hit = this.detectHit(event);

    if (!hit) {
      this.clearArmed();
      this.transitionTo('idle');
      return;
    }

    const store = useProjectStore.getState();
    const selectedIds = store.selectedClipIds;

    if (selectedIds.length >= 2 && selectedIds.includes(hit.clipId)) {
      const hitClip = store.clips.find(c => c.id === hit.clipId);
      const sameTrackIds = selectedIds.filter(id => {
        const c = store.clips.find(cl => cl.id === id);
        return c && hitClip && c.trackId === hitClip.trackId;
      });
      if (sameTrackIds.length >= 2) {
        store.saveHistorySnapshot();
        this.clearArmed();
        this.transitionTo('idle');
        return;
      }
    }

    if (this.armedClipId) {
      const armedClip = store.clips.find(c => c.id === this.armedClipId);
      const clickedClip = store.clips.find(c => c.id === hit.clipId);

      if (armedClip && clickedClip && armedClip.trackId === clickedClip.trackId) {
        const trackClips = store.clips
          .filter(c => c.trackId === armedClip.trackId)
          .sort((a, b) => a.start - b.start);

        const armIdx = trackClips.findIndex(c => c.id === this.armedClipId);
        const clickIdx = trackClips.findIndex(c => c.id === hit.clipId);
        if (armIdx >= 0 && clickIdx >= 0 && armIdx !== clickIdx) {
          const startIdx = Math.min(armIdx, clickIdx);
          const endIdx = Math.max(armIdx, clickIdx);
          const idsToMerge = trackClips.slice(startIdx, endIdx + 1).map(c => c.id);

          store.saveHistorySnapshot();
          this.clearArmed();
          this.transitionTo('idle');
          return;
        }

        this.clearArmed();
        this.transitionTo('idle');
        return;
      }

      this.clearArmed();
    }

    this.armedClipId = hit.clipId;
    this.highlightedClipIds = new Set([hit.clipId]);
    this.transitionTo('armed');
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

      if (this.armedClipId) {
        const store = useProjectStore.getState();
        const armedClip = store.clips.find(c => c.id === this.armedClipId);
        const hoveredClip = store.clips.find(c => c.id === hit.clipId);

        if (armedClip && hoveredClip && armedClip.trackId === hoveredClip.trackId) {
          const trackClips = store.clips
            .filter(c => c.trackId === armedClip.trackId)
            .sort((a, b) => a.start - b.start);

          const armIdx = trackClips.findIndex(c => c.id === this.armedClipId);
          const hoverIdx = trackClips.findIndex(c => c.id === hit.clipId);

          if (armIdx >= 0 && hoverIdx >= 0) {
            const startIdx = Math.min(armIdx, hoverIdx);
            const endIdx = Math.max(armIdx, hoverIdx);
            this.highlightedClipIds = new Set(
              trackClips.slice(startIdx, endIdx + 1).map(c => c.id)
            );
            return;
          }
        }
      }

      this.highlightedClipIds = new Set([hit.clipId]);
    } else {
      this.transitionTo('idle');
      if (!this.armedClipId) {
        this.highlightedClipIds = new Set();
      }
    }
  }

  onPointerUp(_event: InteractionEvent) {
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

  getHighlightedClipIds(): string[] {
    return [...this.highlightedClipIds];
  }

  getArmedClipId(): string | null {
    return this.armedClipId;
  }

  private detectHit(event: InteractionEvent): GlueHit | null {
    const store = useProjectStore.getState();
    const { clips, tracks, trackHeight } = store;

    const screenX = event.screenPoint.x;
    const screenY = event.screenPoint.y;
    const viewport = (this.coordinateSystem as any).viewport as {
      zoomX: number; zoomY: number; scrollX: number; scrollY: number; yOffset: number;
    } | undefined;
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
        return { type: 'region', clipId: clip.id };
      }
    }

    return null;
  }

  private clearArmed() {
    this.armedClipId = null;
    this.highlightedClipIds = new Set();
  }

  private cancelCurrentOperation() {
    this.clearArmed();
    this.hoveredHit = null;
    this.transitionTo('idle');
  }

  private transitionTo(newState: 'idle' | 'hover' | 'armed') {
    if (this.state !== newState) {
      this.state = newState;
    }
  }
}
