import { Tool, InteractionEvent } from '@/engine/editor/types/tools';
import { SnapEngine } from '@/engine/editor/SnapEngine';
import { CoordinateSystem } from '@/engine/editor/CoordinateSystem';
import { RegionCreationController } from '@/engine/interactions/RegionCreationController';
import { MidiCreationController } from '@/engine/interactions/MidiCreationController';
import { AutomationCreationController } from '@/engine/interactions/AutomationCreationController';
import { useProjectStore } from '@/store/projectStore';

type PencilToolState =
  | 'idle'
  | 'drawing-region'
  | 'drawing-note'
  | 'drawing-automation'
  | 'finalize';

export class PencilTool implements Tool {
  readonly id = 'draw';

  private state: PencilToolState = 'idle';
  private isDragging = false;
  private dragThresholdMet = false;

  readonly regionController: RegionCreationController;
  readonly midiController: MidiCreationController;
  readonly automationController: AutomationCreationController;

  private rafId: number | null = null;
  private pendingPointerMove: InteractionEvent | null = null;

  private lastPreviewBeat: number | null = null;
  private lastPreviewDuration: number | null = null;

  get cursor(): string {
    if (this.state === 'drawing-region' || this.state === 'drawing-note') {
      return 'crosshair';
    }
    if (this.state === 'drawing-automation') {
      return 'copy';
    }
    return 'crosshair';
  }

  constructor(
    private snapEngine: SnapEngine,
    private coordinateSystem: CoordinateSystem
  ) {
    this.regionController = new RegionCreationController();
    this.midiController = new MidiCreationController();
    this.automationController = new AutomationCreationController();
  }

  onPointerDown(event: InteractionEvent) {
    if (this.state === 'drawing-region' || this.state === 'drawing-note') {
      return;
    }

    this.isDragging = true;
    this.dragThresholdMet = false;
    this.lastPreviewBeat = null;
    this.lastPreviewDuration = null;
    this.lastPointerDownScreen = { x: event.screenPoint.x, y: event.screenPoint.y };

    const context = this.detectContext(event);

    if (context === 'automation') {
      this.startAutomationDraw(event);
      return;
    }

    if (context === 'midi-note') {
      this.startMidiNoteDraw(event);
      return;
    }

    this.startRegionDraw(event);
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
    if (this.state === 'drawing-region') {
      if (!this.isDragging) return;

      const dx = Math.abs(event.screenPoint.x - this.lastPointerDownScreen.x);
      if (!this.dragThresholdMet && dx > 3) {
        this.dragThresholdMet = true;
      }

      if (this.dragThresholdMet) {
        this.regionController.updateCreation(
          event.editorPoint.beat,
          this.snapEngine,
          this.coordinateSystem
        );
        const preview = this.regionController.getPreviewState();
        this.updatePreviewInfo(preview?.startBeat ?? 0, preview?.duration ?? 0);
      }
      return;
    }

    if (this.state === 'drawing-note') {
      if (!this.isDragging) return;

      const dx = Math.abs(event.screenPoint.x - this.lastPointerDownScreen.x);
      if (!this.dragThresholdMet && dx > 3) {
        this.dragThresholdMet = true;
      }

      if (this.dragThresholdMet) {
        const pitch = this.screenYToPitch(event.screenPoint.y);
        this.midiController.updateCreation(
          event.editorPoint.beat,
          pitch,
          this.snapEngine,
          this.coordinateSystem
        );
        const preview = this.midiController.getPreviewState();
        this.updatePreviewInfo(preview?.startBeat ?? 0, preview?.duration ?? 0);
      }
      return;
    }

    if (this.state === 'drawing-automation') {
      if (!this.isDragging) return;

      this.automationController.updateCreation(
        event.editorPoint.beat,
        this.screenYToAutomationValue(event.screenPoint.y, event),
        this.snapEngine,
        this.coordinateSystem
      );
      return;
    }
  }

