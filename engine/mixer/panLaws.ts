/**
 * Pan Laws - Different panning algorithms for stereo mixing
 *
 * Pan laws determine how signal amplitude changes when panning between left and right.
 * Different DAWs use different pan laws, and engineers may prefer different behaviors.
 *
 * Common Pan Laws:
 * - -3dB (Unity Gain): Most common, maintains constant power across pan range
 * - -4.5dB (Equal Power): Used by some mastering engineers
 * - Linear: Simple linear interpolation (not constant power)
 * - Equal Power (Sin/Cos): True constant power panning
 * - Balanced: Custom curve balancing stereo image
 */

// =============================================================================
// Pan Law Types
// =============================================================================

export type PanLawType =
  | 'linear'          // Simple linear interpolation
  | '-3db'            // -3dB center attenuation (most common)
  | '-4.5db'          // -4.5dB center attenuation
  | '-6db'            // -6dB center attenuation
  | 'equal-power'     // Equal power (sin/cos)
  | 'balanced'        // Custom balanced curve
  | 'custom';         // User-defined curve

export interface PanLaw {
  type: PanLawType;
  name: string;
  description: string;
  centerAttenuation: number;  // dB attenuation at center
  curve: (pan: number) => PanGain;  // Pan function (-1 to 1) → gain
}

export interface PanGain {
  left: number;    // 0-1
  right: number;   // 0-1
}

// =============================================================================
// Pan Law Implementations
// =============================================================================

function linearPan(pan: number): PanGain {
  // pan: -1 (full left) to 1 (full right)
  const normalized = (pan + 1) / 2; // 0 to 1
  return {
    left: 1 - normalized,
    right: normalized,
  };
}

function minus3dbPan(pan: number): PanGain {
  // -3dB at center, constant power
  const normalized = (pan + 1) / 2; // 0 to 1
  const angle = normalized * Math.PI / 2;
  return {
    left: Math.cos(angle),
    right: Math.sin(angle),
  };
}

function minus4point5dbPan(pan: number): PanGain {
  // -4.5dB at center
  const normalized = (pan + 1) / 2;
  const angle = normalized * Math.PI / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // Apply -4.5dB at center
  const centerScale = Math.pow(10, -4.5 / 20);
  const scale = 1 + (1 - centerScale) * Math.sin(Math.PI * normalized);
  return {
    left: cos * scale,
    right: sin * scale,
  };
}

function minus6dbPan(pan: number): PanGain {
  // -6dB at center
  const normalized = (pan + 1) / 2;
  const angle = normalized * Math.PI / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // Apply -6dB at center
  const centerScale = Math.pow(10, -6 / 20);
  const scale = 1 + (1 - centerScale) * Math.sin(Math.PI * normalized);
  return {
    left: cos * scale,
    right: sin * scale,
  };
}

function equalPowerPan(pan: number): PanGain {
  // True equal power (sin/cos)
  const normalized = (pan + 1) / 2;
  const angle = normalized * Math.PI / 2;
  return {
    left: Math.cos(angle),
    right: Math.sin(angle),
  };
}

function balancedPan(pan: number): PanGain {
  // Custom balanced curve
  const normalized = (pan + 1) / 2;
  const angle = normalized * Math.PI / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // Slight boost at extremes for wider stereo image
  const boost = Math.pow(Math.abs(pan), 0.8);
  return {
    left: cos * (1 + boost * 0.1),
    right: sin * (1 + boost * 0.1),
  };
}

// =============================================================================
// Pan Law Presets
// =============================================================================

export const PAN_LAW_PRESETS: Record<PanLawType, PanLaw> = {
  'linear': {
    type: 'linear',
    name: 'Linear',
    description: 'Simple linear interpolation (not constant power)',
    centerAttenuation: 0,
    curve: linearPan,
  },
  '-3db': {
    type: '-3db',
    name: '-3dB (Unity Gain)',
    description: 'Standard pan law, maintains constant power. Most common in DAWs.',
    centerAttenuation: -3,
    curve: minus3dbPan,
  },
  '-4.5db': {
    type: '-4.5db',
    name: '-4.5dB',
    description: 'Used by some mastering engineers for tighter center image.',
    centerAttenuation: -4.5,
    curve: minus4point5dbPan,
  },
  '-6db': {
    type: '-6db',
    name: '-6dB',
    description: 'Deeper center attenuation for very focused center image.',
    centerAttenuation: -6,
    curve: minus6dbPan,
  },
  'equal-power': {
    type: 'equal-power',
    name: 'Equal Power',
    description: 'True constant power panning using sin/cos curves.',
    centerAttenuation: -3,
    curve: equalPowerPan,
  },
  'balanced': {
    type: 'balanced',
    name: 'Balanced',
    description: 'Custom curve with slight boost at extremes for wider stereo image.',
    centerAttenuation: -2,
    curve: balancedPan,
  },
  'custom': {
    type: 'custom',
    name: 'Custom',
    description: 'User-defined pan law curve.',
    centerAttenuation: 0,
    curve: linearPan,
  },
};

