import { AutomationPoint } from './types';
import { interpolateSCurve, interpolateEqualPower, interpolateWithAmount } from './curves';

export function evaluateCurve(p1: AutomationPoint, p2: AutomationPoint, beat: number): number {
  if (beat <= p1.beat) return p1.value;
  if (beat >= p2.beat) return p2.value;

  const t = (beat - p1.beat) / (p2.beat - p1.beat);
  return evaluateCurveAtT(p1, p2, t);
}

export function evaluateCurveAtT(p1: AutomationPoint, p2: AutomationPoint, t: number): number {
  const start = p1.value;
  const end = p2.value;
  const amount = p1.curveAmount ?? 0;

  switch (p1.curve) {
    case 'hold':
      return start;
    case 'linear':
      return interpolateWithAmount(start, end, t, amount);
    case 'exponential': {
      const p1Val = start === 0 ? 0.0001 : start;
      const p2Val = end === 0 ? 0.0001 : end;
      const linearExp = p1Val * Math.pow(p2Val / p1Val, t);
      if (amount === 0) return linearExp;
      return start + (linearExp - start) * (1 + amount);
    }
    case 'logarithmic':
      return start + (end - start) * Math.log10(1 + 9 * t);
    case 'bezier': {
      const tension = amount;
      const easeT = tension > 0
        ? Math.pow(t, 1 + tension * 2)
        : Math.pow(t, 1 / (1 - tension * 2));
      return start + (end - start) * easeT;
    }
    case 'sCurve':
      return interpolateSCurve(start, end, t);
    case 'equalPower':
      return interpolateEqualPower(start, end, t);
    default:
      return interpolateWithAmount(start, end, t, amount);
  }
}
