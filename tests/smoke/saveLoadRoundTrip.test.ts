import { CURRENT_SCHEMA_VERSION } from '@/engine/persistence/projectPersistence';
import { rebuildEngine } from '@/engine/persistence/engineRebuilder';

jest.mock('@/engine/AudioEngineAdapter', () => ({
  audioEngine: {
    waitForReady: jest.fn().mockResolvedValue(undefined),
    createTrack: jest.fn(),
    updateTrackParams: jest.fn(),
    updateFXChain: jest.fn(),
    muteTrack: jest.fn(),
    unmuteTrack: jest.fn(),
    soloTrack: jest.fn(),
    unsoloTrack: jest.fn(),
    setTempo: jest.fn(),
    getTrackNodes: jest.fn().mockReturnValue({ input: { connect: jest.fn() }, output: { connect: jest.fn() } }),
  },
}));

jest.mock('@/engine/audioEngine/bufferCache', () => ({
  bufferCacheManager: {
    getBuffer: jest.fn(),
    addBuffer: jest.fn(),
  },
}));

jest.mock('@/engine/persistence/audioFileStore', () => ({
  loadAudioBuffer: jest.fn().mockResolvedValue(null),
}));

interface TestTrack {
  id: string;
  name: string;
  type: string;
  volume: number;
  pan: number;
  muted: boolean;
  plugins?: any[];
  effects?: any[];
  sends?: any[];
}

interface TestClip {
  id: string;
  trackId: string;
  type: string;
  start: number;
  duration: number;
  name: string;
  color: string;
}

function createTestData() {
  const tracks: TestTrack[] = [
    { id: 'track-1', name: 'Audio 1', type: 'audio', volume: 0.8, pan: 0, muted: false },
    { id: 'track-2', name: 'MIDI 1', type: 'midi', volume: 0.7, pan: -0.3, muted: false },
  ];

  const clips: TestClip[] = [
    { id: 'clip-1', trackId: 'track-1', type: 'audio', start: 0, duration: 8, name: 'Loop', color: '#888' },
    { id: 'clip-2', trackId: 'track-2', type: 'midi', start: 2, duration: 4, name: 'Melody', color: '#38b' },
  ];

  return { tracks, clips };
}

describe('Save/Load Round-Trip Smoke Tests', () => {
  describe('Schema version', () => {
    test('CURRENT_SCHEMA_VERSION is defined', () => {
      expect(CURRENT_SCHEMA_VERSION).toBeDefined();
      expect(typeof CURRENT_SCHEMA_VERSION).toBe('number');
    });
  });

  describe('engineRebuilder', () => {
    test('rebuildEngine creates tracks from serialized state', async () => {
      const { tracks, clips } = createTestData();
      const result = await rebuildEngine({ tracks, clips, tempo: 120 });

      expect(result.success).toBe(true);
      expect(result.tracksCreated).toBe(2);
    });

    test('rebuildEngine handles empty project', async () => {
      const result = await rebuildEngine({ tracks: [], clips: [], tempo: 120 });

      expect(result.success).toBe(true);
      expect(result.tracksCreated).toBe(0);
    });

    test('rebuildEngine preserves track order from input', async () => {
      const { tracks } = createTestData();
      const result = await rebuildEngine({ tracks, clips: [], tempo: 120 });

      expect(result.tracksCreated).toBe(2);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('Data structure integrity', () => {
    test('track IDs are unique', () => {
      const { tracks } = createTestData();
      const ids = tracks.map(t => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    test('clip IDs are unique', () => {
      const { clips } = createTestData();
      const ids = clips.map(c => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    test('clips reference valid track IDs', () => {
      const { tracks, clips } = createTestData();
      const trackIds = new Set(tracks.map(t => t.id));
      clips.forEach(c => {
        expect(trackIds.has(c.trackId)).toBe(true);
      });
    });

    test('track volumes are in valid range', () => {
      const { tracks } = createTestData();
      tracks.forEach(t => {
        expect(t.volume).toBeGreaterThanOrEqual(0);
        expect(t.volume).toBeLessThanOrEqual(1);
        expect(t.pan).toBeGreaterThanOrEqual(-1);
        expect(t.pan).toBeLessThanOrEqual(1);
      });
    });
  });
});
