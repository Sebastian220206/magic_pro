/**
 * Spectral Audio Editor - Edit audio in the frequency domain
 *
 * Features:
 * - FFT-based spectral display
 * - Frequency-selective editing
 * - Spectral erase (remove frequencies)
 * - Spectral gain (boost/cut frequencies)
 * - Noise reduction
 * - Spectral repair
 * - Real-time preview
 */

export interface SpectralEditorOptions {
  /** FFT size */
  fftSize: number;
  /** Hop size */
  hopSize: number;
  /** Window function */
  window: 'hann' | 'hamming' | 'blackman';
  /** Number of frequency bins to display */
  numBins: number;
  /** Time resolution */
  timeResolution: number;
}

export interface SpectralSelection {
  /** Start frequency (Hz) */
  startFreq: number;
  /** End frequency (Hz) */
  endFreq: number;
  /** Start time (seconds) */
  startTime: number;
  /** End time (seconds) */
  endTime: number;
}

export interface SpectralEditResult {
  /** Modified audio */
  audio: Float32Array;
  /** Number of bins modified */
  binsModified: number;
  /** Processing time in ms */
  processingTime: number;
}

const DEFAULT_OPTIONS: SpectralEditorOptions = {
  fftSize: 2048,
  hopSize: 512,
  window: 'hann',
  numBins: 1024,
  timeResolution: 0.01,
};

export class SpectralEditor {
  private options: SpectralEditorOptions;
  private sampleRate: number;

