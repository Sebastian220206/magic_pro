import { RenderMetrics, createEmptyMetrics } from './RenderMetrics';

type MetricKey = keyof RenderMetrics;

export class FrameProfiler {
  private currentMetrics: RenderMetrics = createEmptyMetrics();
  private listeners: Array<(metrics: RenderMetrics) => void> = [];
  
  // Frame pacing internals
  private lastFrameTime = performance.now();
  private frameCount = 0;
  private lastFpsTime = performance.now();
  private deltaTimes: number[] = [];

  // Measurement timers
  private activeTimers = new Map<MetricKey, number>();

  public beginMeasure(key: MetricKey) {
    this.activeTimers.set(key, performance.now());
  }

  public endMeasure(key: MetricKey) {
    const start = this.activeTimers.get(key);
    if (start !== undefined) {
      const duration = performance.now() - start;
      // In a real profiler, we might smooth this or keep a moving average.
      // For immediate diagnostics, we store the raw value for the frame.
      (this.currentMetrics as any)[key] = duration;
      this.activeTimers.delete(key);
    }
  }

  public increment(key: keyof Pick<RenderMetrics, 'droppedFrames' | 'viewportTransactionCount' | 'orphanedSnapshots' | 'transactionRollbacks' | 'dirtyRegionCount' | 'overlayCount' | 'activeRendererCount'>) {
    this.currentMetrics[key]++;
  }

  public setMetric(key: keyof RenderMetrics, value: number) {
    (this.currentMetrics as any)[key] = value;
  }

  public tickFrame(audioContextTime?: number, transportBeat?: number, pixelsPerBeat?: number) {
    const now = performance.now();
    const dt = now - this.lastFrameTime;
    
    // RAF Latency (ideal is 16.66ms for 60fps)
    this.currentMetrics.rafLatency = dt;
    this.deltaTimes.push(dt);
    if (this.deltaTimes.length > 60) this.deltaTimes.shift();

    // Delta Time Variance (Jitter calculation)
    const avgDt = this.deltaTimes.reduce((a,b) => a+b, 0) / this.deltaTimes.length;
    this.currentMetrics.deltaTimeVariance = this.deltaTimes.reduce((acc, val) => acc + Math.pow(val - avgDt, 2), 0) / this.deltaTimes.length;

    if (dt > 33.33) {
      this.currentMetrics.droppedFrames++;
    }
    if (dt > 50) {
      this.currentMetrics.longTasks++;
    }

    this.lastFrameTime = now;
    this.frameCount++;

    // Update FPS every second
    if (now - this.lastFpsTime >= 1000) {
      this.currentMetrics.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
      
      // Memory estimate if available
      if ((performance as any).memory) {
        this.currentMetrics.estimatedMemoryMB = Math.round((performance as any).memory.usedJSHeapSize / 1048576);
      }
    }

    // Audio/Viewport Drift (extremely naive calculation for example)
    // In reality: drift = (currentBeat * secondsPerBeat) - audioContextTime
    // This requires access to transport tempo, so we leave the plumbing ready.
    if (audioContextTime !== undefined && transportBeat !== undefined) {
       // Calculation happens externally and sets the metric via setMetric.
    }

    this.flush();
  }

  private flush() {
    const snapshot = { ...this.currentMetrics };
    for (const listener of this.listeners) {
      listener(snapshot);
    }
    
    // Reset per-frame counters
    this.currentMetrics.viewportTransactionCount = 0;
    this.currentMetrics.dirtyRegionCount = 0;
  }

  public subscribe(listener: (metrics: RenderMetrics) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

export const globalProfiler = new FrameProfiler();
