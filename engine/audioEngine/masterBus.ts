/**
 * Master Bus - Master channel with limiter and meter
 * 
 * Signal Flow:
 * All Track Outputs → Master Gain → Master Meter → Limiter → Audio Output
 */

import { AudioMeter, MeterData } from './audioMeter';
import { dbToGain, gainToDb } from './channelStrip';

// =============================================================================
// Types
// =============================================================================

export interface MasterBusState {
  volumeDb: number;
  limiterEnabled: boolean;
  limiterThreshold: number;
  meterData: MeterData;
}

export interface LimiterOptions {
  threshold: number;    // dB
  release: number;      // ms
  lookahead: number;    // ms
}

// =============================================================================
// Master Bus Class
// =============================================================================

export class MasterBus {
  private audioContext: AudioContext;
  
  // Audio Nodes
  public inputNode!: GainNode;
  private gainNode!: GainNode;
  private meterNode!: AnalyserNode;
  private limiterNode!: DynamicsCompressorNode;
  private outputNode!: GainNode;
  
  // Meter
  private audioMeter!: AudioMeter;
  
  // State
  private volumeDb: number = 0;
  private limiterEnabled: boolean = true;
  private limiterThreshold: number = -1; // -1dB
  
  // Callbacks
  private meterUpdateCallback?: (data: MeterData) => void;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.createAudioGraph();
    
    this.audioMeter = new AudioMeter(this.meterNode, {
      fftSize: 2048,
      smoothingTimeConstant: 0.8,
      minDecibels: -100,
      maxDecibels: 0,
    });
    
    this.startMetering();
  }

  private createAudioGraph(): void {
    const ctx = this.audioContext;
    
    // Input (receives all track outputs)
    this.inputNode = ctx.createGain();
    this.inputNode.gain.value = 1;
    
    // Master fader
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = 1;
    
    // Meter node (before limiter to see true peaks)
    this.meterNode = ctx.createAnalyser();
    this.meterNode.fftSize = 2048;
    
    // Limiter (protects output)
    this.limiterNode = ctx.createDynamicsCompressor();
    this.limiterNode.threshold.value = this.limiterThreshold;
    this.limiterNode.knee.value = 0;
    this.limiterNode.ratio.value = 20;
    this.limiterNode.attack.value = 0.003;
    this.limiterNode.release.value = 0.1;
    
    // Output (connects to destination)
    this.outputNode = ctx.createGain();
    this.outputNode.gain.value = 1;
    
    // Connect chain
    this.inputNode.connect(this.gainNode);
    this.gainNode.connect(this.meterNode);
    this.meterNode.connect(this.limiterNode);
    this.limiterNode.connect(this.outputNode);
  }

  // =============================================================================
  // Volume Control
  // =============================================================================

  public setVolume(db: number): void {
    this.volumeDb = Math.max(-60, Math.min(12, db));
    const gain = dbToGain(this.volumeDb);
    this.gainNode.gain.setTargetAtTime(gain, this.audioContext.currentTime, 0.01);
  }

  public getVolume(): number {
    return this.volumeDb;
  }

  // =============================================================================
  // Limiter Control
  // =============================================================================

  public enableLimiter(enabled: boolean): void {
    this.limiterEnabled = enabled;
    
    if (enabled) {
      this.limiterNode.threshold.value = this.limiterThreshold;
    } else {
      // Disable by setting threshold to +100dB
      this.limiterNode.threshold.value = 100;
    }
  }

  public isLimiterEnabled(): boolean {
    return this.limiterEnabled;
  }

  public setLimiterThreshold(db: number): void {
    this.limiterThreshold = Math.max(-30, Math.min(0, db));
    if (this.limiterEnabled) {
      this.limiterNode.threshold.value = this.limiterThreshold;
    }
  }

  public getLimiterThreshold(): number {
    return this.limiterThreshold;
  }

  public getLimiterReduction(): number {
    // reduction is an AudioParam, read its current value
    return this.limiterNode.reduction.value;
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

  public connectTrack(trackOutput: AudioNode): void {
    trackOutput.connect(this.inputNode);
  }

  public disconnectTrack(trackOutput: AudioNode): void {
    trackOutput.disconnect(this.inputNode);
  }

  public connectToDestination(destination: AudioDestinationNode): void {
    this.outputNode.connect(destination);
  }

  public disconnectFromDestination(): void {
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

  public getState(): MasterBusState {
    return {
      volumeDb: this.volumeDb,
      limiterEnabled: this.limiterEnabled,
      limiterThreshold: this.limiterThreshold,
      meterData: this.getMeterData(),
    };
  }

  public setState(state: Partial<MasterBusState>): void {
    if (state.volumeDb !== undefined) this.setVolume(state.volumeDb);
    if (state.limiterEnabled !== undefined) this.enableLimiter(state.limiterEnabled);
    if (state.limiterThreshold !== undefined) this.setLimiterThreshold(state.limiterThreshold);
  }

  // =============================================================================
  // Cleanup
  // =============================================================================

  public dispose(): void {
    this.audioMeter.stop();
    
    this.inputNode.disconnect();
    this.gainNode.disconnect();
    this.meterNode.disconnect();
    this.limiterNode.disconnect();
    this.outputNode.disconnect();
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createMasterBus(audioContext: AudioContext): MasterBus {
  return new MasterBus(audioContext);
}

export default MasterBus;
