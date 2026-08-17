/**
 * Pins MIDI recording end to end: arm, roll, capture, and play back.
 *
 * Everything here was broken at once, and each defect hid the next.
 *
 *  - `toggleRecording` set `playing: true` on the state instead of calling
 *    `play()`. `play()` is what starts the loop that advances the playhead, so
 *    the playhead never moved: every note landed on the beat where record was
 *    pressed, all at the minimum length, in a clip that never grew past 1 beat.
 *  - Note-off found its note by scanning the clip for `duration === 0.25`, the
 *    placeholder note-on wrote. It matched any note that happened to be a
 *    sixteenth long, and rewrote every match rather than the one released.
 *  - The clip was typed by `track.type === 'midi' ? 'midi' : 'audio'`, but the
 *    New Track dialog makes `software-instrument` and `drummer` tracks. So a
 *    normal instrument track recorded MIDI notes into a clip typed `audio`,
 *    which the sequencer skips - captured, then never played.
 *  - `countInEnabled` / `countInBars` had a control-bar toggle and were saved
 *    with the project, but nothing read them.
 */

import { useProjectStore } from '@/store/projectStore';
import { recordedClipType, isMidiTrackType } from '@/lib/trackKinds';

(globalThis as any).requestAnimationFrame = (cb: Function) => setTimeout(() => cb(Date.now()), 16) as unknown as number;
(globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);

jest.mock('@/engine/audioEngine/bufferCache', () => ({
    bufferCacheManager: { getBuffer: jest.fn(), addBuffer: jest.fn(), dispose: jest.fn() },
}));

const countIn = jest.fn().mockReturnValue(0);
jest.mock('@/engine/AudioEngineAdapter', () => ({
    audioEngine: new Proxy({} as Record<string, unknown>, {
        get: (target, prop) => {
            if (prop === 'isPlaying') return false;
            if (prop === 'scheduleCountIn') return (...a: number[]) => countIn(...a);
            if (!(prop in target)) target[prop as string] = jest.fn();
            return target[prop as string];
        },
    }),
}));

const TRACK = 'track-rec-1';

function armedInstrumentTrack(type = 'software-instrument') {
    useProjectStore.setState({
        playing: false, recording: false, playhead: 0, clips: [],
        liveRecordingClips: {}, focusedTrackId: TRACK,
        tracks: [{
            id: TRACK, name: 'Piano', type, instrument: 'Grand Piano',
            volume: 0.8, pan: 0, muted: false, soloed: false, recordEnabled: true,
            color: '#22d3ee', outputBusId: 'stereo-out', plugins: [], sends: [],
        }] as never,
    });
}

const liveClip = () => useProjectStore.getState().clips.find(c => c.trackId === TRACK);

describe('MIDI recording', () => {
    beforeEach(() => {
        countIn.mockClear().mockReturnValue(0);
        armedInstrumentTrack();
    });

    afterEach(() => {
        const s = useProjectStore.getState();
        if (s.recording) s.toggleRecording();
        useProjectStore.setState({ playing: false, recording: false });
    });

    it('records a note into a MIDI clip, not an audio one', () => {
        useProjectStore.getState().toggleRecording();
        useProjectStore.setState({ playhead: 1 });
        useProjectStore.getState().triggerNote(60, 100, TRACK);

        const clip = liveClip()!;
        expect(clip).toBeDefined();
        // An `audio` clip holding notes is silent: the sequencer skips it.
        expect(clip.type).toBe('midi');
        expect(clip.notes).toHaveLength(1);
        expect(clip.notes![0].pitch).toBe(60);
    });

    it('rolls the transport so notes land on the beat they were played', () => {
        useProjectStore.getState().toggleRecording();

        useProjectStore.setState({ playhead: 2 });
        useProjectStore.getState().triggerNote(60, 100, TRACK);
        useProjectStore.setState({ playhead: 4 });
        useProjectStore.getState().triggerNote(64, 100, TRACK);

        const starts = liveClip()!.notes!.map(n => n.start);
        // Distinct positions. Before the fix both were 0: the playhead never
        // advanced because `play()` was never called.
        expect(starts[0]).not.toBeCloseTo(starts[1]);
        expect(useProjectStore.getState().playing).toBe(true);
    });

    it('gives a held note its real length on release', () => {
        useProjectStore.getState().toggleRecording();
        useProjectStore.setState({ playhead: 1 });
        useProjectStore.getState().triggerNote(60, 100, TRACK);
        useProjectStore.setState({ playhead: 3 });
        useProjectStore.getState().releaseNote(60, TRACK);

        expect(liveClip()!.notes![0].duration).toBeCloseTo(2, 5);
    });

    it('releasing one note does not rewrite another of the same pitch', () => {
        useProjectStore.getState().toggleRecording();

        useProjectStore.setState({ playhead: 0 });
        useProjectStore.getState().triggerNote(60, 100, TRACK);
        useProjectStore.setState({ playhead: 1 });
        useProjectStore.getState().releaseNote(60, TRACK);

        useProjectStore.setState({ playhead: 2 });
        useProjectStore.getState().triggerNote(60, 100, TRACK);
        useProjectStore.setState({ playhead: 6 });
        useProjectStore.getState().releaseNote(60, TRACK);

        const notes = liveClip()!.notes!;
        expect(notes).toHaveLength(2);
        // The old code matched on `duration === 0.25` and rewrote every hit, so
        // the first note was retimed by the second note's release.
        expect(notes[0].duration).toBeCloseTo(1, 5);
        expect(notes[1].duration).toBeCloseTo(4, 5);
    });

    it('grows the clip to contain every note it holds', () => {
        useProjectStore.getState().toggleRecording();
        useProjectStore.setState({ playhead: 7 });
        useProjectStore.getState().triggerNote(60, 100, TRACK);
        useProjectStore.setState({ playhead: 9 });
        useProjectStore.getState().releaseNote(60, TRACK);

        const clip = liveClip()!;
        const note = clip.notes![0];
        // The sequencer clips notes to the clip end, so a clip stuck at 1 beat
        // silences everything recorded after it.
        expect(clip.duration).toBeGreaterThanOrEqual(note.start + note.duration);
    });

    it('counts in before rolling when count-in is enabled', () => {
        useProjectStore.setState({ countInEnabled: true, countInBars: 2, tempo: 120, timeSignature: '4/4' });
        countIn.mockReturnValue(4);

        useProjectStore.getState().toggleRecording();

        expect(countIn).toHaveBeenCalledWith(2, 4, 120);
        // The transport waits for the clicks rather than rolling over them.
        expect(useProjectStore.getState().playing).toBe(false);

        useProjectStore.getState().toggleRecording();
        useProjectStore.setState({ countInEnabled: false });
    });
});

describe('recorded clip type', () => {
    it.each([
        ['midi', 'midi'],
        ['software-instrument', 'midi'],
        ['drummer', 'midi'],
        ['external-midi', 'midi'],
        ['audio', 'audio'],
    ])('%s track records a %s clip', (trackType, expected) => {
        expect(recordedClipType(trackType)).toBe(expected);
    });

    it('treats every note-hosting track type as MIDI', () => {
        expect(isMidiTrackType('software-instrument')).toBe(true);
        expect(isMidiTrackType('audio')).toBe(false);
        expect(isMidiTrackType(undefined)).toBe(false);
    });
});
