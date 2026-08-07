/**
 * Step Editor - Professional Step Input for MIDI Notes
 *
 * Features:
 * - Step-by-step MIDI note entry
 * - Configurable note length (1/4, 1/8, 1/16, 1/32)
 * - Triplet and dotted note support
 * - Velocity per step with velocity curves
 * - Gate length (note duration as % of step)
 * - Chord mode (enter multiple notes per step)
 * - Real-time preview of entered notes
 * - Undo/redo support
 * - Import existing notes for step editing
 * - Quantize after entry
 *
 * Workflow:
 * 1. Set note length and velocity
 * 2. Enter notes via keyboard/MIDI
 * 3. Each note advances by step length
 * 4. Chord mode allows multiple notes per step
 */

import { MidiNote, createNote, clampPitch, clampVelocity } from './types';

// =============================================================================
// Step Editor Types
// =============================================================================

export type StepLength = '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/32';
export type VelocityMode = 'fixed' | 'last' | 'accent' | 'crescendo' | 'diminuendo';

export interface StepEditorConfig {
  /** Note length for each step */
  stepLength: StepLength;
  /** Base velocity (0-127) */
  velocity: number;
  /** Velocity mode */
  velocityMode: VelocityMode;
  /** Gate length as percentage of step (0-100%) */
  gate: number;
  /** Triplet mode (3 notes per 2 of normal) */
  triplet: boolean;
  /** Dotted mode (1.5x duration) */
  dotted: boolean;
  /** Chord mode (multiple notes per step) */
  chordMode: boolean;
  /** Quantize notes after entry */
  quantize: boolean;
  /** Snap to grid after entry */
  snapToGrid: boolean;
  /** Auto-advance cursor after note entry */
  autoAdvance: boolean;
}

export interface StepEditorState {
  /** Current cursor position in beats */
  cursorBeat: number;
  /** Notes entered in current step (for chord mode) */
  currentStepNotes: number[];
  /** All entered notes */
  enteredNotes: MidiNote[];
  /** Start beat for entry */
  startBeat: number;
  /** Total steps entered */
  stepCount: number;
  /** Undo history */
  undoStack: MidiNote[][];
  /** Redo history */
  redoStack: MidiNote[][];
  /** Last velocity used */
  lastVelocity: number;
  /** Current velocity curve position (for crescendo/diminuendo) */
  velocityCurvePosition: number;
}

export interface StepEditorResult {
  /** Success flag */
  success: boolean;
  /** Notes that were entered */
  notes: MidiNote[];
  /** Steps that were processed */
  stepsProcessed: number;
  /** Final cursor position */
  finalCursorBeat: number;
  /** Error message if failed */
  error?: string;
}

export interface StepLengthInfo {
  /** Length name */
  name: StepLength;
  /** Duration in beats */
  beats: number;
  /** Display name */
  displayName: string;
}

// =============================================================================
// Constants
// =============================================================================

export const STEP_LENGTHS: StepLengthInfo[] = [
  { name: '1/1', beats: 4, displayName: 'Whole' },
  { name: '1/2', beats: 2, displayName: 'Half' },
  { name: '1/4', beats: 1, displayName: 'Quarter' },
  { name: '1/8', beats: 0.5, displayName: 'Eighth' },
  { name: '1/16', beats: 0.25, displayName: '16th' },
  { name: '1/32', beats: 0.125, displayName: '32nd' },
];

export const VELOCITY_CURVES: Record<string, (position: number, base: number) => number> = {
  crescendo: (pos, base) => Math.min(127, Math.round(base + (127 - base) * pos)),
  diminuendo: (pos, base) => Math.max(1, Math.round(base * (1 - pos * 0.7))),
  flat: (pos, base) => base,
};

export const DEFAULT_STEP_EDITOR_CONFIG: StepEditorConfig = {
  stepLength: '1/16',
  velocity: 100,
  velocityMode: 'fixed',
  gate: 80,
  triplet: false,
  dotted: false,
  chordMode: false,
  quantize: false,
  snapToGrid: true,
  autoAdvance: true,
};

// =============================================================================
// Step Editor
// =============================================================================

export class StepEditor {
  private config: StepEditorConfig;
  private state: StepEditorState;

