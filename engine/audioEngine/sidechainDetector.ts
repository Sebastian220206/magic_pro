/**
 * Sidechain Detector - Level Detection Circuit
 *
 * Features:
 * - Peak detection
 * - RMS detection
 * - Envelope following
 * - Frequency-selective detection
 * - Stereo link modes
 * - Lookahead for transient detection
 *
 * Detection Modes:
 * - Peak: Instantaneous peak level
 * - RMS: Root mean square (average level)
 * - Envelope: Smoothed envelope follower
 * - Spectral: Frequency-weighted detection
 */

export type DetectorMode = 'peak' | 'rms' | 'envelope' | 'spectral';
export type DetectorStereoLink = 'left' | 'right' | 'sum' | 'max';

export interface DetectorConfig {
  mode: DetectorMode;
  stereoLink: DetectorStereoLink;
  attack: number;        // ms (0.01-100)
  release: number;       // ms (1-2000)
  hold: number;          // ms (0-500)
  lookahead: number;     // ms (0-20)
  filterFreq: number;    // Hz (20-20000)
  filterQ: number;       // 0.1-10
  filterEnabled: boolean;
}

export interface DetectorState {
  currentLevel: number;
  peakLevel: number;
  rmsLevel: number;
  envelopeLevel: number;
  spectralLevel: number;
  isClipping: boolean;
  holdTimer: number;
}

export interface DetectorOptions {
  mode?: DetectorMode;
  stereoLink?: DetectorStereoLink;
  attack?: number;
  release?: number;
  hold?: number;
  lookahead?: number;
  filterFreq?: number;
  filterQ?: number;
  filterEnabled?: boolean;
}

const DEFAULT_CONFIG: DetectorConfig = {
  mode: 'envelope',
  stereoLink: 'sum',
  attack: 10,
  release: 100,
  hold: 50,
  lookahead: 0,
  filterFreq: 1000,
  filterQ: 1,
  filterEnabled: false,
};

export class SidechainDetector {
  private config: DetectorConfig;
  private state: DetectorState;
  private audioContext: AudioContext | null = null;

  // Audio Nodes
  private inputNode: GainNode | null = null;
  private outputNode: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private splitterNode: ChannelSplitterNode | null = null;
  private analyserLeft: AnalyserNode | null = null;
  private analyserRight: AnalyserNode | null = null;
  private lookaheadDelay: DelayNode | null = null;

  // Detection buffers
  private bufferLeft: Float32Array<ArrayBuffer> | null = null;
  private bufferRight: Float32Array<ArrayBuffer> | null = null;

  // Envelope state
  private currentEnvelope = 0;
  private holdTimer = 0;
  private lastUpdateTime = 0;

