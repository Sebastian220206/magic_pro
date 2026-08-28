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
    // Arming and monitoring open the input now, so the mock has to answer for
    // them: `setMonitoring` had no callers at all before, which is exactly why
    // monitoring was silent.
    setMonitoring: jest.fn(),
    disarm: jest.fn(),
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
        recorder.setMonitoring.mockClear();
        recorder.disarm.mockClear();
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

    /*
     * Input monitoring.
     *
     * Arming used to happen inside `beginAudioCapture`, so the input did not
     * open until record was pressed — there was nothing to monitor and nothing
     * to meter while setting a level. And `setMonitoring` had no callers in the
     * app at all, so the recorder's monitor gain was built at zero and left
     * there: two lit buttons and no signal path.
     */
    /** The fixture arms the audio track, so start from a disarmed one. */
    function disarmed() {
        useProjectStore.setState({
            tracks: useProjectStore.getState().tracks.map(t => ({
                ...t, recordEnabled: false, inputMonitoring: false,
            })) as never,
        });
        recorder.arm.mockClear();
        recorder.disarm.mockClear();
        recorder.setMonitoring.mockClear();
    }

    const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

    it('opens the input when a track is record-enabled', async () => {
        disarmed();
        useProjectStore.getState().toggleRecordEnable(AUDIO);
        await settle();

        expect(recorder.arm).toHaveBeenCalled();
    });

    /*
     * The route the buttons actually take.
     *
     * `toggleRecordEnable` and `toggleInputMonitoring` have no callers in the
     * UI at all — the R and I buttons in the track list and the mixer both
     * write through `updateTrack`. Wiring only the toggles left every real
     * click doing nothing, and a test that called the toggles could not see it.
     */
    it('opens the input when the R button writes through updateTrack', async () => {
        disarmed();
        useProjectStore.getState().updateTrack(AUDIO, { recordEnabled: true } as never);
        await settle();

        expect(recorder.arm).toHaveBeenCalled();
    });

    it('opens the monitor path when the I button writes through updateTrack', async () => {
        disarmed();
        useProjectStore.getState().updateTrack(AUDIO, { inputMonitoring: true } as never);
        await settle();

        expect(recorder.setMonitoring).toHaveBeenCalledWith(true);
    });

    it('leaves the input alone for updates that are not about arming', async () => {
        disarmed();
        useProjectStore.getState().updateTrack(AUDIO, { volume: 0.5 } as never);
        await settle();

        expect(recorder.arm).not.toHaveBeenCalled();
        expect(recorder.disarm).not.toHaveBeenCalled();
    });

    it('does not open the monitor path for arming alone', async () => {
        disarmed();
        useProjectStore.getState().toggleRecordEnable(AUDIO);
        await settle();

        expect(recorder.setMonitoring).toHaveBeenCalledWith(false);
    });

    it('opens the monitor path when input monitoring is switched on', async () => {
        disarmed();
        useProjectStore.getState().toggleInputMonitoring(AUDIO);
        await settle();

        expect(recorder.setMonitoring).toHaveBeenCalledWith(true);
    });

    it('closes the input when nothing is armed or monitoring', async () => {
        disarmed();
        useProjectStore.getState().toggleRecordEnable(AUDIO);
        await settle();
        recorder.disarm.mockClear();

        useProjectStore.getState().toggleRecordEnable(AUDIO);
        await settle();

        expect(recorder.disarm).toHaveBeenCalled();
    });

    it('leaves the input open while a take is running', async () => {
        disarmed();
        useProjectStore.setState({ recording: true } as never);
        useProjectStore.getState().toggleRecordEnable(AUDIO);
        await settle();
        recorder.disarm.mockClear();

        // Disarming mid-take would pull the stream out from under the recorder.
        useProjectStore.getState().toggleRecordEnable(AUDIO);
        await settle();

        expect(recorder.disarm).not.toHaveBeenCalled();
    });

    it('gives a device that has gone missing a sentence, not an empty string', () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { describeRecordingError } = require('@/lib/recordingErrors');
        // OverconstrainedError carries no `.message`, so reading it produced ''
        // — indistinguishable from no error, which is how a failed take looked.
        const err = new DOMException('', 'OverconstrainedError');
        expect(describeRecordingError(err)).toMatch(/not available/i);
        expect(describeRecordingError(new DOMException('', 'NotAllowedError'))).toMatch(/blocked/i);
        expect(describeRecordingError(new DOMException('', 'NotReadableError'))).toMatch(/in use/i);
    });
});
