/**
 * Quantization - Grid quantization for MIDI notes
 * 
 * Features:
 * - Snap notes to grid divisions
 * - Configurable strength (0-100%)
 * - Swing/shuffle support
 * - Preserve note relationships
 */

import { MidiNote, GridDivision, QuantizeOptions } from './types';
export type { QuantizeOptions } from './types';

// =============================================================================
// Grid Constants
// =============================================================================

export const GRID_DIVISIONS: GridDivision[] = [1, 2, 4, 8, 16, 32, 64, 128, 256];

export const GRID_NAMES: Record<GridDivision, string> = {
  1: '1/1 (Whole)',
  2: '1/2 (Half)',
  4: '1/4 (Quarter)',
  8: '1/8 (Eighth)',
  16: '1/16 (Sixteenth)',
  32: '1/32 (Thirty-second)',
  64: '1/64 (Sixty-fourth)',
  128: '1/128',
  256: '1/256',
};

// =============================================================================
// Core Quantization
// =============================================================================

/**
 * Calculate grid size in beats from division
 */
export function getGridSize(division: GridDivision): number {
  return 4 / division; // 1/4 = 1.0, 1/16 = 0.25
}

/**
 * Quantize a single note
 * @param note The note to quantize
 * @param division Grid division
 * @param strength 0-1 (0=no quantize, 1=full quantize)
 * @param swing 0-1 swing amount (optional)
 */
export function quantizeNote(
  note: MidiNote,
  division: GridDivision,
  strength: number = 1,
  swing: number = 0
): MidiNote {
  const gridSize = getGridSize(division);
  
  // Calculate quantized position
  let quantizedBeat = Math.round(note.startBeat / gridSize) * gridSize;
  
  // Apply swing (only to off-beat positions)
  if (swing > 0) {
    const gridIndex = Math.round(note.startBeat / gridSize);
    const isOffBeat = gridIndex % 2 === 1;
    
    if (isOffBeat) {
      // Delay off-beat notes by swing amount
      quantizedBeat += gridSize * swing * 0.5;
    }
  }
  
  // Apply strength (interpolate between original and quantized)
  const finalBeat = note.startBeat + (quantizedBeat - note.startBeat) * strength;
  
  return {
    ...note,
    startBeat: finalBeat,
  };
}

/**
 * Quantize multiple notes
 */
export function quantizeNotes(
  notes: MidiNote[],
  options: QuantizeOptions
): MidiNote[] {
  const { gridDivision, strength, swing } = options;
  
  return notes.map(note => quantizeNote(note, gridDivision, strength, swing));
}

/**
 * Quantize only note start times (preserve durations)
 */
export function quantizeNoteStarts(
  notes: MidiNote[],
  division: GridDivision,
  strength: number = 1
): MidiNote[] {
  const gridSize = getGridSize(division);
  
  return notes.map(note => {
    const quantizedBeat = Math.round(note.startBeat / gridSize) * gridSize;
    const finalBeat = note.startBeat + (quantizedBeat - note.startBeat) * strength;
    
    return {
      ...note,
      startBeat: finalBeat,
    };
  });
}

/**
 * Quantize note ends (preserve starts)
 */
export function quantizeNoteEnds(
  notes: MidiNote[],
  division: GridDivision,
  strength: number = 1
): MidiNote[] {
  const gridSize = getGridSize(division);
  
  return notes.map(note => {
    const endBeat = note.startBeat + note.duration;
    const quantizedEnd = Math.round(endBeat / gridSize) * gridSize;
    const finalEnd = endBeat + (quantizedEnd - endBeat) * strength;
    
    return {
      ...note,
      duration: Math.max(gridSize / 4, finalEnd - note.startBeat), // Min duration
    };
  });
}

// =============================================================================
// Groove Templates
// =============================================================================

export interface GrooveTemplate {
  name: string;
  timingOffsets: number[]; // Relative to grid, in beats
}

