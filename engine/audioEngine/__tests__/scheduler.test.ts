/**
 * scheduler.test.ts
 * Logic validation for the AdvancedScheduler.
 * 
 * Note: These tests focus on the math of lookahead and drift correction.
 */

import { advancedScheduler } from '../scheduler';

// Mock AudioContext Manager
jest.mock('../audioContext', () => ({
    audioContextManager: {
        getContext: jest.fn(),
        getCurrentTime: jest.fn(),
    }
}));

describe('AdvancedScheduler Timing Logic', () => {
    let scheduler: any;
    let mockCtx: any;

    beforeEach(() => {
        scheduler = new (advancedScheduler.constructor as any)({
            lookaheadTime: 100,
            scheduleInterval: 25
        });
        mockCtx = {
            currentTime: 0,
            createBufferSource: jest.fn().mockReturnValue({
                connect: jest.fn(),
                start: jest.fn(),
                stop: jest.fn(),
            }),
            createGain: jest.fn().mockReturnValue({
                connect: jest.fn(),
                gain: { value: 1 }
            }),
            createStereoPanner: jest.fn().mockReturnValue({
                connect: jest.fn(),
                pan: { value: 0 }
            }),
            destination: {}
        };
        require('../audioContext').audioContextManager.getContext.mockReturnValue(mockCtx);
    });

    test('Lookahead window calculation', () => {
        mockCtx.currentTime = 10.0; // 10 seconds in
        scheduler['tempo'] = 120; // 2 beats per second
        
        const window = scheduler['getSchedulingWindow'](mockCtx);
        
        // At 10s, we are at beat 20.
        expect(window.windowStart).toBe(20);
        
        // 100ms lookahead = 0.1s = 0.2 beats.
        expect(window.windowEnd).toBeCloseTo(20.2);
    });

    test('Drift prevention: internal time syncs to AudioContext', () => {
        scheduler['startTime'] = 0;
        scheduler['tempo'] = 120;
        
        // Simulate a delay where JS was blocked for 500ms
        mockCtx.currentTime = 1.5; // AudioContext moved ahead
        
        // Trigger a tick
        scheduler['tick']([], []);
        
        // Internal currentTime should now be exactly 3.0 beats (1.5s * 2 beats/s)
        expect(scheduler.getCurrentBeat()).toBe(3.0);
    });

    test('Tempo change accuracy', () => {
        scheduler['tempo'] = 60; // 1 beat per second
        expect(scheduler['beatsToSeconds'](1)).toBe(1.0);
        
        scheduler.setTempo(120); // 2 beats per second
        expect(scheduler['beatsToSeconds'](1)).toBe(0.5);
    });
});
