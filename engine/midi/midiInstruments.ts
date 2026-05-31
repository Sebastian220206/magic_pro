/**
 * MIDI Instrument Routing - Connect MIDI clips to instruments
 * 
 * Features:
 * - Synth instrument (oscillator + envelope)
 * - Sampler instrument (AudioBuffer playback)
 * - Instrument registry
 * - MIDI clip to instrument routing
 */

import { MidiInstrument } from './types';

// =============================================================================
// Synth Instrument - Basic oscillator synthesizer
// =============================================================================

export interface SynthOptions {
  waveform?: OscillatorType;
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
}

export class SynthInstrument implements MidiInstrument {
  id: string;
  name: string;
  type: 'synth' = 'synth';
  
  private audioContext: AudioContext;
  private options: Required<SynthOptions>;
  private activeVoices: Map<number, { osc: OscillatorNode; gain: GainNode }> = new Map();

  constructor(audioContext: AudioContext, id: string, options: SynthOptions = {}) {
    this.audioContext = audioContext;
    this.id = id;
    this.name = 'Synth';
    this.options = {
      waveform: options.waveform ?? 'sawtooth',
      attack: options.attack ?? 0.01,
      decay: options.decay ?? 0.1,
      sustain: options.sustain ?? 0.7,
      release: options.release ?? 0.3,
    };
  }

  trigger(pitch: number, startTime: number, duration: number, velocity: number): void {
    const freq = 440 * Math.pow(2, (pitch - 69) / 12);
    const velocityGain = velocity / 127;
    
    // Release any existing voice at this pitch
    this.release(pitch);
    
    // Create oscillator
    const osc = this.audioContext.createOscillator();
    osc.type = this.options.waveform;
    osc.frequency.value = freq;
    
    // Create gain envelope
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 0;
    
    // Connect
    osc.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // ADSR Envelope
    const now = startTime;
    const attackEnd = now + this.options.attack;
    const decayEnd = attackEnd + this.options.decay;
    const releaseStart = now + duration;
    const releaseEnd = releaseStart + this.options.release;
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(velocityGain, attackEnd);
    gainNode.gain.exponentialRampToValueAtTime(
      velocityGain * this.options.sustain,
      decayEnd
    );
    gainNode.gain.setValueAtTime(velocityGain * this.options.sustain, releaseStart);
    gainNode.gain.exponentialRampToValueAtTime(0.001, releaseEnd);
    
    // Start and schedule stop
    osc.start(now);
    osc.stop(releaseEnd);
    
    // Store voice
    this.activeVoices.set(pitch, { osc, gain: gainNode });
    
    // Cleanup after release
    osc.addEventListener('ended', () => {
      this.activeVoices.delete(pitch);
    });
  }

  release(pitch: number): void {
    const voice = this.activeVoices.get(pitch);
    if (voice) {
      const now = this.audioContext.currentTime;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.exponentialRampToValueAtTime(0.001, now + this.options.release);
      voice.osc.stop(now + this.options.release);
      this.activeVoices.delete(pitch);
    }
  }

  setParameter(param: string, value: number): void {
    switch (param) {
      case 'attack':
        this.options.attack = value;
        break;
      case 'decay':
        this.options.decay = value;
        break;
      case 'sustain':
        this.options.sustain = value;
        break;
      case 'release':
        this.options.release = value;
        break;
    }
  }
}

// =============================================================================
// Sampler Instrument - Audio buffer playback
// =============================================================================

export interface SamplerOptions {
  buffer?: AudioBuffer;
  attack?: number;
  release?: number;
  pitchKey?: number; // MIDI pitch that plays at original speed (default 60 = C4)
}

export class SamplerInstrument implements MidiInstrument {
  id: string;
  name: string;
  type: 'sampler' = 'sampler';
  
  private audioContext: AudioContext;
  private options: Required<SamplerOptions>;
  private activeSources: Map<number, AudioBufferSourceNode> = new Map();

  constructor(audioContext: AudioContext, id: string, options: SamplerOptions = {}) {
    this.audioContext = audioContext;
    this.id = id;
    this.name = 'Sampler';
    this.options = {
      buffer: options.buffer ?? null!,
      attack: options.attack ?? 0.001,
      release: options.release ?? 0.1,
      pitchKey: options.pitchKey ?? 60,
    };
  }

  setBuffer(buffer: AudioBuffer): void {
    this.options.buffer = buffer;
  }

