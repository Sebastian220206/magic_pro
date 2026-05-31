/**
 * RenderOptimizer - Performance optimization for React UI rendering
 * 
 * Features:
 * - Throttled meter updates (30-60 FPS)
 * - RAF batching for UI updates
 * - Avoid full React re-renders
 * - Optimized state updates
 */

// =============================================================================
// Types
// =============================================================================

export interface ThrottleOptions {
  fps?: number;
  leading?: boolean;
  trailing?: boolean;
}

export interface BatchedUpdate<T> {
  id: string;
  data: T;
  timestamp: number;
}

export interface RenderStats {
  updateCount: number;
  skippedCount: number;
  avgDeltaTime: number;
  currentFPS: number;
}

export type UpdateCallback<T> = (data: T) => void;

// =============================================================================
// ThrottledUpdater Class
// =============================================================================

export class ThrottledUpdater<T> {
  private callback: UpdateCallback<T>;
  private intervalMs: number;
  private leading: boolean;
  private trailing: boolean;
  
  private lastUpdateTime: number = 0;
  private pendingData: T | null = null;
  private rafId: number | null = null;
  private isRunning: boolean = false;
  
  // Stats
  private updateCount: number = 0;
  private skippedCount: number = 0;
  private lastFrameTime: number = 0;
  private frameTimes: number[] = [];
  
  constructor(callback: UpdateCallback<T>, options: ThrottleOptions = {}) {
    this.callback = callback;
    this.intervalMs = 1000 / (options.fps ?? 60);
    this.leading = options.leading ?? true;
    this.trailing = options.trailing ?? false;
  }
  
  /**
   * Update with new data (throttled)
   */
  public update(data: T): void {
    const now = performance.now();
    const elapsed = now - this.lastUpdateTime;
    
    // Always store latest data
    this.pendingData = data;
    
    // Check if we should update
    if (elapsed >= this.intervalMs) {
      // Time to update
      if (this.leading) {
        this.flush();
      }
    } else if (!this.rafId) {
      // Schedule update
      this.scheduleUpdate();
    }
  }
  
  /**
   * Schedule next update
   */
  private scheduleUpdate(): void {
    if (this.rafId) return;
    
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      const now = performance.now();
      const elapsed = now - this.lastUpdateTime;
      
      if (elapsed >= this.intervalMs) {
        this.flush();
      } else {
        this.skippedCount++;
      }
    });
  }
  
  /**
   * Force immediate update
   */
  public flush(): void {
    if (this.pendingData !== null) {
      const now = performance.now();
      
      // Track frame time for FPS calculation
      if (this.lastFrameTime > 0) {
        const frameTime = now - this.lastFrameTime;
        this.frameTimes.push(frameTime);
        
        // Keep last 60 frames
        if (this.frameTimes.length > 60) {
          this.frameTimes.shift();
        }
      }
      this.lastFrameTime = now;
      
      // Call the callback
      this.callback(this.pendingData);
      this.lastUpdateTime = now;
      this.updateCount++;
      
      if (this.trailing) {
        this.pendingData = null;
      }
    }
  }
  
  /**
   * Get rendering statistics
   */
  public getStats(): RenderStats {
    const avgFrameTime = this.frameTimes.length > 0
      ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
      : 0;
    
    return {
      updateCount: this.updateCount,
      skippedCount: this.skippedCount,
      avgDeltaTime: avgFrameTime,
      currentFPS: avgFrameTime > 0 ? 1000 / avgFrameTime : 0,
    };
  }
  
  /**
   * Reset stats
   */
  public resetStats(): void {
    this.updateCount = 0;
    this.skippedCount = 0;
    this.frameTimes = [];
    this.lastFrameTime = 0;
  }
  
  /**
   * Set target FPS
   */
  public setFPS(fps: number): void {
    this.intervalMs = 1000 / fps;
  }
  
  /**
   * Dispose
   */
  public dispose(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

// =============================================================================
// BatchScheduler Class
// =============================================================================

export class BatchScheduler<T> {
  private updates: Map<string, BatchedUpdate<T>> = new Map();
  private callbacks: Map<string, UpdateCallback<T>> = new Map();
  private rafId: number | null = null;
  private readonly batchDelay: number;
  
  constructor(batchDelay: number = 16) {
    this.batchDelay = batchDelay;
  }
  
  /**
   * Register a callback for an ID
   */
  public register(id: string, callback: UpdateCallback<T>): void {
    this.callbacks.set(id, callback);
  }
  
  /**
   * Unregister a callback
   */
  public unregister(id: string): void {
    this.callbacks.delete(id);
    this.updates.delete(id);
  }
  
  /**
   * Schedule an update
   */
  public schedule(id: string, data: T): void {
    if (!this.callbacks.has(id)) return;
    
    this.updates.set(id, {
      id,
      data,
      timestamp: performance.now(),
    });
    
    this.scheduleFlush();
  }
  
  /**
   * Schedule batch flush
   */
  private scheduleFlush(): void {
    if (this.rafId) return;
    
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.flush();
    });
  }
  
  /**
   * Flush all pending updates
   */
  public flush(): void {
    this.updates.forEach((update, id) => {
      const callback = this.callbacks.get(id);
      if (callback) {
        callback(update.data);
      }
    });
    
    this.updates.clear();
  }
  
  /**
   * Dispose
   */
  public dispose(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    
    this.updates.clear();
    this.callbacks.clear();
  }
}

