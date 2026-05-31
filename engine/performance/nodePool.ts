/**
 * NodePool - Object pooling for AudioNodes to reduce GC pressure
 * 
 * Features:
 * - Reuse GainNode, BiquadFilterNode, DelayNode, etc.
 * - Configurable pool size limits
 * - Automatic cleanup of expired nodes
 * - Thread-safe acquire/release
 */

// =============================================================================
// Types
// =============================================================================

export type NodeType = 'gain' | 'biquad' | 'delay' | 'waveshaper' | 'dynamics';

export interface NodePoolConfig {
  maxSize: number;
  maxIdleTime: number; // ms before node is disposed
}

export interface PooledNode<T extends AudioNode> {
  node: T;
  acquiredAt: number;
  pooledAt: number;
  useCount: number;
}

export interface PoolStats {
  acquired: number;
  available: number;
  totalCreated: number;
  totalDisposed: number;
}

// =============================================================================
// NodePool Class
// =============================================================================

export class NodePool {
  private audioContext: AudioContext;
  private pools: Map<NodeType, PooledNode<AudioNode>[]> = new Map();
  private acquired: Map<AudioNode, NodeType> = new Map();
  private stats: Map<NodeType, { created: number; disposed: number }> = new Map();
  private config: NodePoolConfig;
  private cleanupInterval: number | null = null;
  
  constructor(audioContext: AudioContext, config: Partial<NodePoolConfig> = {}) {
    this.audioContext = audioContext;
    this.config = {
      maxSize: 50,
      maxIdleTime: 30000, // 30 seconds
      ...config,
    };
    
    // Initialize pools
    this.pools.set('gain', []);
    this.pools.set('biquad', []);
    this.pools.set('delay', []);
    this.pools.set('waveshaper', []);
    this.pools.set('dynamics', []);
    
    // Initialize stats
    this.stats.set('gain', { created: 0, disposed: 0 });
    this.stats.set('biquad', { created: 0, disposed: 0 });
    this.stats.set('delay', { created: 0, disposed: 0 });
    this.stats.set('waveshaper', { created: 0, disposed: 0 });
    this.stats.set('dynamics', { created: 0, disposed: 0 });
    
    // Start cleanup interval
    this.startCleanup();
  }
  
  // =============================================================================
  // Node Acquisition
  // =============================================================================
  
  /**
   * Acquire a node from the pool or create new
   */
  public acquire(type: NodeType): AudioNode {
    const pool = this.pools.get(type);
    if (!pool) {
      throw new Error(`Unknown node type: ${type}`);
    }
    
    // Try to get from pool
    if (pool.length > 0) {
      const pooled = pool.pop()!;
      this.acquired.set(pooled.node, type);
      
      // Reset node state
      this.resetNode(pooled.node, type);
      
      return pooled.node;
    }
    
    // Create new node
    const node = this.createNode(type);
    this.acquired.set(node, type);
    
    // Update stats
    const stats = this.stats.get(type)!;
    stats.created++;
    
    return node;
  }
  
  /**
   * Create a new node of specified type
   */
  private createNode(type: NodeType): AudioNode {
    const ctx = this.audioContext;
    
    switch (type) {
      case 'gain':
        return ctx.createGain();
      case 'biquad':
        return ctx.createBiquadFilter();
      case 'delay':
        return ctx.createDelay();
      case 'waveshaper':
        return ctx.createWaveShaper();
      case 'dynamics':
        return ctx.createDynamicsCompressor();
      default:
        throw new Error(`Unknown node type: ${type}`);
    }
  }
  
  /**
   * Reset node to default state before reuse
   */
  private resetNode(node: AudioNode, type: NodeType): void {
    // Disconnect any existing connections
    node.disconnect();
    
    // Reset parameters based on type
    switch (type) {
      case 'gain':
        const gainNode = node as GainNode;
        gainNode.gain.value = 1;
        break;
      case 'biquad':
        const biquad = node as BiquadFilterNode;
        biquad.type = 'lowpass';
        biquad.frequency.value = 350;
        biquad.Q.value = 1;
        biquad.gain.value = 0;
        break;
      case 'delay':
        const delay = node as DelayNode;
        delay.delayTime.value = 0;
        break;
      case 'dynamics':
        const comp = node as DynamicsCompressorNode;
        comp.threshold.value = -24;
        comp.ratio.value = 12;
        comp.attack.value = 0.003;
        comp.release.value = 0.25;
        break;
    }
  }
  
  // =============================================================================
  // Node Release
  // =============================================================================
  
