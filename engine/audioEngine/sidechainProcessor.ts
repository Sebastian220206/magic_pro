/**
 * Sidechain Processor - Real-time Sidechain Signal Processing
 *
 * Features:
 * - Real-time level detection
 * - Envelope follower with attack/release
 * - Gain reduction calculation
 * - Wet/dry mixing
 * - Latency compensation
 *
 * Signal Flow:
 * Sidechain Input → Detector → Envelope Follower → Gain Calculator → Output
 */

import { SidechainRoute, SidechainDetectionMode } from './sidechainRouter';

export interface SidechainProcessorConfig {
  attack: number;        // ms (0.1-100)
  release: number;       // ms (1-1000)
  threshold: number;     // dB (-60 to 0)
  ratio: number;         // 1:1 to ∞:1
  knee: number;          // dB (0-30)
  makeupGain: number;    // dB (0-24)
  autoMakeup: boolean;
  mix: number;           // 0-1
}

export interface SidechainProcessorState {
  currentLevel: number;
  gainReduction: number;
  envelope: number;
  isProcessing: boolean;
}

export interface SidechainProcessorOptions {
  attack?: number;
  release?: number;
  threshold?: number;
  ratio?: number;
  knee?: number;
  makeupGain?: number;
  autoMakeup?: boolean;
  mix?: number;
}

const DEFAULT_CONFIG: SidechainProcessorConfig = {
  attack: 10,
  release: 100,
  threshold: -20,
  ratio: 4,
  knee: 6,
  makeupGain: 0,
  autoMakeup: false,
  mix: 1,
};

export class SidechainProcessor {
  private config: SidechainProcessorConfig;
  private state: SidechainProcessorState;
  private audioContext: AudioContext | null = null;

  // Audio Nodes
  private inputNode: GainNode | null = null;
  private outputNode: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private detectorNode: AnalyserNode | null = null;

  // Detection state
  private currentEnvelope = 0;
  private lastLevel = 0;
  private lastUpdateTime = 0;

  // Smoothing
  private readonly SMOOTHING_TIME = 0.01;

