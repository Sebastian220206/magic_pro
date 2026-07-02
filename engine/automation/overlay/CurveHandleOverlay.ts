import { RenderableOverlay } from '../../rendering/overlay/OverlayRenderer';
import { ViewportState } from '../../navigation/types';

export class CurveHandleOverlay implements RenderableOverlay {
  public id = 'SYS_CURVE_HANDLE_OVERLAY';
  
  private activeHandle: { x: number, y: number } | null = null;

  public updateHandle(x: number, y: number) {
    this.activeHandle = { x, y };
  }

  public clearHandle() {
    this.activeHandle = null;
  }

  public draw(ctx: CanvasRenderingContext2D, viewport: Readonly<ViewportState>): void {
    if (!this.activeHandle) return;

    ctx.save();
    ctx.beginPath();
    ctx.arc(this.activeHandle.x, this.activeHandle.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#06B6D4'; // Cyan
    ctx.shadowColor = '#06B6D4';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
  }
}
