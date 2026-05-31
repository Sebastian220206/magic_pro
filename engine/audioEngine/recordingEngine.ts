/**
 * recordingEngine.ts
 * Audio recording engine with microphone capture and buffer management.
 * 
 * Features:
 * - getUserMedia microphone access
 * - Real-time AudioBuffer storage
 * - Input monitoring with latency compensation
 * - Automatic clip creation from recordings
 */

import { 
    RecordingConfig, 
    RecordingSession, 
    InputDevice, 
    AudioEngineEvent, 
    EventListener,
    AudioClip 
} from './types';
import { audioContextManager } from './audioContext';

// ─── Recording Engine ──────────────────────────────────────────────────────────────

class RecordingEngine {
    private isRecording: boolean = false;
    private currentSession: RecordingSession | null = null;
    private mediaStream: MediaStream | null = null;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private monitoringGain: GainNode | null = null;
    private eventListeners: EventListener[] = [];
    private deviceChangeUnsubscribe: (() => void) | null = null;
    
    private recordingBuffers: number[][] = [];
    private bufferWriteIndex: number = 0;
    private sampleRate: number = 48000;
    private channels: number = 2;

    constructor() {
        console.log('[RecordingEngine] Initialized');
    }

    // ── Device Management ────────────────────────────────────────────────────────

    /**
     * Get available input devices.
     */
    async getInputDevices(): Promise<InputDevice[]> {
        return audioContextManager.getInputDevices();
    }

    /**
     * Request microphone access with specific configuration.
     */
    async requestMicrophoneAccess(config: RecordingConfig = {} as RecordingConfig): Promise<MediaStream> {
        try {
            const stream = await audioContextManager.requestMicrophoneAccess({
                audio: {
                    sampleRate: config.sampleRate || this.sampleRate,
                    channelCount: config.channels || this.channels,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                },
                video: false
            } as MediaStreamConstraints);

            this.mediaStream = stream;
            console.log('[RecordingEngine] Microphone access granted');
            return stream;
        } catch (error) {
            this.emitEvent({
                type: 'error',
                error: `Failed to access microphone: ${error}`,
                context: 'recordingEngine.requestMicrophoneAccess'
            });
            throw error;
        }
    }

    // ── Recording Control ────────────────────────────────────────────────────────

