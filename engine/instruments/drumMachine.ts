/**
 * Drum Machine Engine
 * Maps MIDI notes to individual drum samples with polyphonic playback
 */

export interface DrumPad {
  note: number;       // MIDI note number
  name: string;       // Drum name (e.g., "Kick", "Snare")
  buffer?: AudioBuffer;
  url?: string;       // Path to sample file (single sample)
  samples?: string[]; // Multiple sample URLs for round-robin
  velocity: number;   // Default velocity sensitivity
  tune?: number;      // Pitch adjustment in semitones
  volume?: number;    // 0-1 volume
  chokeGroup?: number; // Choke group ID (e.g., open hat chokes closed hat)
  outputChannel?: number; // Multi-out channel index (0 = main, 1-8 = aux)
}

export interface DrumKit {
  name: string;
  pads: DrumPad[];
  masterVolume: number;
  outputChannels?: number; // Number of output channels (default 1)
}

// Standard drum kit mappings
const standardDrumNotes: Record<string, number> = {
  kick: 36,
  snare: 38,
  clap: 39,
  snare_rim: 40,
  tom_low: 41,
  closed_hat: 42,
  tom_mid: 43,
  open_hat: 46,
  tom_hi: 47,
  crash: 49,
  ride: 51,
  china: 52,
  tambourine: 54,
  cowbell: 56,
  ride_bell: 53,
  conga_hi: 62,
  conga_low: 63,
  claves: 75,
  maraca: 70,
  shaker: 82,
  sub_kick: 35,
};

