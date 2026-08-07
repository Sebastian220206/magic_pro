/**
 * wamProcessor.ts
 * Adapts a Web Audio Module to the DAW's `InsertProcessor` contract.
 *
 * A WAM is a single `WamNode`, so `input` and `output` are the same node — the
 * insert chain's `connect(next.input); cursor = next.output` idiom needs no
 * special case for it.
 *
 * Parameter and state calls on a WamNode are asynchronous (they round-trip to
 * the AudioWorklet), while `InsertProcessor` is synchronous because the chain
 * and the UI call it from event handlers. Writes are therefore fire-and-forget
 * and reads are served from a cache kept warm in the background.
 */

import type { InsertProcessor } from '../../audioEngine/insertChain';
import type { WamNodeLike, WamParameterInfoLike, WebAudioModuleInstance } from './wamLoader';

export class WamInsertProcessor implements InsertProcessor {
    private latencySamples = 0;
    private lastState: unknown;
    private paramInfo: Record<string, WamParameterInfoLike> = {};
    private destroyed = false;

    constructor(private readonly instance: WebAudioModuleInstance) { }

    get node(): WamNodeLike {
        return this.instance.audioNode;
    }

    get input(): AudioNode {
        return this.instance.audioNode;
    }

    get output(): AudioNode {
        return this.instance.audioNode;
    }

    /**
     * Read the plugin's parameter list and reported latency.
     *
     * Called once after construction; both are async on a WamNode, so they
     * cannot be fetched from the synchronous accessors below.
     */
    async prime(): Promise<void> {
        const node = this.instance.audioNode;

        try {
            this.paramInfo = await node.getParameterInfo();
        } catch (error) {
            console.warn('[WAM] Could not read parameter info:', error);
        }

        try {
            const delay = await node.getCompensationDelay?.();
            this.latencySamples = Number.isFinite(delay) ? Math.max(0, Number(delay)) : 0;
        } catch {
            this.latencySamples = 0;
        }
    }

    /** Parameter metadata, for generating a UI when the plugin ships no GUI. */
    getParameterInfo(): Record<string, WamParameterInfoLike> {
        return this.paramInfo;
    }

    setParams(params: Record<string, number>): void {
        if (this.destroyed || !params) return;
        const entries = Object.entries(params);
        if (entries.length === 0) return;

        // WAM expects descriptor objects, not bare numbers.
        const values: Record<string, { id: string; value: number }> = {};
        for (const [id, value] of entries) {
            if (!Number.isFinite(value)) continue;
            values[id] = { id, value };
        }

        void this.instance.audioNode.setParameterValues(values).catch(error => {
            console.warn('[WAM] Failed to set parameters:', error);
        });
    }

    getLatencySamples(): number {
        return this.latencySamples;
    }

    /**
     * The most recently captured plugin state.
     *
     * `WamNode.getState()` is async, so this returns the cached snapshot and
     * refreshes it for next time. Call `captureState()` and await it when the
     * value must be current — saving a project, for instance.
     */
    getState(): unknown {
        void this.captureState();
        return this.lastState;
    }

    /** Read the plugin's current state, updating the cache. */
    async captureState(): Promise<unknown> {
        if (this.destroyed) return this.lastState;
        try {
            this.lastState = await this.instance.audioNode.getState();
        } catch (error) {
            console.warn('[WAM] Could not read state:', error);
        }
        return this.lastState;
    }

    setState(state: unknown): void {
        if (this.destroyed || state === undefined || state === null) return;
        this.lastState = state;
        void this.instance.audioNode.setState(state).catch(error => {
            console.warn('[WAM] Failed to restore state:', error);
        });
    }

    /** Send a MIDI message to the plugin, for instrument WAMs. */
    scheduleMidi(bytes: number[], time?: number): void {
        if (this.destroyed) return;
        try {
            this.instance.audioNode.scheduleEvents({
                type: 'wam-midi',
                time,
                data: { bytes },
            });
        } catch (error) {
            console.warn('[WAM] Failed to schedule MIDI:', error);
        }
    }

    /** Mount the plugin's own GUI, when it provides one. */
    async createGui(): Promise<HTMLElement | null> {
        if (this.destroyed || !this.instance.createGui) return null;
        try {
            return await this.instance.createGui();
        } catch (error) {
            console.warn('[WAM] Failed to create GUI:', error);
            return null;
        }
    }

    destroyGui(element: HTMLElement): void {
        try {
            this.instance.destroyGui?.(element);
        } catch (error) {
            console.warn('[WAM] Failed to destroy GUI:', error);
        }
    }

    dispose(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        try {
            this.instance.audioNode.destroy?.();
        } catch {
            // Node already torn down.
        }
        try {
            this.instance.destroy?.();
        } catch {
            // Instance already torn down.
        }
    }
}
