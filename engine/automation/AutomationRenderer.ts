import { AutomationLane, AutomationPoint } from './types';
import { AutomationIndex } from './indexing/AutomationIndex';
import { evaluateCurve } from './AutomationInterpolation';

export interface Viewport {
  startBeat: number;
  endBeat: number;
  beatToX: (beat: number) => number;
  valueToY: (value: number) => number;
  width: number;
  height: number;
}

export interface AutomationRendererOptions {
  laneColor?: string;
  lineWidth?: number;
  pointRadius?: number;
  fillOpacity?: number;
}

export class AutomationRenderer {
  public static render(
    ctx: CanvasRenderingContext2D,
    lane: AutomationLane,
    viewport: Viewport,
    options: AutomationRendererOptions = {}
  ) {
    if (!lane.visible || lane.points.length === 0) return;

    const color = options.laneColor || lane.color || '#06B6D4';
    const lineWidth = options.lineWidth || 2;
    const pointRadius = options.pointRadius || 4;
    const fillOpacity = options.fillOpacity || 0.15;

    // 1. O(log n) viewport culling
    const index = new AutomationIndex(lane.points);
    const [entryFloor] = index.findSegmentAtTime(viewport.startBeat);
    const [, exitCeil] = index.findSegmentAtTime(viewport.endBeat);

    const startIndex = entryFloor ? lane.points.indexOf(entryFloor) : 0;
    const endIndex = exitCeil ? lane.points.indexOf(exitCeil) : lane.points.length - 1;

    if (startIndex === -1 || endIndex === -1) return;

    // Setup Canvas
    ctx.save();
    
    // 2. Draw Fill beneath the curve
    ctx.beginPath();
    const bottomY = viewport.valueToY(0); // Assuming 0 is the bottom

    // Move to start bottom
    ctx.moveTo(viewport.beatToX(lane.points[startIndex].beat), bottomY);

    for (let i = startIndex; i <= endIndex; i++) {
      const p = lane.points[i];
      const x = viewport.beatToX(p.beat);
      const y = viewport.valueToY(p.value);

      if (i === startIndex) {
        ctx.lineTo(x, y);
      } else {
        AutomationRenderer.drawSegment(ctx, lane.points[i - 1], p, viewport);
      }
    }
    
    // Close fill
    const lastPointX = viewport.beatToX(lane.points[endIndex].beat);
    ctx.lineTo(lastPointX, bottomY);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = fillOpacity;
    ctx.fill();

    // 3. Draw Stroke (The actual automation line)
    ctx.globalAlpha = 1.0;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (let i = startIndex; i <= endIndex; i++) {
      const p = lane.points[i];
      const x = viewport.beatToX(p.beat);
      const y = viewport.valueToY(p.value);

      if (i === startIndex) {
        ctx.moveTo(x, y);
      } else {
        AutomationRenderer.drawSegment(ctx, lane.points[i - 1], p, viewport);
      }
    }
    ctx.stroke();

    // 4. Draw Points (Interactive handles)
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;

    for (let i = startIndex; i <= endIndex; i++) {
      const p = lane.points[i];
      const x = viewport.beatToX(p.beat);
      const y = viewport.valueToY(p.value);
      
      // Only draw point if it is visible within viewport horizontally
      if (p.beat >= viewport.startBeat && p.beat <= viewport.endBeat) {
        ctx.beginPath();
        ctx.arc(x, y, pointRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private static drawSegment(
    ctx: CanvasRenderingContext2D,
    p1: AutomationPoint,
    p2: AutomationPoint,
    viewport: Viewport
  ) {
    const x2 = viewport.beatToX(p2.beat);
    const y2 = viewport.valueToY(p2.value);

    if (p1.curve === 'hold') {
      // Stepped logic
      ctx.lineTo(x2, viewport.valueToY(p1.value));
      ctx.lineTo(x2, y2);
    } else if (p1.curve === 'linear') {
      ctx.lineTo(x2, y2);
    } else {
      // High-res stepping for complex curves like bezier/exponential
      // To keep UI perfectly matching DSP, we use the exact same interpolation engine
      const pixelsPerBeat = viewport.width / (viewport.endBeat - viewport.startBeat);
      const beatDelta = p2.beat - p1.beat;
      const pixelWidth = beatDelta * pixelsPerBeat;
      
      // Detail level: 1 evaluation per 2 pixels
      const numSteps = Math.max(2, Math.floor(pixelWidth / 2));
      const stepBeat = beatDelta / numSteps;

      for (let s = 1; s <= numSteps; s++) {
        const beat = p1.beat + (s * stepBeat);
        const val = evaluateCurve(p1, p2, beat);
        ctx.lineTo(viewport.beatToX(beat), viewport.valueToY(val));
      }
    }
  }
}
