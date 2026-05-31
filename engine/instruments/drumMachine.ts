/**
 * Drum Machine Engine
 * Maps MIDI notes to individual drum samples with polyphonic playback
 */

export interface DrumPad {
  note: number;       // MIDI note number
  name: string;       // Drum name (e.g., "Kick", "Snare")
  buffer?: AudioBuffer;
  url?: string;       // Path to sample file
  velocity: number;   // Default velocity sensitivity
  tune?: number;      // Pitch adjustment in semitones
  volume?: number;    // 0-1 volume
}

export interface DrumKit {
  name: string;
  pads: DrumPad[];
  masterVolume: number;
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
    pads: [
      { note: 36, name: 'Kick', velocity: 1.0, tune: 0, volume: 1.0 },
      { note: 38, name: 'Snare', velocity: 0.9, tune: 0, volume: 0.9 },
      { note: 40, name: 'Snare Rim', velocity: 0.7, tune: 0, volume: 0.6 },
      { note: 42, name: 'Closed Hat', velocity: 0.8, tune: 0, volume: 0.7 },
      { note: 46, name: 'Open Hat', velocity: 0.8, tune: 0, volume: 0.7 },
      { note: 39, name: 'Clap', velocity: 0.9, tune: 0, volume: 0.8 },
      { note: 75, name: 'Claves', velocity: 0.7, tune: 0, volume: 0.5 },
      { note: 41, name: '808', velocity: 1.0, tune: -12, volume: 1.0 },
      { note: 49, name: 'Crash', velocity: 0.8, tune: 0, volume: 0.8 },
      { note: 35, name: 'Sub Kick', velocity: 1.0, tune: -24, volume: 0.9 },
    ],
  },
  acoustic: {
    name: 'Acoustic Kit',
    masterVolume: 0.75,
    pads: [
      { note: 36, name: 'Kick', velocity: 1.0, tune: 0, volume: 1.0 },
      { note: 38, name: 'Snare', velocity: 0.9, tune: 0, volume: 0.9 },
      { note: 40, name: 'Snare Rim', velocity: 0.8, tune: 0, volume: 0.7 },
      { note: 42, name: 'Closed Hat', velocity: 0.7, tune: 0, volume: 0.6 },
      { note: 46, name: 'Open Hat', velocity: 0.7, tune: 0, volume: 0.6 },
      { note: 43, name: 'Tom Low', velocity: 0.8, tune: 0, volume: 0.8 },
      { note: 47, name: 'Tom Hi', velocity: 0.8, tune: 0, volume: 0.8 },
      { note: 41, name: 'Tom Floor', velocity: 0.8, tune: 0, volume: 0.8 },
      { note: 49, name: 'Crash', velocity: 0.9, tune: 0, volume: 0.8 },
      { note: 51, name: 'Ride', velocity: 0.8, tune: 0, volume: 0.7 },
      { note: 53, name: 'Ride Bell', velocity: 0.8, tune: 0, volume: 0.6 },
      { note: 52, name: 'China', velocity: 0.9, tune: 0, volume: 0.8 },
    ],
  },
  '808': {
    name: '808 Classic',
    masterVolume: 0.8,
    pads: [
      { note: 35, name: 'Sub Kick', velocity: 1.0, tune: 0, volume: 1.0 },
      { note: 36, name: 'Kick', velocity: 1.0, tune: 0, volume: 1.0 },
      { note: 38, name: 'Snare', velocity: 0.9, tune: 0, volume: 0.9 },
      { note: 40, name: 'Snare Rim', velocity: 0.8, tune: 0, volume: 0.7 },
      { note: 42, name: 'Closed Hat', velocity: 0.7, tune: 0, volume: 0.6 },
      { note: 46, name: 'Open Hat', velocity: 0.7, tune: 0, volume: 0.6 },
      { note: 39, name: 'Clap', velocity: 0.9, tune: 0, volume: 0.8 },
      { note: 75, name: 'Claves', velocity: 0.7, tune: 0, volume: 0.5 },
      { note: 70, name: 'Maraca', velocity: 0.6, tune: 0, volume: 0.4 },
      { note: 56, name: 'Cowbell', velocity: 0.8, tune: 0, volume: 0.7 },
      { note: 62, name: 'Conga Hi', velocity: 0.8, tune: 0, volume: 0.6 },
      { note: 63, name: 'Conga Low', velocity: 0.8, tune: 0, volume: 0.6 },
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
    startTime?: number
  ): void {
    const time = startTime ?? this.ctx.currentTime;
    this.isActive = true;

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
    };
  }

  /**
   * Check if voice is active
   */
  isPlaying(): boolean {
    return this.isActive;
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
 */
export class DrumMachine {
  private ctx: AudioContext;
  private kit: DrumKit;
  private voices: DrumVoice[] = [];
  private masterGain: GainNode;
  private loadedPads = new Map<number, AudioBuffer>();
  private isLoaded = false;

  constructor(ctx: AudioContext, presetName: string) {
    this.ctx = ctx;
    this.kit = drumKitPresets[presetName] ?? drumKitPresets['808'];

    // Create master output
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.kit.masterVolume;

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
      voice.getOutput().connect(this.masterGain);
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

      if (pad.url) {
        try {
          const response = await fetch(pad.url);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
          this.loadedPads.set(pad.note, audioBuffer);
        } catch (error) {
          console.warn(`Failed to load drum sample: ${pad.url}`, error);
          // Keep the generated fallback
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

    const buffer = this.loadedPads.get(note);
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

    voice.play(
      buffer,
      effectiveVel,
      pad.tune,
      0, // pan (can be extended)
      time
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
    try {
      this.masterGain.disconnect();
    } catch {
      // Already disconnected
    }
  }
}

export default DrumMachine;
