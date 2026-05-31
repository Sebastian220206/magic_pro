/**
 * Channel Strip - Professional audio channel with inserts, sends, pan, and meter
 * 
 * Signal Flow:
 * Input → Gain → Insert Chain → Pre-Fader Sends → Pan → Post-Fader Sends → Meter → Output
 */

import { AudioMeter, MeterData } from './audioMeter';

// =============================================================================
// Types
// =============================================================================

export interface ChannelStripConfig {
  id: string;
  name: string;
  color?: string;
  insertSlots?: number;
  sendBuses?: string[];
}

export interface ChannelStripState {
  id: string;
  name: string;
  volumeDb: number;      // -Infinity to +12dB
  pan: number;           // -1 (left) to 1 (right)
  mute: boolean;
  solo: boolean;
  arm: boolean;        // Record arm
  inserts: InsertSlot[];
  sends: Map<string, SendState>;
}

export interface InsertSlot {
  slotIndex: number;
  pluginId: string | null;
  pluginInstanceId: string | null;
  bypass: boolean;
  enabled: boolean;
}

export interface SendState {
  busId: string;
  levelDb: number;       // -Infinity to +12dB
  preFader: boolean;
  enabled: boolean;
}

export interface MeterData {
  peakLeft: number;
  peakRight: number;
  rmsLeft: number;
  rmsRight: number;
  peakHoldLeft: number;
  peakHoldRight: number;
  clipLeft: boolean;
  clipRight: boolean;
}

// =============================================================================
// Utilities
// =============================================================================

export function dbToGain(db: number): number {
  if (db <= -60) return 0;
  return Math.pow(10, db / 20);
}

export function gainToDb(gain: number): number {
  if (gain <= 0) return -Infinity;
  return 20 * Math.log10(gain);
}

// =============================================================================
// Channel Strip Class
// =============================================================================

export class ChannelStrip {
  // Audio Context
  private audioContext: AudioContext;
  
  // Configuration
  private id: string;
  private name: string;
  private color: string;
  
  // Audio Nodes
  public inputNode!: GainNode;
  private insertInputNode!: GainNode;
  private insertOutputNode!: GainNode;
  private preFaderSendNode!: GainNode;
  private pannerNode!: StereoPannerNode;
  private postFaderSendNode!: GainNode;
  private outputNode!: GainNode;
  private meterNode!: AnalyserNode;
  
  // Send Nodes
  private sendNodes: Map<string, { pre: GainNode; post: GainNode }> = new Map();
  
  // Insert Chain
  private insertChain: (AudioNode | null)[] = [];
  private insertBypassNodes: Map<number, { input: GainNode; output: GainNode }> = new Map();
  
  // Meter
  private audioMeter!: AudioMeter;
  
  // State
  private volumeDb: number = 0;
  private pan: number = 0;
  private mute: boolean = false;
  private solo: boolean = false;
  private insertSlots: number = 8;
  
  // Callbacks
  private meterUpdateCallback?: (data: MeterData) => void;
  private stateChangeCallback?: (state: ChannelStripState) => void;

  constructor(audioContext: AudioContext, config: ChannelStripConfig) {
    this.audioContext = audioContext;
    this.id = config.id;
    this.name = config.name;
    this.color = config.color || '#3B82F6';
    this.insertSlots = config.insertSlots || 8;
    
    // Create audio nodes
    this.createAudioGraph();
    
    // Initialize inserts
    this.initializeInserts();
    
    // Initialize sends
    if (config.sendBuses) {
      for (const busId of config.sendBuses) {
        this.addSend(busId);
      }
    }
    
    // Initialize meter
    this.audioMeter = new AudioMeter(this.meterNode, {
      fftSize: 2048,
      smoothingTimeConstant: 0.8,
      minDecibels: -100,
      maxDecibels: 0,
    });
    
    // Start metering
    this.startMetering();
  }

  // =============================================================================
  // Audio Graph Creation
  // =============================================================================

