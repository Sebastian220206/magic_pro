/**
 * Tests for the plugin insert chain.
 *
 * Context: before this existed, no plugin in the DAW processed audio —
 * `createEffectNode()` built a pass-through gain and `updateTrackPlugins()` only
 * recomputed latency. These tests pin the chain's contract: correct linking,
 * identity-preserving reorder, bypass removal, and disposal.
 */

import { InsertChain, type InsertProcessor } from '@/engine/audioEngine/insertChain';
import type { PluginSpec } from '@/engine/plugins/pluginSpec';

/** Records connect/disconnect so link order can be asserted. */
class FakeNode {
    connected: FakeNode[] = [];
    /** Whoever connected into this node most recently. */
    fedBy: FakeNode | null = null;
    gain = { value: 1, setTargetAtTime: jest.fn(), cancelScheduledValues: jest.fn() };

    connect(target: FakeNode) { this.connected.push(target); target.fedBy = this; return target; }
    disconnect() { this.connected = []; }
}

class FakeProcessor implements InsertProcessor {
    readonly input = new FakeNode() as unknown as AudioNode;
    readonly output = new FakeNode() as unknown as AudioNode;
    disposed = 0;
    params: Record<string, number> = {};
    state: unknown;

    constructor(public readonly id: string, private latency = 0) { }

    setParams(p: Record<string, number>) { this.params = { ...this.params, ...p }; }
    getLatencySamples() { return this.latency; }
    getState() { return this.state; }
    setState(s: unknown) { this.state = s; }
    dispose() { this.disposed += 1; }
}

const spec = (instanceId: string, overrides: Partial<PluginSpec> = {}): PluginSpec => ({
    instanceId,
    pluginId: 'magic.eq',
    format: 'builtin',
    enabled: true,
    insertPoint: 'pre',
    params: {},
    ...overrides,
});

function setup(latencies: Record<string, number> = {}) {
    const head = new FakeNode();
    const tail = new FakeNode();
    const created: FakeProcessor[] = [];

    const factory = jest.fn(async (_ctx: BaseAudioContext, s: PluginSpec) => {
        const p = new FakeProcessor(s.instanceId, latencies[s.instanceId] ?? 0);
        created.push(p);
        return p;
    });

    // The chain owns a fade node of its own, so the context must be able to
    // make one. It must never fade the tail: for the master chain the tail is
    // the master output gain, and writing to it there decayed the whole mix.
    const ctx = {
        currentTime: 0,
        createGain: () => new FakeNode(),
    } as unknown as BaseAudioContext;
    const chain = new InsertChain(
        ctx,
        head as unknown as AudioNode,
        tail as unknown as AudioNode,
        factory,
    );

    // The chain's own fade node is the last hop before the tail.
    const fade = () => tail.fedBy;

    return { chain, head, tail, created, factory, fade };
}

/** Follow the graph from head and report the processors passed through. */
function linkOrder(head: FakeNode, created: FakeProcessor[], tail: FakeNode): string[] {
    const path: string[] = [];
    let node: FakeNode = head;
    const fade = tail.fedBy;

    for (let guard = 0; guard < 20; guard++) {
        const next = node.connected[0] as unknown as FakeNode | undefined;
        if (!next) break;
        // The chain ends at its own fade node, which is wired to the tail once
        // at construction and never rewired.
        if (next === tail || next === fade) break;
        const owner = created.find(p => (p.input as unknown as FakeNode) === next);
        if (!owner) break;
        path.push(owner.id);
        node = owner.output as unknown as FakeNode;
    }
    return path;
}

