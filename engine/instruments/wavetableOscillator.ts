/**
 * Wavetable Oscillator
 * Uses Web Audio API's PeriodicWave for custom wavetable synthesis.
 */

export interface WavetableData {
  name: string;
  real: Float32Array;  // cosine coefficients (real part)
  imag: Float32Array; // sine coefficients (imaginary part)
}

/**
 * Generate wavetable from harmonic amplitudes and phases.
 *
 * @param harmonics - Array of {amplitude, phase} for each harmonic (index 0 = DC, 1 = fundamental, etc.)
 * @returns WavetableData with real/imaginary coefficient arrays
 */
export function generateWavetable(
  harmonics: { amplitude: number; phase: number }[],
  length: number = 2048
): WavetableData {
  const real = new Float32Array(length);
  const imag = new Float32Array(length);

  for (let n = 0; n < harmonics.length && n < length; n++) {
    const { amplitude, phase } = harmonics[n];
    real[n] = amplitude * Math.cos(phase);
    imag[n] = amplitude * Math.sin(phase);
  }

  return { name: 'custom', real, imag };
}

/**
 * Create a sawtooth wavetable (all harmonics, alternating signs).
 */
export function sawtoothWavetable(harmonics: number = 32): WavetableData {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);

  for (let n = 1; n <= harmonics; n++) {
    imag[n] = (n % 2 === 0 ? 1 : -1) * (2 / (n * Math.PI));
  }

  return { name: 'sawtooth', real, imag };
}

/**
 * Create a square wavetable (odd harmonics only).
 */
export function squareWavetable(harmonics: number = 32): WavetableData {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);

  for (let n = 1; n <= harmonics; n++) {
    if (n % 2 === 1) {
      imag[n] = 4 / (n * Math.PI);
    }
  }

  return { name: 'square', real, imag };
}

/**
 * Create a triangle wavetable.
 */
export function triangleWavetable(harmonics: number = 32): WavetableData {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);

  for (let n = 1; n <= harmonics; n++) {
    if (n % 2 === 1) {
      imag[n] = (8 * Math.sin(n * Math.PI / 2)) / (n * n * Math.PI * Math.PI);
    }
  }

  return { name: 'triangle', real, imag };
}

/**
 * Create a "rich" wavetable with emphasized upper harmonics.
 */
export function richWavetable(harmonics: number = 32): WavetableData {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);

  for (let n = 1; n <= harmonics; n++) {
    const rolloff = 1.0 / Math.sqrt(n);
    imag[n] = rolloff * (n % 2 === 0 ? 0.5 : -0.7);
  }

  return { name: 'rich', real, imag };
}

/**
 * Create a "gritty" wavetable with aliasing-like artifacts.
 */
export function grittyWavetable(harmonics: number = 32): WavetableData {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);

  for (let n = 1; n <= harmonics; n++) {
    const noise = Math.sin(n * 7.3) * 0.3;
    imag[n] = (1.0 / n) * (n % 2 === 0 ? 0.6 : -0.8) + noise;
  }

  return { name: 'gritty', real, imag };
}

/**
 * Create a "smooth" wavetable with gentle rolloff.
 */
export function smoothWavetable(harmonics: number = 32): WavetableData {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);

  for (let n = 1; n <= harmonics; n++) {
    const rolloff = Math.exp(-n * 0.15);
    imag[n] = rolloff * (n % 2 === 0 ? 0.3 : -0.5);
  }

  return { name: 'smooth', real, imag };
}

/**
 * Create a PeriodicWave from WavetableData.
 * This is what Web Audio API uses for custom oscillator waveforms.
 */
export function createPeriodicWave(
  ctx: AudioContext,
  wavetable: WavetableData,
  disableNormalization: boolean = false
): PeriodicWave {
  return ctx.createPeriodicWave(
    wavetable.real,
    wavetable.imag,
    { disableNormalization }
  );
}

/**
 * Built-in wavetable presets.
 */
export const wavetablePresets: Record<string, WavetableData> = {
  sawtooth: sawtoothWavetable(32),
  square: squareWavetable(32),
  triangle: triangleWavetable(32),
  rich: richWavetable(32),
  gritty: grittyWavetable(32),
  smooth: smoothWavetable(32),
};

/**
 * Create an OscillatorNode with a wavetable loaded.
 */
export function createWavetableOscillator(
  ctx: AudioContext,
  wavetable: WavetableData,
  frequency: number = 440,
  detune: number = 0
): OscillatorNode {
  const osc = ctx.createOscillator();
  const wave = createPeriodicWave(ctx, wavetable);
  osc.setPeriodicWave(wave);
  osc.frequency.value = frequency;
  osc.detune.value = detune;
  return osc;
}
