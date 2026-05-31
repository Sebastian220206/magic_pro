import { CompiledAutomationLane, CompiledAutomationSegment } from './CompiledAutomationLane';

// Mock interface since we aren't importing the full project types right now
export interface AutomationPoint {
  time: number;
  value: number;
  curveType: string;
  tension?: number;
}

export interface AutomationLane {
  parameterId: string;
  points: AutomationPoint[];
}

export class AutomationBindingCompiler {
  public static compile(lane: AutomationLane): CompiledAutomationLane {
    const segments: CompiledAutomationSegment[] = [];

    for (let i = 0; i < lane.points.length - 1; i++) {
      const p1 = lane.points[i];
      const p2 = lane.points[i + 1];

      segments.push({
        startBeat: p1.time,
        endBeat: p2.time,
        startValue: p1.value,
        endValue: p2.value,
        curveType: this.encodeCurve(p1.curveType),
        tension: p1.tension || 0
      });
    }

    return {
      parameterId: lane.parameterId,
      segments
    };
  }

  private static encodeCurve(curve: string): number {
    switch (curve) {
      case 'linear': return 1;
      case 'bezier': return 2;
      case 'stepped': return 3;
      case 'exponential': return 4;
      default: return 0;
    }
  }
}