describe('InsertChain — linking', () => {
    test('connects straight through when empty', async () => {
        const { chain, head, tail } = setup();
        await chain.setSpecs([]);

        const fade = tail.fedBy!;
        expect(head.connected).toContain(fade);
        expect(fade.connected).toContain(tail);
    });

    test('links head → p0 → p1 → tail', async () => {
        const { chain, head, tail, created } = setup();
        await chain.setSpecs([spec('a'), spec('b')]);

        expect(linkOrder(head, created, tail)).toEqual(['a', 'b']);
        const last = created[1].output as unknown as FakeNode;
        expect(last.connected).toContain(tail.fedBy!);
    });

    test('creates one processor per spec', async () => {
        const { chain, factory } = setup();
        await chain.setSpecs([spec('a'), spec('b'), spec('c')]);

        expect(factory).toHaveBeenCalledTimes(3);
    });

    test('skips a plugin the factory cannot build', async () => {
        const head = new FakeNode();
        const tail = new FakeNode();
        const chain = new InsertChain(
            { currentTime: 0, createGain: () => new FakeNode() } as unknown as BaseAudioContext,
            head as unknown as AudioNode,
            tail as unknown as AudioNode,
            async () => null,
        );

        await chain.setSpecs([spec('missing')]);

        // Chain still passes audio rather than going silent.
        expect(head.connected).toContain(tail.fedBy!);
        expect(chain.getInstanceIds()).toEqual([]);
    });
});

describe('InsertChain — bypass', () => {
    test('a disabled plugin is removed from the signal path', async () => {
        const { chain, head, tail, created } = setup();
        await chain.setSpecs([spec('a'), spec('b', { enabled: false }), spec('c')]);

        expect(linkOrder(head, created, tail)).toEqual(['a', 'c']);
    });

    test('a bypassed plugin is kept instantiated, not disposed', async () => {
        const { chain, created } = setup();
        await chain.setSpecs([spec('a')]);
        await chain.setSpecs([spec('a', { enabled: false })]);

        expect(created[0].disposed).toBe(0);
        expect(chain.getProcessor('a')).not.toBeNull();
    });

    test('a bypassed plugin contributes no latency', async () => {
        const { chain } = setup({ a: 64 });
        await chain.setSpecs([spec('a')]);
        expect(chain.getLatencySamples()).toBe(64);

        await chain.setSpecs([spec('a', { enabled: false })]);
        expect(chain.getLatencySamples()).toBe(0);
    });
});

describe('InsertChain — reorder and diffing', () => {
    test('reorder preserves processor identity', async () => {
        // Rebuilding would drop each plugin's DSP state (filter memory,
        // reverb tail) and cost a load spike on every drag.
        const { chain } = setup();
        await chain.setSpecs([spec('a'), spec('b')]);
        const a = chain.getProcessor('a');
        const b = chain.getProcessor('b');

        await chain.setSpecs([spec('b'), spec('a')]);

        expect(chain.getProcessor('a')).toBe(a);
        expect(chain.getProcessor('b')).toBe(b);
    });

    test('reorder relinks in the new order', async () => {
        const { chain, head, tail, created } = setup();
        await chain.setSpecs([spec('a'), spec('b')]);
        await chain.setSpecs([spec('b'), spec('a')]);

        expect(linkOrder(head, created, tail)).toEqual(['b', 'a']);
    });

    test('reorder does not rebuild processors', async () => {
        const { chain, factory } = setup();
        await chain.setSpecs([spec('a'), spec('b')]);
        await chain.setSpecs([spec('b'), spec('a')]);

        expect(factory).toHaveBeenCalledTimes(2);
    });

    test('a removed plugin is disposed exactly once', async () => {
        const { chain, created } = setup();
        await chain.setSpecs([spec('a'), spec('b')]);
        await chain.setSpecs([spec('a')]);

        const b = created.find(p => p.id === 'b')!;
        expect(b.disposed).toBe(1);
        expect(chain.getProcessor('b')).toBeNull();
    });

    test('replacing the plugin in a slot rebuilds it', async () => {
        const { chain, factory } = setup();
        await chain.setSpecs([spec('a', { pluginId: 'magic.eq' })]);
        await chain.setSpecs([spec('a', { pluginId: 'magic.reverb' })]);

        expect(factory).toHaveBeenCalledTimes(2);
    });

    test('params reach a reused processor', async () => {
        const { chain } = setup();
        await chain.setSpecs([spec('a')]);
        await chain.setSpecs([spec('a', { params: { gain: 6 } })]);

        expect((chain.getProcessor('a') as FakeProcessor).params).toEqual({ gain: 6 });
    });

    test('state is restored on a newly created processor', async () => {
        const { chain } = setup();
        await chain.setSpecs([spec('a', { state: { preset: 'vocal' } })]);

        expect((chain.getProcessor('a') as FakeProcessor).state).toEqual({ preset: 'vocal' });
    });
});

