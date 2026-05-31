/**
 * scheduler.ts
 * Low-latency clip scheduling system with lookahead and timing correction.
 * 
 * Features:
 * - 25-100ms lookahead scheduling
 * - Multi-track efficient scheduling
 * - Timing drift prevention
 * - Clip offset and time stretching support
 */

import { 
    AudioClip, 
    AudioTrack, 
    ScheduledClip, 
    SchedulingWindow,
    AudioEngineEvent,
    EventListener,
    TimeStretchParams,
    PitchShiftParams
} from './types';
import { audioContextManager } from './audioContext';
import { routingEngine } from './routingEngine';
import { bufferCacheManager } from './bufferCache';

// ─── Scheduler Configuration ────────────────────────────────────────────────────────────

interface SchedulerConfig {
    lookaheadTime: number; // ms
    scheduleInterval: number; // ms
    maxLatency: number; // ms
    enableTimeStretch: boolean;
    enablePitchShift: boolean;
}

const DEFAULT_CONFIG: SchedulerConfig = {
    lookaheadTime: 50,
    scheduleInterval: 25,
    maxLatency: 100,
    enableTimeStretch: true,
    enablePitchShift: true
};

// ─── Advanced Scheduler ────────────────────────────────────────────────────────────

class AdvancedScheduler {
    private config: SchedulerConfig;
    private isPlaying: boolean = false;
    private startTime: number = 0;
    private pauseTime: number = 0;
    private currentTime: number = 0;
    private tempo: number = 120;
    private timeSignature: [number, number] = [4, 4]; // [numerator, denominator]
    
    private scheduledClips: Map<string, ScheduledClip> = new Map();
    private activeSources: Set<AudioBufferSourceNode> = new Set();
    private eventListeners: EventListener[] = [];
    
    private timerWorker: Worker | null = null;
    private lastScheduleTime: number = 0;
    private timingCorrection: number = 0;
    private clipsCache: AudioClip[] = [];
    private tracksCache: AudioTrack[] = [];

    constructor(config: Partial<SchedulerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        console.log('[Scheduler] Initialized with config:', this.config);
    }

    /**
     * Register an externally-created source so that stopPlayback() can stop it.
     * Used by AudioEngineAdapter.playClip() to ensure all sources are tracked.
     */
    registerSource(source: AudioBufferSourceNode): void {
        this.activeSources.add(source);
        source.onended = () => {
            this.activeSources.delete(source);
        };
    }

    // ── Playback Control ────────────────────────────────────────────────────────

    /**
     * Start playback from specific time.
     */
    async startPlayback(
        clips: AudioClip[], 
        tracks: AudioTrack[], 
        startBeat: number = 0,
        tempo: number = 120
    ): Promise<void> {
        if (this.isPlaying) return;

        try {
            const ctx = audioContextManager.getContext();
            if (!ctx) {
                await audioContextManager.initialize();
            }

            this.tempo = tempo;
            this.isPlaying = true;
            this.startTime = ctx!.currentTime - this.beatsToSeconds(startBeat);
            this.currentTime = startBeat;
            this.lastScheduleTime = 0;
            this.clipsCache = clips;
            this.tracksCache = tracks;

            // Pre-schedule clips within lookahead window
            await this.scheduleClips(clips, tracks, startBeat);

            // Start scheduling loop
            this.startSchedulingLoop(clips, tracks);

            this.emitEvent({
                type: 'playbackStarted',
                time: ctx!.currentTime
            });

            console.log('[Scheduler] Playback started', {
                startBeat,
                tempo,
                clipsCount: clips.length
            });

        } catch (error) {
            this.emitEvent({
                type: 'error',
                error: `Failed to start playback: ${error}`,
                context: 'scheduler.startPlayback'
            });
        }
    }

    /**
     * Stop playback and clean up all active sources.
     */
    stopPlayback(): void {
        if (!this.isPlaying) return;

        this.isPlaying = false;
        this.pauseTime = this.currentTime;

        // Stop scheduling loop
        if (this.timerWorker) {
            this.timerWorker.postMessage('stop');
        }

        // Stop all active sources
        this.activeSources.forEach(source => {
            try {
                source.stop();
            } catch (error) {
                console.warn('[Scheduler] Error stopping source:', error);
            }
        });
        this.activeSources.clear();

        // Clear scheduled clips
        this.scheduledClips.clear();
        this.clipsCache = [];
        this.tracksCache = [];

        this.emitEvent({
            type: 'playbackStopped',
            time: audioContextManager.getCurrentTime()
        });

        console.log('[Scheduler] Playback stopped');
    }

