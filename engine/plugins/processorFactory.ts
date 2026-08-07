/**
 * processorFactory.ts
 * Builds an `InsertProcessor` for a plugin spec.
 *
 * The built-in branch adapts the effect implementations in
 * `engine/effects/plugins/`. Those were fully working Web Audio DSP that nothing
 * imported — they already expose `input` / `output` / `setBypass` / `getState` /
 * `setState` / `dispose`, so each wrapper is thin.
 *
 * A `wam` branch will be added here; the chain does not need to change for it.
 */

import type { InsertProcessor } from '../audioEngine/insertChain';
import type { PluginSpec } from './pluginSpec';
import { createSidechainCompressor } from '../audioEngine/dsp/sidechainCompressorNode';
import { BUILTIN_PLUGIN_IDS } from './pluginIds';
import {
    createCompressorPlugin,
    createDelayPlugin,
    createEQPlugin,
    createLimiterPlugin,
    createReverbPlugin,
} from '../effects/plugins';
import { createWamInstance } from './wam/wamLoader';
import { WamInsertProcessor } from './wam/wamProcessor';

/**
 * The shape every built-in effect already converges on. They were written
 * independently but share this contract exactly.
 */
interface BuiltinEffect {
    readonly input: AudioNode;
    readonly output: AudioNode;
    setBypass(bypass: boolean): void;
    getState(): unknown;
    setState(state: never): void;
    dispose(): void;
}

/**
 * Latency each built-in introduces, in samples.
 *
 * Only the limiter has any: it delays the signal by its lookahead window so it
 * can see peaks before they arrive. The value matches `PLUGIN_LATENCY_SAMPLES`
 * in `engine/audioEngine/latencyCompensation.ts`.
 */
const BUILTIN_LATENCY: Readonly<Record<string, number>> = {
    [BUILTIN_PLUGIN_IDS.limiter]: 64,
};

/**
 * Wraps a built-in effect as an `InsertProcessor`.
 *
 * Parameters arrive as a flat `Record<string, number>` from the store, while the
 * effects expose typed setters; `setState` is the common path both support.
 */
class BuiltinProcessor implements InsertProcessor {
    constructor(
        private readonly effect: BuiltinEffect,
        private readonly latencySamples: number,
    ) {
        // Bypass is handled by the chain excluding the node, so the effect
        // itself always runs wet. Two bypass mechanisms would fight.
        this.effect.setBypass(false);
    }

    get input(): AudioNode { return this.effect.input; }
    get output(): AudioNode { return this.effect.output; }

    setParams(params: Record<string, number>): void {
        if (!params || Object.keys(params).length === 0) return;
        try {
            this.effect.setState(params as never);
        } catch (error) {
            console.warn('[Plugin] Failed to apply parameters:', error);
        }
    }

    getLatencySamples(): number {
        return this.latencySamples;
    }

    getState(): unknown {
        try {
            return this.effect.getState();
        } catch {
            return undefined;
        }
    }

    setState(state: unknown): void {
        if (state === undefined || state === null) return;
        try {
            this.effect.setState(state as never);
        } catch (error) {
            console.warn('[Plugin] Failed to restore state:', error);
        }
    }

    dispose(): void {
        try {
            this.effect.dispose();
        } catch (error) {
            console.warn('[Plugin] Dispose failed:', error);
        }
    }
}

type BuiltinBuilder = (ctx: AudioContext) => BuiltinEffect;

const BUILTIN_BUILDERS: Readonly<Record<string, BuiltinBuilder>> = {
    [BUILTIN_PLUGIN_IDS.compressor]: ctx => createCompressorPlugin(ctx) as unknown as BuiltinEffect,
    [BUILTIN_PLUGIN_IDS.eq]: ctx => createEQPlugin(ctx) as unknown as BuiltinEffect,
    [BUILTIN_PLUGIN_IDS.reverb]: ctx => createReverbPlugin(ctx) as unknown as BuiltinEffect,
    [BUILTIN_PLUGIN_IDS.delay]: ctx => createDelayPlugin(ctx) as unknown as BuiltinEffect,
    [BUILTIN_PLUGIN_IDS.limiter]: ctx => createLimiterPlugin(ctx) as unknown as BuiltinEffect,
};

/** True when this factory can build the given plugin. */
export function canCreateProcessor(spec: PluginSpec): boolean {
    return spec.format === 'builtin'
        && (spec.pluginId in BUILTIN_BUILDERS
            || spec.pluginId === BUILTIN_PLUGIN_IDS.sidechainCompressor);
}

/**
 * Build the processor for a spec, or null when the plugin is unknown.
 *
 * Returning null rather than throwing lets a project containing a plugin this
 * build doesn't have still open — the slot is skipped and the rest of the chain
 * still plays.
 */
export async function createProcessor(
    ctx: BaseAudioContext,
    spec: PluginSpec,
): Promise<InsertProcessor | null> {
    // The sidechain compressor is an AudioWorklet with a second input rather
    // than a graph of built-in nodes, so it is built by its own module.
    if (spec.format === 'builtin' && spec.pluginId === BUILTIN_PLUGIN_IDS.sidechainCompressor) {
        const processor = await createSidechainCompressor(ctx, {
            lookaheadMs: typeof spec.params?.lookaheadMs === 'number' ? spec.params.lookaheadMs : 0,
        });
        if (processor && spec.params) processor.setParams(spec.params);
        return processor;
    }

    if (spec.format === 'wam') {
        const url = spec.wam?.url;
        if (!url) {
            console.warn(`[Plugin] WAM "${spec.pluginId}" has no url — skipping.`);
            return null;
        }
        try {
            const instance = await createWamInstance(ctx, url, spec.state);
            const processor = new WamInsertProcessor(instance);
            // Parameter metadata and reported latency are async on a WamNode,
            // so they are fetched once here rather than on every access.
            await processor.prime();
            return processor;
        } catch (error) {
            // A project referencing a plugin this build can't load still opens;
            // the slot is skipped and the rest of the chain plays.
            console.error(`[Plugin] Failed to load WAM "${spec.pluginId}" from ${url}:`, error);
            return null;
        }
    }

    const build = BUILTIN_BUILDERS[spec.pluginId];
    if (!build) return null;

    try {
        // The built-ins are typed against AudioContext but only use methods
        // present on BaseAudioContext, so they work in an OfflineAudioContext.
        const effect = build(ctx as AudioContext);
        return new BuiltinProcessor(effect, BUILTIN_LATENCY[spec.pluginId] ?? 0);
    } catch (error) {
        console.error(`[Plugin] Failed to create "${spec.pluginId}":`, error);
        return null;
    }
}
