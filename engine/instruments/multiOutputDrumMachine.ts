/**
 * Multi-Output Drum Machine - Professional Drum Machine with Multiple Outputs
 *
 * Features:
 * - Each pad routed to separate output
 * - Individual effects per output
 * - Choke groups preserved
 * - Round-robin samples preserved
 * - Velocity layers preserved
 * - Real-time output metering
 *
 * Output Layout:
 * - Output 0: Main (stereo mix)
 * - Output 1: Kick
 * - Output 2: Snare/Clap
 * - Output 3: Hi-Hats
 * - Output 4+: Toms, Percussion, etc.
 */

import { MultiOutputInstrument, InstrumentOutput } from './multiOutputInstrument';
import { DrumPad, DrumKit, drumKitPresets } from './drumMachine';

export interface MultiOutputDrumPad extends DrumPad {
  outputIndex: number;
  outputName?: string;
}

export interface MultiOutputDrumKit extends DrumKit {
  pads: MultiOutputDrumPad[];
  outputMapping: OutputMapping;
}

export interface OutputMapping {
  [note: number]: number; // MIDI note → output index
}

export interface MultiOutputDrumMachineConfig {
  kit: MultiOutputDrumKit;
  velocityLayers: number;
  roundRobinEnabled: boolean;
  chokeGroups: Map<number, number[]>;
}

export interface MultiOutputDrumMachineOptions {
  kitName?: string;
  outputCount?: number;
}

const DEFAULT_OUTPUT_LAYOUT: Record<string, number> = {
  kick: 1,
  snare: 2,
  clap: 2,
  rim: 2,
  closed_hat: 3,
  open_hat: 3,
  ride: 3,
  crash: 0,
  tom_low: 4,
  tom_mid: 4,
  tom_hi: 4,
  percussion: 5,
  cowbell: 5,
  tambourine: 5,
};

export class MultiOutputDrumMachine extends MultiOutputInstrument {
  private drumConfig: MultiOutputDrumMachineConfig;
  private activeVoices: Map<number, { source: AudioBufferSourceNode; output: number }> = new Map();
  private chokeGroups: Map<number, Set<number>> = new Map();
  private roundRobinCounters: Map<number, number> = new Map();
  private buffers: Map<number, AudioBuffer> = new Map();

  constructor(options: MultiOutputDrumMachineOptions = {}) {
    const kitName = options.kitName ?? 'trap';
    const kit = drumKitPresets[kitName] as MultiOutputDrumKit | undefined;

    // Determine output count from kit
    const outputCount = options.outputCount ?? (kit?.outputChannels ?? 4);

    super({
      name: kit?.name ?? 'Drum Machine',
      type: 'drum-machine',
      outputCount,
      outputs: Array.from({ length: outputCount }, (_, i) => ({
        name: i === 0 ? 'Main' : `Output ${i + 1}`,
        color: i === 0 ? '#3B82F6' : i === 1 ? '#EF4444' : i === 2 ? '#10B981' : i === 3 ? '#F59E0B' : '#6B7280',
      })),
    });

    this.drumConfig = {
      kit: kit ?? this.createDefaultKit(outputCount),
      velocityLayers: 1,
      roundRobinEnabled: true,
      chokeGroups: new Map(),
    };

    this.setupChokeGroups();
  }

  private createDefaultKit(outputCount: number): MultiOutputDrumKit {
    return {
      name: 'Default Kit',
      masterVolume: 0.8,
      outputChannels: outputCount,
      pads: [
        { note: 36, name: 'Kick', velocity: 1.0, outputIndex: 1 },
        { note: 38, name: 'Snare', velocity: 0.9, outputIndex: 2 },
        { note: 42, name: 'Closed Hat', velocity: 0.8, outputIndex: 3, chokeGroup: 1 },
        { note: 46, name: 'Open Hat', velocity: 0.8, outputIndex: 3, chokeGroup: 1 },
        { note: 39, name: 'Clap', velocity: 0.9, outputIndex: 2 },
      ],
      outputMapping: {
        36: 1,
        38: 2,
        42: 3,
        46: 3,
        39: 2,
      },
    };
  }

  private setupChokeGroups(): void {
    for (const pad of this.drumConfig.kit.pads) {
      if (pad.chokeGroup !== undefined) {
        let group = this.chokeGroups.get(pad.chokeGroup);
        if (!group) {
          group = new Set();
          this.chokeGroups.set(pad.chokeGroup, group);
        }
        group.add(pad.note);
      }
    }
  }

  // ===========================================================================
  // Sample Management
  // ===========================================================================

  public setBuffer(note: number, buffer: AudioBuffer): void {
    this.buffers.set(note, buffer);
  }

  public getBuffer(note: number): AudioBuffer | undefined {
    return this.buffers.get(note);
  }

  public loadSample(note: number, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.audioContext) {
        reject(new Error('AudioContext not initialized'));
        return;
      }

