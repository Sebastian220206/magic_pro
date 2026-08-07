/**
 * Arpeggiator - MIDI Arpeggiator Effect
 *
 * Features:
 * - Multiple arpeggio patterns (up, down, up-down, random, chord)
 * - Configurable rate (1/4, 1/8, 1/16, 1/32)
 * - Octave range (1-4 octaves)
 * - Swing amount
 * - Gate time
 * - Velocity patterns
 * - Latch mode
 *
 * Signal Flow:
 * Input Notes → Pattern Generator → Rate Clock → Output Notes
 */

import { MidiNote, createNote, generateNoteId } from '../types';

export type ArpPattern = 'up' | 'down' | 'upDown' | 'random' | 'chord' | 'order';
export type ArpRate = '1/4' | '1/8' | '1/8T' | '1/16' | '1/16T' | '1/32';
export type VelocityPattern = 'none' | 'accent' | 'crescendo' | 'diminuendo' | 'random';

export interface ArpeggiatorConfig {
  pattern: ArpPattern;
  rate: ArpRate;
  octaveRange: number;    // 1-4
  swing: number;          // 0-1
  gate: number;           // 0.01-2 (multiplier of rate)
  velocityPattern: VelocityPattern;
  velocityAmount: number; // 0-1 (strength of velocity variation)
  latch: boolean;         // Hold notes after release
  sync: boolean;          // Sync to tempo
}

export interface ArpeggiatorState {
  config: ArpeggiatorConfig;
  heldNotes: Set<number>;     // Currently held pitches
  activeNotes: Set<number>;   // Notes currently playing
  stepIndex: number;
  lastStepTime: number;
  isPlaying: boolean;
}

export interface ArpeggiatorOptions {
  pattern?: ArpPattern;
  rate?: ArpRate;
  octaveRange?: number;
  swing?: number;
  gate?: number;
  velocityPattern?: VelocityPattern;
  velocityAmount?: number;
  latch?: boolean;
  sync?: boolean;
}

const RATE_BEATS: Record<ArpRate, number> = {
  '1/4': 1,
  '1/8': 0.5,
  '1/8T': 0.333333,
  '1/16': 0.25,
  '1/16T': 0.166667,
  '1/32': 0.125,
};

const DEFAULT_CONFIG: ArpeggiatorConfig = {
  pattern: 'up',
  rate: '1/16',
  octaveRange: 1,
  swing: 0,
  gate: 0.8,
  velocityPattern: 'none',
  velocityAmount: 0.5,
  latch: false,
  sync: true,
};

export class Arpeggiator {
  private state: ArpeggiatorState;
  private listeners: Array<(event: ArpEvent) => void> = [];

  constructor(options: ArpeggiatorOptions = {}) {
    this.state = {
      config: { ...DEFAULT_CONFIG, ...options },
      heldNotes: new Set(),
      activeNotes: new Set(),
      stepIndex: 0,
      lastStepTime: 0,
      isPlaying: false,
    };
  }

  // ===========================================================================
  // Note Input
  // ===========================================================================

  public noteOn(pitch: number, velocity: number = 100, beat: number = 0): void {
    this.state.heldNotes.add(pitch);

    if (this.state.config.latch) {
      // Latch mode: add to pattern
      this.updatePattern();
    }
  }

  public noteOff(pitch: number): void {
    this.state.heldNotes.delete(pitch);

    if (!this.state.config.latch && this.state.heldNotes.size === 0) {
      this.allNotesOff();
    }
  }

  public allNotesOff(): void {
    for (const pitch of this.state.activeNotes) {
      this.emit({ type: 'note-off', pitch, velocity: 0 });
    }
    this.state.activeNotes.clear();
  }

  // ===========================================================================
  // Pattern Generation
  // ===========================================================================

  private updatePattern(): void {
    // Generate pattern based on held notes
    const notes = this.getPatternNotes();
    if (notes.length === 0) return;

    const patternLength = notes.length * this.state.config.octaveRange;
    this.state.stepIndex = this.state.stepIndex % patternLength;
  }

  private getPatternNotes(): number[] {
    const notes = Array.from(this.state.heldNotes).sort((a, b) => a - b);
    if (notes.length === 0) return [];

    switch (this.state.config.pattern) {
      case 'up':
        return notes;
      case 'down':
        return [...notes].reverse();
      case 'upDown':
        return [...notes, ...notes.slice(1, -1).reverse()];
      case 'random':
        return [...notes].sort(() => Math.random() - 0.5);
      case 'chord':
        return notes;
      case 'order':
        return notes;
      default:
        return notes;
    }
  }

  // ===========================================================================
  // Step Processing
  // ===========================================================================

