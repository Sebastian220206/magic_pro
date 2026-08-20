/**
 * routingEngine.ts
 * Audio routing and processing engine for flexible signal flow.
 * 
 * Features:
 * - Input → Track → Bus → Output routing
 * - Per-track insert effects chains
 * - Send/return bus architecture
 * - Low-latency monitoring
 */

import { 
    AudioTrack, 
    AudioBus, 
    AudioEffect, 
    TrackSend,
    sendLevel,
    AudioRoute,
    RoutingNode,
    AudioEngineEvent,
    EventListener 
} from './types';
import { audioContextManager } from './audioContext';
import { AudioNodePool } from './nodePool';
import {
    MAX_COMPENSATION_SAMPLES,
    computeCompensation,
    projectLatencySamples,
    samplesToSeconds,
    trackLatencySamples,
    type PluginDescriptor,
    type TrackLatencyReport,
} from './latencyCompensation';
import { InsertChain, type InsertProcessor } from './insertChain';
import { SidechainCompressorProcessor } from './dsp/sidechainCompressorNode';
import { createProcessor } from '../plugins/processorFactory';
import { toPluginSpecs } from '../plugins/pluginSpec';
import type { PluginSetting } from '../../models/Track';

// ─── Node Chain Types ────────────────────────────────────────────────────────

interface TrackNodeChain {
    trackId: string;
    inputGain: GainNode;
    preEffects: AudioEffectNode[];
    postEffects: AudioEffectNode[];
    sendGains: Map<string, GainNode>;
    mainGain: GainNode;
    panner: StereoPannerNode;
    /**
     * Plugin delay compensation. Sits at the very end of the track's path so
     * the master and every send see the same aligned signal.
     */
    pdcDelay: DelayNode;
    /** User-set track offset, kept separate from PDC so the two cannot fight. */
    userDelay: DelayNode;
    analyzer: AnalyserNode;
    output: AudioNode;
    baseVolume: number;
    isMuted: boolean;
    isSoloed: boolean;
    /** Latency of this track's insert chain, in samples. */
    latencySamples: number;
}

interface BusNodeChain {
    busId: string;
    inputGain: GainNode;
    effects: AudioEffectNode[];
    outputGain: GainNode;
    output: AudioNode;
}

interface AudioEffectNode {
    effect: AudioEffect;
    input: GainNode;
    wetGain: GainNode;
    output: GainNode;
    node: AudioNode; // The actual effect node (could be a Worklet)
}

// ─── Routing Engine ──────────────────────────────────────────────────────

class RoutingEngine {
    private inputNodes: Map<string, MediaStreamAudioSourceNode> = new Map();
    private trackNodes: Map<string, TrackNodeChain> = new Map();
    private busNodes: Map<string, BusNodeChain> = new Map();
    private outputNode: GainNode | null = null;
    private masterGain: GainNode | null = null;
    private eventListeners: EventListener[] = [];
    
    private ctx: AudioContext | null = null;
    private nodePool: AudioNodePool | null = null;
    private connections: Map<AudioNode, Set<AudioNode>> = new Map();
    private soloedTracks: Set<string> = new Set();
    /** Per-track plugin insert chains, keyed by track id. */
    private insertChains: Map<string, InsertChain> = new Map();
    /** Inserts on the summed mix, between the master gain and the output fader. */
    private masterChain: InsertChain | null = null;
    /** Mono-fold node, present only while the monitor is in mono. */
    private monoMerger: ChannelMergerNode | null = null;
    /** Which track keys each sidechain compressor, `trackId:pluginId` -> source. */
    private sidechainKeys: Map<string, string> = new Map();

    constructor() {
        console.log('[RoutingEngine] Initialized');
    }

    // ── Initialization ────────────────────────────────────────────────────────────

    /**
     * Initialize routing engine.
     */
    async initialize(): Promise<void> {
        const ctx = audioContextManager.getContext();
        if (!ctx) {
            await audioContextManager.initialize();
        }

        this.ctx = audioContextManager.getContext();
        if (!this.ctx) throw new Error('Failed to initialize AudioContext');

        this.nodePool = new AudioNodePool(this.ctx);

        // Create master output chain
        this.setupMasterOutput();

        console.log('[RoutingEngine] Initialized');
    }

