import { AutomationPoint } from './types';

export function evaluateCurve(p1: AutomationPoint, p2: AutomationPoint, beat: number): number {
  if (beat <= p1.beat) return p1.value;
  if (beat >= p2.beat) return p2.value;

  const t = (beat - p1.beat) / (p2.beat - p1.beat);

  switch (p1.curve) {
    case 'hold': 
      return p1.value;
    case 'linear': 
      return p1.value + (p2.value - p1.value) * t;
    case 'exponential': 
      const p1ValExp = p1.value === 0 ? 0.0001 : p1.value;
      const p2ValExp = p2.value === 0 ? 0.0001 : p2.value;
      return p1ValExp * Math.pow(p2ValExp / p1ValExp, t);
    case 'logarithmic':
      return p1.value + (p2.value - p1.value) * Math.log10(1 + 9 * t);
    case 'bezier':
      const tension = p1.curveAmount || 0; // -1 to 1
      const easeT = tension > 0 
        ? Math.pow(t, 1 + tension * 2) 
        : Math.pow(t, 1 / (1 - tension * 2));
      return p1.value + (p2.value - p1.value) * easeT;
    default: 
      return p1.value;
  }
}
