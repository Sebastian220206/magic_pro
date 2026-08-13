interface CachedAudioBuffer {
    buffer: AudioBuffer;
    size: number;
    lastAccess: number;
    refCount: number;
}

const DEFAULT_MAX_MEMORY = 256 * 1024 * 1024;

/**
 * createBuffer throws NotSupportedError outside the range an implementation
 * accepts; the spec only requires 8000-96000 Hz. SF2 fonts go below that --
 * GeneralUser GS has a 6 kHz sample -- so the rate is clamped and callers
 * correct the difference with playbackRate.
 */
const MIN_BUFFER_RATE = 8000;
const MAX_BUFFER_RATE = 96000;

export class SampleManager {
    private cache = new Map<string, CachedAudioBuffer>();
    private ctx: AudioContext | OfflineAudioContext;
    private _sampleRate: number = 44100;
    private maxMemory: number;
    private totalMemory: number = 0;

    constructor(ctx: AudioContext | OfflineAudioContext, maxMemory: number = DEFAULT_MAX_MEMORY) {
        this.ctx = ctx;
        this.maxMemory = maxMemory;
    }

    setSampleRate(rate: number) {
        this._sampleRate = rate;
    }

    get sampleRate(): number {
        return this._sampleRate;
    }

    getOrCreateBuffer(key: string, sampleData: Float32Array, sampleRate: number): AudioBuffer {
        const cached = this.cache.get(key);
        if (cached) {
            cached.lastAccess = Date.now();
            cached.refCount++;
            return cached.buffer;
        }

        const size = sampleData.length * 4;
        this.ensureRoom(size);

        const rate = Math.max(MIN_BUFFER_RATE, Math.min(MAX_BUFFER_RATE, sampleRate));
        const buffer = this.ctx.createBuffer(1, sampleData.length, rate);
        buffer.getChannelData(0).set(sampleData);

        this.cache.set(key, {
            buffer,
            size,
            lastAccess: Date.now(),
            refCount: 1,
        });
        this.totalMemory += size;

        return buffer;
    }

    releaseBuffer(key: string) {
        const cached = this.cache.get(key);
        if (!cached) return;
        cached.refCount--;
        if (cached.refCount <= 0) {
            this.cache.delete(key);
            this.totalMemory -= cached.size;
        }
    }

    hasBuffer(key: string): boolean {
        return this.cache.has(key);
    }

    removeBuffer(key: string) {
        const cached = this.cache.get(key);
        if (cached) {
            this.totalMemory -= cached.size;
            this.cache.delete(key);
        }
    }

    getMemoryUsage(): number {
        return this.totalMemory;
    }

    setMemoryLimit(bytes: number) {
        this.maxMemory = Math.max(64 * 1024 * 1024, bytes);
        this.evictLRU();
    }

    private ensureRoom(needed: number) {
        if (this.totalMemory + needed <= this.maxMemory) return;
        this.evictLRU();
    }

    private evictLRU() {
        const entries = Array.from(this.cache.entries())
            .filter(([, e]) => e.refCount === 0)
            .sort(([, a], [, b]) => a.lastAccess - b.lastAccess);

        for (const [key, entry] of entries) {
            if (this.totalMemory <= this.maxMemory * 0.8) break;
            this.cache.delete(key);
            this.totalMemory -= entry.size;
        }
    }

    clear() {
        this.cache.clear();
        this.totalMemory = 0;
    }

    getBufferCount(): number {
        return this.cache.size;
    }

    dispose() {
        this.cache.clear();
        this.totalMemory = 0;
    }
}
