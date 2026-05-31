import { CompiledAutomationLane } from '../compiler/CompiledAutomationLane';

export class ParameterStreamRuntime {
  constructor(private lane: CompiledAutomationLane) {}

  public evaluate(beat: number): number {
    const segments = this.lane.segments;

    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];

      if (beat >= s.startBeat && beat <= s.endBeat) {
        const t = (beat - s.startBeat) / (s.endBeat - s.startBeat);
        return s.startValue + (s.endValue - s.startValue) * t;
      }
    }

    return 0; // Or last known value
  }
}