  public processStep(currentBeat: number): ArpEvent[] {
    const events: ArpEvent[] = [];
    const config = this.state.config;
    const rateBeats = RATE_BEATS[config.rate];

    // Check if it's time for a new step
    const timeSinceLastStep = currentBeat - this.state.lastStepTime;
    const swingOffset = this.getSwingOffset(currentBeat);

    if (timeSinceLastStep < rateBeats - swingOffset) {
      return events;
    }

    this.state.lastStepTime = currentBeat;

    // Get current notes in pattern
    const patternNotes = this.getPatternNotes();
    if (patternNotes.length === 0) {
      this.allNotesOff();
      return events;
    }

    // Calculate current step across octave range
    const patternLength = patternNotes.length;
    const totalSteps = patternLength * config.octaveRange;
    const step = this.state.stepIndex % totalSteps;

    // Determine which note to play
    const patternIndex = step % patternLength;
    const octaveOffset = Math.floor(step / patternLength);
    const basePitch = patternNotes[patternIndex];
    const pitch = basePitch + (octaveOffset * 12);

    // Skip if out of MIDI range
    if (pitch < 0 || pitch > 127) {
      this.state.stepIndex++;
      return events;
    }

    // Turn off previous note
    for (const prevPitch of this.state.activeNotes) {
      if (prevPitch !== pitch) {
        events.push({ type: 'note-off', pitch: prevPitch, velocity: 0 });
      }
    }
    this.state.activeNotes.clear();

    // Calculate velocity
    const velocity = this.calculateVelocity(patternIndex, patternLength);

    // Calculate gate time
    const gateTime = rateBeats * config.gate;

    // Emit note-on
    events.push({
      type: 'note-on',
      pitch,
      velocity,
      duration: gateTime,
    });

    this.state.activeNotes.add(pitch);
    this.state.stepIndex++;

    return events;
  }

  private calculateVelocity(step: number, totalSteps: number): number {
    const { velocityPattern, velocityAmount } = this.state.config;
    const baseVelocity = 100;

    switch (velocityPattern) {
      case 'accent':
        return step === 0 ? Math.min(127, baseVelocity + 27 * velocityAmount) : baseVelocity;
      case 'crescendo':
        return Math.round(baseVelocity * (0.5 + (step / totalSteps) * 0.5 * velocityAmount));
      case 'diminuendo':
        return Math.round(baseVelocity * (1 - (step / totalSteps) * 0.5 * velocityAmount));
      case 'random':
        return Math.round(baseVelocity * (0.5 + Math.random() * 0.5 * velocityAmount));
      default:
        return baseVelocity;
    }
  }

  private getSwingOffset(beat: number): number {
    const { swing, rate } = this.state.config;
    if (swing === 0 || (rate !== '1/8' && rate !== '1/16')) return 0;

    const rateBeats = RATE_BEATS[rate];
    const isOffbeat = Math.floor(beat / (rateBeats / 2)) % 2 === 1;

    return isOffbeat ? rateBeats * swing * 0.5 : 0;
  }

  // ===========================================================================
  // Control
  // ===========================================================================

  public start(): void {
    this.state.isPlaying = true;
    this.state.stepIndex = 0;
    this.state.lastStepTime = 0;
  }

  public stop(): void {
    this.state.isPlaying = false;
    this.allNotesOff();
  }

  public reset(): void {
    this.state.stepIndex = 0;
    this.state.lastStepTime = 0;
    this.allNotesOff();
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  public setPattern(pattern: ArpPattern): void {
    this.state.config.pattern = pattern;
    this.updatePattern();
  }

  public getPattern(): ArpPattern {
    return this.state.config.pattern;
  }

  public setRate(rate: ArpRate): void {
    this.state.config.rate = rate;
  }

  public getRate(): ArpRate {
    return this.state.config.rate;
  }

  public setOctaveRange(range: number): void {
    this.state.config.octaveRange = Math.max(1, Math.min(4, range));
  }

  public getOctaveRange(): number {
    return this.state.config.octaveRange;
  }

  public setSwing(swing: number): void {
    this.state.config.swing = Math.max(0, Math.min(1, swing));
  }

  public getSwing(): number {
    return this.state.config.swing;
  }

  public setGate(gate: number): void {
    this.state.config.gate = Math.max(0.01, Math.min(2, gate));
  }

  public getGate(): number {
    return this.state.config.gate;
  }

  public setVelocityPattern(pattern: VelocityPattern): void {
    this.state.config.velocityPattern = pattern;
  }

  public setVelocityAmount(amount: number): void {
    this.state.config.velocityAmount = Math.max(0, Math.min(1, amount));
  }

  public setLatch(enabled: boolean): void {
    this.state.config.latch = enabled;
    if (!enabled) {
      this.state.heldNotes.clear();
    }
  }

  public getLatch(): boolean {
    return this.state.config.latch;
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getState(): Readonly<ArpeggiatorState> {
    return this.state;
  }

  public getConfig(): Readonly<ArpeggiatorConfig> {
    return this.state.config;
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  public subscribe(listener: (event: ArpEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private emit(event: ArpEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  public serialize(): ArpeggiatorConfig {
    return { ...this.state.config };
  }

  public deserialize(config: Partial<ArpeggiatorConfig>): void {
    Object.assign(this.state.config, config);
  }
}

// =============================================================================
// Event Types
// =============================================================================

export type ArpEvent =
  | { type: 'note-on'; pitch: number; velocity: number; duration: number }
  | { type: 'note-off'; pitch: number; velocity: number };

// =============================================================================
// Factory
// =============================================================================

export function createArpeggiator(options?: ArpeggiatorOptions): Arpeggiator {
  return new Arpeggiator(options);
}

export default Arpeggiator;
