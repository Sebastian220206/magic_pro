/**
 * Clip DSP - Digital Signal Processing for clip audio
 * 
 * Features:
 * - Clip gain/volume control
 * - True audio reversal (sample-by-sample)
 * - Audio buffer manipulation
 * - Peak detection for normalization
 * - Loop generation
 */

import { Clip } from '../timeline/types';

// =============================================================================
// Audio Reversal
// =============================================================================

/**
 * Create a truly reversed AudioBuffer
 * Reverses the actual sample data
 */
export async function reverseAudioBuffer(
  audioContext: AudioContext,
  buffer: AudioBuffer
): Promise<AudioBuffer> {
  const reversed = audioContext.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const originalData = buffer.getChannelData(channel);
    const reversedData = reversed.getChannelData(channel);

    // Reverse samples
    for (let i = 0; i < buffer.length; i++) {
      reversedData[i] = originalData[buffer.length - 1 - i];
    }
  }

  return reversed;
}

/**
 * Check if an audio buffer is reversed (compares first and last samples)
 * This is a heuristic check
 */
export function isBufferReversed(original: AudioBuffer, toCheck: AudioBuffer): boolean {
  if (original.length !== toCheck.length) return false;
  
  const originalStart = original.getChannelData(0)[0];
  const originalEnd = original.getChannelData(0)[original.length - 1];
  const checkStart = toCheck.getChannelData(0)[0];
  const checkEnd = toCheck.getChannelData(0)[toCheck.length - 1];
  
  // If the start of original matches end of check (approximately), it's reversed
  return Math.abs(originalStart - checkEnd) < 0.001 && 
         Math.abs(originalEnd - checkStart) < 0.001;
}

// =============================================================================
// Clip Gain
// =============================================================================

/**
 * Calculate gain value from dB
 */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Calculate dB from gain value
 */
export function gainToDb(gain: number): number {
  return 20 * Math.log10(gain);
}

/**
 * Apply gain to clip
 */
export function setClipGain(clip: Clip, gainDb: number): Clip {
  const gain = dbToGain(gainDb);
  return {
    ...clip,
    gain,
  } as Clip;
}

/**
 * Apply gain multiplier to clip
 */
export function multiplyClipGain(clip: Clip, multiplier: number): Clip {
  return {
    ...clip,
    gain: ((clip as any).gain || 1) * multiplier,
  } as Clip;
}

/**
 * Normalize clip gain based on peak amplitude
 */
export function calculateNormalizationGain(
  buffer: AudioBuffer,
  targetPeak: number = 0.95
): number {
  let peak = 0;

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }

  if (peak === 0) return 1;
  return targetPeak / peak;
}

// =============================================================================
// Peak Detection
// =============================================================================

/**
 * Find peak amplitude in buffer
 */
export function findPeakAmplitude(buffer: AudioBuffer): number {
  let peak = 0;

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }

  return peak;
}

/**
 * Find RMS (root mean square) level
 */
export function calculateRMS(buffer: AudioBuffer): number {
  let sum = 0;
  let count = 0;

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
      count++;
    }
  }

  return Math.sqrt(sum / count);
}

/**
 * Find true peak (inter-sample peak) using 4x oversampling
 */
export function findTruePeak(buffer: AudioBuffer): number {
  // Simplified true peak detection
  // In production, use proper oversampling
  let truePeak = 0;
  const oversampleFactor = 4;

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    
    for (let i = 0; i < data.length - 1; i++) {
      const current = data[i];
      const next = data[i + 1];
      
      // Linear interpolation for oversampling
      for (let j = 1; j < oversampleFactor; j++) {
        const t = j / oversampleFactor;
        const interpolated = current + (next - current) * t;
        const abs = Math.abs(interpolated);
        if (abs > truePeak) truePeak = abs;
      }
    }
  }

  return truePeak;
}

// =============================================================================
// Loop Generation
// =============================================================================

/**
 * Create looped audio buffer
 * Repeats the audio data to match clip duration
 */
export async function createLoopedBuffer(
  audioContext: AudioContext,
  sourceBuffer: AudioBuffer,
  clipDuration: number,
  tempo: number,
  playbackRate: number = 1
): Promise<AudioBuffer> {
  // Calculate required duration in samples
  const durationSeconds = (clipDuration * 60) / tempo / playbackRate;
  const requiredSamples = Math.ceil(durationSeconds * sourceBuffer.sampleRate);
  
  const looped = audioContext.createBuffer(
    sourceBuffer.numberOfChannels,
    requiredSamples,
    sourceBuffer.sampleRate
  );

  for (let channel = 0; channel < sourceBuffer.numberOfChannels; channel++) {
    const sourceData = sourceBuffer.getChannelData(channel);
    const loopedData = looped.getChannelData(channel);
    
    // Loop the data
    for (let i = 0; i < requiredSamples; i++) {
      const sourceIdx = i % sourceData.length;
      loopedData[i] = sourceData[sourceIdx];
    }
  }

  return looped;
}

/**
 * Create seamless loop with crossfade at loop point
 */
