import { ViewportState } from '../rendering/RenderPass';

export class GPUCamera {
  public projectionMatrix = new Float32Array(16);

  public update(
    width: number,
    height: number,
    viewport: ViewportState
  ) {
    const sx = 2 / width;
    const sy = -2 / height;

    const startBeat = viewport.startBeat || 0;
    const pixelsPerBeat = viewport.pixelsPerBeat || 1;
    const pixelsPerPitch = viewport.pixelsPerPitch || 1;

    this.projectionMatrix.set([
      sx * pixelsPerBeat, 0, 0, 0,
      0, sy * pixelsPerPitch, 0, 0,
      0, 0, 1, 0,
      -1 - (startBeat * sx * pixelsPerBeat),
      1,
      0,
      1
    ]);
  }
}