    /**
     * Start recording with specified configuration.
     */
    async startRecording(config: RecordingConfig, trackId: string): Promise<RecordingSession> {
        if (this.isRecording) {
            throw new Error('Recording already in progress');
        }

        try {
            const ctx = audioContextManager.getContext();
            if (!ctx) {
                await audioContextManager.initialize();
            }

            // Request microphone access
            const stream = await this.requestMicrophoneAccess(config);
            
            // Load and initialize recording worklet
            await audioContextManager.loadWorklet('recording-processor', new URL('./recording.processor.ts', import.meta.url).toString());

            // Create audio nodes
            this.sourceNode = ctx!.createMediaStreamSource(stream);
            this.workletNode = new AudioWorkletNode(ctx!, 'recording-processor', {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                outputChannelCount: [this.channels]
            });
            this.monitoringGain = ctx!.createGain();

            // Setup recording buffers
            this.setupRecordingBuffers(config);

            // Connect nodes
            this.sourceNode.connect(this.workletNode);
            this.workletNode.connect(this.monitoringGain);
            
            if (config.monitorInput) {
                import('./routingEngine').then(({ routingEngine }) => {
                    const trackChain = (routingEngine as any).trackNodes.get(trackId);
                    if (trackChain) {
                        this.monitoringGain!.connect(trackChain.inputGain);
                    } else {
                        console.warn('[RecordingEngine] No track chain for monitoring, skipping monitor routing.');
                    }
                });
                this.monitoringGain.gain.value = 0.5;
            }

            // Monitor device changes during recording for stability
            this.setupDeviceMonitoring();

            // Create recording session with transport timing
            const sessionId = `recording-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const session: RecordingSession = {
                id: sessionId,
                startTime: ctx!.currentTime,
                duration: 0,
                trackId,
                buffer: this.createEmptyBuffer(),
                config,
                startBeat: config.startBeat ?? 0,
                bpm: config.bpm ?? 120,
            };

            this.currentSession = session;
            this.isRecording = true;

            // Setup worklet callback
            this.workletNode.port.onmessage = (event) => {
                if (event.data.type === 'data') {
                    this.handleWorkletData(event.data);
                }
            };


            this.emitEvent({
                type: 'recordingStarted',
                sessionId,
                trackId
            });

            console.log('[RecordingEngine] Recording started', {
                sessionId,
                trackId,
                config
            });

            return session;

        } catch (error) {
            this.emitEvent({
                type: 'error',
                error: `Failed to start recording: ${error}`,
                context: 'recordingEngine.startRecording'
            });
            throw error;
        }
    }

    /**
     * Stop recording and create AudioBuffer.
     */
    async stopRecording(): Promise<AudioClip | null> {
        if (!this.isRecording || !this.currentSession) {
            return null;
        }

        try {
            this.isRecording = false;
            const session = this.currentSession;

            // Calculate final duration
            const ctx = audioContextManager.getContext();
            const endTime = ctx!.currentTime;
            const durationSeconds = endTime - session.startTime;

            // Create final AudioBuffer
            const finalBuffer = this.createFinalBuffer();

            // Update session
            session.duration = durationSeconds;
            session.buffer = finalBuffer;

            // Calculate hardware latency compensation
            const latencyOffset = (ctx!.baseLatency ?? 0) + (ctx!.outputLatency ?? 0);
            const latencyBeats = this.secondsToBeats(latencyOffset, session.bpm);

            // Clamp clip start to transport beat minus latency compensation
            const clipStartBeat = Math.max(0, session.startBeat - latencyBeats);
            const durationBeats = this.secondsToBeats(durationSeconds, session.bpm);

            const clip: AudioClip = {
                id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: `Recording ${new Date().toLocaleTimeString()}`,
                startBeat: clipStartBeat,
                duration: durationBeats,
                trackId: session.trackId,
                pitchShift: 0,
                timeStretch: 1,
                volume: 1,
                pan: 0,
                muted: false,
                loop: false,
                buffer: finalBuffer
            };

            // Cleanup nodes before returning
            this.cleanupNodes();

            this.emitEvent({
                type: 'recordingStopped',
                sessionId: session.id,
                duration: durationSeconds,
                latencyOffset
            });

            console.log('[RecordingEngine] Recording stopped', {
                sessionId: session.id,
                startBeat: clipStartBeat,
                duration: durationBeats,
                latencyOffset,
                bufferSize: finalBuffer.length
            });

            // Reset state
            this.currentSession = null;
            this.recordingBuffers = [];
            this.bufferWriteIndex = 0;

            return clip;

        } catch (error) {
            this.emitEvent({
                type: 'error',
                error: `Failed to stop recording: ${error}`,
                context: 'recordingEngine.stopRecording'
            });
            return null;
        }
    }

    /**
     * Cancel recording without creating a clip.
     */
    cancelRecording(): void {
        if (!this.isRecording) return;

        this.isRecording = false;
        this.cleanupNodes();

        if (this.currentSession) {
            this.emitEvent({
                type: 'recordingStopped',
                sessionId: this.currentSession.id,
                duration: 0
            });
        }

        this.currentSession = null;
        this.recordingBuffers = [];
        this.bufferWriteIndex = 0;

        console.log('[RecordingEngine] Recording cancelled');
    }

    // ── Audio Processing ────────────────────────────────────────────────────────

    private setupRecordingBuffers(config: RecordingConfig): void {
        this.channels = config.channels || 2;
        this.sampleRate = config.sampleRate || 48000;
        
        // Initialize buffers for each channel
        this.recordingBuffers = [];
        for (let channel = 0; channel < this.channels; channel++) {
            this.recordingBuffers[channel] = [];
        }
        
        this.bufferWriteIndex = 0;
        console.log('[RecordingEngine] Recording buffers initialized', {
            channels: this.channels,
            sampleRate: this.sampleRate
        });
    }

    private handleWorkletData(data: { buffers: Float32Array[], peaks: number[] }): void {
        if (!this.isRecording) return;

        // Store chunks for each channel (Buffered Writing)
        for (let channel = 0; channel < data.buffers.length; channel++) {
            if (!this.recordingBuffers[channel]) this.recordingBuffers[channel] = [];
            (this.recordingBuffers as any)[channel].push(data.buffers[channel]);
        }

        // Emit visualization data (Non-blocking Peaks)
        if (this.currentSession) {
            this.emitEvent({
                type: 'recordingData',
                sessionId: this.currentSession.id,
                peaks: data.peaks, // Send pre-calculated peaks for smooth UI
                time: audioContextManager.getCurrentTime()
            });
        }
    }

    private setupDeviceMonitoring(): void {
        const handleDeviceChange = () => {
            if (this.isRecording) {
                console.warn('[RecordingEngine] Input device change detected during recording!');
                // Logic to handle disconnection (e.g. stop recording safely)
            }
        };

        if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
            navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
            this.deviceChangeUnsubscribe = () => {
                navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
            };
        }
    }


    private createFinalBuffer(): AudioBuffer {
        const ctx = audioContextManager.getContext();
        if (!ctx) throw new Error('AudioContext not available');

        // Calculate total length from chunks
        const chunks = this.recordingBuffers[0] as unknown as Float32Array[];
        const totalSamples = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        
        const finalBuffer = ctx.createBuffer(this.channels, totalSamples, this.sampleRate);

        // Flatten chunks into the final AudioBuffer
        for (let channel = 0; channel < this.channels; channel++) {
            const channelData = finalBuffer.getChannelData(channel);
            let offset = 0;
            const channelChunks = this.recordingBuffers[channel] as unknown as Float32Array[];
            
            for (const chunk of channelChunks) {
                channelData.set(chunk, offset);
                offset += chunk.length;
            }
        }

        return finalBuffer;
    }


    private createEmptyBuffer(): AudioBuffer {
        const ctx = audioContextManager.getContext();
        if (!ctx) throw new Error('AudioContext not available');

        return ctx.createBuffer(this.channels, 4096, this.sampleRate);
    }

    private secondsToBeats(seconds: number, bpm: number = 120): number {
        return seconds * (bpm / 60);
    }

    // ── Input Monitoring ────────────────────────────────────────────────────────

    /**
     * Enable/disable input monitoring.
     */
    setMonitoringEnabled(enabled: boolean): void {
        if (this.monitoringGain) {
            if (enabled) {
                import('./routingEngine').then(({ routingEngine }) => {
                    const trackId = this.currentSession?.trackId;
                    const trackChain = trackId ? (routingEngine as any).trackNodes.get(trackId) : null;
                    if (trackChain) {
                        this.monitoringGain!.connect(trackChain.inputGain);
                    } else {
                        console.warn('[RecordingEngine] No track chain for monitoring, skipping.');
                    }
                });
            } else {
                this.monitoringGain.disconnect();
            }
            console.log('[RecordingEngine] Monitoring:', enabled ? 'enabled' : 'disabled');
        }
    }

    /**
     * Set monitoring volume (0-1).
     */
    setMonitoringVolume(volume: number): void {
        if (this.monitoringGain) {
            this.monitoringGain.gain.value = Math.max(0, Math.min(1, volume));
        }
    }

    // ── Utility Methods ────────────────────────────────────────────────────────

    private cleanupNodes(): void {
        // Disconnect and cleanup nodes
        if (this.sourceNode) {
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }

        if (this.workletNode) {
            this.workletNode.disconnect();
            this.workletNode.port.onmessage = null;
            this.workletNode = null;
        }

        if (this.monitoringGain) {
            this.monitoringGain.disconnect();
            this.monitoringGain = null;
        }

        // Stop media stream
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        // Cleanup device monitoring
        if (this.deviceChangeUnsubscribe) {
            this.deviceChangeUnsubscribe();
            this.deviceChangeUnsubscribe = null;
        }
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
                console.error('[RecordingEngine] Event listener error:', error);
            }
        });
    }

    // ── Public Accessors ─────────────────────────────────────────────────────────

    isCurrentlyRecording(): boolean {
        return this.isRecording;
    }

    getCurrentSession(): RecordingSession | null {
        return this.currentSession;
    }

    getRecordingLevels(): Float32Array | null {
        if (!this.isRecording || !this.recordingBuffers[0]) {
            return null;
        }

        // Return recent samples for level metering
        const recentSamples = 128;
        const buffer = this.recordingBuffers[0];
        const start = Math.max(0, buffer.length - recentSamples);
        
        return new Float32Array(buffer.slice(start, start + recentSamples));
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────────

    dispose(): void {
        this.cancelRecording();
        this.eventListeners = [];
        console.log('[RecordingEngine] Disposed');
    }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────────

export const recordingEngine = new RecordingEngine();

// ─── Convenience Exports ─────────────────────────────────────────────────────────

export const startRecording = (config: RecordingConfig, trackId: string) =>
    recordingEngine.startRecording(config, trackId);

export const stopRecording = () => recordingEngine.stopRecording();
export const cancelRecording = () => recordingEngine.cancelRecording();
export const setMonitoringEnabled = (enabled: boolean) => recordingEngine.setMonitoringEnabled(enabled);
