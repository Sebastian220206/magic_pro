/**
 * Modulator — wobble one property of a note with an LFO.
 *
 * Logic's Modulator drives a MIDI parameter from an LFO/envelope. This app's
 * live note path carries a pitch and a velocity and nothing else —
 * `triggerNote(trackId, pitch, velocity)` is the whole interface — so a
 * controller-number target would have nowhere to go, and rather than accept
 * one and silently drop it the two properties that exist are the two offered.
 * This is the same rule `engine/midi/fx/modifier.ts` follows.
 *
 * The LFO advances one step per note-on rather than running on the transport
 * clock: the transform path (`noteOn`/`noteOff`) never receives a beat, so a
 * free-running tempo-synced LFO has nothing to sync to. Each played note
 * therefore samples the next step of the cycle, which is deterministic and
 * testable — the same reason the Arpeggiator's `stepVelocity` is a free
 * function. A transport-synced mode can replace the step counter when the
 * chain passes beats to transforms.
 */

export type ModulatorTarget = 'velocity' | 'noteNumber';
export type ModulatorWaveform = 'sine' | 'triangle' | 'square' | 'saw' | 'random';

export interface ModulatorConfig {
  /** Property the LFO writes. */
  target: ModulatorTarget;
  /** LFO shape over one cycle. */
  waveform: ModulatorWaveform;
  /**
   * Peak deflection. Semitones when the target is the note number, velocity
   * units when it is the velocity.
   */
  depth: number;
  /** Notes per LFO cycle, 2…16. */
  stepsPerCycle: number;
}

export const MODULATOR_DEFAULTS: ModulatorConfig = {
  target: 'velocity',
  waveform: 'sine',
  depth: 10,
  stepsPerCycle: 8,
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * The LFO value at `phase` (0…1) in -1…1.
 *
 * A free function so the editor draws its cycle preview from the rule the
 * processor plays by rather than a second copy of the maths. `random` takes
 * an injectable source so the editor can draw a stable picture.
 */
export function modulatorValue(
  phase: number,
  waveform: ModulatorWaveform,
  random: () => number = Math.random,
): number {
  const p = ((phase % 1) + 1) % 1;
  switch (waveform) {
    case 'sine':
      return Math.sin(p * Math.PI * 2);
    case 'triangle': {
      // +1 at a quarter cycle, -1 at three quarters, zero at the ends.
      const q = (((p - 0.25) % 1) + 1) % 1;
      return 4 * Math.abs(q - 0.5) - 1;
    }
    case 'square':
      return p < 0.5 ? 1 : -1;
    case 'saw':
      return p * 2 - 1;
    case 'random':
      return random() * 2 - 1;
  }
}

export interface ModulatedNote {
  pitch: number;
  velocity: number;
}

export class Modulator {
  private config: ModulatorConfig;
  /** Counts note-ons, advancing the LFO one step each. */
  private stepIndex = 0;
  /** Input pitch → sounded pitch, so a modulated pitch can be released. */
  private sounding = new Map<number, number>();

  constructor(config: Partial<ModulatorConfig> = {}) {
    this.config = { ...MODULATOR_DEFAULTS, ...config };
  }

  setConfig(patch: Partial<ModulatorConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  getConfig(): Readonly<ModulatorConfig> {
    return this.config;
  }

  /** Restart the cycle, for a transport return to the top. */
  reset(): void {
    this.stepIndex = 0;
  }

  noteOn(pitch: number, velocity: number): ModulatedNote[] {
    // A note-on at velocity 0 *is* a note-off; modulating it upward would
    // turn a release into a note that never ends.
    if (velocity <= 0) {
      this.sounding.set(pitch, pitch);
      return [{ pitch, velocity: 0 }];
    }

    const steps = Math.max(2, Math.round(this.config.stepsPerCycle));
    const offset = Math.round(
      modulatorValue(this.stepIndex / steps, this.config.waveform) * this.config.depth,
    );
    this.stepIndex++;

    if (this.config.target === 'noteNumber') {
      const out = clamp(pitch + offset, 0, 127);
      this.sounding.set(pitch, out);
      return [{ pitch: out, velocity }];
    }

    // Velocity 0 is a note-off, so a deflection that reaches zero is floored
    // rather than turning the note into its own release.
    const out = clamp(velocity + offset, 1, 127);
    this.sounding.set(pitch, pitch);
    return [{ pitch, velocity: out }];
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

export function createModulator(config?: Partial<ModulatorConfig>): Modulator {
  return new Modulator(config);
}

export default Modulator;
