/**
 * Audio Meter - Real-time peak and RMS metering using AnalyserNode
 * 
 * Features:
 * - Peak level detection per channel
 * - RMS (average) level calculation
 * - Peak hold with configurable decay
 * - Clip detection
 * - Smooth animation using requestAnimationFrame
 */

// =============================================================================
// Types
// =============================================================================

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

export interface MeterOptions {
  fftSize?: number;
  smoothingTimeConstant?: number;
  minDecibels?: number;
  maxDecibels?: number;
  peakHoldDuration?: number;    // ms
  clipThreshold?: number;      // dB
  updateInterval?: number;     // ms
}

// =============================================================================
// Utilities
// =============================================================================

function calculateRMS(dataArray: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i] * dataArray[i];
  }
  return Math.sqrt(sum / dataArray.length);
}

function findPeak(dataArray: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const abs = Math.abs(dataArray[i]);
    if (abs > peak) peak = abs;
  }
  return peak;
}

function linearToDb(linear: number): number {
  if (linear <= 0) return -Infinity;
  return 20 * Math.log10(linear);
}

// =============================================================================
// Audio Meter Class
// =============================================================================

export class AudioMeter {
  private analyserNode: AnalyserNode;
  private options: Required<MeterOptions>;
  
  // Data buffers
  private dataArray: Float32Array;
  private leftChannelData: Float32Array;
  private rightChannelData: Float32Array;
  
  // Peak hold tracking
  private peakHoldLeft: number = -Infinity;
  private peakHoldRight: number = -Infinity;
  private peakHoldTimeLeft: number = 0;
  private peakHoldTimeRight: number = 0;
  
  // Clip detection
  private clipLeft: boolean = false;
  private clipRight: boolean = false;
  
  // Animation
  private rafId: number | null = null;
  private isRunning: boolean = false;
  private lastUpdateTime: number = 0;
  private updateCallback?: (data: MeterData) => void;
  
  // Current data
  private currentData: MeterData = {
    peakLeft: -Infinity,
    peakRight: -Infinity,
    rmsLeft: -Infinity,
    rmsRight: -Infinity,
    peakHoldLeft: -Infinity,
    peakHoldRight: -Infinity,
    clipLeft: false,
    clipRight: false,
  };

  constructor(analyserNode: AnalyserNode, options: MeterOptions = {}) {
    this.analyserNode = analyserNode;
    
    this.options = {
      fftSize: options.fftSize || 2048,
      smoothingTimeConstant: options.smoothingTimeConstant ?? 0.8,
      minDecibels: options.minDecibels ?? -100,
      maxDecibels: options.maxDecibels ?? 0,
      peakHoldDuration: options.peakHoldDuration ?? 2000,
      clipThreshold: options.clipThreshold ?? 0,
      updateInterval: options.updateInterval ?? 16, // ~60fps
    };
    
    // Configure analyser
    this.analyserNode.fftSize = this.options.fftSize;
    this.analyserNode.smoothingTimeConstant = this.options.smoothingTimeConstant;
    this.analyserNode.minDecibels = this.options.minDecibels;
    this.analyserNode.maxDecibels = this.options.maxDecibels;
    
    // Create data buffers
    const bufferLength = this.analyserNode.frequencyBinCount;
    this.dataArray = new Float32Array(bufferLength);
    this.leftChannelData = new Float32Array(bufferLength);
    this.rightChannelData = new Float32Array(bufferLength);
  }

  // =============================================================================
  // Control
  // =============================================================================

  public start(callback?: (data: MeterData) => void): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.updateCallback = callback;
    this.lastUpdateTime = performance.now();
    