// Built-in drum kit presets
export const drumKitPresets: Record<string, DrumKit> = {
  trap: {
    name: 'Trap Drum Kit',
    masterVolume: 0.7,
    outputChannels: 4, // main + 3 aux
    pads: [
      { note: 36, name: 'Kick', velocity: 1.0, tune: 0, volume: 1.0, outputChannel: 1 },
      { note: 38, name: 'Snare', velocity: 0.9, tune: 0, volume: 0.9, outputChannel: 2 },
      { note: 40, name: 'Snare Rim', velocity: 0.7, tune: 0, volume: 0.6, outputChannel: 2 },
      { note: 42, name: 'Closed Hat', velocity: 0.8, tune: 0, volume: 0.7, chokeGroup: 1, outputChannel: 3 },
      { note: 46, name: 'Open Hat', velocity: 0.8, tune: 0, volume: 0.7, chokeGroup: 1, outputChannel: 3 },
      { note: 39, name: 'Clap', velocity: 0.9, tune: 0, volume: 0.8, outputChannel: 2 },
      { note: 75, name: 'Claves', velocity: 0.7, tune: 0, volume: 0.5, outputChannel: 0 },
      { note: 41, name: '808', velocity: 1.0, tune: -12, volume: 1.0, outputChannel: 1 },
      { note: 49, name: 'Crash', velocity: 0.8, tune: 0, volume: 0.8, outputChannel: 0 },
      { note: 35, name: 'Sub Kick', velocity: 1.0, tune: -24, volume: 0.9, outputChannel: 1 },
    ],
  },
  acoustic: {
    name: 'Acoustic Kit',
    masterVolume: 0.75,
    outputChannels: 4,
    pads: [
      { note: 36, name: 'Kick', velocity: 1.0, tune: 0, volume: 1.0, outputChannel: 1 },
      { note: 38, name: 'Snare', velocity: 0.9, tune: 0, volume: 0.9, outputChannel: 2 },
      { note: 40, name: 'Snare Rim', velocity: 0.8, tune: 0, volume: 0.7, outputChannel: 2 },
      { note: 42, name: 'Closed Hat', velocity: 0.7, tune: 0, volume: 0.6, chokeGroup: 1, outputChannel: 3 },
      { note: 46, name: 'Open Hat', velocity: 0.7, tune: 0, volume: 0.6, chokeGroup: 1, outputChannel: 3 },
      { note: 43, name: 'Tom Low', velocity: 0.8, tune: 0, volume: 0.8, outputChannel: 0 },
      { note: 47, name: 'Tom Hi', velocity: 0.8, tune: 0, volume: 0.8, outputChannel: 0 },
      { note: 41, name: 'Tom Floor', velocity: 0.8, tune: 0, volume: 0.8, outputChannel: 0 },
      { note: 49, name: 'Crash', velocity: 0.9, tune: 0, volume: 0.8, outputChannel: 0 },
      { note: 51, name: 'Ride', velocity: 0.8, tune: 0, volume: 0.7, outputChannel: 0 },
      { note: 53, name: 'Ride Bell', velocity: 0.8, tune: 0, volume: 0.6, chokeGroup: 2, outputChannel: 0 },
      { note: 52, name: 'China', velocity: 0.9, tune: 0, volume: 0.8, outputChannel: 0 },
    ],
  },
  '808': {
    name: '808 Classic',
    masterVolume: 0.8,
    outputChannels: 4,
    pads: [
      { note: 35, name: 'Sub Kick', velocity: 1.0, tune: 0, volume: 1.0, outputChannel: 1 },
      { note: 36, name: 'Kick', velocity: 1.0, tune: 0, volume: 1.0, outputChannel: 1 },
      { note: 38, name: 'Snare', velocity: 0.9, tune: 0, volume: 0.9, outputChannel: 2 },
      { note: 40, name: 'Snare Rim', velocity: 0.8, tune: 0, volume: 0.7, outputChannel: 2 },
      { note: 42, name: 'Closed Hat', velocity: 0.7, tune: 0, volume: 0.6, chokeGroup: 1, outputChannel: 3 },
      { note: 46, name: 'Open Hat', velocity: 0.7, tune: 0, volume: 0.6, chokeGroup: 1, outputChannel: 3 },
      { note: 39, name: 'Clap', velocity: 0.9, tune: 0, volume: 0.8, outputChannel: 2 },
      { note: 75, name: 'Claves', velocity: 0.7, tune: 0, volume: 0.5, outputChannel: 0 },
      { note: 70, name: 'Maraca', velocity: 0.6, tune: 0, volume: 0.4, outputChannel: 0 },
      { note: 56, name: 'Cowbell', velocity: 0.8, tune: 0, volume: 0.7, outputChannel: 0 },
      { note: 62, name: 'Conga Hi', velocity: 0.8, tune: 0, volume: 0.6, outputChannel: 0 },
      { note: 63, name: 'Conga Low', velocity: 0.8, tune: 0, volume: 0.6, outputChannel: 0 },
    ],
  },
  electronic: {
    name: 'Electronic Kit',
    masterVolume: 0.8,
    outputChannels: 4,
    pads: [
      { note: 36, name: 'Kick', velocity: 1.0, tune: 0, volume: 1.0, outputChannel: 1 },
      { note: 38, name: 'Snare', velocity: 0.9, tune: 2, volume: 0.85, outputChannel: 2 },
      { note: 42, name: 'Closed Hat', velocity: 0.7, tune: 0, volume: 0.6, chokeGroup: 1, outputChannel: 3 },
      { note: 46, name: 'Open Hat', velocity: 0.7, tune: 0, volume: 0.6, chokeGroup: 1, outputChannel: 3 },
      { note: 39, name: 'Clap', velocity: 0.9, tune: 0, volume: 0.8, outputChannel: 2 },
      { note: 41, name: 'Tom Low', velocity: 0.8, tune: 3, volume: 0.7, outputChannel: 0 },
      { note: 47, name: 'Tom Hi', velocity: 0.8, tune: 3, volume: 0.7, outputChannel: 0 },
      { note: 49, name: 'Crash', velocity: 0.9, tune: 0, volume: 0.8, outputChannel: 0 },
      { note: 51, name: 'Ride', velocity: 0.8, tune: 0, volume: 0.7, outputChannel: 0 },
      { note: 82, name: 'Shaker', velocity: 0.6, tune: 0, volume: 0.5, outputChannel: 0 },
      { note: 54, name: 'Tambourine', velocity: 0.7, tune: 0, volume: 0.6, outputChannel: 0 },
      { note: 56, name: 'Cowbell', velocity: 0.8, tune: 0, volume: 0.6, outputChannel: 0 },
    ],
  },
  jazz: {
    name: 'Jazz Kit',
    masterVolume: 0.65,
    outputChannels: 4,
    pads: [
      { note: 36, name: 'Kick', velocity: 1.0, tune: -1, volume: 0.9, outputChannel: 1 },
      { note: 38, name: 'Snare', velocity: 0.8, tune: -1, volume: 0.8, outputChannel: 2 },
      { note: 40, name: 'Snare Rim', velocity: 0.7, tune: 0, volume: 0.6, outputChannel: 2 },
      { note: 42, name: 'Closed Hat', velocity: 0.6, tune: 0, volume: 0.5, chokeGroup: 1, outputChannel: 3 },
      { note: 46, name: 'Open Hat', velocity: 0.6, tune: 0, volume: 0.5, chokeGroup: 1, outputChannel: 3 },
      { note: 41, name: 'Tom Low', velocity: 0.7, tune: -2, volume: 0.7, outputChannel: 0 },
      { note: 47, name: 'Tom Hi', velocity: 0.7, tune: -2, volume: 0.7, outputChannel: 0 },
      { note: 49, name: 'Crash', velocity: 0.8, tune: 0, volume: 0.7, outputChannel: 0 },
      { note: 51, name: 'Ride', velocity: 0.8, tune: 0, volume: 0.6, outputChannel: 0 },
      { note: 53, name: 'Ride Bell', velocity: 0.7, tune: 0, volume: 0.5, chokeGroup: 2, outputChannel: 0 },
      { note: 82, name: 'Shaker', velocity: 0.5, tune: 0, volume: 0.4, outputChannel: 0 },
      { note: 54, name: 'Tambourine', velocity: 0.6, tune: 0, volume: 0.5, outputChannel: 0 },
    ],
  },
  percussion: {
    name: 'World Percussion',
    masterVolume: 0.7,
    outputChannels: 2,
    pads: [
      { note: 62, name: 'Conga Hi', velocity: 0.8, tune: 0, volume: 0.7, outputChannel: 0 },
      { note: 63, name: 'Conga Low', velocity: 0.8, tune: -2, volume: 0.7, outputChannel: 0 },
      { note: 64, name: 'Conga Mute', velocity: 0.7, tune: 0, volume: 0.6, chokeGroup: 3, outputChannel: 0 },
      { note: 65, name: 'Bongo Hi', velocity: 0.8, tune: 5, volume: 0.6, outputChannel: 1 },
      { note: 66, name: 'Bongo Low', velocity: 0.7, tune: 3, volume: 0.6, outputChannel: 1 },
      { note: 67, name: 'Djembe', velocity: 0.9, tune: 0, volume: 0.8, outputChannel: 0 },
      { note: 68, name: 'Djembe Slap', velocity: 0.8, tune: 7, volume: 0.7, chokeGroup: 4, outputChannel: 0 },
      { note: 69, name: 'Tabla', velocity: 0.8, tune: 0, volume: 0.7, outputChannel: 1 },
      { note: 70, name: 'Maraca', velocity: 0.6, tune: 0, volume: 0.5, outputChannel: 0 },
      { note: 54, name: 'Tambourine', velocity: 0.7, tune: 0, volume: 0.5, outputChannel: 0 },
      { note: 82, name: 'Shaker', velocity: 0.5, tune: 0, volume: 0.4, outputChannel: 0 },
      { note: 75, name: 'Claves', velocity: 0.7, tune: 0, volume: 0.5, outputChannel: 1 },
    ],
  },
};

