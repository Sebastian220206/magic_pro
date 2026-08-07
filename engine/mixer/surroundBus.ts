/**
 * Surround Bus - Multi-Channel Audio Routing
 *
 * Features:
 * - Route mono/stereo sources to surround buses
 * - Manage multiple surround formats
 * - Bass management with crossover
 * - Downmix matrices
 * - Monitor outputs
 * - Metering per channel
 */

import {
  SurroundFormat,
  SurroundFormatConfig,
  SurroundGain,
  SurroundMonitorConfig,
  SpeakerConfig,
  SURROUND_FORMATS,
} from './surroundTypes';

import { SurroundPanner } from './surroundPanner';

// =============================================================================
// Surround Bus Channel
// =============================================================================

export interface SurroundBusChannel {
  id: string;
  name: string;
  gain: number;             // 0-1
  muted: boolean;
  solo: boolean;
  meterLevel: number;       // Current level for metering
  peakLevel: number;
}

// =============================================================================
// Surround Bus Configuration
// =============================================================================

export interface SurroundBusConfig {
  id: string;
  name: string;
  format: SurroundFormat;
  masterGain: number;       // 0-1
  outputTrim: number;       // dB
  enabled: boolean;
}

// =============================================================================
// Surround Bus State
// =============================================================================

export interface SurroundBusState {
  config: SurroundBusConfig;
  channels: SurroundBusChannel[];
  monitor: SurroundMonitorConfig;
  panners: Map<string, SurroundPanner>;
}

// =============================================================================
// Surround Bus
// =============================================================================

export class SurroundBus {
  private state: SurroundBusState;
  private formatConfig: SurroundFormatConfig;
  private audioContext: AudioContext | null = null;
  private channelNodes: Map<number, { input: GainNode; output: GainNode }> = new Map();
  private lfeNode: GainNode | null = null;
  private outputNode: GainNode | null = null;
  private listeners: Array<(state: SurroundBusState) => void> = [];

