/**
 * Curve Interpolation - Automation curve calculations
 * 
 * Supports:
 * - Linear interpolation
 * - Exponential interpolation
 * - Logarithmic interpolation
 * - Bezier curves
 * - Hold (step) interpolation
 * 
 * All functions work with normalized values (0-1 range)
 */

import { CurveType, AutomationPoint } from './types';

export type { CurveType };

// =============================================================================
// Main Interpolation Function
// =============================================================================

/**
 * Interpolate between two automation points at a given beat position
 * @param pointA - Starting point (must have beat <= targetBeat)
 * @param pointB - Ending point (must have beat > pointA.beat)
 * @param targetBeat - Position to interpolate at
 * @returns Interpolated value (0-1 range)
 */
export function interpolateAutomation(
  pointA: AutomationPoint,
  pointB: AutomationPoint,
  targetBeat: number
): number {
  // Handle edge cases
  if (targetBeat <= pointA.beat) return pointA.value;
  if (targetBeat >= pointB.beat) return pointB.value;
  if (pointB.beat === pointA.beat) return pointA.value;
  
  // Calculate progress (0-1)
  const duration = pointB.beat - pointA.beat;
  const progress = (targetBeat - pointA.beat) / duration;
  
  switch (pointA.curve) {
    case 'linear':
      return interpolateLinear(pointA.value, pointB.value, progress);
    
    case 'exponential':
      return interpolateExponential(pointA.value, pointB.value, progress);
    
    case 'logarithmic':
      return interpolateLogarithmic(pointA.value, pointB.value, progress);
    
    case 'bezier':
      return interpolateBezier(
        pointA.value,
        pointB.value,
        progress,
        pointA.curveAmount || 0
      );
    
    case 'sCurve':
      return interpolateSCurve(pointA.value, pointB.value, progress);
    
    case 'equalPower':
      return interpolateEqualPower(pointA.value, pointB.value, progress);
    
    case 'hold':
      return pointA.value; // Step change at pointB
    
    default:
      return interpolateLinear(pointA.value, pointB.value, progress);
  }
}

// =============================================================================
// Linear Interpolation
// =============================================================================