  constructor(sampleRate: number, options: Partial<SpectralEditorOptions> = {}) {
    this.sampleRate = sampleRate;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Get spectral data for display
   */
  getSpectralData(audio: Float32Array): Array<{ time: number; magnitudes: Float32Array }> {
    const frames: Array<{ time: number; magnitudes: Float32Array }> = [];
    const numBins = this.options.fftSize / 2 + 1;

    for (let start = 0; start + this.options.fftSize <= audio.length; start += this.options.hopSize) {
      // Window frame
      const frame = new Float32Array(this.options.fftSize);
      for (let i = 0; i < this.options.fftSize; i++) {
        frame[i] = (audio[start + i] ?? 0) * this.getWindowValue(i, this.options.fftSize);
      }

      // FFT
      const magnitudes = this.fftMagnitude(frame, numBins);

      frames.push({
        time: start / this.sampleRate,
        magnitudes,
      });
    }

    return frames;
  }

  /**
   * Erase frequencies in selection
   */
  eraseFrequencies(
    audio: Float32Array,
    selection: SpectralSelection
  ): SpectralEditResult {
    const startTime = performance.now();
    const output = new Float32Array(audio.length);
    let binsModified = 0;

    const numBins = this.options.fftSize / 2 + 1;
    const freqResolution = this.sampleRate / this.options.fftSize;
    const startBin = Math.floor(selection.startFreq / freqResolution);
    const endBin = Math.min(numBins - 1, Math.floor(selection.endFreq / freqResolution));

    for (let start = 0; start + this.options.fftSize <= audio.length; start += this.options.hopSize) {
      const frameTime = start / this.sampleRate;
      if (frameTime < selection.startTime || frameTime > selection.endTime) {
        // Copy unchanged
        for (let i = 0; i < this.options.fftSize; i++) {
          output[start + i] = audio[start + i] ?? 0;
        }
        continue;
      }

      // Window frame
      const frame = new Float32Array(this.options.fftSize);
      for (let i = 0; i < this.options.fftSize; i++) {
        frame[i] = (audio[start + i] ?? 0) * this.getWindowValue(i, this.options.fftSize);
      }

      // FFT
      const { real, imag } = this.fft(frame);

      // Zero out selected bins
      for (let k = startBin; k <= endBin; k++) {
        real[k] = 0;
        imag[k] = 0;
        binsModified++;
      }

      // IFFT
      const modifiedFrame = this.ifft(real, imag);

      // Overlap-add
      for (let i = 0; i < this.options.fftSize; i++) {
        output[start + i] = (output[start + i] ?? 0) + modifiedFrame[i] * this.getWindowValue(i, this.options.fftSize);
      }
    }

    return {
      audio: output,
      binsModified,
      processingTime: performance.now() - startTime,
    };
  }

  /**
   * Apply gain to selected frequencies
   */
  applyGain(
    audio: Float32Array,
    selection: SpectralSelection,
    gainDb: number
  ): SpectralEditResult {
    const startTime = performance.now();
    const output = new Float32Array(audio.length);
    let binsModified = 0;
    const gainLinear = Math.pow(10, gainDb / 20);

    const numBins = this.options.fftSize / 2 + 1;
    const freqResolution = this.sampleRate / this.options.fftSize;
    const startBin = Math.floor(selection.startFreq / freqResolution);
    const endBin = Math.min(numBins - 1, Math.floor(selection.endFreq / freqResolution));

    for (let start = 0; start + this.options.fftSize <= audio.length; start += this.options.hopSize) {
      const frameTime = start / this.sampleRate;
      if (frameTime < selection.startTime || frameTime > selection.endTime) {
        for (let i = 0; i < this.options.fftSize; i++) {
          output[start + i] = audio[start + i] ?? 0;
        }
        continue;
      }

      const frame = new Float32Array(this.options.fftSize);
      for (let i = 0; i < this.options.fftSize; i++) {
        frame[i] = (audio[start + i] ?? 0) * this.getWindowValue(i, this.options.fftSize);
      }

      const { real, imag } = this.fft(frame);

      for (let k = startBin; k <= endBin; k++) {
        real[k] *= gainLinear;
        imag[k] *= gainLinear;
        binsModified++;
      }

      const modifiedFrame = this.ifft(real, imag);

      for (let i = 0; i < this.options.fftSize; i++) {
        output[start + i] = (output[start + i] ?? 0) + modifiedFrame[i] * this.getWindowValue(i, this.options.fftSize);
      }
    }

    return {
      audio: output,
      binsModified,
      processingTime: performance.now() - startTime,
    };
  }

  /**
   * Spectral noise reduction
   */
  reduceNoise(
    audio: Float32Array,
    noiseProfile: Float32Array,
    reductionAmount: number = 0.5
  ): SpectralEditResult {
    const startTime = performance.now();
    const output = new Float32Array(audio.length);
    let binsModified = 0;

    const numBins = this.options.fftSize / 2 + 1;

    for (let start = 0; start + this.options.fftSize <= audio.length; start += this.options.hopSize) {
      const frame = new Float32Array(this.options.fftSize);
      for (let i = 0; i < this.options.fftSize; i++) {
        frame[i] = (audio[start + i] ?? 0) * this.getWindowValue(i, this.options.fftSize);
      }

      const { real, imag } = this.fft(frame);

      for (let k = 0; k < numBins; k++) {
        const magnitude = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
        const noiseMagnitude = noiseProfile[k] ?? 0;
        const ratio = Math.max(0, 1 - (noiseMagnitude / (magnitude + 0.0001)) * reductionAmount);

        real[k] *= ratio;
        imag[k] *= ratio;
        binsModified++;
      }

      const modifiedFrame = this.ifft(real, imag);

      for (let i = 0; i < this.options.fftSize; i++) {
        output[start + i] = (output[start + i] ?? 0) + modifiedFrame[i] * this.getWindowValue(i, this.options.fftSize);
      }
    }

    return {
      audio: output,
      binsModified,
      processingTime: performance.now() - startTime,
    };
  }

  /**
   * Extract noise profile from silent section
   */
  extractNoiseProfile(audio: Float32Array, startSec: number, endSec: number): Float32Array {
    const numBins = this.options.fftSize / 2 + 1;
    const profile = new Float32Array(numBins);
    let frameCount = 0;

    const startSample = Math.floor(startSec * this.sampleRate);
    const endSample = Math.floor(endSec * this.sampleRate);

    for (let start = startSample; start + this.options.fftSize <= endSample; start += this.options.hopSize) {
      const frame = new Float32Array(this.options.fftSize);
      for (let i = 0; i < this.options.fftSize; i++) {
        frame[i] = (audio[start + i] ?? 0) * this.getWindowValue(i, this.options.fftSize);
      }

      const magnitudes = this.fftMagnitude(frame, numBins);

      for (let k = 0; k < numBins; k++) {
        profile[k] += magnitudes[k];
      }
      frameCount++;
    }

    // Average
    if (frameCount > 0) {
      for (let k = 0; k < numBins; k++) {
        profile[k] /= frameCount;
      }
    }

    return profile;
  }

  /**
   * Get FFT magnitude spectrum
   */
  private fftMagnitude(frame: Float32Array, numBins: number): Float32Array {
    const { real, imag } = this.fft(frame);
    const magnitudes = new Float32Array(numBins);

    for (let k = 0; k < numBins; k++) {
      magnitudes[k] = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
    }

    return magnitudes;
  }

  /**
   * Simple DFT
   */
  private fft(input: Float32Array): { real: Float32Array; imag: Float32Array } {
    const N = input.length;
    const real = new Float32Array(N);
    const imag = new Float32Array(N);

    for (let k = 0; k < N / 2 + 1; k++) {
      let re = 0;
      let im = 0;
      for (let n = 0; n < N; n++) {
        const angle = (-2 * Math.PI * k * n) / N;
        re += input[n] * Math.cos(angle);
        im += input[n] * Math.sin(angle);
      }
      real[k] = re;
      imag[k] = im;
    }

    return { real, imag };
  }

  /**
   * Simple IDFT
   */
  private ifft(real: Float32Array, imag: Float32Array): Float32Array {
    const N = real.length;
    const output = new Float32Array(N);

    for (let n = 0; n < N; n++) {
      let sum = 0;
      for (let k = 0; k < N / 2 + 1; k++) {
        const angle = (2 * Math.PI * k * n) / N;
        sum += real[k] * Math.cos(angle) - imag[k] * Math.sin(angle);
      }
      output[n] = sum / N;
    }

    return output;
  }

  /**
   * Get window function value
   */
  private getWindowValue(i: number, size: number): number {
    const t = i / (size - 1);
    switch (this.options.window) {
      case 'hann':
        return 0.5 * (1 - Math.cos(2 * Math.PI * t));
      case 'hamming':
        return 0.54 - 0.46 * Math.cos(2 * Math.PI * t);
      case 'blackman':
        return 0.42 - 0.5 * Math.cos(2 * Math.PI * t) + 0.08 * Math.cos(4 * Math.PI * t);
      default:
        return 1;
    }
  }
}

export default SpectralEditor;
