/**
 * Multi-Output Channel - Mixer Integration for Multi-Output Instruments
 *
 * Features:
 * - Per-output fader, pan, mute, solo
 * - Output-level EQ and effects sends
 * - Metering per output
 * - Group linking for instrument outputs
 * - Output bussing and routing
 */

import { MultiOutputInstrument, InstrumentOutput } from '../instruments/multiOutputInstrument';
import { OutputRouter, OutputRoute } from '../instruments/outputRouter';

export interface MultiOutputChannelConfig {
  id: string;
  instrumentId: string;
  outputIndex: number;
  name: string;
  color: string;
  volume: number;         // 0-1
  pan: number;            // -1 to 1
  muted: boolean;
  solo: boolean;
  soloSafe: boolean;      // Not affected by solo
  gain: number;           // dB
  enabled: boolean;
}

export interface MultiOutputChannelState extends MultiOutputChannelConfig {
  level: number;          // Current level for metering
  peakLevel: number;      // Peak level
  peakHoldTime: number;   // Timestamp
}

export interface MultiOutputChannelOptions {
  defaultVolume?: number;
  defaultPan?: number;
  peakHoldTime?: number;  // ms
}

const DEFAULT_OPTIONS: Required<MultiOutputChannelOptions> = {
  defaultVolume: 0.75,
  defaultPan: 0,
  peakHoldTime: 1000,
};

export class MultiOutputChannel {
  private config: MultiOutputChannelConfig;
  private state: MultiOutputChannelState;
  private options: Required<MultiOutputChannelOptions>;
  private audioContext: AudioContext | null = null;
  private inputNode: GainNode | null = null;
  private outputNode: GainNode | null = null;
  private panNode: StereoPannerNode | null = null;
  private meterNode: AnalyserNode | null = null;
  private listeners: Array<(state: MultiOutputChannelState) => void> = [];
  private levelAnalyser: Float32Array<ArrayBuffer> | null = null;

