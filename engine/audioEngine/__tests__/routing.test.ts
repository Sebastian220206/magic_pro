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
            createGain: jest.fn().mockReturnValue({
                connect: jest.fn(),
                disconnect: jest.fn(),
                gain: { value: 1.0 }
            }),
            createStereoPanner: jest.fn().mockReturnValue({
                connect: jest.fn(),
                disconnect: jest.fn(),
                pan: { value: 0 }
            }),
            destination: {}
        };
        require('../audioContext').audioContextManager.getContext.mockReturnValue(mockCtx);
        routingEngine.initialize();
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
});
