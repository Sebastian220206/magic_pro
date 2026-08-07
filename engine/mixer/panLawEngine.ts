/**
 * Pan Law Engine - Audio Processing for Panning
 *
 * Features:
 * - Real-time pan law processing
 * - Smooth parameter automation
 * - Per-track pan law override
 * - Global default pan law
 * - Metering integration
 * - Multiple pan modes (stereo, balance, binaural)
 */

import {
  PanLawType,
  PanGain,
  PAN_LAW_PRESETS,
  calculatePanGain,
  calculatePanGainDb,
} from './panLaws';

// =============================================================================
// Pan Mode Types
// =============================================================================

export type PanMode = 'stereo' | 'balance' | 'binaural' | 'dual-mono';

export interface PanConfig {
  lawType: PanLawType;
  pan: number;            // -1 to 1
  mode: PanMode;
  width: number;          // 0-2 (1 = normal, <1 = narrow, >1 = wide)
  linked: boolean;        // Link to another channel
  inverted: boolean;      // Invert pan direction
}

// =============================================================================
// Pan Law Engine
// =============================================================================

export class PanLawEngine {
  private audioContext: AudioContext | null = null;
  private inputNode: GainNode | null = null;
  private leftGainNode: GainNode | null = null;
  private rightGainNode: GainNode | null = null;
  private panNode: StereoPannerNode | null = null;
  private outputNode: GainNode | null = null;

  private config: PanConfig;
  private currentGain: PanGain = { left: 1, right: 1 };
  private targetGain: PanGain = { left: 1, right: 1 };
  private smoothingTime: number = 0.02; // 20ms smoothing
  private lastUpdateTime: number = 0;

  private listeners: Array<(config: PanConfig) => void> = [];

