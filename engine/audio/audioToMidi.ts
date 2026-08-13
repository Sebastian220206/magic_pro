/**
 * Audio-to-MIDI Transcription - Convert audio to MIDI notes
 *
 * Features:
 * - Monophonic pitch detection (YIN algorithm)
 * - Polyphonic pitch detection (spectral peak picking)
 * - Onset detection for note boundaries
 * - Note merging and splitting
 * - Velocity estimation from amplitude
 * - Real-time transcription
 *
 * Based on:
 * - YIN algorithm for fundamental frequency detection
 * - Spectral peak picking for polyphonic detection
 * - Energy-based onset detection
 */

import { MidiNote, createNote, clampPitch, clampVelocity } from '../midi/types';

export interface AudioToMidiOptions {
  /** Detection mode */
  mode: 'monophonic' | 'polyphonic';
  /** Minimum frequency to detect (Hz) */
  minFrequency: number;
  /** Maximum frequency to detect (Hz) */
  maxFrequency: number;
  /** Onset detection threshold (0-1) */
  onsetThreshold: number;
  /** Minimum note duration in seconds */
  minNoteDuration: number;
  /** Merge notes closer than this (seconds) */
  mergeThreshold: number;
  /** Quantize to grid */
  quantize: boolean;
  /** Grid resolution in beats */
  gridResolution: number;
  /** Velocity sensitivity */
  velocitySensitivity: number;
}

export interface TranscriptionResult {
  /** Detected MIDI notes */
  notes: MidiNote[];
  /** Detected onsets in seconds */
  onsets: number[];
  /** Confidence scores (0-1) */
  confidence: number[];
  /** Processing time in ms */
  processingTime: number;
}

export interface OnsetDetectionOptions {
  /** Algorithm */
  algorithm: 'energy' | 'spectral' | 'complex';
  /** Threshold */
  threshold: number;
  /** Minimum inter-onset interval (ms) */
  minIOI: number;
  /** Pre-peak look-ahead (ms) */
  lookAhead: number;
}

const DEFAULT_OPTIONS: AudioToMidiOptions = {
  mode: 'monophonic',
  minFrequency: 50,
  maxFrequency: 4000,
  onsetThreshold: 0.3,
  minNoteDuration: 0.05,
  mergeThreshold: 0.03,
  quantize: false,
  gridResolution: 0.25,
  velocitySensitivity: 0.5,
};

export class AudioToMidi {
  private options: AudioToMidiOptions;
  private sampleRate: number;