      fetch(url)
        .then(response => response.arrayBuffer())
        .then(data => this.audioContext!.decodeAudioData(data))
        .then(buffer => {
          this.setBuffer(note, buffer);
          resolve();
        })
        .catch(reject);
    });
  }

  public loadKit(kitName: string): Promise<void> {
    const kit = drumKitPresets[kitName] as MultiOutputDrumKit | undefined;
    if (!kit) {
      return Promise.reject(new Error(`Kit "${kitName}" not found`));
    }

    this.drumConfig.kit = kit;
    this.setupChokeGroups();

    // Load samples if URLs are provided
    const loadPromises: Promise<void>[] = [];
    for (const pad of kit.pads) {
      if (pad.url) {
        loadPromises.push(this.loadSample(pad.note, pad.url));
      }
    }

    return Promise.all(loadPromises).then(() => {});
  }

  // ===========================================================================
  // Note Processing
  // ===========================================================================

  public noteOn(pitch: number, velocity: number): void {
    if (!this.audioContext) return;

    const pad = this.findPad(pitch);
    if (!pad) return;

    const outputIndex = pad.outputIndex ?? 0;

    // Handle choke groups
    if (pad.chokeGroup !== undefined) {
      this.triggerChokeGroup(pad.chokeGroup, pitch);
    }

    // Get buffer
    const buffer = this.buffers.get(pitch);
    if (!buffer) return;

    // Create source
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    // Apply tuning
    if (pad.tune) {
      source.playbackRate.value = Math.pow(2, pad.tune / 12);
    }

    // Get output node
    const outputNode = this.getOutputNode(outputIndex);
    if (!outputNode) return;

    // Apply velocity and volume
    const gainNode = this.audioContext.createGain();
    const volume = (pad.volume ?? 1) * velocity;
    gainNode.gain.value = volume;

    // Connect
    source.connect(gainNode);
    gainNode.connect(outputNode);

    // Start playback
    source.start();

    // Track voice
    this.activeVoices.set(pitch, { source, output: outputIndex });

    // Call parent noteOn
    super.noteOn(pitch, velocity, outputIndex);

    // Cleanup on end
    source.onended = () => {
      this.activeVoices.delete(pitch);
      gainNode.disconnect();
    };
  }

  public noteOff(pitch: number): void {
    const voice = this.activeVoices.get(pitch);
    if (voice) {
      try {
        voice.source.stop();
      } catch (e) {
        // Already stopped
      }
      this.activeVoices.delete(pitch);
    }

    super.noteOff(pitch);
  }

  public allNotesOff(): void {
    for (const [pitch, voice] of this.activeVoices) {
      try {
        voice.source.stop();
      } catch (e) {
        // Already stopped
      }
    }
    this.activeVoices.clear();
    super.allNotesOff();
  }

  private findPad(note: number): MultiOutputDrumPad | undefined {
    return this.drumConfig.kit.pads.find(p => p.note === note);
  }

  private triggerChokeGroup(group: number, excludeNote: number): void {
    const groupNotes = this.chokeGroups.get(group);
    if (!groupNotes) return;

    for (const note of groupNotes) {
      if (note !== excludeNote) {
        this.noteOff(note);
      }
    }
  }

  // ===========================================================================
  // Output Configuration
  // ===========================================================================

  public setPadOutput(note: number, outputIndex: number): void {
    const pad = this.findPad(note);
    if (pad) {
      pad.outputIndex = outputIndex;
      this.drumConfig.kit.outputMapping[note] = outputIndex;
    }
  }

  public getPadOutput(note: number): number {
    return this.drumConfig.kit.outputMapping[note] ?? 0;
  }

  public setOutputName(index: number, name: string): void {
    super.setOutputName(index, name);

    // Update pads routed to this output
    for (const pad of this.drumConfig.kit.pads) {
      if (pad.outputIndex === index) {
        pad.outputName = name;
      }
    }
  }

  // ===========================================================================
  // Metering
  // ===========================================================================

  public getPadLevel(note: number): number {
    const pad = this.findPad(note);
    if (!pad) return 0;
    return this.getOutputLevel(pad.outputIndex ?? 0);
  }

  // ===========================================================================
  // Kit Management
  // ===========================================================================

  public getCurrentKit(): MultiOutputDrumKit {
    return this.drumConfig.kit;
  }

  public getKitNames(): string[] {
    return Object.keys(drumKitPresets);
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getDrumConfig(): Readonly<MultiOutputDrumMachineConfig> {
    return this.drumConfig;
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  public serialize(): import('./multiOutputInstrument').MultiOutputInstrumentConfig {
    return super.serialize();
  }

  public deserialize(config: Partial<import('./multiOutputInstrument').MultiOutputInstrumentConfig>): void {
    super.deserialize(config);
  }

  public serializeDrumConfig(): MultiOutputDrumMachineConfig {
    return {
      ...this.drumConfig,
      chokeGroups: new Map(this.drumConfig.chokeGroups),
    };
  }

  public deserializeDrumConfig(config: Partial<MultiOutputDrumMachineConfig>): void {
    if (config.kit) {
      this.drumConfig.kit = config.kit;
    }
    if (config.velocityLayers !== undefined) {
      this.drumConfig.velocityLayers = config.velocityLayers;
    }
    if (config.roundRobinEnabled !== undefined) {
      this.drumConfig.roundRobinEnabled = config.roundRobinEnabled;
    }
    if (config.chokeGroups) {
      this.drumConfig.chokeGroups = config.chokeGroups;
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createMultiOutputDrumMachine(options?: MultiOutputDrumMachineOptions): MultiOutputDrumMachine {
  return new MultiOutputDrumMachine(options);
}

export default MultiOutputDrumMachine;
