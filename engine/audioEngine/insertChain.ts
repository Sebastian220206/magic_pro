/**
 * insertChain.ts
 * A track's plugin insert chain.
 *
 * This is the piece that was missing entirely: `routingEngine.createEffectNode()`
 * built a pass-through GainNode and `updateTrackPlugins()` only recomputed
 * latency, so no plugin in the DAW ever processed audio.
 *
 * The chain owns the segment between two fixed nodes (`head` → `tail`) and
 * relinks it whenever the plugin list changes:
 *
 *     head → [p0] → [p1] → … → tail        (bypassed plugins are skipped)
 *
 * Deliberately typed against `BaseAudioContext`, not `AudioContext`, so the same
 * class can build a chain inside an `OfflineAudioContext` for bounce/export.
 */

import type { PluginSpec } from '../plugins/pluginSpec';
import { isSameProcessor } from '../plugins/pluginSpec';

/**
 * One plugin instance, as the chain sees it.
 *
 * Implemented by the built-in Web Audio effects today and by Web Audio Modules
 * later — for a WAM, `input` and `output` are both the single `WamNode`.
 */
export interface InsertProcessor {
    readonly input: AudioNode;
    readonly output: AudioNode;
    setParams(params: Record<string, number>): void;
    /** Latency introduced, in samples, for delay compensation. */
    getLatencySamples(): number;
    getState(): unknown;
    setState(state: unknown): void;
    dispose(): void;
}

export type ProcessorFactory = (
    ctx: BaseAudioContext,
    spec: PluginSpec,
) => Promise<InsertProcessor | null>;

interface ChainEntry {
    spec: PluginSpec;
    processor: InsertProcessor;
}

/** Seconds of fade applied around a relink so reordering doesn't click. */
const RELINK_FADE = 0.008;

export class InsertChain {
    private entries: ChainEntry[] = [];
    /** Serialises rebuilds so overlapping updates cannot interleave. */
    private queue: Promise<void> = Promise.resolve();
    private disposed = false;

    constructor(
        private readonly ctx: BaseAudioContext,
        private readonly head: AudioNode,
        private readonly tail: AudioNode,
        private readonly createProcessor: ProcessorFactory,
    ) {
        // Start connected straight through; there are no plugins yet.
        this.safeConnect(this.head, this.tail);
    }

    /**
     * Reconcile the chain against a new plugin list.
     *
     * Processors are matched by instance id, so reordering reuses the existing
     * audio nodes rather than rebuilding them — which both avoids a load spike
     * and preserves each plugin's internal DSP state (filter memory, reverb
     * tails) across the move.
     */
    setSpecs(specs: PluginSpec[]): Promise<void> {
        this.queue = this.queue
            .then(() => this.applySpecs(specs))
            .catch(error => {
                console.error('[InsertChain] Failed to apply plugin chain:', error);
            });
        return this.queue;
    }

    private async applySpecs(specs: PluginSpec[]): Promise<void> {
        if (this.disposed) return;

        const previous = this.entries;
        const next: ChainEntry[] = [];
        const reused = new Set<InsertProcessor>();

        for (const spec of specs) {
            const existing = previous.find(e =>
                isSameProcessor(e.spec, spec) && !reused.has(e.processor));

            if (existing) {
                reused.add(existing.processor);
                existing.processor.setParams(spec.params);
                next.push({ spec, processor: existing.processor });
                continue;
            }

            const processor = await this.createProcessor(this.ctx, spec);
            if (!processor) {
                console.warn(`[InsertChain] No processor for "${spec.pluginId}" — skipping.`);
                continue;
            }
            if (spec.state !== undefined) processor.setState(spec.state);
            processor.setParams(spec.params);
            next.push({ spec, processor });
        }

        // A late-arriving update may have superseded this one.
        if (this.disposed) {
            next.forEach(e => { if (!reused.has(e.processor)) e.processor.dispose(); });
            return;
        }

        this.entries = next;
        await this.relink();

        // Anything not carried over is now detached and can be released.
        for (const entry of previous) {
            if (!reused.has(entry.processor)) entry.processor.dispose();
        }
    }

    /**
     * Rebuild the connections.
     *
     * Web Audio has no atomic relink, so the tail is briefly faded down around
     * the change. Without it, disconnecting a live graph clicks audibly.
     */
    private async relink(): Promise<void> {
        const gain = (this.tail as GainNode).gain;
        const canFade = !!gain && typeof gain.setTargetAtTime === 'function';
        const now = this.ctx.currentTime;

        let restore = 1;
        if (canFade) {
            restore = gain.value;
            gain.setTargetAtTime(0, now, RELINK_FADE / 3);
            await wait(RELINK_FADE * 1000);
        }

        this.safeDisconnect(this.head);
        this.entries.forEach(e => this.safeDisconnect(e.processor.output));

        // Bypassed plugins stay instantiated but leave the signal path, so their
        // latency correctly drops to zero for compensation purposes.
        const active = this.entries.filter(e => e.spec.enabled);

        let cursor: AudioNode = this.head;
        for (const entry of active) {
            this.safeConnect(cursor, entry.processor.input);
            cursor = entry.processor.output;
        }
        this.safeConnect(cursor, this.tail);

        if (canFade) {
            gain.setTargetAtTime(restore, this.ctx.currentTime, RELINK_FADE / 3);
        }
    }

    /** Total latency of the enabled plugins, in samples. */
    getLatencySamples(): number {
        return this.entries
            .filter(e => e.spec.enabled)
            .reduce((total, e) => total + Math.max(0, e.processor.getLatencySamples()), 0);
    }

    getProcessor(instanceId: string): InsertProcessor | null {
        return this.entries.find(e => e.spec.instanceId === instanceId)?.processor ?? null;
    }

    /** Current plugin instance ids, in signal order. */
    getInstanceIds(): string[] {
        return this.entries.map(e => e.spec.instanceId);
    }

    dispose(): void {
        this.disposed = true;
        this.safeDisconnect(this.head);
        for (const entry of this.entries) {
            this.safeDisconnect(entry.processor.output);
            entry.processor.dispose();
        }
        this.entries = [];
    }

    private safeConnect(from: AudioNode, to: AudioNode): void {
        try {
            from.connect(to);
        } catch (error) {
            console.warn('[InsertChain] connect failed:', error);
        }
    }

    private safeDisconnect(node: AudioNode): void {
        try {
            node.disconnect();
        } catch {
            // Already disconnected.
        }
    }
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