export function interpolateLinear(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

// =============================================================================
// Exponential Interpolation
// =============================================================================

/**
 * Exponential interpolation - smooth acceleration
 * Uses exponential function for curved transition
 */
export function interpolateExponential(start: number, end: number, t: number): number {
  // Avoid log(0) by clamping values
  const epsilon = 0.0001;
  const s = Math.max(start, epsilon);
  const e = Math.max(end, epsilon);
  
  // Logarithmic interpolation formula
  const logS = Math.log(s);
  const logE = Math.log(e);
  const logVal = logS + (logE - logS) * t;
  
  return Math.exp(logVal);
}

// =============================================================================
// Logarithmic Interpolation
// =============================================================================

/**
 * Logarithmic interpolation - decelerating curve
 * Useful for frequency, time-based parameters
 */
export function interpolateLogarithmic(start: number, end: number, t: number): number {
  // Use power function for logarithmic-like curve
  const curve = 3; // Steepness of log curve
  const curvedT = Math.pow(t, curve);
  return start + (end - start) * curvedT;
}

// =============================================================================
// Bezier Interpolation
// =============================================================================

/**
 * Cubic Bezier interpolation with one control point
 * @param controlOffset - Control point offset (-1 to 1, affects curve shape)
 */
export function interpolateBezier(
  start: number,
  end: number,
  t: number,
  controlOffset: number = 0
): number {
  // Calculate control point
  // controlOffset: -1 = undershoot, 0 = smooth, 1 = overshoot
  const mid = (start + end) / 2;
  const range = Math.abs(end - start);
  const control = mid + (controlOffset * range * 0.5);
  
  // Cubic Bezier formula
  const oneMinusT = 1 - t;
  
  // B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
  // Where P0 = start, P1 = control, P2 = end
  const val = 
    (oneMinusT * oneMinusT * start) +
    (2 * oneMinusT * t * control) +
    (t * t * end);
  
  return val;
}

/**
 * Cubic Bezier with two control points (more flexible)
 */
export function interpolateCubicBezier(
  p0: number,  // Start
  p1: number,  // Control 1
  p2: number,  // Control 2
  p3: number,  // End
  t: number
): number {
  const oneMinusT = 1 - t;
  
  // Cubic Bezier formula
  const val = 
    (oneMinusT * oneMinusT * oneMinusT * p0) +
    (3 * oneMinusT * oneMinusT * t * p1) +
    (3 * oneMinusT * t * t * p2) +
    (t * t * t * p3);
  
  return val;
}

// =============================================================================
// S-Curve Interpolation
// =============================================================================

/**
 * Smooth S-curve (sigmoid) interpolation
 * Great for natural-sounding parameter changes
 */
export function interpolateSCurve(start: number, end: number, t: number): number {
  // Smoothstep: 3t^2 - 2t^3
  const smoothT = t * t * (3 - 2 * t);
  return start + (end - start) * smoothT;
}

/**
 * Smootherstep: 6t^5 - 15t^4 + 10t^3
 * Even smoother transitions
 */
export function interpolateSmootherstep(start: number, end: number, t: number): number {
  const smoothT = t * t * t * (t * (t * 6 - 15) + 10);
  return start + (end - start) * smoothT;
}

// =============================================================================
// Ease Functions (for UI animations)
// =============================================================================

// =============================================================================
// Equal Power Interpolation
// =============================================================================

/**
 * Equal power interpolation - constant power crossfade
 * Useful for volume/pan transitions where perceived loudness stays constant
 * Based on sin/cos curves: sin^2 + cos^2 = 1
 */
export function interpolateEqualPower(start: number, end: number, t: number): number {
  const angle = t * Math.PI / 2;
  const cosVal = Math.cos(angle);
  const sinVal = Math.sin(angle);
  return start * cosVal * cosVal + end * sinVal * sinVal;
}

// =============================================================================
// Curve Amount Interpolation (for automation curve tool drag)
// =============================================================================

/**
 * Apply a curve amount to an interpolation between start and end values.
 * curveAmount: -1 to 1
 *  0 = linear
 *  1 = max upward curve (start stays low, jumps at end)
 * -1 = max downward curve (jumps at start, stays high)
 * Uses power basis for predictable shaping.
 */
export function interpolateWithAmount(start: number, end: number, t: number, amount: number): number {
  if (amount === 0) return interpolateLinear(start, end, t);
  const curve = amount > 0
    ? Math.pow(t, 1 + amount * 4)
    : Math.pow(t, 1 / (1 - amount * 4));
  return interpolateLinear(start, end, curve);
}

export const easeFunctions = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => 1 - (1 - t) * (1 - t),
  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
};

// =============================================================================
// Value Mapping
// =============================================================================

/**
 * Map normalized automation value to parameter range
 */
export function mapToParameterRange(
  normalizedValue: number,
  min: number,
  max: number,
  logarithmic: boolean = false
): number {
  // Clamp normalized value
  const t = Math.max(0, Math.min(1, normalizedValue));
  
  if (logarithmic) {
    // Logarithmic mapping (e.g., for frequency)
    const logMin = Math.log(Math.max(min, 0.001));
    const logMax = Math.log(Math.max(max, 0.001));
    const logVal = logMin + (logMax - logMin) * t;
    return Math.exp(logVal);
  }
  
  return min + (max - min) * t;
}

/**
 * Map parameter value to normalized automation value
 */
export function mapFromParameterRange(
  value: number,
  min: number,
  max: number,
  logarithmic: boolean = false
): number {
  if (max === min) return 0;
  
  if (logarithmic) {
    const logMin = Math.log(Math.max(min, 0.001));
    const logMax = Math.log(Math.max(max, 0.001));
    const logVal = Math.log(Math.max(value, 0.001));
    return (logVal - logMin) / (logMax - logMin);
  }
  
  return (value - min) / (max - min);
}

// =============================================================================
// Volume/Pan Mapping (dB to gain)
// =============================================================================

/**
 * Convert dB to linear gain
 */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Convert linear gain to dB
 */
export function gainToDb(gain: number): number {
  if (gain <= 0) return -Infinity;
  return 20 * Math.log10(gain);
}

/**
 * Map normalized automation value to volume in dB
 * Uses a curve where 0.5 = 0dB, 0 = -60dB, 1 = +12dB
 */
export function normalizedToVolumeDb(normalized: number): number {
  if (normalized <= 0) return -60;
  if (normalized >= 1) return 12;
  
  // Logarithmic volume curve
  // 0 -> -60dB, 0.5 -> 0dB, 1 -> 12dB
  if (normalized < 0.5) {
    // -60dB to 0dB
    const t = normalized * 2; // 0 to 1
    return -60 + (60 * t);
  } else {
    // 0dB to 12dB
    const t = (normalized - 0.5) * 2; // 0 to 1
    return 12 * t;
  }
}

