/**
 * MIDI Transform Tools - Note manipulation utilities
 * 
 * Features:
 * - Transpose notes
 * - Humanize timing and velocity
 * - Scale velocity
 * - Randomize velocity
 * - Invert/retrograde
 * - Legato/staccato
 */

import { MidiNote, HumanizeOptions, clampPitch, clampVelocity, createNote } from './types';
export type { HumanizeOptions } from './types';

// =============================================================================
// Transpose
// =============================================================================

/**
 * Transpose notes by semitones
 * @param notes Notes to transpose
 * @param semitones Positive or negative number of semitones
 */
export function transposeNotes(notes: MidiNote[], semitones: number): MidiNote[] {
  return notes.map(note => ({
    ...note,
    pitch: clampPitch(note.pitch + semitones),
  }));
}

/**
 * Transpose notes up one octave
 */
export function transposeUpOctave(notes: MidiNote[]): MidiNote[] {
  return transposeNotes(notes, 12);
}

/**
 * Transpose notes down one octave
 */
export function transposeDownOctave(notes: MidiNote[]): MidiNote[] {
  return transposeNotes(notes, -12);
}

/**
 * Transpose selected notes up one semitone
 */
export function transposeUpSemitone(notes: MidiNote[]): MidiNote[] {
  return transposeNotes(notes, 1);
}

/**
 * Transpose selected notes down one semitone
 */
export function transposeDownSemitone(notes: MidiNote[]): MidiNote[] {
  return transposeNotes(notes, -1);
}

/**
 * Invert notes (mirror around center pitch)
 */
export function invertNotes(notes: MidiNote[], centerPitch?: number): MidiNote[] {
  if (notes.length === 0) return notes;
  
  // Use middle of pitch range if no center specified
  const center = centerPitch ?? Math.round(
    (Math.min(...notes.map(n => n.pitch)) + Math.max(...notes.map(n => n.pitch))) / 2
  );
  
  return notes.map(note => ({
    ...note,
    pitch: clampPitch(center + (center - note.pitch)),
  }));
}

/**
 * Reverse note order (retrograde)
 */
export function reverseNotes(notes: MidiNote[]): MidiNote[] {
  if (notes.length === 0) return notes;
  
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat);
  const totalDuration = sorted[sorted.length - 1].startBeat + sorted[sorted.length - 1].duration - sorted[0].startBeat;
  
  return sorted.map((note, index) => {
    const originalIndex = sorted.length - 1 - index;
    const originalNote = sorted[originalIndex];
    
    // Calculate new start position
    const newStart = sorted[0].startBeat + totalDuration - 
      (originalNote.startBeat + originalNote.duration - sorted[0].startBeat);
    
    return {
      ...note,
      startBeat: newStart,
    };
  });
}

// =============================================================================
// Humanize
// =============================================================================

/**
 * Add random variation to note timing and velocity
 */
export function humanizeNotes(
  notes: MidiNote[],
  options: HumanizeOptions
): MidiNote[] {
  const { timingVariance, velocityVariance } = options;
  
  return notes.map(note => {
    // Random timing offset (-timingVariance to +timingVariance)
    const timeOffset = (Math.random() * 2 - 1) * timingVariance;
    
    // Random velocity offset (-velocityVariance to +velocityVariance)
    const velocityOffset = (Math.random() * 2 - 1) * velocityVariance;
    
    return {
      ...note,
      startBeat: Math.max(0, note.startBeat + timeOffset),
      velocity: clampVelocity(note.velocity + velocityOffset),
    };
  });
}

/**
 * Add subtle humanization (good for realistic playback)
 */
export function humanizeSubtle(notes: MidiNote[]): MidiNote[] {
  return humanizeNotes(notes, {
    timingVariance: 0.02,   // +/- 1/50th of a beat
    velocityVariance: 10,   // +/- 10 velocity
  });
}

/**
 * Add heavy humanization (good for groove)
 */
export function humanizeHeavy(notes: MidiNote[]): MidiNote[] {
  return humanizeNotes(notes, {
    timingVariance: 0.05,   // +/- 1/20th of a beat
    velocityVariance: 20,   // +/- 20 velocity
  });
}

// =============================================================================
// Velocity
// =============================================================================

/**
 * Scale velocity by a factor
 * @param factor Multiplier (0.5 = half, 2.0 = double)
 */
