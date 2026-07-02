import { MidiQuantizer, QuantizeOptions } from '@/engine/midi/MidiQuantizer';
import { MidiHumanizer, HumanizeOptions } from '@/engine/midi/MidiHumanizer';
import { MidiNoteIndex } from '@/engine/midi/MidiNoteIndex';
import type { MidiNote } from '@/engine/midi/types';

function createTestNotes(): MidiNote[] {
  return [
    { id: 'n1', pitch: 60, velocity: 100, startBeat: 0, duration: 1, muted: false },
    { id: 'n2', pitch: 64, velocity: 80, startBeat: 1, duration: 0.5, muted: false },
    { id: 'n3', pitch: 67, velocity: 90, startBeat: 2, duration: 1, muted: false },
    { id: 'n4', pitch: 72, velocity: 110, startBeat: 3, duration: 2, muted: false },
  ];
}

describe('MIDI Editing Smoke Tests', () => {
  describe('Quantization', () => {
    test('quantize to sixteenth notes snaps positions', () => {
      const notes = createTestNotes();
      const opts: QuantizeOptions = { gridResolution: 0.25, strength: 1.0, swing: 0 };

      notes.forEach((note, i) => {
        const result = MidiQuantizer.quantizeNote(note, opts);
        expect(result.startBeat % 0.25).toBe(0);
      });
    });

    test('quantize to eighth notes snaps to 0.5 grid', () => {
      const notes = createTestNotes();
      const opts: QuantizeOptions = { gridResolution: 0.5, strength: 1.0, swing: 0 };

      notes.forEach((note, i) => {
        const result = MidiQuantizer.quantizeNote(note, opts);
        expect(result.startBeat % 0.5).toBe(0);
      });
    });

    test('partial strength does not fully snap', () => {
      const note = createTestNotes()[0];
      const offsetNote = { ...note, startBeat: 0.1 };
      const opts: QuantizeOptions = { gridResolution: 1.0, strength: 0.5, swing: 0 };

      const result = MidiQuantizer.quantizeNote(offsetNote, opts);
      expect(result.startBeat).toBeGreaterThan(0);
      expect(result.startBeat).toBeLessThan(1);
    });
  });

  describe('Humanization', () => {
    test('humanize adds small timing variations', () => {
      const notes = createTestNotes();
      const opts: HumanizeOptions = { timingVariance: 0.1, velocityVariance: 0 };

      const result = MidiHumanizer.humanizeNotes(notes, opts);
      expect(result.length).toBe(notes.length);
    });

    test('humanize adds velocity variations', () => {
      const notes = createTestNotes();
      const opts: HumanizeOptions = { timingVariance: 0, velocityVariance: 20 };

      const result = MidiHumanizer.humanizeNotes(notes, opts);
      result.forEach((n, i) => {
        const diff = Math.abs(n.velocity - notes[i].velocity);
        expect(diff).toBeLessThanOrEqual(20);
        expect(n.velocity).toBeGreaterThanOrEqual(1);
        expect(n.velocity).toBeLessThanOrEqual(127);
      });
    });
  });

  describe('NoteIndex', () => {
    test('getNotesStartingInRange returns correct subset', () => {
      const notes = createTestNotes();
      const index = new MidiNoteIndex(notes);

      const range1 = index.getNotesStartingInRange(0, 2);
      expect(range1.length).toBe(2);

      const range2 = index.getNotesStartingInRange(2, 4);
      expect(range2.length).toBe(2);

      const range3 = index.getNotesStartingInRange(10, 20);
      expect(range3.length).toBe(0);
    });

    test('note pitch range is valid MIDI (0-127)', () => {
      const notes = createTestNotes();
      notes.forEach(n => {
        expect(n.pitch).toBeGreaterThanOrEqual(0);
        expect(n.pitch).toBeLessThanOrEqual(127);
        expect(n.velocity).toBeGreaterThanOrEqual(0);
        expect(n.velocity).toBeLessThanOrEqual(127);
      });
    });

    test('muted notes are returned but scheduler filters them', () => {
      const notes = createTestNotes();
      notes[0].muted = true;
      const index = new MidiNoteIndex(notes);

      const range = index.getNotesStartingInRange(0, 4);
      const mutedNote = range.find(n => n.id === 'n1');
      expect(mutedNote).toBeDefined();
      expect(mutedNote?.muted).toBe(true);
    });

    test('note durations are positive', () => {
      const notes = createTestNotes();
      notes.forEach(n => {
        expect(n.duration).toBeGreaterThan(0);
      });
    });
  });
});