  /**
   * Release a node back to the pool
   */
  public release(node: AudioNode): void {
    const type = this.acquired.get(node);
    if (!type) {
      // Node wasn't from this pool, just dispose it
      this.disposeNode(node);
      return;
    }
    
    // Remove from acquired
    this.acquired.delete(node);
    
    const pool = this.pools.get(type)!;
    
    // Check if pool is at capacity
    if (pool.length >= this.config.maxSize) {
      this.disposeNode(node);
      const stats = this.stats.get(type)!;
      stats.disposed++;
      return;
    }
    
    // Add back to pool
    pool.push({
      node,
      acquiredAt: 0,
      pooledAt: performance.now(),
      useCount: 0,
    });
  }
  
  /**
   * Dispose a node completely
   */
  private disposeNode(node: AudioNode): void {
    try {
      node.disconnect();
      // Note: AudioNodes don't have an explicit dispose method
      // They are garbage collected when no longer referenced
    } catch (error) {
      // Ignore errors during dispose
    }
  }
  
  // =============================================================================
  // Cleanup
  // =============================================================================
  
  /**
   * Start periodic cleanup of idle nodes
   */
  private startCleanup(): void {
    this.cleanupInterval = window.setInterval(() => {
      this.cleanup();
    }, this.config.maxIdleTime);
  }
  
  /**
   * Remove idle nodes that have been in pool too long
   */
  public cleanup(): void {
    const now = performance.now();
    
    this.pools.forEach((pool, type) => {
      const remaining: PooledNode<AudioNode>[] = [];
      
      pool.forEach((pooled) => {
        const idleTime = now - pooled.pooledAt;
        
        if (idleTime > this.config.maxIdleTime) {
          // Dispose idle node
          this.disposeNode(pooled.node);
          const stats = this.stats.get(type)!;
          stats.disposed++;
        } else {
          remaining.push(pooled);
        }
      });
      
      // Replace pool with non-expired nodes
      this.pools.set(type, remaining);
    });
  }
  
  // =============================================================================
  // Stats
  // =============================================================================
  
  /**
   * Get pool statistics
   */
  public getStats(): Record<NodeType, PoolStats> {
    const result = {} as Record<NodeType, PoolStats>;
    
    this.pools.forEach((pool, type) => {
      const stats = this.stats.get(type)!;
      
      result[type] = {
        acquired: Array.from(this.acquired.values()).filter((t) => t === type).length,
        available: pool.length,
        totalCreated: stats.created,
        totalDisposed: stats.disposed,
      };
    });
    
    return result;
  }
  
  /**
   * Get total stats across all pools
   */
  public getTotalStats(): {
    totalAcquired: number;
    totalAvailable: number;
    totalCreated: number;
    totalDisposed: number;
  } {
    const stats = this.getStats();
    
    return {
      totalAcquired: Object.values(stats).reduce((sum, s) => sum + s.acquired, 0),
      totalAvailable: Object.values(stats).reduce((sum, s) => sum + s.available, 0),
      totalCreated: Object.values(stats).reduce((sum, s) => sum + s.totalCreated, 0),
      totalDisposed: Object.values(stats).reduce((sum, s) => sum + s.totalDisposed, 0),
    };
  }
  
  // =============================================================================
  // Utility Methods
  // =============================================================================
  
  /**
   * Pre-warm pool with nodes
   */
  public prewarm(type: NodeType, count: number): void {
    const pool = this.pools.get(type)!;
    const stats = this.stats.get(type)!;
    
    for (let i = 0; i < count; i++) {
      if (pool.length >= this.config.maxSize) break;
      
      const node = this.createNode(type);
      pool.push({
        node,
        acquiredAt: 0,
        pooledAt: performance.now(),
        useCount: 0,
      });
      
      stats.created++;
    }
  }
  
  /**
   * Clear all pools
   */
  public clear(): void {
    // Dispose all acquired nodes
    this.acquired.forEach((type, node) => {
      this.disposeNode(node);
      const stats = this.stats.get(type)!;
      stats.disposed++;
    });
    this.acquired.clear();
    
    // Dispose all pooled nodes
    this.pools.forEach((pool, type) => {
      pool.forEach((pooled) => {
        this.disposeNode(pooled.node);
        const stats = this.stats.get(type)!;
        stats.disposed++;
      });
      pool.length = 0;
    });
  }
  
  /**
   * Dispose the pool
   */
  public dispose(): void {
    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Clear all nodes
    this.clear();
    
    // Clear pools
    this.pools.clear();
    this.stats.clear();
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createNodePool(
  audioContext: AudioContext,
  config?: Partial<NodePoolConfig>
): NodePool {
  return new NodePool(audioContext, config);
}

export default NodePool;