/**
 * Generate a drum sound using synthesis
 * Used as fallback when samples aren't available
 */
function generateDrumSound(
  ctx: AudioContext,
  type: string,
  tune = 0
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const duration = type === 'crash' || type === 'ride' ? 3.0 : 1.5;
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);

  switch (type.toLowerCase()) {
    case 'kick':
    case 'sub kick': {
      const baseFreq = type === 'sub kick' ? 40 : 80;
      const freq = baseFreq * Math.pow(2, tune / 12);
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const envelope = Math.exp(-t * (type === 'sub kick' ? 3 : 5));
        const pitchEnv = Math.exp(-t * 10);
        const f = freq * pitchEnv + freq * 0.1;
        data[i] = Math.sin(2 * Math.PI * f * t) * envelope * 0.8;
      }
      break;
    }

    case 'snare':
    case 'snare rim': {
      const freq = 200 * Math.pow(2, tune / 12);
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        // Tone body
        const tone = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 8);
        // Noise
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * (type === 'snare rim' ? 15 : 10));
        // Snap
        const snap = t < 0.01 ? Math.random() * 0.5 : 0;
        data[i] = (tone * 0.3 + noise * 0.6 + snap) * 0.8;
      }
      break;
    }

    case 'closed hat':
    case 'open hat': {
      const decay = type === 'closed hat' ? 0.05 : 0.3;
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        // Metallic noise (filtered)
        let sample = 0;
        for (let f = 2000; f < 8000; f += 500) {
          sample += Math.sin(2 * Math.PI * f * t) * (Math.random() * 0.1);
        }
        const envelope = Math.exp(-t / decay);
        data[i] = sample * envelope * 0.6;
      }
      break;
    }

    case 'clap': {
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const noise = Math.random() * 2 - 1;
        // Multi-burst envelope for clap
        let envelope = 0;
        if (t < 0.02) envelope = 1;
        else if (t > 0.03 && t < 0.05) envelope = 0.7;
        else if (t > 0.06 && t < 0.15) envelope = 0.4;
        envelope *= Math.exp(-t * 8);
        data[i] = noise * envelope * 0.7;
      }
      break;
    }

    case 'crash':
    case 'china': {
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        let sample = 0;
        // Multiple harmonics for metallic sound
        for (let h = 1; h < 10; h++) {
          const f = 500 * h + Math.random() * 50;
          sample += Math.sin(2 * Math.PI * f * t) * (1 / h);
        }
        const noise = (Math.random() * 2 - 1) * 0.3;
        const envelope = Math.exp(-t * 1.5);
        data[i] = (sample + noise) * envelope * 0.5;
      }
      break;
    }

    case 'ride':
    case 'ride bell': {
      const isBell = type === 'ride bell';
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        let sample = 0;
        for (let h = 1; h < 8; h++) {
          const f = (isBell ? 800 : 400) * h + Math.random() * 30;
          sample += Math.sin(2 * Math.PI * f * t) * (1 / h);
        }
        const envelope = Math.exp(-t * (isBell ? 4 : 2));
        data[i] = sample * envelope * 0.5;
      }
      break;
    }

    case 'tom low':
    case 'tom mid':
    case 'tom hi':
    case 'tom floor': {
      const baseFreqs: Record<string, number> = {
        'tom low': 100,
        'tom mid': 150,
        'tom hi': 200,
        'tom floor': 80,
      };
      const freq = (baseFreqs[type] || 120) * Math.pow(2, tune / 12);
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const envelope = Math.exp(-t * 4);
        const pitchEnv = Math.exp(-t * 6);
        const f = freq * pitchEnv + freq * 0.2;
        data[i] = Math.sin(2 * Math.PI * f * t) * envelope * 0.7;
      }
      break;
    }

    case '808': {
      const freq = 50 * Math.pow(2, tune / 12);
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const envelope = Math.exp(-t * 2);
        const pitchEnv = Math.exp(-t * 5);
        const f = freq * pitchEnv;
        const sine = Math.sin(2 * Math.PI * f * t);
        // Add some saturation
        const saturated = Math.tanh(sine * 3);
        data[i] = saturated * envelope * 0.8;
      }
      break;
    }

    case 'claves':
    case 'maraca':
    case 'shaker': {
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const noise = Math.random() * 2 - 1;
        const decay = type === 'claves' ? 0.1 : 0.08;
        const envelope = Math.exp(-t / decay);
        data[i] = noise * envelope * (type === 'claves' ? 0.5 : 0.3);
      }
      break;
    }

    case 'cowbell': {
      const freq = 800;
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const f1 = Math.sin(2 * Math.PI * freq * t);
        const f2 = Math.sin(2 * Math.PI * (freq + 50) * t);
        const envelope = Math.exp(-t * 8);
        data[i] = (f1 + f2) * envelope * 0.4;
      }
      break;
    }

    case 'conga hi':
    case 'conga low': {
      const baseFreq = type === 'conga hi' ? 250 : 180;
      const freq = baseFreq * Math.pow(2, tune / 12);
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const envelope = Math.exp(-t * 5);
        const pitchEnv = Math.exp(-t * 7);
        const f = freq * pitchEnv + freq * 0.3;
        data[i] = Math.sin(2 * Math.PI * f * t) * envelope * 0.6;
      }
      break;
    }

    default: {
      // Generic percussion
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const noise = Math.random() * 2 - 1;
        const envelope = Math.exp(-t * 10);
        data[i] = noise * envelope * 0.4;
      }
    }
  }

  return buffer;
}

