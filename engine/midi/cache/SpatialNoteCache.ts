import { MidiNote } from '../../types';

export interface SpatialNoteBucket {
  notes: MidiNote[];
}

export class SpatialNoteCache {
  private buckets = new Map<string, SpatialNoteBucket>();
  
  // Grid resolution for caching
  private readonly BEATS_PER_BUCKET = 4; // 1 bar
  private readonly PITCHES_PER_BUCKET = 12; // 1 octave

  public buildCache(notes: MidiNote[]) {
    this.buckets.clear();

    for (const note of notes) {
      this.insertNote(note);
    }
  }

  public insertNote(note: MidiNote) {
    const startX = Math.floor(note.startBeat / this.BEATS_PER_BUCKET);
    const endX = Math.floor((note.startBeat + note.duration) / this.BEATS_PER_BUCKET);
    const bucketY = Math.floor(note.pitch / this.PITCHES_PER_BUCKET);

    for (let x = startX; x <= endX; x++) {
      const key = `${x},${bucketY}`;
      let bucket = this.buckets.get(key);
      if (!bucket) {
        bucket = { notes: [] };
        this.buckets.set(key, bucket);
      }
      // Note: we could use a Set to avoid duplicates if a note spans multiple buckets
      if (!bucket.notes.includes(note)) {
        bucket.notes.push(note);
      }
    }
  }

  public getNotesInRegion(startBeat: number, endBeat: number, minPitch: number, maxPitch: number): MidiNote[] {
    const startX = Math.floor(startBeat / this.BEATS_PER_BUCKET);
    const endX = Math.floor(endBeat / this.BEATS_PER_BUCKET);
    const startY = Math.floor(minPitch / this.PITCHES_PER_BUCKET);
    const endY = Math.floor(maxPitch / this.PITCHES_PER_BUCKET);

    const resultSet = new Set<MidiNote>();

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const bucket = this.buckets.get(`${x},${y}`);
        if (bucket) {
          for (const note of bucket.notes) {
            // Precise intersection check
            if (
              note.startBeat < endBeat &&
              note.startBeat + note.duration > startBeat &&
              note.pitch >= minPitch &&
              note.pitch <= maxPitch
            ) {
              resultSet.add(note);
            }
          }
        }
      }
    }

    return Array.from(resultSet);
  }
}

export const globalSpatialNoteCache = new SpatialNoteCache();
