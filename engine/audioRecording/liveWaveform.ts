/**
 * liveWaveform.ts
 * Real-time waveform data processing for live recording visualization.
 * Optimized for append-only data and fast canvas rendering.
 */

export interface WaveformPeak {
  min: number;
  max: number;
}

export class LiveWaveformProvider {
  private peaks: WaveformPeak[] = [];
  private samplesPerPeak: number;
  private currentSamples: number = 0;
  private currentMin: number = 0;
  private currentMax: number = 0;
  private totalSamples: number = 0;
  private sampleRate: number;

  constructor(sampleRate: number, pointsPerSecond: number = 50) {
    this.sampleRate = sampleRate;
    this.samplesPerPeak = Math.max(1, Math.floor(sampleRate / pointsPerSecond));
    this.clear();
  }

  /**
   * Process a new batch of samples
   */
  addSamples(samples: Float32Array): void {
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      if (s < this.currentMin) this.currentMin = s;
      if (s > this.currentMax) this.currentMax = s;

      this.currentSamples++;

      if (this.currentSamples >= this.samplesPerPeak) {
        this.peaks.push({ min: this.currentMin, max: this.currentMax });
        this.currentMin = 0;
        this.currentMax = 0;
        this.currentSamples = 0;
      }
    }
    this.totalSamples += samples.length;
  }

  /**
   * Get all accumulated peaks
   */
  getPeaks(): WaveformPeak[] {
    return this.peaks;
  }

  /**
   * Get current duration in seconds
   */
  getDuration(): number {
    return this.totalSamples / this.sampleRate;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.peaks = [];
    this.currentSamples = 0;
    this.currentMin = 0;
    this.currentMax = 0;
    this.totalSamples = 0;
  }
}

/**
 * LiveWaveformRenderer
 * Handles canvas drawing with requestAnimationFrame
 */
export class LiveWaveformCanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private provider: LiveWaveformProvider;
  private animationId: number | null = null;
  private color: string = '#ef4444'; // DAW recording red

  constructor(canvas: HTMLCanvasElement, provider: LiveWaveformProvider, color?: string) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.provider = provider;
    if (color) this.color = color;
  }

  start(): void {
    if (this.animationId) return;
    const render = () => {
      this.draw();
      this.animationId = requestAnimationFrame(render);
    };
    this.animationId = requestAnimationFrame(render);
  }

  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private draw(): void {
    const { width, height } = this.canvas;
    const ctx = this.ctx;
    const peaks = this.provider.getPeaks();
    
    ctx.clearRect(0, 0, width, height);
    
    if (peaks.length === 0) return;

    ctx.beginPath();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1;

    const centerY = height / 2;
    const scaleY = height / 2;
    const pointsToShow = peaks.length;
    
    // We can either scroll or squish. DAWs usually grow then scroll.
    // For now, let's implement a growing waveform that scrolls if it exceeds width.
    const spacing = 2; // px per peak
    const totalWidthNeeded = pointsToShow * spacing;
    
    let offsetX = 0;
    if (totalWidthNeeded > width) {
        offsetX = width - totalWidthNeeded;
    }

    for (let i = 0; i < pointsToShow; i++) {
      const peak = peaks[i];
      const x = i * spacing + offsetX;
      
      const yMin = centerY + peak.min * scaleY;
      const yMax = centerY + peak.max * scaleY;

      ctx.moveTo(x, yMin);
      ctx.lineTo(x, yMax);
    }

    ctx.stroke();
  }
}
