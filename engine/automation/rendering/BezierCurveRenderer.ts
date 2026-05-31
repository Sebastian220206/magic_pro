import { AutomationPoint } from '../../../models/AutomationPoint';

export class BezierCurveRenderer {
  
  public static drawCurve(
    ctx: CanvasRenderingContext2D,
    p1: AutomationPoint,
    p2: AutomationPoint,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ) {
    if (p1.curveType === 'stepped') {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      return;
    }

    if (p1.curveType === 'linear') {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      return;
    }

    // Exponential / Bezier mapping
    const tension = p1.curveTension ?? 0.5; // 0 to 1

    // Map tension (-1 to +1) logically to bezier control points
    // A standard smooth curve
    const cp1x = x1 + ((x2 - x1) * 0.5);
    const cp2x = x2 - ((x2 - x1) * 0.5);

    // Apply tension to Y to pull the curve exponentially
    // For simplicity, a standard cubic bezier
    const cp1y = y1 + ((y2 - y1) * (1 - tension) * 0.5);
    const cp2y = y2 - ((y2 - y1) * tension * 0.5);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(
      cp1x,
      cp1y,
      cp2x,
      cp2y,
      x2,
      y2
    );
    ctx.stroke();
  }
}