  constructor(
    config: Partial<StepEditorConfig> = {},
    startBeat: number = 0
  ) {
    this.config = { ...DEFAULT_STEP_EDITOR_CONFIG, ...config };
    this.state = {
      cursorBeat: startBeat,
      currentStepNotes: [],
      enteredNotes: [],
      startBeat,
      stepCount: 0,
      undoStack: [],
      redoStack: [],
      lastVelocity: this.config.velocity,
      velocityCurvePosition: 0,
    };
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  public setStepLength(length: StepLength): void {
    this.config.stepLength = length;
  }

  public getStepLength(): StepLength {
    return this.config.stepLength;
  }

  public getStepBeats(): number {
    let beats = STEP_LENGTHS.find(l => l.name === this.config.stepLength)?.beats ?? 0.25;

    // Apply triplet (2/3 of normal duration)
    if (this.config.triplet) {
      beats *= 2 / 3;
    }

    // Apply dotted (1.5x duration)
    if (this.config.dotted) {
      beats *= 1.5;
    }

    return beats;
  }

  public setVelocity(velocity: number): void {
    this.config.velocity = clampVelocity(velocity);
  }

  public setVelocityMode(mode: VelocityMode): void {
    this.config.velocityMode = mode;
  }

  public setGate(gate: number): void {
    this.config.gate = Math.max(1, Math.min(100, gate));
  }

  public setTriplet(triplet: boolean): void {
    this.config.triplet = triplet;
  }

  public setDotted(dotted: boolean): void {
    this.config.dotted = dotted;
  }

  public setChordMode(chordMode: boolean): void {
    this.config.chordMode = chordMode;
    if (!chordMode) {
      this.commitChord();
    }
  }

  public setQuantize(quantize: boolean): void {
    this.config.quantize = quantize;
  }

  public setAutoAdvance(autoAdvance: boolean): void {
    this.config.autoAdvance = autoAdvance;
  }

  // ===========================================================================
  // Note Entry
  // ===========================================================================

  /**
   * Enter a note at the current cursor position
   */
  public enterNote(pitch: number, velocity?: number): MidiNote | null {
    const clampedPitch = clampPitch(pitch);
    const noteVelocity = velocity ?? this.calculateVelocity();

    // Calculate duration based on gate percentage
    const stepBeats = this.getStepBeats();
    const duration = stepBeats * (this.config.gate / 100);

    // Create the note
    const note = createNote(
      clampedPitch,
      this.state.cursorBeat,
      Math.max(0.01, duration),
      clampVelocity(noteVelocity)
    );

    if (this.config.chordMode) {
      // In chord mode, add to current step notes
      this.state.currentStepNotes.push(clampedPitch);
      this.state.enteredNotes.push(note);
    } else {
      // Single note mode
      this.state.enteredNotes.push(note);
      this.advanceCursor();
    }

    // Update velocity for next note
    this.updateVelocityForNextNote();

    return note;
  }

  /**
   * Enter a rest (advance cursor without adding a note)
   */
  public enterRest(): void {
    this.advanceCursor();
  }

  /**
   * Commit current chord notes and advance
   */
  public commitChord(): void {
    if (this.state.currentStepNotes.length > 0) {
      this.advanceCursor();
      this.state.currentStepNotes = [];
    }
  }

  /**
   * Cancel current chord entry
   */
  public cancelChord(): void {
    // Remove notes entered in current step
    const stepStart = this.state.cursorBeat;
    const stepBeats = this.getStepBeats();

    this.state.enteredNotes = this.state.enteredNotes.filter(
      note => note.startBeat < stepStart || note.startBeat >= stepStart + stepBeats
    );

    this.state.currentStepNotes = [];
  }

  // ===========================================================================
  // Cursor Movement
  // ===========================================================================

  /**
   * Advance cursor by one step
   */
  public advanceCursor(): void {
    this.state.cursorBeat += this.getStepBeats();
    this.state.stepCount++;
  }

  /**
   * Move cursor backward by one step
   */
  public rewindCursor(): void {
    const stepBeats = this.getStepBeats();
    this.state.cursorBeat = Math.max(
      this.state.startBeat,
      this.state.cursorBeat - stepBeats
    );
    this.state.stepCount = Math.max(0, this.state.stepCount - 1);
  }

  /**
   * Set cursor position
   */
  public setCursor(beat: number): void {
    this.state.cursorBeat = Math.max(this.state.startBeat, beat);
  }

  /**
   * Get current cursor position
   */
  public getCursor(): number {
    return this.state.cursorBeat;
  }

  // ===========================================================================
  // Velocity
  // ===========================================================================

  private calculateVelocity(): number {
    switch (this.config.velocityMode) {
      case 'fixed':
        return this.config.velocity;

      case 'last':
        return this.state.lastVelocity;

      case 'accent':
        // Alternate between base and accent velocity
        return this.state.stepCount % 2 === 0
          ? this.config.velocity
          : Math.min(127, this.config.velocity + 20);

      case 'crescendo':
        return VELOCITY_CURVES.crescendo(
          this.state.velocityCurvePosition,
          this.config.velocity
        );

      case 'diminuendo':
        return VELOCITY_CURVES.diminuendo(
          this.state.velocityCurvePosition,
          this.config.velocity
        );

      default:
        return this.config.velocity;
    }
  }

  private updateVelocityForNextNote(): void {
    this.state.lastVelocity = this.calculateVelocity();

    // Update velocity curve position
    if (this.config.velocityMode === 'crescendo' || this.config.velocityMode === 'diminuendo') {
      this.state.velocityCurvePosition = Math.min(
        1,
        this.state.velocityCurvePosition + 0.1
      );
    }
  }

  // ===========================================================================
  // Undo/Redo
  // ===========================================================================

  /**
   * Save current state for undo
   */
  public saveUndoState(): void {
    this.state.undoStack.push([...this.state.enteredNotes]);
    this.state.redoStack = [];

    // Limit undo stack size
    if (this.state.undoStack.length > 100) {
      this.state.undoStack.shift();
    }
  }

  /**
   * Undo last action
   */
  public undo(): MidiNote[] | null {
    if (this.state.undoStack.length === 0) return null;

    this.state.redoStack.push([...this.state.enteredNotes]);
    this.state.enteredNotes = this.state.undoStack.pop()!;

    return this.state.enteredNotes;
  }

  /**
   * Redo last undone action
   */
  public redo(): MidiNote[] | null {
    if (this.state.redoStack.length === 0) return null;

    this.state.undoStack.push([...this.state.enteredNotes]);
    this.state.enteredNotes = this.state.redoStack.pop()!;

    return this.state.enteredNotes;
  }

  // ===========================================================================
  // Batch Operations
  // ===========================================================================

  /**
   * Enter multiple notes at once
   */
  public enterNotes(
    pitches: number[],
    startBeat?: number,
    velocity?: number
  ): MidiNote[] {
    const notes: MidiNote[] = [];
    const beat = startBeat ?? this.state.cursorBeat;

    for (const pitch of pitches) {
      const note = this.enterNote(pitch, velocity);
      if (note) {
        notes.push(note);
      }
    }

    return notes;
  }

  /**
   * Enter a scale run
   */
  public enterScale(
    rootPitch: number,
    intervals: number[],
    direction: 'up' | 'down' = 'up'
  ): MidiNote[] {
    const notes: MidiNote[] = [];
    const sortedIntervals = direction === 'up'
      ? [...intervals].sort((a, b) => a - b)
      : [...intervals].sort((a, b) => b - a);

    for (const interval of sortedIntervals) {
      const note = this.enterNote(rootPitch + interval);
      if (note) {
        notes.push(note);
      }
    }

    return notes;
  }

  /**
   * Enter an arpeggio pattern
   */
  public enterArpeggio(
    pitches: number[],
    pattern: number[] = [0, 1, 2, 1],
    octaves: number = 1
  ): MidiNote[] {
    const notes: MidiNote[] = [];

    for (let oct = 0; oct < octaves; oct++) {
      for (const idx of pattern) {
        const pitchIndex = idx % pitches.length;
        const octaveShift = Math.floor(idx / pitches.length);
        const pitch = pitches[pitchIndex] + (oct + octaveShift) * 12;

        const note = this.enterNote(pitch);
        if (note) {
          notes.push(note);
        }
      }
    }

    return notes;
  }

  // ===========================================================================
  // State
  // ===========================================================================

  /**
   * Get all entered notes
   */
  public getNotes(): MidiNote[] {
    return [...this.state.enteredNotes];
  }

  /**
   * Clear all entered notes
   */
  public clear(): void {
    this.saveUndoState();
    this.state.enteredNotes = [];
    this.state.cursorBeat = this.state.startBeat;
    this.state.stepCount = 0;
    this.state.currentStepNotes = [];
  }

  /**
   * Get editor state
   */
  public getState(): Readonly<StepEditorState> {
    return this.state;
  }

  /**
   * Get editor config
   */
  public getConfig(): Readonly<StepEditorConfig> {
    return this.config;
  }

  // ===========================================================================
  // Finalization
  // ===========================================================================

  /**
   * Finalize step editing and return all notes
   */
  public finalize(): StepEditorResult {
    // Commit any pending chord
    if (this.config.chordMode && this.state.currentStepNotes.length > 0) {
      this.commitChord();
    }

    // Quantize if enabled
    let finalNotes = this.state.enteredNotes;
    if (this.config.quantize) {
      finalNotes = this.quantizeNotes(finalNotes);
    }

    return {
      success: true,
      notes: finalNotes,
      stepsProcessed: this.state.stepCount,
      finalCursorBeat: this.state.cursorBeat,
    };
  }

  /**
   * Quantize notes to grid
   */
  private quantizeNotes(notes: MidiNote[]): MidiNote[] {
    const stepBeats = this.getStepBeats();

    return notes.map(note => {
      const quantizedBeat = Math.round(note.startBeat / stepBeats) * stepBeats;
      return {
        ...note,
        startBeat: quantizedBeat,
      };
    });
  }

  // ===========================================================================
  // Import/Export
  // ===========================================================================

  /**
   * Import existing notes for step editing
   */
  public importNotes(notes: MidiNote[], startBeat: number = 0): void {
    this.state.enteredNotes = [...notes];
    this.state.startBeat = startBeat;

    // Find the end of the last note
    if (notes.length > 0) {
      const lastNote = notes.reduce((latest, note) =>
        note.startBeat + note.duration > latest.startBeat + latest.duration ? note : latest
      );
      this.state.cursorBeat = lastNote.startBeat + lastNote.duration;
    } else {
      this.state.cursorBeat = startBeat;
    }
  }

  /**
   * Get notes in a beat range
   */
  public getNotesInRange(startBeat: number, endBeat: number): MidiNote[] {
    return this.state.enteredNotes.filter(
      note => note.startBeat >= startBeat && note.startBeat < endBeat
    );
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  /**
   * Serialize editor state
   */
  public serialize(): { config: StepEditorConfig; state: Omit<StepEditorState, 'undoStack' | 'redoStack'> } {
    return {
      config: { ...this.config },
      state: {
        cursorBeat: this.state.cursorBeat,
        currentStepNotes: [...this.state.currentStepNotes],
        enteredNotes: [...this.state.enteredNotes],
        startBeat: this.state.startBeat,
        stepCount: this.state.stepCount,
        lastVelocity: this.state.lastVelocity,
        velocityCurvePosition: this.state.velocityCurvePosition,
      },
    };
  }

  /**
   * Deserialize editor state
   */
  public deserialize(data: { config: StepEditorConfig; state: Partial<StepEditorState> }): void {
    this.config = { ...DEFAULT_STEP_EDITOR_CONFIG, ...data.config };
    this.state = {
      ...this.state,
      ...data.state,
      undoStack: [],
      redoStack: [],
    };
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get step length info by name
 */
export function getStepLengthInfo(name: StepLength): StepLengthInfo {
  return STEP_LENGTHS.find(l => l.name === name) ?? STEP_LENGTHS[3]; // Default to 1/8
}

/**
 * Calculate total duration for N steps
 */
export function calculateStepDuration(
  stepCount: number,
  length: StepLength,
  triplet: boolean = false,
  dotted: boolean = false
): number {
  let stepBeats = getStepLengthInfo(length).beats;

  if (triplet) stepBeats *= 2 / 3;
  if (dotted) stepBeats *= 1.5;

  return stepCount * stepBeats;
}

/**
 * Create a step editor with common presets
 */
export function createStepEditorPreset(
  preset: 'basic' | 'drum' | 'melody' | 'chord',
  startBeat: number = 0
): StepEditor {
  const presets: Record<string, Partial<StepEditorConfig>> = {
    basic: {
      stepLength: '1/16',
      velocity: 100,
      gate: 80,
      chordMode: false,
    },
    drum: {
      stepLength: '1/16',
      velocity: 100,
      velocityMode: 'accent',
      gate: 50,
      chordMode: false,
    },
    melody: {
      stepLength: '1/8',
      velocity: 90,
      velocityMode: 'crescendo',
      gate: 90,
      chordMode: false,
    },
    chord: {
      stepLength: '1/4',
      velocity: 100,
      gate: 100,
      chordMode: true,
    },
  };

  return new StepEditor(presets[preset] ?? {}, startBeat);
}

// =============================================================================
// Factory
// =============================================================================

export function createStepEditor(
  config?: Partial<StepEditorConfig>,
  startBeat?: number
): StepEditor {
  return new StepEditor(config, startBeat);
}

export default StepEditor;