/**
 * Apply groove template to notes
 */
export function applyGroove(
  notes: MidiNote[],
  groove: GrooveTemplate,
  division: GridDivision,
  strength: number = 1
): MidiNote[] {
  const gridSize = getGridSize(division);
  
  return notes.map(note => {
    const gridIndex = Math.floor(note.startBeat / gridSize);
    const offsetIndex = gridIndex % groove.timingOffsets.length;
    const offset = groove.timingOffsets[offsetIndex] * strength;
    
    return {
      ...note,
      startBeat: note.startBeat + offset,
    };
  });
}

// Common groove templates
export const GROOVE_TEMPLATES: Record<string, GrooveTemplate> = {
  'straight': {
    name: 'Straight',
    timingOffsets: [0, 0, 0, 0],
  },
  'shuffle-light': {
    name: 'Shuffle (Light)',
    timingOffsets: [0, 0.083, 0, 0.083], // ~1/12 swing
  },
  'shuffle-medium': {
    name: 'Shuffle (Medium)',
    timingOffsets: [0, 0.125, 0, 0.125], // 1/8 swing
  },
  'shuffle-heavy': {
    name: 'Shuffle (Heavy)',
    timingOffsets: [0, 0.167, 0, 0.167], // ~1/6 swing
  },
  'triplet': {
    name: 'Triplet',
    timingOffsets: [0, 0.167, 0.333, 0], // Triplet feel
  },
};

// =============================================================================
// Snap Functions
// =============================================================================

/**
 * Snap a beat value to the nearest grid line
 */
export function snapToGrid(beat: number, division: GridDivision): number {
  const gridSize = getGridSize(division);
  return Math.round(beat / gridSize) * gridSize;
}

/**
 * Snap a beat value down to the previous grid line
 */
export function snapToGridFloor(beat: number, division: GridDivision): number {
  const gridSize = getGridSize(division);
  return Math.floor(beat / gridSize) * gridSize;
}

/**
 * Snap a beat value up to the next grid line
 */
export function snapToGridCeil(beat: number, division: GridDivision): number {
  const gridSize = getGridSize(division);
  return Math.ceil(beat / gridSize) * gridSize;
}

/**
 * Get the previous grid line
 */
export function getPreviousGridLine(beat: number, division: GridDivision): number {
  return snapToGridFloor(beat, division);
}

/**
 * Get the next grid line
 */
export function getNextGridLine(beat: number, division: GridDivision): number {
  return snapToGridCeil(beat, division);
}

/**
 * Check if a beat is on a grid line (within tolerance)
 */
export function isOnGrid(beat: number, division: GridDivision, tolerance: number = 0.001): boolean {
  const snapped = snapToGrid(beat, division);
  return Math.abs(beat - snapped) < tolerance;
}

// =============================================================================
// Grid Visualization
// =============================================================================

/**
 * Get all grid lines within a time range
 */
export function getGridLinesInRange(
  startBeat: number,
  endBeat: number,
  division: GridDivision
): number[] {
  const lines: number[] = [];
  const gridSize = getGridSize(division);
  
  let current = snapToGridCeil(startBeat, division);
  
  while (current <= endBeat) {
    lines.push(current);
    current += gridSize;
  }
  
  return lines;
}

/**
 * Get bar/beat markers for time ruler
 */
export interface TimeMarker {
  beat: number;
  type: 'bar' | 'beat' | 'subdivision';
  label?: string;
}

