/**
 * Polyphonic Synth Engine
 * Web Audio API based synthesizer with oscillators, filter, and ADSR envelope
 */

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
}

export interface SynthPreset {
  name: string;
  oscillators: OscillatorParams[];
  filter: FilterParams;
  envelope: ADSREnvelope;
  polyphony: number;
  portamento?: number; // seconds for glide
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
    this.output.gain.value = 0.3; // Master volume

    // Connect: filter -> envelope -> output
    this.filter.connect(this.envelope);
    this.envelope.connect(this.output);
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

    // Create oscillators for this voice
    this.oscillators = this.params.oscillators.map((oscParams) => {
      const osc = this.ctx.createOscillator();
      osc.type = oscParams.type;
      osc.frequency.value = freq;
      osc.detune.value = oscParams.detune;
      osc.connect(this.filter);
      osc.start(time);
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
    this.masterGain.gain.value = 0.5;

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
