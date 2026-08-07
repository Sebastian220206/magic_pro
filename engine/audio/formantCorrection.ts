/**
 * Formant Correction - LPC-based formant preservation during pitch shifting
 *
 * Features:
 * - Linear Predictive Coding (LPC) analysis
 * - Formant detection and tracking
 * - Spectral envelope preservation
 * - Formant-corrected pitch shifting
 * - Real-time formant manipulation
 *
 * Based on:
 * - LPC for spectral envelope estimation
 * - Formant peak detection
 * - Spectral tilt correction
 */

export interface FormantCorrectionOptions {
  /** LPC order (higher = more detailed, default: 16) */
  lpcOrder: number;
  /** Analysis window size */
  windowSize: number;
  /** Hop size */
  hopSize: number;
  /** Formant frequency range (Hz) */
  formantRange: [number, number];
  /** Smoothing factor for formant tracking */
  smoothing: number;
}

export interface FormantData {
  /** Formant frequencies (Hz) */
  frequencies: number[];
  /** Formant bandwidths */
  bandwidths: number[];
  /** Formant amplitudes */
  amplitudes: number[];
  /** Spectral envelope */
  spectralEnvelope: Float32Array;
}

const DEFAULT_OPTIONS: FormantCorrectionOptions = {
  lpcOrder: 16,
  windowSize: 2048,
  hopSize: 512,
  formantRange: [200, 8000],
  smoothing: 0.8,
};

export class FormantCorrection {
  private options: FormantCorrectionOptions;
  private prevFormants: FormantData | null = null;

