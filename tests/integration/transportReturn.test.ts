/**
 * Pins the transport's "start where the playhead is" contract.
 *
 * The bug: playback never began where the user pressed play, and the error
 * compounded. `useAudioPlayer` starts the scheduler asynchronously — audio
 * buffers have to decode first — while the store's transport loop begins the
 * moment `playing` flips. With no audio clock to read yet, the loop advanced
 * the playhead by frame accumulation, and `startPlayback` was then handed that
 * drifted value. Measured in a browser, four consecutive plays of the same
 * project started at beats 0.29, 3.85, 7.38 and 10.96, and the voice count
 * fell 26 -> 27 -> 15 -> 7 as the start beat walked off the end of the
 * material. That is the reported symptom: sound the first time, silence after.
 *
 * Compounding it, the only visible way back to bar 1 did not work. The
 * "go to beginning" button was hidden by default and the rewind button beside
 * it had no click handler at all, so nothing on screen returned to the top.
 */

import { useProjectStore } from '@/store/projectStore';

(globalThis as any).requestAnimationFrame = (cb: Function) => setTimeout(() => cb(Date.now()), 16) as unknown as number;
(globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);

jest.mock('@/engine/audioEngine/bufferCache', () => ({
    bufferCacheManager: { getBuffer: jest.fn(), addBuffer: jest.fn(), dispose: jest.fn() },
}));

jest.mock('@/engine/AudioEngineAdapter', () => ({
    audioEngine: new Proxy({} as Record<string, unknown>, {
        get: (target, prop) => {
            if (prop === 'isPlaying') return false;
            if (!(prop in target)) target[prop as string] = jest.fn();
            return target[prop as string];
        },
    }),
}));

describe('transport return-to-start', () => {
    beforeEach(() => {
        useProjectStore.setState({ playing: false, playhead: 0, recording: false });
    });

    afterEach(() => {
        useProjectStore.setState({ playing: false });
    });

    it('moving the playhead while stopped leaves it exactly there', () => {
        useProjectStore.getState().movePlayhead(8);

        expect(useProjectStore.getState().playhead).toBe(8);
        expect(useProjectStore.getState().playing).toBe(false);
    });

    it('moving the playhead while rolling stops first, then lands on the beat', () => {
        useProjectStore.setState({ playing: true, playhead: 12.5 });

        useProjectStore.getState().movePlayhead(0);

        // One press has to do both, or a "go to beginning" wired to `stop` only
        // stops, and the next play resumes from the middle of the project.
        expect(useProjectStore.getState().playing).toBe(false);
        expect(useProjectStore.getState().playhead).toBe(0);
    });

    it('shows a go-to-beginning button in the default control bar', () => {
        // The default hid it, leaving rewind — which had no handler — as the
        // only control that looked like it went back to the start.
        expect(useProjectStore.getState().controlBarSettings.transportButtons.goBeginning).toBe(true);
    });

    it('holds the playhead while the scheduler is still arming', async () => {
        // The audio clock does not exist until startPlayback has run. While it
        // is missing the playhead must not creep, because whatever value it
        // holds is the beat playback will begin at.
        useProjectStore.setState({ playhead: 0 });
        useProjectStore.getState().play();

        await new Promise(r => setTimeout(r, 120)); // ~7 animation frames

        expect(useProjectStore.getState().playhead).toBe(0);
    });
});