/**
 * Individual drum voice
 */
class DrumVoice {
  private ctx: AudioContext;
  private source: AudioBufferSourceNode | null = null;
  private output: GainNode;
  private panner: StereoPannerNode;
  private isActive = false;
  private currentPadNote: number = -1;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;

    this.panner = ctx.createStereoPanner();
    this.output = ctx.createGain();

    // Connect: panner -> output
    this.panner.connect(this.output);
  }

  /**
   * Play a drum sample
   */
  play(
    buffer: AudioBuffer,
    velocity: number,
    tune = 0,
    pan = 0,
    startTime?: number,
    padNote: number = -1
  ): void {
    const time = startTime ?? this.ctx.currentTime;
    this.isActive = true;
    this.currentPadNote = padNote;

    // Calculate playback rate for pitch adjustment
    const rate = Math.pow(2, tune / 12);

    // Create source
    this.source = this.ctx.createBufferSource();
    this.source.buffer = buffer;
    this.source.playbackRate.value = rate;
    this.source.connect(this.panner);

    // Set gain based on velocity
    const velGain = velocity / 127;
    this.output.gain.setValueAtTime(velGain, time);

    // Set pan
    this.panner.pan.setValueAtTime(pan, time);

    // Start playback
    this.source.start(time);

    // Handle end
    this.source.onended = () => {
      this.cleanup();
      this.isActive = false;
      this.currentPadNote = -1;
    };
  }

  /**
   * Stop the voice immediately (for choke groups)
   */
  stop(time?: number): void {
    if (!this.isActive || !this.source) return;
    const t = time ?? this.ctx.currentTime;

    try {
      // Fade out quickly to avoid click
      this.output.gain.cancelScheduledValues(t);
      this.output.gain.setValueAtTime(this.output.gain.value, t);
      this.output.gain.exponentialRampToValueAtTime(0.001, t + 0.01);
      this.source.stop(t + 0.015);
    } catch {
      // Already stopped
    }
  }

  /**
   * Check if voice is active
   */
  isPlaying(): boolean {
    return this.isActive;
  }

  /**
   * Get the pad note this voice is playing
   */
  getCurrentPadNote(): number {
    return this.currentPadNote;
  }

  /**
   * Get output node
   */
  getOutput(): AudioNode {
    return this.output;
  }

  /**
   * Cleanup
   */
  private cleanup(): void {
    if (this.source) {
      try {
        this.source.disconnect();
        this.source.onended = null;
      } catch {
        // Already disconnected
      }
      this.source = null;
    }
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.cleanup();
    try {
      this.panner.disconnect();
      this.output.disconnect();
    } catch {
      // Already disconnected
    }
  }
}

