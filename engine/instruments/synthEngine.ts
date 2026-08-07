/**
 * Polyphonic Synth Engine
 * Web Audio API based synthesizer with oscillators, filter, ADSR envelope,
 * LFO modulation, and wavetable support.
 */

import { SynthLFO, type LFOParams, defaultLFOParams } from './synthLfo';
import {
  wavetablePresets,
  createWavetableOscillator,
  type WavetableData,
} from './wavetableOscillator';

export type { LFOParams } from './synthLfo';
export type { WavetableData } from './wavetableOscillator';

export interface ADSREnvelope {
  attack: number;    // seconds
  decay: number;   // seconds
  sustain: number; // 0-1 amplitude
  release: number; // seconds
}

export interface FilterParams {
  type: BiquadFilterType;
  frequency: number; // Hz
  resonance: number; // Q value 0-25
}

export interface OscillatorParams {
  type: OscillatorType;
  detune: number; // cents
  mix: number;  // 0-1 blend for multiple oscillators
  wavetable?: string; // wavetable preset name (overrides type if set)
}

export interface SynthPreset {
  name: string;
  oscillators: OscillatorParams[];
  filter: FilterParams;
  envelope: ADSREnvelope;
  polyphony: number;
  portamento?: number; // seconds for glide
  lfo?: LFOParams;    // LFO modulation settings
}

// Built-in synth presets
export const synthPresets: Record<string, SynthPreset> = {
  analog_pad: {
    name: 'Analog Pad',
    oscillators: [
      { type: 'sawtooth', detune: -7, mix: 0.5 },
      { type: 'sawtooth', detune: 7, mix: 0.5 },
    ],
    filter: { type: 'lowpass', frequency: 800, resonance: 2 },
    envelope: { attack: 0.3, decay: 0.5, sustain: 0.7, release: 1.5 },
    polyphony: 8,
  },
  lead_synth: {
    name: 'Lead Synth',
    oscillators: [
      { type: 'sawtooth', detune: 0, mix: 0.7 },
      { type: 'square', detune: 12, mix: 0.3 },
    ],
    filter: { type: 'lowpass', frequency: 2000, resonance: 5 },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.6, release: 0.4 },
    polyphony: 6,
    portamento: 0.05,
  },
  warm_strings: {
    name: 'Warm Strings',
    oscillators: [
      { type: 'sawtooth', detune: -10, mix: 0.4 },
      { type: 'sawtooth', detune: 0, mix: 0.3 },
      { type: 'sawtooth', detune: 10, mix: 0.3 },
    ],
    filter: { type: 'lowpass', frequency: 1200, resonance: 1 },
    envelope: { attack: 0.4, decay: 0.6, sustain: 0.8, release: 1.2 },
    polyphony: 10,
  },
  deep_bass: {
    name: 'Deep Bass',
    oscillators: [
      { type: 'sawtooth', detune: 0, mix: 0.5 },
      { type: 'square', detune: -12, mix: 0.5 },
    ],
    filter: { type: 'lowpass', frequency: 400, resonance: 3 },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.3 },
    polyphony: 4,
  },
  hammond_organ: {
    name: 'Hammond Organ',
    oscillators: [
      { type: 'square', detune: 0, mix: 0.25 },
      { type: 'sawtooth', detune: 0, mix: 0.25 },
      { type: 'triangle', detune: 0, mix: 0.5 },
    ],
    filter: { type: 'lowpass', frequency: 3000, resonance: 1 },
    envelope: { attack: 0.02, decay: 0.1, sustain: 1, release: 0.1 },
    polyphony: 8,
  },
  clavinet: {
    name: 'Clavinet',
    oscillators: [
      { type: 'sawtooth', detune: -5, mix: 0.4 },
      { type: 'square', detune: 5, mix: 0.6 },
    ],
    filter: { type: 'highpass', frequency: 200, resonance: 0 },
    envelope: { attack: 0.005, decay: 0.3, sustain: 0.2, release: 0.2 },
    polyphony: 6,
  },

  // Wavetable presets with LFO
  wavetable_lead: {
    name: 'Wavetable Lead',
    oscillators: [
      { type: 'sawtooth', detune: 0, mix: 0.6, wavetable: 'rich' },
      { type: 'sawtooth', detune: 7, mix: 0.4, wavetable: 'smooth' },
    ],
    filter: { type: 'lowpass', frequency: 2500, resonance: 4 },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.3 },
    polyphony: 8,
    lfo: { rate: 5.0, depth: 0.3, target: 'filter', waveform: 'sine' },
  },
  wavetable_pad: {
    name: 'Wavetable Pad',
    oscillators: [
      { type: 'sawtooth', detune: -8, mix: 0.3, wavetable: 'smooth' },
      { type: 'sawtooth', detune: 0, mix: 0.4, wavetable: 'rich' },
      { type: 'sawtooth', detune: 8, mix: 0.3, wavetable: 'smooth' },
    ],
    filter: { type: 'lowpass', frequency: 1000, resonance: 2 },
    envelope: { attack: 0.5, decay: 0.8, sustain: 0.8, release: 2.0 },
    polyphony: 10,
    lfo: { rate: 0.3, depth: 0.4, target: 'filter', waveform: 'sine' },
  },
  wavetable_bass: {
    name: 'Wavetable Bass',
    oscillators: [
      { type: 'sawtooth', detune: 0, mix: 0.7, wavetable: 'gritty' },
      { type: 'square', detune: -12, mix: 0.3, wavetable: 'square' },
    ],
    filter: { type: 'lowpass', frequency: 500, resonance: 3 },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.9, release: 0.2 },
    polyphony: 4,
    lfo: { rate: 0.5, depth: 0.2, target: 'pitch', waveform: 'sine' },
  },
  evolving_pad: {
    name: 'Evolving Pad',
    oscillators: [
      { type: 'sawtooth', detune: -5, mix: 0.3, wavetable: 'rich' },
      { type: 'sawtooth', detune: 5, mix: 0.3, wavetable: 'gritty' },
      { type: 'sawtooth', detune: 0, mix: 0.4, wavetable: 'smooth' },
    ],
    filter: { type: 'lowpass', frequency: 800, resonance: 1 },
    envelope: { attack: 1.0, decay: 1.0, sustain: 0.8, release: 3.0 },
    polyphony: 8,
    lfo: { rate: 0.2, depth: 0.5, target: 'filter', waveform: 'triangle' },
  },
};

