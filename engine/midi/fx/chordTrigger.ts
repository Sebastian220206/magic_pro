/**
 * Chord Trigger - MIDI Chord Effect
 *
 * Features:
 * - Preset chord library (major, minor, dim, aug, 7th, etc.)
 * - Custom chord builder
 * - Inversion control
 * - Transpose
 * - Voicing options (close, spread, octave doubling)
 * - Trigger modes (single note, multi-trigger)
 *
 * Signal Flow:
 * Input Note → Chord Lookup → Voicing → Output Notes
 */

import { MidiNote, createNote } from '../types';

export type ChordType =
  | 'major' | 'minor' | 'diminished' | 'augmented'
  | 'major7' | 'minor7' | 'dominant7' | 'diminished7' | 'halfDiminished'
  | 'sus2' | 'sus4' | 'add9' | 'major9' | 'minor9'
  | 'power' | 'custom';

export type VoicingType = 'close' | 'spread' | 'octave-doubling' | 'drop2' | 'drop3';

export interface ChordDefinition {
  name: string;
  intervals: number[]; // Semitone intervals from root
}

export interface ChordTriggerConfig {
  chordType: ChordType;
  inversion: number;     // 0-3 (root, 1st, 2nd, 3rd inversion)
  transpose: number;     // Semitones (-12 to +12)
  voicing: VoicingType;
  octaveRange: number;   // 1-2
  velocityScale: number; // 0.5-1.5
  triggerMode: 'single' | 'multi'; // Single note triggers chord, or multiple notes
}

export interface ChordTriggerState {
  config: ChordTriggerConfig;
  heldNotes: Set<number>;
  activeChords: Map<number, number[]>; // rootNote → pitches
  customChord: number[]; // Custom chord intervals
}

export interface ChordTriggerOptions {
  chordType?: ChordType;
  inversion?: number;
  transpose?: number;
  voicing?: VoicingType;
  octaveRange?: number;
  velocityScale?: number;
  triggerMode?: 'single' | 'multi';
  customIntervals?: number[];
}

// =============================================================================
// Chord Library
// =============================================================================

export const CHORD_LIBRARY: Record<ChordType, ChordDefinition> = {
  major: { name: 'Major', intervals: [0, 4, 7] },
  minor: { name: 'Minor', intervals: [0, 3, 7] },
  diminished: { name: 'Diminished', intervals: [0, 3, 6] },
  augmented: { name: 'Augmented', intervals: [0, 4, 8] },
  major7: { name: 'Major 7th', intervals: [0, 4, 7, 11] },
  minor7: { name: 'Minor 7th', intervals: [0, 3, 7, 10] },
  dominant7: { name: 'Dominant 7th', intervals: [0, 4, 7, 10] },
  diminished7: { name: 'Diminished 7th', intervals: [0, 3, 6, 9] },
  halfDiminished: { name: 'Half-Diminished', intervals: [0, 3, 6, 10] },
  sus2: { name: 'Suspended 2nd', intervals: [0, 2, 7] },
  sus4: { name: 'Suspended 4th', intervals: [0, 5, 7] },
  add9: { name: 'Add 9', intervals: [0, 4, 7, 14] },
  major9: { name: 'Major 9th', intervals: [0, 4, 7, 11, 14] },
  minor9: { name: 'Minor 9th', intervals: [0, 3, 7, 10, 14] },
  power: { name: 'Power', intervals: [0, 7] },
  custom: { name: 'Custom', intervals: [0, 4, 7] },
};

const DEFAULT_CONFIG: ChordTriggerConfig = {
  chordType: 'major',
  inversion: 0,
  transpose: 0,
  voicing: 'close',
  octaveRange: 1,
  velocityScale: 1,
  triggerMode: 'single',
};

export class ChordTrigger {
  private state: ChordTriggerState;
  private listeners: Array<(event: ChordEvent) => void> = [];

  constructor(options: ChordTriggerOptions = {}) {
    this.state = {
      config: {
        ...DEFAULT_CONFIG,
        ...options,
      },
      heldNotes: new Set(),
      activeChords: new Map(),
      customChord: options.customIntervals ?? [0, 4, 7],
    };
  }

  // ===========================================================================
  // Note Input
  // ===========================================================================

  public noteOn(pitch: number, velocity: number = 100): ChordEvent[] {
    const events: ChordEvent[] = [];
    this.state.heldNotes.add(pitch);

    // Generate chord
    const chordPitches = this.generateChord(pitch);
    this.state.activeChords.set(pitch, chordPitches);

    // Emit note-on for each chord tone
    for (const chordPitch of chordPitches) {
      if (chordPitch >= 0 && chordPitch <= 127) {
        events.push({
          type: 'note-on',
          pitch: chordPitch,
          velocity: Math.round(velocity * this.state.config.velocityScale),
          rootPitch: pitch,
        });
      }
    }

    return events;
  }

  public noteOff(pitch: number): ChordEvent[] {
    const events: ChordEvent[] = [];
    this.state.heldNotes.delete(pitch);

    const chordPitches = this.state.activeChords.get(pitch);
    if (chordPitches) {
      for (const chordPitch of chordPitches) {
        events.push({
          type: 'note-off',
          pitch: chordPitch,
          velocity: 0,
          rootPitch: pitch,
        });
      }
      this.state.activeChords.delete(pitch);
    }

    return events;
  }

