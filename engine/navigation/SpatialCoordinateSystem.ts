import { ViewportState } from './types';

export class SpatialCoordinateSystem {
  constructor(private viewport: Readonly<ViewportState>) {}

  public beatToX(beat: number): number {
    if (!Number.isFinite(beat)) return 0;
    const pb = this.viewport.pixelsPerBeat;
    if (!Number.isFinite(pb) || pb <= 0) return 0;
    return (beat - this.viewport.startBeat) * pb;
  }

  public xToBeat(x: number): number {
    if (!Number.isFinite(x)) return 0;
    const pb = this.viewport.pixelsPerBeat;
    if (!Number.isFinite(pb) || pb <= 0) return 0;
    return this.viewport.startBeat + (x / pb);
  }

  public get beatWidth(): number {
    const pb = this.viewport.pixelsPerBeat;
    return Number.isFinite(pb) ? pb : 20;
  }

  public pitchToY(pitch: number): number {
    if (!Number.isFinite(pitch)) return 0;
    const pp = this.viewport.pixelsPerPitch;
    if (!Number.isFinite(pp) || pp <= 0) return 0;
    const offset = this.viewport.maxVisiblePitch - pitch;
    return offset * pp;
  }

  public yToPitch(y: number): number {
    if (!Number.isFinite(y)) return 60;
    const pp = this.viewport.pixelsPerPitch;
    if (!Number.isFinite(pp) || pp <= 0) return 60;
    const offset = y / pp;
    return this.viewport.maxVisiblePitch - offset;
  }
}
