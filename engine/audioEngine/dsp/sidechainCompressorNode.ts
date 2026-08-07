/**
 * sidechainCompressorNode.ts
 * Host side of the sidechain compressor: module loading, node construction and
 * the `InsertProcessor` wrapper that lets it sit in a normal insert chain.
 *
 * The node has **two inputs**. Input 0 is the signal being compressed and is
 * what `InsertChain` links; input 1 is the key, patched separately by
 * `routingEngine` from whichever track is doing the ducking.
 */

import type { InsertProcessor } from '../insertChain';
import {
    SIDECHAIN_COMPRESSOR_PROCESSOR,
    DEFAULT_SIDECHAIN_PARAMS,
    buildSidechainWorkletSource,
} from './sidechainCompressorCore';

/** Input index the key signal is patched into. */
export const SIDECHAIN_KEY_INPUT = 1;

/**
 * Worklet modules are per-context and `addModule` throws on a second
 * registration of the same processor name, so the promise is memoised per
 * context. A `WeakMap` keeps offline render contexts from leaking.
 */
const loaded = new WeakMap<BaseAudioContext, Promise<void>>();

/** Register the processor on `ctx`. Idempotent, and safe to await repeatedly. */
export function ensureSidechainWorklet(ctx: BaseAudioContext): Promise<void> {
    const existing = loaded.get(ctx);
    if (existing) return existing;

    const promise = (async () => {
        const source = buildSidechainWorkletSource();
        const url = URL.createObjectURL(new Blob([source], { type: 'application/javascript' }));
        try {
            await ctx.audioWorklet.addModule(url);
        } finally {
            // The module is compiled by the time addModule settles, so the blob
            // can go regardless of the outcome.
            URL.revokeObjectURL(url);
        }
    })().catch(error => {
        // Clear the memo so a later attempt can retry rather than inheriting a
        // rejection forever.
        loaded.delete(ctx);
        throw error;
    });

    loaded.set(ctx, promise);
    return promise;
}

/** True when the context can host an AudioWorklet at all. */
export function supportsAudioWorklet(ctx: BaseAudioContext | null | undefined): boolean {
    return !!ctx && typeof (ctx as BaseAudioContext).audioWorklet?.addModule === 'function'
        && typeof AudioWorkletNode !== 'undefined';
}

export interface SidechainCompressorOptions {
    channelCount?: number;
    lookaheadMs?: number;
}

/**
 * Build the node. The caller must have awaited `ensureSidechainWorklet` on the
 * same context.
 */
export function createSidechainCompressorNode(
    ctx: BaseAudioContext,
    options: SidechainCompressorOptions = {},
): AudioWorkletNode {
    const node = new AudioWorkletNode(ctx, SIDECHAIN_COMPRESSOR_PROCESSOR, {
        numberOfInputs: 2,
        numberOfOutputs: 1,
        outputChannelCount: [options.channelCount ?? 2],
        channelCount: options.channelCount ?? 2,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
    });

    if (options.lookaheadMs) {
        node.port.postMessage({ type: 'lookahead', lookaheadMs: options.lookaheadMs });
    }
    return node;
}

/**
 * `InsertProcessor` wrapper.
 *
 * `input` and `output` are the node itself, so `InsertChain` links input 0 and
 * the output normally and never has to know about the key input.
 */
export class SidechainCompressorProcessor implements InsertProcessor {
    readonly input: AudioNode;
    readonly output: AudioNode;

    private readonly node: AudioWorkletNode;
    private readonly ctx: BaseAudioContext;
    private lookaheadMs: number;
    /** Latest reduction reported by the processor, dB (≤ 0). */
    private reductionDb = 0;
    private keySource: AudioNode | null = null;
    private disposed = false;

    constructor(ctx: BaseAudioContext, options: SidechainCompressorOptions = {}) {
        this.ctx = ctx;
        this.lookaheadMs = options.lookaheadMs ?? 0;
        this.node = createSidechainCompressorNode(ctx, options);
        this.input = this.node;
        this.output = this.node;

        this.node.port.onmessage = (event: MessageEvent) => {
            const data = event.data as { type?: string; db?: number } | undefined;
            if (data?.type === 'reduction' && typeof data.db === 'number') {
                this.reductionDb = data.db;
            }
        };
    }

    /** Gain reduction currently being applied, in dB (≤ 0). */
    getReductionDb(): number {
        return this.reductionDb;
    }

    /**
     * Patch a key signal into input 1.
     *
     * Replaces any previous key. Passing null returns the node to keying off
     * its own input, which makes it an ordinary compressor.
     */
    setKeySource(source: AudioNode | null): void {
        if (this.disposed) return;

        if (this.keySource) {
            try {
                this.keySource.disconnect(this.node, 0, SIDECHAIN_KEY_INPUT);
            } catch {
                // Already disconnected, or was never connected.
            }
        }

        this.keySource = source;
        if (source) {
            try {
                source.connect(this.node, 0, SIDECHAIN_KEY_INPUT);
            } catch (error) {
                console.warn('[Sidechain] Could not patch the key signal:', error);
                this.keySource = null;
            }
        }
    }

    setParams(params: Record<string, number>): void {
        if (this.disposed) return;

        for (const [name, value] of Object.entries(params)) {
            if (!Number.isFinite(value)) continue;

            // Lookahead is a buffer size, not an AudioParam — it has to be
            // rebuilt on the processor side.
            if (name === 'lookaheadMs') {
                const next = Math.max(0, Math.min(50, value));
                if (next !== this.lookaheadMs) {
                    this.lookaheadMs = next;
                    this.node.port.postMessage({ type: 'lookahead', lookaheadMs: next });
                }
                continue;
            }

            const param = this.node.parameters.get(name);
            if (!param) continue;
            // Ramp rather than jump: a stepped threshold zippers.
            param.setTargetAtTime(value, this.ctx.currentTime, 0.01);
        }
    }

    /** Lookahead is the only latency this introduces. */
    getLatencySamples(): number {
        return Math.round((this.lookaheadMs / 1000) * this.ctx.sampleRate);
    }

    getState(): unknown {
        const state: Record<string, number> = { lookaheadMs: this.lookaheadMs };
        for (const name of Object.keys(DEFAULT_SIDECHAIN_PARAMS)) {
            const param = this.node.parameters.get(name);
            if (param) state[name] = param.value;
        }
        return state;
    }

    setState(state: unknown): void {
        if (state && typeof state === 'object') {
            this.setParams(state as Record<string, number>);
        }
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;

        this.setKeySource(null);
        this.node.port.onmessage = null;
        try {
            this.node.disconnect();
        } catch {
            // Already torn down.
        }
    }
}

/**
 * Build a ready-to-use processor, loading the worklet if needed.
 *
 * Returns null when the context cannot host a worklet, so callers can fall back
 * rather than losing the plugin slot entirely.
 */
export async function createSidechainCompressor(
    ctx: BaseAudioContext,
    options: SidechainCompressorOptions = {},
): Promise<SidechainCompressorProcessor | null> {
    if (!supportsAudioWorklet(ctx)) return null;

    try {
        await ensureSidechainWorklet(ctx);
        return new SidechainCompressorProcessor(ctx, options);
    } catch (error) {
        console.warn('[Sidechain] Compressor worklet unavailable:', error);
        return null;
    }
}
