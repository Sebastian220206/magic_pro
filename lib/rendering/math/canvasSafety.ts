export function isFiniteRect(x: number, y: number, w: number, h: number): boolean {
  return [x, y, w, h].every(Number.isFinite) && w > 0 && h > 0;
}

export function safeCreateLinearGradient(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number
): CanvasGradient | null {
  if (![x0, y0, x1, y1].every(Number.isFinite)) return null;
  try {
    return ctx.createLinearGradient(x0, y0, x1, y1);
  } catch {
    return null;
  }
}

export function safeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  ctx.fillText(text, x, y);
}

export function safeMoveTo(ctx: CanvasRenderingContext2D, x: number, y: number) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  ctx.moveTo(x, y);
}

export function safeLineTo(ctx: CanvasRenderingContext2D, x: number, y: number) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  ctx.lineTo(x, y);
}

export function safeArcTo(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, r: number) {
  if (![x1, y1, x2, y2, r].every(Number.isFinite)) return;
  ctx.arcTo(x1, y1, x2, y2, r);
}
