/**
 * Loudness Meter - Streaming Compliance
 *
 * Features:
 * - Momentary, Short-Term, Integrated LUFS
 * - True Peak detection
 * - Loudness Range (LRA)
 * - Streaming platform targets
 * - Compliance checking
 *
 * Standards:
 * - EBU R 128: Integrated -23 LUFS, True Peak -1 dBTP
 * - Spotify: Integrated -14 LUFS, True Peak -1 dBTP
 * - Apple Music: Integrated -16 LUFS, True Peak -1 dBTP
 * - YouTube: Integrated -14 LUFS, True Peak -1 dBTP
 * - Tidal: Integrated -14 LUFS, True Peak -1 dBTP
 */

export type StreamingPlatform = 'ebu-r128' | 'spotify' | 'apple-music' | 'youtube' | 'tidal' | 'soundcloud' | 'podcast' | 'custom';

export interface LoudnessTarget {
  platform: StreamingPlatform;
  name: string;
  integratedLUFS: number;
  truePeakdBTP: number;
  loudnessRangeMax: number;
}

export interface LoudnessData {
  momentary: number;
  shortTerm: number;
  integrated: number;
  truePeakLeft: number;
  truePeakRight: number;
  loudnessRange: number;
  peakHoldLeft: number;
  peakHoldRight: number;
  clipLeft: boolean;
  clipRight: boolean;
}

export interface ComplianceResult {
  platform: StreamingPlatform;
  integrated: { value: number; target: number; pass: boolean; diff: number };
  truePeak: { value: number; target: number; pass: boolean; diff: number };
  loudnessRange: { value: number; max: number; pass: boolean };
  overallPass: boolean;
}

export interface LoudnessMeterOptions {
  updateInterval: number;
  historyDuration: number;
  peakHoldDuration: number;
  clipThreshold: number;
}

const BLOCK_SIZE_MS = 100;
const MOMENTARY_WINDOW_MS = 400;
const SHORT_TERM_WINDOW_MS = 3000;
const HALF_WINDOW_400 = Math.floor(400 / BLOCK_SIZE_MS);
const HALF_WINDOW_3000 = Math.floor(3000 / BLOCK_SIZE_MS);

export const STREAMING_TARGETS: Record<StreamingPlatform, LoudnessTarget> = {
  'ebu-r128': {
    platform: 'ebu-r128',
    name: 'EBU R 128',
    integratedLUFS: -23,
    truePeakdBTP: -1,
    loudnessRangeMax: 20,
  },
  'spotify': {
    platform: 'spotify',
    name: 'Spotify',
    integratedLUFS: -14,
    truePeakdBTP: -1,
    loudnessRangeMax: 18,
  },
  'apple-music': {
    platform: 'apple-music',
    name: 'Apple Music',
    integratedLUFS: -16,
    truePeakdBTP: -1,
    loudnessRangeMax: 18,
  },
  'youtube': {
    platform: 'youtube',
    name: 'YouTube',
    integratedLUFS: -14,
    truePeakdBTP: -1,
    loudnessRangeMax: 18,
  },
  'tidal': {
    platform: 'tidal',
    name: 'Tidal',
    integratedLUFS: -14,
    truePeakdBTP: -1,
    loudnessRangeMax: 18,
  },
  'soundcloud': {
    platform: 'soundcloud',
    name: 'SoundCloud',
    integratedLUFS: -14,
    truePeakdBTP: -1,
    loudnessRangeMax: 20,
  },
  'podcast': {
    platform: 'podcast',
    name: 'Podcast',
    integratedLUFS: -16,
    truePeakdBTP: -1,
    loudnessRangeMax: 12,
  },
  'custom': {
    platform: 'custom',
    name: 'Custom',
    integratedLUFS: -14,
    truePeakdBTP: -1,
    loudnessRangeMax: 20,
  },
};

export class LoudnessMeter {
  private ctx: AudioContext;
  private sourceNode: AudioNode;
  private analyserNode: AnalyserNode;
  private dataArray: Float32Array<ArrayBuffer>;

  private options: Required<LoudnessMeterOptions>;
  private blockBuffer: Float32Array[] = [];
  private sampleRate: number;
  private blockDuration: number;

