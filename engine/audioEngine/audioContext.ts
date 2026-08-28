/**
 * audioContext.ts
 * AudioContext management and singleton pattern for the DAW.
 * 
 * Handles:
 * - AudioContext creation and initialization
 * - Sample rate management
 * - Device enumeration
 * - State management (suspended/running)
 * - Performance monitoring
 */

import { AudioEngineConfig, InputDevice, PerformanceMetrics, AudioEngineEvent, EventListener } from './types';
import { resolveDevice } from '@/lib/resolveDevice';

// ─── Audio Context Manager ────────────────────────────────────────────────────────────

class AudioContextManager {
    private ctx: AudioContext | null = null;
    /**
     * The output the user chose, whether or not a context existed at the time.
     * Re-applied every time a context is created.
     */
    private desiredSinkId: string | null = null;
    /**
     * What that output was called. Device ids rotate; labels do not, so this is
     * what finds the same headphones again after the id stops resolving.
     */
    private desiredSinkLabel: string | null = null;
    private config: AudioEngineConfig;
    private eventListeners: EventListener[] = [];
    private performanceMetrics: PerformanceMetrics;
    private monitoringInterval: NodeJS.Timeout | null = null;

    constructor(config: Partial<AudioEngineConfig> = {}) {
        this.config = {
            sampleRate: 44100,
            bufferSize: 512,
            lookaheadTime: 50,
            maxLatency: 100,
            ...config
        };

        this.performanceMetrics = {
            schedulingLatency: 0,
            bufferHitRate: 0,
            cpuUsage: 0,
            memoryUsage: 0,
            activeSources: 0,
            droppedFrames: 0
        };
    }

    // ── Context Management ────────────────────────────────────────────────────────

    /**
     * Initialize AudioContext with user gesture requirement.
     */
    async initialize(): Promise<AudioContext> {
        if (this.ctx) {
            return this.ctx!;
        }

        try {
            // Create AudioContext with optimal settings
            const AudioContextCtor = 
                (window as any).webkitAudioContext || AudioContext;
            
            this.ctx = new AudioContextCtor({
                sampleRate: this.config.sampleRate,
                latencyHint: 'interactive'
            });

            // iOS Safari requires a user gesture to resume — handle it once globally
            this.attachResumeListener();

            // Wait for context to be ready
            if (this.ctx?.state === 'suspended') {
                await this.resumeContext();
            }

            // Whatever output was chosen in Settings, including on a previous
            // visit — the context is new, so its sink is the system default
            // until this runs.
            await this.applyDesiredSink();

            // Start performance monitoring
            this.startPerformanceMonitoring();

            this.emitEvent({
                type: 'playbackStarted',
                time: this.ctx!.currentTime
            });

            console.log('[AudioContext] Initialized successfully', {
                sampleRate: this.ctx!.sampleRate,
                state: this.ctx!.state,
                bufferSize: this.ctx!.baseLatency
            });

            return this.ctx!;
        } catch (error) {
            this.emitEvent({
                type: 'error',
                error: `Failed to initialize AudioContext: ${error}`,
                context: 'audioContext.initialize'
            });
            throw error;
        }
    }
    
    /**
     * Load an AudioWorklet module safely.
     */
    async loadWorklet(name: string, url: string): Promise<void> {
        if (!this.ctx) await this.initialize();
        try {
            await this.ctx!.audioWorklet.addModule(url);
            console.log(`[AudioContext] Worklet loaded: ${name}`);
        } catch (error) {
            console.error(`[AudioContext] Failed to load worklet ${name}:`, error);
            throw error;
        }
    }

    private attachResumeListener() {
        if (!this.ctx) return;
        const resume = async () => {
            if (this.ctx && this.ctx.state === 'suspended') {
                await this.ctx.resume();
            }
            document.removeEventListener('click', resume);
            document.removeEventListener('keydown', resume);
            document.removeEventListener('touchstart', resume);
        };
        document.addEventListener('click', resume);
        document.addEventListener('keydown', resume);
        document.addEventListener('touchstart', resume);
    }


    /**
     * Resume AudioContext (requires user gesture).
     */
    async resumeContext(): Promise<void> {
        if (!this.ctx) return;

        try {
            await this.ctx.resume();
            console.log('[AudioContext] Resumed successfully');
        } catch (error) {
            this.emitEvent({
                type: 'error',
                error: `Failed to resume AudioContext: ${error}`,
                context: 'audioContext.resume'
            });
            throw error;
        }
    }

    /**
     * Suspend AudioContext to save CPU.
     */
    suspendContext(): void {
        if (!this.ctx || this.ctx.state === 'suspended') return;

        this.ctx.suspend();
        console.log('[AudioContext] Suspended');
    }

    // ── Device Management ────────────────────────────────────────────────────────