// =============================================================================
// RAFLoop Class
// =============================================================================

export class RAFLoop {
  private callback: () => void;
  private rafId: number | null = null;
  private isRunning: boolean = false;
  private lastTime: number = 0;
  
  constructor(callback: () => void) {
    this.callback = callback;
  }
  
  /**
   * Start the loop
   */
  public start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastTime = performance.now();
    this.tick();
  }
  
  /**
   * Stop the loop
   */
  public stop(): void {
    this.isRunning = false;
    
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
  
  /**
   * Animation frame tick
   */
  private tick(): void {
    if (!this.isRunning) return;
    
    this.callback();
    
    this.rafId = requestAnimationFrame(() => this.tick());
  }
  
  /**
   * Check if running
   */
  public running(): boolean {
    return this.isRunning;
  }
}

// =============================================================================
// FrameRateMonitor Class
// =============================================================================

export class FrameRateMonitor {
  private frameTimes: number[] = [];
  private lastFrameTime: number = 0;
  private maxSamples: number = 60;
  
  /**
   * Record a frame
   */
  public recordFrame(): void {
    const now = performance.now();
    
    if (this.lastFrameTime > 0) {
      const delta = now - this.lastFrameTime;
      this.frameTimes.push(delta);
      
      if (this.frameTimes.length > this.maxSamples) {
        this.frameTimes.shift();
      }
    }
    
    this.lastFrameTime = now;
  }
  
  /**
   * Get average FPS
   */
  public getFPS(): number {
    if (this.frameTimes.length === 0) return 0;
    
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    return 1000 / avgFrameTime;
  }
  
  /**
   * Get frame time statistics
   */
  public getStats(): {
    fps: number;
    avgFrameTime: number;
    minFrameTime: number;
    maxFrameTime: number;
  } {
    if (this.frameTimes.length === 0) {
      return { fps: 0, avgFrameTime: 0, minFrameTime: 0, maxFrameTime: 0 };
    }
    
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const min = Math.min(...this.frameTimes);
    const max = Math.max(...this.frameTimes);
    
    return {
      fps: 1000 / avg,
      avgFrameTime: avg,
      minFrameTime: min,
      maxFrameTime: max,
    };
  }
  
  /**
   * Reset
   */
  public reset(): void {
    this.frameTimes = [];
    this.lastFrameTime = 0;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create a throttled function
 */
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let rafId: number | null = null;
  let pendingArgs: Parameters<T> | null = null;
  
  return (...args: Parameters<T>) => {
    const now = performance.now();
    
    pendingArgs = args;
    
    if (now - lastCall >= waitMs) {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      
      lastCall = now;
      fn(...pendingArgs);
      pendingArgs = null;
    } else if (!rafId) {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        lastCall = performance.now();
        if (pendingArgs) {
          fn(...pendingArgs);
          pendingArgs = null;
        }
      });
    }
  };
}

/**
 * Create a debounced function
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      fn(...args);
    }, waitMs);
  };
}

// =============================================================================
// Factory Functions
// =============================================================================

export function createThrottledUpdater<T>(
  callback: UpdateCallback<T>,
  options?: ThrottleOptions
): ThrottledUpdater<T> {
  return new ThrottledUpdater(callback, options);
}

export function createBatchScheduler<T>(batchDelay?: number): BatchScheduler<T> {
  return new BatchScheduler(batchDelay);
}

export function createRAFLoop(callback: () => void): RAFLoop {
  return new RAFLoop(callback);
}

export function createFrameRateMonitor(): FrameRateMonitor {
  return new FrameRateMonitor();
}

export default {
  ThrottledUpdater,
  BatchScheduler,
  RAFLoop,
  FrameRateMonitor,
  throttle,
  debounce,
};
