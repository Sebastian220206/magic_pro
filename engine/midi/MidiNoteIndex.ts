import { MidiNote } from './types';

export class MidiNoteIndex {
  private sortedByStart: MidiNote[];

  constructor(notes: MidiNote[]) {
    // Sort ascending by startBeat
    this.sortedByStart = [...notes].sort((a, b) => a.startBeat - b.startBeat);
  }

  /**
   * O(log n) lookup for notes starting within a viewport/scheduling window.
   */
  public getNotesStartingInRange(startBeat: number, endBeat: number): MidiNote[] {
    const startIndex = this.binarySearchFloor(startBeat);
    const result: MidiNote[] = [];

    for (let i = startIndex; i < this.sortedByStart.length; i++) {
      const note = this.sortedByStart[i];
      if (note.startBeat >= endBeat) break; // Exceeded range
      if (note.startBeat >= startBeat) {
        result.push(note);
      }
    }
    return result;
  }

  private binarySearchFloor(beat: number): number {
    if (this.sortedByStart.length === 0) return 0;
    let low = 0, high = this.sortedByStart.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.sortedByStart[mid].startBeat < beat) low = mid + 1;
      else high = mid - 1;
    }
    return low;
  }
}
