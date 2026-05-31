import { MidiNote } from './types';

export class MidiStateResolver {
  /**
   * Finds all notes physically held down at exactly `transportBeat`.
   * Used for seeking and resuming playback.
   */
  public static resolveActiveNotesAtBeat(notes: MidiNote[], transportBeat: number): MidiNote[] {
    // For smaller chunks, a linear pass of active intersections is highly efficient.
    // Given the region chunking architecture, `notes` will be a small subset (<= 1000 notes).
    return notes.filter(n => 
      !n.muted && 
      n.startBeat <= transportBeat && 
      (n.startBeat + n.duration) > transportBeat
    );
  }
}
