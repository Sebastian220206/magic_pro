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
import {
    collectMidiNoteEvents,
    type MidiSink,
    type SequencerClip,
} from './midiSequencer';
import { TempoMap, type TempoPoint } from './tempoMap';
import { flexCacheKey, isFlexActive, renderFlexBuffer, type FlexSettings } from './flexRender';
import { resolveClipsForPlayback, type ResolvableClip } from './takeResolver';

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

/**
 * Where a clip sits on the timeline, in beats.
 *
 * Clips carry their position as `startBeat`, `start`, or both, depending on
 * which part of the app made them — the MIDI sequencer already reads them the
 * same way. Reading only `startBeat` meant a recorded audio clip, which has
 * `start`, produced `undefined + duration = NaN`; the window test compared NaN
 * and came out false, so every take was filtered out before it could be
 * scheduled and a recording played back silently.
 */
export function clipStartBeatOf(clip: { startBeat?: number; start?: number }): number {
    if (Number.isFinite(clip.startBeat as number)) return clip.startBeat as number;
    if (Number.isFinite(clip.start as number)) return clip.start as number;
    return 0;
}

class AdvancedScheduler {
    private config: SchedulerConfig;
    private isPlaying: boolean = false;
    private startTime: number = 0;
    private pauseTime: number = 0;
    private currentTime: number = 0;
    private tempo: number = 120;
    /**
     * The project's tempo track. A single-point map is equivalent to the old
     * scalar behaviour, so constant-tempo projects are unaffected.
     */
    private tempoMap: TempoMap = new TempoMap([{ time: 0, value: 120 }]);
    private timeSignature: [number, number] = [4, 4]; // [numerator, denominator]
    
    private scheduledClips: Map<string, ScheduledClip> = new Map();
    private activeSources: Set<AudioBufferSourceNode> = new Set();
    private eventListeners: EventListener[] = [];
    
    private timerWorker: Worker | null = null;
    private lastScheduleTime: number = 0;
    private timingCorrection: number = 0;
    private clipsCache: AudioClip[] = [];
    private tracksCache: AudioTrack[] = [];

    /** Main-thread timer used when a Worker cannot be created. */
    private fallbackTimer: ReturnType<typeof setInterval> | null = null;
    /** Blob URL backing the timer worker; revoked on dispose. */
    private timerWorkerUrl: string | null = null;

    /** Sound generator for sequenced MIDI. Installed by AudioEngineAdapter. */
    private midiSink: MidiSink | null = null;
    /** Notes already handed to the sink, so overlapping windows don't re-fire them. */
    private scheduledNoteKeys: Set<string> = new Set();

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
            this.scheduledNoteKeys.clear();

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
        this.stopSchedulingLoop();

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
        this.resetMidiScheduling();

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
        // Note times were derived from the old playhead mapping — discard them
        // and silence anything sounding, or held notes would ring through the seek.
        this.resetMidiScheduling();

        this.emitEvent({
            type: 'seek',
            beat
        });

