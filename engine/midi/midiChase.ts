/**
 * MIDI Chase - Sends controller values on playback start
 *
 * When playback starts at a given beat, MIDI Chase scans the clip's
 * prior events to determine the last known state of each controller,
 * then sends those values to the MIDI output so the synth/device
 * is synchronized with the current playback position.
 */

import type { MidiRegion } from './types';

export interface ControllerSnapshot {
  pitchBend: number;
  program: number;
  channelPressure: number;
  polyPressure: Record<number, number>;
  controllers: Record<number, number>;
}

export function emptySnapshot(): ControllerSnapshot {
  return {
    pitchBend: 8192, // center
    program: 0,
    channelPressure: 0,
    polyPressure: {},
    controllers: {},
  };
}

/**
 * Chase the clip events up to `startBeat` and produce a
 * ControllerSnapshot representing the last known controller
 * values before playback begins.
 */
export function chaseClip(
  clip: MidiRegion,
  startBeat: number,
  noteCCValues: Record<string, Record<number, number>> = {},
): ControllerSnapshot {
  const result = emptySnapshot();
  if (!clip.notes) return result;

  // Scan all events sorted by beat
  const events: { beat: number; type: string; data: { controller?: number; value: number } }[] = [];

  // Collect note-based CC values
  for (const note of clip.notes) {
    const ccs = noteCCValues[note.id];
    if (!ccs) continue;
    for (const [controller, value] of Object.entries(ccs)) {
      events.push({
        beat: note.startBeat,
        type: 'cc',
        data: { controller: Number(controller), value },
      });
    }
  }

  // Sort by beat ascending
  events.sort((a, b) => a.beat - b.beat);

  // Apply events up to startBeat
  for (const evt of events) {
    if (evt.beat > startBeat) break;
    const d = evt.data;
    if (evt.type === 'pitchbend') {
      result.pitchBend = d.value;
    } else if (evt.type === 'program') {
      result.program = d.value;
    } else if (evt.type === 'channeltouch') {
      result.channelPressure = d.value;
    } else if (d.controller !== undefined) {
      result.controllers[d.controller] = d.value;
    }
  }

  return result;
}

/**
 * Build the MIDI messages to send for a given snapshot.
 * Each message is a Uint8Array suitable for sending via MIDIOutput.send().
 */
export function buildChaseMessages(
  snapshot: ControllerSnapshot,
  channel: number = 0,
): Uint8Array[] {
  const messages: Uint8Array[] = [];
  const statusBase = 0xb0 | (channel & 0x0f);
  const pitchStatus = 0xe0 | (channel & 0x0f);

  // Program change
  messages.push(new Uint8Array([0xc0 | (channel & 0x0f), snapshot.program]));

  // Channel pressure
  if (snapshot.channelPressure > 0) {
    messages.push(new Uint8Array([0xd0 | (channel & 0x0f), snapshot.channelPressure]));
  }

  // Pitch bend
  const pb14 = snapshot.pitchBend & 0x3fff;
  messages.push(new Uint8Array([pitchStatus, pb14 & 0x7f, (pb14 >> 7) & 0x7f]));

  // CC values
  for (const [controller, value] of Object.entries(snapshot.controllers)) {
    messages.push(new Uint8Array([statusBase, Number(controller), value]));
  }

  return messages;
}