// =============================================================================
// Pan Law Helper Functions
// =============================================================================

export function calculatePanGain(pan: number, lawType: PanLawType = '-3db'): PanGain {
  const law = PAN_LAW_PRESETS[lawType];
  const clampedPan = Math.max(-1, Math.min(1, pan));
  return law.curve(clampedPan);
}

export function calculatePanGainDb(pan: number, lawType: PanLawType = '-3db'): { leftDb: number; rightDb: number } {
  const gain = calculatePanGain(pan, lawType);
  return {
    leftDb: gain.left > 0.0001 ? 20 * Math.log10(gain.left) : -Infinity,
    rightDb: gain.right > 0.0001 ? 20 * Math.log10(gain.right) : -Infinity,
  };
}

export function getPanLawInfo(lawType: PanLawType): PanLaw {
  return PAN_LAW_PRESETS[lawType];
}

export function getAvailablePanLaws(): PanLawType[] {
  return Object.keys(PAN_LAW_PRESETS) as PanLawType[];
}

// =============================================================================
// Stereo Balance vs Pan
// =============================================================================

/**
 * Calculate stereo balance (different from pan)
 * Balance shifts the center without changing the stereo width
 */
export function calculateBalanceGain(balance: number): PanGain {
  const normalized = (balance + 1) / 2; // 0 to 1
  return {
    left: 1 - (normalized * 0.5),
    right: 0.5 + (normalized * 0.5),
  };
}

/**
 * Calculate pan with stereo width control
 */
export function calculatePanWithWidth(
  pan: number,
  width: number,
  lawType: PanLawType = '-3db'
): { left: PanGain; right: PanGain } {
  const centerPan = calculatePanGain(pan, lawType);

  // Width adjusts the spread
  // width = 0: mono (center only)
  // width = 1: normal stereo
  // width > 1: extra wide
  const halfWidth = width / 2;

  return {
    left: {
      left: centerPan.left * (1 - halfWidth),
      right: centerPan.right * (1 - halfWidth),
    },
    right: {
      left: centerPan.left * halfWidth,
      right: centerPan.right * halfWidth,
    },
  };
}

/**
 * Calculate mid/side from pan
 */
export function calculateMidSideGain(pan: number): { mid: number; side: number } {
  const normalized = (pan + 1) / 2;
  const angle = normalized * Math.PI / 2;
  return {
    mid: Math.cos(angle),
    side: Math.sin(angle),
  };
}

/**
 * Convert mid/side back to pan
 */
export function midSideToPan(mid: number, side: number): number {
  const angle = Math.atan2(side, mid);
  return (angle / (Math.PI / 2)) * 2 - 1;
}

// =============================================================================
// Pan Law Comparison
// =============================================================================

export interface PanLawComparison {
  panValue: number;
  gains: Record<PanLawType, PanGain>;
}

export function comparePanLaws(panValue: number): PanLawComparison {
  const gains: Record<PanLawType, PanGain> = {} as Record<PanLawType, PanGain>;

  for (const lawType of Object.keys(PAN_LAW_PRESETS) as PanLawType[]) {
    gains[lawType] = calculatePanGain(panValue, lawType);
  }

  return {
    panValue,
    gains,
  };
}

export function generatePanLawCurve(lawType: PanLawType, steps: number = 100): Array<{ pan: number; left: number; right: number }> {
  const curve: Array<{ pan: number; left: number; right: number }> = [];

  for (let i = 0; i <= steps; i++) {
    const pan = -1 + (2 * i / steps);
    const gain = calculatePanGain(pan, lawType);
    curve.push({ pan, left: gain.left, right: gain.right });
  }

  return curve;
}

export default PAN_LAW_PRESETS;
