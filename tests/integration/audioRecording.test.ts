/**
 * @jest-environment jsdom
 *
 * Audio recording captures audio.
 *
 * `AudioRecorder` is a complete implementation — arm the input, capture it,
 * build a clip with its waveform, register the buffer for playback — and
 * nothing in the app called it. Pressing record on an audio track rolled the
 * transport and grew an empty region, so a take produced a clip with no sound
 * in it. The meters worked, which made it look alive.
 *
 * The transport loop also invented a placeholder region for armed audio
 * tracks. With the recorder wired in that would leave a second, empty region
 * beside the real one, so audio takes now come only from the recorder.
 */

import { useProjectStore } from '@/store/projectStore';

(globalThis as any).requestAnimationFrame = (cb: Function) => setTimeout(() => cb(Date.now()), 16) as unknown as number;
(globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);

const recorder = {
    arm: jest.fn().mockResolvedValue(undefined),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(null),
};
jest.mock('@/engine/audioRecording/recorder', () => ({
    getAudioRecorder: () => recorder,
}));

jest.mock('@/engine/audioEngine/bufferCache', () => ({
    bufferCacheManager: { getBuffer: jest.fn(), addBuffer: jest.fn(), dispose: jest.fn() },
}));

jest.mock('@/engine/AudioEngineAdapter', () => ({
    audioEngine: new Proxy({} as Record<string, unknown>, {
        get: (target, prop) => {
            if (prop === 'isPlaying') return false;
            if (prop === 'scheduleCountIn') return () => 0;
            if (!(prop in target)) target[prop as string] = jest.fn();
            return target[prop as string];
        },
    }),
}));

const AUDIO = 'audio-1';
const MIDI = 'midi-1';

function project(over: Record<string, unknown> = {}) {
    useProjectStore.setState({
        playing: false, recording: false, playhead: 0, clips: [],
        liveRecordingClips: {}, focusedTrackId: AUDIO, recordingError: null,
        tracks: [
            {
                id: AUDIO, name: 'Vox', type: 'audio', volume: 0.8, pan: 0,
                muted: false, soloed: false, recordEnabled: true, color: '#38bdf8',
                outputBusId: 'stereo-out', plugins: [], sends: [],
            },
            {
                id: MIDI, name: 'Keys', type: 'software-instrument', volume: 0.8, pan: 0,
                muted: false, soloed: false, recordEnabled: false, color: '#4ade80',
                outputBusId: 'stereo-out', plugins: [], sends: [],
            },
        ] as never,
        ...over,
    } as never);
}

describe('audio recording', () => {
    beforeEach(() => {
        recorder.arm.mockClear().mockResolvedValue(undefined);
        recorder.start.mockClear().mockResolvedValue(undefined);
        recorder.stop.mockClear().mockResolvedValue(null);
        project();
    });

    afterEach(() => {
        useProjectStore.setState({ playing: false, recording: false } as never);
    });

    it('starts the recorder when a take begins', async () => {
        useProjectStore.getState().toggleRecording();
        await Promise.resolve();
        await Promise.resolve();

        // This is the call that was missing. Everything downstream of it - the
        // clip, its waveform, its buffer - was already written and working.
        expect(recorder.arm).toHaveBeenCalled();
        expect(recorder.start).toHaveBeenCalledWith(
            expect.objectContaining({ trackId: AUDIO }),
        );
    });

    it('captures from the playhead, so the take lands where it was started', async () => {
        useProjectStore.setState({ playhead: 8 } as never);
        useProjectStore.getState().toggleRecording();
        await Promise.resolve();
        await Promise.resolve();

        expect(recorder.start).toHaveBeenCalledWith(
            expect.objectContaining({ startTime: 8 }),
        );
    });

    it('stops the recorder when the take ends', async () => {
        useProjectStore.getState().toggleRecording();
        await Promise.resolve();
        useProjectStore.getState().toggleRecording();
        await Promise.resolve();

        expect(recorder.stop).toHaveBeenCalled();
    });

    it('stops it through stopRecording too', async () => {
        useProjectStore.getState().startRecording();
        await Promise.resolve();
        useProjectStore.getState().stopRecording();
        await Promise.resolve();

        expect(recorder.start).toHaveBeenCalled();
        expect(recorder.stop).toHaveBeenCalled();
    });

    it('falls back to the focused track when nothing is armed', async () => {
        project({
            focusedTrackId: AUDIO,
            tracks: useProjectStore.getState().tracks.map(t => ({ ...t, recordEnabled: false })) as never,
        });
        useProjectStore.getState().toggleRecording();
        await Promise.resolve();
        await Promise.resolve();

        expect(recorder.start).toHaveBeenCalledWith(expect.objectContaining({ trackId: AUDIO }));
    });

    it('does not start the recorder for a MIDI-only take', async () => {
        project({
            focusedTrackId: MIDI,
            tracks: useProjectStore.getState().tracks.map(t => ({
                ...t, recordEnabled: t.id === MIDI,
            })) as never,
        });
        useProjectStore.getState().toggleRecording();
        await Promise.resolve();
        await Promise.resolve();

        // Nothing to capture: a software instrument records notes, not audio.
        expect(recorder.start).not.toHaveBeenCalled();
    });

    it('reports a refused microphone rather than rolling over a dead take', async () => {
        recorder.arm.mockRejectedValue(new Error('Permission dismissed'));

        useProjectStore.getState().toggleRecording();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(useProjectStore.getState().recordingError).toMatch(/Permission dismissed/);
    });

    it('clears the error when the next take begins', async () => {
        useProjectStore.setState({ recordingError: 'old failure' } as never);
        useProjectStore.getState().toggleRecording();

        expect(useProjectStore.getState().recordingError).toBeNull();
    });
});
