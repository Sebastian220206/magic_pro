/**
 * types.ts
 * Shared type definitions for the advanced audio engine.
 */

// ─── Core Audio Types ────────────────────────────────────────────────────────────────

export interface AudioEngineConfig {
    sampleRate: number;
    bufferSize: number;
    lookaheadTime: number; // ms
    maxLatency: number; // ms
}

export interface AudioClip {
    id: string;
    name: string;
    url?: string;
    buffer?: AudioBuffer;
    startBeat: number;
    duration: number;
    trackId: string;
    pitchShift: number; // semitones
    timeStretch: number; // ratio
    volume: number; // 0-1
    pan: number; // -1 to 1
    muted: boolean;
    loop: boolean;
}

export interface AudioTrack {
    id: string;
    name: string;
    volume: number; // 0-1
    pan: number; // -1 to 1
    muted: boolean;
    solo: boolean;
    armed: boolean; // for recording
    inputId?: string; // routing
    outputId?: string; // routing
    effects: AudioEffect[];
    sends: TrackSend[];
    enabled?: boolean;
}

export interface AudioEffect {
    id: string;
    type: string;
    params: Record<string, number>;
    wet: number; // 0-1
    enabled: boolean;
    insertPoint?: 'pre' | 'post';
}

/**
 * A send from a track to a bus.
 *
 * `level` is canonical — it is what `models/Track.ts` declares and what gets
 * persisted. `amount` is accepted because this engine type used to spell it
 * that way, and the two never agreed: the routing engine read `send.amount`
 * from objects the store had written as `{ busId, level }`, so every send's
 * gain came out `undefined`.
 */
export interface TrackSend {
    busId: string;
    /** 0-1. */
    level?: number;
    /** @deprecated legacy spelling of `level`. */
    amount?: number;
}

/** Send level as a finite 0-1 gain, whichever spelling it arrived in. */
export function sendLevel(send: TrackSend): number {
    const raw = send.level ?? send.amount ?? 0;
    return Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
}

export interface AudioBus {
    id: string;
    name: string;
    volume: number;
    pan: number;
    muted: boolean;
    effects: AudioEffect[];
}

// ─── Recording Types ────────────────────────────────────────────────────────────────

export interface RecordingConfig {
    inputDeviceId?: string;
    channels: number;
    sampleRate: number;
    bufferSize: number;
    monitorInput: boolean;
    autoCreateClip: boolean;
    /** Transport beat when recording started */
    startBeat?: number;
    /** Tempo in BPM at recording start */
    bpm?: number;
}

export interface RecordingSession {
    id: string;
    startTime: number;
    duration: number;
    trackId: string;
    buffer: AudioBuffer;
    config: RecordingConfig;
    /** Transport beat when recording started */
    startBeat: number;
    /** Tempo in BPM at recording start */
    bpm: number;
}

export interface InputDevice {
    deviceId: string;
    label: string;
    kind: MediaDeviceKind;
    capabilities: MediaTrackCapabilities;
}

// ─── Scheduling Types ─────────────────────────────────────────────────────────────

export interface ScheduledClip {
    id: string;
    clip: AudioClip;
    source: AudioBufferSourceNode;
    startTime: number; // AudioContext time
    endTime: number; // AudioContext time
    trackId: string;
}

export interface SchedulingWindow {
    currentTime: number;
    windowStart: number;
    windowEnd: number;
    lookaheadMs: number;
}

// ─── Bounce Types ───────────────────────────────────────────────────────────────────

export interface BounceConfig {
    startBeat: number;
    endBeat: number;
    sampleRate: number;
    bitDepth: 16 | 24 | 32;
    format: 'wav' | 'mp3' | 'ogg';
    normalize: boolean;
    dither: boolean;
}

export interface BounceProgress {
    progress: number; // 0-1
    currentBeat: number;
    totalBeats: number;
    estimatedTime: number; // seconds
}

// ─── Buffer Cache Types ─────────────────────────────────────────────────────────────

export interface BufferCacheEntry {
    id: string;
    buffer: AudioBuffer;
    url?: string;
    lastAccessed: number;
    size: number; // bytes
    refCount: number;
}

export interface CacheStats {
    totalBuffers: number;
    totalSize: number; // bytes
    hitRate: number; // 0-1
    missRate: number; // 0-1
}

// ─── Routing Types ───────────────────────────────────────────────────────────────────

export interface AudioRoute {
    sourceId: string;
    destinationId: string;
    gain: number;
    muted: boolean;
}

export interface RoutingNode {
    id: string;
    type: 'input' | 'track' | 'bus' | 'output';
    node: AudioNode;
    inputs: AudioRoute[];
    outputs: AudioRoute[];
}

// ─── Engine Events ─────────────────────────────────────────────────────────────────

export type AudioEngineEvent = 
    | { type: 'playbackStarted'; time: number }
    | { type: 'playbackStopped'; time: number }
    | { type: 'clipScheduled'; clipId: string; startTime: number }
    | { type: 'clipFinished'; clipId: string; endTime: number }
    | { type: 'recordingStarted'; sessionId: string; trackId: string }
    | { type: 'recordingStopped'; sessionId: string; duration: number; latencyOffset?: number }
    | { type: 'recordingData'; sessionId: string; data: Float32Array; peaks?: number[]; time?: number }
    | { type: 'bufferLoaded'; bufferId: string; size: number }
    | { type: 'bufferEvicted'; bufferId: string; reason: string }
    | { type: 'bounceStarted'; config: BounceConfig }
    | { type: 'bounceProgress'; progress: BounceProgress }
    | { type: 'bounceCompleted'; url: string; size: number }
    | { type: 'transportTick'; beat: number; time: number }
    | { type: 'seek'; beat: number }
    | { type: 'error'; error: string; context?: string };

export type EventListener = (event: AudioEngineEvent) => void;

// ─── Performance Types ─────────────────────────────────────────────────────────────

export interface PerformanceMetrics {
    schedulingLatency: number; // ms
    bufferHitRate: number; // 0-1
    cpuUsage: number; // 0-1
    memoryUsage: number; // MB
    activeSources: number;
    droppedFrames: number;
}

// ─── Utility Types ───────────────────────────────────────────────────────────────────

export type TimeStretchAlgorithm = 'linear' | 'granular' | 'phaseVocoder';

export type PitchShiftUnit = 'semitones' | 'cents' | 'ratio';

export interface TimeStretchParams {
    algorithm: TimeStretchAlgorithm;
    ratio: number;
    preserveFormants: boolean;
    preservePitch: boolean;
}

export interface PitchShiftParams {
    unit: PitchShiftUnit;
    amount: number;
    preserveDuration: boolean;
}
