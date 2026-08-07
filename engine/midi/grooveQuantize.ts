/**
 * Groove Quantize Templates
 *
 * Provides preset groove/swing patterns for MIDI note quantization,
 * inspired by Logic Pro's Groove Quantize feature.
 */

import type { MidiNote } from './types';

export interface GrooveTemplate {
  name: string;
  description: string;
  offsets: number[];     // Beat timing offsets (fraction of a 16th note)
  division: number;      // Grid division this applies to
  velocityOffsets?: number[]; // Optional velocity adjustments (-1 to 1)
}

export const DEFAULT_GROOVE_TEMPLATES: GrooveTemplate[] = [
  {
    name: 'Shuffle (16th)',
    description: 'Classic 16th note shuffle feel',
    offsets: [0, 0, 0, 0.15, 0, 0, 0, 0.15, 0, 0, 0, 0.15, 0, 0, 0, 0.15],
    division: 16,
  },
  {
    name: 'Swing (8th)',
    description: '8th note swing feel',
    offsets: [0, 0.12, 0, 0.12, 0, 0.12, 0, 0.12],
    division: 8,
  },
  {
    name: 'Hard Swing',
    description: 'Aggressive swing feel',
    offsets: [0, 0.22, 0, 0.22, 0, 0.22, 0, 0.22],
    division: 8,
  },
  {
    name: 'Funk',
    description: '16th note funk groove',
    offsets: [0, -0.02, 0.08, 0.18, 0, -0.02, 0.08, 0.18, 0, -0.02, 0.08, 0.18, 0, -0.02, 0.08, 0.18],
    division: 16,
  },
  {
    name: 'Half-Time Shuffle',
    description: 'Half-time shuffle feel',
    offsets: [0, 0, 0.18, 0, 0, 0, 0.18, 0],
    division: 8,
  },
  {
    name: 'Push',
    description: 'Slightly ahead of the beat',
    offsets: [-0.05, -0.05, -0.05, -0.05, -0.05, -0.05, -0.05, -0.05],
    division: 8,
  },
  {
    name: 'Dragged',
    description: 'Slightly behind the beat',
    offsets: [0.06, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06],
    division: 8,
  },
];

/**
 * Apply a groove template to an array of MIDI notes.
 * Shifts each note's startBeat based on the template's offset pattern.
 */
export function applyGrooveToNotes(
  notes: MidiNote[],
  template: GrooveTemplate,
  strength: number,
  gridDivision: number
): MidiNote[] {
  const noteSize = 4 / gridDivision;
  const clampedStrength = Math.max(0, Math.min(1, strength));

  const result = notes.map((note, index) => {
    const gridPos = Math.round(note.startBeat / noteSize);
    const offsetIndex = gridPos % template.offsets.length;
    const offset = template.offsets[offsetIndex] * clampedStrength * noteSize;

    let velocity = note.velocity;
    if (template.velocityOffsets && template.velocityOffsets.length > 0) {
      const velOffset = template.velocityOffsets[offsetIndex % template.velocityOffsets.length];
      velocity = Math.max(1, Math.min(127, Math.round(note.velocity + velOffset * clampedStrength * 20)));
    }

    return {
      ...note,
      startBeat: Math.max(0, note.startBeat + offset),
      velocity,
    };
  });

  result.sort((a, b) => {
    if (a.startBeat !== b.startBeat) return a.startBeat - b.startBeat;
    return a.pitch - b.pitch;
  });

  return result;
}
