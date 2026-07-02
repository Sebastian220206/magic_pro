import { Tool, InteractionEvent } from '@/engine/editor/types/tools';
import { SnapEngine } from '@/engine/editor/SnapEngine';
import { CoordinateSystem } from '@/engine/editor/CoordinateSystem';
import { useProjectStore } from '@/store/projectStore';

interface EraseHitRegion {
  type: 'region';
  clipId: string;
}

interface EraseHitMidiNote {
  type: 'midi-note';
  clipId: string;
  noteId: string;
}

interface EraseHitAutomation {
  type: 'automation-point';
  trackId: string;
  laneIndex: number;
  pointIndex: number;
}

type EraseHit = EraseHitRegion | EraseHitMidiNote | EraseHitAutomation;

const DEFAULT_ERASE_THRESHOLD_PX = 2;

export class EraserTool implements Tool {
  readonly id = 'erase';

  private state: 'idle' | 'hover' | 'dragging' = 'idle';
  private isDragging = false;
  private hoveredHit: EraseHit | null = null;
  private highlightedClipIds: Set<string> = new Set();
  private pointerDownScreen: { x: number; y: number } | null = null;
  private dragIntersectedClips: Set<string> = new Set();

  private rafId: number | null = null;
  private pendingPointerMove: InteractionEvent | null = null;

  constructor(
    private snapEngine: SnapEngine,
    private coordinateSystem: CoordinateSystem
  ) {}

  get cursor(): string {
    if (this.hoveredHit) {
      return 'not-allowed';
    }
    return 'default';
  }

  onPointerDown(event: InteractionEvent) {
    if (this.state !== 'idle' && this.state !== 'hover') return;

    this.isDragging = true;
    this.pointerDownScreen = { x: event.screenPoint.x, y: event.screenPoint.y };
    this.dragIntersectedClips = new Set();

    const hit = this.detectHit(event);

    if (!hit) {
      this.state = 'dragging';
      return;
    }

    if (hit.type === 'region') {
      const store = useProjectStore.getState();
      const selectedIds = store.selectedClipIds;
      if (selectedIds.includes(hit.clipId)) {
        store.saveHistorySnapshot();
        const idsToDelete = [...new Set(selectedIds)];
        for (const id of idsToDelete) {
          store.deleteClip(id);
        }
        store.deselectAllClips();
        this.transitionTo('idle');
        this.isDragging = false;
        return;
      }
      store.saveHistorySnapshot();
      store.deleteClip(hit.clipId);
      this.transitionTo('idle');
      this.isDragging = false;
      return;
    }

    if (hit.type === 'midi-note') {
      const store = useProjectStore.getState();
      store.saveHistorySnapshot();
      store.deleteNote(hit.clipId, hit.noteId);
      this.transitionTo('idle');
      this.isDragging = false;
      return;
    }

    if (hit.type === 'automation-point') {
      const store = useProjectStore.getState();
      store.saveHistorySnapshot();
      store.deleteAutomationPoint(hit.trackId, hit.laneIndex, hit.pointIndex);
      this.transitionTo('idle');
      this.isDragging = false;
      return;
    }

    this.state = 'dragging';
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
      this.processDragErase(event);
      return;
    }

    const hit = this.detectHit(event);
    this.hoveredHit = hit;

