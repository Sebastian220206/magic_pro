/**
 * engine.bench.ts
 * Performance benchmarks for the Audio Engine.
 */

import { advancedScheduler } from '@/engine/audioEngine/scheduler';
import { routingEngine } from '@/engine/audioEngine/routingEngine';

describe('Audio Engine Benchmarks', () => {
  
  test('Scheduling 1000 clips', async () => {
    const clips = Array.from({ length: 1000 }, (_, i) => ({
      id: `clip-${i}`,
      trackId: 'track-1',
      startBeat: i * 0.1,
      duration: 1.0,
      buffer: {} as any
    }));

    const start = performance.now();
    // Simulate scheduling window check
    const mockWindow = { windowStart: 0, windowEnd: 100 };
    const toSchedule = clips.filter(c => c.startBeat >= mockWindow.windowStart && c.startBeat <= mockWindow.windowEnd);
    const end = performance.now();

    console.log(`[Benchmark] Filtering 1000 clips took ${end - start}ms`);
    expect(end - start).toBeLessThan(5); // Should be very fast
  });

  test('Node creation latency', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
        routingEngine.createTrack({ id: `t-${i}`, sends: [], effects: [], volume: 1, pan: 0 } as any);
    }
    const end = performance.now();
    console.log(`[Benchmark] Creating 100 tracks took ${end - start}ms`);
  });
});
