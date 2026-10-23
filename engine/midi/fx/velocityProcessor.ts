/**
 * Velocity Processor — reshape how hard a note reads.
 *
 * Three modes, because they answer different questions and combining them into
 * one set of controls makes both harder to use:
 *
 *   - `value`   scale and offset, the linear case: `v * scale% + add`
 *   - `compand` pull velocities toward or away from a pivot, then apply gain
 *   - `random`  scatter around the played velocity by a fixed amount
 *
 * Every mode ends at the same clamp into `[rangeMin, rangeMax]`, so the range
 * is a property of the plugin rather than of a mode — setting a floor of 40
 * keeps that floor whichever mode is selected.
 *
 * Velocity 0 is left alone throughout. In MIDI a note-on at velocity 0 *is* a
 * note-off, so scaling it up would turn a release into a note that never ends.
 */

export type VelocityMode = 'value' | 'compand' | 'random';

export interface VelocityProcessorConfig {
  mode: VelocityMode;
  /** Percent, `value` mode. 100 leaves velocity untouched. */
  scale: number;
  /** Added after scaling, `value` mode. */
  add: number;
  /**
   * `compand` mode, -100…100.
   *
   * Negative compresses toward the pivot, positive expands away from it. Zero
   * is a straight wire, which is why the control is one bipolar value rather
   * than separate compress and expand amounts that can contradict each other.
   */
  compand: number;
  /** The velocity that `compand` pivots around. */
  pivot: number;
  /** Applied after companding, in velocity units. */
  gain: number;
  /** `random` mode: the full width of the scatter, centred on the input. */
  random: number;
  rangeMin: number;
  rangeMax: number;
}

export const VELOCITY_DEFAULTS: VelocityProcessorConfig = {
  mode: 'value',
  scale: 100,
  add: 0,
  compand: 0,
  pivot: 64,
  gain: 0,
  random: 0,
  rangeMin: 1,
  rangeMax: 127,
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Run one velocity through the configured shape.
 *
 * Exported separately from the class so the editor can draw the response curve
 * from the same code that processes notes, rather than a second copy of the
 * maths that can drift out of step with it.
 */
export function shapeVelocity(
  velocity: number,
  config: VelocityProcessorConfig,
  random: () => number = Math.random,
): number {
  if (velocity <= 0) return 0;

  let v = velocity;
  switch (config.mode) {
    case 'value':
      v = v * (config.scale / 100) + config.add;
      break;

    case 'compand': {
      // -100 collapses everything onto the pivot; +100 doubles the distance
      // from it. Anything beyond that stops being useful before it stops
      // being expressible, so the factor is capped by the control's range.
      const factor = 1 + config.compand / 100;
      v = config.pivot + (v - config.pivot) * factor + config.gain;
      break;
    }

    case 'random':
      v = v + (random() - 0.5) * config.random;
      break;
  }

  // The range is applied last and in a fixed order, so a min above the max
  // reads as a single held velocity rather than producing nothing.
  const lo = Math.min(config.rangeMin, config.rangeMax);
  const hi = Math.max(config.rangeMin, config.rangeMax);
  return clamp(Math.round(v), Math.max(1, lo), Math.min(127, hi));
}

export interface ProcessedNote {
  pitch: number;
  velocity: number;
}

export class VelocityProcessor {
  private config: VelocityProcessorConfig;

  constructor(config: Partial<VelocityProcessorConfig> = {}) {
    this.config = { ...VELOCITY_DEFAULTS, ...config };
  }

  setConfig(patch: Partial<VelocityProcessorConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  getConfig(): Readonly<VelocityProcessorConfig> {
    return this.config;
  }

  noteOn(pitch: number, velocity: number): ProcessedNote[] {
    return [{ pitch, velocity: shapeVelocity(velocity, this.config) }];
  }

  /** Pitch is untouched, so the note releases as itself. */
  noteOff(pitch: number): number[] {
    return [pitch];
  }

  allNotesOff(): number[] {
    return [];
  }
}

export function createVelocityProcessor(
  config?: Partial<VelocityProcessorConfig>,
): VelocityProcessor {
  return new VelocityProcessor(config);
}

export default VelocityProcessor;
