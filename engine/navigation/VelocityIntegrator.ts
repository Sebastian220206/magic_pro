import { ViewportState, NavigationVector } from './types';
import { SpatialCoordinateSystem } from './SpatialCoordinateSystem';

export class VelocityIntegrator {
  private static panVelocityX = 0;
  private static panVelocityY = 0;
  private static readonly FRICTION = 0.92;

  public static hasMomentum(): boolean {
    return Number.isFinite(this.panVelocityX) && Number.isFinite(this.panVelocityY) &&
      (Math.abs(this.panVelocityX) > 0.1 || Math.abs(this.panVelocityY) > 0.1);
  }

  public static integrate(state: ViewportState, vectors: NavigationVector[]): ViewportState {
    let nextState = { ...state };
    
    for (const v of vectors) {
      if (v.type === 'zoom') {
        nextState = this.applyAnchoredZoom(nextState, v.dy, v.anchorX);
      } else if (v.type === 'pan') {
        // Feed the physical pan delta directly into the velocity buffer
        this.panVelocityX = Number.isFinite(v.dx) ? v.dx : 0;
        this.panVelocityY = Number.isFinite(v.dy) ? v.dy : 0;
      }
    }

    // Apply Momentum to State
    if (this.hasMomentum()) {
      const pb = nextState.pixelsPerBeat;
      nextState.startBeat += Number.isFinite(pb) && pb > 0
        ? this.panVelocityX / pb
        : 0;

      const pp = nextState.pixelsPerPitch;
      nextState.maxVisiblePitch -= Number.isFinite(pp) && pp > 0
        ? this.panVelocityY / pp
        : 0;

      // Decay
      this.panVelocityX *= this.FRICTION;
      this.panVelocityY *= this.FRICTION;
    }

    return nextState;
  }

  private static applyAnchoredZoom(state: ViewportState, zoomDelta: number, anchorPixelX: number): ViewportState {
    if (!Number.isFinite(zoomDelta) || !Number.isFinite(anchorPixelX)) {
      return state;
    }

    const coords = new SpatialCoordinateSystem(state);
    
    // 1. Calculate absolute beat position currently beneath the cursor
    const beatUnderCursor = coords.xToBeat(anchorPixelX);
    if (!Number.isFinite(beatUnderCursor)) return state;

    // 2. Scale the pixelsPerBeat exponentially
    const zoomMultiplier = Math.exp(-zoomDelta * 0.01);
    if (!Number.isFinite(zoomMultiplier) || zoomMultiplier <= 0) return state;

    const newPixelsPerBeat = state.pixelsPerBeat * zoomMultiplier;
    if (!Number.isFinite(newPixelsPerBeat) || newPixelsPerBeat <= 0) return state;

    // 3. Shift the startBeat so that the absolute beat remains pinned under the cursor
    const newStartBeat = Number.isFinite(anchorPixelX)
      ? beatUnderCursor - (anchorPixelX / newPixelsPerBeat)
      : state.startBeat;

    return { ...state, startBeat: newStartBeat, pixelsPerBeat: newPixelsPerBeat };
  }
}
