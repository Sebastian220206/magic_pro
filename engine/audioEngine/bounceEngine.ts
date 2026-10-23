/**
 * bounceEngine.ts
 * Offline rendering and export engine for project bounce.
 * 
 * Features:
 * - OfflineAudioContext rendering
 * - Whole timeline export
 * - WAV format export
 * - Real-time progress reporting
 */

import { 
    BounceConfig, 
    BounceProgress, 
    AudioEngineEvent,
    EventListener,
    AudioClip,
    AudioTrack 
} from './types';
import { audioContextManager } from './audioContext';
import { encodeMp3, type Mp3Settings } from '@/lib/mp3Encoding';

// ─── Bounce Engine Configuration ────────────────────────────────────────────────────────

interface BounceEngineConfig {
    sampleRate: number;
    bitDepth: 16 | 24 | 32;
    normalize: boolean;
    dither: boolean;
    format: 'wav' | 'mp3' | 'ogg';
    /**
     * What Audio > MP3 is set to.
     *
     * Passed in rather than read from the store so the engine stays free of it.
     * Absent means the encoder's own defaults.
     */
    mp3?: Mp3Settings;
}

const DEFAULT_BOUNCE_CONFIG: BounceEngineConfig = {
    sampleRate: 48000,
    bitDepth: 24,
    normalize: true,
    dither: true,
    format: 'wav'
};

// ─── Bounce Engine ──────────────────────────────────────────────────────────────

class BounceEngine {
    private config: BounceEngineConfig;
    private eventListeners: EventListener[] = [];
    private isBouncing: boolean = false;
    private offlineContext: OfflineAudioContext | null = null;
    private bounceStartTime: number = 0;

    constructor(config: Partial<BounceEngineConfig> = {}) {
        this.config = { ...DEFAULT_BOUNCE_CONFIG, ...config };
        console.log('[BounceEngine] Initialized with config:', this.config);
    }

    // ── Bounce Operations ────────────────────────────────────────────────────────

    /**
     * Render project timeline to audio file.
     */
    async bounceProject(
        clips: AudioClip[],
        tracks: AudioTrack[],
        startBeat: number,
        endBeat: number,
        tempo: number,
        userConfig?: Partial<BounceConfig>
    ): Promise<{ url: string; size: number }> {
        if (this.isBouncing) {
            throw new Error('Bounce already in progress');
        }

        try {
            this.isBouncing = true;
            this.bounceStartTime = Date.now();

            const finalConfig = { ...this.config, ...userConfig } as BounceConfig;
            const duration = this.calculateDuration(startBeat, endBeat, tempo);
            
            console.log('[BounceEngine] Starting bounce:', {
                startBeat,
                endBeat,
                tempo,
                duration,
                config: finalConfig
            });

            this.emitEvent({
                type: 'bounceStarted',
                config: finalConfig
            });

            // Create offline context
            this.offlineContext = new OfflineAudioContext({
                length: duration * finalConfig.sampleRate,
                sampleRate: finalConfig.sampleRate,
                numberOfChannels: 2
            });

            // Render audio
            const renderedBuffer = await this.renderTimeline(
                clips,
                tracks,
                startBeat,
                endBeat,
                tempo,
                finalConfig
            );

            // Process rendered audio
            const processedBuffer = this.processRenderedAudio(renderedBuffer, finalConfig);

            // Convert to desired format
            const audioBlob = await this.convertToFormat(processedBuffer, finalConfig);

            // Create download URL
            const url = URL.createObjectURL(audioBlob);
            const size = audioBlob.size;

            this.emitEvent({
                type: 'bounceCompleted',
                url,
                size
            });

            console.log('[BounceEngine] Bounce completed:', {
                duration: Date.now() - this.bounceStartTime,
                size,
                format: finalConfig.format
            });

            return { url, size };

        } catch (error) {
            this.emitEvent({
                type: 'error',
                error: `Bounce failed: ${error}`,
                context: 'bounceEngine.bounceProject'
            });
            throw error;
        } finally {
            this.isBouncing = false;
            this.offlineContext = null;
        }
    }

    /**
     * Render specific clip range.
     */
    async bounceClipRange(
        clips: AudioClip[],
        tracks: AudioTrack[],
        clipIds: string[],
        tempo: number,
        userConfig?: Partial<BounceConfig>
    ): Promise<{ url: string; size: number }> {
        const selectedClips = clips.filter(clip => clipIds.includes(clip.id));
        
        if (selectedClips.length === 0) {
            throw new Error('No clips selected for bounce');
        }

        // Find beat range
        const startBeat = Math.min(...selectedClips.map(clip => clip.startBeat));
        const endBeat = Math.max(...selectedClips.map(clip => clip.startBeat + clip.duration));

        return this.bounceProject(clips, tracks, startBeat, endBeat, tempo, userConfig);
    }

