/**
 * workletPluginNode.ts
 * The shared host side for single-input worklet effects: Gate, Expander,
 * Bitcrusher.
 *
 * `sidechainCompressorNode.ts` already solved module loading, support
 * detection and the `InsertProcessor` wrapper for its two-input compressor;
 * copying that file three times would fork the loading logic four ways.
 * This is the same shape generalised: each effect contributes a definition
 * (processor name, defaults, source builder) and gets loading, construction
 * and parameter plumbing for free.
 */

import type { InsertProcessor } from '../insertChain';
import { GATE_PROCESSOR, DEFAULT_GATE_PARAMS, buildGateWorkletSource } from './gateCore';
import { EXPANDER_PROCESSOR, DEFAULT_EXPANDER_PARAMS, buildExpanderWorkletSource } from './expanderCore';
import { BITCRUSHER_PROCESSOR, DEFAULT_BITCRUSHER_PARAMS, buildBitcrusherWorkletSource } from './bitcrusherCore';

export interface WorkletPluginDef {
    /** Registration name the worklet source registers. */
    processorName: string;
    /** Every AudioParam the processor declares, with defaults. */
    defaults: Record<string, number>;
    /** The complete module source. */
    buildSource: () => string;
}

export const GATE_WORKLET: WorkletPluginDef = {
    processorName: GATE_PROCESSOR,
    defaults: { ...DEFAULT_GATE_PARAMS },
    buildSource: buildGateWorkletSource,
};

export const EXPANDER_WORKLET: WorkletPluginDef = {
    processorName: EXPANDER_PROCESSOR,
    defaults: { ...DEFAULT_EXPANDER_PARAMS },
    buildSource: buildExpanderWorkletSource,
};

export const BITCRUSHER_WORKLET: WorkletPluginDef = {
    processorName: BITCRUSHER_PROCESSOR,
    defaults: { ...DEFAULT_BITCRUSHER_PARAMS },
    buildSource: buildBitcrusherWorkletSource,
};

/**
 * Registration promises, memoised per context and processor.
 *
 * Worklet modules are per-context and `addModule` throws on a second
 * registration of the same name — the sidechain loader memoises the same way,
 * keyed once because it serves one processor. A `WeakMap` keeps offline
 * render contexts from leaking.
 */
const loaded = new WeakMap<BaseAudioContext, Map<string, Promise<void>>>();

/** Register the processor on `ctx`. Idempotent, and safe to await repeatedly. */
export function ensureWorkletPlugin(ctx: BaseAudioContext, def: WorkletPluginDef): Promise<void> {
    let byName = loaded.get(ctx);
    if (!byName) {
        byName = new Map();
        loaded.set(ctx, byName);
    }

    const existing = byName.get(def.processorName);
    if (existing) return existing;

    const promise = (async () => {
        const url = URL.createObjectURL(new Blob([def.buildSource()], { type: 'application/javascript' }));
        try {
            await ctx.audioWorklet.addModule(url);
        } finally {
            // The module is compiled by the time addModule settles, so the
            // blob can go regardless of the outcome.
            URL.revokeObjectURL(url);
        }
    })().catch(error => {
        // Clear the memo so a later attempt can retry rather than inheriting a
        // rejection forever.
        byName?.delete(def.processorName);
        throw error;
    });

    byName.set(def.processorName, promise);
    return promise;
}

/** True when the context can host an AudioWorklet at all. */
export function supportsWorkletPlugin(ctx: BaseAudioContext | null | undefined): boolean {
    return !!ctx && typeof (ctx as BaseAudioContext).audioWorklet?.addModule === 'function'
        && typeof AudioWorkletNode !== 'undefined';
}

/**
 * `InsertProcessor` over a single-input worklet node.
 *
 * `input` and `output` are the node itself. Parameters arrive as plain
 * numbers and are ramped rather than jumped: a stepped gate threshold
 * zippers.
 */
export class WorkletPluginProcessor implements InsertProcessor {
    readonly input: AudioNode;
    readonly output: AudioNode;

    private readonly node: AudioWorkletNode;
    private readonly ctx: BaseAudioContext;
    private readonly def: WorkletPluginDef;
    private disposed = false;

    constructor(ctx: BaseAudioContext, def: WorkletPluginDef, channelCount = 2) {
        this.ctx = ctx;
        this.def = def;
        this.node = new AudioWorkletNode(ctx, def.processorName, {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [channelCount],
            channelCount,
            channelCountMode: 'explicit',
            channelInterpretation: 'speakers',
        });
        this.input = this.node;
        this.output = this.node;
    }

    setParams(params: Record<string, number>): void {
        if (this.disposed || !params) return;
        for (const [name, value] of Object.entries(params)) {
            if (!Number.isFinite(value)) continue;
            const param = this.node.parameters.get(name);
            if (!param) continue;
            param.setTargetAtTime(value, this.ctx.currentTime, 0.01);
        }
    }

    getLatencySamples(): number {
        return 0;
    }

    getState(): unknown {
        const state: Record<string, number> = {};
        for (const name of Object.keys(this.def.defaults)) {
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
 * Returns null when the context cannot host a worklet, so callers can fall
 * back rather than losing the plugin slot entirely.
 */
export async function createWorkletPlugin(
    ctx: BaseAudioContext,
    def: WorkletPluginDef,
): Promise<WorkletPluginProcessor | null> {
    if (!supportsWorkletPlugin(ctx)) return null;

    try {
        await ensureWorkletPlugin(ctx, def);
        return new WorkletPluginProcessor(ctx, def);
    } catch (error) {
        console.warn(`[Worklet] ${def.processorName} unavailable:`, error);
        return null;
    }
}
