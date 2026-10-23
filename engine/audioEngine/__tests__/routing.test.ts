/**
 * routing.test.ts
 * Logic validation for the RoutingEngine and NodePool.
 */

import { routingEngine } from '../routingEngine';

// Mock AudioContext Manager
jest.mock('../audioContext', () => ({
    audioContextManager: {
        getContext: jest.fn(),
    }
}));

describe('RoutingEngine & NodePool Logic', () => {
    let mockCtx: any;

    beforeEach(() => {
        mockCtx = {
            currentTime: 0,
            createGain: jest.fn(() => ({
                connect: jest.fn(),
                disconnect: jest.fn(),
                gain: { value: 1.0 }
            })),
            createStereoPanner: jest.fn(() => ({
                connect: jest.fn(),
                disconnect: jest.fn(),
                pan: { value: 0, setTargetAtTime: jest.fn() }
            })),
            createAnalyser: jest.fn(() => ({
                connect: jest.fn(),
                disconnect: jest.fn(),
                fftSize: 2048,
                smoothingTimeConstant: 0.8,
                frequencyBinCount: 1024,
                getFloatTimeDomainData: jest.fn(),
            })),
            createDelay: jest.fn(() => ({
                connect: jest.fn(),
                disconnect: jest.fn(),
                delayTime: { value: 0, setTargetAtTime: jest.fn() },
            })),
            sampleRate: 48000,
            destination: {}
        };
        require('../audioContext').audioContextManager.getContext.mockReturnValue(mockCtx);
        routingEngine.initialize();
        jest.clearAllMocks();
    });

    test('Node pooling: reuse gain nodes', () => {
        const pool = (routingEngine as any).nodePool;
        const initialGain = pool.getGain();
        pool.releaseGain(initialGain);
        
        const reusedGain = pool.getGain();
        expect(reusedGain).toBe(initialGain);
    });

    test('Safe connection: prevent duplicates', () => {
        const source = mockCtx.createGain();
        const dest = mockCtx.createGain();
        
        (routingEngine as any).safeConnect(source, dest);
        (routingEngine as any).safeConnect(source, dest); // Duplicate
        
        expect(source.connect).toHaveBeenCalledTimes(1);
    });

    test('Track creation and node tracking', () => {
        const track: any = {
            id: 'test-track',
            volume: 0.8,
            pan: 0,
            muted: false,
            sends: [],
            effects: []
        };
        
        routingEngine.createTrack(track);
        expect((routingEngine as any).trackNodes.has('test-track')).toBe(true);
        
        const chain = (routingEngine as any).trackNodes.get('test-track');
        expect(chain.mainGain.gain.value).toBe(0.8);
    });

    test('Clean disposal releases nodes to pool', () => {
        const pool = (routingEngine as any).nodePool;
        const initialGainsInPool = pool.gainPool.length;

        routingEngine.createTrack({ id: 't1', sends: [], effects: [], volume: 1, pan: 0 } as any);
        routingEngine.removeTrack('t1');

        // Track has inputGain and mainGain (2 gain nodes)
        expect(pool.gainPool.length).toBe(initialGainsInPool + 2);
    });

    describe('Master volume guards', () => {
        // Regression: a project whose stored settings predate `masterVolume`
        // deserialised it as undefined, and writing that to an AudioParam threw
        // "The provided float value is non-finite", crashing the whole workspace
        // on open.
        const outputGain = () => (routingEngine as any).outputNode?.gain;

        test.each([
            ['undefined', undefined],
            ['NaN', NaN],
            ['Infinity', Infinity],
        ])('ignores a %s volume instead of throwing', (_label, value) => {
            const before = outputGain()?.value;

            expect(() => routingEngine.setMasterVolume(value as number)).not.toThrow();
            expect(outputGain()?.value).toBe(before);
        });

        test('still applies finite volumes, clamped to 0..1', () => {
            routingEngine.setMasterVolume(0.5);
            expect(outputGain()?.value).toBe(0.5);

            routingEngine.setMasterVolume(3);
            expect(outputGain()?.value).toBe(1);

            routingEngine.setMasterVolume(-2);
            expect(outputGain()?.value).toBe(0);
        });
    });

    describe('Plugin delay compensation', () => {
        const chainFor = (id: string) => (routingEngine as any).trackNodes.get(id);
        /** The seconds passed to the most recent delay ramp for a track. */
        const compensationOf = (id: string) => {
            const calls = chainFor(id).pdcDelay.delayTime.setTargetAtTime.mock.calls;
            return calls.length ? calls[calls.length - 1][0] : 0;
        };

        beforeEach(() => {
            routingEngine.createTrack({ id: 'dry' } as never);
            routingEngine.createTrack({ id: 'latent' } as never);
        });

        test('every track gets a compensation delay node in its chain', () => {
            expect(chainFor('dry').pdcDelay).toBeDefined();
        });

        test('adds no delay when nothing reports latency', () => {
            routingEngine.recomputeLatencyCompensation();
            expect(compensationOf('dry')).toBe(0);
            expect(compensationOf('latent')).toBe(0);
        });

        test('delays clean tracks to match the highest-latency one', () => {
            // 512 samples at 48kHz ≈ 10.67ms
            routingEngine.updateTrackPlugins('latent', [{ pluginId: 'linear-phase-eq' }]);

            expect(compensationOf('dry')).toBeCloseTo(512 / 48000, 9);
            // The reference track is never pushed further out.
            expect(compensationOf('latent')).toBe(0);
        });

        test('reports the project latency', () => {
            routingEngine.updateTrackPlugins('latent', [{ pluginId: 'limiter' }]);

            expect(routingEngine.getProjectLatencySamples()).toBe(64);
            expect(routingEngine.getProjectLatencySeconds()).toBeCloseTo(64 / 48000, 9);
        });

        test('removing the latent track releases the compensation', () => {
            routingEngine.updateTrackPlugins('latent', [{ pluginId: 'linear-phase-eq' }]);
            expect(compensationOf('dry')).toBeGreaterThan(0);

            routingEngine.removeTrack('latent');

            expect(compensationOf('dry')).toBe(0);
            expect(routingEngine.getProjectLatencySamples()).toBe(0);
        });

        test('bypassing the plugin removes its latency', () => {
            routingEngine.updateTrackPlugins('latent', [{ pluginId: 'limiter' }]);
            expect(compensationOf('dry')).toBeGreaterThan(0);

            routingEngine.updateTrackPlugins('latent', [{ pluginId: 'limiter', enabled: false }]);

            expect(compensationOf('dry')).toBe(0);
        });
    });

    describe('Track Output Routing & Cycle Detection', () => {
        beforeEach(() => {
            routingEngine.createTrack({ id: 'track-A' });
            routingEngine.createTrack({ id: 'track-B' });
            routingEngine.createTrack({ id: 'bus-1' });
        });

        test('routes track output to another track/bus and reads it back', () => {
            const success = routingEngine.routeTrackOutput('track-A', 'bus-1');
            expect(success).toBe(true);
            expect(routingEngine.getTrackOutput('track-A')).toBe('bus-1');

            // Route back to master
            const reset = routingEngine.routeTrackOutput('track-A', null);
            expect(reset).toBe(true);
            expect(routingEngine.getTrackOutput('track-A')).toBeNull();
        });

        test('prevents direct feedback loops (A -> A)', () => {
            const loop = routingEngine.routeTrackOutput('track-A', 'track-A');
            expect(loop).toBe(false);
            expect(routingEngine.getTrackOutput('track-A')).toBeNull();
        });

        test('prevents indirect feedback loops (A -> B -> A)', () => {
            expect(routingEngine.routeTrackOutput('track-A', 'track-B')).toBe(true);
            const cycle = routingEngine.routeTrackOutput('track-B', 'track-A');
            expect(cycle).toBe(false);
            expect(routingEngine.getTrackOutput('track-B')).toBeNull();
        });

        test('master pan sets panner param with smoothing', () => {
            routingEngine.setMasterPan(0.5);
            const panner = (routingEngine as any).masterPanner;
            expect(panner.pan.setTargetAtTime).toHaveBeenCalledWith(0.5, 0, 0.02);
        });
    });
});