/**
 * Drum Machine
 * Maps MIDI notes to individual drum samples with polyphonic playback,
 * choke groups, round-robin, and multi-out routing.
 */
export class DrumMachine {
  private ctx: AudioContext;
  private kit: DrumKit;
  private voices: DrumVoice[] = [];
  private masterGain: GainNode;
  private outputChannels: GainNode[] = []; // Multi-out channels
  private loadedPads = new Map<number, AudioBuffer>(); // note -> primary buffer
  private loadedRoundRobin = new Map<number, AudioBuffer[]>(); // note -> array of buffers
  private isLoaded = false;
  private roundRobinIndices = new Map<number, number>(); // note -> current RR index

  constructor(ctx: AudioContext, presetName: string) {
    this.ctx = ctx;
    this.kit = drumKitPresets[presetName] ?? drumKitPresets['808'];

    // Create master output
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.kit.masterVolume;

    // Create output channels for multi-out
    const numChannels = this.kit.outputChannels ?? 1;
    for (let i = 0; i < numChannels; i++) {
      const channelGain = ctx.createGain();
      channelGain.gain.value = 1.0;
      channelGain.connect(this.masterGain);
      this.outputChannels.push(channelGain);
    }

    // Allocate voice pool (drums need many voices for flams/rolls)
    this.allocateVoices();
  }