  onPointerUp(event: InteractionEvent) {
    this.isDragging = false;

    if (this.state === 'drawing-region') {
      this.finalizeRegion();
      return;
    }

    if (this.state === 'drawing-note') {
      if (!this.dragThresholdMet) {
        this.midiController.cancelCreation();
        const pitch = this.screenYToPitch(event.screenPoint.y);
        if (this.midiTargetClipId) {
          this.midiController.startCreation(
            this.midiTargetClipId,
            pitch,
            event.editorPoint.beat,
            this.snapEngine,
            this.coordinateSystem,
            false
          );
        }
      }
      this.finalizeMidiNote();
      return;
    }

    if (this.state === 'drawing-automation') {
      this.finalizeAutomation();
      return;
    }

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

  private lastPointerDownScreen: { x: number; y: number } = { x: 0, y: 0 };
  private midiTargetClipId: string | null = null;

  private detectContext(event: InteractionEvent): 'region' | 'midi-note' | 'automation' {
    const store = useProjectStore.getState();
    const { clips, tracks, showAutomation } = store;

    const beat = event.editorPoint.beat;
    const trackIndex = Math.floor(event.editorPoint.vertical);

    if (showAutomation && trackIndex >= 0 && trackIndex < tracks.length) {
      const track = tracks[trackIndex];
      if (track.automation && track.automation.length > 0) {
        return 'automation';
      }
    }

    if (trackIndex >= 0 && trackIndex < tracks.length) {
      const trackId = tracks[trackIndex].id;
      for (const clip of clips) {
        if (clip.type === 'midi' && clip.trackId === trackId) {
          const clipStart = clip.startBeat ?? clip.start;
          const clipEnd = clipStart + clip.duration;
          if (beat >= clipStart && beat <= clipEnd) {
            this.midiTargetClipId = clip.id;
            return 'midi-note';
          }
        }
      }
    }

    return 'region';
  }

  private startRegionDraw(event: InteractionEvent) {
    this.lastPointerDownScreen = { x: event.screenPoint.x, y: event.screenPoint.y };
    const trackIndex = Math.floor(event.editorPoint.vertical);

    const started = this.regionController.startCreation(
      event.editorPoint.beat,
      trackIndex,
      this.snapEngine,
      this.coordinateSystem
    );

    if (started) {
      this.transitionTo('drawing-region');
    }
  }

  private startMidiNoteDraw(event: InteractionEvent) {
    const pitch = this.screenYToPitch(event.screenPoint.y);

    if (!this.midiTargetClipId) return;

    const started = this.midiController.startCreation(
      this.midiTargetClipId,
      pitch,
      event.editorPoint.beat,
      this.snapEngine,
      this.coordinateSystem,
      true
    );

    if (started) {
      this.transitionTo('drawing-note');
    }
  }

  private finalizeRegion() {
    if (!this.regionController.isCreating()) return;
    this.regionController.finalizeCreation();
    this.transitionTo('finalize');
    this.clearPreviewInfo();
  }

  private finalizeMidiNote() {
    if (!this.midiController.isCreating()) return;
    const created = this.midiController.finalizeCreation();
    this.transitionTo('finalize');
    this.clearPreviewInfo();
  }

  private finalizeAutomation() {
    if (!this.automationController.isCreating()) return;
    this.automationController.finalizeCreation();
    this.transitionTo('finalize');
  }

  private startAutomationDraw(event: InteractionEvent) {
    const store = useProjectStore.getState();
    const trackIndex = Math.floor(event.editorPoint.vertical);
    const track = store.tracks[trackIndex];
    if (!track || !track.automation || track.automation.length === 0) return;

    const lane = track.automation[0];

    this.automationController.startCreation(
      track.id,
      lane.parameter,
      event.editorPoint.beat,
      this.screenYToAutomationValue(event.screenPoint.y, event),
      this.snapEngine,
      this.coordinateSystem
    );

    this.transitionTo('drawing-automation');
  }

  private screenYToPitch(screenY: number): number {
    const store = useProjectStore.getState();
    const trackHeight = store.trackHeight || 80;
    const viewport = (this.coordinateSystem as any).viewport;
    const scrollY = viewport?.scrollY ?? 0;

    const adjustedY = screenY + scrollY;
    const totalHeight = trackHeight;

    const normalizedY = adjustedY / totalHeight;
    const pitch = Math.round(127 - normalizedY * 127);

    return Math.max(0, Math.min(127, pitch));
  }

  private screenYToAutomationValue(screenY: number, _event: InteractionEvent): number {
    const viewport = (this.coordinateSystem as any).viewport;
    const scrollY = viewport?.scrollY ?? 0;
    const trackHeight = useProjectStore.getState().trackHeight || 80;

    const adjustedY = screenY + scrollY;
    const localY = adjustedY % trackHeight;
    const normalizedY = 1 - (localY / trackHeight);

    return Math.max(0, Math.min(1, normalizedY));
  }

  private updatePreviewInfo(startBeat: number, duration: number) {
    this.lastPreviewBeat = startBeat;
    this.lastPreviewDuration = duration;
  }

  private clearPreviewInfo() {
    this.lastPreviewBeat = null;
    this.lastPreviewDuration = null;
  }

  private cancelCurrentOperation() {
    if (this.state === 'drawing-region') {
      this.regionController.cancelCreation();
    } else if (this.state === 'drawing-note') {
      this.midiController.cancelCreation();
    } else if (this.state === 'drawing-automation') {
      this.automationController.cancelCreation();
    }
    this.isDragging = false;
    this.dragThresholdMet = false;
    this.clearPreviewInfo();
    this.transitionTo('idle');
  }

  private transitionTo(newState: PencilToolState) {
    if (this.state !== newState) {
      this.state = newState;
    }
  }

  getState(): PencilToolState {
    return this.state;
  }

  isActive(): boolean {
    return this.state !== 'idle' && this.state !== 'finalize';
  }

  getPreviewInfo(): { startBeat: number; duration: number } | null {
    if (this.lastPreviewBeat !== null && this.lastPreviewDuration !== null) {
      return { startBeat: this.lastPreviewBeat, duration: this.lastPreviewDuration };
    }
    return null;
  }

  renderOverlay(ctx: CanvasRenderingContext2D) {
    if (this.state === 'drawing-region') {
      const preview = this.regionController.getPreviewState();
      if (preview) {
        const viewport = (this.coordinateSystem as any).viewport;
        const zoomX = viewport?.zoomX ?? 100;
        const zoomY = viewport?.zoomY ?? 80;
        const scrollX = viewport?.scrollX ?? 0;
        const scrollY = viewport?.scrollY ?? 0;

        const store = useProjectStore.getState();
        const trackIndex = store.tracks.findIndex(t => t.id === preview.trackId);
        if (trackIndex < 0) return;

        const x = preview.startBeat * zoomX - scrollX;
        const y = trackIndex * zoomY - scrollY;
        const width = preview.duration * zoomX;
        const height = zoomY;

        ctx.fillStyle = 'rgba(96, 165, 250, 0.25)';
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.8)';
        ctx.lineWidth = 1;
        ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x, y, width, height);
      }
    }

    if (this.state === 'drawing-note') {
      const preview = this.midiController.getPreviewState();
      if (preview) {
        const viewport = (this.coordinateSystem as any).viewport;
        const zoomX = viewport?.zoomX ?? 100;
        const zoomY = viewport?.zoomY ?? 80;
        const scrollX = viewport?.scrollX ?? 0;

        const x = preview.startBeat * zoomX - scrollX;
        const y = (127 - preview.pitch) * (zoomY / 127);
        const width = preview.duration * zoomX;
        const height = zoomY / 127;

        ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.9)';
        ctx.lineWidth = 1;
        ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x, y, width, height);
      }
    }
  }
}