    private setupMasterOutput(): void {
        if (!this.ctx) return;

        // Create master gain node
        this.masterGain = this.nodePool!.getGain();
        this.masterGain.gain.value = 1.0;

        // Create output gain node (for final volume control)
        this.outputNode = this.nodePool!.getGain();
        this.outputNode.gain.value = 1.0;

        // Connect to destination, with an insert chain between the summed mix
        // and the final volume control. This is where bus compression and
        // limiting go, so mastering plugins sit after every track but before
        // the master fader.
        this.safeConnect(this.outputNode, this.ctx.destination);
        this.masterChain = new InsertChain(
            this.ctx, this.masterGain, this.outputNode, createProcessor);
    }

    /**
     * Replace the master insert chain.
     *
     * Mirrors `updateTrackPlugins`, but the master bus has no PDC of its own —
     * every track has already been aligned by the time the signal reaches it.
     */
    updateMasterPlugins(plugins: PluginSetting[] | PluginDescriptor[]): void {
        if (!this.masterChain) return;
        void this.masterChain.setSpecs(toPluginSpecs(plugins as PluginSetting[]));
    }

    /** The live processor for a master plugin instance, for parameter updates. */
    getMasterProcessor(instanceId: string): InsertProcessor | null {
        return this.masterChain?.getProcessor(instanceId) ?? null;
    }

    // ── Input Routing ────────────────────────────────────────────────────────────

    /**
     * Create input node from media stream.
     */
    createInputNode(inputId: string, stream: MediaStream): MediaStreamAudioSourceNode {
        if (!this.ctx) throw new Error('AudioContext not initialized');

        const source = this.ctx.createMediaStreamSource(stream);
        this.inputNodes.set(inputId, source);
        
        console.log('[RoutingEngine] Input node created:', inputId);
        return source;
    }

    /**
     * Route input to specific track.
     */
    routeInputToTrack(inputId: string, trackId: string, gain: number = 1.0): void {
        const inputNode = this.inputNodes.get(inputId);
        const trackChain = this.trackNodes.get(trackId);
        
        if (!inputNode || !trackChain) {
            console.warn('[RoutingEngine] Cannot route input to track:', { inputId, trackId });
            return;
        }

        // Create input gain if needed
        const inputGain = this.nodePool!.getGain();
        inputGain.gain.value = gain;

        // Connect input to track
        this.safeConnect(inputNode, inputGain);
        this.safeConnect(inputGain, trackChain.inputGain);

        console.log('[RoutingEngine] Input routed to track:', { inputId, trackId, gain });
    }

    /**
     * Disconnect input routing.
     */
    disconnectInput(inputId: string): void {
        const inputNode = this.inputNodes.get(inputId);
        if (inputNode) {
            this.safeDisconnect(inputNode);
            this.inputNodes.delete(inputId);
            console.log('[RoutingEngine] Input disconnected:', inputId);
        }
    }

    // ── Track Management ────────────────────────────────────────────────────────────

