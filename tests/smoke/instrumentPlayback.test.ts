import { MidiStateResolver } from '@/engine/midi/MidiStateResolver';
import { InstrumentRegistry } from '@/engine/midi/midiInstruments';
import { MidiNoteIndex } from '@/engine/midi/MidiNoteIndex';
import type { MidiNote } from '@/engine/midi/types';

function createTestNotes(): MidiNote[] {
  return [
    { id: 'n1', pitch: 60, velocity: 100, startBeat: 0, duration: 4, muted: false },
    { id: 'n2', pitch: 64, velocity: 80, startBeat: 1, duration: 2, muted: false },
    { id: 'n3', pitch: 67, velocity: 90, startBeat: 2, duration: 1, muted: false },
  ];
}

describe('Instrument Playback Smoke Tests', () => {
  describe('MidiStateResolver', () => {
    test('resolveActiveNotesAtBeat returns notes held at beat', () => {
      const notes = createTestNotes();
      const active = MidiStateResolver.resolveActiveNotesAtBeat(notes, 1.5);

      expect(active.length).toBe(2);
      expect(active.find(n => n.id === 'n1')).toBeDefined();
      expect(active.find(n => n.id === 'n2')).toBeDefined();
      expect(active.find(n => n.id === 'n3')).toBeUndefined();
    });

    test('resolveActiveNotesAtBeat excludes muted notes', () => {
      const notes = createTestNotes();
      notes[0].muted = true;

      const active = MidiStateResolver.resolveActiveNotesAtBeat(notes, 0.5);
      expect(active.find(n => n.id === 'n1')).toBeUndefined();
    });

    test('resolveActiveNotesAtBeat returns empty for no active notes', () => {
      const notes = createTestNotes();
      const active = MidiStateResolver.resolveActiveNotesAtBeat(notes, 100);
      expect(active.length).toBe(0);
    });

    test('resolveActiveNotesAtBeat handles note boundaries', () => {
      const notes = createTestNotes();
      const atStart = MidiStateResolver.resolveActiveNotesAtBeat(notes, 0);
      const atEnd = MidiStateResolver.resolveActiveNotesAtBeat(notes, 4);

      expect(atStart.find(n => n.id === 'n1')).toBeDefined();
      expect(atEnd.find(n => n.id === 'n1')).toBeUndefined();
    });
  });

  describe('MidiNoteIndex', () => {
    test('index returns notes for scheduling window', () => {
      const notes = createTestNotes();
      const index = new MidiNoteIndex(notes);

      const scheduled = index.getNotesStartingInRange(0, 2);
      expect(scheduled.length).toBe(2);
      expect(scheduled[0].id).toBe('n1');
      expect(scheduled[1].id).toBe('n2');
    });

    test('index handles empty note list', () => {
      const index = new MidiNoteIndex([]);
      const result = index.getNotesStartingInRange(0, 10);
      expect(result.length).toBe(0);
    });
  });

  describe('InstrumentRegistry', () => {
    test('registry can register and look up instruments', () => {
      const registry = new InstrumentRegistry();
      const mockInstrument = {
        id: 'test-synth',
        name: 'Test Synth',
        type: 'synth' as const,
        trigger: jest.fn(),
        release: jest.fn(),
        setParameter: jest.fn(),
      };

      registry.register(mockInstrument);
      expect(registry.get('test-synth')).toBe(mockInstrument);
      expect(registry.getAll().length).toBe(1);
    });

    test('registry returns undefined for unknown instrument', () => {
      const registry = new InstrumentRegistry();
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    test('registry unregister removes instrument', () => {
      const registry = new InstrumentRegistry();
      const inst = {
        id: 'synth', name: 'Synth', type: 'synth' as const,
        trigger: jest.fn(), release: jest.fn(), setParameter: jest.fn(),
      };
      registry.register(inst);
      registry.unregister('synth');
      expect(registry.getAll().length).toBe(0);
    });
  });
});
