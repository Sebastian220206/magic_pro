import { ViewportState } from './types';
import { ConstraintPass } from './ConstraintPass';

export class ViewportTransaction {
  private pendingState: ViewportState;
  private isCommitted = false;

  constructor(initial: Readonly<ViewportState>) {
    this.pendingState = { ...initial };
  }

  public applyPan(beatsToShift: number, pitchToShift: number): this {
    this.assertNotCommitted();
    if (Number.isFinite(beatsToShift)) this.pendingState.startBeat += beatsToShift;
    if (Number.isFinite(pitchToShift)) this.pendingState.maxVisiblePitch += pitchToShift;
    return this;
  }

  public applyZoom(zoomMultiplier: number, anchorBeat: number): this {
    this.assertNotCommitted();
    if (!Number.isFinite(zoomMultiplier) || zoomMultiplier <= 0 || !Number.isFinite(anchorBeat)) return this;

    const newPixelsPerBeat = this.pendingState.pixelsPerBeat * zoomMultiplier;
    if (!Number.isFinite(newPixelsPerBeat) || newPixelsPerBeat <= 0) return this;
    
    // Maintain anchor logic
    // anchorX = (anchorBeat - newStartBeat) * newPixelsPerBeat
    // anchorX also equals = (anchorBeat - oldStartBeat) * oldPixelsPerBeat
    const anchorX = (anchorBeat - this.pendingState.startBeat) * this.pendingState.pixelsPerBeat;
    if (!Number.isFinite(anchorX)) return this;

    const newStartBeat = anchorBeat - (anchorX / newPixelsPerBeat);
    if (!Number.isFinite(newStartBeat)) return this;

    this.pendingState.startBeat = newStartBeat;
    this.pendingState.pixelsPerBeat = newPixelsPerBeat;
    return this;
  }

  public applyAbsoluteStart(beat: number): this {
    this.assertNotCommitted();
    this.pendingState.startBeat = beat;
    return this;
  }

  public commit(): Readonly<ViewportState> {
    this.assertNotCommitted();
    this.pendingState = ConstraintPass.apply(this.pendingState);
    this.isCommitted = true;
    return Object.freeze({ ...this.pendingState });
  }

  private assertNotCommitted() {
    if (this.isCommitted) throw new Error("Transaction already committed");
  }
}
