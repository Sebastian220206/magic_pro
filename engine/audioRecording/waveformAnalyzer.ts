/**
 * waveformAnalyzer.ts
 * Performant downsampling for waveform visualization
 */

/**
 * Generate waveform data from AudioBuffer
 * Uses peak detection for visual accuracy
 */
export function generateWaveformData(
  audioBuffer: AudioBuffer,
  targetPoints: number = 1000
): number[] {
  const channelData = audioBuffer.getChannelData(0); // Use first channel
  const totalSamples = channelData.length;

  if (totalSamples === 0) {
    return new Array(targetPoints).fill(0);
  }

  // If buffer is smaller than target, use all samples
  if (totalSamples <= targetPoints) {
    return Array.from(channelData).map((s) => Math.abs(s));
  }

  const samplesPerPoint = totalSamples / targetPoints;
  const waveform: number[] = [];

  for (let i = 0; i < targetPoints; i++) {
    const startSample = Math.floor(i * samplesPerPoint);
    const endSample = Math.floor((i + 1) * samplesPerPoint);

    // Find peak amplitude in this segment
    let peak = 0;
    for (let j = startSample; j < endSample && j < totalSamples; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > peak) {
        peak = abs;
      }
    }

    waveform.push(peak);
  }

  return waveform;
}

/**
 * Generate bipolar waveform (positive and negative peaks)
 * For more detailed visualization
 */
export function generateBipolarWaveformData(
  audioBuffer: AudioBuffer,
  targetPoints: number = 1000
): { min: number[]; max: number[] } {
  const channelData = audioBuffer.getChannelData(0);
  const totalSamples = channelData.length;

  if (totalSamples === 0) {
    const empty = new Array(targetPoints).fill(0);
    return { min: empty, max: empty };
  }

  const samplesPerPoint = totalSamples / targetPoints;
  const min: number[] = [];
  const max: number[] = [];

  for (let i = 0; i < targetPoints; i++) {
    const startSample = Math.floor(i * samplesPerPoint);
    const endSample = Math.floor((i + 1) * samplesPerPoint);

    let minVal = 0;
    let maxVal = 0;

    for (let j = startSample; j < endSample && j < totalSamples; j++) {
      const sample = channelData[j];
      if (sample < minVal) minVal = sample;
      if (sample > maxVal) maxVal = sample;
    }

    min.push(minVal);
    max.push(maxVal);
  }

  return { min, max };
}

/**
 * Generate RMS waveform (Root Mean Square)
 * Better represents perceived loudness
 */
export function generateRMSWaveformData(
  audioBuffer: AudioBuffer,
  targetPoints: number = 1000,
  windowSize: number = 256
): number[] {
  const channelData = audioBuffer.getChannelData(0);
  const totalSamples = channelData.length;

  if (totalSamples === 0) {
    return new Array(targetPoints).fill(0);
  }

  const samplesPerPoint = totalSamples / targetPoints;
  const waveform: number[] = [];

  for (let i = 0; i < targetPoints; i++) {
    const centerSample = Math.floor(i * samplesPerPoint);
    const halfWindow = Math.floor(windowSize / 2);
    const startSample = Math.max(0, centerSample - halfWindow);
    const endSample = Math.min(totalSamples, centerSample + halfWindow);

    // Calculate RMS
    let sum = 0;
    let count = 0;
    for (let j = startSample; j < endSample; j++) {
      sum += channelData[j] * channelData[j];
      count++;
    }

    const rms = count > 0 ? Math.sqrt(sum / count) : 0;
    waveform.push(rms);
  }

  return waveform;
}

/**
 * Downsample waveform to fit display width
 * Uses max pooling for accurate peak representation
 */
export function downsampleWaveform(
  waveform: number[],
  targetWidth: number
): number[] {
  if (waveform.length <= targetWidth) {
    return waveform;
  }

  const samplesPerPixel = waveform.length / targetWidth;
  const result: number[] = [];

  for (let i = 0; i < targetWidth; i++) {
    const start = Math.floor(i * samplesPerPixel);
    const end = Math.floor((i + 1) * samplesPerPixel);

    let peak = 0;
    for (let j = start; j < end && j < waveform.length; j++) {
      if (waveform[j] > peak) {
        peak = waveform[j];
      }
    }

    result.push(peak);
  }

  return result;
}

/**
 * Normalize waveform to 0-1 range
 */
export function normalizeWaveform(waveform: number[]): number[] {
  const peak = Math.max(...waveform.map(Math.abs));
  if (peak === 0) return waveform;

  return waveform.map((v) => v / peak);
}

