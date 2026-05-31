import { ViewportState } from './types';
import { SpatialCoordinateSystem } from './SpatialCoordinateSystem';
import { ViewportTransaction } from './ViewportTransaction';

export enum FollowMode {
  DISABLED = 0,
  PAGE_FLIP = 1,
  CONTINUOUS = 2
}

export class PlayheadFollowEngine {
  /**
   * Applies the playhead follow logic via a ViewportTransaction.
   * Returns true if the viewport was mutated.
   */
  public static applyFollow(
    transaction: ViewportTransaction, 
    state: Readonly<ViewportState>, 
    currentBeat: number, 
    screenWidthPx: number, 
    mode: FollowMode
  ): boolean {
    if (mode === FollowMode.DISABLED) return false;
    if (!Number.isFinite(currentBeat) || !Number.isFinite(screenWidthPx) || screenWidthPx <= 0) return false;

    const coords = new SpatialCoordinateSystem(state);
    const playheadX = coords.beatToX(currentBeat);

    if (mode === FollowMode.PAGE_FLIP) {
      if (Number.isFinite(playheadX) && playheadX > screenWidthPx * 0.95) {
        const pb = state.pixelsPerBeat;
        const offset = Number.isFinite(pb) && pb > 0 ? screenWidthPx * 0.05 / pb : 0;
        const newStart = currentBeat - offset;
        if (Number.isFinite(newStart)) {
          transaction.applyAbsoluteStart(newStart);
          return true;
        }
      }
      if (Number.isFinite(playheadX) && playheadX < 0) {
        transaction.applyAbsoluteStart(currentBeat);
        return true;
      }
    }

    if (mode === FollowMode.CONTINUOUS) {
      const targetCenterPx = screenWidthPx / 2;
      const errorPx = Number.isFinite(playheadX) ? playheadX - targetCenterPx : 0;
      
      if (Math.abs(errorPx) > 2) {
        const pb = state.pixelsPerBeat;
        const errorBeats = Number.isFinite(pb) && pb > 0 ? errorPx / pb : 0;
        const newStart = state.startBeat + (errorBeats * 0.1);
        if (Number.isFinite(newStart)) {
          transaction.applyAbsoluteStart(newStart);
          return true;
        }
      }
    }

    return false;
  }
}
