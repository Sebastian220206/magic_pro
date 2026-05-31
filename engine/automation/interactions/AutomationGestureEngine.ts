export class AutomationGestureEngine {
  /**
   * Calculates the momentum velocity of a pointer drag
   */
  public static calculateVelocity(deltaX: number, deltaTime: number): number {
    return deltaX / Math.max(1, deltaTime);
  }

  /**
   * Applies magnetic snapping to the timeline grid.
   * Ensures automation points land exactly on beat divisions.
   */
  public static applyMagneticSnap(beat: number, grid: number): number {
    return Math.round(beat / grid) * grid;
  }

  /**
   * Translates a vertical mouse drag into an exponential tension curve value (-1.0 to 1.0)
   */
  public static calculateTension(mouseDeltaY: number, sensitivity = 0.01): number {
    const raw = mouseDeltaY * sensitivity;
    // Clamp to valid tension range
    return Math.max(-1, Math.min(1, raw));
  }
}