export function scaleVelocity(notes: MidiNote[], factor: number): MidiNote[] {
  return notes.map(note => ({
    ...note,
    velocity: clampVelocity(note.velocity * factor),
  }));
}

/**
 * Increase velocity by fixed amount
 */
export function increaseVelocity(notes: MidiNote[], amount: number): MidiNote[] {
  return notes.map(note => ({
    ...note,
    velocity: clampVelocity(note.velocity + amount),
  }));
}

/**
 * Decrease velocity by fixed amount
 */
export function decreaseVelocity(notes: MidiNote[], amount: number): MidiNote[] {
  return increaseVelocity(notes, -amount);
}

/**
 * Randomize velocity within range
 */
export function randomizeVelocity(
  notes: MidiNote[],
  min: number = 80,
  max: number = 127
): MidiNote[] {
  return notes.map(note => ({
    ...note,
    velocity: clampVelocity(Math.floor(Math.random() * (max - min + 1)) + min),
  }));
}

/**
 * Compress velocity range
 * Brings velocities closer to average
 */
export function compressVelocity(notes: MidiNote[], amount: number = 0.5): MidiNote[] {
  if (notes.length === 0) return notes;
  
  const avgVelocity = notes.reduce((sum, n) => sum + n.velocity, 0) / notes.length;
  
  return notes.map(note => ({
    ...note,
    velocity: clampVelocity(
      note.velocity + (avgVelocity - note.velocity) * amount
    ),
  }));
}

/**
 * Expand velocity range
 * Pushes velocities away from average
 */
export function expandVelocity(notes: MidiNote[], amount: number = 0.5): MidiNote[] {
  if (notes.length === 0) return notes;
  
  const avgVelocity = notes.reduce((sum, n) => sum + n.velocity, 0) / notes.length;
  
  return notes.map(note => {
    const diff = note.velocity - avgVelocity;
    return {
      ...note,
      velocity: clampVelocity(avgVelocity + diff * (1 + amount)),
    };
  });
}

/**
 * Limit velocity to range
 */
export function limitVelocity(
  notes: MidiNote[],
  min: number,
  max: number
): MidiNote[] {
  return notes.map(note => ({
    ...note,
    velocity: Math.max(min, Math.min(max, note.velocity)),
  }));
}

/**
 * Set fixed velocity
 */
export function setFixedVelocity(notes: MidiNote[], velocity: number): MidiNote[] {
  return notes.map(note => ({
    ...note,
    velocity: clampVelocity(velocity),
  }));
}

// =============================================================================
// Duration
// =============================================================================

/**
 * Scale note durations
 * @param factor Multiplier (0.5 = half length, 2.0 = double length)
 */
export function scaleDuration(notes: MidiNote[], factor: number): MidiNote[] {
  return notes.map(note => ({
    ...note,
    duration: Math.max(0.01, note.duration * factor),
  }));
}

/**
 * Make notes legato (connect overlapping notes)
 */
export function makeLegato(notes: MidiNote[], gap: number = 0): MidiNote[] {
  if (notes.length < 2) return notes;
  
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat);
  
  return sorted.map((note, index) => {
    if (index === sorted.length - 1) return note;
    
    const nextNote = sorted[index + 1];
    const newDuration = nextNote.startBeat - note.startBeat - gap;
    
    return {
      ...note,
      duration: Math.max(0.01, newDuration),
    };
  });
}

/**
 * Make notes staccato (shorten durations)
 * @param ratio 0.5 = half duration, 0.25 = quarter duration
 */
export function makeStaccato(notes: MidiNote[], ratio: number = 0.5): MidiNote[] {
  return notes.map(note => ({
    ...note,
    duration: note.duration * ratio,
  }));
}

/**
 * Double note durations (make half-time)
 */
export function doubleTime(notes: MidiNote[]): MidiNote[] {
  return notes.map(note => ({
    ...note,
    startBeat: note.startBeat * 2,
    duration: note.duration * 2,
  }));
}

/**
 * Half note durations (make double-time)
 */
export function halfTime(notes: MidiNote[]): MidiNote[] {
  return notes.map(note => ({
    ...note,
    startBeat: note.startBeat / 2,
    duration: note.duration / 2,
  }));
}

// =============================================================================
// Time Shifting
// =============================================================================

/**
 * Shift notes in time
 * @param beats Positive = forward, negative = backward
 */
