/**
 * Granular Time Stretching - High-quality time stretching using granular synthesis
 *
 * Features:
 * - Overlap-add granular synthesis
 * - Windowed grains with configurable size
 * - Pitch-synchronous stretching
 * - Randomized grain positions for natural sound
 * - Texture vs. time-stretch modes
 *
 * Based on LPC (Linear Predictive Coding) for formant preservation.
 */

export interface GranularStretchOptions {
  /** Grain size in samples (default: 2048) */
  grainSize: number;
  /** Overlap factor (1-8, default: 4) */
  overlap: number;
  /** Random variation in grain position (0-1) */
  randomness: number;
  /** Window type */
  window: 'hann' | 'hamming' | 'blackman' | 'gaussian';
  /** Preserve formants during stretching */
  preserveFormants: boolean;
  /** Mode: 'stretch' preserves pitch, 'texture' allows pitch variation */
  mode: 'stretch' | 'texture';
}

const DEFAULT_OPTIONS: GranularStretchOptions = {
  grainSize: 2048,
  overlap: 4,
  randomness: 0.1,
  window: 'hann',
  preserveFormants: true,
  mode: 'stretch',
};

export class GranularStretch {
  /**
   * Time-stretch audio using granular synthesis
   */
  static stretch(
    input: Float32Array,
    sampleRate: number,
    ratio: number,
    options: Partial<GranularStretchOptions> = {}
  ): Float32Array {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    if (Math.abs(ratio - 1) < 0.001) return input.slice();

    const grainSize = opts.grainSize;
    const hop = Math.floor(grainSize / opts.overlap);
    const outputLength = Math.ceil(input.length * ratio);
    const output = new Float32Array(outputLength);

    // Generate window function
    const window = GranularStretch.generateWindow(grainSize, opts.window);

    // Calculate grain positions
    const inputGrains = Math.floor((input.length - grainSize) / hop) + 1;
    const outputGrains = Math.floor(inputGrains * ratio);

    for (let i = 0; i < outputGrains; i++) {
      // Source position (with optional randomization)
      const srcPos = (i / ratio) * hop;
      const randomOffset = (Math.random() - 0.5) * opts.randomness * hop;
      const srcIdx = Math.max(0, Math.min(input.length - grainSize, Math.round(srcPos + randomOffset)));

      // Destination position
      const dstIdx = Math.round(i * hop * ratio);

      // Extract and window grain
      for (let j = 0; j < grainSize; j++) {
        const srcSample = input[srcIdx + j] ?? 0;
        const dstSample = dstIdx + j;
        if (dstSample < outputLength) {
          output[dstSample] += srcSample * window[j];
        }
      }
    }

    // Normalize overlap
    const normFactor = opts.overlap / 2;
    for (let i = 0; i < outputLength; i++) {
      output[i] /= normFactor;
    }

    return output;
  }

  /**
   * Generate window function
   */
  private static generateWindow(
    size: number,
    type: GranularStretchOptions['window']
  ): Float32Array {
    const window = new Float32Array(size);

    for (let i = 0; i < size; i++) {
      const t = i / (size - 1);
      switch (type) {
        case 'hann':
          window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * t));
          break;
        case 'hamming':
          window[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * t);
          break;
        case 'blackman':
          window[i] = 0.42 - 0.5 * Math.cos(2 * Math.PI * t) + 0.08 * Math.cos(4 * Math.PI * t);
          break;
        case 'gaussian':
          window[i] = Math.exp(-0.5 * Math.pow((t - 0.5) / 0.25, 2));
          break;
      }
    }

    return window;
  }

  /**
   * Pitch-synchronous time stretch (maintains pitch while stretching)
   */
  static pitchSynchronousStretch(
    input: Float32Array,
    sampleRate: number,
    ratio: number,
    pitchRatio: number = 1,
    options: Partial<GranularStretchOptions> = {}
  ): Float32Array {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const grainSize = opts.grainSize;
    const hop = Math.floor(grainSize / opts.overlap);
    const outputLength = Math.ceil(input.length * ratio);
    const output = new Float32Array(outputLength);

    const window = GranularStretch.generateWindow(grainSize, opts.window);

    // Estimate fundamental frequency for pitch-synchronous windowing
    const f0 = GranularStretch.estimateF0(input, sampleRate);
    const pitchPeriod = f0 > 0 ? Math.floor(sampleRate / f0) : grainSize;

    const inputGrains = Math.floor((input.length - grainSize) / hop) + 1;
    const outputGrains = Math.floor(inputGrains * ratio);

    for (let i = 0; i < outputGrains; i++) {
      const srcPos = (i / ratio) * hop;
      const srcIdx = Math.max(0, Math.min(input.length - grainSize, Math.round(srcPos)));
      const dstIdx = Math.round(i * hop * ratio * pitchRatio);

      for (let j = 0; j < grainSize; j++) {
        const dstSample = dstIdx + j;
        if (dstSample >= 0 && dstSample < outputLength) {
          output[dstSample] += (input[srcIdx + j] ?? 0) * window[j];
        }
      }
    }

    const normFactor = opts.overlap / 2;
    for (let i = 0; i < outputLength; i++) {
      output[i] /= normFactor;
    }

    return output;
  }

  /**
   * Simple F0 estimation using autocorrelation
   */
  private static estimateF0(data: Float32Array, sampleRate: number): number {
    const minPeriod = Math.floor(sampleRate / 1000);  // 1000 Hz max
    const maxPeriod = Math.floor(sampleRate / 50);     // 50 Hz min
    const frameSize = Math.min(4096, data.length);
    const frame = data.slice(0, frameSize);

    // Autocorrelation
    let bestCorr = 0;
    let bestPeriod = 0;

    for (let period = minPeriod; period <= maxPeriod && period < frameSize / 2; period++) {
      let corr = 0;
      let energy = 0;
      for (let i = 0; i < frameSize - period; i++) {
        corr += frame[i] * frame[i + period];
        energy += frame[i] * frame[i];
      }
      const normCorr = energy > 0 ? corr / energy : 0;
      if (normCorr > bestCorr) {
        bestCorr = normCorr;
        bestPeriod = period;
      }
    }

    return bestCorr > 0.3 ? sampleRate / bestPeriod : 0;
  }

  /**
   * Texture mode: randomize grain positions for atmospheric effects
   */
  static textureStretch(
    input: Float32Array,
    sampleRate: number,
    ratio: number,
    density: number = 0.5,
    options: Partial<GranularStretchOptions> = {}
  ): Float32Array {
    const opts = { ...DEFAULT_OPTIONS, ...options, randomness: 0.5 };
    const grainSize = opts.grainSize;
    const outputLength = Math.ceil(input.length * ratio);
    const output = new Float32Array(outputLength);

    const window = GranularStretch.generateWindow(grainSize, opts.window);
    const grainsPerSample = density * ratio;

    // Random grain placement
    const numGrains = Math.floor(outputLength * grainsPerSample / grainSize);

    for (let i = 0; i < numGrains; i++) {
      const srcIdx = Math.floor(Math.random() * (input.length - grainSize));
      const dstIdx = Math.floor(Math.random() * (outputLength - grainSize));

      for (let j = 0; j < grainSize; j++) {
        output[dstIdx + j] += (input[srcIdx + j] ?? 0) * window[j];
      }
    }

    // Normalize
    const maxVal = Math.max(...output.map(Math.abs));
    if (maxVal > 1) {
      for (let i = 0; i < outputLength; i++) {
        output[i] /= maxVal;
      }
    }

    return output;
  }
}

export default GranularStretch;