    /**
     * Create track processing chain.
     */
    createTrack(track: Partial<AudioTrack> & Pick<AudioTrack, 'id'>): void {
        if (!this.ctx || !this.nodePool) {
            console.error(`[RoutingEngine] Cannot create track "${track.id}" — AudioContext or NodePool not initialized. Call routingEngine.initialize() first.`);
            return;
        }

        const normalizedTrack: AudioTrack = {
            id: track.id,
            name: track.name ?? 'Track',
            volume: track.volume ?? 0.8,
            pan: track.pan ?? 0,
            muted: track.muted ?? false,
            solo: track.solo ?? false,
            armed: track.armed ?? false,
            inputId: track.inputId,
            outputId: track.outputId,
            effects: track.effects ?? [],
            sends: track.sends ?? [],
        };

        // Create track nodes
        const inputGain = this.nodePool.getGain();
        const mainGain = this.nodePool.getGain();
        const panner = this.nodePool.getPanner();
        const analyzer = this.ctx.createAnalyser();
        analyzer.fftSize = 256;
        analyzer.smoothingTimeConstant = 0.8;

        // Starts at zero delay; recomputed whenever any track's plugin chain
        // changes. maxDelayTime bounds how much compensation can ever apply.
        const pdcDelay = this.ctx.createDelay(
            samplesToSeconds(MAX_COMPENSATION_SAMPLES, this.ctx.sampleRate) || 2,
        );
        pdcDelay.delayTime.value = 0;

        // A separate node for the user's own track offset, so a PDC pass
        // cannot overwrite it (and vice versa).
        const userDelay = this.ctx.createDelay(0.5);
        userDelay.delayTime.value = 0;
        
        // Create send gains for each bus send
        const sendGains = new Map<string, GainNode>();
        if (normalizedTrack.sends) {
            normalizedTrack.sends.forEach(send => {
                const sendGain = this.nodePool!.getGain();
                sendGain.gain.value = sendLevel(send);
                sendGains.set(send.busId, sendGain);
            });
        }

        // Setup track parameters
        inputGain.gain.value = 1.0;
        mainGain.gain.value = normalizedTrack.muted ? 0 : normalizedTrack.volume;
        panner.pan.value = normalizedTrack.pan;

        // Track solo state
        if (normalizedTrack.solo) {
            this.soloedTracks.add(normalizedTrack.id);
        }

        // Create insert effect nodes
        const preEffects: AudioEffectNode[] = [];
        const postEffects: AudioEffectNode[] = [];
        
        normalizedTrack.effects.forEach(effect => {
            const effectNode = this.createEffectNode(effect);
            if (effect.type === 'insert' && effect.insertPoint === 'pre') {
                preEffects.push(effectNode);
            } else {
                postEffects.push(effectNode);
            }
        });

        // Build track chain
        this.buildTrackChain(normalizedTrack.id, {
            trackId: normalizedTrack.id,
            inputGain,
            preEffects,
            postEffects,
            sendGains,
            mainGain,
            panner,
            pdcDelay,
            userDelay,
            analyzer,
            output: mainGain,
            baseVolume: normalizedTrack.volume,
            isMuted: normalizedTrack.muted,
            isSoloed: normalizedTrack.solo,
            latencySamples: trackLatencySamples(
                normalizedTrack.effects as unknown as PluginDescriptor[],
            ),
        });

        // Plugin inserts live between the track input and the fader, so they
        // are pre-fader: the fader rides the processed signal, as in a console.
        this.insertChains.set(
            normalizedTrack.id,
            new InsertChain(this.ctx, inputGain, mainGain, createProcessor),
        );

        // A new track changes the project's worst-case latency.
        this.recomputeLatencyCompensation();

        console.log('[RoutingEngine] Track created:', normalizedTrack.id);
    }

    // ── Metering, monitoring and sidechain ────────────────────────────────────

    /**
     * Current peak level of a track or bus, 0-1.
     *
     * Read from the per-track analyser the chain already carries; nothing was
     * exposing it, so a mix could not be metered from the store.
     */
    getTrackPeak(trackId: string): number {
        const chain = this.trackNodes.get(trackId);
        if (!chain) return 0;

        const data = new Float32Array(chain.analyzer.fftSize);
        chain.analyzer.getFloatTimeDomainData(data);

        let peak = 0;
        for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
        return peak;
    }

    /**
     * Nudge a track's playback in time, in milliseconds.
     *
     * Separate from `pdcDelay`, which belongs to plugin delay compensation —
     * mixing the two would let a user offset be wiped by the next PDC pass.
     */
    setTrackDelay(trackId: string, ms: number): void {
        const chain = this.trackNodes.get(trackId);
        if (!chain || !this.ctx) return;

        const seconds = Math.max(0, Math.min(0.5, (Number.isFinite(ms) ? ms : 0) / 1000));
        chain.userDelay.delayTime.setTargetAtTime(seconds, this.ctx.currentTime, 0.01);
    }

    /**
     * Send a track straight to the output, bypassing the master chain.
     *
     * This is how a reference track is auditioned: it must not be coloured by
     * the mix bus processing it is being compared against.
     */
    setTrackMonitorMode(trackId: string, mode: 'normal' | 'direct'): void {
        const chain = this.trackNodes.get(trackId);
        if (!chain || !this.ctx || !this.masterGain || !this.outputNode) return;

        this.safeDisconnectFrom(chain.output, this.masterGain);
        this.safeDisconnectFrom(chain.output, this.outputNode);
        this.safeConnect(chain.output, mode === 'direct' ? this.outputNode : this.masterGain);
    }