        console.log('[Scheduler] Seeked to beat:', beat);
    }

    // ── Scheduling Logic ────────────────────────────────────────────────────────

    /**
     * Whether a track should be heard, given live mute/solo state.
     */
    private isTrackAudible(trackId: string): boolean {
        const trackNodes = (routingEngine as any).trackNodes?.get(trackId);
        const isMuted = trackNodes?.isMuted ?? false;
        const isSoloed = trackNodes?.isSoloed ?? false;
        const anySolo = ((routingEngine as any).soloedTracks?.size ?? 0) > 0;
        return !isMuted && !(anySolo && !isSoloed);
    }

    private async scheduleClips(clips: AudioClip[], tracks: AudioTrack[], _currentBeat: number): Promise<void> {
        const ctx = audioContextManager.getContext();
        if (!ctx) return;

        const window = this.getSchedulingWindow(ctx);

        // Flatten take folders to the take (or comp) that should sound. A
        // folder carries no audio itself, so without this it plays silence.
        const playable = resolveClipsForPlayback(
            clips as unknown as ResolvableClip[],
        ) as unknown as AudioClip[];

        // MIDI is sequenced note-by-note rather than as a single buffer source,
        // so it takes a separate path from audio clips.
        this.scheduleMidiNotes(playable, tracks, window, ctx);

        // Filter clips that should be scheduled — check live routing engine state
        const clipsToSchedule = playable.filter(clip => {
            if ((clip as unknown as SequencerClip).type === 'midi') return false;
            if (!this.isTrackAudible(clip.trackId)) return false;

            // Check if clip is within scheduling window
            const clipStartBeat = clipStartBeatOf(clip);
            const clipEndBeat = clipStartBeat + (clip.duration ?? 0);

            return clipEndBeat >= window.windowStart && clipStartBeat <= window.windowEnd;
        });

        // Resolve all buffers in parallel first, then schedule synchronously
        await this.resolveBuffers(clipsToSchedule);

        // Schedule each clip synchronously
        for (const clip of clipsToSchedule) {
            this.scheduleClipSync(clip, window);
        }
    }

    /**
     * Hand every MIDI note starting in this window to the sink.
     *
     * Runs on each tick alongside audio scheduling, which is what makes MIDI
     * play for the whole length of a region instead of only at the moment the
     * transport starts.
     */
    private scheduleMidiNotes(
        clips: AudioClip[],
        tracks: AudioTrack[],
        window: SchedulingWindow,
        ctx: AudioContext,
    ): void {
        if (!this.midiSink) return;

        const trackById = new Map(tracks.map(track => [track.id, track]));

        // Track-level offsets, including any Summing stack the track sits in —
        // a summing parent applies its transpose/velocity to its children.
        type MixTrack = { transpose?: number; velocityOffset?: number; parentId?: string; stackType?: string; instrument?: string };
        const offsetsFor = (trackId: string) => {
            const track = trackById.get(trackId) as unknown as MixTrack | undefined;
            let transpose = track?.transpose ?? 0;
            if (track?.parentId) {
                const parent = trackById.get(track.parentId) as unknown as MixTrack | undefined;
                if (parent?.stackType === 'Summing') transpose += parent.transpose ?? 0;
            }
            return { transpose, instrument: track?.instrument };
        };

        const events = collectMidiNoteEvents(
            clips as unknown as SequencerClip[],
            {
                transportStartTime: this.startTime,
                currentTime: ctx.currentTime,
                windowStartBeat: window.windowStart,
                windowEndBeat: window.windowEnd,
            },
            {
                beatsToSeconds: (beats) => this.beatsToSeconds(beats),
                isTrackAudible: (trackId) => this.isTrackAudible(trackId),
                alreadyScheduled: this.scheduledNoteKeys,
                trackInstrument: (trackId) => offsetsFor(trackId).instrument,
                trackTranspose: (trackId) => offsetsFor(trackId).transpose,
            },
        );

        for (const event of events) {
            try {
                this.midiSink.scheduleNote(event);
            } catch (error) {
                console.warn('[Scheduler] MIDI sink failed to schedule note:', error);
            }
        }
    }

    /**
     * Install the sound generator used for sequenced MIDI notes.
     */
    setMidiSink(sink: MidiSink | null): void {
        this.midiSink = sink;
    }

    /**
     * Drop scheduling memory and silence anything sounding.
     *
     * Called whenever the timeline↔time mapping changes — stop, seek, tempo —
     * because every previously scheduled note time is now wrong.
     */
    private resetMidiScheduling(): void {
        this.scheduledNoteKeys.clear();
        try {
            this.midiSink?.allNotesOff();
        } catch (error) {
            console.warn('[Scheduler] MIDI sink failed to clear notes:', error);
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

        buffer = this.resolveFlexBuffer(clip, buffer, ctx);

        const clipStartBeat = clipStartBeatOf(clip);
        if (!Number.isFinite(clipStartBeat)) return;
        const clipDuration = clip.duration ?? 0;
        if (!Number.isFinite(clipDuration)) return;
        const clipStartSeconds = this.beatsToSeconds(clipStartBeat);
        // Measured across the clip's own span: a duration in beats has no fixed
        // length in seconds once the timeline has a tempo track.
        const clipDurationSeconds = this.beatSpanToSeconds(clipStartBeat, clipDuration);
        const hardwareStartTime = this.startTime + clipStartSeconds;

        let scheduledStartTime = hardwareStartTime;
        let playheadOffsetSeconds = 0;

        if (hardwareStartTime < window.currentTime) {
            scheduledStartTime = window.currentTime;
            playheadOffsetSeconds = window.currentTime - hardwareStartTime;
        }

        const remainingDurationSeconds = clipDurationSeconds - playheadOffsetSeconds;
        if (remainingDurationSeconds <= 0) return;

        const baseClipOffsetSeconds = (clip as any).offset
            ? this.beatSpanToSeconds(clipStartBeat, (clip as any).offset)
            : 0;
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

    /**
     * Build the off-thread tick timer.
     *
     * The worker source is inlined and loaded from a Blob URL rather than
     * referenced as a module file. The previous implementation used
     * `new Function('return new URL("./scheduler.worker.ts", import.meta.url)')`,
     * which throws a SyntaxError in every environment — `import.meta` is not
     * valid inside a Function constructor body — so worker creation always
     * failed silently and the scheduling loop never ran at all.
     *
     * A worker is used rather than a plain interval because background tabs
     * throttle main-thread timers to ~1s, which would starve the scheduler.
     */
    /**
     * Substitute a flex-processed buffer when the clip asks for time or pitch
     * flexing. Results are cached, since WSOLA is far too slow to run inside
     * the scheduling loop on every pass.
     */
    private resolveFlexBuffer(clip: AudioClip, buffer: AudioBuffer, ctx: BaseAudioContext): AudioBuffer {
        const settings = clip as unknown as FlexSettings;
        if (!isFlexActive(settings)) return buffer;

        const key = flexCacheKey(clip.id, settings);
        const cached = bufferCacheManager.getBuffer(key);
        if (cached) return cached;

        try {
            const processed = renderFlexBuffer(buffer, settings, (channels, length, sampleRate) =>
                ctx.createBuffer(channels, length, sampleRate));
            if (processed !== buffer) bufferCacheManager.addBuffer(key, processed);
            return processed;
        } catch (error) {
            console.warn('[Scheduler] Flex processing failed, using dry audio:', error);
            return buffer;
        }
    }

    private createTimerWorker(): Worker | null {
        if (typeof Worker === 'undefined' || typeof Blob === 'undefined') return null;
        if (typeof URL === 'undefined' || !URL.createObjectURL) return null;

        const source = `
            let timerId = null;
            let interval = 25;
            function restart() {
                if (timerId) clearInterval(timerId);
                timerId = setInterval(function () { self.postMessage('tick'); }, interval);
            }
            self.onmessage = function (e) {
                if (e.data === 'start') {
                    restart();
                } else if (e.data === 'stop') {
                    if (timerId) clearInterval(timerId);
                    timerId = null;
                } else if (e.data && typeof e.data.interval === 'number') {
                    interval = e.data.interval;
                    if (timerId) restart();
                }
            };
        `;

        try {
            const blob = new Blob([source], { type: 'application/javascript' });
            this.timerWorkerUrl = URL.createObjectURL(blob);
            return new Worker(this.timerWorkerUrl);
        } catch (error) {
            console.warn('[Scheduler] Timer worker unavailable, using main-thread timer:', error);
            return null;
        }
    }

    private startSchedulingLoop(_clips: AudioClip[], _tracks: AudioTrack[]): void {
        // Each tick reads clipsCache/tracksCache rather than closing over the
        // arguments: the worker is reused across playbacks, so a captured list
        // would go stale as soon as the project changed.
        const runTick = () => this.tick(this.clipsCache, this.tracksCache);

        if (!this.timerWorker && !this.fallbackTimer) {
            this.timerWorker = this.createTimerWorker();

            if (this.timerWorker) {
                this.timerWorker.onmessage = (e) => {
                    if (e.data === 'tick') runTick();
                };
            } else {
                // No worker available (SSR, or a browser that blocks Blob
                // workers). A main-thread interval still keeps the transport
                // running; it is only less resilient to jank.
                this.fallbackTimer = setInterval(runTick, this.config.scheduleInterval);
                return;
            }
        }

        if (this.timerWorker) {
            this.timerWorker.postMessage({ interval: this.config.scheduleInterval });
            this.timerWorker.postMessage('start');
        }
    }

    private stopSchedulingLoop(): void {
        if (this.timerWorker) {
            this.timerWorker.postMessage('stop');
        }
        if (this.fallbackTimer) {
            clearInterval(this.fallbackTimer);
            this.fallbackTimer = null;
        }
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

    /**
     * Seconds occupied by `beats` starting at `fromBeat`.
     *
     * A duration in beats does not have a fixed length in seconds once a tempo
     * track exists — it depends where on the timeline it sits. Converting a
     * duration with `beatsToSeconds` alone (which measures from beat 0) is only
     * correct at constant tempo.
     */
    private beatSpanToSeconds(fromBeat: number, beats: number): number {
        if (!Number.isFinite(beats) || beats <= 0) return 0;
        return this.tempoMap.beatToSeconds(fromBeat + beats) - this.tempoMap.beatToSeconds(fromBeat);
    }

    /** Seconds from beat 0 to `beat`, honouring the tempo track. */
    private beatsToSeconds(beats: number): number {
        return this.tempoMap.beatToSeconds(beats);
    }

    /** Beat reached `seconds` after beat 0, honouring the tempo track. */
    private secondsToBeats(seconds: number): number {
        return this.tempoMap.secondsToBeat(seconds);
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

    getPreciseCurrentBeat(): number {
        if (!this.isPlaying) return this.currentTime;
        const ctx = audioContextManager.getContext();
        if (!ctx) return this.currentTime;
        const elapsedSeconds = ctx.currentTime - this.startTime;
        return this.secondsToBeats(elapsedSeconds);
    }

    /** Instantaneous tempo at the current playhead. */
    getTempo(): number {
        return this.tempoMap.tempoAt(this.currentTime);
    }

    /** The tempo track currently driving scheduling. */
    getTempoMap(): TempoMap {
        return this.tempoMap;
    }

    /**
     * Install the project's tempo track.
     *
     * Every previously scheduled start time was derived from the old beat→time
     * mapping, so playback is re-anchored at the current beat and rescheduled.
     */
    setTempoMap(points: TempoPoint[]): void {
        const next = new TempoMap(points);
        const current = this.tempoMap.getPoints();
        const candidate = next.getPoints();

        const unchanged =
            current.length === candidate.length &&
            current.every((p, i) =>
                p.time === candidate[i].time &&
                p.value === candidate[i].value &&
                p.type === candidate[i].type);
        if (unchanged) return;

        this.tempoMap = next;
        this.tempo = next.tempoAt(this.currentTime);
        this.reanchorAndReschedule();
    }

    setTempo(tempo: number): void {
        if (this.tempoMap.isConstant() && this.tempo === tempo) return;

        const oldTempo = this.tempo;
        this.tempo = tempo;
        // A scalar tempo collapses the track to a single constant point.
        this.tempoMap = new TempoMap([{ time: 0, value: tempo }]);
        this.reanchorAndReschedule();

        console.log('[Scheduler] Tempo changed:', { oldTempo, newTempo: tempo });
    }

    /**
     * Re-pin the transport to the current beat under a changed beat→time
     * mapping, then rebuild the schedule.
     *
     * Every already-scheduled source and note carries an absolute time derived
     * from the previous mapping, so all of it has to be discarded rather than
     * left to fire at now-wrong moments.
     */
    private reanchorAndReschedule(): void {
        if (!this.isPlaying) return;

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
            this.resetMidiScheduling();
        }

        if (this.clipsCache.length > 0) {
            this.scheduleClips(this.clipsCache, this.tracksCache, this.currentTime);
        }
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

        if (this.timerWorker) {
            this.timerWorker.terminate();
            this.timerWorker = null;
        }
        if (this.timerWorkerUrl) {
            URL.revokeObjectURL(this.timerWorkerUrl);
            this.timerWorkerUrl = null;
        }

        this.midiSink = null;
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
