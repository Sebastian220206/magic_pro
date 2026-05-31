import { AutomationLane } from './types';
import { AutomationIndex } from './indexing/AutomationIndex';
import { evaluateCurve } from './AutomationInterpolation';
import { getParameterMapping } from './AutomationParameterMap';

export class AutomationStateResolver {
  /**
   * Resolves the exact runtime DSP state of all automation lanes at transport beat T.
   * Returns a map of parameter paths to their evaluated DSP values.
   */
  public static resolveStateAtBeat(lanes: AutomationLane[], transportBeat: number): Record<string, number> {
    const state: Record<string, number> = {};

    for (const lane of lanes) {
      const index = new AutomationIndex(lane.points);
      const [p1, p2] = index.findSegmentAtTime(transportBeat);

      let normalizedValue: number;
      if (!p1 && !p2) {
        normalizedValue = lane.defaultValue;
      } else if (!p1) {
        normalizedValue = p2!.value; // Before first point
      } else if (!p2) {
        normalizedValue = p1.value; // After last point
      } else {
        normalizedValue = evaluateCurve(p1, p2, transportBeat);
      }

      const mapFn = getParameterMapping(lane.parameter);
      // Constructing key as "trackId.parameter" to match existing state tracking
      state[`${lane.trackId}.${lane.parameter}`] = mapFn(normalizedValue);
    }

    return state;
  }
}
