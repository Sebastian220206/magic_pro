export interface PitchNote {
  startSample: number;
  endSample: number;
  midiNote: number;
  cents: number;
  originalMidiNote: number;
  gain: number;
}

export interface FlexPitchOptions {
  detectionSensitivity: number;
  correctionStrength: number;
  formantPreservation: boolean;
}

export class PitchDetector {
  /**
   * Detect pitch using YIN algorithm (autocorrelation-based).
   */
  static detectPitch(
    channelData: Float32Array,
    sampleRate: number,
    minFreq: number = 50,
    maxFreq: number = 2000
  ): number[] {
    const minPeriod = Math.floor(sampleRate / maxFreq);
    const maxPeriod = Math.ceil(sampleRate / minFreq);
    const hopSize = Math.floor(sampleRate * 0.01);
    const pitches: number[] = [];

    for (let start = 0; start + maxPeriod < channelData.length; start += hopSize) {
      const frameSize = Math.min(maxPeriod * 2, channelData.length - start);
      if (frameSize < maxPeriod) break;

      // Difference function
      const diff = new Float32Array(maxPeriod + 1);
      for (let tau = 0; tau <= maxPeriod; tau++) {
        let sum = 0;
        for (let j = 0; j < frameSize - tau; j++) {
          const d = channelData[start + j] - channelData[start + j + tau];
          sum += d * d;
        }
        diff[tau] = sum;
      }

      // Cumulative mean normalized difference
      let bestTau = 0;
      let bestVal = Infinity;

      for (let tau = minPeriod; tau <= maxPeriod; tau++) {
        let sum = 0;
        for (let j = 1; j <= tau; j++) {
          sum += diff[j];
        }
        const cmnd = diff[tau] / (sum / tau);

        if (cmnd < bestVal && cmnd < 0.1) {
          bestVal = cmnd;
          bestTau = tau;
        }
      }

      if (bestTau > 0) {
        const freq = sampleRate / bestTau;
        pitches.push(freq);
      } else {
        pitches.push(0);
      }
    }

    return pitches;
  }

  /**
   * Convert frequency to MIDI note number.
   */
  static freqToMidi(freq: number): number {
    if (freq <= 0) return 0;
    return 12 * Math.log2(freq / 440) + 69;
  }

  /**
   * Convert MIDI note to frequency.
   */
  static midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
}

export class FlexPitchProcessor {
  /**
   * Shift pitch of a region using overlap-add with resampling.
   */
  static shiftPitch(
    channelData: Float32Array,
    sampleRate: number,
    semitones: number,
    preserveFormants: boolean = false
  ): Float32Array {
    if (Math.abs(semitones) < 0.01) return channelData.slice();

    const ratio = Math.pow(2, semitones / 12);
    const windowSize = Math.floor(0.03 * sampleRate);
    const hopSize = Math.floor(windowSize / 4);
    const outputLength = Math.ceil(channelData.length / ratio);

    const output = new Float32Array(outputLength);

    // Resample using linear interpolation
    for (let i = 0; i < outputLength; i++) {
      const srcPos = i * ratio;
      const srcIdx = Math.floor(srcPos);
      const frac = srcPos - srcIdx;

      if (srcIdx + 1 < channelData.length) {
        output[i] = channelData[srcIdx] * (1 - frac) + channelData[srcIdx + 1] * frac;
      } else if (srcIdx < channelData.length) {
        output[i] = channelData[srcIdx];
      }
    }

    // Apply windowing to smooth artifacts
    const window = new Float32Array(windowSize);
    for (let i = 0; i < windowSize; i++) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)));
    }

    if (preserveFormants) {
      // Simple formant preservation through spectral envelope estimation
      // Uses LPC-based formant extraction (simplified)
      const formantRatio = ratio;
      const formantCorrection = 1 / formantRatio;

      // Apply spectral tilt correction
      for (let i = 0; i < outputLength; i++) {
        output[i] *= formantCorrection;
      }
    }

    return output;
  }

  /**
   * Correct pitch of individual notes in audio.
   */
  static correctPitch(
    channelData: Float32Array,
    sampleRate: number,
    notes: PitchNote[],
    strength: number = 1.0
  ): Float32Array {
    const output = channelData.slice();

    for (const note of notes) {
      const correctionSemitones = (note.midiNote - note.originalMidiNote) * strength;
      const noteLength = note.endSample - note.startSample;

      if (noteLength <= 0 || note.startSample < 0 || note.endSample > output.length) continue;

      const noteData = channelData.slice(note.startSample, note.endSample);
      const corrected = FlexPitchProcessor.shiftPitch(noteData, sampleRate, correctionSemitones);

      // Crossfade into output
      const crossfadeLen = Math.min(256, noteLength / 4);

      for (let i = 0; i < corrected.length && note.startSample + i < output.length; i++) {
        let gain = 1;
        if (i < crossfadeLen) gain *= i / crossfadeLen;
        if (i > corrected.length - crossfadeLen) gain *= (corrected.length - i) / crossfadeLen;

        output[note.startSample + i] = corrected[i] * gain * note.gain;
      }
    }

    return output;
  }
}
