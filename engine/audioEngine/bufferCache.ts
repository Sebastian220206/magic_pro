/**
 * bufferCache.ts
 * AudioBuffer cache system for memory management and performance optimization.
 * 
 * Features:
 * - Intelligent AudioBuffer caching
 * - Memory usage tracking
 * - Automatic cleanup of unused buffers
 * - Performance statistics
 */

import { 
    BufferCacheEntry, 
    CacheStats, 
    AudioEngineEvent,
    EventListener 
} from './types';
import { audioContextManager } from './audioContext';

// ─── Cache Configuration ────────────────────────────────────────────────────────

interface CacheConfig {
    maxSize: number; // Maximum cache size in bytes
    maxAge: number; // Maximum age in milliseconds
    cleanupInterval: number; // Cleanup interval in milliseconds
}

const DEFAULT_CONFIG: CacheConfig = {
    maxSize: 500 * 1024 * 1024, // 500MB
    maxAge: 30 * 60 * 1000, // 30 minutes
    cleanupInterval: 60 * 1000 // 1 minute
};

// ─── Buffer Cache Manager ──────────────────────────────────────────────────────

class BufferCacheManager {
    private cache: Map<string, BufferCacheEntry> = new Map();
    private config: CacheConfig;
    private eventListeners: EventListener[] = [];
    private cleanupTimer: NodeJS.Timeout | null = null;
    private stats: CacheStats;
    private loading: Map<string, Promise<AudioBuffer>> = new Map();

    constructor(config: Partial<CacheConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.stats = {
            totalBuffers: 0,
            totalSize: 0,
            hitRate: 0,
            missRate: 0
        };
        
        this.startCleanupTimer();
        console.log('[BufferCache] Initialized with config:', this.config);
    }

    // ── Cache Operations ────────────────────────────────────────────────────────

    /**
     * Add buffer to cache.
     */
    addBuffer(
        id: string, 
        buffer: AudioBuffer, 
        url?: string
    ): void {
        const size = this.calculateBufferSize(buffer);
        
        // Check if we need to evict buffers
        if (this.shouldEvict(size)) {
            this.evictLeastRecentlyUsed(size);
        }

        const entry: BufferCacheEntry = {
            id,
            buffer,
            url,
            lastAccessed: Date.now(),
            size,
            refCount: 1
        };

        this.cache.set(id, entry);
        this.updateStats();

        this.emitEvent({
            type: 'bufferLoaded',
            bufferId: id,
            size
        });

        console.log('[BufferCache] Buffer added:', { id, size, url });
    }

    /**
     * Get buffer from cache.
     */
    getBuffer(id: string): AudioBuffer | null {
        const entry = this.cache.get(id);
        
        if (entry) {
            // Update access time and ref count
            entry.lastAccessed = Date.now();
            entry.refCount++;
            
            this.updateStats();
            
            console.log('[BufferCache] Cache hit:', id);
            return entry.buffer;
        }

        console.log('[BufferCache] Cache miss:', id);
        return null;
    }

    /**
     * Check if buffer exists in cache.
     */
    hasBuffer(id: string): boolean {
        return this.cache.has(id);
    }

    /**
     * Remove buffer from cache.
     */
    removeBuffer(id: string): boolean {
        const entry = this.cache.get(id);
        if (entry) {
            this.cache.delete(id);
            this.updateStats();
            
            this.emitEvent({
                type: 'bufferEvicted',
                bufferId: id,
                reason: 'manual'
            });

            console.log('[BufferCache] Buffer removed:', id);
            return true;
        }
        
        return false;
    }

    /**
     * Increment reference count for a buffer.
     */
    addRef(id: string): void {
        const entry = this.cache.get(id);
        if (entry) {
            entry.refCount++;
            entry.lastAccessed = Date.now();
        }
    }

