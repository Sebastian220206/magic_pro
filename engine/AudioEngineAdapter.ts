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
import { metronomeEngine } from './audioEngine/metronome';
import type { MidiNoteEvent, MidiSink } from './audioEngine/midiSequencer';
import { midiDeviceService } from './midi/midiDeviceService';
import {
    assignWamInstrument,
    removeWamInstrument,
    wamAllNotesOff,
    wamNoteOff,
    wamNoteOn,
} from './plugins/wam/wamInstrumentHost';
import { getInstrumentService } from './instruments/instrumentService';
import { LoudnessMeter, type LoudnessData } from './audioEngine/loudnessMeter';
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
import { samplerPresetFor } from './instruments/samplerPresets';

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

export class AudioEngineAdapter implements MidiSink {
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
        // Become the scheduler's sound source for sequenced MIDI notes.
        advancedScheduler.setMidiSink(this);
    }

    /**
     * Attach message handlers to every MIDI input, re-attaching whenever the
     * device list changes.
     *
     * Handlers used to be bound once at construction against a private
     * `requestMIDIAccess` call, so a keyboard plugged in after the app loaded
     * would appear in settings but never produce a note. Subscribing to the
     * shared device service covers hot-plugging, and means the app makes one
     * permission request instead of several competing ones.
     */
    private setupMidiInput() {
        // Subscribe rather than bind. `onmidimessage` is a single slot and is
        // owned by `midiDeviceService`; assigning it here would fight the
        // piano roll's recorder and the control-surface engine for the port,
        // and whoever assigned last would silently take every note.
        midiDeviceService.subscribeToMessages(({ data, inputId }) => {
            const event = { message: { data } as MIDIMessageEvent, inputId };
            this.midiListeners.forEach(l => l(event));
        });

        void midiDeviceService.initialize();
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
    
    async play(clips: AudioClip[] = [], tracks: AudioTrack[] = [], startBeat: number = 0, tempo: number = 120) {
        const ctx = this.getContext();
        if (ctx?.state === 'suspended') {
            await ctx.resume();
        }

        advancedScheduler.startPlayback(clips, tracks, startBeat, tempo);

        // The metronome schedules itself off the scheduler's clock, so it has to
        // be (re)armed after the transport has been anchored.
        if (metronomeEngine.isEnabled()) {
            metronomeEngine.reset();
            metronomeEngine.setEnabled(false);
            metronomeEngine.setEnabled(true);
        }
    }

    stop() {
        advancedScheduler.stopPlayback();
        metronomeEngine.reset();
    }

    stopPlaybackAndReset() {
        advancedScheduler.stopPlaybackAndReset();
        metronomeEngine.reset();
    }

    /**
     * Enable or disable the click track. Clicks are only audible while the
     * transport is rolling, but the flag is honoured immediately so toggling
     * mid-playback starts/stops the click without restarting the transport.
     */
    setMetronomeEnabled(enabled: boolean) {
        metronomeEngine.setEnabled(enabled);
    }

    isMetronomeEnabled(): boolean {
        return metronomeEngine.isEnabled();
    }

    /**
     * Click a count-in and report its length in seconds, so the caller can
     * start the transport when it ends. Returns 0 when there is none.
     */
    scheduleCountIn(bars: number, beatsPerBar: number, tempo: number): number {
        return metronomeEngine.scheduleCountIn(bars, beatsPerBar, tempo);
    }

    /** Apply the project's metronome preferences to the click generator. */
    configureMetronome(settings: {
        accentLevel?: number;
        clickLevel?: number;
        polyphonicClick?: boolean;
        volume?: number;
    }) {
        if (settings.accentLevel !== undefined) metronomeEngine.setAccentLevel(settings.accentLevel);
        if (settings.clickLevel !== undefined) metronomeEngine.setClickLevel(settings.clickLevel);
        if (settings.polyphonicClick !== undefined) metronomeEngine.setPolyphonic(settings.polyphonicClick);
        if (settings.volume !== undefined) metronomeEngine.setVolume(settings.volume);
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

    /**
     * Transport position in beats, derived from the AudioContext clock.
     *
     * This is the authoritative playhead: it is the same value used to schedule
     * audio and MIDI, so anything drawn from it stays locked to what is heard.
     * Prefer this over accumulating beats per animation frame.
     */
    getCurrentBeat(): number {
        return advancedScheduler.getPreciseCurrentBeat();
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

    syncTrack(id: string, volume: number, pan: number, muted: boolean, soloed: boolean, soloSafe = false) {
        routingEngine.updateTrack(id, { volume, pan, muted, solo: soloed, soloSafe } as never);
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

    updateFXChain(trackId: string, plugins: Array<{ id: string; type?: string; pluginId?: string; enabled?: boolean; params?: Record<string, number>; latencySamples?: number }>) {
        // Report the chain's latency so plugin delay compensation can realign
        // this track against the rest of the project.
        routingEngine.updateTrackPlugins(trackId, plugins);
    }

    /**
     * Replace the master bus insert chain — the bus compression and limiting
     * that a mastering pass puts across the whole mix.
     */
    updateMasterFXChain(plugins: Array<{ id: string; pluginId?: string; enabled?: boolean; params?: Record<string, number> }>) {
        routingEngine.updateMasterPlugins(plugins as never);
    }

    /** Current peak level of a track or bus, 0-1. */
    getTrackPeak(trackId: string): number {
        return routingEngine.getTrackPeak(trackId);
    }

    /** Nudge a track's playback in time, in milliseconds. */
    setTrackDelay(trackId: string, ms: number): void {
        routingEngine.setTrackDelay(trackId, ms);
    }

    /** `direct` bypasses the master chain, for auditioning a reference track. */
    setTrackMonitorMode(trackId: string, mode: 'normal' | 'direct'): void {
        routingEngine.setTrackMonitorMode(trackId, mode);
    }

    /** Fold the monitor path to mono for a phase check. */
    setMonitorMode(mode: 'stereo' | 'mono'): void {
        routingEngine.setMonitorMode(mode);
    }

    /** Duck one track from another's level — the kick-to-sub pump. */
    setSidechainSource(trackId: string, pluginId: string, sourceTrackId: string): void {
        routingEngine.setSidechainSource(trackId, pluginId, sourceTrackId);
    }

    clearSidechainSource(trackId: string, pluginId: string): void {
        routingEngine.clearSidechainSource(trackId, pluginId);
    }

    /** Latency the current plugin chains impose, in samples. */
    getProjectLatencySamples(): number {
        return routingEngine.getProjectLatencySamples();
    }

    /** Latency the current plugin chains impose, in seconds. */
    getProjectLatencySeconds(): number {
        return routingEngine.getProjectLatencySeconds();
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

    // ─── Loudness metering (LUFS / true peak) ────────────────────────────────

    private loudnessMeter: LoudnessMeter | null = null;

    /**
     * Begin EBU R128 loudness metering on the master bus.
     *
     * `callback` receives momentary / short-term / integrated LUFS, true-peak
     * per channel and loudness range — the figures needed to master to a
     * streaming target rather than by eye.
     *
     * Returns a disposer; calling again replaces the previous meter.
     */
    startLoudnessMetering(callback: (data: LoudnessData) => void): () => void {
        const ctx = this.getContext();
        const master = routingEngine.getMasterGain();
        if (!ctx || !master) return () => { };

        this.stopLoudnessMetering();

        this.loudnessMeter = new LoudnessMeter(ctx, master);
        this.loudnessMeter.start(callback);

        return () => this.stopLoudnessMetering();
    }

    stopLoudnessMetering(): void {
        if (!this.loudnessMeter) return;
        this.loudnessMeter.stop();
        this.loudnessMeter.dispose();
        this.loudnessMeter = null;
    }

    /** Reset the integrated LUFS reading — used when starting a new pass. */
    resetLoudnessIntegration(): void {
        this.loudnessMeter?.resetIntegrated();
        this.loudnessMeter?.resetPeakHold();
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
        this.stopMidiPreview();
    }

    /**
     * Track id the loop browser auditions MIDI loops on.
     *
     * A dedicated hidden track rather than the focused one: previewing must not
     * disturb whatever instrument the user has loaded on the track they are
     * about to drop the loop onto.
     */
    private static readonly MIDI_PREVIEW_TRACK = '__loop-preview__';

    /** Timers for notes already scheduled, so a second click can cancel them. */
    private midiPreviewTimers: ReturnType<typeof setTimeout>[] = [];

    /**
     * Audition a MIDI loop through the General MIDI bank.
     *
     * Audio loops are previewed by playing a file; a MIDI loop has no file, so
     * its notes are scheduled against the audio clock instead. Beats are
     * converted using the loop's own tempo rather than the project's, because
     * the browser is showing the loop as authored — dropping it on the timeline
     * is when it adopts the project tempo.
     */
    async previewMidiLoop(
        notes: { pitch: number; velocity: number; start: number; duration: number }[],
        bpm: number,
        instrument = 'piano',
    ): Promise<void> {
        const ctx = this.getContext();
        if (!ctx || notes.length === 0) return;

        this.stopMidiPreview();

        const trackId = AudioEngineAdapter.MIDI_PREVIEW_TRACK;
        if (!this.getTrackNodes(trackId)) this.createTrack(trackId);
        await this.loadInstrument(trackId, instrument).catch(() => {
            // A missing instrument should not silence the preview entirely —
            // scheduleNote falls back to the built-in synth.
        });

        const secondsPerBeat = 60 / bpm;
        const startAt = ctx.currentTime + 0.08; // a beat of headroom to schedule into

        for (const [index, note] of notes.entries()) {
            this.scheduleNote({
                key: `preview-${index}`,
                clipId: 'preview',
                trackId,
                pitch: note.pitch,
                velocity: note.velocity,
                startTime: startAt + note.start * secondsPerBeat,
                stopTime: startAt + (note.start + note.duration) * secondsPerBeat,
                instrument,
            });
        }
    }

    /**
     * Silence an in-flight MIDI preview.
     *
     * Only the preview track. `allNotesOff()` is global and would cut the
     * user's playback too, which is very much not what stopping an audition
     * should do.
     */
    stopMidiPreview(): void {
        for (const timer of this.midiPreviewTimers) clearTimeout(timer);
        this.midiPreviewTimers = [];

        const ctx = this.getContext();
        const now = ctx?.currentTime ?? 0;
        const trackId = AudioEngineAdapter.MIDI_PREVIEW_TRACK;

        try {
            getInstrumentService().allNotesOff(trackId, now);
        } catch {
            // No instrument was assigned; nothing to release.
        }
        this.synthEngines.get(trackId)?.stopAll();
        this.samplerEngines.get(trackId)?.stopAll(now);
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
        let ctx = this.getContext();
        if (!ctx) {
            audioContextManager.initialize().catch(e =>
                console.warn('[AudioEngineAdapter] AudioContext init failed, retry on next note:', e)
            );
            return;
        }

        // 0. A WAM instrument owns the track's sound entirely.
        if (wamNoteOn(trackId, pitch, velocity)) return;

        // 1. An instrument loaded through the Library / useInstruments lives in
        //    getInstrumentService(). That registry is the one the loading path writes
        //    to, so it must be checked first — otherwise every note falls
        //    through to the built-in synth no matter what the user selected.
        if (getInstrumentService().hasInstrument(trackId)) {
            getInstrumentService().noteOn(trackId, pitch, velocity);
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
        if (instrument && samplerPresetFor(instrument)) {
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
        const preset = samplerPresetFor(instrument);
        if (instrument && preset) {
            this.triggerSamplerNote(trackId, pitch, velocity, channel, instrument, preset);
        }
    }

    // ─── Sequenced MIDI (MidiSink) ───────────────────────────────────────────────
    //
    // The scheduler hands us notes resolved to absolute AudioContext times. All
    // three instrument backends accept a start time, so sequenced playback is
    // sample-accurate rather than timer-driven.

    /**
     * Play one sequenced note between two absolute AudioContext times.
     *
     * Instrument resolution mirrors `triggerNote`: an explicitly selected
     * SoundFont wins, then a loaded multi-sampler, then the built-in synth.
     */
    scheduleNote(event: MidiNoteEvent): void {
        const ctx = this.getContext();
        if (!ctx) return;

        let channel = this.getTrackNodes(event.trackId);
        if (!channel) {
            this.createTrack(event.trackId);
            channel = this.getTrackNodes(event.trackId);
            if (!channel) return;
        }

        const { pitch, velocity, startTime, stopTime } = event;

        // 0. A WAM instrument. Both note events carry absolute AudioContext
        //    times, which the sequencer has already computed — so scheduled
        //    notes stay sample-accurate instead of being fired by a timer.
        if (wamNoteOn(event.trackId, pitch, velocity, startTime)) {
            wamNoteOff(event.trackId, pitch, stopTime);
            return;
        }

        // 1. Instrument loaded via the Library / useInstruments. Same priority
        //    as triggerNote, so sequenced playback uses whatever the user
        //    actually selected rather than the fallback synth.
        if (getInstrumentService().hasInstrument(event.trackId)) {
            getInstrumentService().noteOn(event.trackId, pitch, velocity, startTime);
            getInstrumentService().noteOff(event.trackId, pitch, stopTime);
            return;
        }

        // 1. SoundFont selected for this track (or globally).
        const sfManager = SoundFontManager.getInstance();
        const sfSelection = sfManager.getSelection(event.trackId) ?? sfManager.getSelection('_global_');
        if (sfSelection) {
            const sfInstrument = sfManager.getInstrument(sfSelection.fontId);
            if (sfInstrument && sfInstrument.isLoaded) {
                if (sfInstrument.currentPresetIndex !== sfSelection.presetIndex) {
                    sfInstrument.selectPreset(sfSelection.presetIndex);
                }
                try {
                    sfInstrument.getOutput().connect(channel.inputGain || channel.mainGain!);
                } catch {
                    // Already connected — harmless.
                }
                sfInstrument.noteOn(pitch, velocity, startTime);
                sfInstrument.noteOff(pitch, stopTime);
                return;
            }
        }

        // 2. A multi-sampler already loaded for this track.
        const sampler = this.samplerEngines.get(event.trackId);
        if (sampler) {
            sampler.playNote(pitch, velocity, startTime);
            return;
        }

        // 3. Built-in synth.
        const targetNode: AudioNode = channel.inputGain || channel.mainGain!;
        const engine = this.getOrCreateSynth(event.trackId, ctx, targetNode);
        engine.scheduleNote(pitch, velocity, event.instrument || 'piano', startTime, stopTime);
    }

    /**
     * Silence every sequenced and live voice. Called on stop, seek and tempo
     * change, where any already-scheduled note time has become invalid.
     */
    allNotesOff(): void {
        const ctx = this.getContext();
        const now = ctx?.currentTime ?? 0;

        this.synthEngines.forEach(engine => engine.stopAll());
        this.samplerEngines.forEach(engine => engine.stopAll(now));
        wamAllNotesOff();

        const service = getInstrumentService();
        service.getAllAssignments().forEach(a => service.allNotesOff(a.trackId, now));

        try {
            const sfManager = SoundFontManager.getInstance();
            sfManager.getAllFonts().forEach(font => {
                const instrument = sfManager.getInstrument(font.id);
                if (instrument?.isLoaded) instrument.allNotesOff(now);
            });
        } catch (error) {
            console.warn('[AudioEngineAdapter] Failed to clear SoundFont notes:', error);
        }
    }

    async loadInstrument(trackId: string, instrument: string) {

        const dspPath = samplerPresetFor(instrument);
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
        // Mirror triggerNote's resolution order so a Library-loaded instrument
        // is released by the same registry that sounded it.
        if (wamNoteOff(trackId, pitch)) return;

        if (getInstrumentService().hasInstrument(trackId)) {
            getInstrumentService().noteOff(trackId, pitch);
            return;
        }

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

    /**
     * Apply parameter changes to a live plugin.
     *
     * `pluginId` here is the plugin *instance* id (`PluginSetting.id`), which is
     * what identifies a slot in the track's chain.
     */
    updatePluginParams(trackId: string, pluginId: string, params: Record<string, number>) {
        const processor = routingEngine.getInsertProcessor(trackId, pluginId);
        if (!processor) return;
        processor.setParams(params);
    }

    /**
     * Load a Web Audio Module instrument onto a track.
     *
     * Instruments generate sound from MIDI rather than processing audio, so
     * they connect at the track input rather than joining the insert chain.
     */
    async loadWamInstrument(trackId: string, url: string, identifier: string): Promise<boolean> {
        const ctx = this.getContext();
        if (!ctx) return false;

        // The track must exist in the routing graph before anything can connect.
        if (!this.getTrackNodes(trackId)) this.createTrack(trackId);

        return assignWamInstrument(ctx, trackId, url, identifier);
    }

    /** Remove a track's WAM instrument. */
    removeWamInstrument(trackId: string): void {
        removeWamInstrument(trackId);
    }

    /** Opaque plugin state, for saving a project. */
    getPluginState(trackId: string, pluginId: string): unknown {
        return routingEngine.getInsertProcessor(trackId, pluginId)?.getState();
    }

    setPluginState(trackId: string, pluginId: string, state: unknown): void {
        routingEngine.getInsertProcessor(trackId, pluginId)?.setState(state);
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
