/**
 * AudioGraphManager - Performance-optimized audio graph management
 * 
 * Features:
 * - Batch node connections to minimize audio thread interruptions
 * - Connection validation and duplicate prevention
 * - Automated disconnection cleanup
 * - Connection state tracking
 */

// =============================================================================
// Types
// =============================================================================

export interface Connection {
  source: AudioNode;
  destination: AudioNode;
  active: boolean;
}

export interface ConnectionBatch {
  connections: Array<{ source: AudioNode; destination: AudioNode }>;
  timestamp: number;
}

export interface GraphStats {
  totalConnections: number;
  activeConnections: number;
  nodeCount: number;
}

// =============================================================================
// AudioGraphManager Class
// =============================================================================

export class AudioGraphManager {
  private connections: Map<string, Connection> = new Map();
  private nodes: Set<AudioNode> = new Set();
  private pendingBatch: ConnectionBatch | null = null;
  private batchTimeout: number | null = null;
  private readonly BATCH_DELAY = 5; // ms
  
  // =============================================================================
  // Connection Management
  // =============================================================================
  
  /**
   * Generate unique connection key
   */
  private getConnectionKey(source: AudioNode, destination: AudioNode): string {
    return `${source.toString()}_${destination.toString()}`;
  }
  
  /**
   * Connect two audio nodes
   */
  public connect(source: AudioNode, destination: AudioNode): boolean {
    const key = this.getConnectionKey(source, destination);
    
    // Check if already connected
    if (this.connections.has(key)) {
      return false;
    }
    
    // Perform connection
    try {
      source.connect(destination);
      
      this.connections.set(key, {
        source,
        destination,
        active: true,
      });
      
      this.nodes.add(source);
      this.nodes.add(destination);
      
      return true;
    } catch (error) {
      console.error('AudioGraphManager: Connection failed', error);
      return false;
    }
  }
  
  /**
   * Disconnect two audio nodes
   */
  public disconnect(source: AudioNode, destination?: AudioNode): boolean {
    if (destination) {
      const key = this.getConnectionKey(source, destination);
      const connection = this.connections.get(key);
      
      if (!connection) {
        return false;
      }
      
      try {
        source.disconnect(destination);
        this.connections.delete(key);
        return true;
      } catch (error) {
        console.error('AudioGraphManager: Disconnection failed', error);
        return false;
      }
    } else {
      // Disconnect all from source
      let disconnected = false;
      Array.from(this.connections.entries()).forEach(([key, conn]) => {
        if (conn.source === source) {
          try {
            source.disconnect(conn.destination);
            this.connections.delete(key);
            disconnected = true;
          } catch (error) {
            console.error('AudioGraphManager: Disconnection failed', error);
          }
        }
      });
      return disconnected;
    }
  }
  
  /**
   * Batch multiple connections for efficient processing
   */
  public batchConnect(connections: Array<{ source: AudioNode; destination: AudioNode }>): void {
    // Add to pending batch
    if (!this.pendingBatch) {
      this.pendingBatch = {
        connections: [],
        timestamp: performance.now(),
      };
    }
    
    this.pendingBatch.connections.push(...connections);
    
    // Schedule batch processing
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    
    this.batchTimeout = window.setTimeout(() => {
      this.processBatch();
    }, this.BATCH_DELAY);
  }
  
  /**
   * Process pending connection batch
   */
  private processBatch(): void {
    if (!this.pendingBatch) return;
    
    const { connections } = this.pendingBatch;
    
    // Process all connections
    connections.forEach(({ source, destination }) => {
      this.connect(source, destination);
    });
    
    // Clear batch
    this.pendingBatch = null;
    this.batchTimeout = null;
  }
  
  // =============================================================================
  // Chain Operations
  // =============================================================================
  
  /**
   * Connect a chain of nodes in series
   */
  public connectChain(nodes: AudioNode[]): boolean {
    if (nodes.length < 2) return false;
    
    let success = true;
    for (let i = 0; i < nodes.length - 1; i++) {
      if (!this.connect(nodes[i], nodes[i + 1])) {
        success = false;
      }
    }
    
    return success;
  }
  
  /**
   * Disconnect a chain
   */
  public disconnectChain(nodes: AudioNode[]): void {
    for (let i = 0; i < nodes.length - 1; i++) {
      this.disconnect(nodes[i], nodes[i + 1]);
    }
  }
  
  /**
   * Insert a node into an existing connection
   */
  public insertNode(newNode: AudioNode, beforeNode: AudioNode): boolean {
    // Find connection where beforeNode is the destination
    const targetConnection = Array.from(this.connections.values()).find(
      (conn) => conn.destination === beforeNode
    );
    
    if (!targetConnection) return false;
    
    // Break existing connection
    this.disconnect(targetConnection.source, beforeNode);
    
    // Create new connections: source → newNode → beforeNode
    const connected1 = this.connect(targetConnection.source, newNode);
    const connected2 = this.connect(newNode, beforeNode);
    
    return connected1 && connected2;
  }
  
  /**
   * Remove a node from the graph (reconnects around it)
   */
  public removeNode(node: AudioNode): boolean {
    // Find connections involving this node
    const incoming = Array.from(this.connections.values()).filter(
      (conn) => conn.destination === node
    );
    const outgoing = Array.from(this.connections.values()).filter(
      (conn) => conn.source === node
    );
    
    if (incoming.length === 0 || outgoing.length === 0) {
      // Node is not in the middle of a chain, just disconnect
      this.disconnect(node);
      this.nodes.delete(node);
      return true;
    }
    
    // For simplicity, only handle single input/output
    if (incoming.length === 1 && outgoing.length === 1) {
      const source = incoming[0].source;
      const destination = outgoing[0].destination;
      
      // Disconnect node
      this.disconnect(node);
      
      // Reconnect around it
      this.connect(source, destination);
    }
    
    this.nodes.delete(node);
    return true;
  }
  
  // =============================================================================
  // Query & Stats
  // =============================================================================
  
  /**
   * Check if two nodes are connected
   */
  public isConnected(source: AudioNode, destination: AudioNode): boolean {
    const key = this.getConnectionKey(source, destination);
    return this.connections.has(key);
  }
  
  /**
   * Get all connections for a node
   */
  public getConnections(node: AudioNode): { inputs: AudioNode[]; outputs: AudioNode[] } {
    const inputs: AudioNode[] = [];
    const outputs: AudioNode[] = [];
    
    this.connections.forEach((conn) => {
      if (conn.destination === node) {
        inputs.push(conn.source);
      }
      if (conn.source === node) {
        outputs.push(conn.destination);
      }
    });
    
    return { inputs, outputs };
  }
  
  /**
   * Get graph statistics
   */
  public getStats(): GraphStats {
    return {
      totalConnections: this.connections.size,
      activeConnections: Array.from(this.connections.values()).filter((c) => c.active).length,
      nodeCount: this.nodes.size,
    };
  }
  
  // =============================================================================
  // Cleanup
  // =============================================================================
  
  /**
   * Clear all connections
   */
  public clear(): void {
    // Clear pending batch
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    this.pendingBatch = null;
    
    // Disconnect all
    this.connections.forEach((conn) => {
      try {
        conn.source.disconnect(conn.destination);
      } catch (error) {
        // Ignore errors during cleanup
      }
    });
    
    this.connections.clear();
    this.nodes.clear();
  }
  
  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    this.clear();
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createAudioGraphManager(): AudioGraphManager {
  return new AudioGraphManager();
}

export default AudioGraphManager;
