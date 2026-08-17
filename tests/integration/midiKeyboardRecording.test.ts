/**
 * Pins that a connected MIDI keyboard records, not just sounds.
 *
 * There are two `triggerNote`s in this codebase and they are not
 * interchangeable:
 *
 *   AudioEngineAdapter.triggerNote(trackId, pitch, velocity)  - makes a sound
 *   projectStore.triggerNote(pitch, velocity, trackId)        - sounds AND records
 *
 * `startLiveMidiInput` was wired to the first. A hardware keyboard therefore
 * played perfectly and captured nothing: arm a track, hit record, play, and the
 * region came back empty. On-screen Musical Typing goes through the store and
 * recorded fine, which is what made the fault look like a hardware problem.
 *
 * Note the argument orders are rotations of each other, so the wrong call is
 * type-correct and silently plays pitch-as-track.
 */

import { startLiveMidiInput } from '@/engine/midi/liveMidiInput';

const engineTriggerNote = jest.fn();
const engineReleaseNote = jest.fn();
let midiListener: ((e: { message: { data: number[] }; inputId: string }) => void) | null = null;

jest.mock('@/engine/AudioEngineAdapter', () => ({
    audioEngine: {
        triggerNote: (...a: unknown[]) => engineTriggerNote(...a),
        releaseNote: (...a: unknown[]) => engineReleaseNote(...a),
        addMidiListener: (cb: never) => { midiListener = cb; return () => { midiListener = null; }; },
    },
}));

const noteOn = (pitch: number, velocity = 100) => ({ message: { data: [0x90, pitch, velocity] }, inputId: 'dev-1' });
const noteOff = (pitch: number) => ({ message: { data: [0x80, pitch, 0] }, inputId: 'dev-1' });

const state = {
    tracks: [{ id: 'track-1', type: 'software-instrument', recordEnabled: true }],
    focusedTrackId: 'track-1',
};

describe('MIDI keyboard input', () => {
    let storeTrigger: jest.Mock;
    let storeRelease: jest.Mock;
    let stop: () => void;

    beforeEach(() => {
        engineTriggerNote.mockClear();
        engineReleaseNote.mockClear();
        storeTrigger = jest.fn();
        storeRelease = jest.fn();
        stop = startLiveMidiInput({
            getState: () => state as never,
            triggerNote: (p, v, t) => storeTrigger(p, v, t),
            releaseNote: (p, t) => storeRelease(p, t),
        });
    });

    afterEach(() => stop());

    it('routes a played note through the store, which is what records it', () => {
        midiListener!(noteOn(60, 96));

        expect(storeTrigger).toHaveBeenCalledWith(60, 96, 'track-1');
        // The engine's own triggerNote only makes a sound; going through it is
        // exactly the bug, so it must not be the path taken.
        expect(engineTriggerNote).not.toHaveBeenCalled();
    });

    it('passes pitch, velocity and track in the store argument order', () => {
        midiListener!(noteOn(64, 33));

        // Both signatures are rotations of (string, number, number), so a wrong
        // ordering type-checks and silently plays the wrong note on the wrong
        // track. Pin the positions.
        const [pitch, velocity, trackId] = storeTrigger.mock.calls[0];
        expect(pitch).toBe(64);
        expect(velocity).toBe(33);
        expect(trackId).toBe('track-1');
    });

    it('releases through the store too, so note length is captured', () => {
        midiListener!(noteOn(60));
        midiListener!(noteOff(60));

        expect(storeRelease).toHaveBeenCalledWith(60, 'track-1');
        expect(engineReleaseNote).not.toHaveBeenCalled();
    });

    it('treats note-on with velocity 0 as a release', () => {
        // What most keyboards actually send instead of a note-off. Through the
        // store this ends the recorded note; missed, it would ring forever and
        // never get a duration.
        midiListener!(noteOn(60));
        midiListener!(noteOn(60, 0));

        expect(storeRelease).toHaveBeenCalledWith(60, 'track-1');
    });

    it('falls back to the audio engine when no store handlers are given', () => {
        stop();
        stop = startLiveMidiInput({ getState: () => state as never });

        midiListener!(noteOn(60, 100));

        expect(engineTriggerNote).toHaveBeenCalledWith('track-1', 60, 100);
    });
});
