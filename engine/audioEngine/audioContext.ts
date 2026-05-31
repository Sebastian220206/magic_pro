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

// ─── Audio Context Manager ────────────────────────────────────────────────────────────

class AudioContextManager {
    private ctx: AudioContext | null = null;
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

// ─── Convenience Exports ─────────────────────────────────────────────────────────

export const getAudioContext = () => audioContextManager.getContext();
export const getCurrentTime = () => audioContextManager.getCurrentTime();
export const getSampleRate = () => audioContextManager.getSampleRate();
export const initializeAudio = () => audioContextManager.initialize();
export const resumeAudio = () => audioContextManager.resumeContext();