  private createAudioGraph(): void {
    const ctx = this.audioContext;
    
    // Input node
    this.inputNode = ctx.createGain();
    this.inputNode.gain.value = 1;
    
    // Insert chain nodes
    this.insertInputNode = ctx.createGain();
    this.insertOutputNode = ctx.createGain();
    
    // Pre-fader send tap
    this.preFaderSendNode = ctx.createGain();
    this.preFaderSendNode.gain.value = 1;
    
    // Panner
    this.pannerNode = ctx.createStereoPanner();
    this.pannerNode.pan.value = 0;
    
    // Post-fader send tap
    this.postFaderSendNode = ctx.createGain();
    this.postFaderSendNode.gain.value = 1;
    
    // Output node (acts as master fader)
    this.outputNode = ctx.createGain();
    this.outputNode.gain.value = 1;
    
    // Meter node
    this.meterNode = ctx.createAnalyser();
    this.meterNode.fftSize = 2048;
    this.meterNode.smoothingTimeConstant = 0.8;
    
    // Connect main chain
    // Input → Insert Input → Insert Chain → Insert Output → Pre-Fader → Pan → Post-Fader → Meter → Output
    this.inputNode.connect(this.insertInputNode);
    this.insertInputNode.connect(this.insertOutputNode);
    this.insertOutputNode.connect(this.preFaderSendNode);
    this.preFaderSendNode.connect(this.pannerNode);
    this.pannerNode.connect(this.postFaderSendNode);
    this.postFaderSendNode.connect(this.meterNode);
    this.meterNode.connect(this.outputNode);
  }

  // =============================================================================
  // Insert Chain Management
  // =============================================================================

  private initializeInserts(): void {
    for (let i = 0; i < this.insertSlots; i++) {
      this.insertChain.push(null);
      
      // Create bypass nodes for each slot
      const bypassInput = this.audioContext.createGain();
      const bypassOutput = this.audioContext.createGain();
      bypassInput.connect(bypassOutput);
      
      this.insertBypassNodes.set(i, {
        input: bypassInput,
        output: bypassOutput,
      });
    }
    
    // Connect insert chain
    this.reconnectInsertChain();
  }

  private reconnectInsertChain(): void {
    // Disconnect everything first
    this.insertInputNode.disconnect();
    
    let currentNode: AudioNode = this.insertInputNode;
    
    for (let i = 0; i < this.insertSlots; i++) {
      const plugin = this.insertChain[i];
      const bypass = this.insertBypassNodes.get(i)!;
      
      if (plugin && !this.isSlotBypassed(i)) {
        // Connect through plugin
        currentNode.connect(plugin);
        currentNode = plugin;
      } else {
        // Connect through bypass
        currentNode.connect(bypass.input);
        currentNode = bypass.output;
      }
    }
    
    // Connect to insert output
    currentNode.connect(this.insertOutputNode);
  }

  public addPlugin(slotIndex: number, pluginNode: AudioNode, pluginId: string): boolean {
    if (slotIndex < 0 || slotIndex >= this.insertSlots) return false;
    
    // Remove existing plugin if any
    this.removePlugin(slotIndex);
    
    // Add new plugin
    this.insertChain[slotIndex] = pluginNode;
    
    // Reconnect
    this.reconnectInsertChain();
    
    // Notify state change
    this.notifyStateChange();
    
    return true;
  }

  public removePlugin(slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= this.insertSlots) return false;
    
    const plugin = this.insertChain[slotIndex];
    if (plugin) {
      plugin.disconnect();
      this.insertChain[slotIndex] = null;
      
      this.reconnectInsertChain();
      this.notifyStateChange();
    }
    