  /**
   * Allocate voice pool
   */
  private allocateVoices(): void {
    const polyphony = 32; // Drums can overlap a lot
    for (let i = 0; i < polyphony; i++) {
      const voice = new DrumVoice(this.ctx);
      this.voices.push(voice);
    }
  }

  /**
   * Load all samples for this kit
   */
  async loadSamples(): Promise<void> {
    if (this.isLoaded) return;

    const loadPromises = this.kit.pads.map(async (pad) => {
      // Generate synthesized sample as fallback
      const buffer = generateDrumSound(this.ctx, pad.name, pad.tune ?? 0);
      this.loadedPads.set(pad.note, buffer);

      // Load round-robin samples if specified
      if (pad.samples && pad.samples.length > 0) {
        const rrBuffers: AudioBuffer[] = [];
        for (const url of pad.samples) {
          try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            rrBuffers.push(audioBuffer);
          } catch (error) {
            console.warn(`Failed to load round-robin sample: ${url}`, error);
          }
        }
        if (rrBuffers.length > 0) {
          this.loadedRoundRobin.set(pad.note, rrBuffers);
        }
      } else if (pad.url) {
        // Load single custom sample
        try {
          const response = await fetch(pad.url);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
          this.loadedPads.set(pad.note, audioBuffer);
        } catch (error) {
          console.warn(`Failed to load drum sample: ${pad.url}`, error);
        }
      }
    });

