/**
 * Pins that a node reconnects after being disconnected.
 *
 * `safeConnect` records every edge it makes and skips one it believes already
 * exists. `safeDisconnect` clears that record, but several places called the
 * raw `node.disconnect()` instead — which drops the edge in the audio graph
 * and leaves the record claiming it is still there. Every later reconnect was
 * then silently skipped.
 *
 * Switching the monitor to mono and back did exactly that to the master
 * output: it was detached from `ctx.destination` and never reattached, so the
 * whole app went silent — while the meters carried on moving, because they
 * read the mix upstream of the output. "The meter is showing but I can't hear
 * any sound" is the exact shape of this bug.
 */

import { routingEngine } from '../routingEngine';

jest.mock('../audioContext', () => ({
    audioContextManager: { getContext: jest.fn(), initialize: jest.fn() },
}));

type FakeNode = {
    connect: jest.Mock;
    disconnect: jest.Mock;
    gain?: { value: number; setValueAtTime: jest.Mock; setTargetAtTime: jest.Mock };
};

function fakeGain(): FakeNode {
    return {
        connect: jest.fn(),
        disconnect: jest.fn(),
        gain: { value: 1, setValueAtTime: jest.fn(), setTargetAtTime: jest.fn() },
    };
}

describe('routing reconnection', () => {
    let ctx: any;

    beforeEach(() => {
        ctx = {
            currentTime: 0,
            sampleRate: 48000,
            destination: { id: 'destination' },
            createGain: jest.fn(fakeGain),
            createStereoPanner: jest.fn(() => ({ connect: jest.fn(), disconnect: jest.fn(), pan: { value: 0 } })),
            createAnalyser: jest.fn(() => ({
                connect: jest.fn(), disconnect: jest.fn(), fftSize: 2048,
                smoothingTimeConstant: 0.8, frequencyBinCount: 1024,
                getFloatTimeDomainData: jest.fn(),
            })),
            createDelay: jest.fn(() => ({ connect: jest.fn(), disconnect: jest.fn(), delayTime: { value: 0, setTargetAtTime: jest.fn() } })),
            createChannelMerger: jest.fn(() => ({ connect: jest.fn(), disconnect: jest.fn() })),
            createChannelSplitter: jest.fn(() => ({ connect: jest.fn(), disconnect: jest.fn() })),
        };
        require('../audioContext').audioContextManager.getContext.mockReturnValue(ctx);
    });

    /** Every edge the engine has made from `node` to the audio destination. */
    const connectsToDestination = (node: FakeNode) =>
        node.connect.mock.calls.filter(([dest]) => dest === ctx.destination).length;

    it('reattaches the master output after a mono round trip', async () => {
        await routingEngine.initialize();
        const engine = routingEngine as unknown as { outputNode: FakeNode };
        const output = engine.outputNode;

        expect(connectsToDestination(output)).toBe(1);

        routingEngine.setMonitorMode('mono');
        routingEngine.setMonitorMode('stereo');

        // Before the fix this stayed at 1: the raw disconnect left the
        // bookkeeping claiming the edge existed, so the reconnect was skipped
        // and nothing reached the speakers again.
        expect(connectsToDestination(output)).toBe(2);
    });

    it('survives several mono round trips', async () => {
        await routingEngine.initialize();
        const engine = routingEngine as unknown as { outputNode: FakeNode };
        const output = engine.outputNode;

        for (let i = 0; i < 3; i++) {
            routingEngine.setMonitorMode('mono');
            routingEngine.setMonitorMode('stereo');
        }

        expect(connectsToDestination(output)).toBe(4);
    });

    it('does not connect twice when nothing was disconnected', async () => {
        await routingEngine.initialize();
        const engine = routingEngine as unknown as { outputNode: FakeNode };
        const output = engine.outputNode;

        // Asking for the mode it is already in must not stack a second edge —
        // that is what the bookkeeping is for.
        routingEngine.setMonitorMode('stereo');
        routingEngine.setMonitorMode('stereo');

        expect(connectsToDestination(output)).toBe(1);
    });
});
