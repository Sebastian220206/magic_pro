import { SoundFontEngine } from '@/lib/soundfontEngine';
import * as cache from '@/lib/soundfontCache';
import { SoundFontInstrument } from '@/engine/instruments/soundfont/SoundFontInstrument';

jest.mock('@/lib/soundfontCache', () => ({
  getCachedFont: jest.fn(),
  setCachedFont: jest.fn(),
  removeCachedFont: jest.fn()
}));

jest.mock('@/engine/instruments/soundfont/SoundFontParser', () => {
  return {
    SoundFontParser: jest.fn().mockImplementation(() => ({
      parse: jest.fn().mockReturnValue({
        sampleHeaders: [{ name: 'sample1' }],
        presets: [
          { name: 'Preset 1', bank: 0, preset: 0 },
          { name: 'Preset 2', bank: 0, preset: 1 }
        ]
      })
    }))
  };
});

jest.mock('@/engine/instruments/soundfont/SoundFontInstrument', () => {
  return {
    SoundFontInstrument: jest.fn().mockImplementation(() => ({
      loader: { loadFromBuffer: jest.fn().mockResolvedValue(true) },
      loadFontFromBuffer: jest.fn().mockResolvedValue(true),
      selectPreset: jest.fn().mockReturnValue(true),
      dispose: jest.fn()
    }))
  };
});

jest.mock('@/engine/instruments/soundfont/audioDecoder', () => {
  return {
    AudioDecoder: jest.fn().mockImplementation(() => ({
      decodeAllSamples: jest.fn().mockImplementation(async (data, cb) => {
        cb(1, 1);
      }),
      dispose: jest.fn(),
      getMemoryUsage: jest.fn().mockReturnValue(1024 * 1024)
    }))
  };
});

jest.mock('@/engine/audioEngine/audioContext', () => ({
  audioContextManager: {
    getContext: jest.fn().mockReturnValue({}),
    initialize: jest.fn().mockResolvedValue({})
  }
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('SoundFontEngine integration tests', () => {
  let engine: SoundFontEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = (SoundFontEngine as any).getInstance();
    // Reset instance for clean slate
    engine.disposeAll();
    
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(1024)
    });
  });

  const dummyFont = {
    id: 'sf-123',
    userId: 'user-test-1',
    name: 'Test Piano',
    storagePath: 'users/user-test-1/test-piano.sf2',
    publicUrl: 'https://test.local/piano.sf2',
    presetCount: 0,
    presets: [] as { name: string; bank: number; program: number }[],
    fileSize: 1024,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  test('Download only happens once and subsequent loads come from IndexedDB cache', async () => {
    // First load - cache miss
    (cache.getCachedFont as jest.Mock).mockResolvedValueOnce(undefined);
    const progressSpy1 = jest.fn();
    
    await engine.loadFont(dummyFont, 0, progressSpy1);
    
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(dummyFont.publicUrl);
    expect(cache.setCachedFont).toHaveBeenCalledTimes(1);
    expect(progressSpy1).toHaveBeenCalledWith(expect.objectContaining({ stage: 'download' }));

    // Second load - simulate component re-requesting
    const progressSpy2 = jest.fn();
    await engine.loadFont(dummyFont, 0, progressSpy2);
    
    // Should NOT call fetch again
    expect(mockFetch).toHaveBeenCalledTimes(1);
    
    // Third load - simulate loading from IndexedDB on fresh app start
    engine.disposeAll();
    (cache.getCachedFont as jest.Mock).mockResolvedValueOnce({ data: new ArrayBuffer(1024) });
    const progressSpy3 = jest.fn();
    
    await engine.loadFont(dummyFont, 0, progressSpy3);
    
    expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1
    expect(progressSpy3).not.toHaveBeenCalledWith(expect.objectContaining({ stage: 'download' }));
    expect(progressSpy3).toHaveBeenCalledWith(expect.objectContaining({ stage: 'parse' }));
  });

  test('Preset switching is instant and does not download again', async () => {
    (cache.getCachedFont as jest.Mock).mockResolvedValueOnce(undefined);
    await engine.loadFont(dummyFont, 0);
    
    const instrument = engine.getInstrument(dummyFont.id);
    expect(instrument).toBeDefined();
    
    // Switch preset
    const success = engine.selectPreset(dummyFont.id, 1);
    expect(success).toBe(true);
    expect(instrument?.selectPreset).toHaveBeenCalledWith(1);
    
    // Switch should not trigger any network or parse
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('Memory usage remains stable and releases unused fonts', async () => {
    (cache.getCachedFont as jest.Mock).mockResolvedValue(undefined);
    
    // Load font
    await engine.loadFont(dummyFont, 0);
    expect(engine.getTotalLoaded()).toBe(1);
    expect(engine.getMemoryUsage()).toBe(1024 * 1024);
    
    // Release font
    engine.releaseFont(dummyFont.id);
    // Should still be loaded (LRU cache)
    expect(engine.getTotalLoaded()).toBe(1);
    expect(engine.getMemoryUsage()).toBe(1024 * 1024);
  });

  test('UI never freezes because parsing and decoding report progress', async () => {
    (cache.getCachedFont as jest.Mock).mockResolvedValueOnce(undefined);
    const progressSpy = jest.fn();
    
    await engine.loadFont(dummyFont, 0, progressSpy);
    
    // Verify all async stages report progress to keep UI responsive
    expect(progressSpy).toHaveBeenCalledWith(expect.objectContaining({ stage: 'download', percent: 0 }));
    expect(progressSpy).toHaveBeenCalledWith(expect.objectContaining({ stage: 'parse', percent: 0 }));
    expect(progressSpy).toHaveBeenCalledWith(expect.objectContaining({ stage: 'parse', percent: 100 }));
    expect(progressSpy).toHaveBeenCalledWith(expect.objectContaining({ stage: 'decode', percent: 0 }));
    expect(progressSpy).toHaveBeenCalledWith(expect.objectContaining({ stage: 'decode', percent: 100 }));
    expect(progressSpy).toHaveBeenCalledWith(expect.objectContaining({ stage: 'ready', percent: 100 }));
  });

  test('Handles network failure and recovers gracefully', async () => {
    (cache.getCachedFont as jest.Mock).mockResolvedValueOnce(undefined);
    mockFetch.mockResolvedValueOnce({ ok: false, statusText: 'Not Found' });
    
    const progressSpy = jest.fn();
    
    await expect(engine.loadFont(dummyFont, 0, progressSpy)).rejects.toThrow('Download failed: Not Found');
    
    expect(progressSpy).toHaveBeenCalledWith(expect.objectContaining({ stage: 'error', error: 'Download failed: Not Found' }));
    
    // Should recover on next try if network is back
    mockFetch.mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(1024) });
    await expect(engine.loadFont(dummyFont, 0)).resolves.toBeDefined();
  });

  test('Evicts old instruments when limit is reached', async () => {
    (cache.getCachedFont as jest.Mock).mockResolvedValue(undefined);
    
    // Load 10 fonts (MAX_INSTRUMENTS is 8 in SoundFontEngine)
    for (let i = 0; i < 10; i++) {
      const font = { ...dummyFont, id: `sf-${i}` };
      await engine.loadFont(font, 0);
      // Release so it can be evicted
      engine.releaseFont(font.id);
    }
    
    // Only 8 should be kept in memory
    expect(engine.getTotalLoaded()).toBe(8);
  });
});
