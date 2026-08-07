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

jest.mock('../bufferCache', () => ({
    bufferCacheManager: {
        getBuffer: jest.fn(),
        addBuffer: jest.fn(),
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
        scheduler.setTempo(120); // 2 beats per second
        
        const window = scheduler['getSchedulingWindow'](mockCtx);
        
        // At 10s, we are at beat 20.
        expect(window.windowStart).toBe(20);
        
        // 100ms lookahead = 0.1s = 0.2 beats.
        expect(window.windowEnd).toBeCloseTo(20.2);
    });

    test('Drift prevention: internal time syncs to AudioContext', () => {
        scheduler['startTime'] = 0;
        scheduler['tempo'] = 120;
        scheduler['isPlaying'] = true;
        
        // Simulate a delay where JS was blocked for 500ms
        mockCtx.currentTime = 1.5; // AudioContext moved ahead
        
        // Trigger a tick
        scheduler['tick']([], []);
        
        // Internal currentTime should now be exactly 3.0 beats (1.5s * 2 beats/s)
        expect(scheduler.getCurrentBeat()).toBe(3.0);
    });

    test('Tempo change accuracy', () => {
        scheduler.setTempo(60); // 1 beat per second
        expect(scheduler['beatsToSeconds'](1)).toBeCloseTo(1.0, 9);

        scheduler.setTempo(120); // 2 beats per second
        expect(scheduler['beatsToSeconds'](1)).toBeCloseTo(0.5, 9);
    });

    test('Tempo track drives beat/time conversion', () => {
        // 120 BPM for 4 beats (2s), then 60 BPM.
        scheduler.setTempoMap([
            { time: 0, value: 120, type: 'jump' },
            { time: 4, value: 60, type: 'jump' },
        ]);

        expect(scheduler['beatsToSeconds'](4)).toBeCloseTo(2, 9);
        // 4 further beats at half speed take 4s, not 2s.
        expect(scheduler['beatsToSeconds'](8)).toBeCloseTo(6, 9);
        expect(scheduler['secondsToBeats'](6)).toBeCloseTo(8, 9);
    });

    test('Instantaneous tempo follows the playhead through the track', () => {
        scheduler.setTempoMap([
            { time: 0, value: 120, type: 'jump' },
            { time: 4, value: 90, type: 'jump' },
        ]);

        scheduler['currentTime'] = 0;
        expect(scheduler.getTempo()).toBe(120);

        scheduler['currentTime'] = 5;
        expect(scheduler.getTempo()).toBe(90);
    });

    test('Clip durations are measured across their own span', () => {
        scheduler.setTempoMap([
            { time: 0, value: 120, type: 'jump' },
            { time: 4, value: 60, type: 'jump' },
        ]);

        // 4 beats starting at beat 0 sit entirely in the 120 section => 2s.
        expect(scheduler['beatSpanToSeconds'](0, 4)).toBeCloseTo(2, 9);
        // The same 4 beats starting at beat 4 are at 60 BPM => 4s.
        expect(scheduler['beatSpanToSeconds'](4, 4)).toBeCloseTo(4, 9);
    });
});