    /**
     * Send the whole mix to a chosen output.
     *
     * The Devices panel has offered an Output Device for a while and nothing
     * read the setting, so choosing one changed a label and left the audio
     * where it was. `setSinkId` on the AudioContext is the mechanism; it is
     * recent enough that a browser without it has to be reported rather than
     * silently ignored.
     */
    async setOutputDevice(deviceId: string, label?: string): Promise<{ ok: boolean; reason?: string }> {
        /*
         * Remember it first, apply it second.
         *
         * This used to give up when the context did not exist yet — and the
         * context is created lazily, on the first user gesture that makes
         * sound. Opening Settings before pressing play is the ordinary way to
         * choose an output, and in that order the choice was refused with "the
         * audio engine has not started yet" and never applied afterwards. The
         * setting was stored, the dropdown showed the right device, and the
         * audio went to the system default.
         *
         * It was also never re-applied on load, so even a choice that did take
         * effect was lost on the next reload.
         */
        this.desiredSinkId = deviceId;
        if (label !== undefined) this.desiredSinkLabel = label;

        const ctx = this.ctx as (AudioContext & { setSinkId?: (id: string) => Promise<void> }) | null;
        if (!ctx) return { ok: true, reason: 'Will apply when the audio engine starts' };
        if (typeof ctx.setSinkId !== 'function') {
            return { ok: false, reason: 'This browser cannot choose an audio output' };
        }

        /*
         * One path, so both get the recovery.
         *
         * This used to call `setSinkId` inline, which meant a device whose id
         * had rotated failed here with "device not found" and was never looked
         * up by name — the recovery existed only on the startup path, and the
         * context is usually already built by the time settings load.
         */
        this.lastSinkNote = null;
        await this.applyDesiredSink();
        return this.lastSinkNote ? { ok: false, reason: this.lastSinkNote } : { ok: true };
    }

    /** Send the mix to whichever output was last asked for. */
    private async applyDesiredSink(): Promise<void> {
        if (!this.desiredSinkId || this.desiredSinkId === 'None') return;
        const ctx = this.ctx as (AudioContext & { setSinkId?: (id: string) => Promise<void> }) | null;
        if (!ctx || typeof ctx.setSinkId !== 'function') return;

        if (this.desiredSinkId === 'default') {
            try { await ctx.setSinkId(''); } catch { /* the default is already the default */ }
            return;
        }

        try {
            await ctx.setSinkId(this.desiredSinkId);
            console.log('[AudioContext] Output routed to', this.desiredSinkId);
            return;
        } catch {
            // Falls through to the label lookup below. `setSinkId` answers
            // "the device … is not found" for an id whose salt has rotated,
            // which is routine rather than exceptional.
        }

        const recovered = await this.findSinkByLabel();
        if (!recovered) {
            console.warn('[AudioContext] The chosen output is gone; using the system default.');
            this.lastSinkNote = 'The audio output chosen in Settings is not available. Using the system default.';
            return;
        }

        try {
            await ctx.setSinkId(recovered.deviceId);
            // Write the new id back so the next load resolves first time.
            this.desiredSinkId = recovered.deviceId;
            this.lastSinkNote = null;
            console.log('[AudioContext] Output re-found by name:', recovered.label);
        } catch (error) {
            console.warn('[AudioContext] Could not route to the chosen output; using the default.', error);
            this.lastSinkNote = 'The audio output chosen in Settings is not available. Using the system default.';
        }
    }

