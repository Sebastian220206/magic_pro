/**
 * Modifier — read one property of a note, write it to another.
 *
 * The transform is the same affine step Logic's is: `out = in * scale% + add`,
 * clamped into MIDI range. What differs is the vocabulary of properties, and
 * the reason is worth stating rather than hiding.
 *
 * Logic's Modifier can re-assign to any continuous controller, because Logic's
 * MIDI FX slot passes a full event stream. This app's live note path carries a
 * pitch and a velocity and nothing else — `triggerNote(trackId, pitch,
 * velocity)` is the whole interface — so a controller target would have
 * nowhere to go. Rather than accept a controller number and silently drop it,
 * the two properties that exist are the two offered, and the editor dims the
 * controller targets with that reason. This is the same rule
 * `lib/fxCatalog.ts` follows.
 *
 * `thru` emits the original note alongside the modified one, which is what
 * Logic's Thru button does. It is suppressed when both notes would land on the
 * same pitch, since sounding a pitch twice retriggers rather than layers.
 */

export type ModifierProperty = 'noteNumber' | 'velocity';

export interface ModifierConfig {
  /** Property the transform reads. */
  source: ModifierProperty;
  /** Property the transform writes. */
  target: ModifierProperty;
  /** Percent applied to the source value. 100 passes it straight through. */
  scale: number;
  /** Added after scaling. */
  add: number;
  /** Also emit the note as played. */
  thru: boolean;
}

export const MODIFIER_DEFAULTS: ModifierConfig = {
  source: 'noteNumber',
  target: 'velocity',
  scale: 100,
  add: 0,
  thru: false,
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The affine step, shared with the editor so its readout cannot drift. */
export function modifierTransform(value: number, config: ModifierConfig): number {
  return clamp(Math.round(value * (config.scale / 100) + config.add), 0, 127);
}

export interface ModifiedNote {
  pitch: number;
  velocity: number;
}

export class Modifier {
  private config: ModifierConfig;
  /** Input pitch → every pitch it sounded, so note-off releases all of them. */
  private sounding = new Map<number, number[]>();

  constructor(config: Partial<ModifierConfig> = {}) {
    this.config = { ...MODIFIER_DEFAULTS, ...config };
  }

  setConfig(patch: Partial<ModifierConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  getConfig(): Readonly<ModifierConfig> {
    return this.config;
  }

  noteOn(pitch: number, velocity: number): ModifiedNote[] {
    const sourceValue = this.config.source === 'noteNumber' ? pitch : velocity;
    const written = modifierTransform(sourceValue, this.config);

    const modified: ModifiedNote = this.config.target === 'noteNumber'
      ? { pitch: written, velocity }
      // Velocity 0 is a note-off in MIDI, so a transform that reaches zero is
      // floored rather than turning the note into its own release.
      : { pitch, velocity: Math.max(1, written) };

    const notes: ModifiedNote[] = [modified];
    if (this.config.thru && modified.pitch !== pitch) {
      notes.push({ pitch, velocity });
    }

    this.sounding.set(pitch, notes.map(n => n.pitch));
    return notes;
  }

  noteOff(pitch: number): number[] {
    const sounded = this.sounding.get(pitch);
    if (!sounded) return [];
    this.sounding.delete(pitch);
    return sounded;
  }

  allNotesOff(): number[] {
    const pitches = Array.from(this.sounding.values()).flat();
    this.sounding.clear();
    return pitches;
  }
}

export function createModifier(config?: Partial<ModifierConfig>): Modifier {
  return new Modifier(config);
}

export default Modifier;