  constructor(sampleRate: number, options: Partial<AudioToMidiOptions> = {}) {
    this.sampleRate = sampleRate;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Transcribe audio to MIDI notes
   */
  transcribe(audio: Float32Array): TranscriptionResult {
    const startTime = performance.now();

    // Detect onsets
    const onsets = this.detectOnsets(audio);

    // Detect pitches
    const pitches = this.options.mode === 'monophonic'
      ? this.detectPitchesMonophonic(audio)
      : this.detectPitchesPolyphonic(audio);

    // Create notes from onsets and pitches
    const notes = this.createNotes(onsets, pitches, audio);

    // Merge close notes
    const mergedNotes = this.mergeNotes(notes);

    // Quantize if requested
    const finalNotes = this.options.quantize
      ? this.quantizeNotes(mergedNotes)
      : mergedNotes;

    return {
      notes: finalNotes,
      onsets,
      confidence: pitches.map(p => p.confidence),
      processingTime: performance.now() - startTime,
    };
  }

  /**
   * Detect onsets using energy-based method
   */
  detectOnsets(audio: Float32Array): number[] {
    const frameSize = Math.floor(this.sampleRate * 0.01);  // 10ms frames
    const hopSize = Math.floor(frameSize / 2);
    const numFrames = Math.floor((audio.length - frameSize) / hopSize);

    // Compute energy envelope
    const energy = new Float32Array(numFrames);
    for (let i = 0; i < numFrames; i++) {
      let sum = 0;
      for (let j = 0; j < frameSize; j++) {
        const sample = audio[i * hopSize + j] ?? 0;
        sum += sample * sample;
      }
      energy[i] = Math.sqrt(sum / frameSize);
    }

    // Compute spectral flux
    const flux = new Float32Array(numFrames);
    let prevSpectrum = new Float32Array(frameSize / 2 + 1);

    for (let i = 0; i < numFrames; i++) {
      const frame = new Float32Array(frameSize);
      for (let j = 0; j < frameSize; j++) {
        frame[j] = (audio[i * hopSize + j] ?? 0) * (0.54 - 0.46 * Math.cos((2 * Math.PI * j) / (frameSize - 1)));
      }

      // Simple DFT magnitude
      const spectrum = new Float32Array(frameSize / 2 + 1);
      for (let k = 0; k < spectrum.length; k++) {
        let re = 0;
        let im = 0;
        for (let n = 0; n < frameSize; n++) {
          const angle = (-2 * Math.PI * k * n) / frameSize;
          re += frame[n] * Math.cos(angle);
          im += frame[n] * Math.sin(angle);
        }
        spectrum[k] = Math.sqrt(re * re + im * im);
      }

      // Spectral flux (positive differences)
      let sumFlux = 0;
      for (let k = 0; k < spectrum.length; k++) {
        const diff = spectrum[k] - (prevSpectrum[k] ?? 0);
        if (diff > 0) sumFlux += diff;
      }
      flux[i] = sumFlux;
      prevSpectrum = spectrum;
    }

    // Adaptive threshold
    const threshold = this.computeAdaptiveThreshold(flux, this.options.onsetThreshold);

    // Peak picking
    const onsets: number[] = [];
    const minIOI = Math.floor(0.03 * this.sampleRate / hopSize);  // 30ms minimum

    for (let i = 1; i < numFrames - 1; i++) {
      if (
        flux[i] > threshold[i] &&
        flux[i] > flux[i - 1] &&
        flux[i] >= flux[i + 1] &&
        (onsets.length === 0 || i - onsets[onsets.length - 1] > minIOI)
      ) {
        onsets.push(i);
      }
    }

    // Convert frame indices to seconds
    return onsets.map(i => (i * hopSize) / this.sampleRate);
  }

  /**
   * Compute adaptive threshold for onset detection
   */
  private computeAdaptiveThreshold(flux: Float32Array, sensitivity: number): Float32Array {
    const threshold = new Float32Array(flux.length);
    const windowSize = 50;

    for (let i = 0; i < flux.length; i++) {
      // Local mean
      let sum = 0;
      let count = 0;
      for (let j = Math.max(0, i - windowSize); j < i; j++) {
        sum += flux[j];
        count++;
      }
      const mean = count > 0 ? sum / count : 0;

      // Adaptive threshold
      threshold[i] = mean + sensitivity * Math.max(...flux.slice(Math.max(0, i - windowSize), i));
    }

    return threshold;
  }

  /**
   * Detect pitches using YIN algorithm (monophonic)
   */
  detectPitchesMonophonic(audio: Float32Array): Array<{ time: number; frequency: number; confidence: number }> {
    const pitches: Array<{ time: number; frequency: number; confidence: number }> = [];
    const frameSize = Math.floor(this.sampleRate * 0.05);  // 50ms frames
    const hopSize = Math.floor(frameSize / 4);

    const minPeriod = Math.floor(this.sampleRate / this.options.maxFrequency);
    const maxPeriod = Math.ceil(this.sampleRate / this.options.minFrequency);

    for (let start = 0; start + maxPeriod < audio.length; start += hopSize) {
      const frame = audio.slice(start, start + frameSize);
      const { frequency, confidence } = this.yinDetect(frame, minPeriod, maxPeriod);

      if (confidence > 0.5) {
        pitches.push({
          time: start / this.sampleRate,
          frequency,
          confidence,
        });
      }
    }

    return pitches;
  }

  /**
   * YIN pitch detection algorithm
   */
  private yinDetect(
    frame: Float32Array,
    minPeriod: number,
    maxPeriod: number
  ): { frequency: number; confidence: number } {
    const N = frame.length;
    const halfN = Math.floor(N / 2);
    const tauMax = Math.min(maxPeriod, halfN - 1);
    if (tauMax <= minPeriod) return { frequency: 0, confidence: 0 };

    /*
     * Step 1-2: difference function, then the cumulative mean normalised
     * difference.
     *
     * Both run from tau = 1, not from minPeriod. The running mean in step 2 is
     * over *all* smaller lags, so starting the difference function at minPeriod
     * left zeros in the sum, deflating the denominator for every tau.
     */
    const diff = new Float32Array(tauMax + 1);
    for (let tau = 1; tau <= tauMax; tau++) {
      let sum = 0;
      for (let j = 0; j < halfN; j++) {
        const delta = frame[j] - (frame[j + tau] ?? 0);
        sum += delta * delta;
      }
      diff[tau] = sum;
    }

    const cmnd = new Float32Array(tauMax + 1);
    cmnd[0] = 1;
    let running = 0;
    for (let tau = 1; tau <= tauMax; tau++) {
      running += diff[tau];
      cmnd[tau] = running === 0 ? 1 : (diff[tau] * tau) / running;
    }

    /*
     * Step 3: absolute threshold — the *first* dip below it, not the deepest.
     *
     * The difference function dips again at every multiple of the true period,
     * and those dips are often deeper. Taking the global minimum therefore
     * reports an integer fraction of the true frequency: a 440 Hz tone came
     * back as 110 Hz, two octaves down.
     */
    const THRESHOLD = 0.15;
    let bestTau = -1;
    for (let tau = minPeriod; tau <= tauMax; tau++) {
      if (cmnd[tau] < THRESHOLD) {
        // Walk to the bottom of this dip.
        while (tau + 1 <= tauMax && cmnd[tau + 1] < cmnd[tau]) tau++;
        bestTau = tau;
        break;
      }
    }

    // Nothing cleared the threshold: fall back to the shallowest dip in range.
    if (bestTau === -1) {
      let lowest = Infinity;
      for (let tau = minPeriod; tau <= tauMax; tau++) {
        if (cmnd[tau] < lowest) { lowest = cmnd[tau]; bestTau = tau; }
      }
      if (bestTau === -1 || lowest > 0.6) return { frequency: 0, confidence: 0 };
    }

    /* Step 4: parabolic interpolation around the dip, for sub-sample accuracy. */
    let refined = bestTau;
    if (bestTau > 0 && bestTau < tauMax) {
      const a = cmnd[bestTau - 1];
      const b = cmnd[bestTau];
      const c = cmnd[bestTau + 1];
      const denom = 2 * (2 * b - a - c);
      if (denom !== 0) refined = bestTau + (c - a) / denom;
    }

    if (refined <= 0) return { frequency: 0, confidence: 0 };
    return {
      frequency: this.sampleRate / refined,
      confidence: Math.max(0, Math.min(1, 1 - cmnd[bestTau])),
    };
  }

  /**
   * Detect pitches using spectral peak picking (polyphonic)
   */
  detectPitchesPolyphonic(audio: Float32Array): Array<{ time: number; frequency: number; confidence: number }> {
    const pitches: Array<{ time: number; frequency: number; confidence: number }> = [];
    const frameSize = 2048;
    const hopSize = 512;
    const numBins = frameSize / 2 + 1;
    const freqResolution = this.sampleRate / frameSize;

    for (let start = 0; start + frameSize <= audio.length; start += hopSize) {
      // Window frame
      const frame = new Float32Array(frameSize);
      for (let i = 0; i < frameSize; i++) {
        frame[i] = (audio[start + i] ?? 0) * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (frameSize - 1)));
      }

      // FFT magnitude
      const spectrum = new Float32Array(numBins);
      for (let k = 0; k < numBins; k++) {
        let re = 0;
        let im = 0;
        for (let n = 0; n < frameSize; n++) {
          const angle = (-2 * Math.PI * k * n) / frameSize;
          re += frame[n] * Math.cos(angle);
          im += frame[n] * Math.sin(angle);
        }
        spectrum[k] = Math.sqrt(re * re + im * im);
      }

      // Find peaks
      const minBin = Math.floor(this.options.minFrequency / freqResolution);
      const maxBin = Math.min(numBins - 1, Math.floor(this.options.maxFrequency / freqResolution));

      for (let k = minBin + 1; k < maxBin; k++) {
        if (spectrum[k] > spectrum[k - 1] && spectrum[k] > spectrum[k + 1]) {
          const freq = k * freqResolution;
          const conf = spectrum[k] / (Math.max(...spectrum) || 1);

          if (conf > 0.2) {
            pitches.push({
              time: start / this.sampleRate,
              frequency: freq,
              confidence: conf,
            });
          }
        }
      }
    }

