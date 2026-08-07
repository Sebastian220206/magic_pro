/**
 * Drum Replacement/Doubling - Replace or layer drum sounds
 *
 * Features:
 * - Transient detection for drum hits
 * - Sample replacement with user samples
 * - Drum layering (blend original + replacement)
 * - Adjustable threshold and sensitivity
 * - Velocity mapping
 * - Multiple output modes (replace, layer, blend)
 * - Real-time preview
 */

import { TransientDetector } from './AudioQuantizer';

export interface DrumReplacementOptions {
  /** Detection threshold (0-1) */
  threshold: number;
  /** Transient sensitivity */
  sensitivity: number;
  /** Mode: replace, layer, or blend */
  mode: 'replace' | 'layer' | 'blend';
  /** Blend amount (0-1, for blend mode) */
  blendAmount: number;
  /** Output gain (dB) */
  outputGain: number;
  /** Replacement sample URL */
  sampleUrl: string;
  /** Velocity scaling */
  velocityScale: number;
  /** Minimum time between hits (ms) */
  minHitInterval: number;
  /** Pitch shift for replacement (semitones) */
  pitchShift: number;
}

export interface DrumHit {
  /** Time in seconds */
  time: number;
  /** Detected velocity (0-1) */
  velocity: number;
  /** Sample index */
  sampleIndex: number;
  /** Confidence */
  confidence: number;
}

export interface DrumReplacementResult {
  /** Output audio */
  audio: Float32Array;
  /** Detected hits */
  hits: DrumHit[];
  /** Number of hits detected */
  hitCount: number;
  /** Processing time in ms */
  processingTime: number;
}

const DEFAULT_OPTIONS: DrumReplacementOptions = {
  threshold: 0.3,
  sensitivity: 0.5,
  mode: 'layer',
  blendAmount: 0.5,
  outputGain: 0,
  sampleUrl: '',
  velocityScale: 1,
  minHitInterval: 50,
  pitchShift: 0,
};

export class DrumReplacement {
  private options: DrumReplacementOptions;
  private sampleRate: number;
  private replacementSample: Float32Array | null = null;

  constructor(sampleRate: number, options: Partial<DrumReplacementOptions> = {}) {
    this.sampleRate = sampleRate;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Load replacement sample
   */
  async loadSample(url: string): Promise<boolean> {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Convert to mono Float32Array
      if (audioBuffer.numberOfChannels > 1) {
        const left = audioBuffer.getChannelData(0);
        const right = audioBuffer.getChannelData(1);
        this.replacementSample = new Float32Array(left.length);
        for (let i = 0; i < left.length; i++) {
          this.replacementSample[i] = ((left[i] ?? 0) + (right[i] ?? 0)) / 2;
        }
      } else {
        this.replacementSample = audioBuffer.getChannelData(0).slice();
      }

      this.options.sampleUrl = url;
      return true;
    } catch (error) {
      console.error('Failed to load replacement sample:', error);
      return false;
    }
  }

  /**
   * Set replacement sample directly
   */
  setSample(sample: Float32Array): void {
    this.replacementSample = sample;
  }

  /**
   * Process audio with drum replacement
   */
  process(audio: Float32Array): DrumReplacementResult {
    const startTime = performance.now();

    // Detect transients
    const transients = TransientDetector.detectTransients(
      audio,
      this.sampleRate,
      this.options.sensitivity
    );

    // Filter by threshold and minimum interval
    const hits = this.filterHits(transients, audio);

    // Apply replacement
    const output = this.applyReplacement(audio, hits);

    return {
      audio: output,
      hits,
      hitCount: hits.length,
      processingTime: performance.now() - startTime,
    };
  }

  /**
   * Filter hits by threshold and minimum interval
   */
  private filterHits(transients: number[], audio: Float32Array): DrumHit[] {
    const hits: DrumHit[] = [];
    const minInterval = (this.options.minHitInterval / 1000) * this.sampleRate;

    for (const sampleIdx of transients) {
      // Calculate velocity from energy
      const energy = this.calculateEnergy(audio, sampleIdx);
      if (energy < this.options.threshold) continue;

      // Check minimum interval
      if (hits.length > 0) {
        const lastHitSample = hits[hits.length - 1].sampleIndex;
        if (sampleIdx - lastHitSample < minInterval) continue;
      }

      hits.push({
        time: sampleIdx / this.sampleRate,
        velocity: energy,
        sampleIndex: sampleIdx,
        confidence: energy,
      });
    }

    return hits;
  }

  /**
   * Calculate energy around a sample
   */
  private calculateEnergy(audio: Float32Array, sampleIdx: number): number {
    const windowSize = Math.floor(this.sampleRate * 0.01);  // 10ms window
    const start = Math.max(0, sampleIdx - windowSize);
    const end = Math.min(audio.length, sampleIdx + windowSize);

    let sum = 0;
    let count = 0;
    for (let i = start; i < end; i++) {
      const sample = audio[i] ?? 0;
      sum += sample * sample;
      count++;
    }

    return count > 0 ? Math.sqrt(sum / count) : 0;
  }

  /**
   * Apply replacement samples at detected hits
   */
  private applyReplacement(audio: Float32Array, hits: DrumHit[]): Float32Array {
    const output = new Float32Array(audio.length);
    const gainLinear = Math.pow(10, this.options.outputGain / 20);

    // Copy original audio
    for (let i = 0; i < audio.length; i++) {
      output[i] = audio[i] ?? 0;
    }

    // Apply replacement samples
    for (const hit of hits) {
      if (!this.replacementSample) continue;

      const startSample = hit.sampleIndex;
      const velocity = hit.velocity * this.options.velocityScale;

      // Apply pitch shift if needed
      const sample = this.options.pitchShift !== 0
        ? this.pitchShiftSample(this.replacementSample, this.options.pitchShift)
        : this.replacementSample;

      // Mix in replacement sample
      for (let i = 0; i < sample.length && startSample + i < output.length; i++) {
        const replacementValue = (sample[i] ?? 0) * velocity * gainLinear;

        switch (this.options.mode) {
          case 'replace':
            output[startSample + i] = replacementValue;
            break;
          case 'layer':
            output[startSample + i] += replacementValue;
            break;
          case 'blend':
            const originalValue = output[startSample + i] ?? 0;
            output[startSample + i] = originalValue * (1 - this.options.blendAmount) +
                                      replacementValue * this.options.blendAmount;
            break;
        }
      }
    }

    // Normalize to prevent clipping
    const maxVal = Math.max(...output.map(Math.abs));
    if (maxVal > 1) {
      for (let i = 0; i < output.length; i++) {
        output[i] /= maxVal;
      }
    }

    return output;
  }

  /**
   * Pitch shift a sample
   */
  private pitchShiftSample(sample: Float32Array, semitones: number): Float32Array {
    const ratio = Math.pow(2, semitones / 12);
    const newLength = Math.ceil(sample.length / ratio);
    const output = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const srcPos = i * ratio;
      const srcIdx = Math.floor(srcPos);
      const frac = srcPos - srcIdx;

      output[i] = (sample[srcIdx] ?? 0) * (1 - frac) + (sample[srcIdx + 1] ?? 0) * frac;
    }

    return output;
  }

  /**
   * Set options
   */
  setOptions(options: Partial<DrumReplacementOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get options
   */
  getOptions(): Readonly<DrumReplacementOptions> {
    return this.options;
  }

  /**
   * Get replacement sample
   */
  getSample(): Float32Array | null {
    return this.replacementSample;
  }
}

export default DrumReplacement;