    /**
     * Bounce individual tracks as stems.
     * Returns a map of trackId -> { url, size } for each track.
     */
    async bounceStems(
        clips: AudioClip[],
        tracks: AudioTrack[],
        startBeat: number,
        endBeat: number,
        tempo: number,
        userConfig?: Partial<BounceConfig>
    ): Promise<Map<string, { url: string; size: number }>> {
        const results = new Map<string, { url: string; size: number }>();
        
        for (const track of tracks) {
            if (!track.id || track.muted) continue;
            
            // Filter clips for this track only
            const trackClips = clips.filter(c => c.trackId === track.id);
            if (trackClips.length === 0) continue;

            // Bounce just this track
            const result = await this.bounceProject(
                trackClips,
                [track],
                startBeat,
                endBeat,
                tempo,
                userConfig
            );
            results.set(track.id, result);
        }

        console.log('[BounceEngine] Stem bounce completed:', results.size, 'tracks');
        return results;
    }

    // ── Rendering ────────────────────────────────────────────────────────────────

    /**
     * Render timeline to offline context.
     */
    private async renderTimeline(
        clips: AudioClip[],
        tracks: AudioTrack[],
        startBeat: number,
        endBeat: number,
        tempo: number,
        config: BounceEngineConfig
    ): Promise<AudioBuffer> {
        if (!this.offlineContext) throw new Error('Offline context not initialized');

        const duration = this.calculateDuration(startBeat, endBeat, tempo);
        const sampleRate = this.offlineContext.sampleRate;
        
        console.log('[BounceEngine] Rendering timeline:', { duration, sampleRate });

        // Create master output
        const masterGain = this.offlineContext.createGain();
        masterGain.connect(this.offlineContext.destination);

        // Schedule all clips
        const scheduledSources: AudioBufferSourceNode[] = [];
        
        for (const clip of clips) {
            if (clip.startBeat >= endBeat || clip.startBeat + clip.duration <= startBeat) {
                continue; // Clip is outside bounce range
            }

            const track = tracks.find(t => t.id === clip.trackId);
            if (!track || track.muted || !track.enabled) {
                continue; // Skip disabled tracks
            }

            // Calculate timing
            const clipStartTime = this.beatsToSeconds(clip.startBeat - startBeat, tempo);
            const clipDuration = this.beatsToSeconds(clip.duration, tempo);
            
            // Create source
            const source = this.offlineContext.createBufferSource();
            source.buffer = clip.buffer ?? null;
            
            if (!source.buffer) {
                console.warn('[BounceEngine] No buffer for clip:', clip.id);
                continue;
            }

            // Apply track processing
            const trackGain = this.offlineContext.createGain();
            const trackPan = this.offlineContext.createStereoPanner();
            
            trackGain.gain.value = track.volume * (clip.muted ? 0 : 1);
            trackPan.pan.value = clip.pan;

            // Connect nodes
            source.connect(trackGain);
            trackGain.connect(trackPan);
            trackPan.connect(masterGain);

            // Schedule playback
            source.start(clipStartTime);
            scheduledSources.push(source);

            // Report progress
            this.reportProgress(clipStartTime, duration, tempo);
        }

        // Start rendering
        const renderedBuffer = await this.offlineContext.startRendering();
        
        // Clean up sources
        scheduledSources.forEach(source => {
            try {
                source.disconnect();
            } catch (error) {
                console.warn('[BounceEngine] Error disconnecting source:', error);
            }
        });

        return renderedBuffer;
    }

    /**
     * Process rendered audio (normalize, dither).
     */
    private processRenderedAudio(buffer: AudioBuffer, config: BounceEngineConfig): AudioBuffer {
        if (!this.offlineContext) throw new Error('Offline context not initialized');

        let processedBuffer = buffer;

        // Apply normalization if requested
        if (config.normalize) {
            processedBuffer = this.normalizeAudio(processedBuffer);
        }

        // Apply dithering if requested
        if (config.dither && config.bitDepth < 32) {
            processedBuffer = this.ditherAudio(processedBuffer, config.bitDepth);
        }

        return processedBuffer;
    }

