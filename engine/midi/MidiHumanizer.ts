import { MidiNote } from './types';

export interface HumanizeOptions {
  timingVariance: number;   // Maximum beat offset (e.g. 0.02 beats)
  velocityVariance: number; // Maximum velocity offset (e.g. 15)
  seed?: number;            // For deterministic randomization and undo safety
}

export class MidiHumanizer {
  /**
   * Pseudo-random number generator for deterministic humanization
   */
  private static seededRandom(seed: number): () => number {
    let s = seed;
    return function() {
      s = Math.sin(s) * 10000;
      return s - Math.floor(s);
    };
  }

  /**
   * Applies realistic jitter and velocity variations to notes deterministically.
   */
  public static humanizeNotes(notes: MidiNote[], options: HumanizeOptions): MidiNote[] {
    const random = this.seededRandom(options.seed ?? Date.now());

    return notes.map(note => {
      // Timing (-timingVariance to +timingVariance)
      const tRand = (random() * 2) - 1;
      let newStart = note.startBeat + (tRand * options.timingVariance);
      newStart = Math.max(0, newStart);

      // Velocity (-velocityVariance to +velocityVariance)
      const vRand = (random() * 2) - 1;
      let newVelocity = note.velocity + (vRand * options.velocityVariance);
      newVelocity = Math.max(0, Math.min(127, Math.round(newVelocity)));

      return {
        ...note,
        startBeat: newStart,
        velocity: newVelocity
      };
    });
  }
}