/**
 * Smooth waveform using moving average
 */
export function smoothWaveform(waveform: number[], windowSize: number = 3): number[] {
  if (windowSize <= 1) return waveform;

  const result: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < waveform.length; i++) {
    let sum = 0;
    let count = 0;

    for (let j = -halfWindow; j <= halfWindow; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < waveform.length) {
        sum += waveform[idx];
        count++;
      }
    }

    result.push(sum / count);
  }

  return result;
}

/**
 * Calculate decibel value from linear amplitude
 */
export function linearToDecibel(linear: number): number {
  if (linear <= 0) return -Infinity;
  return 20 * Math.log10(linear);
}

/**
 * Calculate linear amplitude from decibel
 */
export function decibelToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Detect silence regions in audio
 */
export function detectSilenceRegions(
  audioBuffer: AudioBuffer,
  thresholdDb: number = -60,
  minDurationMs: number = 100
): Array<{ start: number; end: number }> {
  const channelData = audioBuffer.getChannelData(0);
  const threshold = decibelToLinear(thresholdDb);
  const sampleRate = audioBuffer.sampleRate;
  const minSamples = Math.floor((minDurationMs / 1000) * sampleRate);

  const regions: Array<{ start: number; end: number }> = [];
  let silenceStart: number | null = null;

  for (let i = 0; i < channelData.length; i++) {
    const isSilent = Math.abs(channelData[i]) < threshold;

    if (isSilent && silenceStart === null) {
      silenceStart = i;
    } else if (!isSilent && silenceStart !== null) {
      const duration = i - silenceStart;
      if (duration >= minSamples) {
        regions.push({
          start: silenceStart / sampleRate,
          end: i / sampleRate,
        });
      }
      silenceStart = null;
    }
  }

  // Handle silence at end
  if (silenceStart !== null) {
    const duration = channelData.length - silenceStart;
    if (duration >= minSamples) {
      regions.push({
        start: silenceStart / sampleRate,
        end: channelData.length / sampleRate,
      });
    }
  }

  return regions;
}

/**
 * Calculate peak amplitude of audio buffer
 */
export function calculatePeakAmplitude(audioBuffer: AudioBuffer): number {
  let peak = 0;

  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < channelData.length; i++) {
      const abs = Math.abs(channelData[i]);
      if (abs > peak) {
        peak = abs;
      }
    }
  }

  return peak;
}

/**
 * Calculate RMS level of audio buffer
 */
export function calculateRMSLevel(audioBuffer: AudioBuffer): number {
  let sum = 0;
  let count = 0;

  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < channelData.length; i++) {
      sum += channelData[i] * channelData[i];
      count++;
    }
  }

  return count > 0 ? Math.sqrt(sum / count) : 0;
}

/**
 * WaveformAnalyzer class for incremental analysis
 */
export class WaveformAnalyzer {
  private samples: Float32Array = new Float32Array(0);
  private sampleRate: number;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  /**
   * Add samples for analysis
   */
  addSamples(samples: Float32Array): void {
    const newLength = this.samples.length + samples.length;
    const newBuffer = new Float32Array(newLength);
    newBuffer.set(this.samples);
    newBuffer.set(samples, this.samples.length);
    this.samples = newBuffer;
  }

  /**
   * Generate waveform from accumulated samples
   */
  generateWaveform(targetPoints: number = 1000): number[] {
    if (this.samples.length === 0) {
      return new Array(targetPoints).fill(0);
    }

    const samplesPerPoint = this.samples.length / targetPoints;
    const waveform: number[] = [];

    for (let i = 0; i < targetPoints; i++) {
      const start = Math.floor(i * samplesPerPoint);
      const end = Math.floor((i + 1) * samplesPerPoint);

      let peak = 0;
      for (let j = start; j < end && j < this.samples.length; j++) {
        const abs = Math.abs(this.samples[j]);
        if (abs > peak) peak = abs;
      }

      waveform.push(peak);
    }

    return waveform;
  }

  /**
   * Get current duration
   */
  getDuration(): number {
    return this.samples.length / this.sampleRate;
  }

  /**
   * Clear accumulated samples
   */
  clear(): void {
    this.samples = new Float32Array(0);
  }
}

export default {
  generateWaveformData,
  generateBipolarWaveformData,
  generateRMSWaveformData,
  downsampleWaveform,
  normalizeWaveform,
  smoothWaveform,
  linearToDecibel,
  decibelToLinear,
  detectSilenceRegions,
  calculatePeakAmplitude,
  calculateRMSLevel,
  WaveformAnalyzer,
};