  private currentData: LoudnessData = {
    momentary: -Infinity,
    shortTerm: -Infinity,
    integrated: -Infinity,
    truePeakLeft: -Infinity,
    truePeakRight: -Infinity,
    loudnessRange: 0,
    peakHoldLeft: -Infinity,
    peakHoldRight: -Infinity,
    clipLeft: false,
    clipRight: false,
  };

  private peakHoldTimeLeft = 0;
  private peakHoldTimeRight = 0;
  private lastUpdateTime = 0;
  private rafId: number | null = null;
  private running = false;
  private callback: ((data: LoudnessData) => void) | null = null;

  private target: LoudnessTarget = STREAMING_TARGETS['spotify'];

  constructor(
    ctx: AudioContext,
    sourceNode: AudioNode,
    options: Partial<LoudnessMeterOptions> = {}
  ) {
    this.ctx = ctx;
    this.sourceNode = sourceNode;
    this.sampleRate = ctx.sampleRate;

    this.options = {
      updateInterval: options.updateInterval ?? 100,
      historyDuration: options.historyDuration ?? 60,
      peakHoldDuration: options.peakHoldDuration ?? 3000,
      clipThreshold: options.clipThreshold ?? -1,
    };

    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0;
    sourceNode.connect(this.analyserNode);

    this.dataArray = new Float32Array(this.analyserNode.frequencyBinCount) as Float32Array<ArrayBuffer>;
    this.blockDuration = (this.dataArray.length / this.sampleRate) * 1000;
  }

  // ===========================================================================
  // Control
  // ===========================================================================

  public start(callback: (data: LoudnessData) => void): void {
    if (this.running) return;
    this.running = true;
    this.callback = callback;
    this.lastUpdateTime = performance.now();
    this.tick();
  }

  public stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = (): void => {
    if (!this.running) return;
    const now = performance.now();
    if (now - this.lastUpdateTime >= this.options.updateInterval) {
      this.update();
      this.lastUpdateTime = now;
    }
    this.rafId = requestAnimationFrame(this.tick);
  };

  private update(): void {
    this.analyserNode.getFloatTimeDomainData(this.dataArray);
    const halfLen = Math.floor(this.dataArray.length / 2);
    const left = new Float32Array(halfLen);
    const right = new Float32Array(halfLen);

    for (let i = 0; i < halfLen; i++) {
      left[i] = this.dataArray[i * 2];
      right[i] = this.dataArray[i * 2 + 1];
    }

    const blockMomentary = this.computeBlockLoudness(left, right);
    const truePeakLeft = this.computeTruePeak(left);
    const truePeakRight = this.computeTruePeak(right);

    this.blockBuffer.push(new Float32Array([blockMomentary]));
    const maxHistoryBlocks = Math.ceil((this.options.historyDuration * 1000) / BLOCK_SIZE_MS);
    if (this.blockBuffer.length > maxHistoryBlocks) {
      this.blockBuffer.shift();
    }

    const momentary = this.computeMomentaryLoudness();
    const shortTerm = this.computeShortTermLoudness();
    const integrated = this.computeIntegratedLoudness();
    const loudnessRange = this.computeLoudnessRange();

    const now = performance.now();
    if (truePeakLeft > this.currentData.peakHoldLeft) {
      this.currentData.peakHoldLeft = truePeakLeft;
      this.peakHoldTimeLeft = now;
    } else if (now - this.peakHoldTimeLeft > this.options.peakHoldDuration) {
      this.currentData.peakHoldLeft = truePeakLeft;
      this.peakHoldTimeLeft = now;
    }
    if (truePeakRight > this.currentData.peakHoldRight) {
      this.currentData.peakHoldRight = truePeakRight;
      this.peakHoldTimeRight = now;
    } else if (now - this.peakHoldTimeRight > this.options.peakHoldDuration) {
      this.currentData.peakHoldRight = truePeakRight;
      this.peakHoldTimeRight = now;
    }

    const clipThresholdLinear = Math.pow(10, this.options.clipThreshold / 20);

    this.currentData = {
      momentary: isFinite(momentary) ? momentary : -Infinity,
      shortTerm: isFinite(shortTerm) ? shortTerm : -Infinity,
      integrated: isFinite(integrated) ? integrated : -Infinity,
      truePeakLeft,
      truePeakRight,
      loudnessRange: isFinite(loudnessRange) ? loudnessRange : 0,
      peakHoldLeft: this.currentData.peakHoldLeft,
      peakHoldRight: this.currentData.peakHoldRight,
      clipLeft: truePeakLeft > clipThresholdLinear,
      clipRight: truePeakRight > clipThresholdLinear,
    };

    if (this.callback) {
      this.callback(this.currentData);
    }
  }

