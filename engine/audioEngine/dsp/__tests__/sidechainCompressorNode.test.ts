/**
 * Host side of the sidechain compressor: worklet loading, key routing and the
 * `InsertProcessor` contract.
 *
 * The DSP is covered by `sidechainCompressorCore.test.ts`; this covers the
 * plumbing around it, where the failure modes are silent — a key that never
 * connects, or a module registered twice.
 */

import {
    ensureSidechainWorklet,
    supportsAudioWorklet,
    SidechainCompressorProcessor,
    createSidechainCompressor,
    SIDECHAIN_KEY_INPUT,
} from '../sidechainCompressorNode';
import { SIDECHAIN_COMPRESSOR_PROCESSOR } from '../sidechainCompressorCore';

// ── Doubles ────────────────────────────────────────────────────────────────

let addModule: jest.Mock;
let constructedNodes: FakeWorkletNode[];

class FakeAudioParam {
    value: number;
    setTargetAtTime = jest.fn((v: number) => { this.value = v; });
    constructor(value: number) { this.value = value; }
}

class FakeWorkletNode {
    parameters = new Map<string, FakeAudioParam>([
        ['thresholdDb', new FakeAudioParam(-24)],
        ['ratio', new FakeAudioParam(4)],
        ['attackMs', new FakeAudioParam(5)],
        ['releaseMs', new FakeAudioParam(120)],
        ['kneeDb', new FakeAudioParam(6)],
        ['makeupDb', new FakeAudioParam(0)],
        ['mix', new FakeAudioParam(1)],
    ]);
    port = { postMessage: jest.fn(), onmessage: null as unknown };
    connect = jest.fn();
    disconnect = jest.fn();

    constructor(
        public ctx: unknown,
        public name: string,
        public options: Record<string, unknown>,
    ) {
        constructedNodes.push(this);
    }
}

/** A node that records what it was connected to, and on which input. */
function fakeSource() {
    return {
        connect: jest.fn(),
        disconnect: jest.fn(),
    } as unknown as AudioNode;
}

function fakeContext(overrides: Record<string, unknown> = {}) {
    return {
        sampleRate: 48000,
        currentTime: 0,
        audioWorklet: { addModule },
        ...overrides,
    } as unknown as BaseAudioContext;
}

beforeEach(() => {
    addModule = jest.fn().mockResolvedValue(undefined);
    constructedNodes = [];
    (globalThis as never as Record<string, unknown>).AudioWorkletNode = FakeWorkletNode;
    (globalThis as never as Record<string, unknown>).URL = {
        createObjectURL: jest.fn(() => 'blob:sidechain'),
        revokeObjectURL: jest.fn(),
    };
    (globalThis as never as Record<string, unknown>).Blob = class {
        constructor(public parts: unknown[], public options: unknown) { }
    };
});

// ── Loading ────────────────────────────────────────────────────────────────

describe('ensureSidechainWorklet', () => {
    it('registers the module once per context', async () => {
        const ctx = fakeContext();

        await ensureSidechainWorklet(ctx);
        await ensureSidechainWorklet(ctx);
        await ensureSidechainWorklet(ctx);

        // addModule throws on a second registration of the same processor
        // name, so the promise has to be memoised rather than re-run.
        expect(addModule).toHaveBeenCalledTimes(1);
    });

    it('registers separately for a different context', async () => {
        await ensureSidechainWorklet(fakeContext());
        await ensureSidechainWorklet(fakeContext());

        // Worklet modules are per-context: an offline render context needs its
        // own registration.
        expect(addModule).toHaveBeenCalledTimes(2);
    });

    it('revokes the blob url whether loading succeeds or fails', async () => {
        const revoke = (globalThis as never as { URL: { revokeObjectURL: jest.Mock } })
            .URL.revokeObjectURL;

        await ensureSidechainWorklet(fakeContext());
        expect(revoke).toHaveBeenCalledWith('blob:sidechain');

        addModule.mockRejectedValueOnce(new Error('bad module'));
        await expect(ensureSidechainWorklet(fakeContext())).rejects.toThrow('bad module');
        expect(revoke).toHaveBeenCalledTimes(2);
    });

    it('lets a failed load be retried instead of caching the rejection', async () => {
        const ctx = fakeContext();
        addModule.mockRejectedValueOnce(new Error('transient'));

        await expect(ensureSidechainWorklet(ctx)).rejects.toThrow('transient');

        addModule.mockResolvedValueOnce(undefined);
        await expect(ensureSidechainWorklet(ctx)).resolves.toBeUndefined();
    });
});

describe('supportsAudioWorklet', () => {
    it('is false without a context or an audioWorklet', () => {
        expect(supportsAudioWorklet(null)).toBe(false);
        expect(supportsAudioWorklet({} as BaseAudioContext)).toBe(false);
    });

    it('is true for a context that can host one', () => {
        expect(supportsAudioWorklet(fakeContext())).toBe(true);
    });
});

// ── Node construction ──────────────────────────────────────────────────────

describe('createSidechainCompressor', () => {
    it('builds a node with two inputs', async () => {
        const processor = await createSidechainCompressor(fakeContext());

        expect(processor).not.toBeNull();
        expect(constructedNodes[0].name).toBe(SIDECHAIN_COMPRESSOR_PROCESSOR);
        expect(constructedNodes[0].options.numberOfInputs).toBe(2);
        expect(constructedNodes[0].options.numberOfOutputs).toBe(1);
    });

    it('returns null rather than throwing when worklets are unavailable', async () => {
        expect(await createSidechainCompressor({} as BaseAudioContext)).toBeNull();
    });

    it('returns null when the module will not load', async () => {
        addModule.mockRejectedValue(new Error('nope'));
        expect(await createSidechainCompressor(fakeContext())).toBeNull();
    });
});

