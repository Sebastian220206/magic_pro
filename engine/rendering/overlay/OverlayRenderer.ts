import { ViewportState } from '../../navigation/types';

export interface RenderableOverlay {
  id: string;
  draw(ctx: CanvasRenderingContext2D, viewport: Readonly<ViewportState>): void;
}

export class OverlayRenderer {
  private overlays = new Map<string, RenderableOverlay>();

  public register(overlay: RenderableOverlay) {
    this.overlays.set(overlay.id, overlay);
  }

  public unregister(id: string) {
    this.overlays.delete(id);
  }

  /**
   * Called by the RendererScheduler during the "Interaction Overlay" phase.
   * This canvas sits strictly above all other editors.
   */
  public renderFrame(ctx: CanvasRenderingContext2D, viewport: Readonly<ViewportState>) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // In a high-performance system, we could sort by Z-index here
    for (const overlay of this.overlays.values()) {
      // Save/Restore isolates overlay transforms
      ctx.save();
      overlay.draw(ctx, viewport);
      ctx.restore();
    }
  }
}