  public allNotesOff(): ChordEvent[] {
    const events: ChordEvent[] = [];

    for (const [root, pitches] of this.state.activeChords) {
      for (const pitch of pitches) {
        events.push({
          type: 'note-off',
          pitch,
          velocity: 0,
          rootPitch: root,
        });
      }
    }

    this.state.heldNotes.clear();
    this.state.activeChords.clear();

    return events;
  }

  // ===========================================================================
  // Chord Generation
  // ===========================================================================

  private generateChord(rootPitch: number): number[] {
    const { config, customChord } = this.state;
    const chordDef = config.chordType === 'custom'
      ? { name: 'Custom', intervals: customChord }
      : CHORD_LIBRARY[config.chordType];

    let intervals = [...chordDef.intervals];

    // Apply transpose
    const transposedRoot = rootPitch + config.transpose;

    // Apply inversion
    if (config.inversion > 0) {
      intervals = this.applyInversion(intervals, config.inversion);
    }

    // Apply voicing
    intervals = this.applyVoicing(intervals, config.voicing);

    // Generate pitches
    let pitches = intervals.map(interval => transposedRoot + interval);

    // Apply octave range
    if (config.octaveRange > 1) {
      pitches = this.applyOctaveRange(pitches, config.octaveRange);
    }

    // Clamp to MIDI range
    return pitches.filter(p => p >= 0 && p <= 127).sort((a, b) => a - b);
  }

  private applyInversion(intervals: number[], inversion: number): number[] {
    const result = [...intervals];
    for (let i = 0; i < inversion; i++) {
      if (result.length > 0) {
        const first = result.shift()!;
        result.push(first + 12);
      }
    }
    return result;
  }

  private applyVoicing(intervals: number[], voicing: VoicingType): number[] {
    switch (voicing) {
      case 'close':
        return intervals;
      case 'spread':
        return this.spreadVoicing(intervals);
      case 'octave-doubling':
        return this.octaveDoublingVoicing(intervals);
      case 'drop2':
        return this.drop2Voicing(intervals);
      case 'drop3':
        return this.drop3Voicing(intervals);
      default:
        return intervals;
    }
  }

  private spreadVoicing(intervals: number[]): number[] {
    const result = [...intervals];
    for (let i = 1; i < result.length; i += 2) {
      result[i] += 12;
    }
    return result.sort((a, b) => a - b);
  }

  private octaveDoublingVoicing(intervals: number[]): number[] {
    const result = [...intervals];
    if (result.length > 0) {
      result.push(result[0] + 12);
    }
    return result;
  }

  private drop2Voicing(intervals: number[]): number[] {
    if (intervals.length < 2) return intervals;
    const result = [...intervals];
    const second = result.splice(1, 1)[0];
    result.push(second - 12);
    return result.sort((a, b) => a - b);
  }

  private drop3Voicing(intervals: number[]): number[] {
    if (intervals.length < 3) return intervals;
    const result = [...intervals];
    const third = result.splice(2, 1)[0];
    result.push(third - 12);
    return result.sort((a, b) => a - b);
  }

  private applyOctaveRange(pitches: number[], octaveRange: number): number[] {
    const result = [...pitches];
    for (let oct = 1; oct < octaveRange; oct++) {
      for (const pitch of pitches) {
        result.push(pitch + oct * 12);
      }
    }
    return result;
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  public setChordType(chordType: ChordType): void {
    this.state.config.chordType = chordType;
  }

  public getChordType(): ChordType {
    return this.state.config.chordType;
  }

  public setCustomChord(intervals: number[]): void {
    this.state.customChord = intervals.sort((a, b) => a - b);
    this.state.config.chordType = 'custom';
  }

  public getCustomChord(): number[] {
    return [...this.state.customChord];
  }

  public setInversion(inversion: number): void {
    this.state.config.inversion = Math.max(0, Math.min(3, inversion));
  }

  public getInversion(): number {
    return this.state.config.inversion;
  }

  public setTranspose(semitones: number): void {
    this.state.config.transpose = Math.max(-12, Math.min(12, semitones));
  }

  public getTranspose(): number {
    return this.state.config.transpose;
  }

  public setVoicing(voicing: VoicingType): void {
    this.state.config.voicing = voicing;
  }

  public getVoicing(): VoicingType {
    return this.state.config.voicing;
  }

  public setOctaveRange(range: number): void {
    this.state.config.octaveRange = Math.max(1, Math.min(2, range));
  }

  public setVelocityScale(scale: number): void {
    this.state.config.velocityScale = Math.max(0.5, Math.min(1.5, scale));
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getState(): Readonly<ChordTriggerState> {
    return this.state;
  }

  public getConfig(): Readonly<ChordTriggerConfig> {
    return this.state.config;
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  public subscribe(listener: (event: ChordEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  public serialize(): ChordTriggerConfig & { customChord: number[] } {
    return {
      ...this.state.config,
      customChord: [...this.state.customChord],
    };
  }

  public deserialize(data: Partial<ChordTriggerConfig & { customChord: number[] }>): void {
    if (data.customChord) {
      this.state.customChord = data.customChord;
    }
    Object.assign(this.state.config, data);
  }
}

// =============================================================================
// Event Types
// =============================================================================

export type ChordEvent =
  | { type: 'note-on'; pitch: number; velocity: number; rootPitch: number }
  | { type: 'note-off'; pitch: number; velocity: number; rootPitch: number };

// =============================================================================
// Factory
// =============================================================================

export function createChordTrigger(options?: ChordTriggerOptions): ChordTrigger {
  return new ChordTrigger(options);
}

export default ChordTrigger;