    /**
     * Collapse the monitor path to mono for a phase check, without touching
     * the mix itself. A vocal that vanishes here has a polarity problem.
     */
    setMonitorMode(mode: 'stereo' | 'mono'): void {
        if (!this.ctx || !this.outputNode) return;

        if (mode === 'mono') {
            if (!this.monoMerger) {
                // Summing both channels into both outputs is the mono fold.
                const merger = this.ctx.createChannelMerger(2);
                const splitter = this.ctx.createChannelSplitter(2);
                const sum = this.ctx.createGain();
                sum.gain.value = 0.5;

                this.safeDisconnect(this.outputNode);
                this.safeConnect(this.outputNode, splitter);
                splitter.connect(sum, 0);
                splitter.connect(sum, 1);
                sum.connect(merger, 0, 0);
                sum.connect(merger, 0, 1);
                this.safeConnect(merger, this.ctx.destination);
                this.monoMerger = merger;
            }
        } else if (this.monoMerger) {
            this.safeDisconnect(this.outputNode);
            this.safeDisconnect(this.monoMerger);
            this.monoMerger = null;
            this.safeConnect(this.outputNode, this.ctx.destination);
        }
    }

    /**
     * Key a track's compressor from another track — the kick-to-sub pump.
     *
     * Patches `sourceTrackId`'s output into input 1 of the target's sidechain
     * compressor worklet, which computes gain reduction per sample from it.
     *
     * This replaced an envelope follower that drove the target's *fader* at
     * control rate. That version could not do the things a compressor does —
     * no ratio, no knee, no threshold, and it fought the mixer for ownership
     * of the fader, so moving the fader while ducking lost one or the other.
     *
     * Requires a `magic.sidechain` plugin on the target track; a plain
     * compressor has nowhere to put the key.
     */
    setSidechainSource(trackId: string, pluginId: string, sourceTrackId: string): void {
        const source = this.trackNodes.get(sourceTrackId);
        if (!source || !this.ctx) return;

        const processor = this.insertChains.get(trackId)?.getProcessor(pluginId);
        if (!processor || !(processor instanceof SidechainCompressorProcessor)) {
            console.warn(
                `[Sidechain] Plugin ${pluginId} on ${trackId} is not a sidechain compressor.`,
            );
            return;
        }

        // Key from the track's pre-fader output, so riding the source's fader
        // does not change how hard it ducks.
        processor.setKeySource(source.mainGain);
        this.sidechainKeys.set(`${trackId}:${pluginId}`, sourceTrackId);
    }

    clearSidechainSource(trackId: string, pluginId: string): void {
        const processor = this.insertChains.get(trackId)?.getProcessor(pluginId);
        if (processor instanceof SidechainCompressorProcessor) {
            processor.setKeySource(null);
        }
        this.sidechainKeys.delete(`${trackId}:${pluginId}`);
    }

    /** Gain reduction a sidechain compressor is applying, in dB. */
    getSidechainReductionDb(trackId: string, pluginId: string): number {
        const processor = this.insertChains.get(trackId)?.getProcessor(pluginId);
        return processor instanceof SidechainCompressorProcessor
            ? processor.getReductionDb()
            : 0;
    }

    /**
     * Re-patch every key after a chain rebuild.
     *
     * `InsertChain.setSpecs` disposes and recreates processors, so a key
     * connected before an unrelated plugin was added would otherwise be lost.
     */
    private restoreSidechainKeys(trackId: string): void {
        for (const [key, sourceTrackId] of this.sidechainKeys) {
            const [owner, pluginId] = key.split(':');
            if (owner !== trackId) continue;

            const processor = this.insertChains.get(trackId)?.getProcessor(pluginId);
            const source = this.trackNodes.get(sourceTrackId);
            if (processor instanceof SidechainCompressorProcessor && source) {
                processor.setKeySource(source.mainGain);
            }
        }
    }

    // ── Plugin Delay Compensation ─────────────────────────────────────────────

    /**
     * Declare the latency of a track's insert chain and realign the project.
     *
     * Called whenever a plugin is added, removed or bypassed.
     */
    setTrackLatency(trackId: string, latencySamples: number): void {
        const chain = this.trackNodes.get(trackId);
        if (!chain) return;

        const next = Number.isFinite(latencySamples) ? Math.max(0, latencySamples) : 0;
        if (chain.latencySamples === next) return;

        chain.latencySamples = next;
        this.recomputeLatencyCompensation();
    }

