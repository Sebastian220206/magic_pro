/**
 * The piano roll's transport controls drive the real transport.
 *
 * `midiStore`'s play/stop/seek used to drive a local `MidiScheduler` and set
 * `isPlaying` on itself. Nothing ever registered an instrument on that
 * scheduler and nothing ticked its lookahead, so it could not make a sound —
 * pressing play in the piano roll did nothing audible while the flag made the
 * button look active. `seekToBeat` likewise moved only this store's
 * `currentBeat`, so "go to start" left the real playhead where it was.
 *
 * The transport belongs to `projectStore`. This store mirrors `isPlaying` and
 * `currentBeat` for the editor's playhead, and `ProjectPianoRollAdapter` keeps
 * the mirror in step — which is why these actions must not write the flag
 * themselves.
 */

import { useMidiStore } from '@/store/midiStore';

describe('piano roll transport', () => {
    let play: jest.Mock;
    let stop: jest.Mock;
    let seek: jest.Mock;
    let setTempo: jest.Mock;

    beforeEach(() => {
        play = jest.fn();
        stop = jest.fn();
        seek = jest.fn();
        setTempo = jest.fn();
        useMidiStore.setState({ isPlaying: false, currentBeat: 0 } as never);
        useMidiStore.getState().setTransport({ play, stop, seek, setTempo });
    });

    afterEach(() => {
        useMidiStore.getState().setTransport(null);
    });

    it('play starts the project transport', () => {
        useMidiStore.getState().play();
        expect(play).toHaveBeenCalledTimes(1);
    });

    it('stop stops the project transport', () => {
        useMidiStore.getState().stop();
        expect(stop).toHaveBeenCalledTimes(1);
    });

    it('seeking moves the real playhead, not just the editor ruler', () => {
        useMidiStore.getState().seekToBeat(0);
        // The project's seek stops a rolling transport first, so one press of
        // "go to start" both stops and rewinds.
        expect(seek).toHaveBeenCalledWith(0);
    });

    it('tempo changes reach the project', () => {
        useMidiStore.getState().setTempo(140);
        expect(setTempo).toHaveBeenCalledWith(140);
        expect(useMidiStore.getState().tempo).toBe(140);
    });

    it('is inert with no transport attached, rather than throwing', () => {
        useMidiStore.getState().setTransport(null);
        expect(() => useMidiStore.getState().play()).not.toThrow();
        expect(() => useMidiStore.getState().seekToBeat(4)).not.toThrow();
    });

    it('does not set isPlaying itself', () => {
        useMidiStore.getState().play();

        // The flag is mirrored from the project transport by the adapter.
        // Writing it here made the button read "playing" while nothing rolled,
        // and would now fight the mirror.
        expect(useMidiStore.getState().isPlaying).toBe(false);
    });
});
