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
    AudioRoute,
    RoutingNode,
    AudioEngineEvent,
    EventListener 
} from './types';
import { audioContextManager } from './audioContext';
import { AudioNodePool } from './nodePool';

// ─── Node Chain Types ────────────────────────────────────────────────────────

interface TrackNodeChain {
    trackId: string;
    inputGain: GainNode;
    preEffects: AudioEffectNode[];
    postEffects: AudioEffectNode[];
    sendGains: Map<string, GainNode>;
    mainGain: GainNode;
    panner: StereoPannerNode;
    analyzer: AnalyserNode;
    output: AudioNode;
    baseVolume: number;
    isMuted: boolean;
    isSoloed: boolean;
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

        // Connect to destination
        this.safeConnect(this.masterGain, this.outputNode);
        this.safeConnect(this.outputNode, this.ctx.destination);
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
            inputNode.disconnect();
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
        
        // Create send gains for each bus send
        const sendGains = new Map<string, GainNode>();
        if (normalizedTrack.sends) {
            normalizedTrack.sends.forEach(send => {
                const sendGain = this.nodePool!.getGain();
                sendGain.gain.value = send.amount;
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
            analyzer,
            output: mainGain,
            baseVolume: normalizedTrack.volume,
            isMuted: normalizedTrack.muted,
            isSoloed: normalizedTrack.solo,
        });

        console.log('[RoutingEngine] Track created:', normalizedTrack.id);
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
                sendGain.gain.setValueAtTime(Math.max(0, Math.min(1, send.amount)), now);
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


            this.soloedTracks.delete(trackId);
            this.trackNodes.delete(trackId);
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
     * Set master output volume.
     */
    setMasterVolume(volume: number): void {
        if (this.outputNode) {
            this.outputNode.gain.value = Math.max(0, Math.min(1, volume));
        }
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