  constructor(config: Partial<PanConfig> = {}) {
    this.config = {
      lawType: config.lawType ?? '-3db',
      pan: config.pan ?? 0,
      mode: config.mode ?? 'stereo',
      width: config.width ?? 1,
      linked: config.linked ?? false,
      inverted: config.inverted ?? false,
    };
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  public initialize(audioContext: AudioContext): void {
    this.audioContext = audioContext;

    this.inputNode = audioContext.createGain();
    this.leftGainNode = audioContext.createGain();
    this.rightGainNode = audioContext.createGain();
    this.panNode = audioContext.createStereoPanner();
    this.outputNode = audioContext.createGain();

    // Connect: input → split to left/right gains → merge → output
    this.inputNode.connect(this.leftGainNode);
    this.inputNode.connect(this.rightGainNode);
    this.leftGainNode.connect(this.panNode);
    this.rightGainNode.connect(this.panNode);
    this.panNode.connect(this.outputNode);

    this.updateGains();
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

  public connect(destination: AudioNode): void {
    this.outputNode?.connect(destination);
  }

  public disconnect(): void {
    this.outputNode?.disconnect();
  }

  // ===========================================================================
  // Pan Control
  // ===========================================================================

  public setPan(pan: number): void {
    this.config.pan = Math.max(-1, Math.min(1, pan));
    this.updateGains();
    this.notifyListeners();
  }

  public getPan(): number {
    return this.config.pan;
  }

  public setPanDb(pan: number): void {
    // Convert dB to linear pan value
    this.setPan(Math.max(-1, Math.min(1, pan)));
  }

  public setPanLaw(lawType: PanLawType): void {
    this.config.lawType = lawType;
    this.updateGains();
    this.notifyListeners();
  }

  public getPanLaw(): PanLawType {
    return this.config.lawType;
  }

  public setMode(mode: PanMode): void {
    this.config.mode = mode;
    this.updateGains();
    this.notifyListeners();
  }

  public getMode(): PanMode {
    return this.config.mode;
  }

  public setWidth(width: number): void {
    this.config.width = Math.max(0, Math.min(2, width));
    this.updateGains();
    this.notifyListeners();
  }

  public getWidth(): number {
    return this.config.width;
  }

  public setLinked(linked: boolean): void {
    this.config.linked = linked;
    this.notifyListeners();
  }

  public isLinked(): boolean {
    return this.config.linked;
  }

  public setInverted(inverted: boolean): void {
    this.config.inverted = inverted;
    this.updateGains();
    this.notifyListeners();
  }

  public isInverted(): boolean {
    return this.config.inverted;
  }

  // ===========================================================================
  // Gain Calculation
  // ===========================================================================

  private updateGains(): void {
    if (!this.audioContext || !this.leftGainNode || !this.rightGainNode) return;

    const pan = this.config.inverted ? -this.config.pan : this.config.pan;
    const gain = calculatePanGain(pan, this.config.lawType);

    // Apply width adjustment
    const width = this.config.width;
    let leftGain = gain.left;
    let rightGain = gain.right;

    if (width !== 1) {
      const center = (leftGain + rightGain) / 2;
      const spread = (leftGain - rightGain) / 2;
      leftGain = center + spread * width;
      rightGain = center - spread * width;
    }

    // Apply mode-specific processing
    switch (this.config.mode) {
      case 'balance':
        // Balance mode: shift center without changing width
        leftGain = 1 - (pan + 1) / 4;
        rightGain = 0.75 + (pan + 1) / 4;
        break;

      case 'binaural':
        // Binaural: use head-related transfer function approximation
        const angle = (pan + 1) / 2 * Math.PI / 2;
        leftGain = Math.cos(angle) * 0.8;
        rightGain = Math.sin(angle) * 0.8;
        break;

      case 'dual-mono':
        // Dual mono: same signal to both channels
        leftGain = 1;
        rightGain = 1;
        break;
    }

    this.targetGain = { left: leftGain, right: rightGain };
    this.smoothGains();
  }

  private smoothGains(): void {
    if (!this.audioContext || !this.leftGainNode || !this.rightGainNode) return;

    const now = this.audioContext.currentTime;
    const timeConstant = this.smoothingTime;

    // Smooth transition to target gains
    this.leftGainNode.gain.setTargetAtTime(
      this.targetGain.left,
      now,
      timeConstant
    );
    this.rightGainNode.gain.setTargetAtTime(
      this.targetGain.right,
      now,
      timeConstant
    );

    this.currentGain = { ...this.targetGain };
  }

  // ===========================================================================
  // Metering
  // ===========================================================================

  public getCurrentGain(): PanGain {
    return this.currentGain;
  }

  public getGainDb(): { leftDb: number; rightDb: number } {
    return {
      leftDb: this.currentGain.left > 0.0001
        ? 20 * Math.log10(this.currentGain.left)
        : -Infinity,
      rightDb: this.currentGain.right > 0.0001
        ? 20 * Math.log10(this.currentGain.right)
        : -Infinity,
    };
  }

  // ===========================================================================
  // Smoothing
  // ===========================================================================

  public setSmoothingTime(time: number): void {
    this.smoothingTime = Math.max(0, Math.min(0.5, time));
  }

  public getSmoothingTime(): number {
    return this.smoothingTime;
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getConfig(): Readonly<PanConfig> {
    return this.config;
  }

  public setConfig(config: Partial<PanConfig>): void {
    Object.assign(this.config, config);
    this.updateGains();
    this.notifyListeners();
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  public subscribe(listener: (config: PanConfig) => void): () => void {
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
      listener(this.config);
    }
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  public dispose(): void {
    this.disconnect();
    this.inputNode?.disconnect();
    this.leftGainNode?.disconnect();
    this.rightGainNode?.disconnect();
    this.panNode?.disconnect();
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  public serialize(): PanConfig {
    return { ...this.config };
  }

  public deserialize(config: Partial<PanConfig>): void {
    Object.assign(this.config, config);
    this.updateGains();
    this.notifyListeners();
  }
}

// =============================================================================
// Pan Law Preset Processor
// =============================================================================

export function processPanLaw(
  inputLeft: Float32Array,
  inputRight: Float32Array,
  outputLeft: Float32Array,
  outputRight: Float32Array,
  pan: number,
  lawType: PanLawType = '-3db'
): void {
  const gain = calculatePanGain(pan, lawType);

  for (let i = 0; i < inputLeft.length; i++) {
    outputLeft[i] = inputLeft[i] * gain.left;
    outputRight[i] = inputRight[i] * gain.right;
  }
}

export function processPanLawMono(
  input: Float32Array,
  outputLeft: Float32Array,
  outputRight: Float32Array,
  pan: number,
  lawType: PanLawType = '-3db'
): void {
  const gain = calculatePanGain(pan, lawType);

  for (let i = 0; i < input.length; i++) {
    outputLeft[i] = input[i] * gain.left;
    outputRight[i] = input[i] * gain.right;
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createPanLawEngine(config?: Partial<PanConfig>): PanLawEngine {
  return new PanLawEngine(config);
}

export default PanLawEngine;