    stopPlaybackAndReset(): void {
        this.stopPlayback();
        this.currentTime = 0;
        this.pauseTime = 0;
    }

    /**
     * Seek to specific beat position.
     */
    seekTo(beat: number): void {
        if (!this.isPlaying) return;

        const ctx = audioContextManager.getContext();
        if (!ctx) return;

        // Update timing reference
        this.startTime = ctx.currentTime - this.beatsToSeconds(beat);
        this.currentTime = beat;

        // Clear and reschedule clips
        this.activeSources.forEach(source => {
            try {
                source.stop();
            } catch (error) {
                console.warn('[Scheduler] Error stopping source during seek:', error);
            }
        });
        this.activeSources.clear();
        this.scheduledClips.clear();

        this.emitEvent({
            type: 'seek',
            beat
        });

        console.log('[Scheduler] Seeked to beat:', beat);
    }

    // ── Scheduling Logic ────────────────────────────────────────────────────────

    private async scheduleClips(clips: AudioClip[], _tracks: AudioTrack[], currentBeat: number): Promise<void> {
        const ctx = audioContextManager.getContext();
        if (!ctx) return;

        const window = this.getSchedulingWindow(ctx);

        // Filter clips that should be scheduled — check live routing engine state
        const clipsToSchedule = clips.filter(clip => {
            const trackNodes = (routingEngine as any).trackNodes.get(clip.trackId);
            const isMuted = trackNodes?.isMuted ?? false;
            const isSoloed = trackNodes?.isSoloed ?? false;
            const anySolo = (routingEngine as any).soloedTracks?.size > 0;
            const skip = isMuted || (anySolo && !isSoloed);
            if (skip) return false;

            // Check if clip is within scheduling window
            const clipStartBeat = clip.startBeat;
            const clipEndBeat = clip.startBeat + clip.duration;
            
            return clipEndBeat >= window.windowStart && clipStartBeat <= window.windowEnd;
        });

        // Resolve all buffers in parallel first, then schedule synchronously
        await this.resolveBuffers(clipsToSchedule);

        // Schedule each clip synchronously
        for (const clip of clipsToSchedule) {
            this.scheduleClipSync(clip, window);
        }
    }

    private async resolveBuffers(clips: AudioClip[]): Promise<void> {
        const ctx = audioContextManager.getContext();
        if (!ctx) return;

        const toResolve = clips.filter(c => {
            if (c.buffer) return false;
            const primaryKey = (c as any).sampleId ?? c.id;
            if (bufferCacheManager.getBuffer(primaryKey)) return false;
            if ((c as any).storageKey && bufferCacheManager.getBuffer((c as any).storageKey)) return false;
            return true;
        });

        await Promise.allSettled(
            toResolve.map(async (clip) => {
                const fileUrl = (clip as any).fileUrl;
                if (!fileUrl) return;
                try {
                    const res = await fetch(fileUrl);
                    const ab = await res.arrayBuffer();
                    const buffer = await ctx.decodeAudioData(ab);
                    const cacheKey = (clip as any).sampleId ?? (clip as any).storageKey ?? clip.id;
                    bufferCacheManager.addBuffer(cacheKey, buffer, fileUrl);
                } catch (err) {
                    console.warn('[Scheduler] Failed to decode buffer for clip:', clip.id, err);
                }
            })
        );
    }