    await Promise.all(loadPromises);
    this.isLoaded = true;
  }

  /**
   * Find pad configuration for a note
   */
  private findPad(note: number): DrumPad | undefined {
    return this.kit.pads.find((pad) => pad.note === note);
  }

  /**
   * Get the next round-robin buffer for a pad
   */
  private getNextRRBuffer(note: number): AudioBuffer | null {
    const buffers = this.loadedRoundRobin.get(note);
    if (!buffers || buffers.length === 0) return null;

    const idx = this.roundRobinIndices.get(note) ?? 0;
    const buffer = buffers[idx % buffers.length];
    this.roundRobinIndices.set(note, idx + 1);
    return buffer;
  }

  /**
   * Get available voice
   */
  private getVoice(): DrumVoice {
    const inactiveVoice = this.voices.find((v) => !v.isPlaying());
    if (inactiveVoice) return inactiveVoice;

    // Steal oldest voice
    const voice = this.voices[0];
    this.voices.shift();
    this.voices.push(voice);
    return voice;
  }

  /**
   * Stop all voices playing a specific pad (for choke groups)
   */
  private chokePad(note: number, time?: number): void {
    const t = time ?? this.ctx.currentTime;
    this.voices.forEach((voice) => {
      if (voice.isPlaying() && voice.getCurrentPadNote() === note) {
        voice.stop(t);
      }
    });
  }

  /**
   * Get the output GainNode for a specific channel.
   * Channel 0 = main (masterGain), channels 1+ = aux outputs.
   */
  getOutputChannel(channel: number): GainNode {
    if (channel === 0) return this.masterGain;
    return this.outputChannels[channel] ?? this.masterGain;
  }

  /**
   * Play a drum note
   */
  noteOn(note: number, velocity = 100, time?: number): void {
    if (!this.isLoaded) {
      console.warn('Drum kit not loaded yet');
      return;
    }

    const pad = this.findPad(note);
    if (!pad) {
      console.warn(`No drum pad for note ${note}`);
      return;
    }

    // Handle choke groups: stop other voices in the same group
    if (pad.chokeGroup !== undefined) {
      this.kit.pads.forEach((otherPad) => {
        if (
          otherPad.chokeGroup === pad.chokeGroup &&
          otherPad.note !== note &&
          otherPad.chokeGroup !== undefined
        ) {
          this.chokePad(otherPad.note, time);
        }
      });
    }

    // Get buffer: try round-robin first, then primary, then fallback
    let buffer = this.getNextRRBuffer(note);
    if (!buffer) {
      buffer = this.loadedPads.get(note) ?? null;
    }
    if (!buffer) {
      console.warn(`Sample not loaded for note ${note}`);
      return;
    }

    const voice = this.getVoice();

    // Calculate effective velocity
    const effectiveVel = Math.min(
      127,
      Math.round(velocity * (pad.velocity ?? 1))
    );

    // Determine output channel
    const outputChannel = pad.outputChannel ?? 0;

    // Connect voice to appropriate output channel
    voice.getOutput().disconnect();
    voice.getOutput().connect(this.getOutputChannel(outputChannel));

    voice.play(
      buffer,
      effectiveVel,
      pad.tune,
      0, // pan (can be extended)
      time,
      note // pass pad note for choke tracking
    );
  }

  /**
   * Stop a drum note (not typically used for drums)
   */
  noteOff(_note: number, _time?: number): void {
    // Drums are one-shot, no note off needed
  }

  /**
   * Stop all sounds
   */
  allNotesOff(): void {
    // Voices self-terminate when done
  }

  /**
   * Get kit name
   */
  getName(): string {
    return this.kit.name;
  }

  /**
   * Get all pad notes
   */
  getPadNotes(): number[] {
    return this.kit.pads.map((pad) => pad.note);
  }

  /**
   * Get pad info
   */
  getPadInfo(note: number): DrumPad | undefined {
    return this.findPad(note);
  }

  /**
   * Get output node
   */
  getOutput(): AudioNode {
    return this.masterGain;
  }

  /**
   * Set master volume
   */
  setVolume(volume: number): void {
    this.masterGain.gain.value = volume * this.kit.masterVolume;
  }

  /**
   * Check if loaded
   */
  isReady(): boolean {
    return this.isLoaded;
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.voices.forEach((v) => v.dispose());
    this.voices = [];
    this.loadedPads.clear();
    this.loadedRoundRobin.clear();
    this.roundRobinIndices.clear();
    try {
      this.masterGain.disconnect();
      this.outputChannels.forEach((ch) => ch.disconnect());
    } catch {
      // Already disconnected
    }
  }
}

export default DrumMachine;
