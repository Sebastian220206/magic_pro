import { MidiNote } from './types';

export interface QuantizeOptions {
  gridResolution: number; // e.g. 0.25 for 1/16th notes
  strength: number;       // 0.0 to 1.0
  swing: number;          // 0.0 to 1.0 (pushes off-beats later)
}

export class MidiQuantizer {
  /**
   * Non-destructively quantizes a single note returning a new object.
   */
  public static quantizeNote(note: MidiNote, options: QuantizeOptions): MidiNote {
    const { gridResolution, strength, swing } = options;
    
    // Find nearest grid line
    const targetBeat = Math.round(note.startBeat / gridResolution) * gridResolution;
    let distance = targetBeat - note.startBeat;

    // Apply Swing
    // If the target beat is an odd division (e.g., the "and" of the beat), push it later
    const isOffBeat = Math.round(targetBeat / gridResolution) % 2 !== 0;
    if (isOffBeat && swing > 0) {
      const swingAmount = (gridResolution / 2) * swing;
      distance += swingAmount;
    }

    return {
      ...note,
      startBeat: note.startBeat + (distance * strength),
      // Duration stays exactly the same to preserve physical note length
    };
  }

  /**
   * Quantizes an array of notes. 
   * Returns a new array. Can be dispatched inside a QuantizeNotesCommand.
   */
  public static quantizeNotes(notes: MidiNote[], options: QuantizeOptions): MidiNote[] {
    return notes.map(n => this.quantizeNote(n, options));
  }
}
