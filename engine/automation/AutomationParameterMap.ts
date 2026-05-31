export type MappingFunction = (normalized: number) => number;
export type FormattingFunction = (normalized: number) => string;

// Maps normalized [0, 1] to runtime DSP values
export const ParameterMappings: Record<string, MappingFunction> = {
  volume: (val) => {
    // [0, 1] -> [-60dB, +12dB] -> amplitude
    const db = -60 + (val * 72);
    return db <= -60 ? 0 : Math.pow(10, db / 20);
  },
  pan: (val) => (val * 2) - 1, // [0, 1] -> [-1, 1]
  frequency: (val) => {
    // Logarithmic scale [20Hz, 20kHz]
    return 20 * Math.pow(1000, val);
  },
  default: (val) => val // fallback
};

export const ParameterFormatters: Record<string, FormattingFunction> = {
  volume: (val) => {
    const db = -60 + (val * 72);
    return db <= -60 ? "-∞ dB" : `${db.toFixed(1)} dB`;
  },
  pan: (val) => {
    const pan = (val * 2) - 1;
    if (pan === 0) return "C";
    return pan < 0 ? `${Math.round(-pan * 100)}% L` : `${Math.round(pan * 100)}% R`;
  },
  frequency: (val) => {
    const freq = 20 * Math.pow(1000, val);
    return freq >= 1000 ? `${(freq / 1000).toFixed(2)} kHz` : `${Math.round(freq)} Hz`;
  },
  default: (val) => val.toFixed(2)
};

export function getParameterMapping(parameterId: string): MappingFunction {
  // Parse parameter path
  if (parameterId.endsWith('.volume') || parameterId === 'volume') return ParameterMappings.volume;
  if (parameterId.endsWith('.pan') || parameterId === 'pan') return ParameterMappings.pan;
  if (parameterId.endsWith('.cutoff') || parameterId.endsWith('.frequency')) return ParameterMappings.frequency;
  return ParameterMappings.default;
}

export function getParameterFormatter(parameterId: string): FormattingFunction {
  if (parameterId.endsWith('.volume') || parameterId === 'volume') return ParameterFormatters.volume;
  if (parameterId.endsWith('.pan') || parameterId === 'pan') return ParameterFormatters.pan;
  if (parameterId.endsWith('.cutoff') || parameterId.endsWith('.frequency')) return ParameterFormatters.frequency;
  return ParameterFormatters.default;
}
