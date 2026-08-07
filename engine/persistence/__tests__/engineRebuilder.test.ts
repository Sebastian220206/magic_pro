/**
 * Pins instrument restoration on project open.
 *
 * The bug: a track carrying a SoundFont preset persisted only `instrument`,
 * the preset's *display name*. Nothing recorded the bank or the preset index,
 * so a reload looked correct — the track still read "Grand Piano" — while the
 * engine had no SoundFont attached and playback fell through to the built-in
 * synth. Worse, step 4 would look "Grand Piano" up in the built-in registry
 * and attach whatever it found there.
 */

const audioEngine = {
    waitForReady: jest.fn().mockResolvedValue(undefined),
    createTrack: jest.fn(),
    updateTrackParams: jest.fn(),
    muteTrack: jest.fn(),
    soloTrack: jest.fn(),
    routeTrackToTrack: jest.fn(),
    routeTrackToBus: jest.fn(),
    loadInstrument: jest.fn().mockResolvedValue(undefined),
    loadWamInstrument: jest.fn().mockResolvedValue(undefined),
    updateFXChain: jest.fn(),
    setTempo: jest.fn(),
    configureAudioFormat: jest.fn(),
    getContext: jest.fn(() => null),
};

const loadSoundFontForTrack = jest.fn().mockResolvedValue({ ok: true, label: 'Grand Piano' });

jest.mock('@/engine/AudioEngineAdapter', () => ({ audioEngine }));
jest.mock('@/engine/audioEngine/bufferCache', () => ({ bufferCacheManager: { addBuffer: jest.fn() } }));
jest.mock('../audioFileStore', () => ({ loadAudioBuffer: jest.fn().mockResolvedValue(null) }));
jest.mock('@/engine/instruments/soundfont/loadSoundFontForTrack', () => ({
    loadSoundFontForTrack: (...args: unknown[]) => loadSoundFontForTrack(...args),
}));

import { rebuildEngine } from '../engineRebuilder';
import { serializeStoreState, deserializeState } from '../projectPersistence';

const base = { tempo: 120, clips: [] };

/** Let the rebuilder's fire-and-forget restores settle. */
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('rebuildEngine instrument restore', () => {
    beforeEach(() => jest.clearAllMocks());

    it('reloads a SoundFont preset from the persisted bank and index', async () => {
        await rebuildEngine({
            ...base,
            tracks: [{
                id: 't1',
                instrument: 'Grand Piano',
                soundFont: { url: '/soundfonts/GeneralUser-GS.sf2', presetIndex: 0 },
            }],
        });
        await flush();

        expect(loadSoundFontForTrack).toHaveBeenCalledWith(
            't1', '/soundfonts/GeneralUser-GS.sf2', 0);
    });

    it('does not attach a built-in instrument over a SoundFont track', async () => {
        await rebuildEngine({
            ...base,
            tracks: [{
                id: 't1',
                instrument: 'Grand Piano',
                soundFont: { url: '/soundfonts/GeneralUser-GS.sf2', presetIndex: 0 },
            }],
        });

        expect(audioEngine.loadInstrument).not.toHaveBeenCalled();
    });

    it('does not attach a built-in instrument over a WAM track', async () => {
        await rebuildEngine({
            ...base,
            tracks: [{
                id: 't1',
                instrument: 'DEXED',
                wamInstrument: { url: 'https://example.com/dexed/index.js', identifier: 'dexed' },
            }],
        });
        await flush();

        expect(audioEngine.loadInstrument).not.toHaveBeenCalled();
        expect(audioEngine.loadWamInstrument).toHaveBeenCalledWith(
            't1', 'https://example.com/dexed/index.js', 'dexed');
    });

    it('still loads built-in instruments for ordinary tracks', async () => {
        await rebuildEngine({
            ...base,
            tracks: [{ id: 't1', instrument: 'Deep Bass' }],
        });

        expect(audioEngine.loadInstrument).toHaveBeenCalledWith('t1', 'Deep Bass');
        expect(loadSoundFontForTrack).not.toHaveBeenCalled();
    });

    it('survives a SoundFont that fails to load', async () => {
        loadSoundFontForTrack.mockResolvedValueOnce({ ok: false, error: '404' });

        const result = await rebuildEngine({
            ...base,
            tracks: [{ id: 't1', soundFont: { url: '/gone.sf2', presetIndex: 3 } }],
        });
        await flush();

        expect(result.tracksCreated).toBe(1);
        expect(result.success).toBe(true);
    });
});

describe('soundFont persistence', () => {
    it('survives a serialize/deserialize round trip', () => {
        const soundFont = {
            id: 'local:GeneralUser-GS.sf2',
            url: '/soundfonts/GeneralUser-GS.sf2',
            presetIndex: 0,
            presetName: 'Grand Piano',
        };
        const state = {
            id: 'p1', name: 'x', tempo: 120, clips: [],
            tracks: [{ id: 't1', instrument: 'Grand Piano', instrumentLoaded: true, soundFont }],
        };

        const out = deserializeState(
            serializeStoreState(() => state) as never,
        ) as { tracks: { soundFont?: unknown }[] };

        expect(out.tracks[0].soundFont).toEqual(soundFont);
    });
});