    /**
     * Apply a track's plugin chain: build/reuse/dispose processors, relink the
     * insert segment, then report the chain's latency for compensation.
     *
     * Previously this only recomputed latency — no plugin ever became an audio
     * node, so nothing a user inserted could be heard.
     */
    updateTrackPlugins(trackId: string, plugins: PluginSetting[] | PluginDescriptor[]): void {
        // Report the declared latency immediately so compensation reacts now
        // rather than after an async rebuild.
        this.setTrackLatency(trackId, trackLatencySamples(plugins as PluginDescriptor[]));

        const chain = this.insertChains.get(trackId);
        if (!chain) return; // Track not instantiated yet; declaration stands.

        const specs = toPluginSpecs(plugins as PluginSetting[]);
        void chain.setSpecs(specs).then(() => {
            // Refine with what the processors actually report — but only if the
            // whole chain was realised. A plugin that failed to instantiate is
            // not in the signal path, and trusting a partial chain would
            // under-compensate the track.
            if (chain.getInstanceIds().length === specs.length) {
                this.setTrackLatency(trackId, chain.getLatencySamples());
            }
            // Processors are recreated by `setSpecs`, so any key patched into
            // one has to be reconnected or it is silently lost.
            this.restoreSidechainKeys(trackId);
        });
    }

    /** The live processor for a plugin instance, for parameter updates. */
    getInsertProcessor(trackId: string, instanceId: string): InsertProcessor | null {
        return this.insertChains.get(trackId)?.getProcessor(instanceId) ?? null;
    }

    /**
     * Re-derive every track's compensation delay so all tracks arrive at the
     * master aligned with the highest-latency one.
     */
    recomputeLatencyCompensation(): void {
        if (!this.ctx || this.trackNodes.size === 0) return;

        const reports: TrackLatencyReport[] = [];
        this.trackNodes.forEach(chain => {
            reports.push({ trackId: chain.trackId, latencySamples: chain.latencySamples });
        });

        const compensation = computeCompensation(reports);
        const now = this.ctx.currentTime;

        compensation.forEach((samples, trackId) => {
            const chain = this.trackNodes.get(trackId);
            if (!chain) return;
            const seconds = samplesToSeconds(samples, this.ctx!.sampleRate);
            // Ramp rather than jump: an abrupt delay change would click.
            chain.pdcDelay.delayTime.setTargetAtTime(seconds, now, 0.01);
        });
    }

    /** Latency the project currently imposes, in samples. */
    getProjectLatencySamples(): number {
        const reports: TrackLatencyReport[] = [];
        this.trackNodes.forEach(chain => {
            reports.push({ trackId: chain.trackId, latencySamples: chain.latencySamples });
        });
        return projectLatencySamples(reports);
    }

    /** Latency the project currently imposes, in seconds. */
    getProjectLatencySeconds(): number {
        if (!this.ctx) return 0;
        return samplesToSeconds(this.getProjectLatencySamples(), this.ctx.sampleRate);
    }

    /** The master summing node, for metering and mastering inserts. */
    getMasterGain(): GainNode | null {
        return this.masterGain;
    }