    if (hit) {
      this.transitionTo('hover');
    } else {
      this.transitionTo('idle');
    }
  }

  onPointerUp(_event: InteractionEvent) {
    this.isDragging = false;

    if (this.state === 'dragging') {
      if (this.dragIntersectedClips.size > 0) {
        const store = useProjectStore.getState();
        store.saveHistorySnapshot();
        const idsToDelete = [...this.dragIntersectedClips];
        for (const id of idsToDelete) {
          store.deleteClip(id);
        }
        this.dragIntersectedClips.clear();
      }
      this.highlightedClipIds.clear();
      this.transitionTo('idle');
      return;
    }

    this.highlightedClipIds.clear();
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

  private detectHit(event: InteractionEvent): EraseHit | null {
    const regionHit = this.hitTestRegion(event);
    if (regionHit) return regionHit;

    const midiHit = this.hitTestMidiNote(event);
    if (midiHit) return midiHit;

    const autoHit = this.hitTestAutomationPoint(event);
    if (autoHit) return autoHit;

    return null;
  }

  private hitTestRegion(event: InteractionEvent): EraseHitRegion | null {
    const store = useProjectStore.getState();
    const { clips, tracks, trackHeight } = store;

    const screenX = event.screenPoint.x;
    const screenY = event.screenPoint.y;
    const viewport = (this.coordinateSystem as any).viewport;
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

  private hitTestMidiNote(event: InteractionEvent): EraseHitMidiNote | null {
    const store = useProjectStore.getState();
    const { pianoRollFocusClipId, clips } = store;

    if (!pianoRollFocusClipId) return null;

    const clip = clips.find(c => c.id === pianoRollFocusClipId);
    if (!clip || !clip.notes || clip.notes.length === 0) return null;

    const screenX = event.screenPoint.x;
    const screenY = event.screenPoint.y;
    const viewport = (this.coordinateSystem as any).viewport;
    const zoomX = viewport?.zoomX ?? 100;
    const scrollX = viewport?.scrollX ?? 0;

    const clipStart = clip.startBeat ?? clip.start;
    const beat = (screenX + scrollX) / zoomX;
    const noteYNormalized = 1 - (screenY / (viewport?.height ?? 600));
    const hitPitch = Math.round(noteYNormalized * 127);
    const hitPixelsPerSemitone = (viewport?.height ?? 600) / 127;

    for (const note of clip.notes) {
      const noteAbsStart = clipStart + (note.start ?? note.startBeat ?? 0);
      const noteAbsEnd = noteAbsStart + note.duration;

      if (beat >= noteAbsStart && beat <= noteAbsEnd) {
        const noteScreenY = (1 - note.pitch / 127) * (viewport?.height ?? 600);
        if (Math.abs(screenY - noteScreenY) < hitPixelsPerSemitone * 1.5) {
          return { type: 'midi-note', clipId: clip.id, noteId: note.id };
        }
      }
    }

    return null;
  }

  private hitTestAutomationPoint(event: InteractionEvent): EraseHitAutomation | null {
    const store = useProjectStore.getState();
    const { tracks, showAutomation } = store;

    if (!showAutomation) return null;

    const trackIndex = Math.floor(event.editorPoint.vertical);
    if (trackIndex < 0 || trackIndex >= tracks.length) return null;

    const track = tracks[trackIndex];
    if (!track.automation || track.automation.length === 0) return null;

    const viewport = (this.coordinateSystem as any).viewport;
    const zoomX = viewport?.zoomX ?? 100;
    const scrollX = viewport?.scrollX ?? 0;
    const trackHeight = store.trackHeight || 80;

    const screenX = event.screenPoint.x;
    const screenY = event.screenPoint.y;
    const trackScreenY = (viewport?.yOffset ?? 40) + trackIndex * trackHeight - (viewport?.scrollY ?? 0);

    const hitRadiusPx = 6;

    for (let laneIdx = 0; laneIdx < track.automation.length; laneIdx++) {
      const lane = track.automation[laneIdx];
      if (!lane.points) continue;

      for (let ptIdx = 0; ptIdx < lane.points.length; ptIdx++) {
        const pt = lane.points[ptIdx];
        const ptScreenX = pt.time * zoomX - scrollX;
        const ptScreenY = trackScreenY + (1 - pt.value / 100) * trackHeight;

        const dx = screenX - ptScreenX;
        const dy = screenY - ptScreenY;

        if (Math.sqrt(dx * dx + dy * dy) <= hitRadiusPx) {
          return { type: 'automation-point', trackId: track.id, laneIndex: laneIdx, pointIndex: ptIdx };
        }
      }
    }

    return null;
  }

  private processDragErase(event: InteractionEvent) {
    if (!this.pointerDownScreen) return;

    const dx = Math.abs(event.screenPoint.x - this.pointerDownScreen.x);
    const dy = Math.abs(event.screenPoint.y - this.pointerDownScreen.y);

    if (dx < DEFAULT_ERASE_THRESHOLD_PX && dy < DEFAULT_ERASE_THRESHOLD_PX) return;

    const store = useProjectStore.getState();
    const { clips, tracks, trackHeight } = store;

    const screenX = event.screenPoint.x;
    const screenY = event.screenPoint.y;
    const viewport = (this.coordinateSystem as any).viewport;
    const zoomX = viewport?.zoomX ?? 100;
    const zoomY = viewport?.zoomY ?? trackHeight;
    const scrollX = viewport?.scrollX ?? 0;
    const scrollY = viewport?.scrollY ?? 0;
    const yOffset = viewport?.yOffset ?? 40;

    const minX = Math.min(this.pointerDownScreen.x, screenX);
    const maxX = Math.max(this.pointerDownScreen.x, screenX);
    const minY = Math.min(this.pointerDownScreen.y, screenY);
    const maxY = Math.max(this.pointerDownScreen.y, screenY);

    for (const clip of clips) {
      const trackIndex = tracks.findIndex(t => t.id === clip.trackId);
      if (trackIndex < 0) continue;

      const clipStart = clip.startBeat ?? clip.start;
      const clipScreenX = clipStart * zoomX - scrollX;
      const clipWidth = Math.max(clip.duration * zoomX, 2);
      const trackScreenY = yOffset + trackIndex * zoomY - scrollY;

      const clipLeft = clipScreenX;
      const clipRight = clipScreenX + clipWidth;
      const clipTop = trackScreenY;
      const clipBottom = trackScreenY + zoomY;

      const intersects = clipLeft < maxX && clipRight > minX && clipTop < maxY && clipBottom > minY;
      if (intersects) {
        this.dragIntersectedClips.add(clip.id);
      }
    }

    this.highlightedClipIds = new Set(this.dragIntersectedClips);
  }

  getHighlightedClipIds(): string[] {
    return [...this.highlightedClipIds];
  }

  getHoveredHit(): EraseHit | null {
    return this.hoveredHit;
  }

  private cancelCurrentOperation() {
    this.isDragging = false;
    this.dragIntersectedClips.clear();
    this.highlightedClipIds.clear();
    this.hoveredHit = null;
    this.pointerDownScreen = null;
    this.transitionTo('idle');
  }

  private transitionTo(newState: 'idle' | 'hover' | 'dragging') {
    if (this.state !== newState) {
      this.state = newState;
    }
  }
}
