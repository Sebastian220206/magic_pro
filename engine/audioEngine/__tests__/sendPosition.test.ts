/**
 * Where a send taps its channel.
 *
 * The Send slot offers Post Pan, Post Fader and Pre Fader. Those are only
 * worth offering if they move the tap in the audio graph — otherwise the menu
 * changes a label and nothing else, which is the failure this project keeps
 * producing.
 *
 *   pre-fader  → the insert chain's output: after the plug-ins, before the
 *                fader, so the send holds its level while the fader moves
 *   post-fader → the fader itself, before the panner
 *   post-pan   → the end of the channel, which is what every send used to get
 */

import { routingEngine } from '../routingEngine';

jest.mock('../audioContext', () => ({
    audioContextManager: { getContext: jest.fn(), initialize: jest.fn() },
}));

type FakeNode = {
    connect: jest.Mock;
    disconnect: jest.Mock;
    gain?: { value: number; setValueAtTime: jest.Mock; setTargetAtTime: jest.Mock; cancelScheduledValues: jest.Mock };
};

const fakeGain = (): FakeNode => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    gain: {
        value: 1,
        setValueAtTime: jest.fn(),
        setTargetAtTime: jest.fn(),
        cancelScheduledValues: jest.fn(),
    },
});

describe('send tap position', () => {
    let ctx: any;
    let engine: any;

    beforeEach(async () => {
        ctx = {
            currentTime: 0,
            sampleRate: 48000,
            destination: { id: 'destination' },
            createGain: jest.fn(fakeGain),
            createStereoPanner: jest.fn(() => ({ connect: jest.fn(), disconnect: jest.fn(), pan: { value: 0 } })),
            createAnalyser: jest.fn(() => ({
                connect: jest.fn(), disconnect: jest.fn(), fftSize: 256,
                smoothingTimeConstant: 0.8, frequencyBinCount: 128,
                getFloatTimeDomainData: jest.fn(),
            })),
            createDelay: jest.fn(() => ({ connect: jest.fn(), disconnect: jest.fn(), delayTime: { value: 0, setTargetAtTime: jest.fn() } })),
            createChannelMerger: jest.fn(() => ({ connect: jest.fn(), disconnect: jest.fn() })),
            createChannelSplitter: jest.fn(() => ({ connect: jest.fn(), disconnect: jest.fn() })),
        };
        require('../audioContext').audioContextManager.getContext.mockReturnValue(ctx);

        await routingEngine.initialize();
        engine = routingEngine as any;

        routingEngine.createBus?.({ id: 'bus-1', name: 'Reverb', effects: [], volume: 1, pan: 0 } as never);
        routingEngine.createTrack({
            id: 't1', name: 'Vox', volume: 0.8, pan: 0, muted: false, solo: false,
            sends: [{ busId: 'bus-1', level: 0.3 }],
        } as never);
    });

    /** The node currently feeding this track's send gain. */
    const tapFeeding = (trackId: string, busId: string) => {
        const chain = engine.trackNodes.get(trackId);
        const sendGain = chain?.sendGains.get(busId);
        if (!chain || !sendGain) return null;
        for (const node of [
            ['preFader', engine.insertChains.get(trackId)?.output],
            ['postFader', chain.mainGain],
            ['postPan', chain.pdcDelay],
        ] as const) {
            const [name, candidate] = node;
            if (candidate?.connect?.mock?.calls?.some(([dest]: any[]) => dest === sendGain)) return name;
        }
        return null;
    };

    it('starts post-pan, which is what sends had before the choice existed', () => {
        expect(tapFeeding('t1', 'bus-1')).toBe('postPan');
    });

    it('moves the tap to the fader for a post-fader send', () => {
        routingEngine.setSendPosition('t1', 'bus-1', 'postFader');

        const chain = engine.trackNodes.get('t1');
        const sendGain = chain.sendGains.get('bus-1');
        // Connected to the fader...
        expect(chain.mainGain.connect.mock.calls.some(([d]: any[]) => d === sendGain)).toBe(true);
        // ...and dropped from the end of the channel, by that one edge only.
        expect(chain.pdcDelay.disconnect).toHaveBeenCalledWith(sendGain);
    });

    it('moves the tap ahead of the fader for a pre-fader send', () => {
        routingEngine.setSendPosition('t1', 'bus-1', 'preFader');

        const chain = engine.trackNodes.get('t1');
        const sendGain = chain.sendGains.get('bus-1');
        const insertOut = engine.insertChains.get('t1').output;
        expect(insertOut.connect.mock.calls.some(([d]: any[]) => d === sendGain)).toBe(true);
    });

    it('records the position it was moved to', () => {
        routingEngine.setSendPosition('t1', 'bus-1', 'preFader');
        expect(engine.trackNodes.get('t1').sendPositions.get('bus-1')).toBe('preFader');
    });

    it('does nothing when the position is unchanged', () => {
        const chain = engine.trackNodes.get('t1');
        chain.pdcDelay.disconnect.mockClear();

        routingEngine.setSendPosition('t1', 'bus-1', 'postPan');

        // Re-tapping the node it already taps would drop and remake the edge
        // for no reason, and a stray disconnect here is how audio goes missing.
        expect(chain.pdcDelay.disconnect).not.toHaveBeenCalled();
    });

    it('ignores a send or track that does not exist', () => {
        expect(() => routingEngine.setSendPosition('nope', 'bus-1', 'preFader')).not.toThrow();
        expect(() => routingEngine.setSendPosition('t1', 'nope', 'preFader')).not.toThrow();
    });
});
