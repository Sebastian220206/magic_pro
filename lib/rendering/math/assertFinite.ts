export function assertFinite(value: number, label: string): asserts value is number {
  if (!Number.isFinite(value)) {
    throw new Error(`[RenderInvariant] ${label} is non-finite: ${value}`);
  }
}

export function assertAllFinite(values: [number, string][]): void {
  for (const [v, label] of values) {
    if (!Number.isFinite(v)) {
      throw new Error(`[RenderInvariant] ${label} is non-finite: ${v}`);
    }
  }
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