    this.tick();
  }

  public stop(): void {
    this.isRunning = false;
    
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = (): void => {
    if (!this.isRunning) return;
    
    const now = performance.now();
    const elapsed = now - this.lastUpdateTime;
    
    if (elapsed >= this.options.updateInterval) {
      this.updateMeter();
      this.lastUpdateTime = now;
      
      // Notify callback
      if (this.updateCallback) {
        this.updateCallback(this.currentData);
      }
    }
    
    this.rafId = requestAnimationFrame(this.tick);
  };

  // =============================================================================
  // Meter Update
  // =============================================================================

  private updateMeter(): void {
    // Get time domain data
    this.analyserNode.getFloatTimeDomainData(this.dataArray as Float32Array<ArrayBuffer>);
    
    // Split into stereo channels (assuming interleaved)
    const halfLength = Math.floor(this.dataArray.length / 2);
    
    for (let i = 0; i < halfLength; i++) {
      this.leftChannelData[i] = this.dataArray[i * 2];
      this.rightChannelData[i] = this.dataArray[i * 2 + 1];
    }
    
    // Calculate peak levels
    const peakLeftLinear = findPeak(this.leftChannelData);
    const peakRightLinear = findPeak(this.rightChannelData);
    
    const peakLeft = linearToDb(peakLeftLinear);
    const peakRight = linearToDb(peakRightLinear);
    
    // Calculate RMS levels
    const rmsLeftLinear = calculateRMS(this.leftChannelData);
    const rmsRightLinear = calculateRMS(this.rightChannelData);
    
    const rmsLeft = linearToDb(rmsLeftLinear);
    const rmsRight = linearToDb(rmsRightLinear);
    
    // Update peak hold
    this.updatePeakHold(peakLeft, peakRight);
    
    // Check for clipping
    this.checkClipping(peakLeft, peakRight);
    
    // Update current data
    this.currentData = {
      peakLeft,
      peakRight,
      rmsLeft,
      rmsRight,
      peakHoldLeft: this.peakHoldLeft,
      peakHoldRight: this.peakHoldRight,
      clipLeft: this.clipLeft,
      clipRight: this.clipRight,
    };
  }

  private updatePeakHold(peakLeft: number, peakRight: number): void {
    const now = performance.now();
    
    // Update left peak hold
    if (peakLeft > this.peakHoldLeft) {
      this.peakHoldLeft = peakLeft;
      this.peakHoldTimeLeft = now;
    } else if (now - this.peakHoldTimeLeft > this.options.peakHoldDuration) {
      // Decay peak hold
      this.peakHoldLeft = peakLeft;
      this.peakHoldTimeLeft = now;
    }
    
    // Update right peak hold
    if (peakRight > this.peakHoldRight) {
      this.peakHoldRight = peakRight;
      this.peakHoldTimeRight = now;
    } else if (now - this.peakHoldTimeRight > this.options.peakHoldDuration) {
      // Decay peak hold
      this.peakHoldRight = peakRight;
      this.peakHoldTimeRight = now;
    }
  }

  private checkClipping(peakLeft: number, peakRight: number): void {
    this.clipLeft = peakLeft > this.options.clipThreshold;
    this.clipRight = peakRight > this.options.clipThreshold;
  }

  // =============================================================================
  // Public API
  // =============================================================================

  public getData(): MeterData {
    return { ...this.currentData };
  }

  public getPeak(channel: 0 | 1): number {
    return channel === 0 ? this.currentData.peakLeft : this.currentData.peakRight;
  }

  public getRMS(channel: 0 | 1): number {
    return channel === 0 ? this.currentData.rmsLeft : this.currentData.rmsRight;
  }

  public getPeakHold(channel: 0 | 1): number {
    return channel === 0 ? this.currentData.peakHoldLeft : this.currentData.peakHoldRight;
  }

  public resetPeakHold(): void {
    this.peakHoldLeft = -Infinity;
    this.peakHoldRight = -Infinity;
    this.peakHoldTimeLeft = performance.now();
    this.peakHoldTimeRight = performance.now();
    
    this.currentData.peakHoldLeft = -Infinity;
    this.currentData.peakHoldRight = -Infinity;
  }

  public isClipping(channel?: 0 | 1): boolean {
    if (channel === 0) return this.clipLeft;
    if (channel === 1) return this.clipRight;
    return this.clipLeft || this.clipRight;
  }

  public clearClipIndicators(): void {
    this.clipLeft = false;
    this.clipRight = false;
    this.currentData.clipLeft = false;
    this.currentData.clipRight = false;
  }

  // =============================================================================
  // Configuration
  // =============================================================================

  public setSmoothingTimeConstant(value: number): void {
    this.options.smoothingTimeConstant = value;
    this.analyserNode.smoothingTimeConstant = value;
  }

  public setPeakHoldDuration(durationMs: number): void {
    this.options.peakHoldDuration = durationMs;
  }

  public setClipThreshold(thresholdDb: number): void {
    this.options.clipThreshold = thresholdDb;
  }

  public setUpdateInterval(intervalMs: number): void {
    this.options.updateInterval = intervalMs;
  }

  // =============================================================================
  // Cleanup
  // =============================================================================

  public dispose(): void {
    this.stop();
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createAudioMeter(
  analyserNode: AnalyserNode,
  options?: MeterOptions
): AudioMeter {
  return new AudioMeter(analyserNode, options);
}

export default AudioMeter;
