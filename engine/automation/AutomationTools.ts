import { AutomationPoint, AutomationLane } from './types';
import { Viewport } from './AutomationRenderer';
import { RootStoreAutomationApi, MoveAutomationPointCommand } from './AutomationCommands';

export interface AutomationToolContext {
  lane: AutomationLane;
  viewport: Viewport;
  store: RootStoreAutomationApi;
  dispatchCommand: (cmd: any) => void;
}

export abstract class AutomationTool {
  constructor(protected context: AutomationToolContext) {}
  
  abstract onPointerDown(e: PointerEvent, beat: number, value: number): void;
  abstract onPointerMove(e: PointerEvent, beat: number, value: number): void;
  abstract onPointerUp(e: PointerEvent, beat: number, value: number): void;
  abstract onCancel(): void;
  
  renderOverlay(ctx: CanvasRenderingContext2D): void {}
}

export class AutomationDrawTool extends AutomationTool {
  private draggingPoint: AutomationPoint | null = null;
  private startBeat: number = 0;
  private startValue: number = 0;

  onPointerDown(e: PointerEvent, beat: number, value: number) {
    // Determine if we clicked an existing point (hit test)
    // Roughly 5 pixels tolerance translated to beats
    const HIT_TOLERANCE_PX = 5;
    const beatsPerPixel = (this.context.viewport.endBeat - this.context.viewport.startBeat) / this.context.viewport.width;
    const hitRadiusBeats = HIT_TOLERANCE_PX * beatsPerPixel;

    const hitPoint = this.context.lane.points.find(p => Math.abs(p.beat - beat) < hitRadiusBeats);

    if (hitPoint) {
      this.draggingPoint = hitPoint;
      this.startBeat = hitPoint.beat;
      this.startValue = hitPoint.value;
    } else {
      // Real app would immediately insert and start dragging
      // Omitted for brevity
    }
  }

  onPointerMove(e: PointerEvent, beat: number, value: number) {
    if (this.draggingPoint) {
      // Dispatch temporary UI-only move for 60fps drag (avoids undo stack bloat)
      this.context.store.updatePoint(this.context.lane.id, this.draggingPoint.id, {
        beat: Math.max(0, beat), // constraint > 0
        value: Math.max(0, Math.min(1, value)) // clamp 0-1
      });
    }
  }

  onPointerUp(e: PointerEvent, beat: number, value: number) {
    if (this.draggingPoint) {
      // Dispatch the actual undoable command
      const clampedBeat = Math.max(0, beat);
      const clampedValue = Math.max(0, Math.min(1, value));

      const cmd = new MoveAutomationPointCommand(
        this.context.lane.id,
        this.draggingPoint.id,
        clampedBeat, clampedValue,
        this.startBeat, this.startValue
      );
      this.context.dispatchCommand(cmd);
      this.draggingPoint = null;
    }
  }

  onCancel() {
    if (this.draggingPoint) {
      // Revert temporary drag state
      this.context.store.updatePoint(this.context.lane.id, this.draggingPoint.id, {
        beat: this.startBeat, value: this.startValue
      });
      this.draggingPoint = null;
    }
  }
}