  trigger(pitch: number, startTime: number, duration: number, velocity: number): void {
    if (!this.options.buffer) return;
    
    // Calculate playback rate for pitch
    const semitones = pitch - this.options.pitchKey;
    const playbackRate = Math.pow(2, semitones / 12);
    const velocityGain = velocity / 127;
    
    // Release existing voice
    this.release(pitch);
    
    // Create source
    const source = this.audioContext.createBufferSource();
    source.buffer = this.options.buffer;
    source.playbackRate.value = playbackRate;
    
    // Create gain node for envelope
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = velocityGain;
    
    // Connect
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // Envelope
    const now = startTime;
    const attackEnd = now + this.options.attack;
    const releaseStart = now + duration;
    const releaseEnd = releaseStart + this.options.release;
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(velocityGain, attackEnd);
    gainNode.gain.setValueAtTime(velocityGain, releaseStart);
    gainNode.gain.exponentialRampToValueAtTime(0.001, releaseEnd);
    
    // Start and schedule stop
    source.start(now);
    source.stop(releaseEnd);
    
    // Store
    this.activeSources.set(pitch, source);
    
    // Cleanup
    source.addEventListener('ended', () => {
      this.activeSources.delete(pitch);
    });
  }

  release(pitch: number): void {
    const source = this.activeSources.get(pitch);
    if (source) {
      const now = this.audioContext.currentTime;
      source.stop(now + this.options.release);
      this.activeSources.delete(pitch);
    }
  }

  setParameter(param: string, value: number): void {
    switch (param) {
      case 'attack':
        this.options.attack = value;
        break;
      case 'release':
        this.options.release = value;
        break;
      case 'pitchKey':
        this.options.pitchKey = value;
        break;
    }
  }
}

// =============================================================================
// Instrument Factory
// =============================================================================

export function createSynth(
  audioContext: AudioContext,
  id: string,
  options?: SynthOptions
): SynthInstrument {
  return new SynthInstrument(audioContext, id, options);
}

export function createSampler(
  audioContext: AudioContext,
  id: string,
  options?: SamplerOptions
): SamplerInstrument {
  return new SamplerInstrument(audioContext, id, options);
}

// =============================================================================
// Instrument Registry
// =============================================================================

export class InstrumentRegistry {
  private instruments: Map<string, MidiInstrument> = new Map();

  register(instrument: MidiInstrument): void {
    this.instruments.set(instrument.id, instrument);
  }

  unregister(id: string): void {
    this.instruments.delete(id);
  }

  get(id: string): MidiInstrument | undefined {
    return this.instruments.get(id);
  }

  getAll(): MidiInstrument[] {
    return Array.from(this.instruments.values());
  }
}

// =============================================================================
// MIDI Routing
// =============================================================================

export interface MidiRoute {
  trackId: string;
  instrumentId: string;
}

export class MidiRouter {
  private routes: Map<string, string> = new Map(); // trackId -> instrumentId
  private registry: InstrumentRegistry;

  constructor(registry: InstrumentRegistry) {
    this.registry = registry;
  }

  /**
   * Route a track to an instrument
   */
  route(trackId: string, instrumentId: string): void {
    this.routes.set(trackId, instrumentId);
  }

  /**
   * Remove routing for a track
   */
  unroute(trackId: string): void {
    this.routes.delete(trackId);
  }

  /**
   * Get instrument for a track
   */
  getInstrumentForTrack(trackId: string): MidiInstrument | undefined {
    const instrumentId = this.routes.get(trackId);
    if (!instrumentId) return undefined;
    return this.registry.get(instrumentId);
  }

  /**
   * Get all routes
   */
  getRoutes(): MidiRoute[] {
    return Array.from(this.routes.entries()).map(([trackId, instrumentId]) => ({
      trackId,
      instrumentId,
    }));
  }
}

// =============================================================================
// Integration Helpers
// =============================================================================

/**
 * Connect a MIDI clip to the scheduler with proper instrument routing
 */
export function connectClipToScheduler(
  clip: { trackId: string; id: string },
  scheduler: { setInstrument: (trackId: string, instrument: MidiInstrument) => void },
  router: MidiRouter
): void {
  const instrument = router.getInstrumentForTrack(clip.trackId);
  if (instrument) {
    scheduler.setInstrument(clip.trackId, instrument);
  }
}
