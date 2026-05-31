import { RendererContract } from '../../rendering/contracts/RendererScheduler';
import { ViewportState } from '../../navigation/types';
import { BoundingBox } from '../../rendering/invalidation/DirtyRegionManager';

export class PitchGridRenderer implements RendererContract {
  public priority = 10;

  constructor(private ctx: CanvasRenderingContext2D) {}

  public renderFull(ctx: CanvasRenderingContext2D, viewport: Readonly<ViewportState>) {
    this.drawGrid(ctx, viewport);
  }

  public renderRegion(ctx: CanvasRenderingContext2D, viewport: Readonly<ViewportState>, region: BoundingBox) {
    this.drawGrid(ctx, viewport); // Grid logic usually draws exactly inside clip region naturally
  }

  private drawGrid(ctx: CanvasRenderingContext2D, viewport: Readonly<ViewportState>) {
    const { startBeat, pixelsPerBeat, maxVisiblePitch, zoomY } = viewport;
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    const minPitch = Math.max(0, Math.floor(maxVisiblePitch - height / zoomY));
    const startPitch = Math.min(127, Math.ceil(maxVisiblePitch));

    ctx.save();
    
    // Draw horizontal pitch rows
    for (let p = startPitch; p >= minPitch; p--) {
      const isBlackKey = [1, 3, 6, 8, 10].includes(p % 12);
      const y = (maxVisiblePitch - p) * zoomY;
      
      ctx.fillStyle = isBlackKey ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.03)';
      ctx.fillRect(0, y, width, zoomY);

      if (p % 12 === 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    // Draw vertical beat lines
    const startBeatFloor = Math.floor(startBeat);
    const endBeatFloor = Math.ceil(startBeat + width / pixelsPerBeat);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    for (let b = startBeatFloor; b <= endBeatFloor; b++) {
      const x = (b - startBeat) * pixelsPerBeat;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    ctx.stroke();

    ctx.restore();
  }
}