/**
 * Map volume in dB to normalized automation value
 */
export function volumeDbToNormalized(db: number): number {
  if (db <= -60) return 0;
  if (db >= 12) return 1;
  
  if (db < 0) {
    // -60dB to 0dB -> 0 to 0.5
    return (db + 60) / 60 * 0.5;
  } else {
    // 0dB to 12dB -> 0.5 to 1
    return 0.5 + (db / 12) * 0.5;
  }
}

/**
 * Map normalized pan value to range -1..1
 */
export function normalizedToPan(normalized: number): number {
  return (normalized * 2) - 1;
}

/**
 * Map pan value -1..1 to normalized
 */
export function panToNormalized(pan: number): number {
  return (pan + 1) / 2;
}

// =============================================================================
// Point Finding
// =============================================================================

/**
 * Find the two points surrounding a given beat position
 * Returns null if before first point or after last point
 */
export function findSurroundingPoints(
  points: AutomationPoint[],
  targetBeat: number
): { prev: AutomationPoint | null; next: AutomationPoint | null } {
  if (points.length === 0) {
    return { prev: null, next: null };
  }
  
  // Points should be sorted by beat
  const sortedPoints = [...points].sort((a, b) => a.beat - b.beat);
  
  // Before first point
  if (targetBeat < sortedPoints[0].beat) {
    return { prev: null, next: sortedPoints[0] };
  }
  
  // After last point
  const lastPoint = sortedPoints[sortedPoints.length - 1];
  if (targetBeat >= lastPoint.beat) {
    return { prev: lastPoint, next: null };
  }
  
  // Find surrounding points
  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const current = sortedPoints[i];
    const next = sortedPoints[i + 1];
    
    if (targetBeat >= current.beat && targetBeat < next.beat) {
      return { prev: current, next };
    }
  }
  
  return { prev: null, next: null };
}

/**
 * Get automation value at a specific beat
 * Returns default value if no points or outside range
 */
export function getValueAtBeat(
  points: AutomationPoint[],
  targetBeat: number,
  defaultValue: number = 0
): number {
  const { prev, next } = findSurroundingPoints(points, targetBeat);
  
  if (!prev && !next) {
    return defaultValue;
  }
  
  if (!prev) {
    return next!.value;
  }
  
  if (!next) {
    return prev.value;
  }
  
  return interpolateAutomation(prev, next, targetBeat);
}

// =============================================================================
// Curve Generation
// =============================================================================

/**
 * Generate curve points for visualization
 * @param pointA - Starting point
 * @param pointB - Ending point  
 * @param numPoints - Number of points to generate
 * @returns Array of {beat, value} for drawing
 */
export function generateCurvePoints(
  pointA: AutomationPoint,
  pointB: AutomationPoint,
  numPoints: number = 50
): Array<{ beat: number; value: number }> {
  const points: Array<{ beat: number; value: number }> = [];
  const beatStep = (pointB.beat - pointA.beat) / (numPoints - 1);
  
  for (let i = 0; i < numPoints; i++) {
    const beat = pointA.beat + (beatStep * i);
    const value = interpolateAutomation(pointA, pointB, beat);
    points.push({ beat, value });
  }
  
  return points;
}

// =============================================================================
// Curve Type Utilities
// =============================================================================

export const curveTypeLabels: Record<CurveType, string> = {
  linear: 'Linear',
  exponential: 'Exponential',
  logarithmic: 'Logarithmic',
  bezier: 'Bezier',
  sCurve: 'S-Curve',
  equalPower: 'Equal Power',
  hold: 'Hold',
};

export const curveTypeDescriptions: Record<CurveType, string> = {
  linear: 'Constant rate of change',
  exponential: 'Accelerating curve',
  logarithmic: 'Decelerating curve',
  bezier: 'Smooth curve with control point',
  sCurve: 'Smooth sigmoid transition',
  equalPower: 'Constant power crossfade',
  hold: 'Step value (no interpolation)',
};

/**
 * Cycle through curve types
 */
export function nextCurveType(current: CurveType): CurveType {
  const types: CurveType[] = ['linear', 'exponential', 'logarithmic', 'bezier', 'sCurve', 'equalPower', 'hold'];
  const currentIndex = types.indexOf(current);
  return types[(currentIndex + 1) % types.length];
}
