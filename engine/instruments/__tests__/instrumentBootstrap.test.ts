/**
 * Regression tests for instrument service lifetime.
 *
 * The instrument graph used to be owned by `useInstruments`, which only the
 * Library panel mounted — and whose cleanup called `service.dispose()`. Closing
 * the Library destroyed every loaded instrument, and under React StrictMode the
 * mount/unmount/mount cycle tore it down immediately after loading. Playback
 * then fell back silently to the built-in synth.
 */

const mockInitialize = jest.fn().mockResolvedValue(undefined);
const mockAssign = jest.fn().mockReturnValue(true);
const mockHas = jest.fn().mockReturnValue(false);

jest.mock('@/engine/instruments/instrumentService', () => ({
    getInstrumentService: () => ({
        initialize: mockInitialize,
        assignInstrument: mockAssign,
        hasInstrument: mockHas,
    }),
}));

const mockGetContext = jest.fn();
const mockCtxInitialize = jest.fn().mockResolvedValue(undefined);

jest.mock('@/engine/audioEngine/audioContext', () => ({
    audioContextManager: {
        getContext: () => mockGetContext(),
        initialize: () => mockCtxInitialize(),
    },
}));

import {
    __resetInstrumentBootstrap,
    ensureInstrumentService,
    initializeInstruments,
} from '@/engine/instruments/instrumentBootstrap';

describe('ensureInstrumentService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        __resetInstrumentBootstrap();
        mockGetContext.mockReturnValue({});
        mockInitialize.mockResolvedValue(undefined);
    });

    test('initialises the service once across repeated calls', async () => {
        await ensureInstrumentService();
        await ensureInstrumentService();
        await ensureInstrumentService();

        expect(mockInitialize).toHaveBeenCalledTimes(1);
    });

    test('concurrent callers share one initialisation', async () => {
        await Promise.all([
            ensureInstrumentService(),
            ensureInstrumentService(),
            ensureInstrumentService(),
        ]);

        expect(mockInitialize).toHaveBeenCalledTimes(1);
    });

    test('creates the audio context when it does not exist yet', async () => {
        mockGetContext.mockReturnValue(null);

        await ensureInstrumentService();

        expect(mockCtxInitialize).toHaveBeenCalled();
    });

    test('a failure can be retried rather than poisoning the memo', async () => {
        mockInitialize.mockRejectedValueOnce(new Error('no context yet'));

        await expect(ensureInstrumentService()).rejects.toThrow('no context yet');

        // The context becomes available later (e.g. after a user gesture).
        mockInitialize.mockResolvedValue(undefined);
        await expect(ensureInstrumentService()).resolves.toBeUndefined();
    });
});

describe('initializeInstruments', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        __resetInstrumentBootstrap();
        mockGetContext.mockReturnValue({});
        mockHas.mockReturnValue(false);
        mockAssign.mockReturnValue(true);
    });

    test('attaches instruments for tracks that name one', async () => {
        await initializeInstruments([
            { id: 'a', instrument: 'Grand Piano' },
            { id: 'b', instrument: 'Deep Bass' },
        ]);

        expect(mockAssign).toHaveBeenCalledWith('a', 'Grand Piano');
        expect(mockAssign).toHaveBeenCalledWith('b', 'Deep Bass');
    });

    test('skips tracks with no instrument', async () => {
        await initializeInstruments([{ id: 'a' }]);
        expect(mockAssign).not.toHaveBeenCalled();
    });

    test('does not reload an instrument that is already attached', async () => {
        mockHas.mockReturnValue(true);

        await initializeInstruments([{ id: 'a', instrument: 'Grand Piano' }]);

        expect(mockAssign).not.toHaveBeenCalled();
    });

    test('reports tracks whose instrument attached', async () => {
        const onReady = jest.fn();

        await initializeInstruments([{ id: 'a', instrument: 'Grand Piano' }], onReady);

        expect(onReady).toHaveBeenCalledWith('a', { instrumentLoaded: true });
    });

    test('does not report a track whose instrument failed to attach', async () => {
        mockAssign.mockReturnValue(false);
        const onReady = jest.fn();

        await initializeInstruments([{ id: 'a', instrument: 'Nonexistent' }], onReady);

        expect(onReady).not.toHaveBeenCalled();
    });

    test('exposes no disposal — panel lifecycle must not tear down the graph', () => {
        // The bootstrap module deliberately has no dispose export. Teardown
        // belongs to AudioEngineAdapter, not to whichever component mounted.
        const bootstrap = require('@/engine/instruments/instrumentBootstrap');
        expect(bootstrap.dispose).toBeUndefined();
        expect(bootstrap.disposeInstruments).toBeUndefined();
    });
});
