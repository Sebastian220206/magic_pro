import type { ControlSurfaceDevice, ControlSurfaceAssignment } from '@/store/projectStore';

export type ControlSurfaceEventCallback = (event: ControlSurfaceEvent) => void;

export interface ControlSurfaceEvent {
  type: 'param_change' | 'command' | 'learn' | 'device_connected' | 'device_disconnected';
  deviceId?: string;
  assignmentId?: string;
  commandId?: string;
  value?: number;
  raw?: {
    status: number;
    channel: number;
    data1: number;
    data2: number;
  };
}

export interface MidiLearnState {
  active: boolean;
  pendingAssignment: Partial<ControlSurfaceAssignment> | null;
}

export class ControlSurfaceEngine {
  private _devices: Map<string, ControlSurfaceDevice> = new Map();
  private _assignments: ControlSurfaceAssignment[] = [];
  private _listeners: Set<ControlSurfaceEventCallback> = new Set();
  private _bypassed = false;
  private _midiLearn: MidiLearnState = { active: false, pendingAssignment: null };
  private _midiAccess: MIDIAccess | null = null;

  get bypassed(): boolean {
    return this._bypassed;
  }

  set bypassed(b: boolean) {
    this._bypassed = b;
  }

  get learnState(): MidiLearnState {
    return { ...this._midiLearn };
  }

  subscribe(cb: ControlSurfaceEventCallback): () => void {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  private _emit(event: ControlSurfaceEvent) {
    for (const cb of this._listeners) cb(event);
  }

  async initMidiAccess(): Promise<void> {
    if (!navigator.requestMIDIAccess) {
      console.warn('[ControlSurface] Web MIDI API not available');
      return;
    }

    try {
      this._midiAccess = await navigator.requestMIDIAccess();

      for (const input of this._midiAccess.inputs.values()) {
        this._onDeviceConnected(input);
      }

      this._midiAccess.onstatechange = (event) => {
        const port = event.port;
        if (!port) return;
        if (port.state === 'connected') {
          this._onDeviceConnected(port as MIDIInput);
        } else if (port.state === 'disconnected') {
          this._onDeviceDisconnected(port as MIDIInput);
        }
      };
    } catch (err) {
      console.error('[ControlSurface] Failed to get MIDI access:', err);
    }
  }

  private _onDeviceConnected(input: MIDIInput) {
    const device: ControlSurfaceDevice = {
      id: input.id,
      name: input.name || 'Unknown MIDI Device',
      type: 'MIDI',
      inputId: input.id,
      enabled: true,
    };
    this._devices.set(input.id, device);

    input.onmidimessage = (msg) => this._handleMidiMessage(msg, input.id);

    this._emit({ type: 'device_connected', deviceId: input.id });
  }

  private _onDeviceDisconnected(input: MIDIInput) {
    this._devices.delete(input.id);
    this._emit({ type: 'device_disconnected', deviceId: input.id });
  }

  setDevices(devices: ControlSurfaceDevice[]) {
    for (const d of devices) {
      this._devices.set(d.id, d);
    }
  }

  setAssignments(assignments: ControlSurfaceAssignment[]) {
    this._assignments = assignments;
  }

  setMidiLearn(active: boolean, pendingAssignment?: Partial<ControlSurfaceAssignment>) {
    this._midiLearn = { active, pendingAssignment: pendingAssignment || null };
    if (!active) {
      this._emit({ type: 'learn', commandId: 'cancel' });
    }
  }

  private _handleMidiMessage(msg: MIDIMessageEvent, deviceId: string) {
    if (this._bypassed) return;
    const data = msg.data;
    if (!data || data.length < 2) return;

    const status = data[0] & 0xf0;
    const channel = data[0] & 0x0f;
    const data1 = data[1];
    const data2 = data.length > 2 ? data[2] : 0;

    if (this._midiLearn.active) {
      this._handleLearn(status, channel, data1, data2, deviceId);
      return;
    }

    for (const assignment of this._assignments) {
      if (assignment.deviceId && assignment.deviceId !== deviceId) continue;
      if (assignment.status !== status || assignment.channel !== channel) continue;
      if (assignment.data1 !== undefined && assignment.data1 !== data1) continue;

      const value = this._mapMidiValue(data2, assignment.mode);
      this._emit({
        type: 'param_change',
        assignmentId: assignment.id,
        commandId: assignment.commandId,
        value,
        deviceId,
        raw: { status, channel, data1, data2 },
      });
    }
  }

  private _handleLearn(status: number, channel: number, data1: number, data2: number, deviceId: string) {
    const assignmentId = this._midiLearn.pendingAssignment?.id || `learn-${Date.now()}`;
    const assignment: ControlSurfaceAssignment = {
      id: this._midiLearn.pendingAssignment?.id || assignmentId,
      deviceId: this._midiLearn.pendingAssignment?.deviceId || deviceId,
      status,
      channel,
      data1,
      data2: this._midiLearn.pendingAssignment?.data2,
      mode: this._midiLearn.pendingAssignment?.mode || 'direct',
      commandId: this._midiLearn.pendingAssignment?.commandId || '',
    };

    this._emit({
      type: 'learn',
      assignmentId: assignment.id,
      commandId: assignment.commandId,
      raw: { status, channel, data1, data2 },
    });
  }

  private _mapMidiValue(midiValue: number, mode: string): number {
    switch (mode) {
      case 'direct':
        return midiValue / 127;
      case 'toggle':
        return midiValue > 0 ? 1 : 0;
      case 'relative':
        return midiValue >= 64 ? -(128 - midiValue) : midiValue;
      default:
        return midiValue / 127;
    }
  }

  dispose() {
    if (this._midiAccess) {
      for (const input of this._midiAccess.inputs.values()) {
        input.onmidimessage = null;
      }
    }
    this._listeners.clear();
    this._devices.clear();
    this._assignments = [];
  }
}