    return pitches;
  }

  /**
   * Create notes from onsets and pitches
   */
  private createNotes(
    onsets: number[],
    pitches: Array<{ time: number; frequency: number; confidence: number }>,
    audio: Float32Array
  ): MidiNote[] {
    const notes: MidiNote[] = [];
    const bpm = 120;  // Default BPM for beat calculation

    for (let i = 0; i < onsets.length; i++) {
      const startTime = onsets[i];
      const endTime = i < onsets.length - 1 ? onsets[i + 1] : audio.length / this.sampleRate;

      // Find pitch at this onset
      const pitchData = pitches.find(p => Math.abs(p.time - startTime) < 0.05);
      if (!pitchData || pitchData.frequency <= 0) continue;

      // Convert frequency to MIDI note
      const midiNote = Math.round(12 * Math.log2(pitchData.frequency / 440) + 69);
      if (midiNote < 0 || midiNote > 127) continue;

      // Calculate velocity from amplitude
      const velocity = this.estimateVelocity(audio, startTime, endTime);

      // Convert time to beats
      const startBeat = (startTime * bpm) / 60;
      const durationBeats = ((endTime - startTime) * bpm) / 60;

      notes.push(createNote(
        midiNote,
        startBeat,
        Math.max(0.25, durationBeats),
        velocity
      ));
    }

    return notes;
  }

  /**
   * Estimate velocity from audio amplitude
   */
  private estimateVelocity(
    audio: Float32Array,
    startTime: number,
    endTime: number
  ): number {
    const startSample = Math.floor(startTime * this.sampleRate);
    const endSample = Math.floor(endTime * this.sampleRate);

    let sum = 0;
    let count = 0;
    for (let i = startSample; i < endSample && i < audio.length; i++) {
      sum += Math.abs(audio[i] ?? 0);
      count++;
    }

    const rms = count > 0 ? sum / count : 0;
    const velocity = Math.round(40 + rms * 80 * (1 + this.options.velocitySensitivity));

    return clampVelocity(velocity);
  }

  /**
   * Merge notes that are close together
   */
  private mergeNotes(notes: MidiNote[]): MidiNote[] {
    if (notes.length === 0) return notes;

    const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat);
    const merged: MidiNote[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const prev = merged[merged.length - 1];
      const curr = sorted[i];

      // Check if notes should be merged
      const gap = curr.startBeat - (prev.startBeat + prev.duration);
      const samePitch = curr.pitch === prev.pitch;
      const closeEnough = gap < this.options.mergeThreshold * 2;  // Convert seconds to beats approximation

      if (samePitch && closeEnough) {
        // Extend previous note
        prev.duration = (curr.startBeat + curr.duration) - prev.startBeat;
        prev.velocity = Math.max(prev.velocity, curr.velocity);
      } else {
        merged.push(curr);
      }
    }

    return merged;
  }

  /**
   * Quantize notes to grid
   */
  private quantizeNotes(notes: MidiNote[]): MidiNote[] {
    return notes.map(note => {
      const quantizedBeat = Math.round(note.startBeat / this.options.gridResolution) * this.options.gridResolution;
      return {
        ...note,
        startBeat: quantizedBeat,
      };
    });
  }

  /**
   * Set options
   */
  setOptions(options: Partial<AudioToMidiOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get options
   */
  getOptions(): Readonly<AudioToMidiOptions> {
    return this.options;
  }
}

export default AudioToMidi;