  constructor(config: Partial<SurroundBusConfig> = {}) {
    const format = config.format ?? '5.1';
    this.formatConfig = SURROUND_FORMATS[format];

    this.state = {
      config: {
        id: config.id ?? `surround-bus-${Date.now()}`,
        name: config.name ?? 'Surround Bus',
        format,
        masterGain: config.masterGain ?? 1,
        outputTrim: config.outputTrim ?? 0,
        enabled: config.enabled ?? true,
      },
      channels: this.formatConfig.speakers.map(speaker => ({
        id: speaker.id,
        name: speaker.name,
        gain: 1,
        muted: false,
        solo: false,
        meterLevel: 0,
        peakLevel: 0,
      })),
      monitor: {
        format,
        volume: 0,
        dim: false,
        mute: false,
        soloChannel: null,
        bassManagement: true,
        bassCrossover: 120,
        distanceCompensation: true,
        roomSize: 3,
      },
      panners: new Map(),
    };
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  public initialize(audioContext: AudioContext): void {
    this.audioContext = audioContext;

    // Create channel nodes
    for (let i = 0; i < this.formatConfig.speakers.length; i++) {
      const input = audioContext.createGain();
      const output = audioContext.createGain();
      input.connect(output);
      this.channelNodes.set(i, { input, output });
    }

    // Create LFE node
    const lfeSpeaker = this.formatConfig.speakers.find(s => s.isLFE);
    if (lfeSpeaker) {
      this.lfeNode = audioContext.createGain();
      this.lfeNode.connect(this.channelNodes.get(lfeSpeaker.channelIndex)?.output ?? audioContext.destination);
    }

    // Create master output
    this.outputNode = audioContext.createGain();
    this.outputNode.gain.value = this.state.config.masterGain;
  }

  // ===========================================================================
  // Input Routing
  // ===========================================================================

  public getInputNode(channelIndex: number): GainNode | null {
    return this.channelNodes.get(channelIndex)?.input ?? null;
  }

  public getOutputNode(channelIndex: number): GainNode | null {
    return this.channelNodes.get(channelIndex)?.output ?? null;
  }

  public getLfeNode(): GainNode | null {
    return this.lfeNode;
  }

  public getMasterOutput(): GainNode | null {
    return this.outputNode;
  }

  // ===========================================================================
  // Panner Management
  // ===========================================================================

  public createPanner(sourceId: string, format?: SurroundFormat): SurroundPanner {
    const panner = new SurroundPanner(format ?? this.state.config.format);
    this.state.panners.set(sourceId, panner);
    this.notifyListeners();
    return panner;
  }

  public getPanner(sourceId: string): SurroundPanner | undefined {
    return this.state.panners.get(sourceId);
  }

  public removePanner(sourceId: string): boolean {
    const deleted = this.state.panners.delete(sourceId);
    if (deleted) {
      this.notifyListeners();
    }
    return deleted;
  }

  public connectSourceToBus(sourceId: string, sourceNode: AudioNode): void {
    const panner = this.state.panners.get(sourceId);
    if (!panner || !this.audioContext) return;

    // Connect source to all channel inputs with appropriate gains
    const gains = panner.calculateGains();
    for (let i = 0; i < gains.gains.length; i++) {
      const channelNode = this.channelNodes.get(i);
      if (channelNode && gains.gains[i] > 0) {
        // Create gain node for this connection
        const connectionGain = this.audioContext.createGain();
        connectionGain.gain.value = gains.gains[i];
        sourceNode.connect(connectionGain);
        connectionGain.connect(channelNode.input);
      }
    }

    // Connect to LFE if needed
    if (this.lfeNode && gains.lfe > 0) {
      const lfeGain = this.audioContext.createGain();
      lfeGain.gain.value = gains.lfe;
      sourceNode.connect(lfeGain);
      lfeGain.connect(this.lfeNode);
    }
  }

  public disconnectSource(sourceId: string): void {
    // Disconnect all nodes for this source
    // This is a simplified approach - in production, track connections more carefully
  }

  // ===========================================================================
  // Channel Control
  // ===========================================================================

  public setChannelGain(channelIndex: number, gain: number): void {
    const channel = this.state.channels[channelIndex];
    if (channel) {
      channel.gain = Math.max(0, Math.min(1, gain));
      this.updateChannelNode(channelIndex);
      this.notifyListeners();
    }
  }

  public setChannelMute(channelIndex: number, muted: boolean): void {
    const channel = this.state.channels[channelIndex];
    if (channel) {
      channel.muted = muted;
      this.updateChannelNode(channelIndex);
      this.notifyListeners();
    }
  }

  public setChannelSolo(channelIndex: number, solo: boolean): void {
    const channel = this.state.channels[channelIndex];
    if (channel) {
      channel.solo = solo;
      this.updateChannelNode(channelIndex);
      this.notifyListeners();
    }
  }

  private updateChannelNode(channelIndex: number): void {
    const channel = this.state.channels[channelIndex];
    const node = this.channelNodes.get(channelIndex);
    if (!channel || !node) return;

    let effectiveGain = channel.gain;

    // Apply mute
    if (channel.muted) {
      effectiveGain = 0;
    }

    // Apply solo logic
    const anySolo = this.state.channels.some(ch => ch.solo);
    if (anySolo && !channel.solo) {
      effectiveGain = 0;
    }

    node.input.gain.value = effectiveGain;
  }

  // ===========================================================================
  // Master Control
  // ===========================================================================

  public setMasterGain(gain: number): void {
    this.state.config.masterGain = Math.max(0, Math.min(1, gain));
    if (this.outputNode) {
      this.outputNode.gain.value = this.state.config.masterGain;
    }
    this.notifyListeners();
  }

  public setOutputTrim(trimDb: number): void {
    this.state.config.outputTrim = Math.max(-60, Math.min(24, trimDb));
    this.notifyListeners();
  }

  public setEnabled(enabled: boolean): void {
    this.state.config.enabled = enabled;
    this.notifyListeners();
  }

  // ===========================================================================
  // Monitor Control
  // ===========================================================================

  public setMonitorVolume(volumeDb: number): void {
    this.state.monitor.volume = Math.max(-60, Math.min(12, volumeDb));
    this.notifyListeners();
  }

  public setMonitorDim(dim: boolean): void {
    this.state.monitor.dim = dim;
    this.notifyListeners();
  }

  public setMonitorMute(mute: boolean): void {
    this.state.monitor.mute = mute;
    this.notifyListeners();
  }

  public setMonitorSoloChannel(channelIndex: number | null): void {
    this.state.monitor.soloChannel = channelIndex;
    this.notifyListeners();
  }

  public setBassManagement(enabled: boolean): void {
    this.state.monitor.bassManagement = enabled;
    this.notifyListeners();
  }

  public setBassCrossover(hz: number): void {
    this.state.monitor.bassCrossover = Math.max(40, Math.min(200, hz));
    this.notifyListeners();
  }

  // ===========================================================================
  // Metering
  // ===========================================================================

  public getChannelLevel(channelIndex: number): number {
    return this.state.channels[channelIndex]?.meterLevel ?? 0;
  }

  public getChannelPeak(channelIndex: number): number {
    return this.state.channels[channelIndex]?.peakLevel ?? 0;
  }

  public updateMetering(): void {
    for (let i = 0; i < this.state.channels.length; i++) {
      const channel = this.state.channels[i];
      const node = this.channelNodes.get(i);

      if (channel && node) {
        // Calculate level from gain
        const level = node.input.gain.value;
        channel.meterLevel = level;

        // Update peak
        if (level > channel.peakLevel) {
          channel.peakLevel = level;
        } else {
          // Decay peak
          channel.peakLevel *= 0.999;
        }
      }
    }
    this.notifyListeners();
  }

  // ===========================================================================
  // Format Management
  // ===========================================================================

  public setFormat(format: SurroundFormat): void {
    this.state.config.format = format;
    this.formatConfig = SURROUND_FORMATS[format];
    this.state.monitor.format = format;

    // Update channels
    this.state.channels = this.formatConfig.speakers.map(speaker => ({
      id: speaker.id,
      name: speaker.name,
      gain: 1,
      muted: false,
      solo: false,
      meterLevel: 0,
      peakLevel: 0,
    }));

    this.notifyListeners();
  }

  public getFormat(): SurroundFormatConfig {
    return this.formatConfig;
  }

  // ===========================================================================
  // Downmix
  // ===========================================================================

  public downmixToStereo(): { left: number; right: number } {
    const gains = { left: 0, right: 0 };

    for (let i = 0; i < this.state.channels.length; i++) {
      const channel = this.state.channels[i];
      const speaker = this.formatConfig.speakers[i];

      if (!channel || !speaker || speaker.isLFE) continue;

      const level = channel.meterLevel;

      // Simple downmix matrix
      if (speaker.position.x < 0) {
        gains.left += level;
      } else if (speaker.position.x > 0) {
        gains.right += level;
      } else {
        // Center channel goes to both
        gains.left += level * 0.7;
        gains.right += level * 0.7;
      }
    }

    // Normalize
    const maxGain = Math.max(gains.left, gains.right, 1);
    return {
      left: gains.left / maxGain,
      right: gains.right / maxGain,
    };
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getState(): Readonly<SurroundBusState> {
    return this.state;
  }

  public getConfig(): Readonly<SurroundBusConfig> {
    return this.state.config;
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  public subscribe(listener: (state: SurroundBusState) => void): () => void {
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
    this.channelNodes.forEach(node => {
      node.input.disconnect();
      node.output.disconnect();
    });
    this.channelNodes.clear();

    if (this.lfeNode) {
      this.lfeNode.disconnect();
    }

    if (this.outputNode) {
      this.outputNode.disconnect();
    }

    this.state.panners.clear();
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  public serialize(): {
    config: SurroundBusConfig;
    monitor: SurroundMonitorConfig;
  } {
    return {
      config: { ...this.state.config },
      monitor: { ...this.state.monitor },
    };
  }

  public deserialize(data: {
    config?: Partial<SurroundBusConfig>;
    monitor?: Partial<SurroundMonitorConfig>;
  }): void {
    if (data.config) {
      Object.assign(this.state.config, data.config);
    }
    if (data.monitor) {
      Object.assign(this.state.monitor, data.monitor);
    }
    this.notifyListeners();
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createSurroundBus(format?: SurroundFormat): SurroundBus {
  return new SurroundBus({ format });
}

export default SurroundBus;
