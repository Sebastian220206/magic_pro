/**
 * playback.test.ts
 * Integration test for the full playback flow.
 */

import { useProjectStore } from '@/store/projectStore';
import { audioEngine } from '@/engine/AudioEngineAdapter';

jest.mock('@/engine/AudioEngineAdapter', () => ({
  audioEngine: {
    play: jest.fn(),
    stop: jest.fn(),
    onTransportTick: jest.fn(),
  }
}));

describe('Playback Integration Flow', () => {
  let tickHandler: (beat: number, time: number) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Capture the tick handler passed to the engine
    (audioEngine.onTransportTick as jest.Mock).mockImplementation((handler) => {
      tickHandler = handler;
      return () => {};
    });
  });

  test('UI Play triggers engine and handles ticks', async () => {
    const store = useProjectStore.getState();
    
    // 1. Trigger Play
    await store.transport.play();
    
    // Verify engine was called
    expect(audioEngine.play).toHaveBeenCalled();
    expect(audioEngine.onTransportTick).toHaveBeenCalled();

    // 2. Simulate a tick from the engine worker
    if (tickHandler) {
      tickHandler(1.0, 0.5); // beat 1.0 at time 0.5s
    }

    // 3. Verify store state updated
    expect(useProjectStore.getState().transport.playhead).toBe(1.0);
  });
});
