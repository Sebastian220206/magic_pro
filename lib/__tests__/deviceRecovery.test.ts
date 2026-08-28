import { resolveDevice } from '@/lib/resolveDevice';
import { mergeProjectGlobalSettings } from '@/lib/deviceSettings';

/**
 * Device ids are not names.
 *
 * `MediaDeviceInfo.deviceId` is an opaque handle salted per origin, and the
 * salt rotates — replugging an interface does it, so does clearing site data.
 * A stored id then stops resolving: `setSinkId` answers "device not found" and
 * the mix silently reverts to the system default, while `getUserMedia` with
 * `deviceId: { exact }` throws OverconstrainedError and a take records nothing.
 */
const dev = (kind: MediaDeviceKind, deviceId: string, label: string) =>
    ({ kind, deviceId, label }) as MediaDeviceInfo;

describe('finding a device again after its id rotates', () => {
    const devices = [
        dev('audiooutput', 'default', 'Default'),
        dev('audiooutput', 'new-id-aaa', 'Headphones (USB Audio CODEC)'),
        dev('audioinput', 'new-id-bbb', 'Microphone (USB Audio CODEC)'),
    ];

    it('uses the stored id when it still resolves', () => {
        const r = resolveDevice(devices, 'audiooutput',
            { deviceId: 'new-id-aaa', label: 'Headphones (USB Audio CODEC)' });
        expect(r).toEqual({
            deviceId: 'new-id-aaa', recovered: false, label: 'Headphones (USB Audio CODEC)',
        });
    });

    it('finds it by label when the id has gone stale', () => {
        const r = resolveDevice(devices, 'audiooutput',
            { deviceId: 'old-id-from-last-session', label: 'Headphones (USB Audio CODEC)' });
        expect(r?.deviceId).toBe('new-id-aaa');
        expect(r?.recovered).toBe(true);
    });

    it('does not cross the streams: an input label never matches an output', () => {
        const r = resolveDevice(devices, 'audiooutput',
            { deviceId: 'stale', label: 'Microphone (USB Audio CODEC)' });
        expect(r).toBeNull();
    });

    it('gives up when the hardware really is gone', () => {
        const r = resolveDevice(devices, 'audiooutput',
            { deviceId: 'stale', label: 'Some Interface That Is Unplugged' });
        expect(r).toBeNull();
    });

    it('reports nothing when no devices exist at all', () => {
        expect(resolveDevice([], 'audiooutput', { deviceId: 'x', label: 'y' })).toBeNull();
    });
});

/**
 * A project must not bring another machine's hardware with it.
 *
 * Loading a project shallow-merged its `globalSettings` over the local ones, so
 * the project's whole `audio` object replaced the one just read from
 * localStorage — discarding the chosen output on every load, and installing a
 * foreign input id that could not resolve here.
 */
describe('device settings belong to the machine', () => {
    const local = {
        audio: {
            outputDevice: 'mine-out', outputDeviceLabel: 'My Headphones',
            inputDevice: 'mine-in', inputDeviceLabel: 'My Interface',
            ioBufferSize: 256,
        },
        theme: 'dark',
    };

    it("keeps this machine's devices when a project carries its own", () => {
        const merged = mergeProjectGlobalSettings(local, {
            audio: {
                outputDevice: 'theirs-out', outputDeviceLabel: 'Their Speakers',
                inputDevice: 'theirs-in', inputDeviceLabel: 'Their Mic',
                ioBufferSize: 1024,
            },
        } as never);

        expect(merged.audio.outputDevice).toBe('mine-out');
        expect(merged.audio.inputDevice).toBe('mine-in');
        expect(merged.audio.outputDeviceLabel).toBe('My Headphones');
    });

    it('still takes everything else the project saved', () => {
        const merged = mergeProjectGlobalSettings(local, {
            audio: { ioBufferSize: 1024 },
        } as never);

        expect(merged.audio.ioBufferSize).toBe(1024);
    });

    it('accepts the project device when this machine has never chosen one', () => {
        const blank = { audio: { ioBufferSize: 256 } };
        const merged = mergeProjectGlobalSettings(blank, {
            audio: { outputDevice: 'theirs-out' },
        } as never);

        expect((merged.audio as Record<string, unknown>).outputDevice).toBe('theirs-out');
    });

    it('leaves settings untouched when the project has none', () => {
        expect(mergeProjectGlobalSettings(local, undefined)).toBe(local);
    });
});
