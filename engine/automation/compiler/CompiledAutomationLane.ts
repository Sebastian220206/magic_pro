export interface CompiledAutomationSegment {
  startBeat: number;
  endBeat: number;

  startValue: number;
  endValue: number;

  curveType: number;
  tension: number;
}

export interface CompiledAutomationLane {
  parameterId: string;
  segments: CompiledAutomationSegment[];
}