  // ===========================================================================
  // Loudness Calculations
  // ===========================================================================

  private computeBlockLoudness(left: Float32Array, right: Float32Array): number {
    let sumSquared = 0;
    let count = 0;
    for (let i = 0; i < left.length; i++) {
      sumSquared += left[i] * left[i] + right[i] * right[i];
      count += 2;
    }
    if (count === 0) return -Infinity;
    const meanSquare = sumSquared / count;
    if (meanSquare <= 0) return -Infinity;
    return -0.691 + 10 * Math.log10(meanSquare);
  }

  private computeMomentaryLoudness(): number {
    if (this.blockBuffer.length === 0) return -Infinity;
    const windowBlocks = Math.min(this.blockBuffer.length, HALF_WINDOW_400);
    const recent = this.blockBuffer.slice(this.blockBuffer.length - windowBlocks);
    let sum = 0;
    let count = 0;
    for (const b of recent) {
      if (isFinite(b[0])) {
        sum += Math.pow(10, b[0] / 10);
        count++;
      }
    }
    if (count === 0) return -Infinity;
    return 10 * Math.log10(sum / count);
  }

  private computeShortTermLoudness(): number {
    if (this.blockBuffer.length === 0) return -Infinity;
    const windowBlocks = Math.min(this.blockBuffer.length, HALF_WINDOW_3000);
    const recent = this.blockBuffer.slice(this.blockBuffer.length - windowBlocks);
    let sum = 0;
    let count = 0;
    for (const b of recent) {
      if (isFinite(b[0])) {
        sum += Math.pow(10, b[0] / 10);
        count++;
      }
    }
    if (count === 0) return -Infinity;
    return 10 * Math.log10(sum / count);
  }

  private computeIntegratedLoudness(): number {
    if (this.blockBuffer.length < 4) return -Infinity;
    const gateThreshold = this.computeAbsoluteGateThreshold();
    const gatedBlocks = this.blockBuffer.filter(b => isFinite(b[0]) && b[0] > gateThreshold);
    if (gatedBlocks.length === 0) return -Infinity;
    const relativeThreshold = this.computeRelativeGateThreshold(gatedBlocks);
    const finalBlocks = gatedBlocks.filter(b => isFinite(b[0]) && b[0] > relativeThreshold);
    if (finalBlocks.length === 0) return -Infinity;
    let sum = 0;
    for (const b of finalBlocks) {
      sum += Math.pow(10, b[0] / 10);
    }
    return 10 * Math.log10(sum / finalBlocks.length);
  }

  private computeAbsoluteGateThreshold(): number {
    if (this.blockBuffer.length === 0) return -Infinity;
    let sum = 0;
    let count = 0;
    for (const b of this.blockBuffer) {
      if (isFinite(b[0])) {
        sum += Math.pow(10, b[0] / 10);
        count++;
      }
    }
    if (count === 0) return -Infinity;
    return 10 * Math.log10(sum / count) - 10;
  }

  private computeRelativeGateThreshold(gatedBlocks: Float32Array[]): number {
    let sum = 0;
    for (const b of gatedBlocks) {
      if (isFinite(b[0])) {
        sum += Math.pow(10, b[0] / 10);
      }
    }
    if (gatedBlocks.length === 0) return -Infinity;
    return 10 * Math.log10(sum / gatedBlocks.length) - 10;
  }

  private computeLoudnessRange(): number {
    if (this.blockBuffer.length < 10) return 0;
    const values: number[] = [];
    for (const b of this.blockBuffer) {
      if (isFinite(b[0])) values.push(b[0]);
    }
    if (values.length < 10) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const lowIdx = Math.floor(sorted.length * 0.1);
    const highIdx = Math.floor(sorted.length * 0.95);
    return sorted[Math.min(highIdx, sorted.length - 1)] - sorted[lowIdx];
  }

