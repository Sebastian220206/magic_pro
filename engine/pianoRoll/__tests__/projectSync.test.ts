/**
 * Coordinate-space tests for the piano roll <-> project bridge.
 *
 * Regression: notes are stored clip-relative in projectStore, but the editor
 * draws its grid, bar numbers, loop markers and playhead in absolute timeline
 * beats. projectSync passed note offsets through unchanged, so a region that
 * did not begin at bar 1 rendered its notes shifted left by the region start.
 */

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

import { loadFromProjectStore, saveToProjectStore } from '@/engine/pianoRoll/projectSync';
import { useProjectStore } from '@/store/projectStore';
import { useMidiStore } from '@/store/midiStore';

/** A MIDI region positioned at beat 16 with notes at clip-relative 0 and 2. */
const makeClip = (startBeat: number) => ({
  id: 'clip-1',
  trackId: 'track-1',
  type: 'midi' as const,
  name: 'Region',
  color: '#3B82F6',
  alternativeId: 'main',
  start: startBeat,
  startBeat,
  startTime: startBeat,
  duration: 8,
  offset: 0,
  muted: false,
  loop: false,
  qSwing: 0,
  transpose: 0,
  velocityOffset: 0,
  playbackRate: 1,
  pitchOffset: 0,
  stretchMode: 'none' as const,
  fadeIn: { duration: 0, curve: 'linear' as const, gain: 1 },
  fadeOut: { duration: 0, curve: 'linear' as const, gain: 1 },
  notes: [
    { id: 'n0', pitch: 60, velocity: 100, start: 0, duration: 1 },
    { id: 'n1', pitch: 64, velocity: 100, start: 2, duration: 1 },
  ],
});

const seed = (startBeat: number) => {
  useProjectStore.setState({
    clips: [makeClip(startBeat)] as never,
    selectedClipIds: ['clip-1'],
    pianoRollFocusClipId: 'clip-1',
  });
};

const editorNotes = () => {
  const clip = useMidiStore.getState().getCurrentClip();
  return (clip?.notes ?? []) as Array<{ id: string; startBeat: number }>;
};

describe('projectSync — beat coordinate space', () => {
  test('presents notes of an offset region in absolute beats', () => {
    seed(16);
    loadFromProjectStore('single');

    expect(editorNotes().map(n => n.startBeat)).toEqual([16, 18]);
  });

  test('a region at bar 1 is unaffected', () => {
    seed(0);
    loadFromProjectStore('single');

    expect(editorNotes().map(n => n.startBeat)).toEqual([0, 2]);
  });

  test('round-trips without drifting', () => {
    seed(16);
    loadFromProjectStore('single');
    saveToProjectStore();

    const stored = useProjectStore.getState().clips[0].notes!;
    expect(stored.map(n => n.start)).toEqual([0, 2]);
  });

  test('an edit in the editor is rebased back to clip-relative', () => {
    seed(16);
    loadFromProjectStore('single');

    // Drag the first note one beat later, in absolute terms: 16 -> 17.
    const clip = useMidiStore.getState().getCurrentClip()!;
    const moved = clip.notes.map(n =>
      n.id === 'n0' ? { ...n, startBeat: 17 } : n,
    );
    useMidiStore.setState({
      clips: new Map(useMidiStore.getState().clips).set(clip.id, { ...clip, notes: moved }),
    } as never);

    saveToProjectStore();

    const stored = useProjectStore.getState().clips[0].notes!;
    expect(stored.find(n => n.id === 'n0')!.start).toBe(1);
  });

  test('never persists a negative offset', () => {
    seed(16);
    loadFromProjectStore('single');

    const clip = useMidiStore.getState().getCurrentClip()!;
    const dragged = clip.notes.map(n =>
      n.id === 'n0' ? { ...n, startBeat: 4 } : n, // dragged before the region
    );
    useMidiStore.setState({
      clips: new Map(useMidiStore.getState().clips).set(clip.id, { ...clip, notes: dragged }),
    } as never);

    saveToProjectStore();

    const stored = useProjectStore.getState().clips[0].notes!;
    expect(stored.find(n => n.id === 'n0')!.start).toBe(0);
  });

  test('the editor region spans the absolute range of its clips', () => {
    seed(16);
    loadFromProjectStore('single');

    const clip = useMidiStore.getState().getCurrentClip()!;
    expect(clip.startBeat).toBe(16);
    expect(clip.durationBeats).toBe(24); // 16 + 8
  });
});