    /**
     * Decrement reference count for a buffer.
     */
    removeRef(id: string): void {
        const entry = this.cache.get(id);
        if (entry && entry.refCount > 0) {
            entry.refCount--;
        }
    }

    // ── Cache Management ────────────────────────────────────────────────────────

    /**
     * Clear all buffers from cache.
     */
    clearCache(): void {
        const count = this.cache.size;
        this.cache.clear();
        this.updateStats();
        
        console.log('[BufferCache] Cache cleared:', { buffersRemoved: count });
    }

    /**
     * Get cache statistics.
     */
    getStats(): CacheStats {
        return { ...this.stats };
    }

    /**
     * Get all cached buffer IDs.
     */
    getBufferIds(): string[] {
        return Array.from(this.cache.keys());
    }

    /**
     * Get cache size in bytes.
     */
    getCacheSize(): number {
        let totalSize = 0;
        this.cache.forEach(entry => {
            totalSize += entry.size;
        });
        return totalSize;
    }

    /**
     * Get number of cached buffers.
     */
    getBufferCount(): number {
        return this.cache.size;
    }

    // ── Memory Management ────────────────────────────────────────────────────────

    /**
     * Calculate buffer size in bytes.
     */
    private calculateBufferSize(buffer: AudioBuffer): number {
        const sampleSize = buffer.sampleRate === 48000 ? 4 : 3; // Approximate bytes per sample
        return buffer.length * buffer.numberOfChannels * sampleSize;
    }

    /**
     * Check if eviction is needed.
     */
    private shouldEvict(newBufferSize: number): boolean {
        const currentSize = this.getCacheSize();
        return currentSize + newBufferSize > this.config.maxSize;
    }

    /**
     * Evict least recently used buffers.
     */
    private evictLeastRecentlyUsed(neededSpace: number): void {
        const entries = Array.from(this.cache.entries());
        
        // Sort by last accessed time (oldest first)
        entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        
        let freedSpace = 0;
        const evicted: string[] = [];
        
        for (const [id, entry] of entries) {
            if (entry.refCount > 0) continue; // Don't evict referenced buffers
            
            this.cache.delete(id);
            freedSpace += entry.size;
            evicted.push(id);
            
            this.emitEvent({
                type: 'bufferEvicted',
                bufferId: id,
                reason: 'lru_eviction'
            });
            
            if (freedSpace >= neededSpace) break;
        }
        
        this.updateStats();
        console.log('[BufferCache] Evicted buffers:', { count: evicted.length, freedSpace });
    }

    /**
     * Clean up old buffers.
     */
    private cleanupOldBuffers(): void {
        const now = Date.now();
        const expired: string[] = [];
        
        this.cache.forEach((entry, id) => {
            if (entry.refCount > 0) return; // Don't remove referenced buffers
            
            const age = now - entry.lastAccessed;
            if (age > this.config.maxAge) {
                this.cache.delete(id);
                expired.push(id);
                
                this.emitEvent({
                    type: 'bufferEvicted',
                    bufferId: id,
                    reason: 'age'
                });
            }
        });
        
        if (expired.length > 0) {
            this.updateStats();
            console.log('[BufferCache] Cleaned up expired buffers:', { count: expired.length });
        }
    }

    /**
     * Start cleanup timer.
     */
    private startCleanupTimer(): void {
        this.cleanupTimer = setInterval(() => {
            this.cleanupOldBuffers();
        }, this.config.cleanupInterval);
    }

