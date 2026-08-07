import {
  chaseClip,
  buildChaseMessages,
  emptySnapshot,
  ControllerSnapshot,
} from '@/engine/midi/midiChase';
import type { MidiRegion, MidiNote } from '@/engine/midi/types';

function createClip(notes: MidiNote[] = []): MidiRegion {
  return {
    id: 'clip-1',
    trackId: 'track-1',
    startBeat: 0,
    durationBeats: 8,
    chunks: [],
    notes,
    timeSignatures: [],
  };
}

function createNote(overrides: Partial<MidiNote> = {}): MidiNote {
  return {
    id: 'note-1',
    pitch: 60,
    velocity: 100,
    startBeat: 0,
    duration: 1,
    channel: 0,
    muted: false,
    ...overrides,
  };
}

describe('emptySnapshot', () => {
  test('returns neutral controller values', () => {
    const s = emptySnapshot();
    expect(s.pitchBend).toBe(8192); // center
    expect(s.program).toBe(0);
    expect(s.channelPressure).toBe(0);
    expect(s.polyPressure).toEqual({});
    expect(s.controllers).toEqual({});
  });
});

describe('chaseClip', () => {
  test('returns empty snapshot for clip without notes or CC data', () => {
    const result = chaseClip(createClip(), 4);
    expect(result).toEqual(emptySnapshot());
  });

  test('collects note-attached CC values into the snapshot', () => {
    const notes = [
      createNote({ id: 'n1', startBeat: 0 }),
      createNote({ id: 'n2', startBeat: 2 }),
    ];
    const clip = createClip(notes);
    const noteCCValues = {
      n1: { 64: 127, 7: 100 },
      n2: { 64: 0 },
    };
    const result = chaseClip(clip, 4, noteCCValues);
    expect(result.controllers[64]).toBe(0); // last value before startBeat wins
    expect(result.controllers[7]).toBe(100);
  });

  test('does not apply events after startBeat', () => {
    const notes = [createNote({ id: 'n1', startBeat: 5 })];
    const clip = createClip(notes);
    const result = chaseClip(clip, 4, { n1: { 64: 127 } });
    expect(result.controllers[64]).toBeUndefined();
  });

  test('applies events exactly at startBeat', () => {
    const notes = [createNote({ id: 'n1', startBeat: 4 })];
    const clip = createClip(notes);
    const result = chaseClip(clip, 4, { n1: { 64: 127 } });
    expect(result.controllers[64]).toBe(127);
  });

  test('later events override earlier ones for the same controller', () => {
    const notes = [
      createNote({ id: 'n1', startBeat: 0 }),
      createNote({ id: 'n2', startBeat: 1 }),
    ];
    const clip = createClip(notes);
    const result = chaseClip(clip, 2, {
      n1: { 64: 10 },
      n2: { 64: 90 },
    });
    expect(result.controllers[64]).toBe(90);
  });

  test('handles empty noteCCValues map', () => {
    const notes = [createNote({ id: 'n1', startBeat: 0 })];
    const result = chaseClip(createClip(notes), 4);
    expect(result.controllers).toEqual({});
  });
});

describe('buildChaseMessages', () => {
  test('always sends program change and center pitch bend on channel 0', () => {
    const snapshot = emptySnapshot();
    const messages = buildChaseMessages(snapshot, 0);
    // Program change: C0 nn
    expect(Array.from(messages[0])).toEqual([0xc0, 0]);
    // Pitch bend center: E0 00 40 (LSB, MSB of 8192)
    expect(Array.from(messages[1])).toEqual([0xe0, 0x00, 0x40]);
  });

  test('omits channel pressure message when pressure is 0', () => {
    const messages = buildChaseMessages(emptySnapshot(), 0);
    expect(messages.some((m) => (m[0] & 0xf0) === 0xd0)).toBe(false);
  });

  test('includes channel pressure message when > 0', () => {
    const snapshot: ControllerSnapshot = { ...emptySnapshot(), channelPressure: 65 };
    const messages = buildChaseMessages(snapshot, 0);
    expect(messages.some((m) => (m[0] & 0xf0) === 0xd0 && m[1] === 65)).toBe(true);
  });

  test('emits CC messages for each tracked controller', () => {
    const snapshot: ControllerSnapshot = {
      ...emptySnapshot(),
      controllers: { 64: 127, 7: 42 },
    };
    const messages = buildChaseMessages(snapshot, 0);
    const ccMessages = messages.filter((m) => (m[0] & 0xf0) === 0xb0);
    expect(ccMessages).toHaveLength(2);
    // Integer-like object keys iterate in ascending numeric order (7 before 64)
    expect(Array.from(ccMessages[0])).toEqual([0xb0, 7, 42]);
    expect(Array.from(ccMessages[1])).toEqual([0xb0, 64, 127]);
  });

  test('respects the MIDI channel in status bytes', () => {
    const snapshot: ControllerSnapshot = {
      ...emptySnapshot(),
      controllers: { 64: 1 },
      program: 5,
    };
    const messages = buildChaseMessages(snapshot, 3);
    expect(messages[0][0]).toBe(0xc3); // program change ch3
    expect(messages[1][0]).toBe(0xe3); // pitch bend ch3
    const cc = messages.find((m) => (m[0] & 0xf0) === 0xb0)!;
    expect(cc[0]).toBe(0xb3); // CC ch3
  });

  test('encodes pitch bend as 14-bit value', () => {
    const snapshot: ControllerSnapshot = { ...emptySnapshot(), pitchBend: 16383 };
    const messages = buildChaseMessages(snapshot, 0);
    const pb = messages[1];
    expect(pb[1]).toBe(0x7f); // LSB
    expect(pb[2]).toBe(0x7f); // MSB
  });

  test('returns Uint8Array instances suitable for MIDIOutput.send', () => {
    const messages = buildChaseMessages(emptySnapshot(), 0);
    for (const m of messages) {
      expect(m).toBeInstanceOf(Uint8Array);
    }
  });
});
