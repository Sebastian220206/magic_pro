import { MidiRecorder } from '@/engine/midi/MidiRecorder';

interface RecordedNote {
  pitch: number;
  startBeat: number;
  duration: number;
  velocity: number;
}

/**
 * Drive the recorder's private message handler directly with raw MIDI bytes,
 * avoiding the Web MIDI API requirement (navigator.requestMIDIAccess).
 */
function send(recorder: MidiRecorder, ...bytes: number[]): void {
  const event = { data: new Uint8Array(bytes) } as MIDIMessageEvent;
  (recorder as unknown as { handleMessage: (e: MIDIMessageEvent) => void }).handleMessage(event);
}

function makeRecorder(overrides: {
  clipLength?: number;
  onNoteRecorded?: (n: RecordedNote) => void;
  onSustainPedal?: (active: boolean, beat: number) => void;
  getCurrentBeat?: () => number;
} = {}): { recorder: MidiRecorder; recorded: RecordedNote[]; sustainEvents: { active: boolean; beat: number }[] } {
  const recorded: RecordedNote[] = [];
  const sustainEvents: { active: boolean; beat: number }[] = [];
  let beat = 0;
  const recorder = new MidiRecorder(
    overrides.onNoteRecorded ?? ((n) => recorded.push(n)),
    overrides.getCurrentBeat ?? (() => beat),
    overrides.onSustainPedal ?? ((active, b) => sustainEvents.push({ active, beat: b })),
  );
  // Bypass start(): skip the navigator.requestMIDIAccess dependency and enable processing
  const rec = recorder as unknown as {
    isRunning: boolean;
    clipLength: number;
    getCurrentBeat: () => number;
  };
  rec.isRunning = true;
  rec.clipLength = overrides.clipLength ?? 8;
  return { recorder, recorded, sustainEvents };
}

describe('MidiRecorder sustain pedal (CC64)', () => {
  test('CC64 >= 64 activates sustain and notifies the callback', () => {
    const { recorder, sustainEvents } = makeRecorder();
    send(recorder, 0xb0, 64, 127);
    expect(sustainEvents).toEqual([{ active: true, beat: 0 }]);
  });

  test('CC64 < 64 releases sustain and notifies the callback', () => {
    const { recorder, sustainEvents } = makeRecorder();
    send(recorder, 0xb0, 64, 127);
    send(recorder, 0xb0, 64, 0);
    expect(sustainEvents).toEqual([
      { active: true, beat: 0 },
      { active: false, beat: 0 },
    ]);
  });

  test('note-off while sustain active extends short durations to at least 1 beat', () => {
    const { recorder, recorded } = makeRecorder();
    send(recorder, 0xb0, 64, 127); // pedal down at beat 0
    send(recorder, 0x90, 60, 100); // note on at beat 0
    // advance current beat to 0.4 (short note)
    const rec = recorder as unknown as { getCurrentBeat: () => number };
    const orig = rec.getCurrentBeat;
    let beat = 0.4;
    rec.getCurrentBeat = () => beat;
    void orig;
    send(recorder, 0x80, 60, 0); // note off
    expect(recorded).toHaveLength(1);
    expect(recorded[0].pitch).toBe(60);
    expect(recorded[0].duration).toBeGreaterThanOrEqual(1);
  });

  test('note-off without sustain keeps exact short duration (min 0.125)', () => {
    const { recorder, recorded } = makeRecorder();
    send(recorder, 0x90, 60, 100); // note on at beat 0
    const rec = recorder as unknown as { getCurrentBeat: () => number };
    let beat = 0.4;
    rec.getCurrentBeat = () => beat;
    send(recorder, 0x80, 60, 0); // note off
    expect(recorded).toHaveLength(1);
    expect(recorded[0].duration).toBeCloseTo(0.4, 5);
  });

  test('long notes are not extended beyond their natural duration by sustain', () => {
    const { recorder, recorded } = makeRecorder();
    send(recorder, 0xb0, 64, 127); // pedal down
    send(recorder, 0x90, 64, 90); // note on at beat 0
    const rec = recorder as unknown as { getCurrentBeat: () => number };
    let beat = 3;
    rec.getCurrentBeat = () => beat;
    send(recorder, 0x80, 64, 0); // note off at beat 3
    expect(recorded[0].duration).toBeCloseTo(3, 5); // already > 1, unchanged
  });

  test('sustain callback is optional (recorder works without it)', () => {
    const recorded: RecordedNote[] = [];
    const recorder = new MidiRecorder((n) => recorded.push(n), () => 0);
    (recorder as unknown as { isRunning: boolean; clipLength: number }).isRunning = true;
    (recorder as unknown as { clipLength: number }).clipLength = 8;
    send(recorder, 0xb0, 64, 127); // should not throw without onSustainPedal
    send(recorder, 0x90, 60, 100);
    const rec = recorder as unknown as { getCurrentBeat: () => number };
    let beat = 1;
    rec.getCurrentBeat = () => beat;
    send(recorder, 0x80, 60, 0);
    expect(recorded).toHaveLength(1);
  });

  test('sustain does not extend notes when released before note-off', () => {
    const { recorder, recorded } = makeRecorder();
    send(recorder, 0xb0, 64, 127); // pedal down
    send(recorder, 0x90, 62, 80); // note on at beat 0
    send(recorder, 0xb0, 64, 0); // pedal up before note off
    const rec = recorder as unknown as { getCurrentBeat: () => number };
    let beat = 0.4;
    rec.getCurrentBeat = () => beat;
    send(recorder, 0x80, 62, 0);
    expect(recorded[0].duration).toBeCloseTo(0.4, 5);
  });
});

describe('MidiRecorder note capture', () => {
  test('records note-on/note-off as a clip note with velocity', () => {
    const { recorder, recorded } = makeRecorder();
    send(recorder, 0x90, 72, 110); // note on
    const rec = recorder as unknown as { getCurrentBeat: () => number };
    let beat = 1;
    rec.getCurrentBeat = () => beat;
    send(recorder, 0x80, 72, 0); // note off
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ pitch: 72, startBeat: 0, velocity: 110 });
  });

  test('note-on with velocity 0 is treated as note-off', () => {
    const { recorder, recorded } = makeRecorder();
    send(recorder, 0x90, 60, 0); // should act like note-off (no active note)
    expect(recorded).toHaveLength(0);
  });

  test('notes started beyond clip length are dropped', () => {
    const { recorder, recorded } = makeRecorder({ clipLength: 4 });
    const rec = recorder as unknown as { getCurrentBeat: () => number };
    let beat = 5;
    rec.getCurrentBeat = () => beat;
    send(recorder, 0x90, 60, 100); // starts at beat 5, past clip end
    beat = 6;
    send(recorder, 0x80, 60, 0);
    expect(recorded).toHaveLength(0);
  });

  test('note duration is clamped to clip length', () => {
    const { recorder, recorded } = makeRecorder({ clipLength: 4 });
    send(recorder, 0x90, 60, 100); // at beat 0
    const rec = recorder as unknown as { getCurrentBeat: () => number };
    let beat = 10;
    rec.getCurrentBeat = () => beat;
    send(recorder, 0x80, 60, 0);
    expect(recorded[0].duration).toBe(4);
  });
});
