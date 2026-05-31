import { RendererContract } from '../contracts/RendererScheduler';
import { ViewportState } from '../../navigation/types';
import { BoundingBox, globalDirtyRegionManager } from './DirtyRegionManager';

export class DirtyRegionVisualizer implements RendererContract {
  public priority = 999;
  private heatmap = new Map<string, number>(); // Keyed by region coordinates

  public renderFull(ctx: CanvasRenderingContext2D, viewport: Readonly<ViewportState>): void {
    this.draw(ctx, viewport);
  }

  public renderRegion(ctx: CanvasRenderingContext2D, viewport: Readonly<ViewportState>, region: BoundingBox): void {
    this.draw(ctx, viewport);
  }

  private draw(ctx: CanvasRenderingContext2D, viewport: Readonly<ViewportState>): void {
    const isFull = globalDirtyRegionManager.isFullFrame();
    const rects = globalDirtyRegionManager.getRegions();

    if (isFull) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.05)';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.fillStyle = 'white';
      ctx.font = '12px monospace';
      ctx.fillText(`FULL FRAME INVALIDATION`, 10, 20);
      return;
    }

    if (rects.length === 0) return;

    ctx.save();
    
    for (const rect of rects) {
      const key = `${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(rect.width)},${Math.round(rect.height)}`;
      const heat = (this.heatmap.get(key) || 0) + 1;
      this.heatmap.set(key, heat);

      // Fade older heatmap data occasionally
      if (Math.random() < 0.05) this.heatmap.clear();

      // Intensity scales with heat (overdraw detection)
      const alpha = Math.min(0.8, 0.1 + (heat * 0.05));
      ctx.fillStyle = `rgba(255, 50, 50, ${alpha})`;
      ctx.strokeStyle = `rgba(255, 0, 0, ${Math.min(1, alpha + 0.3)})`;
      ctx.lineWidth = 1;

      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

      ctx.fillStyle = 'white';
      ctx.font = '9px monospace';
      ctx.fillText(`${rect.source} [${heat}]`, rect.x + 2, rect.y + 10);
    }

    ctx.restore();
  }
}

export const globalDirtyVisualizer = new DirtyRegionVisualizer();