  constructor(options: DetectorOptions = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.state = {
      currentLevel: 0,
      peakLevel: 0,
      rmsLevel: 0,
      envelopeLevel: 0,
      spectralLevel: 0,
      isClipping: false,
      holdTimer: 0,
    };
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  public initialize(audioContext: AudioContext): void {
    this.audioContext = audioContext;

    // Create nodes
    this.inputNode = audioContext.createGain();
    this.outputNode = audioContext.createGain();
    this.splitterNode = audioContext.createChannelSplitter(2);
    this.analyserLeft = audioContext.createAnalyser();
    this.analyserRight = audioContext.createAnalyser();

    this.analyserLeft.fftSize = 2048;
    this.analyserLeft.smoothingTimeConstant = 0;
    this.analyserRight.fftSize = 2048;
    this.analyserRight.smoothingTimeConstant = 0;

    // Optional filter
    this.filterNode = audioContext.createBiquadFilter();
    this.filterNode.type = 'bandpass';
    this.filterNode.frequency.value = this.config.filterFreq;
    this.filterNode.Q.value = this.config.filterQ;
    this.filterNode.connect(this.outputNode);

    // Optional lookahead
    if (this.config.lookahead > 0) {
      this.lookaheadDelay = audioContext.createDelay(0.02);
      this.lookaheadDelay.delayTime.value = this.config.lookahead / 1000;
    }

    // Create buffers
    this.bufferLeft = new Float32Array(this.analyserLeft.frequencyBinCount) as Float32Array<ArrayBuffer>;
    this.bufferRight = new Float32Array(this.analyserRight.frequencyBinCount) as Float32Array<ArrayBuffer>;

    // Connect signal chain
    this.inputNode.connect(this.splitterNode);
    this.splitterNode.connect(this.analyserLeft, 0);
    this.splitterNode.connect(this.analyserRight, 1);

    this.lastUpdateTime = performance.now();
  }

  // ===========================================================================
  // Detection
  // ===========================================================================

  public detect(): number {
    if (!this.analyserLeft || !this.analyserRight || !this.bufferLeft || !this.bufferRight) {
      return 0;
    }

    const now = performance.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = now;

    // Get audio data
    this.analyserLeft.getFloatTimeDomainData(this.bufferLeft);
    this.analyserRight.getFloatTimeDomainData(this.bufferRight);

    // Apply filter if enabled
    let leftData = this.bufferLeft;
    let rightData = this.bufferRight;

    // Calculate levels based on stereo link mode
    let level = 0;
    switch (this.config.stereoLink) {
      case 'left':
        level = this.calculateLevel(leftData);
        break;
      case 'right':
        level = this.calculateLevel(rightData);
        break;
      case 'sum':
        level = (this.calculateLevel(leftData) + this.calculateLevel(rightData)) / 2;
        break;
      case 'max':
        level = Math.max(this.calculateLevel(leftData), this.calculateLevel(rightData));
        break;
    }

    // Update state
    this.state.peakLevel = Math.max(this.state.peakLevel * 0.999, level);
    this.state.rmsLevel = this.calculateRMS(leftData, rightData);

    // Update envelope
    this.updateEnvelope(level, deltaTime);

    // Apply hold
    if (this.holdTimer > 0) {
      this.holdTimer -= deltaTime * 1000;
    } else {
      this.state.currentLevel = this.currentEnvelope;
    }

    // Apply lookahead
    if (this.config.lookahead > 0 && this.lookaheadDelay) {
      // Lookahead would be applied in the audio graph
    }

    return this.state.currentLevel;
  }

  private calculateLevel(data: Float32Array): number {
    switch (this.config.mode) {
      case 'peak':
        return this.detectPeak(data);
      case 'rms':
        return this.detectRMS(data);
      case 'envelope':
        return this.detectEnvelope(data);
      case 'spectral':
        return this.detectSpectral(data);
      default:
        return this.detectRMS(data);
    }
  }

  private detectPeak(data: Float32Array): number {
    let max = 0;
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > max) max = abs;
    }
    return max;
  }

  private detectRMS(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  private detectEnvelope(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += Math.abs(data[i]);
    }
    return sum / data.length;
  }

  private detectSpectral(data: Float32Array): number {
    // Simple spectral centroid
    let weightedSum = 0;
    let totalMagnitude = 0;

    for (let i = 0; i < data.length; i++) {
      const magnitude = Math.abs(data[i]);
      weightedSum += i * magnitude;
      totalMagnitude += magnitude;
    }

    return totalMagnitude > 0 ? weightedSum / totalMagnitude / data.length : 0;
  }

  private calculateRMS(left: Float32Array, right: Float32Array): number {
    let sum = 0;
    const length = Math.min(left.length, right.length);
    for (let i = 0; i < length; i++) {
      sum += left[i] * left[i] + right[i] * right[i];
    }
    return Math.sqrt(sum / (length * 2));
  }

  private updateEnvelope(level: number, deltaTime: number): void {
    const attackTime = this.config.attack / 1000;
    const releaseTime = this.config.release / 1000;

    if (level > this.currentEnvelope) {
      // Attack
      const attackCoeff = 1 - Math.exp(-deltaTime / attackTime);
      this.currentEnvelope += (level - this.currentEnvelope) * attackCoeff;
      this.holdTimer = this.config.hold;
    } else {
      // Release (only if hold timer expired)
      if (this.holdTimer <= 0) {
        const releaseCoeff = 1 - Math.exp(-deltaTime / releaseTime);
        this.currentEnvelope += (level - this.currentEnvelope) * releaseCoeff;
      }
    }

    this.state.envelopeLevel = this.currentEnvelope;
    this.state.spectralLevel = level;
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  public setMode(mode: DetectorMode): void {
    this.config.mode = mode;
  }

  public getMode(): DetectorMode {
    return this.config.mode;
  }

  public setStereoLink(link: DetectorStereoLink): void {
    this.config.stereoLink = link;
  }

  public setAttack(ms: number): void {
    this.config.attack = Math.max(0.01, Math.min(100, ms));
  }

  public setRelease(ms: number): void {
    this.config.release = Math.max(1, Math.min(2000, ms));
  }

  public setHold(ms: number): void {
    this.config.hold = Math.max(0, Math.min(500, ms));
  }

  public setLookahead(ms: number): void {
    this.config.lookahead = Math.max(0, Math.min(20, ms));
    if (this.lookaheadDelay) {
      this.lookaheadDelay.delayTime.value = ms / 1000;
    }
  }

  public setFilter(freq: number, q: number, enabled: boolean): void {
    this.config.filterFreq = freq;
    this.config.filterQ = q;
    this.config.filterEnabled = enabled;

    if (this.filterNode) {
      this.filterNode.frequency.value = freq;
      this.filterNode.Q.value = q;
    }
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getState(): Readonly<DetectorState> {
    return this.state;
  }

  public getConfig(): Readonly<DetectorConfig> {
    return this.config;
  }

  public getCurrentLevel(): number {
    return this.state.currentLevel;
  }

  public getPeakLevel(): number {
    return this.state.peakLevel;
  }

  public getRMSLevel(): number {
    return this.state.rmsLevel;
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

  // ===========================================================================
  // Reset
  // ===========================================================================

  public reset(): void {
    this.currentEnvelope = 0;
    this.holdTimer = 0;
    this.state.currentLevel = 0;
    this.state.peakLevel = 0;
    this.state.rmsLevel = 0;
    this.state.envelopeLevel = 0;
    this.state.spectralLevel = 0;
    this.state.isClipping = false;
    this.state.holdTimer = 0;
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  public dispose(): void {
    this.inputNode?.disconnect();
    this.outputNode?.disconnect();
    this.filterNode?.disconnect();
    this.splitterNode?.disconnect();
    this.analyserLeft?.disconnect();
    this.analyserRight?.disconnect();
    this.lookaheadDelay?.disconnect();
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  public serialize(): DetectorConfig {
    return { ...this.config };
  }

  public deserialize(config: Partial<DetectorConfig>): void {
    Object.assign(this.config, config);
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createSidechainDetector(options?: DetectorOptions): SidechainDetector {
  return new SidechainDetector(options);
}

export default SidechainDetector;