export function shiftNotes(notes: MidiNote[], beats: number): MidiNote[] {
  return notes.map(note => ({
    ...note,
    startBeat: Math.max(0, note.startBeat + beats),
  }));
}

/**
 * Nudge notes forward slightly
 */
export function nudgeForward(notes: MidiNote[], amount: number = 0.01): MidiNote[] {
  return shiftNotes(notes, amount);
}

/**
 * Nudge notes backward slightly
 */
export function nudgeBackward(notes: MidiNote[], amount: number = 0.01): MidiNote[] {
  return shiftNotes(notes, -amount);
}

// =============================================================================
// Selection
// =============================================================================

/**
 * Select notes within pitch range
 */
export function selectNotesInPitchRange(
  notes: MidiNote[],
  minPitch: number,
  maxPitch: number
): MidiNote[] {
  return notes.map(note => ({
    ...note,
    selected: note.pitch >= minPitch && note.pitch <= maxPitch,
  }));
}

/**
 * Select notes within time range
 */
export function selectNotesInTimeRange(
  notes: MidiNote[],
  startBeat: number,
  endBeat: number
): MidiNote[] {
  return notes.map(note => ({
    ...note,
    selected: note.startBeat >= startBeat && note.startBeat < endBeat,
  }));
}

/**
 * Select every Nth note
 */
export function selectEveryNth(notes: MidiNote[], n: number, offset: number = 0): MidiNote[] {
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat);
  
  return sorted.map((note, index) => ({
    ...note,
    selected: (index + offset) % n === 0,
  }));
}

/**
 * Invert selection
 */
export function invertSelection(notes: MidiNote[]): MidiNote[] {
  return notes.map(note => ({
    ...note,
    selected: !note.selected,
  }));
}

// =============================================================================
// Pattern Tools
// =============================================================================

/**
 * Duplicate pattern (repeat notes)
 */
export function duplicatePattern(
  notes: MidiNote[],
  repetitions: number,
  patternLength: number
): MidiNote[] {
  const result: MidiNote[] = [];
  
  for (let i = 0; i < repetitions; i++) {
    const offset = i * patternLength;
    
    for (const note of notes) {
      result.push(createNote(
        note.pitch,
        note.startBeat + offset,
        note.duration,
        note.velocity,
        note.channel
      ));
    }
  }
  
  return result;
}

/**
 * Create chord from single note
 */
export function createChord(
  note: MidiNote,
  intervals: number[], // Semitone intervals from root
  velocities?: number[] // Optional different velocities per note
): MidiNote[] {
  return intervals.map((interval, index) => createNote(
    clampPitch(note.pitch + interval),
    note.startBeat,
    note.duration,
    velocities?.[index] ?? note.velocity,
    note.channel
  ));
}

// Common chord types
export const CHORD_TYPES: Record<string, number[]> = {
  'major': [0, 4, 7],
  'minor': [0, 3, 7],
  'diminished': [0, 3, 6],
  'augmented': [0, 4, 8],
  'major7': [0, 4, 7, 11],
  'minor7': [0, 3, 7, 10],
  'dominant7': [0, 4, 7, 10],
  'sus4': [0, 5, 7],
  'add9': [0, 4, 7, 14],
};

/**
 * Strum chord (add slight timing offset to each note)
 */
export function strumChord(
  notes: MidiNote[],
  direction: 'up' | 'down' = 'down',
  delay: number = 0.02
): MidiNote[] {
  const sorted = [...notes].sort((a, b) => 
    direction === 'down' ? b.pitch - a.pitch : a.pitch - b.pitch
  );
  
  return sorted.map((note, index) => ({
    ...note,
    startBeat: note.startBeat + index * delay,
  }));
}

// =============================================================================
// Export/Import Utilities
// =============================================================================

/**
 * Convert notes to simplified format (for export)
 */
export function serializeNotes(notes: MidiNote[]): string {
  return JSON.stringify(notes.map(n => ({
    p: n.pitch,
    v: n.velocity,
    s: n.startBeat,
    d: n.duration,
    c: n.channel ?? 0,
  })));
}

/**
 * Parse simplified note format
 */
export function deserializeNotes(data: string): MidiNote[] {
  const parsed = JSON.parse(data);
  return parsed.map((n: any, index: number) => ({
    id: `imported-${index}`,
    pitch: n.p,
    velocity: n.v,
    startBeat: n.s,
    duration: n.d,
    channel: n.c ?? 0,
    selected: false,
  }));
}
