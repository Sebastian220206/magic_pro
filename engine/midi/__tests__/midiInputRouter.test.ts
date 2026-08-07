/**
 * Tests for MIDI note input routing.
 *
 * Regression: incoming MIDI messages were only ever matched against
 * control-surface command assignments. Notes from a connected keyboard matched
 * nothing and were discarded, so playing the keyboard was silent.
 */

import {
    MidiInputRouter,
    parseMidiMessage,
    type MidiRoutingContext,
} from '@/engine/midi/midiInputRouter';

describe('parseMidiMessage', () => {
    test('decodes note on', () => {
        expect(parseMidiMessage([0x90, 60, 100]))
            .toEqual({ kind: 'noteOn', channel: 0, note: 60, velocity: 100 });
    });

    test('decodes note off', () => {
        expect(parseMidiMessage([0x80, 60, 0]))
            .toEqual({ kind: 'noteOff', channel: 0, note: 60, velocity: 0 });
    });

    test('treats note on with velocity 0 as note off', () => {
        // Most keyboards send this instead of a real Note Off; reading it as
        // "on" leaves the note sounding forever.
        expect(parseMidiMessage([0x90, 60, 0]).kind).toBe('noteOff');
    });

    test('reads the channel from the status byte', () => {
        expect(parseMidiMessage([0x95, 60, 100]).channel).toBe(5);
        expect(parseMidiMessage([0x8f, 60, 0]).channel).toBe(15);
    });

    test('decodes control change', () => {
        expect(parseMidiMessage([0xb0, 7, 64]))
            .toEqual({ kind: 'controlChange', channel: 0, controller: 7, value: 64 });
    });

    test('decodes pitch bend as a signed offset', () => {
        expect(parseMidiMessage([0xe0, 0, 64]).value).toBe(0);      // centre
        expect(parseMidiMessage([0xe0, 0, 0]).value).toBe(-8192);   // full down
    });

    test('is defensive about malformed input', () => {
        expect(parseMidiMessage(null).kind).toBe('other');
        expect(parseMidiMessage([]).kind).toBe('other');
        expect(parseMidiMessage([0x90]).kind).toBe('noteOff'); // no velocity => 0
    });
});

describe('MidiInputRouter', () => {
    let triggerNote: jest.Mock;
    let releaseNote: jest.Mock;
    let context: MidiRoutingContext;
    let router: MidiInputRouter;

    beforeEach(() => {
        triggerNote = jest.fn();
        releaseNote = jest.fn();
        context = {
            resolveTargetTrack: () => 'track-1',
            isDeviceEnabled: () => true,
            triggerNote,
            releaseNote,
        };
        router = new MidiInputRouter(context);
    });

    test('plays a note on the armed track', () => {
        router.handleMessage([0x90, 60, 100], 'dev-1');
        expect(triggerNote).toHaveBeenCalledWith('track-1', 60, 100);
    });

    test('releases on note off', () => {
        router.handleMessage([0x90, 60, 100], 'dev-1');
        router.handleMessage([0x80, 60, 0], 'dev-1');
        expect(releaseNote).toHaveBeenCalledWith('track-1', 60);
    });

    test('releases on note-on-with-zero-velocity', () => {
        router.handleMessage([0x90, 60, 100], 'dev-1');
        router.handleMessage([0x90, 60, 0], 'dev-1');
        expect(releaseNote).toHaveBeenCalledWith('track-1', 60);
    });

    test('ignores messages from a disabled device', () => {
        context.isDeviceEnabled = () => false;
        router.setContext(context);

        router.handleMessage([0x90, 60, 100], 'dev-1');

        expect(triggerNote).not.toHaveBeenCalled();
    });

    test('drops notes when no track is armed', () => {
        context.resolveTargetTrack = () => null;
        router.setContext(context);

        router.handleMessage([0x90, 60, 100], 'dev-1');

        expect(triggerNote).not.toHaveBeenCalled();
    });

    test('ignores non-note messages', () => {
        router.handleMessage([0xb0, 7, 64], 'dev-1');
        expect(triggerNote).not.toHaveBeenCalled();
    });

    test('a note off for an unheld note is a no-op', () => {
        router.handleMessage([0x80, 60, 0], 'dev-1');
        expect(releaseNote).not.toHaveBeenCalled();
    });

    test('re-pressing a held note restarts it instead of stacking voices', () => {
        router.handleMessage([0x90, 60, 100], 'dev-1');
        router.handleMessage([0x90, 60, 110], 'dev-1');

        expect(releaseNote).toHaveBeenCalledTimes(1);
        expect(triggerNote).toHaveBeenCalledTimes(2);
    });

    test('releases on the track the note started on', () => {
        // The armed track can change while a key is still held.
        router.handleMessage([0x90, 60, 100], 'dev-1');
        context.resolveTargetTrack = () => 'track-2';
        router.setContext(context);

        router.handleMessage([0x80, 60, 0], 'dev-1');

        expect(releaseNote).toHaveBeenCalledWith('track-1', 60);
    });
});

describe('MidiInputRouter — active notes', () => {
    let router: MidiInputRouter;

    beforeEach(() => {
        router = new MidiInputRouter({
            resolveTargetTrack: () => 'track-1',
            isDeviceEnabled: () => true,
            triggerNote: jest.fn(),
            releaseNote: jest.fn(),
        });
    });

    test('tracks held notes', () => {
        router.handleMessage([0x90, 60, 100]);
        router.handleMessage([0x90, 64, 100]);

        expect(Array.from(router.getActiveNotes()).sort((a, b) => a - b)).toEqual([60, 64]);
    });

    test('removes a note on release', () => {
        router.handleMessage([0x90, 60, 100]);
        router.handleMessage([0x90, 64, 100]);
        router.handleMessage([0x80, 60, 0]);

        expect(Array.from(router.getActiveNotes())).toEqual([64]);
    });

    test('notifies subscribers as keys are played', () => {
        const seen: number[][] = [];
        router.subscribe(notes => seen.push(Array.from(notes).sort((a, b) => a - b)));

        router.handleMessage([0x90, 60, 100]);
        router.handleMessage([0x90, 67, 100]);
        router.handleMessage([0x80, 60, 0]);

        expect(seen).toEqual([[], [60], [60, 67], [67]]);
    });

    test('unsubscribing stops notifications', () => {
        const listener = jest.fn();
        const unsubscribe = router.subscribe(listener);
        unsubscribe();

        router.handleMessage([0x90, 60, 100]);

        expect(listener).toHaveBeenCalledTimes(1); // only the initial call
    });

    test('allNotesOff releases everything held', () => {
        const releaseNote = jest.fn();
        router.setContext({
            resolveTargetTrack: () => 'track-1',
            isDeviceEnabled: () => true,
            triggerNote: jest.fn(),
            releaseNote,
        });

        router.handleMessage([0x90, 60, 100]);
        router.handleMessage([0x90, 64, 100]);
        router.allNotesOff();

        expect(releaseNote).toHaveBeenCalledTimes(2);
        expect(router.getActiveNotes().size).toBe(0);
    });
});