/**
 * Convert MIDI note to frequency
 */
export function midiToFrequency(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/**
 * Individual synth voice
 */
class SynthVoice {
  private ctx: AudioContext;
  private oscillators: OscillatorNode[] = [];
  private filter: BiquadFilterNode;
  private envelope: GainNode;
  private output: GainNode;
  private params: SynthPreset;
  private lfo: SynthLFO | null = null;
  private isActive = false;
  private currentNote = 0;
  private attackTime = 0;

  constructor(ctx: AudioContext, params: SynthPreset) {
    this.ctx = ctx;
    this.params = params;

    // Create filter
    this.filter = ctx.createBiquadFilter();
    this.filter.type = params.filter.type;
    this.filter.frequency.value = params.filter.frequency;
    this.filter.Q.value = params.filter.resonance;

    // Create envelope gain
    this.envelope = ctx.createGain();
    this.envelope.gain.value = 0;

    // Create output gain
    this.output = ctx.createGain();
    this.output.gain.value = 1.0;

    // Connect: filter -> envelope -> output
    this.filter.connect(this.envelope);
    this.envelope.connect(this.output);
  }

  /**
   * Create LFO and connect to target parameter.
   */
  private setupLFO(): void {
    const lfoParams = this.params.lfo;
    if (!lfoParams || lfoParams.depth === 0) return;

    this.lfo = new SynthLFO(this.ctx, lfoParams);
    this.lfo.start();

    // Determine target parameter
    if (lfoParams.target === 'filter') {
      // Modulate filter cutoff frequency
      this.lfo.connectToParam(
        this.filter.frequency,
        this.params.filter.frequency,
        this.params.filter.frequency * 0.5 // ±50% of base cutoff
      );
    } else if (lfoParams.target === 'pitch') {
      // Modulate oscillator frequency (requires connecting to each osc)
      // Will be connected in noteOn after oscillators are created
    } else if (lfoParams.target === 'amplitude') {
      // Modulate envelope gain
      this.lfo.connectToParam(
        this.envelope.gain,
        0,
        0.5 // ±50% depth
      );
    }
  }

  /**
   * Start playing a note
   */
  noteOn(note: number, velocity: number, startTime?: number): void {
    const time = startTime ?? this.ctx.currentTime;
    const freq = midiToFrequency(note);
    this.currentNote = note;
    this.isActive = true;
    this.attackTime = time + this.params.envelope.attack;

    // Setup LFO for this voice (if not already set up)
    if (!this.lfo && this.params.lfo) {
      this.setupLFO();
    }

    // Create oscillators for this voice
    this.oscillators = this.params.oscillators.map((oscParams) => {
      let osc: OscillatorNode;

      if (oscParams.wavetable) {
        // Use wavetable oscillator
        const wt = wavetablePresets[oscParams.wavetable];
        if (wt) {
          osc = createWavetableOscillator(this.ctx, wt, freq, oscParams.detune);
        } else {
          // Fallback to standard oscillator
          osc = this.ctx.createOscillator();
          osc.type = oscParams.type;
          osc.frequency.value = freq;
          osc.detune.value = oscParams.detune;
        }
      } else {
        // Use standard oscillator
        osc = this.ctx.createOscillator();
        osc.type = oscParams.type;
        osc.frequency.value = freq;
        osc.detune.value = oscParams.detune;
      }

      osc.connect(this.filter);
      osc.start(time);

      // Connect LFO pitch modulation if target is pitch
      if (this.lfo && this.params.lfo?.target === 'pitch') {
        this.lfo.connectToParam(osc.frequency, freq, 50); // ±50 cents
      }

      return osc;
    });

    // Apply velocity scaling
    const velGain = velocity / 127;

    // ADSR Envelope - Attack phase
    this.envelope.gain.cancelScheduledValues(time);
    this.envelope.gain.setValueAtTime(0, time);
    this.envelope.gain.linearRampToValueAtTime(
      velGain,
      time + this.params.envelope.attack
    );

    // Decay phase
    this.envelope.gain.exponentialRampToValueAtTime(
      velGain * this.params.envelope.sustain,
      time + this.params.envelope.attack + this.params.envelope.decay
    );
  }

  /**
   * Stop playing a note
   */
  noteOff(stopTime?: number): void {
    const time = stopTime ?? this.ctx.currentTime;

    // Release phase
    const currentGain = this.envelope.gain.value;
    this.envelope.gain.cancelScheduledValues(time);
    this.envelope.gain.setValueAtTime(currentGain, time);
    this.envelope.gain.exponentialRampToValueAtTime(
      0.001,
      time + this.params.envelope.release
    );

    // Schedule oscillator stop
    const stopAt = time + this.params.envelope.release + 0.01;
    this.oscillators.forEach((osc) => {
      try {
        osc.stop(stopAt);
      } catch {
        // Oscillator already stopped
      }
    });

    // Cleanup after release
    setTimeout(() => {
      this.cleanup();
      this.isActive = false;
    }, (this.params.envelope.release + 0.05) * 1000);
  }

  /**
   * Check if voice is currently playing
   */
  isPlaying(): boolean {
    return this.isActive;
  }

  /**
   * Get the current note being played
   */
  getCurrentNote(): number {
    return this.currentNote;
  }

  /**
   * Get voice output node
   */
  getOutput(): AudioNode {
    return this.output;
  }

  /**
   * Check if voice can be stolen (oldest active voice)
   */
  canSteal(currentTime: number): boolean {
    return this.isActive && this.attackTime < currentTime - 0.1;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.oscillators.forEach((osc) => {
      try {
        osc.disconnect();
      } catch {
        // Already disconnected
      }
    });
    this.oscillators = [];
  }

  /**
   * Dispose of voice completely
   */
  dispose(): void {
    this.cleanup();
    if (this.lfo) {
      this.lfo.dispose();
      this.lfo = null;
    }
    try {
      this.filter.disconnect();
      this.envelope.disconnect();
      this.output.disconnect();
    } catch {
      // Already disconnected
    }
  }
}

/**
 * Polyphonic Synthesizer
 */
export class PolyphonicSynth {
  private ctx: AudioContext;
  private params: SynthPreset;
  private voices: SynthVoice[] = [];
  private masterGain: GainNode;
  private voiceIndex = 0; // Round-robin voice allocation

  constructor(ctx: AudioContext, presetName: string) {
    this.ctx = ctx;
    this.params = synthPresets[presetName] ?? synthPresets.analog_pad;

    // Create master output
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.8;

    // Pre-create voices (voice pooling for performance)
    this.allocateVoices();
  }

  /**
   * Allocate voice pool
   */
  private allocateVoices(): void {
    const polyphony = this.params.polyphony;
    for (let i = 0; i < polyphony; i++) {
      const voice = new SynthVoice(this.ctx, this.params);
      voice.getOutput().connect(this.masterGain);
      this.voices.push(voice);
    }
  }

  /**
   * Find an available voice or steal the oldest one
   */
  private getVoice(): SynthVoice {
    // Try to find an inactive voice
    const inactiveVoice = this.voices.find((v) => !v.isPlaying());
    if (inactiveVoice) {
      return inactiveVoice;
    }

    // Steal the oldest active voice (one that started earliest)
    const currentTime = this.ctx.currentTime;
    const stealableVoice = this.voices.find((v) => v.canSteal(currentTime));
    if (stealableVoice) {
      stealableVoice.noteOff(currentTime);
      return stealableVoice;
    }

    // Fallback: round-robin voice stealing
    const voice = this.voices[this.voiceIndex];
    voice.noteOff(currentTime);
    this.voiceIndex = (this.voiceIndex + 1) % this.voices.length;
    return voice;
  }

  /**
   * Start playing a note
   */
  noteOn(note: number, velocity = 100, time?: number): void {
    // If note is already playing, retrigger it
    const existingVoice = this.voices.find(
      (v) => v.isPlaying() && v.getCurrentNote() === note
    );
    if (existingVoice) {
      existingVoice.noteOff(time);
    }

    const voice = this.getVoice();
    voice.noteOn(note, velocity, time);
  }

  /**
   * Stop playing a note
   */
  noteOff(note: number, time?: number): void {
    const voice = this.voices.find(
      (v) => v.isPlaying() && v.getCurrentNote() === note
    );
    if (voice) {
      voice.noteOff(time);
    }
  }

  /**
   * Stop all notes
   */
  allNotesOff(time?: number): void {
    const stopTime = time ?? this.ctx.currentTime;
    this.voices.forEach((voice) => {
      if (voice.isPlaying()) {
        voice.noteOff(stopTime);
      }
    });
  }

  /**
   * Get output node to connect to mixer
   */
  getOutput(): AudioNode {
    return this.masterGain;
  }

  /**
   * Set master volume
   */
  setVolume(volume: number): void {
    this.masterGain.gain.value = volume;
  }

  /**
   * Get preset parameters
   */
  getParams(): SynthPreset {
    return this.params;
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.voices.forEach((v) => v.dispose());
    this.voices = [];
    try {
      this.masterGain.disconnect();
    } catch {
      // Already disconnected
    }
  }
}

export default PolyphonicSynth;
