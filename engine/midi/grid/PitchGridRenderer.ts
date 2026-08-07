import { RendererContract } from '../../rendering/contracts/RendererScheduler';
import { ViewportState } from '../../navigation/types';
import { BoundingBox } from '../../rendering/invalidation/DirtyRegionManager';

export class PitchGridRenderer implements RendererContract {
  public priority = 10;
  /** Grid division value (4 = 1/4 note, 8 = 1/8 note, 16 = 1/16, 32 = 1/32) */
  public gridDivision: number = 4;
  /** Beats per bar from time signature */
  public beatsPerBar: number = 4;

  constructor(private ctx: CanvasRenderingContext2D) {}

  public renderFull(ctx: CanvasRenderingContext2D, viewport: Readonly<ViewportState>) {
    this.drawGrid(ctx, viewport);
  }

  public renderRegion(ctx: CanvasRenderingContext2D, viewport: Readonly<ViewportState>, region: BoundingBox) {
    this.drawGrid(ctx, viewport); // Grid logic usually draws exactly inside clip region naturally
  }

  private drawGrid(ctx: CanvasRenderingContext2D, viewport: Readonly<ViewportState>) {
    const { startBeat, pixelsPerBeat, maxVisiblePitch, pixelsPerPitch } = viewport;
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    const minPitch = Math.max(0, Math.floor(maxVisiblePitch - height / pixelsPerPitch));
    const startPitch = Math.min(127, Math.ceil(maxVisiblePitch));

    ctx.save();
    
    // Draw horizontal pitch rows
    for (let p = startPitch; p >= minPitch; p--) {
      const isBlackKey = [1, 3, 6, 8, 10].includes(p % 12);
      const isRoot = p % 12 === 0;
      const y = (maxVisiblePitch - p) * pixelsPerPitch;
      
      // Base background color
      ctx.fillStyle = isBlackKey ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.02)';
      ctx.fillRect(0, y, width, pixelsPerPitch);

      // Root note highlight
      if (isRoot) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.fillRect(0, y, width, pixelsPerPitch);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        
        // Bottom border of the root note
        ctx.beginPath();
        ctx.moveTo(0, y + pixelsPerPitch);
        ctx.lineTo(width, y + pixelsPerPitch);
        ctx.stroke();
      } else {
        // Standard note separation line
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y + pixelsPerPitch);
        ctx.lineTo(width, y + pixelsPerPitch);
        ctx.stroke();
      }
    }

    // Draw vertical beat lines using gridDivision
    // gridDivision: 4 = quarter note (1 beat), 8 = eighth (0.5 beat), 16 = sixteenth (0.25), 32 = thirty-second (0.125)
    const subdivStep = 4 / this.gridDivision; // e.g. 4/8 = 0.5, 4/16 = 0.25, 4/32 = 0.125
    const bpb = this.beatsPerBar;

    const visibleBeats = width / pixelsPerBeat;
    const startB = Math.floor(startBeat / subdivStep) * subdivStep;
    const endB = Math.ceil(startBeat + visibleBeats);

    // Only draw subdivisions if they would be at least 4px apart
    const subdivPixels = subdivStep * pixelsPerBeat;
    const drawSubdivisions = subdivPixels >= 4;
    
    for (let b = startB; b <= endB; b += (drawSubdivisions ? subdivStep : 1)) {
      const isBar = Math.abs(b % bpb) < 0.001 || Math.abs(b % bpb - bpb) < 0.001;
      const isBeat = Math.abs(b % 1) < 0.001;
      
      if (isBar) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1.5;
      } else if (isBeat) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 0.5;
      }

      const x = Math.round((b - startBeat) * pixelsPerBeat);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    ctx.restore();
  }
}
