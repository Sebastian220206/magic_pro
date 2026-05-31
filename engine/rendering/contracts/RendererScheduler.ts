import { ViewportState } from '../../navigation/types';
import { BoundingBox, globalDirtyRegionManager } from '../invalidation/DirtyRegionManager';
import { globalProfiler } from '../profiler/FrameProfiler';

export interface RendererContract {
  priority: number;
  /**
   * Called when the entire viewport requires redraw (e.g. pan/zoom)
   */
  renderFull(ctx: CanvasRenderingContext2D, viewport: Readonly<ViewportState>): void;
  
  /**
   * Called when only specific regions need redraw.
   * Renderers MUST strictly clip their drawing to this region.
   */
  renderRegion(ctx: CanvasRenderingContext2D, viewport: Readonly<ViewportState>, region: BoundingBox): void;
}

export class RendererScheduler {
  private renderers: RendererContract[] = [];

  constructor(private dirtyManager: typeof globalDirtyRegionManager = globalDirtyRegionManager) {}

  public register(renderer: RendererContract) {
    this.renderers.push(renderer);
    this.renderers.sort((a, b) => a.priority - b.priority);
  }

  public executeFrame(ctx: CanvasRenderingContext2D, viewport: Readonly<ViewportState>) {
    const frameStart = performance.now();
    const isFullFrame = this.dirtyManager.isFullFrame();
    const regions = this.dirtyManager.getRegions();

    if (!isFullFrame && regions.length === 0) {
      return; // Nothing to draw
    }

    if (isFullFrame) {
      // 1. FULL FRAME REDRAW
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      
      for (const renderer of this.renderers) {
        if (performance.now() - frameStart > 16.6 && renderer.priority >= 40) {
          globalProfiler.increment('droppedFrames');
          break; // Frame Budget Exceeded! Drop cosmetic layers
        }
        ctx.save();
        renderer.renderFull(ctx, viewport);
        ctx.restore();
      }
    } else {
      // 2. PARTIAL REGION REDRAW
      // We optimize by merging regions if there are too many small ones
      const merged = regions.length > 5 ? this.dirtyManager.getMergedRegion() : null;
      const targetRegions = merged ? [merged] : regions;

      for (const region of targetRegions) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(region.x, region.y, region.width, region.height);
        ctx.clip();
        ctx.clearRect(region.x, region.y, region.width, region.height);

        for (const renderer of this.renderers) {
          if (performance.now() - frameStart > 16.6 && renderer.priority >= 40) {
             break; // Drop cosmetics if late
          }
          ctx.save();
          renderer.renderRegion(ctx, viewport, region);
          ctx.restore();
        }
        ctx.restore();
      }
    }

    // Diagnostics overlay always runs last, ignoring clip bounds
    if (this.debugRenderer) {
      this.debugRenderer.renderFull(ctx, viewport);
    }
  }

  private debugRenderer?: RendererContract;
  public setDebugRenderer(r: RendererContract) {
    this.debugRenderer = r;
  }
}

export const globalRendererScheduler = new RendererScheduler();