  constructor(options: SidechainProcessorOptions = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.state = {
      currentLevel: 0,
      gainReduction: 0,
      envelope: 0,
      isProcessing: false,
    };
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  public initialize(audioContext: AudioContext): void {
    this.audioContext = audioContext;

    this.inputNode = audioContext.createGain();
    this.outputNode = audioContext.createGain();
    this.dryGain = audioContext.createGain();
    this.wetGain = audioContext.createGain();
    this.detectorNode = audioContext.createAnalyser();
    this.detectorNode.fftSize = 2048;
    this.detectorNode.smoothingTimeConstant = 0.3;

    // Build signal chain
    this.inputNode.connect(this.detectorNode);
    this.inputNode.connect(this.dryGain);
    this.inputNode.connect(this.wetGain);

    this.dryGain.connect(this.outputNode);
    this.wetGain.connect(this.outputNode);

    this.dryGain.gain.value = 1 - this.config.mix;
    this.wetGain.gain.value = this.config.mix;

    this.state.isProcessing = true;
  }

  // ===========================================================================
  // Processing
  // ===========================================================================

  public process(sidechainLevel: number): number {
    if (!this.state.isProcessing) return 1;

    const now = performance.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = now;

    // Update envelope
    this.updateEnvelope(sidechainLevel, deltaTime);

    // Calculate gain reduction
    const gainReduction = this.calculateGainReduction(this.currentEnvelope);

    // Apply gain reduction
    this.state.currentLevel = sidechainLevel;
    this.state.gainReduction = gainReduction;
    this.state.envelope = this.currentEnvelope;

    return gainReduction;
  }

  private updateEnvelope(level: number, deltaTime: number): void {
    const attackTime = this.config.attack / 1000;
    const releaseTime = this.config.release / 1000;

    if (level > this.currentEnvelope) {
      // Attack
      const attackCoeff = 1 - Math.exp(-deltaTime / attackTime);
      this.currentEnvelope += (level - this.currentEnvelope) * attackCoeff;
    } else {
      // Release
      const releaseCoeff = 1 - Math.exp(-deltaTime / releaseTime);
      this.currentEnvelope += (level - this.currentEnvelope) * releaseCoeff;
    }
  }

  private calculateGainReduction(level: number): number {
    const { threshold, ratio, knee, makeupGain, autoMakeup } = this.config;

    // Convert level to dB
    const levelDb = level > 0 ? 20 * Math.log10(level) : -Infinity;

    // Check if below threshold
    if (levelDb < threshold - knee / 2) {
      return 1; // No gain reduction
    }

    // Calculate gain reduction with knee
    let gainReductionDb = 0;

    if (levelDb > threshold + knee / 2) {
      // Above knee
      gainReductionDb = (threshold - levelDb) + (levelDb - threshold) / ratio;
    } else {
      // In knee region
      const kneeRatio = 1 + (ratio - 1) * ((levelDb - threshold + knee / 2) / knee);
      gainReductionDb = (threshold - levelDb) + (levelDb - threshold) / kneeRatio;
    }

    // Auto makeup gain
    if (autoMakeup) {
      const maxReduction = Math.abs((threshold - (threshold + 20)) * (1 - 1 / ratio));
      gainReductionDb += maxReduction * 0.5;
    } else {
      gainReductionDb += makeupGain;
    }

    // Convert to linear
    return Math.pow(10, gainReductionDb / 20);
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  public setAttack(ms: number): void {
    this.config.attack = Math.max(0.1, Math.min(100, ms));
  }

  public getAttack(): number {
    return this.config.attack;
  }

  public setRelease(ms: number): void {
    this.config.release = Math.max(1, Math.min(1000, ms));
  }

  public getRelease(): number {
    return this.config.release;
  }

  public setThreshold(db: number): void {
    this.config.threshold = Math.max(-60, Math.min(0, db));
  }

  public getThreshold(): number {
    return this.config.threshold;
  }

  public setRatio(ratio: number): void {
    this.config.ratio = Math.max(1, Math.min(30, ratio));
  }

  public getRatio(): number {
    return this.config.ratio;
  }

  public setKnee(db: number): void {
    this.config.knee = Math.max(0, Math.min(30, db));
  }

  public setMakeupGain(db: number): void {
    this.config.makeupGain = Math.max(0, Math.min(24, db));
  }

  public setAutoMakeup(enabled: boolean): void {
    this.config.autoMakeup = enabled;
  }

  public setMix(mix: number): void {
    this.config.mix = Math.max(0, Math.min(1, mix));
    if (this.dryGain && this.wetGain) {
      this.dryGain.gain.setTargetAtTime(1 - mix, this.audioContext?.currentTime ?? 0, this.SMOOTHING_TIME);
      this.wetGain.gain.setTargetAtTime(mix, this.audioContext?.currentTime ?? 0, this.SMOOTHING_TIME);
    }
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getState(): Readonly<SidechainProcessorState> {
    return this.state;
  }

  public getConfig(): Readonly<SidechainProcessorConfig> {
    return this.config;
  }

  public getCurrentLevel(): number {
    return this.state.currentLevel;
  }

  public getGainReduction(): number {
    return this.state.gainReduction;
  }

  public getEnvelope(): number {
    return this.state.envelope;
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

  public getDetectorNode(): AnalyserNode | null {
    return this.detectorNode;
  }

  // ===========================================================================
  // Processing Control
  // ===========================================================================

  public start(): void {
    this.state.isProcessing = true;
  }

  public stop(): void {
    this.state.isProcessing = false;
    this.currentEnvelope = 0;
    this.state.gainReduction = 1;
  }

  public reset(): void {
    this.currentEnvelope = 0;
    this.lastLevel = 0;
    this.state.currentLevel = 0;
    this.state.gainReduction = 1;
    this.state.envelope = 0;
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  public dispose(): void {
    this.stop();
    this.inputNode?.disconnect();
    this.outputNode?.disconnect();
    this.dryGain?.disconnect();
    this.wetGain?.disconnect();
    this.detectorNode?.disconnect();
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  public serialize(): SidechainProcessorConfig {
    return { ...this.config };
  }

  public deserialize(config: Partial<SidechainProcessorConfig>): void {
    Object.assign(this.config, config);
    this.setMix(this.config.mix);
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createSidechainProcessor(options?: SidechainProcessorOptions): SidechainProcessor {
  return new SidechainProcessor(options);
}

export default SidechainProcessor;