    return true;
  }

  public reorderPlugins(fromSlot: number, toSlot: number): boolean {
    if (fromSlot < 0 || fromSlot >= this.insertSlots) return false;
    if (toSlot < 0 || toSlot >= this.insertSlots) return false;
    if (fromSlot === toSlot) return false;
    
    // Swap plugins
    const temp = this.insertChain[fromSlot];
    this.insertChain[fromSlot] = this.insertChain[toSlot];
    this.insertChain[toSlot] = temp;
    
    this.reconnectInsertChain();
    this.notifyStateChange();
    
    return true;
  }

  public setInsertBypass(slotIndex: number, bypass: boolean): boolean {
    if (slotIndex < 0 || slotIndex >= this.insertSlots) return false;
    
    const bypassNodes = this.insertBypassNodes.get(slotIndex);
    if (bypassNodes) {
      // Reconnect with new bypass state
      this.reconnectInsertChain();
      this.notifyStateChange();
    }
    
    return true;
  }

  public isSlotBypassed(slotIndex: number): boolean {
    // Check if slot has a plugin but is bypassed
    // This is handled by the insert chain state
    return false; // Placeholder - actual implementation depends on UI state
  }

  public getInsertSlotState(slotIndex: number): InsertSlot | null {
    if (slotIndex < 0 || slotIndex >= this.insertSlots) return null;
    
    return {
      slotIndex,
      pluginId: null, // Would need to track this separately
      pluginInstanceId: null,
      bypass: false,
      enabled: this.insertChain[slotIndex] !== null,
    };
  }

  // =============================================================================
  // Send Management
  // =============================================================================

  public addSend(busId: string): boolean {
    if (this.sendNodes.has(busId)) return false;
    
    const ctx = this.audioContext;
    
    // Pre-fader send (taps from insert output)
    const preSend = ctx.createGain();
    preSend.gain.value = 0; // Default to -Infinity
    this.preFaderSendNode.connect(preSend);
    
    // Post-fader send (taps from panner output)
    const postSend = ctx.createGain();
    postSend.gain.value = 0;
    this.pannerNode.connect(postSend);
    
    this.sendNodes.set(busId, { pre: preSend, post: postSend });
    
    return true;
  }

  public removeSend(busId: string): boolean {
    const sends = this.sendNodes.get(busId);
    if (!sends) return false;
    
    sends.pre.disconnect();
    sends.post.disconnect();
    
    this.sendNodes.delete(busId);
    
    return true;
  }

  public setSendLevel(busId: string, db: number): boolean {
    const sends = this.sendNodes.get(busId);
    if (!sends) return false;
    
    const gain = dbToGain(db);
    
    // Determine which send to use based on pre/post setting
    const sendState = this.getSendState(busId);
    const targetSend = sendState?.preFader ? sends.pre : sends.post;
    
    targetSend.gain.setTargetAtTime(gain, this.audioContext.currentTime, 0.01);
    
    this.notifyStateChange();
    
    return true;
  }

  public setSendPreFader(busId: string, preFader: boolean): boolean {
    const sends = this.sendNodes.get(busId);
    if (!sends) return false;
    
    // Store this setting - actual routing is handled when setting level
    // Would need to track this in send state
    
    this.notifyStateChange();
    return true;
  }

  public enableSend(busId: string, enabled: boolean): boolean {
    const sends = this.sendNodes.get(busId);
    if (!sends) return false;
    
    const gain = enabled ? dbToGain(this.getSendState(busId)?.levelDb || -60) : 0;
    
    sends.pre.gain.setTargetAtTime(gain, this.audioContext.currentTime, 0.01);
    sends.post.gain.setTargetAtTime(gain, this.audioContext.currentTime, 0.01);
    
    this.notifyStateChange();
    
    return true;
  }

  public getSendState(busId: string): SendState | null {
    const sends = this.sendNodes.get(busId);
    if (!sends) return null;
    
    // Calculate dB from gain
    const preGain = sends.pre.gain.value;
    const postGain = sends.post.gain.value;
    const activeGain = Math.max(preGain, postGain);
    
    return {
      busId,
      levelDb: gainToDb(activeGain),
      preFader: false, // Would need to track this
      enabled: activeGain > 0,
    };
  }

  public getSendOutputNode(busId: string, preFader: boolean = false): GainNode | null {
    const sends = this.sendNodes.get(busId);
    if (!sends) return null;
    
    return preFader ? sends.pre : sends.post;
  }

  // =============================================================================
  // Volume & Pan
  // =============================================================================

  public setVolume(db: number): void {
    this.volumeDb = Math.max(-60, Math.min(12, db));
    const gain = this.mute ? 0 : dbToGain(this.volumeDb);
    
    this.outputNode.gain.setTargetAtTime(gain, this.audioContext.currentTime, 0.01);
    
    this.notifyStateChange();
  }

  public getVolume(): number {
    return this.volumeDb;
  }

  public setPan(value: number): void {
    this.pan = Math.max(-1, Math.min(1, value));
    this.pannerNode.pan.setTargetAtTime(this.pan, this.audioContext.currentTime, 0.01);
    
    this.notifyStateChange();
  }

  public getPan(): number {
    return this.pan;
  }

  // =============================================================================
  // Mute & Solo
  // =============================================================================

  public setMute(mute: boolean): void {
    this.mute = mute;
    const gain = this.mute ? 0 : dbToGain(this.volumeDb);
    
    this.outputNode.gain.setTargetAtTime(gain, this.audioContext.currentTime, 0.01);
    
    this.notifyStateChange();
  }

  public getMute(): boolean {
    return this.mute;
  }

  public setSolo(solo: boolean): void {
    this.solo = solo;
    
    // Solo logic handled at mixer level
    this.notifyStateChange();
  }

  public getSolo(): boolean {
    return this.solo;
  }

  public toggleMute(): void {
    this.setMute(!this.mute);
  }

  public toggleSolo(): void {
    this.setSolo(!this.solo);
  }

  // =============================================================================
  // Metering
  // =============================================================================

  private startMetering(): void {
    this.audioMeter.start((data: MeterData) => {
      this.meterUpdateCallback?.(data);
    });
  }

  public getMeterData(): MeterData {
    return this.audioMeter.getData();
  }

  public resetPeakHold(): void {
    this.audioMeter.resetPeakHold();
  }

  public setMeterUpdateCallback(callback: (data: MeterData) => void): void {
    this.meterUpdateCallback = callback;
  }

  // =============================================================================
  // Connections
  // =============================================================================

  public connect(destination: AudioNode): void {
    this.outputNode.connect(destination);
  }

  public disconnect(): void {
    this.outputNode.disconnect();
  }

  public getOutputNode(): GainNode {
    return this.outputNode;
  }

  public getInputNode(): GainNode {
    return this.inputNode;
  }

  // =============================================================================
  // State Management
  // =============================================================================

  public getState(): ChannelStripState {
    const sends: Map<string, SendState> = new Map();
    
    for (const [busId] of Array.from(this.sendNodes.entries())) {
      const state = this.getSendState(busId);
      if (state) {
        sends.set(busId, state);
      }
    }
    
    return {
      id: this.id,
      name: this.name,
      volumeDb: this.volumeDb,
      pan: this.pan,
      mute: this.mute,
      solo: this.solo,
      arm: false,
      inserts: Array.from({ length: this.insertSlots }, (_, i) => ({
        slotIndex: i,
        pluginId: null,
        pluginInstanceId: null,
        bypass: false,
        enabled: this.insertChain[i] !== null,
      })),
      sends,
    };
  }

  public setState(state: Partial<ChannelStripState>): void {
    if (state.volumeDb !== undefined) this.setVolume(state.volumeDb);
    if (state.pan !== undefined) this.setPan(state.pan);
    if (state.mute !== undefined) this.setMute(state.mute);
    if (state.solo !== undefined) this.setSolo(state.solo);
    if (state.name) this.name = state.name;
  }

  private notifyStateChange(): void {
    this.stateChangeCallback?.(this.getState());
  }

  public setStateChangeCallback(callback: (state: ChannelStripState) => void): void {
    this.stateChangeCallback = callback;
  }

  // =============================================================================
  // Cleanup
  // =============================================================================

  public dispose(): void {
    // Stop metering
    this.audioMeter.stop();
    
    // Disconnect all nodes
    this.inputNode.disconnect();
    this.insertInputNode.disconnect();
    this.insertOutputNode.disconnect();
    this.preFaderSendNode.disconnect();
    this.pannerNode.disconnect();
    this.postFaderSendNode.disconnect();
    this.meterNode.disconnect();
    this.outputNode.disconnect();
    
    // Disconnect sends
    for (const [_, sends] of Array.from(this.sendNodes.entries())) {
      sends.pre.disconnect();
      sends.post.disconnect();
    }
    
    // Disconnect plugins
    for (const plugin of this.insertChain) {
      if (plugin) {
        plugin.disconnect();
      }
    }
    
    // Disconnect bypass nodes
    for (const [_, bypass] of Array.from(this.insertBypassNodes.entries())) {
      bypass.input.disconnect();
      bypass.output.disconnect();
    }
  }

  // =============================================================================
  // Getters
  // =============================================================================

  public getId(): string {
    return this.id;
  }

  public getName(): string {
    return this.name;
  }

  public setName(name: string): void {
    this.name = name;
    this.notifyStateChange();
  }

  public getColor(): string {
    return this.color;
  }

  public getInsertSlotCount(): number {
    return this.insertSlots;
  }

  public getSendBuses(): string[] {
    return Array.from(this.sendNodes.keys());
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createChannelStrip(
  audioContext: AudioContext,
  config: ChannelStripConfig
): ChannelStrip {
  return new ChannelStrip(audioContext, config);
}

export default ChannelStrip;
