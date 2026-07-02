import { SnapEngine } from '@/engine/editor/SnapEngine';
import { CoordinateSystem } from '@/engine/editor/CoordinateSystem';
import { useProjectStore } from '@/store/projectStore';

export interface AutomationPointPreview {
  trackId: string;
  parameter: string;
  beat: number;
  value: number;
}

export class AutomationCreationController {
  private previewPoint: AutomationPointPreview | null = null;
  private createdPointId: string | null = null;

  startCreation(
    trackId: string,
    parameter: string,
    beat: number,
    value: number,
    snapEngine: SnapEngine,
    coordinateSystem: CoordinateSystem
  ): boolean {
    const snappedBeat = snapEngine.snapBeat(beat, coordinateSystem.getVerticalZoom());

    this.previewPoint = {
      trackId,
      parameter,
      beat: snappedBeat,
      value: Math.max(0, Math.min(1, value)),
    };

    this.createdPointId = null;
    return true;
  }

  updateCreation(beat: number, value: number, snapEngine: SnapEngine, coordinateSystem: CoordinateSystem) {
    if (!this.previewPoint) return;

    const snappedBeat = snapEngine.snapBeat(beat, coordinateSystem.getVerticalZoom());
    this.previewPoint.beat = snappedBeat;
    this.previewPoint.value = Math.max(0, Math.min(1, value));
  }

  finalizeCreation(): boolean {
    if (!this.previewPoint) return false;

    const store = useProjectStore.getState();
    store.saveHistorySnapshot();
    store.addAutomationPoint(
      this.previewPoint.trackId,
      this.previewPoint.parameter,
      this.previewPoint.beat,
      this.previewPoint.value
    );

    this.createdPointId = `${this.previewPoint.trackId}-${this.previewPoint.parameter}-${this.previewPoint.beat}`;
    this.previewPoint = null;

    return true;
  }

  cancelCreation() {
    this.previewPoint = null;
  }

  getPreview(): AutomationPointPreview | null {
    return this.previewPoint;
  }

  isCreating(): boolean {
    return this.previewPoint !== null;
  }
}