    /**
     * Update track parameters.
     * Handles volume, pan, mute, solo, and sends with lazy node creation.
     */
    updateTrack(trackId: string, updates: Partial<AudioTrack>): void {
        let trackChain = this.trackNodes.get(trackId);
        if (!trackChain) {
            // Lazy-create track nodes instead of silently aborting
            console.warn(`[RoutingEngine] updateTrack: Track ${trackId} not found, lazily creating.`);
            this.createTrack({ id: trackId, ...updates });
            trackChain = this.trackNodes.get(trackId);
            if (!trackChain) {
                console.error(`[RoutingEngine] updateTrack: Failed to create track ${trackId}.`);
                return;
            }
        }

        const now = this.ctx?.currentTime || 0;
        let recomputeGain = false;

        // Update base volume
        if (updates.volume !== undefined) {
            trackChain.baseVolume = Math.max(0, updates.volume);
            recomputeGain = true;
        }

        // Update pan — smooth ramp to prevent zipper noise
        if (updates.pan !== undefined) {
            trackChain.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, updates.pan)), now, 0.02);
        }

        // Update muted
        if (updates.muted !== undefined) {
            trackChain.isMuted = updates.muted;
            recomputeGain = true;
        }

        // Update solo
        if (updates.solo !== undefined) {
            const wasSoloed = trackChain.isSoloed;
            trackChain.isSoloed = updates.solo;
            if (wasSoloed !== updates.solo) {
                if (updates.solo) {
                    this.soloedTracks.add(trackId);
                } else {
                    this.soloedTracks.delete(trackId);
                }
                // Solo change affects ALL tracks — recalculate entire group
                this.recomputeAllTrackGains();
                // Still fall through to update sends below
            } else {
                recomputeGain = true;
            }
        }

        // Recompute effective gain if volume, mute, or solo changed (and solo wasn't handled above)
        if (recomputeGain) {
            this.recomputeTrackGain(trackId, trackChain);
        }

        // Update sends
        if (updates.sends) {
            updates.sends.forEach(send => {
                let sendGain = trackChain.sendGains.get(send.busId);
                if (!sendGain) {
                    sendGain = this.nodePool!.getGain();
                    trackChain.sendGains.set(send.busId, sendGain);
                    // Reconnect sends to bus
                    const busChain = this.busNodes.get(send.busId);
                    if (busChain) {
                        this.safeConnect(sendGain, busChain.inputGain);
                    }
                }
                sendGain.gain.setValueAtTime(sendLevel(send), now);
            });
        }
    }

    private recomputeTrackGain(trackId: string, chain: TrackNodeChain): void {
        const now = this.ctx?.currentTime || 0;
        const hasAnySolo = this.soloedTracks.size > 0;
        let effectiveGain = chain.baseVolume;

        if (chain.isMuted) {
            effectiveGain = 0;
        }
        if (hasAnySolo && !chain.isSoloed) {
            effectiveGain = 0;
        }

        chain.mainGain.gain.setTargetAtTime(effectiveGain, now, 0.02);
    }

    private recomputeAllTrackGains(): void {
        this.trackNodes.forEach((chain, trackId) => {
            this.recomputeTrackGain(trackId, chain);
        });
    }

    /**
     * Remove track from routing.
     */
    removeTrack(trackId: string): void {
        const trackChain = this.trackNodes.get(trackId);
        if (trackChain && this.nodePool) {
            // Disconnect all nodes
            this.safeDisconnect(trackChain.inputGain);
            this.safeDisconnect(trackChain.mainGain);
            this.safeDisconnect(trackChain.panner);
            this.safeDisconnect(trackChain.pdcDelay);

            // Release nodes to pool
            this.nodePool.releaseGain(trackChain.inputGain);
            this.nodePool.releaseGain(trackChain.mainGain);
            this.nodePool.releasePanner(trackChain.panner);

            // Disconnect and release effects
            [...trackChain.preEffects, ...trackChain.postEffects].forEach(effect => {
                this.safeDisconnect(effect.input);
                this.safeDisconnect(effect.wetGain);
                this.safeDisconnect(effect.output);
                this.nodePool!.releaseGain(effect.input);
                this.nodePool!.releaseGain(effect.wetGain);
                this.nodePool!.releaseGain(effect.output);
            });

            // Disconnect and release sends
            trackChain.sendGains.forEach(sendGain => {
                this.safeDisconnect(sendGain);
                this.nodePool!.releaseGain(sendGain);
            });


            this.insertChains.get(trackId)?.dispose();
            this.insertChains.delete(trackId);

            this.soloedTracks.delete(trackId);
            this.trackNodes.delete(trackId);

            // Removing the highest-latency track lowers the project's
            // reference, so every remaining track needs less padding.
            this.recomputeLatencyCompensation();
            console.log('[RoutingEngine] Track removed:', trackId);
        }
    }

    // ── Bus Management ─────────────────────────────────────────────────────────────

    /**
     * Create audio bus (send/return).
     */
    createBus(bus: AudioBus): void {
        if (!this.ctx || !this.nodePool) throw new Error('AudioContext or NodePool not initialized');

        const inputGain = this.nodePool.getGain();
        const outputGain = this.nodePool.getGain();
        
        inputGain.gain.value = 1.0;
        outputGain.gain.value = bus.volume;

        // Create bus effects
        const effects: AudioEffectNode[] = [];
        bus.effects.forEach(effect => {
            const effectNode = this.createEffectNode(effect);
            effects.push(effectNode);
        });

        // Build bus chain
        this.buildBusChain(bus.id, {
            busId: bus.id,
            inputGain,
            effects,
            outputGain,
            output: outputGain
        });

        console.log('[RoutingEngine] Bus created:', bus.id);
    }


    /**
     * Update bus parameters.
     */
    updateBus(busId: string, updates: Partial<AudioBus>): void {
        const busChain = this.busNodes.get(busId);
        if (!busChain) return;

        if (updates.volume !== undefined) {
            busChain.outputGain.gain.value = updates.volume;
        }

        if (updates.muted !== undefined) {
            busChain.outputGain.gain.value = updates.muted ? 0 : updates.volume || 1;
        }

        console.log('[RoutingEngine] Bus updated:', busId, updates);
    }

    /**
     * Remove bus from routing.
     */
    removeBus(busId: string): void {
        const busChain = this.busNodes.get(busId);
        if (busChain && this.nodePool) {
            this.safeDisconnect(busChain.inputGain);
            this.safeDisconnect(busChain.outputGain);
            
            this.nodePool.releaseGain(busChain.inputGain);
            this.nodePool.releaseGain(busChain.outputGain);

            // Disconnect and release effects
            busChain.effects.forEach(effect => {
                this.safeDisconnect(effect.input);
                this.safeDisconnect(effect.wetGain);
                this.safeDisconnect(effect.output);
                this.nodePool!.releaseGain(effect.input);
                this.nodePool!.releaseGain(effect.wetGain);
                this.nodePool!.releaseGain(effect.output);
            });

            this.busNodes.delete(busId);
            console.log('[RoutingEngine] Bus removed:', busId);
        }
    }


    // ── Effect Management ───────────────────────────────────────────────────────

    /**
     * Create effect node with wet/dry mixing.
     */
    private createEffectNode(effect: AudioEffect): AudioEffectNode {
        if (!this.ctx || !this.nodePool) throw new Error('AudioContext or NodePool not initialized');

        const input = this.nodePool.getGain();
        const wetGain = this.nodePool.getGain();
        const output = this.nodePool.getGain();
        
        input.gain.value = 1.0;
        wetGain.gain.value = effect.wet;
        output.gain.value = 1.0;

        // For now, create a simple gain node as placeholder effect
        const effectNode = this.nodePool.getGain();
        effectNode.gain.value = 1.0;

        // Connect effect chain
        this.safeConnect(input, wetGain);
        this.safeConnect(wetGain, effectNode);
        this.safeConnect(effectNode, output);

        return {
            effect,
            input,
            wetGain,
            output,
            node: effectNode
        };
    }

    // ── Chain Building ───────────────────────────────────────────────────────────

    /**
     * Build track processing chain.
     */
    private buildTrackChain(trackId: string, chain: TrackNodeChain): void {
        let currentNode: AudioNode = chain.inputGain;

        // Pre-fader effects
        chain.preEffects.forEach(effect => {
            this.safeConnect(currentNode, effect.input);
            currentNode = effect.output;
        });

        // Connect to main gain
        this.safeConnect(currentNode, chain.mainGain);
        currentNode = chain.mainGain;

        // Post-fader effects
        chain.postEffects.forEach(effect => {
            this.safeConnect(currentNode, effect.input);
            currentNode = effect.output;
        });

        // Connect to panner
        this.safeConnect(currentNode, chain.panner);
        currentNode = chain.panner;

        // Plugin delay compensation, applied once at the end of the chain so
        // sends and the master receive an already-aligned signal.
        this.safeConnect(currentNode, chain.pdcDelay);
        currentNode = chain.pdcDelay;

        // Tap analyzer for metering (doesn't pass signal through, just monitors)
        this.safeConnect(currentNode, chain.analyzer);

        // Connect sends to buses
        chain.sendGains.forEach((sendGain, busId) => {
            this.safeConnect(currentNode, sendGain);
            const busChain = this.busNodes.get(busId);
            if (busChain) {
                this.safeConnect(sendGain, busChain.inputGain);
            }
        });

        // Connect to master
        this.safeConnect(currentNode, this.masterGain!);

        this.trackNodes.set(trackId, chain);
    }


    /**
     * Build bus processing chain.
     */
    private buildBusChain(busId: string, chain: BusNodeChain): void {
        let currentNode: AudioNode = chain.inputGain;

        // Bus effects
        chain.effects.forEach(effect => {
            this.safeConnect(currentNode, effect.input);
            currentNode = effect.output;
        });

        // Connect to output gain
        this.safeConnect(currentNode, chain.outputGain);
        currentNode = chain.outputGain;

        // Connect to master
        this.safeConnect(currentNode, this.masterGain!);

        this.busNodes.set(busId, chain);
    }


    // ── Master Output ───────────────────────────────────────────────────────────

    private safeConnect(source: AudioNode, destination: AudioNode): void {
        if (!source || !destination) return;

        let sourceConns = this.connections.get(source);
        if (!sourceConns) {
            sourceConns = new Set();
            this.connections.set(source, sourceConns);
        }

        if (!sourceConns.has(destination)) {
            source.connect(destination);
            sourceConns.add(destination);
        }
    }

    private safeDisconnect(source: AudioNode): void {
        if (!source) return;
        source.disconnect();
        this.connections.delete(source);
    }

    /**
     * Drop one edge, and forget it.
     *
     * `safeConnect` skips a connection it believes already exists, so a raw
     * `disconnect()` leaves the graph and the bookkeeping disagreeing and every
     * later reconnect is silently ignored. Disconnecting the master output that
     * way left it permanently detached from the speakers: meters still moved,
     * because they read the mix upstream of it, and nothing could be heard.
     */
    private safeDisconnectFrom(source: AudioNode, destination: AudioNode): void {
        if (!source || !destination) return;
        try {
            source.disconnect(destination);
        } catch {
            // Not connected — nothing to drop.
        }
        this.connections.get(source)?.delete(destination);
    }

    /**
     * Set master output volume.
     */
    setMasterVolume(volume: number): void {
        if (!this.outputNode) return;

        // Writing a non-finite value to an AudioParam throws and takes the whole
        // render down. A project saved before `masterVolume` existed deserialises
        // as undefined, so guard here rather than trusting every caller.
        if (!Number.isFinite(volume)) {
            console.warn('[RoutingEngine] Ignoring non-finite master volume:', volume);
            return;
        }

        this.outputNode.gain.value = Math.max(0, Math.min(1, volume));
    }

    /**
     * Get master output volume.
     */
    getMasterVolume(): number {
        return this.outputNode?.gain.value || 1.0;
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
                console.error('[RoutingEngine] Event listener error:', error);
            }
        });
    }

    // ── Public Accessors ─────────────────────────────────────────────────────────

    /**
     * Get track node chain for a track ID (public accessor).
     * Returns null if track not found.
     */
    getTrackNodes(trackId: string): TrackNodeChain | null {
        return this.trackNodes.get(trackId) ?? null;
    }

    isTrackMuted(trackId: string): boolean {
        return this.trackNodes.get(trackId)?.isMuted ?? false;
    }

    isTrackSoloed(trackId: string): boolean {
        return this.trackNodes.get(trackId)?.isSoloed ?? false;
    }

    hasAnySolo(): boolean {
        return this.soloedTracks.size > 0;
    }

    getTrackCount(): number {
        return this.trackNodes.size;
    }

    getBusCount(): number {
        return this.busNodes.size;
    }

    getInputCount(): number {
        return this.inputNodes.size;
    }

    getRoutingGraph(): { tracks: string[], buses: string[], inputs: string[] } {
        return {
            tracks: Array.from(this.trackNodes.keys()),
            buses: Array.from(this.busNodes.keys()),
            inputs: Array.from(this.inputNodes.keys())
        };
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────────

    dispose(): void {
        // Disconnect all inputs
        this.inputNodes.forEach(node => this.safeDisconnect(node));
        this.inputNodes.clear();

        // Disconnect all tracks
        const trackIds = Array.from(this.trackNodes.keys());
        trackIds.forEach(id => this.removeTrack(id));

        // Disconnect all buses
        const busIds = Array.from(this.busNodes.keys());
        busIds.forEach(id => this.removeBus(id));

        // Disconnect master
        if (this.masterGain) {
            this.safeDisconnect(this.masterGain);
            this.nodePool?.releaseGain(this.masterGain);
        }
        if (this.outputNode) {
            this.safeDisconnect(this.outputNode);
            this.nodePool?.releaseGain(this.outputNode);
        }

        this.nodePool?.clear();
        this.connections.clear();
        this.eventListeners = [];
        console.log('[RoutingEngine] Disposed');
    }

}

// ─── Singleton Export ─────────────────────────────────────────────────────────────

export const routingEngine = new RoutingEngine();

// ─── Convenience Exports ─────────────────────────────────────────────────────────

export const initializeRouting = () => routingEngine.initialize();
export const createTrack = (track: AudioTrack) => routingEngine.createTrack(track);
export const updateTrack = (trackId: string, updates: Partial<AudioTrack>) => routingEngine.updateTrack(trackId, updates);
export const createBus = (bus: AudioBus) => routingEngine.createBus(bus);
export const setMasterVolume = (volume: number) => routingEngine.setMasterVolume(volume);