  constructor(
    config: Omit<MultiOutputChannelConfig, 'id' | 'volume' | 'pan' | 'muted' | 'solo' | 'soloSafe' | 'gain' | 'enabled'>,
    options: MultiOutputChannelOptions = {}
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.config = {
      ...config,
      id: `${config.instrumentId}-out${config.outputIndex}`,
      volume: this.options.defaultVolume,
      pan: this.options.defaultPan,
      muted: false,
      solo: false,
      soloSafe: config.outputIndex === 0,
      gain: 0,
      enabled: true,
    };

    this.state = {
      ...this.config,
      level: 0,
      peakLevel: 0,
      peakHoldTime: 0,
    };
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  public initialize(audioContext: AudioContext): void {
    this.audioContext = audioContext;

    this.inputNode = audioContext.createGain();
    this.panNode = audioContext.createStereoPanner();
    this.outputNode = audioContext.createGain();
    this.meterNode = audioContext.createAnalyser();
    this.meterNode.fftSize = 256;
    this.meterNode.smoothingTimeConstant = 0.8;

    this.inputNode.connect(this.panNode);
    this.panNode.connect(this.outputNode);
    this.outputNode.connect(this.meterNode);

    this.levelAnalyser = new Float32Array(this.meterNode.frequencyBinCount);

    this.updateNodes();
  }

  // ===========================================================================
  // Audio Nodes
  // ===========================================================================

  public getInputNode(): GainNode | null {
    return this.inputNode;
  }

  public getOutputNode(): GainNode | null {
    return this.outputNode;
  }

  public getPanNode(): StereoPannerNode | null {
    return this.panNode;
  }

  public getMeterNode(): AnalyserNode | null {
    return this.meterNode;
  }

  public connect(destination: AudioNode): void {
    this.meterNode?.connect(destination);
  }

  public disconnect(): void {
    this.meterNode?.disconnect();
  }

  // ===========================================================================
  // Volume / Pan / Mute / Solo
  // ===========================================================================

  public setVolume(volume: number): void {
    this.config.volume = Math.max(0, Math.min(1, volume));
    this.updateNodes();
    this.notifyListeners();
  }

  public getVolume(): number {
    return this.config.volume;
  }

  public setVolumeDb(db: number): void {
    const clamped = Math.max(-60, Math.min(12, db));
    this.config.volume = Math.pow(10, clamped / 20);
    this.updateNodes();
    this.notifyListeners();
  }

  public getVolumeDb(): number {
    return 20 * Math.log10(Math.max(0.0001, this.config.volume));
  }

  public setPan(pan: number): void {
    this.config.pan = Math.max(-1, Math.min(1, pan));
    this.updateNodes();
    this.notifyListeners();
  }

  public getPan(): number {
    return this.config.pan;
  }

  public setMuted(muted: boolean): void {
    this.config.muted = muted;
    this.updateNodes();
    this.notifyListeners();
  }

  public toggleMute(): void {
    this.setMuted(!this.config.muted);
  }

  public isMuted(): boolean {
    return this.config.muted;
  }

  public setSolo(solo: boolean): void {
    this.config.solo = solo;
    this.notifyListeners();
  }

  public toggleSolo(): void {
    this.setSolo(!this.config.solo);
  }

  public isSolo(): boolean {
    return this.config.solo;
  }

  public setSoloSafe(soloSafe: boolean): void {
    this.config.soloSafe = soloSafe;
    this.notifyListeners();
  }

  public isSoloSafe(): boolean {
    return this.config.soloSafe;
  }

  public setGain(gainDb: number): void {
    this.config.gain = Math.max(-60, Math.min(12, gainDb));
    this.updateNodes();
    this.notifyListeners();
  }

  public getGain(): number {
    return this.config.gain;
  }

  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.updateNodes();
    this.notifyListeners();
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  // ===========================================================================
  // Solo/Mute Logic
  // ===========================================================================

  public isEffectivelyMuted(allChannels: MultiOutputChannel[]): boolean {
    if (this.config.muted) return true;
    if (!this.config.enabled) return true;

    const anySolo = allChannels.some(ch => ch.isSolo());
    if (anySolo) {
      return !this.config.solo && !this.config.soloSafe;
    }

    return false;
  }

  // ===========================================================================
  // Metering
  // ===========================================================================

  public getLevel(): number {
    if (!this.meterNode || !this.levelAnalyser) return 0;

    this.meterNode.getFloatTimeDomainData(this.levelAnalyser);

    let sum = 0;
    for (let i = 0; i < this.levelAnalyser.length; i++) {
      sum += this.levelAnalyser[i] * this.levelAnalyser[i];
    }

    const rms = Math.sqrt(sum / this.levelAnalyser.length);
    return Math.min(1, rms * 3);
  }

  public getPeakLevel(): number {
    return this.state.peakLevel;
  }

  public updateMetering(): void {
    const level = this.getLevel();
    const now = performance.now();

    this.state.level = level;

    if (level > this.state.peakLevel) {
      this.state.peakLevel = level;
      this.state.peakHoldTime = now;
    } else if (now - this.state.peakHoldTime > this.options.peakHoldTime) {
      this.state.peakLevel = level;
    }
  }

  // ===========================================================================
  // Node Updates
  // ===========================================================================

  private updateNodes(): void {
    if (!this.inputNode || !this.panNode || !this.outputNode) return;

    const effectiveGain = this.config.enabled ? this.config.volume : 0;
    const gainDb = this.config.gain;
    const gainLinear = Math.pow(10, gainDb / 20);

    this.inputNode.gain.value = effectiveGain * gainLinear;
    this.panNode.pan.value = this.config.pan;
    this.outputNode.gain.value = this.config.enabled ? 1 : 0;
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getConfig(): Readonly<MultiOutputChannelConfig> {
    return this.config;
  }

  public getState(): Readonly<MultiOutputChannelState> {
    return this.state;
  }

  public setName(name: string): void {
    this.config.name = name;
    this.notifyListeners();
  }

  public getName(): string {
    return this.config.name;
  }

  public setColor(color: string): void {
    this.config.color = color;
    this.notifyListeners();
  }

  public getColor(): string {
    return this.config.color;
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  public subscribe(listener: (state: MultiOutputChannelState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  public dispose(): void {
    this.disconnect();
    this.inputNode?.disconnect();
    this.panNode?.disconnect();
    this.outputNode?.disconnect();
    this.meterNode?.disconnect();
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  public serialize(): MultiOutputChannelConfig {
    return { ...this.config };
  }

  public deserialize(data: Partial<MultiOutputChannelConfig>): void {
    Object.assign(this.config, data);
    this.updateNodes();
    this.notifyListeners();
  }
}

// =============================================================================
// Multi-Output Channel Group
// =============================================================================

export class MultiOutputChannelGroup {
  private channels: MultiOutputChannel[] = [];
  private instrument: MultiOutputInstrument | null = null;
  private router: OutputRouter | null = null;
  private audioContext: AudioContext | null = null;
  private listeners: Array<(channels: MultiOutputChannelState[]) => void> = [];

  constructor(
    instrument: MultiOutputInstrument,
    router: OutputRouter
  ) {
    this.instrument = instrument;
    this.router = router;
  }

  public initialize(audioContext: AudioContext): void {
    this.audioContext = audioContext;

    const config = this.instrument?.getConfig();
    if (!config) return;

    for (let i = 0; i < config.outputCount; i++) {
      const output = config.outputs[i];
      if (!output) continue;

      const channel = new MultiOutputChannel({
        instrumentId: config.id,
        outputIndex: i,
        name: output.name,
        color: output.color,
      });

      channel.initialize(audioContext);
      this.channels.push(channel);
    }
  }

  public getChannel(outputIndex: number): MultiOutputChannel | undefined {
    return this.channels[outputIndex];
  }

  public getChannels(): ReadonlyArray<MultiOutputChannel> {
    return this.channels;
  }

  public getChannelCount(): number {
    return this.channels.length;
  }

  public connectToDestination(destination: AudioNode): void {
    for (const channel of this.channels) {
      channel.connect(destination);
    }
  }

  public disconnectAll(): void {
    for (const channel of this.channels) {
      channel.disconnect();
    }
  }

  public updateMetering(): void {
    for (const channel of this.channels) {
      channel.updateMetering();
    }

    const states = this.channels.map(ch => ch.getState());
    for (const listener of this.listeners) {
      listener(states);
    }
  }

  public subscribe(listener: (channels: MultiOutputChannelState[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public dispose(): void {
    this.disconnectAll();
    for (const channel of this.channels) {
      channel.dispose();
    }
    this.channels = [];
  }

  public serialize(): MultiOutputChannelConfig[] {
    return this.channels.map(ch => ch.serialize());
  }

  public deserialize(data: MultiOutputChannelConfig[]): void {
    for (const chData of data) {
      const channel = this.channels.find(
        ch => ch.getConfig().outputIndex === chData.outputIndex
      );
      if (channel) {
        channel.deserialize(chData);
      }
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createMultiOutputChannelGroup(
  instrument: MultiOutputInstrument,
  router: OutputRouter
): MultiOutputChannelGroup {
  return new MultiOutputChannelGroup(instrument, router);
}

export default MultiOutputChannel;
