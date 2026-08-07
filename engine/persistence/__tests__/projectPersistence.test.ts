import { CURRENT_SCHEMA_VERSION, serializeStoreState, deserializeState } from '@/engine/persistence/projectPersistence';

function createMockState(): any {
  return {
    id: 'proj-1',
    name: 'Test Project',
    tempo: 120,
    timeSignature: '4/4',
    keySignature: 'C major',
    playhead: 0,
    tracks: [
      { id: 'track-1', name: 'Audio 1', type: 'audio', volume: 0.8, pan: 0, muted: false },
    ],
    clips: [],
    annotations: [],
    globalTracks: { tempo: [{ time: 0, value: 120 }] },
    settings: {
      projectEnd: 128,
      metronome: { enabled: true },
      masterVolume: 0.8,
    },
    globalSettings: {},
    environment: {},
    alternatives: [],
    currentAlternativeId: null,
    projectFormat: 'stereo',
    surroundFormat: 'none',
    spatialAudioMode: 'off',
    zoom: 1,
    trackHeight: 40,
    snap: 'beat',
    metronomeEnabled: true,
    countInEnabled: false,
    countInBars: 2,
    cycleEnabled: false,
    locatorLeft: 0,
    locatorRight: 128,
    selectedTrackIds: [],
    focusedTrackId: null,
    selectedClipId: null,
    selectedClipIds: [],
    articulationSets: [],
    channelStripSettings: [],
    channelStripCopyBuffer: null,
    channelStripPerformances: [],
  };
}

describe('projectPersistence', () => {
  describe('CURRENT_SCHEMA_VERSION', () => {
    test('is defined as a number', () => {
      expect(CURRENT_SCHEMA_VERSION).toBeDefined();
      expect(typeof CURRENT_SCHEMA_VERSION).toBe('number');
    });
  });

  describe('serializeStoreState', () => {
    test('serializes all required fields', () => {
      const state = createMockState();
      const getState = () => state;
      const serialized = serializeStoreState(getState);

      expect(serialized.id).toBe('proj-1');
      expect(serialized.name).toBe('Test Project');
      expect(serialized.tempo).toBe(120);
      expect(serialized.tracks).toHaveLength(1);
      expect(serialized.clips).toEqual([]);
    });

    test('accepts optional mixerState', () => {
      const state = createMockState();
      const getState = () => state;
      const serialized = serializeStoreState(getState, {
        mixerState: { master: { volume: -1 } },
      });

      expect(serialized.mixerState).toEqual({ master: { volume: -1 } });
    });

    test('serializes waveform peaks as arrays', () => {
      const state = createMockState();
      state.clips = [
        {
          id: 'clip-1',
          name: 'Loop',
          type: 'audio',
          startTime: 0,
          duration: 8,
          trackId: 'track-1',
          waveformPeaks: {
            channels: [
              { min: new Float32Array([-0.5, 0, 0.25]), max: new Float32Array([0.5, 0.125, 0.75]) },
            ],
          },
        },
      ];
      const getState = () => state;
      const serialized = serializeStoreState(getState);

      expect(serialized.clips[0].waveformPeaks.channels[0].min).toEqual([-0.5, 0, 0.25]);
      expect(serialized.clips[0].waveformPeaks.channels[0].max).toEqual([0.5, 0.125, 0.75]);
    });
  });

  describe('deserializeState', () => {
    test('restores serialized state fields', () => {
      const state = createMockState();
      const getState = () => state;
      const serialized = serializeStoreState(getState);
      const deserialized = deserializeState(serialized);

      expect(deserialized.id).toBe('proj-1');
      expect(deserialized.name).toBe('Test Project');
      expect(deserialized.tempo).toBe(120);
      expect(deserialized.tracks).toHaveLength(1);
    });

    test('sets transient state flags to false', () => {
      const state = createMockState();
      const getState = () => state;
      const serialized = serializeStoreState(getState);
      const deserialized = deserializeState(serialized);

      expect(deserialized.isDirty).toBe(false);
      expect(deserialized.playing).toBe(false);
      expect(deserialized.recording).toBe(false);
    });

    test('deserializes waveform peaks back to Float32Array', () => {
      const state = createMockState();
      state.clips = [
        {
          id: 'clip-1',
          name: 'Loop',
          type: 'audio',
          startTime: 0,
          duration: 8,
          trackId: 'track-1',
          waveformPeaks: {
            channels: [
              { min: new Float32Array([-0.5, 0, 0.25]), max: new Float32Array([0.5, 0.125, 0.75]) },
            ],
          },
        },
      ];
      const getState = () => state;
      const serialized = serializeStoreState(getState);
      const deserialized = deserializeState(serialized);

      expect(deserialized.clips[0].waveformPeaks.channels[0].min).toBeInstanceOf(Float32Array);
      expect(deserialized.clips[0].waveformPeaks.channels[0].max).toBeInstanceOf(Float32Array);
      expect(Array.from(deserialized.clips[0].waveformPeaks.channels[0].min)).toEqual([-0.5, 0, 0.25]);
    });

    test('round-trip preserves essential state', () => {
      const state = createMockState();
      const getState = () => state;
      const serialized = serializeStoreState(getState);
      const deserialized = deserializeState(serialized);

      expect(deserialized.tempo).toBe(state.tempo);
      expect(deserialized.timeSignature).toBe(state.timeSignature);
      expect(deserialized.keySignature).toBe(state.keySignature);
      expect(deserialized.playhead).toBe(state.playhead);
      expect(deserialized.tracks).toEqual(state.tracks);
    });
  });
});
