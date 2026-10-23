/**
 * Note Repeater — repeat a held note at a musical rate.
 *
 * A generator like the Arpeggiator: `noteOn` swallows the note and the
 * repeats come out of `processStep(beat)`, driven by the scheduler's
 * `transportTick` via `engine/midi/fx/chain.ts`. The downbeat is therefore
 * silent until the first tick, exactly as the Arpeggiator's first step is —
 * one rule for both generators rather than a special case each.
 *
 * `repetitions` of 0 means "while held"; otherwise the repeater stops after
 * that many repeats but keeps holding the key, so releasing it still releases
 * the last repeat rather than leaving it ringing. `velocityRamp` is added per
 * repeat — negative decays like a played tremolo picking, positive builds.
 */

export type RepeatRate = '1/4' | '1/8' | '1/8T' | '1/16' | '1/16T' | '1/32';

export interface NoteRepeaterConfig {
  rate: RepeatRate;
  /** Repeats before stopping, 0…32. 0 repeats while the key is held. */
  repetitions: number;
  /** Velocity added per repeat, -24…24. */
  velocityRamp: number;
}

export const NOTE_REPEATER_DEFAULTS: NoteRepeaterConfig = {
  rate: '1/16',
  repetitions: 0,
  velocityRamp: -3,
};

export const REPEAT_BEATS: Record<RepeatRate, number> = {
  '1/4': 1,
  '1/8': 0.5,
  '1/8T': 0.333333,
  '1/16': 0.25,
  '1/16T': 0.166667,
  '1/32': 0.125,
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * The velocity of the n-th repeat (0-based) from the struck velocity.
 *
 * Exported so the editor's preview row reads from the rule the processor
 * plays by rather than a second copy of the arithmetic.
 */
export function repeatVelocity(base: number, repeat: number, config: NoteRepeaterConfig): number {
  if (base <= 0) return 0;
  return clamp(Math.round(base + repeat * config.velocityRamp), 1, 127);
}

export type RepeatEvent =
  | { type: 'note-on'; pitch: number; velocity: number; duration: number }
  | { type: 'note-off'; pitch: number; velocity: number };

interface HeldNote {
  pitch: number;
  velocity: number;
}

export class NoteRepeater {
  private config: NoteRepeaterConfig;
  private held: HeldNote | null = null;
  /** Pitches currently sounding, so release and `getState` can find them. */
  private activeNotes = new Set<number>();
  private repeatCount = 0;
  private lastStepBeat = 0;
  private finished = false;
  private isPlaying = false;

  constructor(config: Partial<NoteRepeaterConfig> = {}) {
    this.config = { ...NOTE_REPEATER_DEFAULTS, ...config };
  }

  setConfig(patch: Partial<NoteRepeaterConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  getConfig(): Readonly<NoteRepeaterConfig> {
    return this.config;
  }

  getState(): { activeNotes: Set<number>; isPlaying: boolean } {
    return { activeNotes: this.activeNotes, isPlaying: this.isPlaying };
  }

  serialize(): NoteRepeaterConfig {
    return { ...this.config };
  }

  deserialize(config: Partial<NoteRepeaterConfig>): void {
    Object.assign(this.config, config);
  }

  noteOn(pitch: number, velocity: number = 100): void {
    // Re-striking a held key restarts the count rather than layering a
    // second stream of repeats on top of the first.
    this.held = { pitch, velocity };
    this.repeatCount = 0;
    this.finished = false;
  }

  noteOff(pitch: number): void {
    if (this.held && this.held.pitch === pitch) this.held = null;
    if (this.activeNotes.has(pitch)) this.activeNotes.delete(pitch);
  }

  allNotesOff(): void {
    this.held = null;
    this.activeNotes.clear();
    this.repeatCount = 0;
    this.finished = false;
  }

  start(): void {
    this.isPlaying = true;
    this.repeatCount = 0;
    this.lastStepBeat = 0;
    this.finished = false;
  }

  stop(): void {
    this.isPlaying = false;
    this.allNotesOff();
  }

  reset(): void {
    this.repeatCount = 0;
    this.lastStepBeat = 0;
    this.finished = false;
    this.activeNotes.clear();
  }

  processStep(currentBeat: number): RepeatEvent[] {
    const events: RepeatEvent[] = [];
    if (!this.isPlaying || !this.held || this.finished) return events;

    const rateBeats = REPEAT_BEATS[this.config.rate] ?? 0.25;
    if (currentBeat - this.lastStepBeat < rateBeats) return events;
    this.lastStepBeat = currentBeat;

    const { pitch, velocity } = this.held;
    const out = repeatVelocity(velocity, this.repeatCount, this.config);

    for (const prev of this.activeNotes) {
      events.push({ type: 'note-off', pitch: prev, velocity: 0 });
    }
    this.activeNotes.clear();

    events.push({ type: 'note-on', pitch, velocity: out, duration: rateBeats });
    this.activeNotes.add(pitch);
    this.repeatCount++;

    const total = Math.max(0, Math.round(this.config.repetitions));
    if (total > 0 && this.repeatCount >= total) this.finished = true;

    return events;
  }
}

export function createNoteRepeater(config?: Partial<NoteRepeaterConfig>): NoteRepeater {
  return new NoteRepeater(config);
}

export default NoteRepeater;
