import { Tool, InteractionEvent } from '@/engine/editor/types/tools';
import { useProjectStore } from '@/store/projectStore';
import { useAutomationStore } from '@/store/automationStore';
import { AutomationLane, AutomationSegment, getAllSegments, createSegmentFromPoints } from '@/engine/automation/types';

const SEGMENT_HIT_THRESHOLD = 8;

export class AutomationCurveTool implements Tool {
  readonly id = 'automation-curve';
  readonly cursor = 'crosshair';

  private state: 'idle' | 'hovering' | 'dragging' = 'idle';
  private activeSegment: AutomationSegment | null = null;
  private activeLane: AutomationLane | null = null;
  private dragStartY = 0;
  private dragStartAmount = 0;
  private pixelsPerValue = 100;

  onPointerDown(event: InteractionEvent): void {
    const store = useAutomationStore.getState();
    const { beat, value } = this.eventToAutomation(event);

    const segment = this.findSegmentAt(beat, value);
    if (!segment) return;

    const lane = store.lanes.find(l => l.id === segment.laneId);
    if (!lane) return;

    this.activeSegment = segment;
    this.activeLane = lane;
    this.state = 'hovering';

    const pointA = lane.points.find(p => p.id === segment.startPointId);
    if (!pointA) return;

    useAutomationStore.getState().selectAutomationSegment(segment.id);
    this.dragStartY = event.screenPoint.y;
    this.dragStartAmount = pointA.curveAmount ?? 0;

    this.state = 'dragging';
  }

  onPointerMove(event: InteractionEvent): void {
    const store = useAutomationStore.getState();
    const { beat, value } = this.eventToAutomation(event);

    if (this.state === 'dragging' && this.activeSegment && this.activeLane) {
      const deltaY = this.dragStartY - event.screenPoint.y;
      const amountDelta = deltaY / this.pixelsPerValue;
      const newAmount = Math.max(-1, Math.min(1, this.dragStartAmount + amountDelta));
      const roundedAmount = Math.round(newAmount * 100) / 100;

      const pointA = this.activeLane.points.find(p => p.id === this.activeSegment!.startPointId);
      if (pointA) {
        const isNonLinear = Math.abs(roundedAmount) > 0.01;
        const curveType = isNonLinear ? (pointA.curve === 'linear' ? 'bezier' : pointA.curve) : 'linear';
        useAutomationStore.getState().setPointCurve(
          this.activeLane!.id,
          pointA.id,
          curveType,
          roundedAmount
        );
        useAutomationStore.getState().setHoveredAutomationSegment(this.activeSegment.id);
        useAutomationStore.getState().setCurveDragAmount(roundedAmount);
      }
      return;
    }

    const segment = this.findSegmentAt(beat, value);
    if (segment) {
      useAutomationStore.getState().setHoveredAutomationSegment(segment.id);
    } else {
      useAutomationStore.getState().setHoveredAutomationSegment(null);
    }
  }

  onPointerUp(event: InteractionEvent): void {
    if (this.state === 'dragging' && this.activeSegment && this.activeLane) {
      useProjectStore.getState().saveHistorySnapshot();
    }
    this.state = 'idle';
    this.activeSegment = null;
    this.activeLane = null;
    useAutomationStore.getState().setCurveDragAmount(0);
  }

  onDoubleClick(event: InteractionEvent): void {
    const store = useAutomationStore.getState();
    const { beat, value } = this.eventToAutomation(event);
    const segment = this.findSegmentAt(beat, value);
    if (!segment) return;

    const lane = store.lanes.find(l => l.id === segment.laneId);
    if (!lane) return;

    const pointA = lane.points.find(p => p.id === segment.startPointId);
    if (!pointA) return;

    useProjectStore.getState().saveHistorySnapshot();
    useAutomationStore.getState().setPointCurve(segment.laneId, pointA.id, 'linear', 0);
    useAutomationStore.getState().selectAutomationSegment(null);
    useAutomationStore.getState().setHoveredAutomationSegment(null);
  }

  onCancel(): void {
    this.state = 'idle';
    this.activeSegment = null;
    this.activeLane = null;
    useAutomationStore.getState().setHoveredAutomationSegment(null);
    useAutomationStore.getState().setCurveDragAmount(0);
  }

  setPixelsPerValue(ppv: number): void {
    this.pixelsPerValue = ppv;
  }

  private findSegmentAt(beat: number, value: number): AutomationSegment | null {
    const store = useAutomationStore.getState();
    for (const lane of store.lanes) {
      const segments = getAllSegments(lane);
      for (const seg of segments) {
        if (beat >= seg.startBeat && beat <= seg.endBeat) {
          const t = seg.endBeat - seg.startBeat > 0
            ? (beat - seg.startBeat) / (seg.endBeat - seg.startBeat)
            : 0;
          const expectedValue = seg.startValue + (seg.endValue - seg.startValue) * t;
          const valueDiff = Math.abs(value - expectedValue);
          if (valueDiff * this.pixelsPerValue < SEGMENT_HIT_THRESHOLD) {
            return seg;
          }
        }
      }
    }
    return null;
  }

  private eventToAutomation(event: InteractionEvent): { beat: number; value: number } {
    return {
      beat: event.editorPoint.beat,
      value: Math.max(0, Math.min(1, 1 - event.editorPoint.vertical)),
    };
  }
}
