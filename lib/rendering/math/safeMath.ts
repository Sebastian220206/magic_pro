export function safeMultiply(a: number, b: number, fallback = 0): number {
  const r = a * b;
  return Number.isFinite(r) ? r : fallback;
}

export function safeDivide(a: number, b: number, fallback = 0): number {
  if (b === 0 || !Number.isFinite(b)) return fallback;
  const r = a / b;
  return Number.isFinite(r) ? r : fallback;
}

export function safeLerp(a: number, b: number, t: number, fallback = 0): number {
  const r = a + (b - a) * t;
  return Number.isFinite(r) ? r : fallback;
}

export function clampFinite(value: number, min: number, max: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}