// ── Key routing ────────────────────────────────────────────────────────────

describe('key routing', () => {
    it('patches the key into input 1, not input 0', async () => {
        const processor = new SidechainCompressorProcessor(fakeContext());
        const source = fakeSource();

        processor.setKeySource(source);

        expect(source.connect).toHaveBeenCalledWith(
            constructedNodes[0], 0, SIDECHAIN_KEY_INPUT);
        expect(SIDECHAIN_KEY_INPUT).toBe(1);
    });

    it('disconnects the previous key before patching a new one', async () => {
        const processor = new SidechainCompressorProcessor(fakeContext());
        const first = fakeSource();
        const second = fakeSource();

        processor.setKeySource(first);
        processor.setKeySource(second);

        expect(first.disconnect).toHaveBeenCalledWith(
            constructedNodes[0], 0, SIDECHAIN_KEY_INPUT);
        expect(second.connect).toHaveBeenCalled();
    });

    it('clears the key when given null', () => {
        const processor = new SidechainCompressorProcessor(fakeContext());
        const source = fakeSource();

        processor.setKeySource(source);
        processor.setKeySource(null);

        expect(source.disconnect).toHaveBeenCalled();
    });

    it('survives a source that refuses the connection', () => {
        const processor = new SidechainCompressorProcessor(fakeContext());
        const bad = {
            connect: jest.fn(() => { throw new Error('wrong context'); }),
            disconnect: jest.fn(),
        } as unknown as AudioNode;

        expect(() => processor.setKeySource(bad)).not.toThrow();
        // Having failed, it must not be remembered as the current key.
        expect(() => processor.setKeySource(null)).not.toThrow();
    });
});

// ── InsertProcessor contract ───────────────────────────────────────────────

describe('InsertProcessor contract', () => {
    it('exposes the node as both input and output', () => {
        const processor = new SidechainCompressorProcessor(fakeContext());
        expect(processor.input).toBe(constructedNodes[0]);
        expect(processor.output).toBe(constructedNodes[0]);
    });

    it('ramps parameters rather than stepping them', () => {
        const processor = new SidechainCompressorProcessor(fakeContext());
        processor.setParams({ thresholdDb: -18, ratio: 8 });

        const node = constructedNodes[0];
        expect(node.parameters.get('thresholdDb')!.setTargetAtTime).toHaveBeenCalled();
        expect(node.parameters.get('ratio')!.value).toBe(8);
    });

    it('ignores unknown and non-finite parameters', () => {
        const processor = new SidechainCompressorProcessor(fakeContext());
        expect(() => processor.setParams({
            nonsense: 1, thresholdDb: NaN, ratio: Infinity,
        })).not.toThrow();
        expect(constructedNodes[0].parameters.get('thresholdDb')!.value).toBe(-24);
    });

    it('sends lookahead over the port, since it is a buffer not a param', () => {
        const processor = new SidechainCompressorProcessor(fakeContext());
        processor.setParams({ lookaheadMs: 5 });

        expect(constructedNodes[0].port.postMessage)
            .toHaveBeenCalledWith({ type: 'lookahead', lookaheadMs: 5 });
    });

    it('reports lookahead as latency so PDC can compensate', () => {
        const processor = new SidechainCompressorProcessor(fakeContext());
        expect(processor.getLatencySamples()).toBe(0);

        processor.setParams({ lookaheadMs: 5 });
        expect(processor.getLatencySamples()).toBe(Math.round(0.005 * 48000));
    });

    it('round-trips its state', () => {
        const processor = new SidechainCompressorProcessor(fakeContext());
        processor.setParams({ thresholdDb: -18, ratio: 8, lookaheadMs: 3 });

        const state = processor.getState() as Record<string, number>;
        expect(state.thresholdDb).toBe(-18);
        expect(state.lookaheadMs).toBe(3);

        const restored = new SidechainCompressorProcessor(fakeContext());
        restored.setState(state);
        expect(constructedNodes[1].parameters.get('thresholdDb')!.value).toBe(-18);
    });

    it('ignores malformed state', () => {
        const processor = new SidechainCompressorProcessor(fakeContext());
        expect(() => processor.setState(null)).not.toThrow();
        expect(() => processor.setState('nonsense')).not.toThrow();
    });

    it('tracks reported gain reduction', () => {
        const processor = new SidechainCompressorProcessor(fakeContext());
        expect(processor.getReductionDb()).toBe(0);

        const handler = constructedNodes[0].port.onmessage as (e: unknown) => void;
        handler({ data: { type: 'reduction', db: -6.2 } });
        expect(processor.getReductionDb()).toBeCloseTo(-6.2);
    });

    it('goes quiet after dispose', () => {
        const processor = new SidechainCompressorProcessor(fakeContext());
        const source = fakeSource();
        processor.setKeySource(source);

        processor.dispose();

        expect(constructedNodes[0].disconnect).toHaveBeenCalled();
        expect(constructedNodes[0].port.onmessage).toBeNull();

        // Further calls are inert rather than throwing.
        expect(() => processor.setParams({ ratio: 2 })).not.toThrow();
        expect(() => processor.setKeySource(fakeSource())).not.toThrow();
        expect(() => processor.dispose()).not.toThrow();
    });
});
