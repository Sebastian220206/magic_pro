import { MidiNote } from './types';
import { MidiPlaybackInvalidation } from './MidiPlaybackInvalidation';

export interface RootStoreMidiApi {
  updateNotes(regionId: string, chunkId: string, notes: MidiNote[]): void;
  removeNotes(regionId: string, chunkId: string, noteIds: string[]): void;
  addNotes(regionId: string, chunkId: string, notes: MidiNote[]): void;
  getInvalidator(): MidiPlaybackInvalidation;
}

export interface MidiCommand {
  execute(store: RootStoreMidiApi, dspTimeNow: number): void;
  undo(store: RootStoreMidiApi, dspTimeNow: number): void;
}

export class MoveMidiNotesCommand implements MidiCommand {
  constructor(
    private regionId: string,
    private chunkId: string,
    private newNotes: MidiNote[],
    private oldNotes: MidiNote[]
  ) {}

  execute(store: RootStoreMidiApi, dspTimeNow: number) {
    store.updateNotes(this.regionId, this.chunkId, this.newNotes);
    this.invalidate(store, this.newNotes, this.oldNotes, dspTimeNow);
  }

  undo(store: RootStoreMidiApi, dspTimeNow: number) {
    store.updateNotes(this.regionId, this.chunkId, this.oldNotes);
    this.invalidate(store, this.oldNotes, this.newNotes, dspTimeNow);
  }

  private invalidate(store: RootStoreMidiApi, stateA: MidiNote[], stateB: MidiNote[], dspTimeNow: number) {
    const invalidator = store.getInvalidator();
    let minBeat = Infinity;
    let maxBeat = 0;

    for (const note of stateA) {
      minBeat = Math.min(minBeat, note.startBeat);
      maxBeat = Math.max(maxBeat, note.startBeat + note.duration);
    }
    for (const note of stateB) {
      minBeat = Math.min(minBeat, note.startBeat);
      maxBeat = Math.max(maxBeat, note.startBeat + note.duration);
    }
    
    // Alert the playback engine that edits occurred within this window
    invalidator.invalidateRange(this.regionId, minBeat, maxBeat, dspTimeNow);
  }
}

export class ResizeMidiNotesCommand implements MidiCommand {
  // Similar implementation passing new/old durations and invalidating the union bounds
  execute(store: RootStoreMidiApi, dspTimeNow: number) {}
  undo(store: RootStoreMidiApi, dspTimeNow: number) {}
}
