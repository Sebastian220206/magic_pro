import {
  applyGrooveToNotes,
  DEFAULT_GROOVE_TEMPLATES,
  GrooveTemplate,
} from '@/engine/midi/grooveQuantize';
import type { MidiNote } from '@/engine/midi/types';

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

describe('Groove Quantize Templates', () => {
  test('exposes 7 Logic-Pro-style presets', () => {
    const names = DEFAULT_GROOVE_TEMPLATES.map((t) => t.name);
    expect(names).toEqual([
      'Shuffle (16th)',
      'Swing (8th)',
      'Hard Swing',
      'Funk',
      'Half-Time Shuffle',
      'Push',
      'Dragged',
    ]);
  });

  test('each preset declares a matching offsets/division shape', () => {
    for (const t of DEFAULT_GROOVE_TEMPLATES) {
      expect(t.offsets.length).toBeGreaterThan(0);
      expect(t.division).toBeGreaterThan(0);
      // 16th division -> 16 slots, 8th division -> 8 slots
      const expectedSlots = t.division === 16 ? 16 : 8;
      expect(t.offsets.length).toBe(expectedSlots);
    }
  });

  test('swing presets delay offbeat slots only', () => {
    const swing = DEFAULT_GROOVE_TEMPLATES.find((t) => t.name === 'Swing (8th)')!;
    expect(swing.offsets[0]).toBe(0); // on-beat untouched
    expect(swing.offsets[1]).toBeGreaterThan(0); // offbeat pushed late
  });
});

describe('applyGrooveToNotes', () => {
  const shuffle = DEFAULT_GROOVE_TEMPLATES.find((t) => t.name === 'Shuffle (16th)')!;

  test('full-strength shuffle shifts 16th-note offbeats late', () => {
    const note = createNote({ startBeat: 0.75 }); // 4th 16th slot (offsetIndex 3 -> 0.15)
    const result = applyGrooveToNotes([note], shuffle, 1, 16);
    // noteSize = 4/16 = 0.25; offset = 0.15 * 1 * 0.25 = 0.0375
    expect(result[0].startBeat).toBeCloseTo(0.7875, 5);
  });

  test('on-beat notes are not shifted', () => {
    const note = createNote({ startBeat: 0.5 }); // offsetIndex 2 -> offset 0
    const result = applyGrooveToNotes([note], shuffle, 1, 16);
    expect(result[0].startBeat).toBeCloseTo(0.5, 5);
  });

  test('strength scales the offset proportionally', () => {
    const note = createNote({ startBeat: 0.75 });
    const half = applyGrooveToNotes([note], shuffle, 0.5, 16)[0];
    const full = applyGrooveToNotes([note], shuffle, 1, 16)[0];
    expect(half.startBeat).toBeCloseTo(0.75 + 0.0375 * 0.5, 5);
    expect(full.startBeat).toBeCloseTo(0.75 + 0.0375, 5);
  });

  test('zero strength leaves notes untouched', () => {
    const note = createNote({ startBeat: 0.75 });
    const result = applyGrooveToNotes([note], shuffle, 0, 16);
    expect(result[0].startBeat).toBeCloseTo(0.75, 5);
  });

  test('strength is clamped to [0,1]', () => {
    const note = createNote({ startBeat: 0.75 });
    const over = applyGrooveToNotes([note], shuffle, 2, 16)[0];
    const under = applyGrooveToNotes([note], shuffle, -1, 16)[0];
    expect(over.startBeat).toBeCloseTo(0.7875, 5); // same as strength=1
    expect(under.startBeat).toBeCloseTo(0.75, 5); // same as strength=0
  });

  test('negative offsets never push notes before beat 0', () => {
    const push = DEFAULT_GROOVE_TEMPLATES.find((t) => t.name === 'Push')!;
    const note = createNote({ startBeat: 0 });
    const result = applyGrooveToNotes([note], push, 1, 8);
    expect(result[0].startBeat).toBe(0);
  });

  test('velocity offsets are applied when present and clamped to 1-127', () => {
    const withVel: GrooveTemplate = {
      name: 'Test Vel',
      description: 't',
      offsets: [0, 0, 0, 0, 0, 0, 0, 0],
      division: 8,
      velocityOffsets: [0, 0.5, 0, 0.5, 0, 0.5, 0, 0.5],
    };
    const low = createNote({ startBeat: 0.25, velocity: 1 }); // velocityOffsets[1]=0.5 -> +10
    const hi = createNote({ startBeat: 1.25, velocity: 127 }); // +10 would exceed 127 -> clamp
    const result = applyGrooveToNotes([low, hi], withVel, 1, 8);
    expect(result[0].velocity).toBe(11);
    expect(result[1].velocity).toBe(127);
  });

  test('results are sorted by startBeat then pitch', () => {
    const notes = [
      createNote({ id: 'b', startBeat: 2 }),
      createNote({ id: 'a', startBeat: 1 }),
      createNote({ id: 'c', startBeat: 1, pitch: 50 }),
    ];
    const result = applyGrooveToNotes(notes, shuffle, 0, 16);
    expect(result.map((n) => n.id)).toEqual(['c', 'a', 'b']);
  });

  test('returns new note objects without mutating input', () => {
    const note = createNote({ startBeat: 0.75 });
    const originalStart = note.startBeat;
    const result = applyGrooveToNotes([note], shuffle, 1, 16);
    expect(result[0]).not.toBe(note);
    expect(note.startBeat).toBe(originalStart);
  });
});
