import { dbToGain } from './channelStrip';

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

export interface LoudnessOptions {
  updateInterval: number;
  historyDuration: number;
  peakHoldDuration: number;
  clipThreshold: number;
}

const DEFAULT_OPTIONS: Required<LoudnessOptions> = {
  updateInterval: 100,
  historyDuration: 60,
  peakHoldDuration: 3000,
  clipThreshold: -1,
};

const BLOCK_SIZE_MS = 100;
const MOMENTARY_WINDOW_MS = 400;
const SHORT_TERM_WINDOW_MS = 3000;
const HALF_WINDOW_400 = Math.floor(400 / BLOCK_SIZE_MS);
const HALF_WINDOW_3000 = Math.floor(3000 / BLOCK_SIZE_MS);

export class LoudnessMeter {
  private audioContext: AudioContext;
  private options: Required<LoudnessOptions>;

  private sourceNode: AudioNode;
  private analyserNode: AnalyserNode;
  private dataArray: Float32Array;

  private rafId: number | null = null;
  private running = false;
  private callback: ((data: LoudnessData) => void) | null = null;

  private blockBuffer: Float32Array[] = [];
  private blockDuration = 0;
  private sampleRate = 0;

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

  private lastUpdateTime = 0;
  private peakHoldTimeLeft = 0;
  private peakHoldTimeRight = 0;

  constructor(audioContext: AudioContext, sourceNode: AudioNode, options?: Partial<LoudnessOptions>) {
    this.audioContext = audioContext;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.sampleRate = audioContext.sampleRate;

    this.analyserNode = audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0;
    sourceNode.connect(this.analyserNode);

    this.sourceNode = sourceNode;
    this.dataArray = new Float32Array(this.analyserNode.frequencyBinCount);
    this.blockDuration = (this.dataArray.length / this.sampleRate) * 1000;
  }

  start(callback: (data: LoudnessData) => void) {
    if (this.running) return;
    this.running = true;
    this.callback = callback;
    this.lastUpdateTime = performance.now();
    this.tick();
  }

  stop() {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = () => {
    if (!this.running) return;
    const now = performance.now();
    if (now - this.lastUpdateTime >= this.options.updateInterval) {
      this.update();
      this.lastUpdateTime = now;
    }
    this.rafId = requestAnimationFrame(this.tick);
  };

  private update() {
    this.analyserNode.getFloatTimeDomainData(this.dataArray as any);
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

    this.currentData = {
      momentary: isFinite(momentary) ? momentary : -Infinity,
      shortTerm: isFinite(shortTerm) ? shortTerm : -Infinity,
      integrated: isFinite(integrated) ? integrated : -Infinity,
      truePeakLeft: truePeakLeft,
      truePeakRight: truePeakRight,
      loudnessRange: isFinite(loudnessRange) ? loudnessRange : 0,
      peakHoldLeft: this.currentData.peakHoldLeft,
      peakHoldRight: this.currentData.peakHoldRight,
      clipLeft: truePeakLeft > dbToGain(this.options.clipThreshold),
      clipRight: truePeakRight > dbToGain(this.options.clipThreshold),
    };

    if (this.callback) {
      this.callback(this.currentData);
    }
  }

  private computeBlockLoudness(_left: Float32Array, _right: Float32Array): number {
    let sumSquared = 0;
    let count = 0;
    for (let i = 0; i < _left.length; i++) {
      sumSquared += _left[i] * _left[i] + _right[i] * _right[i];
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
        const linear = Math.pow(10, b[0] / 10);
        sum += linear;
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
        const linear = Math.pow(10, b[0] / 10);
        sum += linear;
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
      const linear = Math.pow(10, b[0] / 10);
      sum += linear;
    }
    return 10 * Math.log10(sum / finalBlocks.length);
  }

  private computeAbsoluteGateThreshold(): number {
    if (this.blockBuffer.length === 0) return -Infinity;
    let sum = 0;
    let count = 0;
    for (const b of this.blockBuffer) {
      if (isFinite(b[0])) {
        const linear = Math.pow(10, b[0] / 10);
        sum += linear;
        count++;
      }
    }
    if (count === 0) return -Infinity;
    const mean = 10 * Math.log10(sum / count);
    return mean - 10;
  }

  private computeRelativeGateThreshold(gatedBlocks: Float32Array[]): number {
    let sum = 0;
    for (const b of gatedBlocks) {
      if (isFinite(b[0])) {
        const linear = Math.pow(10, b[0] / 10);
        sum += linear;
      }
    }
    if (gatedBlocks.length === 0) return -Infinity;
    const mean = 10 * Math.log10(sum / gatedBlocks.length);
    return mean - 10;
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
    const lowPercentile = sorted[lowIdx];
    const highPercentile = sorted[Math.min(highIdx, sorted.length - 1)];
    return highPercentile - lowPercentile;
  }

  private computeTruePeak(channelData: Float32Array): number {
    if (channelData.length < 2) return 0;
    let maxPeak = 0;
    for (let i = 0; i < channelData.length - 1; i++) {
      const s0 = channelData[i];
      const s1 = channelData[i + 1];
      const abs0 = Math.abs(s0);
      const abs1 = Math.abs(s1);
      if (abs0 > maxPeak) maxPeak = abs0;
      if (abs1 > maxPeak) maxPeak = abs1;
      const interpolated = this.interpolatePeak(s0, s1);
      if (interpolated > maxPeak) maxPeak = interpolated;
    }
    return maxPeak;
  }

  private interpolatePeak(s0: number, s1: number): number {
    if (s0 * s1 <= 0) return Math.max(Math.abs(s0), Math.abs(s1));
    const sign = s0 > 0 ? 1 : -1;
    const x = (s0 / (s0 - s1)) * sign;
    if (x < 0 || x > 1) return Math.max(Math.abs(s0), Math.abs(s1));
    const y = s0 + x * (s1 - s0);
    return Math.abs(y);
  }

  getCurrentData(): LoudnessData {
    return { ...this.currentData };
  }

  getMomentary(): number {
    return this.currentData.momentary;
  }

  getShortTerm(): number {
    return this.currentData.shortTerm;
  }

  getIntegrated(): number {
    return this.currentData.integrated;
  }

  getTruePeakLeft(): number {
    return this.currentData.truePeakLeft;
  }

  getTruePeakRight(): number {
    return this.currentData.truePeakRight;
  }

  getLoudnessRange(): number {
    return this.currentData.loudnessRange;
  }

  resetIntegrated() {
    this.blockBuffer = [];
    this.currentData.integrated = -Infinity;
  }

  resetPeakHold() {
    this.currentData.peakHoldLeft = -Infinity;
    this.currentData.peakHoldRight = -Infinity;
    this.currentData.clipLeft = false;
    this.currentData.clipRight = false;
    this.peakHoldTimeLeft = performance.now();
    this.peakHoldTimeRight = performance.now();
  }

  getOptions(): LoudnessOptions {
    return { ...this.options };
  }

  setUpdateInterval(ms: number) {
    this.options.updateInterval = ms;
  }

  dispose() {
    this.stop();
    this.sourceNode.disconnect();
    this.analyserNode.disconnect();
  }
}

export function createLoudnessMeter(
  audioContext: AudioContext,
  sourceNode: AudioNode,
  options?: Partial<LoudnessOptions>
): LoudnessMeter {
  return new LoudnessMeter(audioContext, sourceNode, options);
}

export default LoudnessMeter;