  private computeTruePeak(channelData: Float32Array): number {
    if (channelData.length < 2) return 0;
    let maxPeak = 0;
    for (let i = 0; i < channelData.length - 1; i++) {
      const abs0 = Math.abs(channelData[i]);
      const abs1 = Math.abs(channelData[i + 1]);
      if (abs0 > maxPeak) maxPeak = abs0;
      if (abs1 > maxPeak) maxPeak = abs1;
      const interpolated = this.interpolatePeak(channelData[i], channelData[i + 1]);
      if (interpolated > maxPeak) maxPeak = interpolated;
    }
    return maxPeak;
  }

  private interpolatePeak(s0: number, s1: number): number {
    if (s0 * s1 <= 0) return Math.max(Math.abs(s0), Math.abs(s1));
    const sign = s0 > 0 ? 1 : -1;
    const x = (s0 / (s0 - s1)) * sign;
    if (x < 0 || x > 1) return Math.max(Math.abs(s0), Math.abs(s1));
    return Math.abs(s0 + x * (s1 - s0));
  }

  // ===========================================================================
  // Compliance
  // ===========================================================================

  public setTarget(platform: StreamingPlatform): void {
    this.target = STREAMING_TARGETS[platform];
  }

  public setCustomTarget(target: LoudnessTarget): void {
    this.target = target;
  }

  public getTarget(): LoudnessTarget {
    return this.target;
  }

  public checkCompliance(): ComplianceResult {
    const integratedPass = this.currentData.integrated >= this.target.integratedLUFS - 1 &&
                           this.currentData.integrated <= this.target.integratedLUFS + 1;

    const truePeakLinear = Math.max(this.currentData.truePeakLeft, this.currentData.truePeakRight);
    const truePeakdBTP = 20 * Math.log10(Math.max(truePeakLinear, 1e-10));
    const truePeakPass = truePeakdBTP <= this.target.truePeakdBTP;

    const lraPass = this.currentData.loudnessRange <= this.target.loudnessRangeMax;

    return {
      platform: this.target.platform,
      integrated: {
        value: this.currentData.integrated,
        target: this.target.integratedLUFS,
        pass: integratedPass,
        diff: this.currentData.integrated - this.target.integratedLUFS,
      },
      truePeak: {
        value: truePeakdBTP,
        target: this.target.truePeakdBTP,
        pass: truePeakPass,
        diff: truePeakdBTP - this.target.truePeakdBTP,
      },
      loudnessRange: {
        value: this.currentData.loudnessRange,
        max: this.target.loudnessRangeMax,
        pass: lraPass,
      },
      overallPass: integratedPass && truePeakPass && lraPass,
    };
  }

  // ===========================================================================
  // Getters
  // ===========================================================================

  public getCurrentData(): LoudnessData {
    return { ...this.currentData };
  }

  public getMomentary(): number {
    return this.currentData.momentary;
  }

  public getShortTerm(): number {
    return this.currentData.shortTerm;
  }

  public getIntegrated(): number {
    return this.currentData.integrated;
  }

  public getTruePeakLeft(): number {
    return this.currentData.truePeakLeft;
  }

  public getTruePeakRight(): number {
    return this.currentData.truePeakRight;
  }

  public getLoudnessRange(): number {
    return this.currentData.loudnessRange;
  }

  // ===========================================================================
  // Reset
  // ===========================================================================

  public resetIntegrated(): void {
    this.blockBuffer = [];
    this.currentData.integrated = -Infinity;
  }

  public resetPeakHold(): void {
    this.currentData.peakHoldLeft = -Infinity;
    this.currentData.peakHoldRight = -Infinity;
    this.currentData.clipLeft = false;
    this.currentData.clipRight = false;
    this.peakHoldTimeLeft = performance.now();
    this.peakHoldTimeRight = performance.now();
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  public dispose(): void {
    this.stop();
    this.sourceNode.disconnect();
    this.analyserNode.disconnect();
  }
}

export function createStreamingLoudnessMeter(
  ctx: AudioContext,
  sourceNode: AudioNode,
  options?: Partial<LoudnessMeterOptions>
): LoudnessMeter {
  return new LoudnessMeter(ctx, sourceNode, options);
}

export default LoudnessMeter;
