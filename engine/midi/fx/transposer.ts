/**
 * Transposer — shift incoming notes, optionally into a scale.
 *
 * Two stages, in this order: add the interval, then fold the result into the
 * chosen scale. Folding second is what makes the control predictable — a
 * transpose of +2 in C major moves every note up a whole step and *then*
 * corrects the ones that landed off the scale, rather than correcting first
 * and shifting a note that was already in key back out of it.
 *
 * `chromatic` disables the second stage entirely rather than quantising to a
 * twelve-note scale, so the common case does no work.
 *
 * The pitch that sounds is not the pitch that was pressed, so the mapping is
 * held until note-off. Without it a transposed note is released by its
 * original pitch and rings forever — the same fault the chord trigger's
 * `activeChords` map exists to prevent.
 */

export type ScaleName =
  | 'chromatic' | 'major' | 'naturalMinor' | 'harmonicMinor' | 'melodicMinor'
  | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian'
  | 'majorPentatonic' | 'minorPentatonic' | 'blues' | 'wholeTone';

export interface ScaleDefinition {
  name: string;
  /** Semitone degrees from the root. Empty means "every note passes". */
  degrees: number[];
}

export const SCALES: Record<ScaleName, ScaleDefinition> = {
  chromatic: { name: 'Chromatic', degrees: [] },
  major: { name: 'Major', degrees: [0, 2, 4, 5, 7, 9, 11] },
  naturalMinor: { name: 'Natural Minor', degrees: [0, 2, 3, 5, 7, 8, 10] },
  harmonicMinor: { name: 'Harmonic Minor', degrees: [0, 2, 3, 5, 7, 8, 11] },
  melodicMinor: { name: 'Melodic Minor', degrees: [0, 2, 3, 5, 7, 9, 11] },
  dorian: { name: 'Dorian', degrees: [0, 2, 3, 5, 7, 9, 10] },
  phrygian: { name: 'Phrygian', degrees: [0, 1, 3, 5, 7, 8, 10] },
  lydian: { name: 'Lydian', degrees: [0, 2, 4, 6, 7, 9, 11] },
  mixolydian: { name: 'Mixolydian', degrees: [0, 2, 4, 5, 7, 9, 10] },
  locrian: { name: 'Locrian', degrees: [0, 1, 3, 5, 6, 8, 10] },
  majorPentatonic: { name: 'Major Pentatonic', degrees: [0, 2, 4, 7, 9] },
  minorPentatonic: { name: 'Minor Pentatonic', degrees: [0, 3, 5, 7, 10] },
  blues: { name: 'Blues', degrees: [0, 3, 5, 6, 7, 10] },
  wholeTone: { name: 'Whole Tone', degrees: [0, 2, 4, 6, 8, 10] },
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export interface TransposerConfig {
  /** Semitones added before the scale is applied. */
  transpose: number;
  /** Scale root as a pitch class, 0 = C. */
  root: number;
  scale: ScaleName;
}

export const TRANSPOSER_DEFAULTS: TransposerConfig = {
  transpose: 0,
  root: 0,
  scale: 'chromatic',
};

/** True when `pitch` is a member of the scale rooted at `root`. */
export function inScale(pitch: number, root: number, scale: ScaleName): boolean {
  const degrees = SCALES[scale]?.degrees ?? [];
  if (degrees.length === 0) return true;
  return degrees.includes((((pitch - root) % 12) + 12) % 12);
}

/**
 * The nearest member of the scale, preferring downward on a tie.
 *
 * Ties are broken consistently rather than by rounding, because a note sitting
 * exactly between two scale degrees would otherwise flicker between them as
 * the transpose amount changed.
 */
export function foldIntoScale(pitch: number, root: number, scale: ScaleName): number {
  const degrees = SCALES[scale]?.degrees ?? [];
  if (degrees.length === 0) return pitch;

  for (let distance = 0; distance <= 6; distance++) {
    const down = pitch - distance;
    if (down >= 0 && inScale(down, root, scale)) return down;
    const up = pitch + distance;
    if (up <= 127 && inScale(up, root, scale)) return up;
  }
  return pitch;
}

export interface TransposedNote {
  pitch: number;
  velocity: number;
}

export class Transposer {
  private config: TransposerConfig;
  /** Input pitch → the pitch actually sounded, so note-off can find it. */
  private sounding = new Map<number, number>();

  constructor(config: Partial<TransposerConfig> = {}) {
    this.config = { ...TRANSPOSER_DEFAULTS, ...config };
  }

  setConfig(patch: Partial<TransposerConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  getConfig(): Readonly<TransposerConfig> {
    return this.config;
  }

  noteOn(pitch: number, velocity: number): TransposedNote[] {
    const shifted = pitch + this.config.transpose;
    if (shifted < 0 || shifted > 127) return [];

    const out = foldIntoScale(shifted, this.config.root, this.config.scale);
    // Re-pressing a held key would otherwise orphan the first sounding pitch.
    this.sounding.set(pitch, out);
    return [{ pitch: out, velocity }];
  }

  noteOff(pitch: number): number[] {
    const sounded = this.sounding.get(pitch);
    if (sounded === undefined) return [];
    this.sounding.delete(pitch);
    return [sounded];
  }

  allNotesOff(): number[] {
    const pitches = Array.from(this.sounding.values());
    this.sounding.clear();
    return pitches;
  }
}

export function createTransposer(config?: Partial<TransposerConfig>): Transposer {
  return new Transposer(config);
}

export default Transposer;