export function getTimeMarkers(
  startBeat: number,
  endBeat: number,
  division: GridDivision,
  timeSignature: { numerator: number; denominator: number } = { numerator: 4, denominator: 4 }
): TimeMarker[] {
  const markers: TimeMarker[] = [];
  const beatsPerBar = timeSignature.numerator * (4 / timeSignature.denominator);
  
  // Add bar markers
  const startBar = Math.floor(startBeat / beatsPerBar);
  const endBar = Math.ceil(endBeat / beatsPerBar);
  
  for (let bar = startBar; bar <= endBar; bar++) {
    const barStart = bar * beatsPerBar;
    if (barStart >= startBeat && barStart <= endBeat) {
      markers.push({
        beat: barStart,
        type: 'bar',
        label: `${bar + 1}`,
      });
    }
  }
  
  // Add beat markers (if zoomed in enough)
  if (division >= 4) {
    const beatGridSize = getGridSize(4); // Quarter notes
    let current = snapToGridCeil(startBeat, 4);
    
    while (current <= endBeat) {
      if (!markers.find(m => m.beat === current)) {
        markers.push({
          beat: current,
          type: 'beat',
        });
      }
      current += beatGridSize;
    }
  }
  
  // Add subdivision markers
  const gridSize = getGridSize(division);
  let current = snapToGridCeil(startBeat, division);
  
  while (current <= endBeat) {
    if (!markers.find(m => m.beat === current)) {
      markers.push({
        beat: current,
        type: 'subdivision',
      });
    }
    current += gridSize;
  }
  
  return markers.sort((a, b) => a.beat - b.beat);
}

// =============================================================================
// Advanced Quantization
// =============================================================================

/**
 * Iterative strength quantize (gradual quantization)
 * Apply multiple passes with increasing strength
 */
export function iterativeQuantize(
  notes: MidiNote[],
  division: GridDivision,
  passes: number = 3
): MidiNote[] {
  let result = notes;
  
  for (let i = 1; i <= passes; i++) {
    const strength = i / passes;
    result = quantizeNotes(result, {
      gridDivision: division,
      strength,
    });
  }
  
  return result;
}

/**
 * Smart quantize - preserve relationships between close notes
 */
export function smartQuantize(
  notes: MidiNote[],
  division: GridDivision,
  strength: number = 1,
  groupingThreshold: number = 0.1
): MidiNote[] {
  if (notes.length === 0) return notes;
  
  // Sort notes by start time
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat);
  const groups: MidiNote[][] = [];
  let currentGroup: MidiNote[] = [sorted[0]];
  
  // Group close notes together
  for (let i = 1; i < sorted.length; i++) {
    const prevNote = sorted[i - 1];
    const note = sorted[i];
    
    if (note.startBeat - prevNote.startBeat < groupingThreshold) {
      currentGroup.push(note);
    } else {
      groups.push(currentGroup);
      currentGroup = [note];
    }
  }
  groups.push(currentGroup);
  
  // Quantize each group, keeping relative offsets
  const result: MidiNote[] = [];
  
  for (const group of groups) {
    if (group.length === 1) {
      result.push(quantizeNote(group[0], division, strength));
    } else {
      // Quantize first note, apply same offset to rest
      const firstQuantized = quantizeNote(group[0], division, strength);
      const offset = firstQuantized.startBeat - group[0].startBeat;
      
      for (const note of group) {
        result.push({
          ...note,
          startBeat: note.startBeat + offset,
        });
      }
    }
  }
  
  return result;
}

// =============================================================================
// Utility
// =============================================================================

/**
 * Get division from string (e.g., "1/16" -> 16)
 */
export function parseGridDivision(str: string): GridDivision | null {
  const match = str.match(/1\/(\d+)/);
  if (!match) return null;
  
  const div = parseInt(match[1]) as GridDivision;
  return GRID_DIVISIONS.includes(div) ? div : null;
}

/**
 * Get next larger division
 */
export function getNextDivision(current: GridDivision): GridDivision | null {
  const index = GRID_DIVISIONS.indexOf(current);
  if (index >= GRID_DIVISIONS.length - 1) return null;
  return GRID_DIVISIONS[index + 1];
}

/**
 * Get next smaller division
 */
export function getPreviousDivision(current: GridDivision): GridDivision | null {
  const index = GRID_DIVISIONS.indexOf(current);
  if (index <= 0) return null;
  return GRID_DIVISIONS[index - 1];
}
