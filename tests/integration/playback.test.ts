/**
 * playback.test.ts
 * Integration test for the full playback flow.
 */

import { useProjectStore } from '@/store/projectStore';
import { audioEngine } from '@/engine/AudioEngineAdapter';

// Polyfill browser APIs not available in Node.js Jest environment
(globalThis as any).requestAnimationFrame = (cb: Function) => setTimeout(() => cb(Date.now()), 16) as unknown as number;
(globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);

jest.mock('@/engine/audioEngine/bufferCache', () => ({
  bufferCacheManager: {
    getBuffer: jest.fn(),
    addBuffer: jest.fn(),
    dispose: jest.fn(),
  }
}));

jest.mock('@/engine/AudioEngineAdapter', () => ({
  audioEngine: {
    setTempo: jest.fn(),
    stop: jest.fn(),
    stopAll: jest.fn(),
    getTrackNodes: jest.fn().mockReturnValue(null),
    updateFXChain: jest.fn(),
    routeTrackToTrack: jest.fn(),
    routeTrackToBus: jest.fn(),
    updateTrackParams: jest.fn(),
    playRegion: jest.fn(),
    seekTo: jest.fn(),
    chaseEvents: jest.fn(),
    onTransportTick: jest.fn(),
    setMetronomeEnabled: jest.fn(),
    configureMetronome: jest.fn(),
  }
}));

describe('Playback Integration Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Stop the rAF loop started by store.play()
    useProjectStore.getState().stop();
  });

  test('UI Play triggers setTempo and updates store playing state', async () => {
    const store = useProjectStore.getState();

    expect(store.playing).toBe(false);

    store.play();

    expect(audioEngine.setTempo).toHaveBeenCalledWith(120);
    expect(useProjectStore.getState().playing).toBe(true);
  });

  test('play() arms the click track from project metronome settings', () => {
    useProjectStore.setState(s => ({
      metronomeEnabled: true,
      settings: {
        ...s.settings,
        metronome: { ...s.settings.metronome, simpleMode: true, accentLevel: 8, clickLevel: 4 },
      },
    }));

    useProjectStore.getState().play();

    expect(audioEngine.configureMetronome).toHaveBeenCalledWith(
      expect.objectContaining({ accentLevel: 8, clickLevel: 4 }),
    );
    expect(audioEngine.setMetronomeEnabled).toHaveBeenCalledWith(true);
  });

  test('stop() silences the click track', () => {
    useProjectStore.getState().play();
    jest.clearAllMocks();

    useProjectStore.getState().stop();

    expect(audioEngine.setMetronomeEnabled).toHaveBeenCalledWith(false);
  });

  test('startRecording rolls the transport so existing material is audible', () => {
    // Regression: startRecording used to call audioEngine.play(metronomeEnabled),
    // which started the scheduler with an empty clip list.
    useProjectStore.getState().startRecording();

    const state = useProjectStore.getState();
    expect(state.playing).toBe(true);
    expect(state.recording).toBe(true);
    // play() performs the full track/routing setup; the boolean shortcut did not.
    expect(audioEngine.setTempo).toHaveBeenCalled();
    expect(audioEngine.updateTrackParams).toHaveBeenCalledTimes(state.tracks.length);
  });
});