    /**
     * Normalize audio to 0 dBFS.
     */
    private normalizeAudio(buffer: AudioBuffer): AudioBuffer {
        if (!this.offlineContext) throw new Error('Offline context not initialized');

        const normalizedBuffer = this.offlineContext.createBuffer(
            buffer.numberOfChannels,
            buffer.length,
            buffer.sampleRate
        );

        // Find peak level
        let peakLevel = 0;
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const channelData = buffer.getChannelData(channel);
            for (let i = 0; i < channelData.length; i++) {
                const absValue = Math.abs(channelData[i]);
                if (absValue > peakLevel) {
                    peakLevel = absValue;
                }
            }
        }

        // Calculate normalization factor
        const normalizationFactor = peakLevel > 0 ? 1.0 / peakLevel : 1.0;

        // Apply normalization
        for (let channel = 0; channel < normalizedBuffer.numberOfChannels; channel++) {
            const sourceData = buffer.getChannelData(channel);
            const targetData = normalizedBuffer.getChannelData(channel);
            
            for (let i = 0; i < sourceData.length; i++) {
                targetData[i] = sourceData[i] * normalizationFactor;
            }
        }

        console.log('[BounceEngine] Audio normalized:', { peakLevel, factor: normalizationFactor });
        return normalizedBuffer;
    }

    /**
     * Apply dithering to reduce bit depth.
     */
    private ditherAudio(buffer: AudioBuffer, bitDepth: number): AudioBuffer {
        if (!this.offlineContext) throw new Error('Offline context not initialized');

        const ditheredBuffer = this.offlineContext.createBuffer(
            buffer.numberOfChannels,
            buffer.length,
            buffer.sampleRate
        );

        // 1 LSB at the target bit depth. Float exports need no dither.
        if (bitDepth >= 32) return buffer;
        const ditherScale = 1 / (Math.pow(2, bitDepth - 1) - 1);

        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const sourceData = buffer.getChannelData(channel);
            const targetData = ditheredBuffer.getChannelData(channel);
            
            for (let i = 0; i < sourceData.length; i++) {
                // TPDF dither, ±1 LSB peak
                const dither = (Math.random() - Math.random()) * ditherScale;
                targetData[i] = Math.max(-1, Math.min(1, sourceData[i] + dither));
            }
        }

        console.log('[BounceEngine] Audio dithered:', { bitDepth, scale: ditherScale });
        return ditheredBuffer;
    }

    // ── Format Conversion ────────────────────────────────────────────────────────

    /**
     * Convert AudioBuffer to desired format.
     */
    private async convertToFormat(buffer: AudioBuffer, config: BounceEngineConfig): Promise<Blob> {
        switch (config.format) {
            case 'wav':
                return this.convertToWAV(buffer, config.bitDepth);
            case 'mp3':
                return this.convertToMP3(buffer, config.mp3);
            case 'ogg':
                return this.convertToOGG(buffer);
            default:
                throw new Error(`Unsupported format: ${config.format}`);
        }
    }

    /**
     * Encode to MP3 at the settings the Audio > MP3 panel holds.
     *
     * The bit rate used to be `const bitRate = 192`, with the panel's controls
     * reading into nothing. The encoding itself now lives in
     * `lib/mp3Encoding` so it can be tested without running a bounce.
     */
    private convertToMP3(buffer: AudioBuffer, settings?: Mp3Settings): Blob {
        const channels = Array.from(
            { length: buffer.numberOfChannels },
            (_, c) => buffer.getChannelData(c),
        );
        const encoded = encodeMp3(channels, buffer.sampleRate, settings ?? {});
        if (!encoded) {
            console.error('[BounceEngine] MP3 encoding unavailable, falling back to WAV');
            return this.convertToWAV(buffer, 16);
        }
        return new Blob([encoded], { type: 'audio/mpeg' });
    }

    private convertToOGG(buffer: AudioBuffer): Blob {
        try {
            // Use ogg.js or ogg encoder — fall back to WAV for now
            console.warn('[BounceEngine] OGG export not yet implemented, falling back to WAV');
            return this.convertToWAV(buffer, 16);
        } catch (e) {
            console.error('[BounceEngine] OGG encoding failed, falling back to WAV:', e);
            return this.convertToWAV(buffer, 16);
        }
    }

    /**
     * Convert to WAV format.
     */
    private convertToWAV(buffer: AudioBuffer, bitDepth: number): Blob {
        const length = buffer.length * buffer.numberOfChannels * (bitDepth / 8);
        const arrayBuffer = new ArrayBuffer(44 + length);
        const view = new DataView(arrayBuffer);
        const channels = [];
        let offset = 0;
        let pos = 0;

        // Write WAV header
        const setUint16 = (data: number) => {
            view.setUint16(pos, data, true);
            pos += 2;
        };
        const setUint32 = (data: number) => {
            view.setUint32(pos, data, true);
            pos += 4;
        };

        // RIFF identifier
        setUint32(0x46464952);
        // File length
        setUint32(36 + length);
        // WAVE identifier
        setUint32(0x45564156);
        // fmt chunk
        setUint32(0x20746d66);
        // Chunk size
        setUint32(16);
        // Audio format: 1 = PCM int, 3 = IEEE float (used for 32-bit)
        const isFloat = bitDepth === 32;
        setUint16(isFloat ? 3 : 1);
        // Number of channels
        setUint16(buffer.numberOfChannels);
        // Sample rate
        setUint32(buffer.sampleRate);
        // Byte rate
        setUint32(buffer.sampleRate * buffer.numberOfChannels * (bitDepth / 8));
        // Block align
        setUint16(buffer.numberOfChannels * (bitDepth / 8));
        // Bits per sample
        setUint16(bitDepth);
        // data chunk
        setUint32(0x61746164);
        // Data length
        setUint32(length);

        // Write interleaved data
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }

        while (offset < buffer.length) {
            for (let i = 0; i < buffer.numberOfChannels; i++) {
                const sample = Math.max(-1, Math.min(1, channels[i][offset]));
                if (isFloat) {
                    view.setFloat32(pos, sample, true);
                    pos += 4;
                } else if (bitDepth === 24) {
                    const v = Math.round(sample < 0 ? sample * 0x800000 : sample * 0x7FFFFF);
                    view.setUint8(pos, v & 0xFF);
                    view.setUint8(pos + 1, (v >> 8) & 0xFF);
                    view.setUint8(pos + 2, (v >> 16) & 0xFF);
                    pos += 3;
                } else {
                    view.setInt16(pos, Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7FFF), true);
                    pos += 2;
                }
            }
            offset++;
        }

        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }

    // ── Utility Methods ────────────────────────────────────────────────────────

    /**
     * Convert beats to seconds.
     */
    private beatsToSeconds(beats: number, tempo: number): number {
        return (beats / tempo) * 60;
    }

    /**
     * Calculate duration in seconds.
     */
    private calculateDuration(startBeat: number, endBeat: number, tempo: number): number {
        const beatRange = endBeat - startBeat;
        return this.beatsToSeconds(beatRange, tempo);
    }

    /**
     * Report bounce progress.
     */
    private reportProgress(currentTime: number, totalDuration: number, tempo: number): void {
        const currentBeat = (currentTime / 60) * tempo;
        const totalBeats = (totalDuration / 60) * tempo;
        const progress = Math.min(1, currentTime / totalDuration);

        this.emitEvent({
            type: 'bounceProgress',
            progress: {
                progress,
                currentBeat,
                totalBeats,
                estimatedTime: (totalDuration - currentTime) * 1000 // ms
            }
        });
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
                console.error('[BounceEngine] Event listener error:', error);
            }
        });
    }

    // ── Public Accessors ─────────────────────────────────────────────────────────

    isCurrentlyBouncing(): boolean {
        return this.isBouncing;
    }

    getConfig(): BounceEngineConfig {
        return { ...this.config };
    }

    updateConfig(newConfig: Partial<BounceEngineConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log('[BounceEngine] Config updated:', this.config);
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────────

    dispose(): void {
        if (this.offlineContext) {
            (this.offlineContext as unknown as AudioContext).close();
            this.offlineContext = null;
        }
        
        this.eventListeners = [];
        console.log('[BounceEngine] Disposed');
    }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────────

export const bounceEngine = new BounceEngine();

// ─── Convenience Exports ─────────────────────────────────────────────────────────

export const bounceProject = (
    clips: AudioClip[],
    tracks: AudioTrack[],
    startBeat: number,
    endBeat: number,
    tempo: number,
    config?: Partial<BounceConfig>
) => bounceEngine.bounceProject(clips, tracks, startBeat, endBeat, tempo, config);

export const bounceClipRange = (
    clips: AudioClip[],
    tracks: AudioTrack[],
    clipIds: string[],
    tempo: number,
    config?: Partial<BounceConfig>
) => bounceEngine.bounceClipRange(clips, tracks, clipIds, tempo, config);
