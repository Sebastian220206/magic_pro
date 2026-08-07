/**
 * Regression tests for the piano roll's transport bridge.
 *
 * The piano roll draws its playhead from midiStore's `isPlaying` / `currentBeat`.
 * Those were only ever written by `midiStore.play()`, which nothing calls — so
 * pressing Play rolled the project transport while the piano roll's playhead sat
 * at beat 0. ProjectPianoRollAdapter now mirrors the project transport into
 * midiStore.
 */

import { render, act } from '@testing-library/react';
import { ProjectPianoRollAdapter } from '@/components/adapters/ProjectPianoRollAdapter';
import { useProjectStore } from '@/store/projectStore';
import { useMidiStore } from '@/store/midiStore';

// The real editor pulls in canvas rendering and the navigation engine; none of
// that is relevant to the transport wiring under test.
jest.mock('@/components/midi/PianoRoll', () => ({
  PianoRoll: () => <div data-testid="piano-roll" />,
}));

// projectStore imports the audio engine, which reaches Web Audio and uses
// `import.meta` at module scope — neither survives the CommonJS test transform.
jest.mock('@/engine/AudioEngineAdapter', () => ({
  audioEngine: {
    isPlaying: false,
    getCurrentBeat: jest.fn().mockReturnValue(0),
    setTempo: jest.fn(),
    stop: jest.fn(),
    stopAll: jest.fn(),
    seekTo: jest.fn(),
    getTrackNodes: jest.fn().mockReturnValue(null),
    updateFXChain: jest.fn(),
    routeTrackToTrack: jest.fn(),
    routeTrackToBus: jest.fn(),
    updateTrackParams: jest.fn(),
    playRegion: jest.fn(),
    triggerNote: jest.fn(),
    releaseNote: jest.fn(),
    setMetronomeEnabled: jest.fn(),
    configureMetronome: jest.fn(),
    onTransportTick: jest.fn(),
  },
}));

jest.mock('@/engine/audioEngine/bufferCache', () => ({
  bufferCacheManager: { getBuffer: jest.fn(), addBuffer: jest.fn(), dispose: jest.fn() },
}));

jest.mock('@/engine/pianoRoll/projectSync', () => ({
  useProjectSync: () => ({ save: jest.fn(), hasUnsavedChanges: () => false }),
}));

const setTransport = (playing: boolean, playhead: number) =>
  act(() => {
    useProjectStore.setState({ playing, playhead });
  });

describe('ProjectPianoRollAdapter — transport bridge', () => {
  beforeEach(() => {
    useProjectStore.setState({ playing: false, playhead: 0 });
    useMidiStore.setState({ isPlaying: false, currentBeat: 0, currentClipId: 'clip-1' } as never);
  });

  test('mirrors the project playhead into midiStore', () => {
    render(<ProjectPianoRollAdapter />);

    setTransport(true, 4.25);

    expect(useMidiStore.getState().currentBeat).toBeCloseTo(4.25);
    expect(useMidiStore.getState().isPlaying).toBe(true);
  });

  test('keeps following the playhead as the transport advances', () => {
    render(<ProjectPianoRollAdapter />);

    const seen: number[] = [];
    for (const beat of [0.5, 1, 1.5, 2]) {
      setTransport(true, beat);
      seen.push(useMidiStore.getState().currentBeat);
    }

    expect(seen).toEqual([0.5, 1, 1.5, 2]);
  });

  test('seeds midiStore from the transport on mount', () => {
    useProjectStore.setState({ playing: true, playhead: 12 });

    render(<ProjectPianoRollAdapter />);

    expect(useMidiStore.getState().currentBeat).toBe(12);
    expect(useMidiStore.getState().isPlaying).toBe(true);
  });

  test('clears the playing flag when the transport stops', () => {
    render(<ProjectPianoRollAdapter />);

    setTransport(true, 3);
    expect(useMidiStore.getState().isPlaying).toBe(true);

    setTransport(false, 3);
    expect(useMidiStore.getState().isPlaying).toBe(false);
  });

  test('stops mirroring once unmounted', () => {
    const { unmount } = render(<ProjectPianoRollAdapter />);

    setTransport(true, 2);
    expect(useMidiStore.getState().currentBeat).toBe(2);

    unmount();
    setTransport(true, 9);

    // The subscription was torn down, so midiStore keeps its last value.
    expect(useMidiStore.getState().currentBeat).toBe(2);
  });
});