    private scheduleClipSync(clip: AudioClip, window: SchedulingWindow): void {
        const ctx = audioContextManager.getContext();
        if (!ctx) return;

        if (this.scheduledClips.has(clip.id)) return;

        // Resolve buffer from cache or clip.buffer
        let buffer: AudioBuffer | null = clip.buffer ?? null;
        if (!buffer) {
            const primaryKey = (clip as any).sampleId ?? clip.id;
            buffer = bufferCacheManager.getBuffer(primaryKey) ?? null;
        }
        if (!buffer && (clip as any).storageKey) {
            buffer = bufferCacheManager.getBuffer((clip as any).storageKey) ?? null;
        }
        if (!buffer) return;

        const clipStartBeat = Number.isFinite(clip.startBeat) ? clip.startBeat : 0;
        if (!Number.isFinite(clipStartBeat)) return;
        const clipDuration = clip.duration ?? 0;
        if (!Number.isFinite(clipDuration)) return;
        const clipStartSeconds = this.beatsToSeconds(clipStartBeat);
        const clipDurationSeconds = this.beatsToSeconds(clipDuration);
        const hardwareStartTime = this.startTime + clipStartSeconds;

        let scheduledStartTime = hardwareStartTime;
        let playheadOffsetSeconds = 0;

        if (hardwareStartTime < window.currentTime) {
            scheduledStartTime = window.currentTime;
            playheadOffsetSeconds = window.currentTime - hardwareStartTime;
        }

        const remainingDurationSeconds = clipDurationSeconds - playheadOffsetSeconds;
        if (remainingDurationSeconds <= 0) return;

        const baseClipOffsetSeconds = (clip as any).offset ? this.beatsToSeconds((clip as any).offset) : 0;
        const totalBufferOffsetSeconds = baseClipOffsetSeconds + playheadOffsetSeconds;

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = clip.timeStretch || 1.0;

        let trackNodes = (routingEngine as any).trackNodes.get(clip.trackId);
        if (!trackNodes) {
            console.warn(`[Scheduler] Track ${clip.trackId} missing in routing engine. Lazy instantiating.`);
            routingEngine.createTrack({ id: clip.trackId } as any);
            trackNodes = (routingEngine as any).trackNodes.get(clip.trackId);
        }

        if (trackNodes) {
            source.connect(trackNodes.inputGain);
        } else {
            console.error(`[Scheduler] Critical Error: Track ${clip.trackId} could not be allocated.`);
        }

        source.start(scheduledStartTime, totalBufferOffsetSeconds, remainingDurationSeconds);
        this.activeSources.add(source);

        const scheduledClip: ScheduledClip = {
            id: clip.id,
            clip,
            source,
            startTime: scheduledStartTime,
            endTime: scheduledStartTime + clipDurationSeconds,
            trackId: clip.trackId
        };

        this.scheduledClips.set(clip.id, scheduledClip);

        source.onended = () => {
            this.activeSources.delete(source);
            this.scheduledClips.delete(clip.id);
            this.emitEvent({
                type: 'clipFinished',
                clipId: clip.id,
                endTime: ctx.currentTime
            });
        };

        this.emitEvent({
            type: 'clipScheduled',
            clipId: clip.id,
            startTime: scheduledStartTime
        });
    }

    private startSchedulingLoop(clips: AudioClip[], tracks: AudioTrack[]): void {
        if (!this.timerWorker) {
            this.timerWorker = new Worker(new URL('./scheduler.worker.ts', import.meta.url));
            this.timerWorker.onmessage = (e) => {
                if (e.data === 'tick') {
                    this.tick(clips, tracks);
                }
            };
        }

        // Configure interval
        this.timerWorker.postMessage({ interval: this.config.scheduleInterval });
        this.timerWorker.postMessage('start');
    }

    private tick(clips: AudioClip[], tracks: AudioTrack[]): void {
        if (!this.isPlaying) return;

        const ctx = audioContextManager.getContext();
        if (!ctx) return;

        // ─── DRIFT PREVENTION ───
        // Use AudioContext as the master clock. 
        // Calculate the "Expected Beat" based on elapsed real time.
        const elapsedSeconds = ctx.currentTime - this.startTime;
        const expectedBeat = this.secondsToBeats(elapsedSeconds);
        
        // Sync the internal state
        this.currentTime = expectedBeat;

        // ─── LOOKAHEAD SCHEDULING ───
        this.scheduleClips(clips, tracks, this.currentTime);

        // ─── CLEANUP ───
        this.cleanupFinishedClips();

        // ─── UI SYNC EVENT ───
        this.emitEvent({
            type: 'transportTick',
            beat: this.currentTime,
            time: ctx.currentTime
        });
    }

    private cleanupFinishedClips(): void {
        const ctx = audioContextManager.getContext();
        if (!ctx) return;

        const currentTime = ctx.currentTime;
        const finishedClips: string[] = [];

        for (const [clipId, scheduledClip] of Array.from(this.scheduledClips.entries())) {
            if (scheduledClip.endTime <= currentTime) {
                finishedClips.push(clipId);
            }
        }

        // Remove finished clips
        finishedClips.forEach(clipId => {
            const scheduledClip = this.scheduledClips.get(clipId);
            if (scheduledClip) {
                this.activeSources.delete(scheduledClip.source);
                this.scheduledClips.delete(clipId);
            }
        });
    }

    // ── Timing Utilities ────────────────────────────────────────────────────────

