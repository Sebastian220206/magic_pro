/**
 * `MIDIInput.onmidimessage` has exactly one owner.
 *
 * It is a single slot, not an event list. Six modules used to assign it
 * directly - the audio adapter, the piano roll's `MidiRecorder`, the
 * control-surface engine, the control-surface manager, and the MTC and MMC
 * sync modules - so whichever ran last owned the keyboard and every other
 * consumer silently received nothing.
 *
 * `MidiRecorder` was the one users hit. Starting it took every port away from
 * the note router that feeds recording, and `stop()` set those ports to
 * `null`, which left the keyboard completely dead until it was replugged.
 * Opening the piano roll and pressing R was enough: from then on a connected
 * keyboard neither sounded nor recorded on the software instrument track.
 *
 * `midiDeviceService` owns `MIDIAccess`, so it owns the handler. Everything
 * else subscribes and gets its own copy.
 */

import { midiDeviceService } from '@/engine/midi/midiDeviceService';
import { MidiRecorder } from '@/engine/midi/MidiRecorder';

interface FakeInput {
    id: string;
    name: string;
    manufacturer: string;
    state: string;
    onmidimessage: ((e: { data: Uint8Array }) => void) | null;
}

const originalNavigator = globalThis.navigator;
let inputs: FakeInput[];

function install() {
    inputs = [
        { id: 'in-1', name: 'Digital Piano', manufacturer: 'Acme', state: 'connected', onmidimessage: null },
        { id: 'in-2', name: 'Pad Controller', manufacturer: 'Acme', state: 'connected', onmidimessage: null },
    ];
    const access = {
        inputs: { forEach: (fn: (i: FakeInput) => void) => inputs.forEach(fn) },
        onstatechange: null as null | (() => void),
    };
    Object.defineProperty(globalThis, 'navigator', {
        value: { requestMIDIAccess: () => Promise.resolve(access) },
        configurable: true, writable: true,
    });
}

/** Fire a message as the browser would, through whatever owns the port. */
const send = (inputId: string, bytes: number[]) => {
    const input = inputs.find(i => i.id === inputId)!;
    input.onmidimessage?.({ data: new Uint8Array(bytes) });
};

beforeEach(async () => {
    midiDeviceService.__reset();
    install();
    await midiDeviceService.initialize();
});

afterAll(() => {
    Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator, configurable: true, writable: true,
    });
});

describe('MIDI message ownership', () => {
    it('delivers one message to every subscriber', () => {
        const a = jest.fn();
        const b = jest.fn();
        midiDeviceService.subscribeToMessages(a);
        midiDeviceService.subscribeToMessages(b);

        send('in-1', [0x90, 60, 100]);

        expect(a).toHaveBeenCalledTimes(1);
        expect(b).toHaveBeenCalledTimes(1);
        expect(a.mock.calls[0][0].inputId).toBe('in-1');
        expect(Array.from(a.mock.calls[0][0].data)).toEqual([0x90, 60, 100]);
    });

    it('unsubscribing one consumer leaves the others receiving', () => {
        const a = jest.fn();
        const b = jest.fn();
        const stopA = midiDeviceService.subscribeToMessages(a);
        midiDeviceService.subscribeToMessages(b);

        stopA();
        send('in-1', [0x90, 60, 100]);

        expect(a).not.toHaveBeenCalled();
        expect(b).toHaveBeenCalledTimes(1);
    });

    it('binds every connected input, not just the first', () => {
        const seen = jest.fn();
        midiDeviceService.subscribeToMessages(seen);

        send('in-1', [0x90, 60, 100]);
        send('in-2', [0x90, 64, 100]);

        expect(seen.mock.calls.map(c => c[0].inputId)).toEqual(['in-1', 'in-2']);
    });

    it('a running MidiRecorder does not take the keyboard from anyone else', async () => {
        const noteRouter = jest.fn();
        midiDeviceService.subscribeToMessages(noteRouter);

        const recorder = new MidiRecorder(jest.fn(), () => 0);
        await recorder.start(4);

        send('in-1', [0x90, 60, 100]);

        // This is the bug: the recorder used to own the port outright.
        expect(noteRouter).toHaveBeenCalledTimes(1);
    });

    it('stopping a MidiRecorder leaves the keyboard alive', async () => {
        const noteRouter = jest.fn();
        midiDeviceService.subscribeToMessages(noteRouter);

        const recorder = new MidiRecorder(jest.fn(), () => 0);
        await recorder.start(4);
        recorder.stop();

        send('in-1', [0x90, 60, 100]);

        // `stop()` used to null every port, so nothing worked afterwards -
        // no sound, no recording - until the device was replugged.
        expect(noteRouter).toHaveBeenCalledTimes(1);
        expect(inputs.every(i => i.onmidimessage !== null)).toBe(true);
    });

    it('keeps ports bound across a device rescan', () => {
        const seen = jest.fn();
        midiDeviceService.subscribeToMessages(seen);

        midiDeviceService.refreshDevices();
        send('in-1', [0x90, 60, 100]);

        expect(seen).toHaveBeenCalledTimes(1);
    });
});
