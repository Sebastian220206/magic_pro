import { ViewportState } from './types';

export class ConstraintPass {
  public static apply(state: ViewportState): ViewportState {
    const next = { ...state };

    // 1. Time Boundaries
    // Guard NaN — Math.max(0, NaN) returns NaN, so check first
    next.startBeat = Number.isFinite(next.startBeat) ? Math.max(0, next.startBeat) : 0;

    // 2. Pitch Boundaries (0 to 127)
    next.maxVisiblePitch = Number.isFinite(next.maxVisiblePitch)
      ? Math.max(0, Math.min(127, next.maxVisiblePitch))
      : 60;

    // 3. Zoom Clamping
    next.pixelsPerBeat = Number.isFinite(next.pixelsPerBeat)
      ? Math.max(1, Math.min(next.pixelsPerBeat, 500))
      : 20;

    next.pixelsPerPitch = Number.isFinite(next.pixelsPerPitch)
      ? Math.max(5, Math.min(next.pixelsPerPitch, 40))
      : 12;

    return next;
  }
}