describe('InsertChain — latency', () => {
    test('sums enabled plugins', async () => {
        const { chain } = setup({ a: 64, b: 512 });
        await chain.setSpecs([spec('a'), spec('b')]);

        expect(chain.getLatencySamples()).toBe(576);
    });

    test('is zero for an empty chain', async () => {
        const { chain } = setup();
        await chain.setSpecs([]);
        expect(chain.getLatencySamples()).toBe(0);
    });
});

describe('InsertChain — lifecycle', () => {
    test('dispose releases every processor', async () => {
        const { chain, created } = setup();
        await chain.setSpecs([spec('a'), spec('b')]);

        chain.dispose();

        expect(created.every(p => p.disposed === 1)).toBe(true);
        expect(chain.getInstanceIds()).toEqual([]);
    });

    test('overlapping updates are serialised, last one wins', async () => {
        const { chain } = setup();

        // Fired without awaiting, as the store does on rapid edits.
        const first = chain.setSpecs([spec('a'), spec('b')]);
        const second = chain.setSpecs([spec('c')]);
        await Promise.all([first, second]);

        expect(chain.getInstanceIds()).toEqual(['c']);
    });
});

describe('InsertChain — the tail is not ours to fade', () => {
    /*
     * The relink fade used to be applied to the tail. For the master chain the
     * tail is the master output gain, so rebuilding the chain wrote to a node
     * this class does not own — and it captured the level to restore by reading
     * `gain.value` live. `setTargetAtTime` only approaches its target, so the
     * next rebuild read the gain a few milliseconds into the previous restore
     * ramp and captured a fraction of the real level.
     *
     * Measured in a browser, three master-plugin toggles in a row took the mix
     * from audible to nothing reaching the output, with every meter still
     * moving because they read upstream of it.
     */
    test('never touches the tail gain, however many rebuilds', async () => {
        const { chain, tail } = setup();

        await chain.setSpecs([spec('a')]);
        await chain.setSpecs([spec('a'), spec('b')]);
        await chain.setSpecs([spec('b')]);
        await chain.setSpecs([]);

        expect(tail.gain.setTargetAtTime).not.toHaveBeenCalled();
        expect(tail.gain.cancelScheduledValues).not.toHaveBeenCalled();
        expect(tail.gain.value).toBe(1);
    });

    test('leaves its own fade node back at unity after a rebuild', async () => {
        const { chain, tail } = setup();
        await chain.setSpecs([spec('a')]);

        const fade = tail.fedBy!;
        const restored = fade.gain.setTargetAtTime.mock.calls.at(-1);
        // Unity is a constant, so nothing has to be read back off a parameter
        // that may still be ramping — which is what made this decay.
        expect(restored?.[0]).toBe(1);
    });

    test('keeps the tail fed no matter how the chain is rebuilt', async () => {
        const { chain, tail } = setup();
        const fade = tail.fedBy!;

        await chain.setSpecs([spec('a'), spec('b')]);
        await chain.setSpecs([]);
        await chain.setSpecs([spec('c')]);

        // The fade node is wired to the tail once and never rewired, so the
        // last hop to the output cannot be lost by a rebuild.
        expect(fade.connected).toContain(tail);
    });
});
