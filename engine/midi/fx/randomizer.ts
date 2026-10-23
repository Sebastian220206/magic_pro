/**
 * Randomizer — scatter one property of a note.
 *
 * Only notes inside `[inputLow, inputHigh]` are touched. Notes outside pass
 * through unchanged rather than being dropped: the range selects *what to
 * randomise*, not what to let through, so setting a narrow range over the
 * snare's pitch leaves the rest of a kit alone.
 *
 * `weight` bends the distribution without changing its width. At 0 the scatter
 * is flat; toward Low it favours the bottom of the range, toward High the top.
 * A weighted random is the one control that separates "humanise" from "noise",
 * and it is implemented by raising a uniform sample to a power rather than by
 * rejection sampling, so every call costs the same.
 */

export type RandomizerTarget = 'velocity' | 'noteNumber';

export interface RandomizerConfig {
  target: RandomizerTarget;
  /** Only values in this band are randomised. */
  inputLow: number;
  inputHigh: number;
  /** Full width of the scatter, centred on the input value. */
  amount: number;
  /** -100 favours the low end, +100 the high end, 0 is flat. */
  weight: number;
  /** Added after the scatter. */
  offset: number;
}

export const RANDOMIZER_DEFAULTS: RandomizerConfig = {
  target: 'velocity',
  inputLow: 0,
  inputHigh: 127,
  amount: 0,
  weight: 0,
  offset: 0,
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * A sample in -0.5…0.5, biased by `weight`.
 *
 * `weight` maps to an exponent applied to a uniform 0…1 sample: 0 gives 1 and
 * leaves it flat, +100 gives 1/3 and pushes it toward 1, -100 gives 3 and
 * pushes it toward 0. Subtracting a half at the end recentres it.
 *
 * The curve has to be applied to the *unsigned* 0…1 sample, before it is
 * recentred. Applying it to a signed -1…1 sample and restoring the sign — the
 * obvious-looking version, and the one this shipped with — bends both halves
 * identically. That changes how tightly the scatter clusters around the centre
 * but moves its mean not at all, so Weight behaves as a second width control
 * and never does the one thing it exists for.
 */
export function weightedSample(weight: number, random: () => number = Math.random): number {
  const uniform = random();
  if (weight === 0) return uniform - 0.5;

  const exponent = weight > 0
    ? 1 / (1 + (weight / 100) * 2)
    : 1 + (-weight / 100) * 2;

  return Math.pow(uniform, exponent) - 0.5;
}

/** Apply the configured scatter to one value. */
export function randomizeValue(
  value: number,
  config: RandomizerConfig,
  random: () => number = Math.random,
): number {
  const lo = Math.min(config.inputLow, config.inputHigh);
  const hi = Math.max(config.inputLow, config.inputHigh);
  if (value < lo || value > hi) return value;

  const scattered = value + weightedSample(config.weight, random) * config.amount + config.offset;
  return clamp(Math.round(scattered), 0, 127);
}

export interface RandomizedNote {
  pitch: number;
  velocity: number;
}

export class Randomizer {
  private config: RandomizerConfig;
  /** Input pitch → sounded pitch, so a randomised pitch can be released. */
  private sounding = new Map<number, number>();

  constructor(config: Partial<RandomizerConfig> = {}) {
    this.config = { ...RANDOMIZER_DEFAULTS, ...config };
  }

  setConfig(patch: Partial<RandomizerConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  getConfig(): Readonly<RandomizerConfig> {
    return this.config;
  }

  noteOn(pitch: number, velocity: number): RandomizedNote[] {
    if (this.config.target === 'noteNumber') {
      const out = randomizeValue(pitch, this.config);
      this.sounding.set(pitch, out);
      return [{ pitch: out, velocity }];
    }

    // Velocity 0 is a note-off in MIDI; randomising it upward would turn a
    // release into a note that never ends.
    const velocityOut = velocity <= 0 ? 0 : Math.max(1, randomizeValue(velocity, this.config));
    this.sounding.set(pitch, pitch);
    return [{ pitch, velocity: velocityOut }];
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

export function createRandomizer(config?: Partial<RandomizerConfig>): Randomizer {
  return new Randomizer(config);
}

export default Randomizer;
