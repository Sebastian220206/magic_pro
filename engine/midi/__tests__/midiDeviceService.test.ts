/**
 * Tests for MIDI device discovery.
 *
 * Regression: MIDI access failures were only logged to the console, so a denied
 * permission, an unsupported browser and "nothing plugged in" all presented as
 * the same empty list with no explanation.
 */

import {
    describeMidiStatus,
    midiDeviceService,
    type MidiDeviceSnapshot,
} from '@/engine/midi/midiDeviceService';

const makeInput = (id: string, name: string, state = 'connected') => ({
    id, name, manufacturer: 'Acme', state,
});

/** Minimal MIDIAccess stand-in with a Map-like `inputs`. */
function fakeAccess(inputs: ReturnType<typeof makeInput>[]) {
    return {
        inputs: { forEach: (fn: (i: unknown) => void) => inputs.forEach(fn) },
        onstatechange: null as null | (() => void),
    };
}

const originalNavigator = globalThis.navigator;

function setNavigator(requestMIDIAccess: unknown) {
    Object.defineProperty(globalThis, 'navigator', {
        value: requestMIDIAccess ? { requestMIDIAccess } : {},
        configurable: true,
        writable: true,
    });
}

afterAll(() => {
    Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator, configurable: true, writable: true,
    });
});

beforeEach(() => {
    midiDeviceService.__reset();
});

describe('initialize', () => {
    test('reports unsupported when the browser has no Web MIDI', async () => {
        setNavigator(undefined);

        const snapshot = await midiDeviceService.initialize();

        expect(snapshot.status).toBe('unsupported');
        expect(snapshot.devices).toEqual([]);
    });

    test('reports denied when permission is refused', async () => {
        const err = new Error('Permission to use Web MIDI was not granted.');
        err.name = 'NotAllowedError';
        setNavigator(jest.fn().mockRejectedValue(err));

        const snapshot = await midiDeviceService.initialize();

        expect(snapshot.status).toBe('denied');
    });

    test('reports a generic error for anything else', async () => {
        setNavigator(jest.fn().mockRejectedValue(new Error('boom')));

        const snapshot = await midiDeviceService.initialize();

        expect(snapshot.status).toBe('error');
        expect(snapshot.error).toContain('boom');
    });

    test('enumerates connected inputs when granted', async () => {
        setNavigator(jest.fn().mockResolvedValue(
            fakeAccess([makeInput('a', 'Keystation 49'), makeInput('b', 'Launchpad')]),
        ));

        const snapshot = await midiDeviceService.initialize();

        expect(snapshot.status).toBe('granted');
        expect(snapshot.devices.map(d => d.name)).toEqual(['Keystation 49', 'Launchpad']);
    });

    test('names an unlabelled device rather than showing blank', async () => {
        setNavigator(jest.fn().mockResolvedValue(fakeAccess([makeInput('a', '')])));

        const snapshot = await midiDeviceService.initialize();

        expect(snapshot.devices[0].name).toBe('Unknown MIDI Device');
    });

    test('does not re-prompt once access is granted', async () => {
        const request = jest.fn().mockResolvedValue(fakeAccess([makeInput('a', 'Keys')]));
        setNavigator(request);

        await midiDeviceService.initialize();
        await midiDeviceService.initialize();
        await midiDeviceService.initialize();

        expect(request).toHaveBeenCalledTimes(1);
    });

    test('concurrent callers share one request', async () => {
        const request = jest.fn().mockResolvedValue(fakeAccess([makeInput('a', 'Keys')]));
        setNavigator(request);

        await Promise.all([
            midiDeviceService.initialize(),
            midiDeviceService.initialize(),
            midiDeviceService.initialize(),
        ]);

        expect(request).toHaveBeenCalledTimes(1);
    });
});

describe('hot plugging', () => {
    test('picks up a device connected after startup', async () => {
        const inputs = [makeInput('a', 'Keys')];
        const access = fakeAccess(inputs);
        setNavigator(jest.fn().mockResolvedValue(access));

        await midiDeviceService.initialize();
        expect(midiDeviceService.getSnapshot().devices).toHaveLength(1);

        inputs.push(makeInput('b', 'Pad Controller'));
        access.onstatechange?.();

        expect(midiDeviceService.getSnapshot().devices.map(d => d.name))
            .toEqual(['Keys', 'Pad Controller']);
    });

    test('notifies subscribers on change', async () => {
        const inputs = [makeInput('a', 'Keys')];
        const access = fakeAccess(inputs);
        setNavigator(jest.fn().mockResolvedValue(access));

        const seen: MidiDeviceSnapshot[] = [];
        midiDeviceService.subscribe(s => seen.push(s));

        await midiDeviceService.initialize();
        inputs.push(makeInput('b', 'Pad'));
        access.onstatechange?.();

        expect(seen[seen.length - 1].devices).toHaveLength(2);
    });

    test('unsubscribing stops notifications', async () => {
        const access = fakeAccess([makeInput('a', 'Keys')]);
        setNavigator(jest.fn().mockResolvedValue(access));

        const listener = jest.fn();
        const unsubscribe = midiDeviceService.subscribe(listener);
        unsubscribe();

        await midiDeviceService.initialize();

        // Only the immediate call made at subscribe time.
        expect(listener).toHaveBeenCalledTimes(1);
    });
});

describe('describeMidiStatus', () => {
    const snap = (s: Partial<MidiDeviceSnapshot>): MidiDeviceSnapshot =>
        ({ status: 'granted', devices: [], ...s }) as MidiDeviceSnapshot;

    test('distinguishes denied from empty', () => {
        expect(describeMidiStatus(snap({ status: 'denied' }))).toMatch(/blocked/i);
        expect(describeMidiStatus(snap({ status: 'granted', devices: [] })))
            .toMatch(/no midi input devices/i);
    });

    test('explains an unsupported browser', () => {
        expect(describeMidiStatus(snap({ status: 'unsupported' }))).toMatch(/does not support/i);
    });

    test('counts connected devices', () => {
        expect(describeMidiStatus(snap({
            devices: [{ id: 'a', name: 'Keys', manufacturer: '', state: 'connected' }],
        }))).toMatch(/1 MIDI input connected/);
    });

    test('surfaces the underlying error', () => {
        expect(describeMidiStatus(snap({ status: 'error', error: 'boom' }))).toContain('boom');
    });
});