    /** The same output, under whatever id it has now. */
    private async findSinkByLabel(): Promise<{ deviceId: string; label: string } | null> {
        if (!this.desiredSinkLabel) return null;
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const match = resolveDevice(devices, 'audiooutput', {
                deviceId: this.desiredSinkId,
                label: this.desiredSinkLabel,
            });
            return match && match.recovered ? { deviceId: match.deviceId, label: match.label } : null;
        } catch {
            return null;
        }
    }

    /** Set when the chosen output could not be used and the default was. */
    private lastSinkNote: string | null = null;

    /** Why the output is not what was asked for, if it is not. */
    getOutputNote(): string | null { return this.lastSinkNote; }

    /** The id the mix is actually going to, after any recovery by name. */
    getResolvedSinkId(): string | null { return this.desiredSinkId; }

    /** Whether this browser can route audio to a chosen output at all. */
    canChooseOutput(): boolean {
        const ctx = this.ctx as (AudioContext & { setSinkId?: unknown }) | null;
        return typeof ctx?.setSinkId === 'function';
    }

    /**
     * Get available audio input devices.
     */
    async getInputDevices(): Promise<InputDevice[]> {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices
                .filter(device => device.kind === 'audioinput')
                .map(device => ({
                    deviceId: device.deviceId,
                    label: device.label || `Input ${device.deviceId.slice(0, 4)}`,
                    kind: device.kind,
                    capabilities: {} as MediaTrackCapabilities
                }));
        } catch (error) {
            this.emitEvent({
                type: 'error',
                error: `Failed to enumerate input devices: ${error}`,
                context: 'audioContext.getInputDevices'
            });
            return [];
        }
    }

    /**
     * Get available audio output devices.
     */
    async getOutputDevices(): Promise<InputDevice[]> {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices
                .filter(device => device.kind === 'audiooutput')
                .map(device => ({
                    deviceId: device.deviceId,
                    label: device.label || `Output ${device.deviceId.slice(0, 4)}`,
                    kind: device.kind,
                    capabilities: {} as MediaTrackCapabilities
                }));
        } catch (error) {
            this.emitEvent({
                type: 'error',
                error: `Failed to enumerate output devices: ${error}`,
                context: 'audioContext.getOutputDevices'
            });
            return [];
        }
    }

    /**
     * Request microphone access with specific constraints.
     */
    async requestMicrophoneAccess(constraints: MediaStreamConstraints = {}): Promise<MediaStream> {
        try {
            const defaultConstraints: MediaStreamConstraints = {
                audio: {
                    sampleRate: this.config.sampleRate,
                    channelCount: 2,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    ...(constraints.audio as MediaTrackConstraints || {})
                },
                video: false
            };

            const stream = await navigator.mediaDevices.getUserMedia(defaultConstraints);
            console.log('[AudioContext] Microphone access granted', {
                deviceId: (defaultConstraints.audio as MediaTrackConstraints)?.deviceId
            });
            return stream;
        } catch (error) {
            this.emitEvent({
                type: 'error',
                error: `Microphone access denied: ${error}`,
                context: 'audioContext.requestMicrophoneAccess'
            });
            throw error;
        }
    }

    // ── Performance Monitoring ─────────────────────────────────────────────────────

    private startPerformanceMonitoring(): void {
        if (this.monitoringInterval) return;

        this.monitoringInterval = setInterval(() => {
            this.updatePerformanceMetrics();
        }, 1000); // Update every second
    }

    private updatePerformanceMetrics(): void {
        if (!this.ctx) return;

        // Estimate CPU usage (simplified)
        const currentTime = this.ctx.currentTime;
        const estimatedCpuUsage = Math.min(1, this.performanceMetrics.activeSources * 0.1);

        // Update metrics
        this.performanceMetrics = {
            schedulingLatency: this.config.lookaheadTime,
            bufferHitRate: this.performanceMetrics.bufferHitRate,
            cpuUsage: estimatedCpuUsage,
            memoryUsage: this.estimateMemoryUsage(),
            activeSources: this.performanceMetrics.activeSources,
            droppedFrames: this.performanceMetrics.droppedFrames
        };
    }

    private estimateMemoryUsage(): number {
        // Rough estimation based on active sources and buffers
        const sourceSize = this.performanceMetrics.activeSources * 1024; // ~1KB per source
        const bufferSize = 100 * 1024 * 1024; // ~100MB for buffers
        return (sourceSize + bufferSize) / (1024 * 1024); // Convert to MB
    }

    // ── Event System ───────────────────────────────────────────────────────────────

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
                console.error('[AudioContext] Event listener error:', error);
            }
        });
    }

    // ── Public Accessors ─────────────────────────────────────────────────────────

    getContext(): AudioContext | null {
        return this.ctx;
    }

    getSampleRate(): number {
        return this.ctx?.sampleRate ?? this.config.sampleRate;
    }

    getCurrentTime(): number {
        return this.ctx?.currentTime ?? 0;
    }

    getState(): AudioContextState | 'uninitialized' {
        return this.ctx?.state ?? 'uninitialized';
    }

    getPerformanceMetrics(): PerformanceMetrics {
        return { ...this.performanceMetrics };
    }

    getConfig(): AudioEngineConfig {
        return { ...this.config };
    }

    updateConfig(newConfig: Partial<AudioEngineConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log('[AudioContext] Config updated:', this.config);
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────────

    dispose(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        if (this.ctx && this.ctx.state !== 'closed') {
            this.ctx.close();
            this.ctx = null;
        }

        this.eventListeners = [];
        console.log('[AudioContext] Disposed');
    }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────────

export const audioContextManager = new AudioContextManager();

/*
 * The same handle the store and the recorder expose.
 *
 * Where the mix is actually going is invisible from the outside — a sink set
 * to the wrong device and a muted graph sound identical — so `sinkId` needs to
 * be readable from the console and from a probe.
 */
if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__audioContextManager = audioContextManager;
}

// ─── Convenience Exports ─────────────────────────────────────────────────────────

export const getAudioContext = () => audioContextManager.getContext();
export const getCurrentTime = () => audioContextManager.getCurrentTime();
export const getSampleRate = () => audioContextManager.getSampleRate();
export const initializeAudio = () => audioContextManager.initialize();
export const resumeAudio = () => audioContextManager.resumeContext();
