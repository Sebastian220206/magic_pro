/**
 * AudioEngineAdapter.ts
 * 
 * Adapter layer that provides a backward-compatible interface for the legacy AudioEngine
 * while routing all operations to the new modular AudioEngine V2 system.
 * 
 * Pattern: Strangler Fig Migration / Adapter Pattern
 */

import { audioContextManager } from './audioEngine/audioContext';
import { advancedScheduler } from './audioEngine/scheduler';
import { routingEngine } from './audioEngine/routingEngine';
import { recordingEngine } from './audioEngine/recordingEngine';
import { bufferCacheManager } from './audioEngine/bufferCache';
import { bounceEngine } from './audioEngine/bounceEngine';
import { SynthEngine } from "./SynthEngine";
import { MultiSamplerEngine, createSamplerInstrument } from "./instruments/multiSamplerEngine";
import { AudioTrack, AudioClip } from './audioEngine/types';
import { SoundFontManager } from '@/lib/soundfontStore';

interface MidiInputEvent {
    message: MIDIMessageEvent;
    inputId: string;
}

interface LegacyTrackNodes {
    inputGain?: GainNode;
    mainGain?: GainNode;
    analyzer?: AnalyserNode;
    nodes?: Array<{
        id: string;
        instance?: unknown;
        internalNodes?: AudioNode[];
    }>;
}

import type { ClipType } from '../models/Clip';

interface RegionPlaybackClip {
    id: string;
    trackId: string;
    type: ClipType;
    name: string;
    startBeat?: number;
    start?: number;
    duration: number;
    offset?: number;
    muted?: boolean;
    loop?: boolean;
    fileUrl?: string;
    sampleId?: string;
    notes?: Array<{
        id: string;
        pitch: number;
        velocity: number;
        start: number;
        duration: number;
    }>;
}

const DEFAULT_AUDIO_TRACK: Omit<AudioTrack, 'id'> = {
    name: 'Track',
    volume: 0.8,
    pan: 0,
    muted: false,
    solo: false,
    armed: false,
    effects: [],
    sends: [],
};

export class AudioEngineAdapter {
    private synthEngines: Map<string, SynthEngine> = new Map();
    /** Per-track synth volume (0-1), separate from track volume */
    private synthVolumes: Map<string, number> = new Map();
    private samplerEngines: Map<string, MultiSamplerEngine> = new Map();
    private samplerLoading: Set<string> = new Set();
    private midiListeners: Set<(event: MidiInputEvent) => void> = new Set();
    private _initialized = false;
    private _initPromise: Promise<void> | null = null;
    private _pendingTracks: Array<{ id: string }> = [];
    private _savedMasterVolume: number = 0.8;
    private _readyResolve: (() => void) | null = null;
    private _readyPromise: Promise<void>;

    // ── Loop Preview Channel ─────────────────────────────────────────────
    private previewGain: GainNode | null = null;
    private previewSource: AudioBufferSourceNode | null = null;
    private previewBufferCache: Map<string, AudioBuffer> = new Map();

    constructor() {
        console.log('[AudioEngineAdapter] Created');
        this.setupMidiInput();
        this._readyPromise = new Promise((resolve) => { this._readyResolve = resolve; });
    }

