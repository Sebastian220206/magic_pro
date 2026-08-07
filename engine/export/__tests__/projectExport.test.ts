/**
 * Covers how a project is turned into render inputs.
 *
 * The export step used to be a `console.log`, and the export dialog that did
 * render went through `bounceEngine` with `effects: []` hardcoded and read a
 * `startBeat` field project clips do not have — so plugins were dropped and
 * every region stacked at beat 0. These pin the assembly instead.
 */

const renderSongOffline = jest.fn();
jest.mock('../OfflineRenderer', () => ({
    renderSongOffline: (...args: unknown[]) => renderSongOffline(...args),
}));
jest.mock('../wavEncoder', () => ({
    encodeWav: jest.fn(async () => new Blob([new Uint8Array(64)], { type: 'audio/wav' })),
}));

import { exportProjectAudio, projectEndBeat } from '../projectExport';
import type { Track } from '../../../models/Track';
import type { Clip } from '../../../models/Clip';

// A real-shaped buffer: the export measures what it rendered, so the double
// has to supply channel data.
const channelData = [new Float32Array(100), new Float32Array(100)];
const buffer = {
    numberOfChannels: 2, length: 100, sampleRate: 44100, duration: 0.1,
    getChannelData: (i: number) => channelData[i],
} as unknown as AudioBuffer;

const track = (over: Partial<Track>): Track => ({
    id: 't1', name: 'Track', type: 'software-instrument',
    volume: 0.8, pan: 0, muted: false, soloed: false, plugins: [], sends: [],
    ...over,
} as Track);

const clip = (over: Partial<Clip>): Clip => ({
    id: 'c1', trackId: 't1', name: 'Region', start: 0, duration: 4, type: 'midi',
    ...over,
} as Clip);

const lastCall = () => ({
    clips: renderSongOffline.mock.calls.at(-1)![0] as Record<string, unknown>[],
    tracks: renderSongOffline.mock.calls.at(-1)![1] as Record<string, unknown>[],
    tempo: renderSongOffline.mock.calls.at(-1)![2] as number,
    options: renderSongOffline.mock.calls.at(-1)![3] as Record<string, unknown>,
});

describe('exportProjectAudio', () => {
    beforeEach(() => {
        renderSongOffline.mockReset();
        renderSongOffline.mockResolvedValue(buffer);
    });

    it('places each region at its own start beat', async () => {
        await exportProjectAudio({
            tracks: [track({})],
            clips: [clip({ id: 'a', start: 0 }), clip({ id: 'b', start: 16 })],
            tempo: 120,
        });

        expect(lastCall().clips.map(c => c.startBeat)).toEqual([0, 16]);
    });

    it('carries the per-track plugin chain into the render', async () => {
        const plugins = [{ id: 'p1', pluginId: 'magic.compressor', name: 'Comp', enabled: true, params: {} }];
        await exportProjectAudio({
            tracks: [track({ plugins: plugins as never })],
            clips: [clip({})],
            tempo: 120,
        });

        expect(lastCall().tracks[0].plugins).toEqual(plugins);
    });

    it('carries fades, mute and playback rate', async () => {
        await exportProjectAudio({
            tracks: [track({})],
            clips: [clip({
                muted: true, playbackRate: 1.5,
                fadeIn: { duration: 0.5 }, fadeOut: { duration: 0.25 },
            } as never)],
            tempo: 120,
        });

        const c = lastCall().clips[0];
        expect(c.muted).toBe(true);
        expect(c.playbackRate).toBe(1.5);
        expect((c.fadeIn as { duration: number }).duration).toBe(0.5);
        expect((c.fadeOut as { duration: number }).duration).toBe(0.25);
    });

    it('spans the whole project when no range is given', async () => {
        await exportProjectAudio({
            tracks: [track({})],
            clips: [clip({ start: 0, duration: 4 }), clip({ id: 'b', start: 12, duration: 8 })],
            tempo: 120,
        });

        expect(lastCall().options).toMatchObject({ startBeat: 0, endBeat: 20 });
    });

    it('limits the render to the requested tracks', async () => {
        await exportProjectAudio(
            {
                tracks: [track({ id: 't1' }), track({ id: 't2' })],
                clips: [clip({ trackId: 't1' }), clip({ id: 'b', trackId: 't2' })],
                tempo: 120,
            },
            { trackIds: ['t2'] },
        );

        const { clips, tracks } = lastCall();
        expect(tracks.map(t => t.id)).toEqual(['t2']);
        expect(clips.map(c => c.trackId)).toEqual(['t2']);
    });

    it('refuses an empty range instead of writing silence', async () => {
        await expect(exportProjectAudio(
            { tracks: [track({})], clips: [], tempo: 120 },
        )).rejects.toThrow(/no audible range/);

        expect(renderSongOffline).not.toHaveBeenCalled();
    });

    it('reports tracks that lost their plugins rather than shipping quietly', async () => {
        renderSongOffline.mockImplementation(async (_c, _t, _tempo, options: never) => {
            (options as { onPluginFailure?: (t: string[]) => void }).onPluginFailure?.(['t1']);
            return buffer;
        });

        const result = await exportProjectAudio({
            tracks: [track({})], clips: [clip({})], tempo: 120,
        });

        expect(result.degradedTracks).toEqual(['t1']);
    });

    it('says so when MP3 falls back to WAV', async () => {
        const result = await exportProjectAudio(
            { tracks: [track({})], clips: [clip({})], tempo: 120 },
            { format: 'mp3' },
        );

        expect(result.formatNotice).toMatch(/WAV/);
        expect(result.fileName.endsWith('.wav')).toBe(true);
    });

    it('makes the project name safe to use as a filename', async () => {
        const result = await exportProjectAudio(
            { tracks: [track({})], clips: [clip({})], tempo: 120, projectName: 'Beat: v2/final?' },
        );

        expect(result.fileName).toBe('Beat- v2-final-.wav');
    });

    it('falls back to a name when the project is untitled', async () => {
        const result = await exportProjectAudio(
            { tracks: [track({})], clips: [clip({})], tempo: 120, projectName: '   ' },
        );

        expect(result.fileName).toBe('Untitled.wav');
    });
});

describe('projectEndBeat', () => {
    it('is the last beat any region occupies', () => {
        expect(projectEndBeat([
            clip({ start: 0, duration: 4 }),
            clip({ id: 'b', start: 30, duration: 2 }),
            clip({ id: 'c', start: 8, duration: 4 }),
        ])).toBe(32);
    });

    it('is zero for an empty project', () => {
        expect(projectEndBeat([])).toBe(0);
    });
});