    private getSchedulingWindow(ctx: AudioContext): SchedulingWindow {
        const currentTime = ctx.currentTime;
        const lookaheadSeconds = this.config.lookaheadTime / 1000;
        const elapsedSeconds = currentTime - this.startTime;
        
        return {
            currentTime,
            windowStart: this.secondsToBeats(elapsedSeconds),
            windowEnd: this.secondsToBeats(elapsedSeconds + lookaheadSeconds),
            lookaheadMs: this.config.lookaheadTime
        };
    }

    private beatsToSeconds(beats: number): number {
        return (beats / this.tempo) * 60;
    }

    private secondsToBeats(seconds: number): number {
        return (seconds / 60) * this.tempo;
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
                console.error('[Scheduler] Event listener error:', error);
            }
        });
    }

    // ── Public Accessors ─────────────────────────────────────────────────────────

    isCurrentlyPlaying(): boolean {
        return this.isPlaying;
    }

    getCurrentBeat(): number {
        return this.currentTime;
    }

    getTempo(): number {
        return this.tempo;
    }

    setTempo(tempo: number): void {
        if (this.tempo === tempo) return;

        const oldTempo = this.tempo;
        this.tempo = tempo;

        if (this.isPlaying) {
            const ctx = audioContextManager.getContext();
            if (ctx) {
                this.startTime = ctx.currentTime - this.beatsToSeconds(this.currentTime);
                // Stop sources with a small scheduled delay to let any pending ramp finish
                const stopTime = ctx.currentTime + 0.01;
                this.activeSources.forEach(source => {
                    try { source.stop(stopTime); } catch { }
                });
                this.activeSources.clear();
                this.scheduledClips.clear();
            }
            // Immediately reschedule from current position with new tempo
            const clips = Array.from(this.clipsCache ?? []);
            const tracks = Array.from(this.tracksCache ?? []);
            if (clips.length > 0) {
                this.scheduleClips(clips, tracks, this.currentTime);
            }
        }

        console.log('[Scheduler] Tempo changed:', { oldTempo, newTempo: tempo });
    }

    getTimeSignature(): [number, number] {
        return this.timeSignature;
    }

    setTimeSignature(numerator: number, denominator: number): void {
        this.timeSignature = [numerator, denominator];
        console.log('[Scheduler] Time signature changed:', { numerator, denominator });
    }

    getActiveClips(): ScheduledClip[] {
        return Array.from(this.scheduledClips.values());
    }

    getPerformanceMetrics(): { activeSources: number; scheduledClips: number } {
        return {
            activeSources: this.activeSources.size,
            scheduledClips: this.scheduledClips.size
        };
    }

    // ── Advanced Features ───────────────────────────────────────────────────────

    /**
     * Apply time stretching to a clip.
     */
    setTimeStretch(clipId: string, params: TimeStretchParams): void {
        const scheduledClip = this.scheduledClips.get(clipId);
        if (scheduledClip && this.config.enableTimeStretch) {
            // Note: playbackRate is read-only after source.start()
            // This would need to be handled by recreating the source
            console.log('[Scheduler] Time stretch requested:', { clipId, params });
            console.warn('[Scheduler] Time stretching requires source recreation');
        }
    }

    /**
     * Apply pitch shifting to a clip.
     */
    setPitchShift(clipId: string, params: PitchShiftParams): void {
        const scheduledClip = this.scheduledClips.get(clipId);
        if (scheduledClip && this.config.enablePitchShift) {
            // Note: detune is read-only after source.start()
            // This would need to be handled by recreating the source
            console.log('[Scheduler] Pitch shift requested:', { clipId, params });
            console.warn('[Scheduler] Pitch shifting requires source recreation');
        }
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────────

    dispose(): void {
        this.stopPlayback();
        this.eventListeners = [];
        console.log('[Scheduler] Disposed');
    }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────────

export const advancedScheduler = new AdvancedScheduler();

// ─── Convenience Exports ─────────────────────────────────────────────────────────

export const startPlayback = (clips: AudioClip[], tracks: AudioTrack[], startBeat?: number, tempo?: number) =>
    advancedScheduler.startPlayback(clips, tracks, startBeat, tempo);

export const stopPlayback = () => advancedScheduler.stopPlayback();
export const stopPlaybackAndReset = () => advancedScheduler.stopPlaybackAndReset();
export const seekTo = (beat: number) => advancedScheduler.seekTo(beat);
export const setTempo = (tempo: number) => advancedScheduler.setTempo(tempo);