    private async setupMidiInput() {
        if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) return;
        try {
            const access = await navigator.requestMIDIAccess();
            access.inputs.forEach(input => {
                input.onmidimessage = (message) => {
                    const event = { message, inputId: input.id };
                    this.midiListeners.forEach(l => l(event));
                };
            });
        } catch (e) {
            console.warn('[AudioEngineAdapter] MIDI access failed', e);
        }
    }

    addMidiListener(callback: (event: MidiInputEvent) => void) {
        this.midiListeners.add(callback);
        return () => {
            this.midiListeners.delete(callback);
        };
    }

    // ─── Lifecycle & Context ────────────────────────────────────────────────────────

    async init() {
        if (this._initialized) return;
        if (this._initPromise) return this._initPromise;

        this._initPromise = (async () => {
            try {
                await audioContextManager.initialize();
                await routingEngine.initialize();
                this._initialized = true;
                this._readyResolve?.();
                this._drainPendingTracks();
                console.log('[AudioEngineAdapter] Context and Routing initialized');
            } catch (e) {
                this._initPromise = null;
                throw e;
            }
        })();

        return this._initPromise;
    }

    isInitialized(): boolean {
        return this._initialized;
    }

    waitForReady(): Promise<void> {
        if (this._initialized) return Promise.resolve();
        return this._readyPromise;
    }

    private _drainPendingTracks() {
        const pending = [...this._pendingTracks];
        this._pendingTracks = [];
        for (const t of pending) {
            try {
                routingEngine.createTrack(this.normalizeTrack(t));
            } catch (e) {
                console.error('[AudioEngineAdapter] Failed to drain pending track:', t.id, e);
            }
        }
    }

    getContext(): AudioContext | null {
        return audioContextManager.getContext();
    }

    getSampleRate(): number {
        return audioContextManager.getSampleRate();
    }

    get currentTime(): number {
        return audioContextManager.getCurrentTime();
    }

    // ─── Transport Control ────────────────────────────────────────────────────────
    
    async play(clipsOrMetronome: AudioClip[] | boolean = [], tracks: AudioTrack[] = [], startBeat: number = 0, tempo: number = 120) {
        const ctx = this.getContext();
        if (ctx?.state === 'suspended') {
            await ctx.resume();
        }

        if (typeof clipsOrMetronome === 'boolean') {
            advancedScheduler.startPlayback([], [], startBeat, tempo);
            return;
        }

        advancedScheduler.startPlayback(clipsOrMetronome, tracks, startBeat, tempo);
    }

    stop() {
        advancedScheduler.stopPlayback();
    }

    stopPlaybackAndReset() {
        advancedScheduler.stopPlaybackAndReset();
    }

    stopAll() {
        this.stop();
        // Stop all synth/sampler notes
        this.synthEngines.forEach(e => e.stopAll());
        this.samplerEngines.forEach(e => e.stopAll());
    }

    seekTo(beat: number) {
        advancedScheduler.seekTo(beat);
    }

    get isPlaying(): boolean {
        return advancedScheduler.isCurrentlyPlaying();
    }

    onTransportTick(callback: (beat: number, time: number) => void) {
        const listener = (event: { type?: string; beat?: number; time?: number }) => {
            if (event.type === 'transportTick') {
                callback(event.beat ?? 0, event.time ?? 0);
            }
        };
        advancedScheduler.addEventListener(listener);
        return () => advancedScheduler.removeEventListener(listener);
    }

    setTempo(bpm: number) {
        advancedScheduler.setTempo(bpm);
    }


    // ─── Mixer & Routing ──────────────────────────────────────────────────────────

    syncTrack(id: string, volume: number, pan: number, muted: boolean, soloed: boolean) {
        routingEngine.updateTrack(id, { volume, pan, muted, solo: soloed });
    }

    addTrack(track: Partial<AudioTrack> & Pick<AudioTrack, 'id'>) {
        if (!this._initialized) {
            console.warn(`[AudioEngineAdapter] Engine not ready, queueing track ${track.id}`);
            this._pendingTracks.push({ id: track.id });
            return;
        }
        routingEngine.createTrack(this.normalizeTrack(track));
    }

    removeTrack(trackId: string) {
        routingEngine.removeTrack(trackId);
        this.synthEngines.delete(trackId);
        this.samplerEngines.delete(trackId);
    }

    createTrack(trackId: string) {
        if (!this._initialized) {
            console.warn(`[AudioEngineAdapter] Engine not ready, queueing track ${trackId}`);
            this._pendingTracks.push({ id: trackId });
            return;
        }
        routingEngine.createTrack(this.normalizeTrack({ id: trackId }));
    }

    getChannel(trackId: string) {
        return this.getTrackNodes(trackId);
    }

    getTrackNodes(trackId: string): LegacyTrackNodes | null {
        const chain = routingEngine.getTrackNodes(trackId);
        if (!chain) return null;
        return {
            inputGain: chain.inputGain,
            mainGain: chain.mainGain,
            analyzer: chain.analyzer,
            nodes: [],
        };
    }

    updateTrackParams(trackId: string, volume: number, pan: number) {
        routingEngine.updateTrack(trackId, { volume, pan });
    }

    updateFXChain(trackId: string, plugins: Array<{ id: string; type?: string; pluginId?: string; enabled?: boolean; params?: Record<string, number> }>) {
        // V2 RoutingEngine handles effects differently, for now we log or map
        console.log(`[AudioEngineAdapter] updateFXChain for ${trackId}`, plugins);
    }

    routeTrackToTrack(sourceId: string, destinationId: string) {
        // In V2, tracks connect to master by default. Complex routing logic here.
        console.log(`[AudioEngineAdapter] routing ${sourceId} to ${destinationId}`);
    }

    routeTrackToBus(trackId: string, busId: string, level: number) {
        routingEngine.updateTrack(trackId, { 
            sends: [{ busId, amount: level }] 
        });
    }

    setMasterVolume(volume: number) {
        routingEngine.setMasterVolume(volume);
    }

    setMasterPan(pan: number) {
        // V2 Master output doesn't have pan yet, but we can implement it
        console.log(`[AudioEngineAdapter] setMasterPan`, pan);
    }

    setMasterMuted(muted: boolean) {
        if (muted) {
            this._savedMasterVolume = routingEngine.getMasterVolume();
            routingEngine.setMasterVolume(0);
        } else {
            routingEngine.setMasterVolume(this._savedMasterVolume);
        }
    }

    setTrackVolume(trackId: string, volume: number) {
        routingEngine.updateTrack(trackId, { volume });
    }

    setTrackPan(trackId: string, pan: number) {
        routingEngine.updateTrack(trackId, { pan });
    }

    muteTrack(trackId: string) {
        routingEngine.updateTrack(trackId, { muted: true });
    }

    unmuteTrack(trackId: string) {
        routingEngine.updateTrack(trackId, { muted: false });
    }

    soloTrack(trackId: string) {
        routingEngine.updateTrack(trackId, { solo: true });
    }

    unsoloTrack(trackId: string) {
        routingEngine.updateTrack(trackId, { solo: false });
    }

    getMasterAnalyzer() {
        return (routingEngine as any).getMasterAnalyzer ? (routingEngine as any).getMasterAnalyzer() : null;
    }

    getEQAnalyzer(trackId: string, _pluginId: string, _post: boolean): AnalyserNode | null {
        return this.getTrackNodes(trackId)?.analyzer ?? this.getMasterAnalyzer();
    }

    getEQFrequencyResponse(_trackId: string, _pluginId: string, frequencies: Float32Array): Float32Array {
        return new Float32Array(frequencies.length);
    }

    configureAudioFormat(format: string, surround: string, spatial: string) {
        console.log(`[AudioEngineAdapter] configureAudioFormat`, { format, surround, spatial });
    }

    // ─── Audio Data ──────────────────────────────────────────────────────────────

    async loadAudio(url: string) {
        const ctx = this.getContext();
        if (!ctx) return null;
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        const buffer = await ctx.decodeAudioData(arrayBuffer);
        return buffer;
    }

    async loadSample(id: string, url: string) {
        const ctx = this.getContext();
        if (!ctx) return;
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        const buffer = await ctx.decodeAudioData(arrayBuffer);
        bufferCacheManager.addBuffer(id, buffer, url);
    }

    addBuffer(id: string, buffer: AudioBuffer) {
        bufferCacheManager.addBuffer(id, buffer);
    }

    getBuffer(id: string) {
        return bufferCacheManager.getBuffer(id);
    }

    // ─── Playback ────────────────────────────────────────────────────────────────

    playClip(buffer: AudioBuffer, startTime: number, trackId: string, offset = 0, duration?: number) {
        const ctx = this.getContext();
        if (!ctx) return null;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        let channel = this.getTrackNodes(trackId);
        if (!channel) {
            this.createTrack(trackId);
            channel = this.getTrackNodes(trackId);
        }
        
        if (channel) {
            const connectTarget: AudioNode = channel.inputGain || channel.mainGain!;
            source.connect(connectTarget);
        } else {
            console.error(`[AudioEngineAdapter] Critical Error: Track ${trackId} could not be allocated.`);
        }
        // Register with the scheduler so stopPlayback() can stop this source
        advancedScheduler.registerSource(source);
        source.start(startTime, offset, duration);
        return source;
    }

    // ─── Loop Preview ─────────────────────────────────────────────────────────

    stopPreview(): void {
        if (this.previewSource) {
            try { this.previewSource.stop(); } catch { }
            this.previewSource.disconnect();
            this.previewSource = null;
        }
    }

    async previewLoop(path: string): Promise<void> {
        const ctx = this.getContext();
        if (!ctx) {
            console.error('[AudioEngineAdapter] No AudioContext for preview');
            return;
        }

        // Lazy-init preview channel
        if (!this.previewGain) {
            this.previewGain = ctx.createGain();
            this.previewGain.gain.value = 0.8;
            this.previewGain.connect(ctx.destination);
        }

        // Stop any existing preview
        this.stopPreview();

        try {
            // Load from cache or fetch
            let buffer = this.previewBufferCache.get(path);
            if (!buffer) {
                console.log(`[AudioEngineAdapter] Loading preview: ${path}`);
                const res = await fetch(path);
                if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
                const arrayBuffer = await res.arrayBuffer();
                buffer = await ctx.decodeAudioData(arrayBuffer);
                this.previewBufferCache.set(path, buffer);
            }

            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.previewGain!);
            source.start(0);
            this.previewSource = source;
            source.onended = () => {
                if (this.previewSource === source) {
                    this.previewSource = null;
                }
            };
        } catch (e) {
            console.error(`[AudioEngineAdapter] Preview failed for ${path}:`, e);
        }
    }

    /** Control the SynthEngine's master volume in real-time (0.0 - 1.0) */
    setSynthVolume(trackId: string, volume: number): void {
        const clamped = Math.max(0, Math.min(3, volume));
        this.synthVolumes.set(trackId, clamped);
        const engine = this.synthEngines.get(trackId);
        if (engine) {
            engine.setVolume(clamped);
        }

        // Also update SoundFont instrument volume if active
        const sfManager = SoundFontManager.getInstance();
        let sfSelection = sfManager.getSelection(trackId);
        if (!sfSelection) {
            sfSelection = sfManager.getSelection('_global_');
        }
        if (sfSelection) {
            const sfInstrument = sfManager.getInstrument(sfSelection.fontId);
            if (sfInstrument) {
                sfInstrument.setVolume(clamped);
            }
        }
    }

    /** Get or create a SynthEngine for a track (used by both triggerNote and setSynthVolume) */
    private getOrCreateSynth(trackId: string, ctx: AudioContext, targetNode: AudioNode): SynthEngine {
        let engine = this.synthEngines.get(trackId);
        if (!engine) {
            engine = new SynthEngine(ctx, targetNode);
            this.synthEngines.set(trackId, engine);
            // Restore saved volume
            const saved = this.synthVolumes.get(trackId);
            if (saved !== undefined) {
                engine.setVolume(saved);
            }
        }
        return engine;
    }

    // ─── MIDI & Synthesis ────────────────────────────────────────────────────────

    triggerNote(trackId: string, pitch: number, velocity: number, repeatRate?: string, instrument?: string) {
        const ctx = this.getContext();
        if (!ctx) {
            console.error('[AudioEngineAdapter] No AudioContext available');
            return;
        }

        let channel = this.getTrackNodes(trackId);
        if (!channel) {
            this.createTrack(trackId);
            channel = this.getTrackNodes(trackId);
            if (!channel) {
                console.error(`[AudioEngineAdapter] Failed to create track routing for ${trackId}`);
                return;
            }
        }

        const samplerPresets: Record<string, string> = {
            'Nylon Guitar': '/sound_sample/guitar/MG%20Soft%20Nylon%20Guitar%20(Lite).dspreset',
            'Steinway Piano': '/sound_sample/piano/Piano.dspreset'
        };

        // 1. Check SoundFontManager for this track (or globally if track lacks it)
        const sfManager = SoundFontManager.getInstance();
        let sfSelection = sfManager.getSelection(trackId);
        if (!sfSelection) {
            sfSelection = sfManager.getSelection('_global_');
        }
        if (sfSelection) {
            const sfInstrument = sfManager.getInstrument(sfSelection.fontId);
            if (sfInstrument && sfInstrument.isLoaded) {
                if (sfInstrument.currentPresetIndex !== sfSelection.presetIndex) {
                    sfInstrument.selectPreset(sfSelection.presetIndex);
                }
                const connectTarget: AudioNode = channel.inputGain || channel.mainGain!;
                try {
                    sfInstrument.getOutput().connect(connectTarget);
                } catch (e) {
                    // Already connected or cross-context — ignore
                }
                sfInstrument.noteOn(pitch, velocity);
                return;
            }
        }

        // 2. If sampler is already loaded, use it directly — no synth fallback needed
        if (instrument && samplerPresets[instrument]) {
            const sampler = this.samplerEngines.get(trackId);
            if (sampler) {
                sampler.playNote(pitch, velocity);
                return;
            }
        }

        // 3. Fall back to SynthEngine for instant sound (sampler not yet loaded)
        const targetNode: AudioNode = channel.inputGain || channel.mainGain!;
        const engine = this.getOrCreateSynth(trackId, ctx, targetNode);
        engine.noteOn(pitch, velocity, instrument || 'piano');

        // 3. Fire-and-forget: load sampler in background, replaces synth when ready
        if (instrument && samplerPresets[instrument]) {
            this.triggerSamplerNote(trackId, pitch, velocity, channel, instrument, samplerPresets[instrument]);
        }
    }

    async loadInstrument(trackId: string, instrument: string) {
        const samplerPresets: Record<string, string> = {
            'Nylon Guitar': '/sound_sample/guitar/MG%20Soft%20Nylon%20Guitar%20(Lite).dspreset',
            'Steinway Piano': '/sound_sample/piano/Piano.dspreset'
        };

        const dspPath = samplerPresets[instrument];
        if (!dspPath) {
            console.warn(`[AudioEngineAdapter] No dspreset path for instrument: ${instrument}`);
            return;
        }

        const ctx = this.getContext();
        if (!ctx) {
            console.warn(`[AudioEngineAdapter] No AudioContext for loadInstrument`);
            return;
        }

        // Ensure track routing nodes exist
        let channel = this.getTrackNodes(trackId);
        if (!channel) {
            console.log(`[AudioEngineAdapter] Creating track nodes for ${trackId} before instrument load`);
            routingEngine.createTrack({ id: trackId });
            channel = this.getTrackNodes(trackId);
            if (!channel) {
                console.error(`[AudioEngineAdapter] Cannot create track routing for ${trackId}`);
                return;
            }
        }

        if (!this.samplerEngines.has(trackId) && !this.samplerLoading.has(trackId)) {
            this.samplerLoading.add(trackId);
            try {
                console.log(`[AudioEngineAdapter] Loading instrument "${instrument}" from ${dspPath} for track ${trackId}`);
                const sampler = await createSamplerInstrument(ctx, dspPath);
                const connectTarget: AudioNode = channel.inputGain || channel.mainGain!;
                sampler.getOutput().connect(connectTarget);
                this.samplerEngines.set(trackId, sampler);

                // Disconnect the fallback synth engine so samples take over
                const synth = this.synthEngines.get(trackId);
                if (synth) {
                    synth.stopAll();
                    this.synthEngines.delete(trackId);
                }
                console.log(`[AudioEngineAdapter] Successfully loaded ${instrument} for track ${trackId}`);
            } catch (e) {
                console.error(`[AudioEngineAdapter] Failed to load instrument ${instrument} from ${dspPath}:`, e);
                // SynthEngine fallback remains active — user hears sound
            } finally {
                this.samplerLoading.delete(trackId);
            }
        }
    }

    private async triggerSamplerNote(trackId: string, pitch: number, velocity: number, channel: LegacyTrackNodes, instrument: string, dspPath: string) {
        const ctx = this.getContext();
        if (!ctx) {
            console.error('[AudioEngineAdapter] No AudioContext for sampler');
            return;
        }

        if (!channel) {
            this.createTrack(trackId);
            channel = this.getTrackNodes(trackId) as LegacyTrackNodes;
            if (!channel) {
                console.error(`[AudioEngineAdapter] Cannot create track for sampler: ${trackId}`);
                return;
            }
        }

        // SynthEngine is already playing the note from triggerNote(),
        // so this is purely an async upgrade path.
        let sampler = this.samplerEngines.get(trackId);
        if (sampler) {
            // Sampler already loaded — replace the synth with sampler sound
            sampler.playNote(pitch, velocity);
            return;
        }

        // Start loading sampler if not already loading
        if (this.samplerLoading.has(trackId)) {
            return; // Loading in progress — synth continues playing
        }

        try {
            await this.loadInstrument(trackId, instrument);
            sampler = this.samplerEngines.get(trackId);
            if (sampler) {
                sampler.playNote(pitch, velocity);
                console.log(`[AudioEngineAdapter] Sampler now active for track ${trackId}`);
            }
        } catch (e) {
            console.warn(`[AudioEngineAdapter] Sampler load failed for track ${trackId}, synth remains active.`, e);
        }
    }

    initMidi() {
        console.log('[AudioEngineAdapter] initMidi');
        // V2 MIDI initialization logic here
    }

    releaseNote(trackId: string, pitch: number) {
        this.synthEngines.get(trackId)?.noteOff(pitch);
        this.samplerEngines.get(trackId)?.noteOff(pitch);

        const sfManager = SoundFontManager.getInstance();
        let sfSelection = sfManager.getSelection(trackId);
        if (!sfSelection) {
            sfSelection = sfManager.getSelection('_global_');
        }
        if (sfSelection) {
            const sfInstrument = sfManager.getInstrument(sfSelection.fontId);
            if (sfInstrument && sfInstrument.isLoaded) {
                sfInstrument.noteOff(pitch);
            }
        }
    }

    setPitchBend(trackId: string, cents: number) {
        this.synthEngines.get(trackId)?.setPitchBend(cents);
    }

    playRegion(trackId: string, clip: RegionPlaybackClip, positionBeat: number) {
        if (clip.type === 'audio') {
            const bufferId = clip.sampleId ?? clip.id;
            const buffer = this.getBuffer(bufferId);
            const startBeat = clip.startBeat ?? clip.start ?? 0;
            if (!buffer) {
                return null;
            }
            const secondsPerBeat = 60 / advancedScheduler.getTempo();
            const offsetBeats = Math.max(0, positionBeat - startBeat) + (clip.offset ?? 0);
            const durationBeats = Math.max(0, clip.duration - (positionBeat - startBeat));
            return this.playClip(
                buffer,
                this.currentTime + 0.01,
                trackId,
                offsetBeats * secondsPerBeat,
                durationBeats * secondsPerBeat
            );
        }

        clip.notes?.forEach((note) => {
            const noteStartBeat = (clip.startBeat ?? clip.start ?? 0) + note.start;
            if (noteStartBeat <= positionBeat && positionBeat < noteStartBeat + note.duration) {
                this.triggerNote(trackId, note.pitch, note.velocity, undefined, 'piano');
                window.setTimeout(() => this.releaseNote(trackId, note.pitch), note.duration * (60 / advancedScheduler.getTempo()) * 1000);
            }
        });

        return null;
    }

    updatePluginParams(trackId: string, pluginId: string, params: Record<string, number>) {
        console.log(`[AudioEngineAdapter] updatePluginParams`, { trackId, pluginId, params });
    }

    // ─── Recording & Export ───────────────────────────────────────────────────────

    async startRecording(config: any, trackId: string) {
        return recordingEngine.startRecording(config, trackId);
    }

    async stopRecording() {
        return recordingEngine.stopRecording();
    }

    monitorInput(trackId: string, enabled: boolean): void {
        const ctx = this.getContext();
        if (!ctx) return;

        if (enabled) {
            const chain = routingEngine.getTrackNodes(trackId);
            if (chain) {
                recordingEngine.setMonitoringEnabled(true);
            } else {
                console.warn(`[AudioEngineAdapter] No track routing for monitoring on ${trackId}`);
            }
        } else {
            recordingEngine.setMonitoringEnabled(false);
        }
    }

    async bounce(config: any) {
        return bounceEngine.bounceProject([], [], config.startBeat, config.endBeat, 120, config);
    }

    dispose() {
        routingEngine.dispose();
        advancedScheduler.dispose();
        recordingEngine.dispose();
        bufferCacheManager.clearCache();
        this.synthEngines.clear();
        this.samplerEngines.clear();
    }

    private normalizeTrack(track: Partial<AudioTrack> & Pick<AudioTrack, 'id'>): AudioTrack {
        return {
            ...DEFAULT_AUDIO_TRACK,
            ...track,
            id: track.id,
            effects: track.effects ?? [],
            sends: track.sends ?? [],
        };
    }
}

export const audioEngineAdapter = new AudioEngineAdapter();
export const audioEngine = audioEngineAdapter;
export const audioEngine2 = audioEngineAdapter;