    /**
     * Stop cleanup timer.
     */
    private stopCleanupTimer(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    // ── Statistics ───────────────────────────────────────────────────────────────

    /**
     * Update cache statistics.
     */
    private updateStats(): void {
        this.stats.totalBuffers = this.cache.size;
        this.stats.totalSize = this.getCacheSize();
        
        // Calculate hit/miss rates (simplified - would need actual hit/miss tracking)
        this.stats.hitRate = 0.8; // Placeholder
        this.stats.missRate = 0.2; // Placeholder
    }

    /**
     * Get detailed cache information.
     */
    getCacheInfo(): {
        config: CacheConfig;
        stats: CacheStats;
        buffers: Array<{ id: string; size: number; refCount: number; lastAccessed: number }>;
    } {
        const buffers = Array.from(this.cache.entries()).map(([id, entry]) => ({
            id,
            size: entry.size,
            refCount: entry.refCount,
            lastAccessed: entry.lastAccessed
        }));

        return {
            config: { ...this.config },
            stats: { ...this.stats },
            buffers
        };
    }

    // ── Event System ───────────────────────────────────────────────────────────

    addEventListener(listener: EventListener): void {
        this.eventListeners.push(listener);
    }

    removeEventListener(listener: EventListener): void {
        const index = this.eventListeners.indexOf(listener);
        if (index > -1) {
            this.eventListeners.splice(index, 1);
        }
    }

    private emitEvent(event: AudioEngineEvent): void {
        this.eventListeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error('[BufferCache] Event listener error:', error);
            }
        });
    }

    // ── Advanced Features ───────────────────────────────────────────────────────

    /**
     * Load an audio buffer from URL with caching and deduplication.
     */
    async load(url: string): Promise<AudioBuffer> {
        // Return cached buffer immediately
        if (this.cache.has(url)) {
            const entry = this.cache.get(url)!;
            entry.lastAccessed = Date.now();
            return entry.buffer;
        }

        // Deduplicate in-flight requests
        if (this.loading.has(url)) {
            return this.loading.get(url)!;
        }

        const ctx = audioContextManager.getContext();
        if (!ctx) await audioContextManager.initialize();

        const promise = fetch(url)
            .then(r => {
                if (!r.ok) throw new Error(`Failed to fetch audio: ${r.statusText}`);
                return r.arrayBuffer();
            })
            .then(ab => audioContextManager.getContext()!.decodeAudioData(ab))
            .then(buffer => {
                this.addBuffer(url, buffer, url);
                this.loading.delete(url);
                return buffer;
            })
            .catch(error => {
                this.loading.delete(url);
                console.error(`[BufferCache] Failed to load ${url}:`, error);
                throw error;
            });

        this.loading.set(url, promise);
        return promise;
    }

    /**
     * Preload multiple buffers (e.g. when project loads).
     */
    async preloadAll(urls: string[]): Promise<void> {
        console.log('[BufferCache] Preloading all:', urls.length);
        await Promise.allSettled(urls.map(url => this.load(url)));
    }

    /**
     * Optimize cache based on usage patterns.
     */
    optimizeCache(): void {
        console.log('[BufferCache] Optimizing cache...');
        
        // Remove unreferenced buffers first
        const unreferenced: string[] = [];
        this.cache.forEach((entry, id) => {
            if (entry.refCount === 0) {
                unreferenced.push(id);
            }
        });

        unreferenced.forEach(id => {
            this.cache.delete(id);
        });

        if (unreferenced.length > 0) {
            this.updateStats();
            console.log('[BufferCache] Removed unreferenced buffers:', unreferenced.length);
        }
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────────

    dispose(): void {
        this.stopCleanupTimer();
        this.cache.clear();
        this.eventListeners = [];
        console.log('[BufferCache] Disposed');
    }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────────

export const bufferCacheManager = new BufferCacheManager();

// ─── Convenience Exports ─────────────────────────────────────────────────────────

export const addBuffer = (id: string, buffer: AudioBuffer, url?: string) => 
    bufferCacheManager.addBuffer(id, buffer, url);

export const getBuffer = (id: string) => bufferCacheManager.getBuffer(id);
export const hasBuffer = (id: string) => bufferCacheManager.hasBuffer(id);
export const removeBuffer = (id: string) => bufferCacheManager.removeBuffer(id);
export const getCacheStats = () => bufferCacheManager.getStats();
export const clearCache = () => bufferCacheManager.clearCache();
