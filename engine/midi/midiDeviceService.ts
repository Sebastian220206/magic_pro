/**
 * midiDeviceService.ts
 * Single owner of Web MIDI access and the connected-device list.
 *
 * `navigator.requestMIDIAccess()` was previously called from five places
 * (providers, the preferences dialog, the audio adapter, the control-surface
 * engine, the MIDI recorder), each keeping its own `MIDIAccess`, its own
 * `onstatechange` handler and its own copy of the device list. None of them
 * surfaced failures: every one logged to the console and left the UI showing an
 * empty list, so "no devices" and "permission denied" looked identical.
 *
 * This module owns one access object, tracks why enumeration failed, and
 * notifies subscribers when devices are plugged or unplugged.
 */

export type MidiAccessStatus =
    /** Not requested yet. */
    | 'idle'
    /** Waiting on the browser / the user's permission decision. */
    | 'requesting'
    /** Access granted; `devices` is authoritative. */
    | 'granted'
    /** The user or a policy denied access. */
    | 'denied'
    /** The browser has no Web MIDI support (Safari, Firefox without the flag). */
    | 'unsupported'
    /** Something else went wrong; see `error`. */
    | 'error';

export interface MidiInputDevice {
    id: string;
    name: string;
    manufacturer: string;
    /** 'connected' | 'disconnected' as reported by the browser. */
    state: string;
}

export interface MidiDeviceSnapshot {
    status: MidiAccessStatus;
    devices: MidiInputDevice[];
    error?: string;
}

type Listener = (snapshot: MidiDeviceSnapshot) => void;

/** A raw message from one input, with the port it arrived on. */
export interface MidiMessage {
    data: Uint8Array;
    inputId: string;
}

type MessageListener = (message: MidiMessage) => void;

/** Human-readable explanation for a status, for display in the UI. */
export function describeMidiStatus(snapshot: MidiDeviceSnapshot): string {
    switch (snapshot.status) {
        case 'idle':
        case 'requesting':
            return 'Looking for MIDI devices…';
        case 'unsupported':
            return 'This browser does not support Web MIDI. Chrome or Edge is required.';
        case 'denied':
            return 'MIDI access was blocked. Allow MIDI for this site in your browser settings, then click Rescan.';
        case 'error':
            return `MIDI could not be started: ${snapshot.error ?? 'unknown error'}`;
        case 'granted':
            return snapshot.devices.length === 0
                ? 'No MIDI input devices detected. Connect a device and click Rescan.'
                : `${snapshot.devices.length} MIDI input${snapshot.devices.length === 1 ? '' : 's'} connected.`;
    }
}

class MidiDeviceService {
    private access: MIDIAccess | null = null;
    private snapshot: MidiDeviceSnapshot = { status: 'idle', devices: [] };
    private listeners = new Set<Listener>();
    private messageListeners = new Set<MessageListener>();
    private pending: Promise<MidiDeviceSnapshot> | null = null;

    getSnapshot(): MidiDeviceSnapshot {
        return this.snapshot;
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        listener(this.snapshot);
        return () => { this.listeners.delete(listener); };
    }

    /**
     * Request access and enumerate inputs.
     *
     * Safe to call repeatedly — concurrent calls share one request, and once
     * granted the cached access object is reused rather than re-prompting.
     */
    async initialize(): Promise<MidiDeviceSnapshot> {
        if (this.access) {
            this.refreshDevices();
            return this.snapshot;
        }
        if (this.pending) return this.pending;

        if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
            this.publish({ status: 'unsupported', devices: [] });
            return this.snapshot;
        }

        this.publish({ status: 'requesting', devices: this.snapshot.devices });

        this.pending = (async () => {
            try {
                // sysex is not requested: it triggers a stricter permission
                // prompt and nothing here needs system-exclusive messages.
                const access = await navigator.requestMIDIAccess({ sysex: false });
                this.access = access;

                access.onstatechange = () => this.refreshDevices();
                this.refreshDevices();
            } catch (error) {
                const name = (error as Error)?.name;
                const message = (error as Error)?.message ?? String(error);
                this.publish({
                    status: name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error',
                    devices: [],
                    error: message,
                });
            } finally {
                this.pending = null;
            }
            return this.snapshot;
        })();

        return this.pending;
    }

    /**
     * Receive every incoming MIDI message. Returns an unsubscribe function.
     *
     * `MIDIInput.onmidimessage` is a single slot, not an event list: assigning
     * it replaces whatever was there, and assigning null leaves the port dead.
     * Six modules used to assign it directly, so whichever ran last owned the
     * keyboard and the rest silently received nothing. The piano roll's
     * recorder was the worst of them - starting it stole every port from the
     * note router, and stopping it nulled them, so the keyboard went
     * completely dead until a device was replugged.
     *
     * This service owns `MIDIAccess`, so it owns the handler too. Everything
     * else subscribes here and gets its own copy of every message.
     */
    subscribeToMessages(listener: MessageListener): () => void {
        this.messageListeners.add(listener);
        return () => { this.messageListeners.delete(listener); };
    }

    /** Bind our one handler to every input; idempotent. */
    private attachMessageHandlers(): void {
        if (!this.access) return;
        this.access.inputs.forEach(input => {
            // Re-assigning the same-shaped handler on an already-bound port is
            // harmless, and covers ports that appear after the first bind.
            input.onmidimessage = (event: MIDIMessageEvent) => {
                if (!event.data) return;
                const message: MidiMessage = { data: event.data, inputId: input.id };
                this.messageListeners.forEach(l => {
                    try {
                        l(message);
                    } catch (error) {
                        console.error('[MidiDevices] message listener failed:', error);
                    }
                });
            };
        });
    }

    /** Re-read the device list from the existing access object. */
    refreshDevices(): MidiDeviceSnapshot {
        if (!this.access) return this.snapshot;

        this.attachMessageHandlers();

        const devices: MidiInputDevice[] = [];
        this.access.inputs.forEach(input => {
            devices.push({
                id: input.id,
                name: input.name || 'Unknown MIDI Device',
                manufacturer: input.manufacturer || '',
                state: input.state,
            });
        });

        this.publish({ status: 'granted', devices });
        return this.snapshot;
    }

    /** The underlying access object, for consumers that attach note handlers. */
    getAccess(): MIDIAccess | null {
        return this.access;
    }

    private publish(snapshot: MidiDeviceSnapshot): void {
        this.snapshot = snapshot;
        this.listeners.forEach(listener => {
            try {
                listener(snapshot);
            } catch (error) {
                console.error('[MidiDevices] listener failed:', error);
            }
        });
    }

    /** Test-only reset. */
    __reset(): void {
        this.access = null;
        this.pending = null;
        this.listeners.clear();
        this.messageListeners.clear();
        this.snapshot = { status: 'idle', devices: [] };
    }
}

export const midiDeviceService = new MidiDeviceService();