export async function createSeamlessLoop(
  audioContext: AudioContext,
  sourceBuffer: AudioBuffer,
  clipDuration: number,
  tempo: number,
  crossfadeDuration: number = 0.01,
  playbackRate: number = 1
): Promise<AudioBuffer> {
  const crossfadeSamples = Math.ceil(crossfadeDuration * sourceBuffer.sampleRate);
  const sourceLength = sourceBuffer.length;
  
  // Calculate required duration
  const durationSeconds = (clipDuration * 60) / tempo / playbackRate;
  const requiredSamples = Math.ceil(durationSeconds * sourceBuffer.sampleRate);
  
  const looped = audioContext.createBuffer(
    sourceBuffer.numberOfChannels,
    requiredSamples,
    sourceBuffer.sampleRate
  );

  for (let channel = 0; channel < sourceBuffer.numberOfChannels; channel++) {
    const sourceData = sourceBuffer.getChannelData(channel);
    const loopedData = looped.getChannelData(channel);
    
    // First loop iteration (full)
    for (let i = 0; i < sourceLength && i < requiredSamples; i++) {
      loopedData[i] = sourceData[i];
    }
    
    // Subsequent loops with crossfade
    let destIdx = sourceLength;
    while (destIdx < requiredSamples) {
      const remaining = requiredSamples - destIdx;
      const toCopy = Math.min(sourceLength, remaining);
      
      for (let i = 0; i < toCopy && destIdx < requiredSamples; i++) {
        const sourceIdx = i;
        
        // Apply crossfade at loop boundaries
        if (i < crossfadeSamples) {
          const fadeIn = i / crossfadeSamples;
          const fadeOut = 1 - fadeIn;
          const prevIdx = destIdx - crossfadeSamples + i;
          loopedData[destIdx] = sourceData[sourceIdx] * fadeIn + 
                                (prevIdx >= 0 ? loopedData[prevIdx] * fadeOut : 0);
        } else {
          loopedData[destIdx] = sourceData[sourceIdx];
        }
        
        destIdx++;
      }
    }
  }

  return looped;
}

// =============================================================================
// Audio Processing Utilities
// =============================================================================

/**
 * Apply fade curve to buffer
 */
export function applyFadeCurveToBuffer(
  buffer: AudioBuffer,
  fadeInDuration: number = 0,
  fadeOutDuration: number = 0,
  curveType: 'linear' | 'exponential' = 'exponential'
): AudioBuffer {
  const processed = new AudioBuffer({
    length: buffer.length,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
  });

  const fadeInSamples = Math.floor(fadeInDuration * buffer.sampleRate);
  const fadeOutSamples = Math.floor(fadeOutDuration * buffer.sampleRate);

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const sourceData = buffer.getChannelData(channel);
    const destData = processed.getChannelData(channel);

    for (let i = 0; i < buffer.length; i++) {
      let gain = 1;

      // Apply fade in
      if (i < fadeInSamples) {
        const t = i / fadeInSamples;
        gain = curveType === 'exponential' ? t * t : t;
      }

      // Apply fade out
      if (i >= buffer.length - fadeOutSamples) {
        const t = (buffer.length - 1 - i) / fadeOutSamples;
        const fadeOutGain = curveType === 'exponential' ? t * t : t;
        gain = Math.min(gain, fadeOutGain);
      }

      destData[i] = sourceData[i] * gain;
    }
  }

  return processed;
}

/**
 * Mix two audio buffers
 */
export function mixBuffers(
  bufferA: AudioBuffer,
  bufferB: AudioBuffer,
  mixGainA: number = 0.5,
  mixGainB: number = 0.5
): AudioBuffer {
  const maxLength = Math.max(bufferA.length, bufferB.length);
  const numChannels = Math.max(bufferA.numberOfChannels, bufferB.numberOfChannels);
  const sampleRate = bufferA.sampleRate;

  const mixed = new AudioBuffer({
    length: maxLength,
    numberOfChannels: numChannels,
    sampleRate,
  });

  for (let channel = 0; channel < numChannels; channel++) {
    const aData = channel < bufferA.numberOfChannels ? bufferA.getChannelData(channel) : null;
    const bData = channel < bufferB.numberOfChannels ? bufferB.getChannelData(channel) : null;
    const destData = mixed.getChannelData(channel);

    for (let i = 0; i < maxLength; i++) {
      const aSample = aData && i < aData.length ? aData[i] * mixGainA : 0;
      const bSample = bData && i < bData.length ? bData[i] * mixGainB : 0;
      destData[i] = aSample + bSample;
    }
  }

  return mixed;
}

/**
 * Trim audio buffer to specific range
 */
export function trimBuffer(
  buffer: AudioBuffer,
  startTime: number,
  duration: number
): AudioBuffer {
  const startSample = Math.floor(startTime * buffer.sampleRate);
  const endSample = Math.floor((startTime + duration) * buffer.sampleRate);
  const length = Math.min(endSample - startSample, buffer.length - startSample);

  const trimmed = new AudioBuffer({
    length,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
  });

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const sourceData = buffer.getChannelData(channel);
    const destData = trimmed.getChannelData(channel);

    for (let i = 0; i < length; i++) {
      destData[i] = sourceData[startSample + i] || 0;
    }
  }

  return trimmed;
}

// =============================================================================
// Export
// =============================================================================

export const ClipDSP = {
  reverseAudioBuffer,
  isBufferReversed,
  dbToGain,
  gainToDb,
  setClipGain,
  multiplyClipGain,
  calculateNormalizationGain,
  findPeakAmplitude,
  calculateRMS,
  findTruePeak,
  createLoopedBuffer,
  createSeamlessLoop,
  applyFadeCurveToBuffer,
  mixBuffers,
  trimBuffer,
};

export default ClipDSP;