  constructor(options: Partial<FormantCorrectionOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Analyze formants in audio frame
   */
  analyzeFormants(frame: Float32Array): FormantData {
    // Pre-emphasis filter
    const preEmphasized = this.preEmphasis(frame);

    // Windowing
    const windowed = this.applyWindow(preEmphasized);

    // LPC analysis
    const lpcCoeffs = this.lpcAnalysis(windowed);

    // Compute frequency response
    const spectrum = this.computeSpectrum(lpcCoeffs, this.options.windowSize);

    // Find formant peaks
    const formants = this.findFormantPeaks(spectrum);

    // Smooth formants
    const smoothed = this.smoothFormants(formants);

    this.prevFormants = smoothed;
    return smoothed;
  }

  /**
   * Apply formant correction to pitch-shifted audio
   */
  correctFormants(
    original: Float32Array,
    shifted: Float32Array,
    pitchRatio: number,
    sampleRate: number
  ): Float32Array {
    // Analyze original formants
    const originalFormants = this.analyzeFormants(original);

    // Compute correction filter
    const correctionFilter = this.computeCorrectionFilter(
      originalFormants,
      pitchRatio,
      sampleRate
    );

    // Apply correction to shifted audio
    return this.applyFilter(shifted, correctionFilter);
  }

  /**
   * Pre-emphasis filter (boosts high frequencies for better LPC)
   */
  private preEmphasis(frame: Float32Array): Float32Array {
    const coeff = 0.97;
    const output = new Float32Array(frame.length);
    output[0] = frame[0];

    for (let i = 1; i < frame.length; i++) {
      output[i] = frame[i] - coeff * (frame[i - 1] ?? 0);
    }

    return output;
  }

  /**
   * Apply window function
   */
  private applyWindow(frame: Float32Array): Float32Array {
    const output = new Float32Array(frame.length);
    for (let i = 0; i < frame.length; i++) {
      const t = i / (frame.length - 1);
      output[i] = frame[i] * (0.54 - 0.46 * Math.cos(2 * Math.PI * t));
    }
    return output;
  }

  /**
   * LPC analysis using Levinson-Durbin recursion
   */
  private lpcAnalysis(frame: Float32Array): Float32Array {
    const order = this.options.lpcOrder;
    const N = frame.length;

    // Compute autocorrelation
    const r = new Float32Array(order + 1);
    for (let k = 0; k <= order; k++) {
      let sum = 0;
      for (let i = 0; i < N - k; i++) {
        sum += frame[i] * (frame[i + k] ?? 0);
      }
      r[k] = sum;
    }

    // Levinson-Durbin recursion
    const a = new Float32Array(order + 1);
    const e = r[0];

    if (e <= 0) return a;

    a[0] = 1;
    let err = e;

    for (let i = 1; i <= order; i++) {
      // Compute reflection coefficient
      let sum = 0;
      for (let j = 1; j < i; j++) {
        sum += a[j] * r[i - j];
      }
      const k = -(r[i] + sum) / err;

      // Update coefficients
      const newA = new Float32Array(order + 1);
      newA[0] = 1;
      for (let j = 1; j < i; j++) {
        newA[j] = a[j] + k * a[i - j];
      }
      newA[i] = k;

      for (let j = 0; j <= order; j++) {
        a[j] = newA[j];
      }

      err *= 1 - k * k;
      if (err <= 0) break;
    }

    return a;
  }

  /**
   * Compute frequency response from LPC coefficients
   */
  private computeSpectrum(lpcCoeffs: Float32Array, fftSize: number): Float32Array {
    const spectrum = new Float32Array(fftSize / 2 + 1);
    const order = lpcCoeffs.length - 1;

    for (let k = 0; k < spectrum.length; k++) {
      const freq = (k / fftSize) * 2 * Math.PI;
      let re = 0;
      let im = 0;

      for (let n = 0; n <= order; n++) {
        re += lpcCoeffs[n] * Math.cos(-freq * n);
        im += lpcCoeffs[n] * Math.sin(-freq * n);
      }

      const magnitude = Math.sqrt(re * re + im * im);
      spectrum[k] = magnitude > 0 ? 1 / magnitude : 0;
    }

    return spectrum;
  }

  /**
   * Find formant peaks in spectrum
   */
  private findFormantPeaks(spectrum: Float32Array): FormantData {
    const sampleRate = 44100;
    const freqResolution = sampleRate / (spectrum.length * 2 - 2);
    const minBin = Math.floor(this.options.formantRange[0] / freqResolution);
    const maxBin = Math.min(
      spectrum.length - 1,
      Math.floor(this.options.formantRange[1] / freqResolution)
    );

    const frequencies: number[] = [];
    const bandwidths: number[] = [];
    const amplitudes: number[] = [];

    // Find local maxima (peaks)
    for (let k = minBin + 1; k < maxBin; k++) {
      if (spectrum[k] > spectrum[k - 1] && spectrum[k] > spectrum[k + 1]) {
        // Parabolic interpolation for better peak location
        const alpha = Math.log(spectrum[k - 1] || 0.0001);
        const beta = Math.log(spectrum[k]);
        const gamma = Math.log(spectrum[k + 1] || 0.0001);
        const p = 0.5 * (alpha - gamma) / (alpha - 2 * beta + gamma || 0.0001);

        const peakBin = k + p;
        const peakFreq = peakBin * freqResolution;
        const peakAmp = Math.exp(beta - 0.5 * (alpha - gamma) * p);

        // Estimate bandwidth from curvature
        const bandwidth = freqResolution * Math.sqrt(-2 * (alpha - 2 * beta + gamma) || 1);

        frequencies.push(peakFreq);
        bandwidths.push(bandwidth);
        amplitudes.push(peakAmp);
      }
    }

    return {
      frequencies: frequencies.slice(0, 5),  // Keep top 5 formants
      bandwidths: bandwidths.slice(0, 5),
      amplitudes: amplitudes.slice(0, 5),
      spectralEnvelope: spectrum,
    };
  }

  /**
   * Smooth formants over time
   */
  private smoothFormants(current: FormantData): FormantData {
    if (!this.prevFormants) return current;

    const alpha = this.options.smoothing;
    const smoothed: FormantData = {
      frequencies: [],
      bandwidths: [],
      amplitudes: [],
      spectralEnvelope: current.spectralEnvelope,
    };

    // Match formants from previous frame
    for (let i = 0; i < current.frequencies.length; i++) {
      const prevFreq = this.prevFormants.frequencies[i] ?? current.frequencies[i];
      const prevBw = this.prevFormants.bandwidths[i] ?? current.bandwidths[i];
      const prevAmp = this.prevFormants.amplitudes[i] ?? current.amplitudes[i];

      smoothed.frequencies.push(
        alpha * prevFreq + (1 - alpha) * current.frequencies[i]
      );
      smoothed.bandwidths.push(
        alpha * prevBw + (1 - alpha) * current.bandwidths[i]
      );
      smoothed.amplitudes.push(
        alpha * prevAmp + (1 - alpha) * current.amplitudes[i]
      );
    }

    return smoothed;
  }

  /**
   * Compute correction filter to preserve formants after pitch shifting
   */
  private computeCorrectionFilter(
    formants: FormantData,
    pitchRatio: number,
    sampleRate: number
  ): Float32Array {
    const filterSize = 128;
    const filter = new Float32Array(filterSize);

    // For each formant, create a correction filter
    for (let i = 0; i < formants.frequencies.length; i++) {
      const formantFreq = formants.frequencies[i];
      const shiftedFreq = formantFreq * pitchRatio;
      const bw = formants.bandwidths[i];

      // Create resonant filter at original formant frequency
      // This preserves the original formant position
      const omega = (2 * Math.PI * formantFreq) / sampleRate;
      const r = Math.exp(-Math.PI * bw / sampleRate);

      // IIR filter coefficients
      const b0 = 1;
      const b1 = -2 * Math.cos(omega) * r;
      const b2 = r * r;

      // Apply to filter (simplified)
      for (let n = 0; n < filterSize; n++) {
        filter[n] += Math.cos(omega * n) * Math.pow(r, n) * formants.amplitudes[i];
      }
    }

    // Normalize
    const maxVal = Math.max(...filter.map(Math.abs));
    if (maxVal > 0) {
      for (let i = 0; i < filterSize; i++) {
        filter[i] /= maxVal;
      }
    }

    return filter;
  }

  /**
   * Apply filter to audio (convolution)
   */
  private applyFilter(audio: Float32Array, filter: Float32Array): Float32Array {
    const output = new Float32Array(audio.length);
    const filterLen = filter.length;

    for (let i = 0; i < audio.length; i++) {
      let sum = 0;
      for (let j = 0; j < filterLen; j++) {
        const idx = i - j;
        if (idx >= 0) {
          sum += audio[idx] * filter[j];
        }
      }
      output[i] = sum;
    }

    return output;
  }

  /**
   * Direct formant-corrected pitch shifting
   */
  pitchShiftWithFormants(
    input: Float32Array,
    semitones: number,
    sampleRate: number
  ): Float32Array {
    const pitchRatio = Math.pow(2, semitones / 12);

    // Simple pitch shift (resample)
    const shifted = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const srcPos = i / pitchRatio;
      const srcIdx = Math.floor(srcPos);
      const frac = srcPos - srcIdx;
      shifted[i] = (input[srcIdx] ?? 0) * (1 - frac) + (input[srcIdx + 1] ?? 0) * frac;
    }

    // Apply formant correction
    return this.correctFormants(input, shifted, pitchRatio, sampleRate);
  }
}

export default FormantCorrection;
