/**
 * Settings for the MIDI FX slot, and how they are stored on a track.
 *
 * `track.midiFx` held an effect id and nothing else, so every processor was
 * built with its defaults and there was no way to change one — the Chord
 * Trigger sounded a major triad and always would. Settings live here, keyed by
 * effect id, so switching the slot to another effect and back returns to the
 * settings that effect had rather than resetting it.
 *
 * Stored as plain records of primitives rather than the processors' own config
 * objects: this goes through the project serialiser and IndexedDB, and a shape
 * that survives `JSON.parse` without a revive step is one fewer thing to keep
 * in step with the engine. The typed readers below are the only place that
 * conversion happens.
 */

import {
  type ArpPattern, type ArpRate, type VelocityPattern, type ArpeggiatorConfig,
} from '@/engine/midi/fx/arpeggiator';
import {
  type ChordType, type VoicingType, type ChordTriggerConfig,
} from '@/engine/midi/fx/chordTrigger';
import {
  MODIFIER_DEFAULTS, type ModifierConfig, type ModifierProperty,
} from '@/engine/midi/fx/modifier';
import {
  MODULATOR_DEFAULTS, type ModulatorConfig, type ModulatorTarget, type ModulatorWaveform,
} from '@/engine/midi/fx/modulator';
import {
  NOTE_REPEATER_DEFAULTS, type NoteRepeaterConfig, type RepeatRate,
} from '@/engine/midi/fx/noteRepeater';
import {
  RANDOMIZER_DEFAULTS, type RandomizerConfig, type RandomizerTarget,
} from '@/engine/midi/fx/randomizer';
import {
  TRANSPOSER_DEFAULTS, type TransposerConfig, type ScaleName,
} from '@/engine/midi/fx/transposer';
import {
  VELOCITY_DEFAULTS, type VelocityProcessorConfig, type VelocityMode,
} from '@/engine/midi/fx/velocityProcessor';
import type { MidiFxId } from './midiFxCatalog';

/** One effect's settings, as stored. */
export type MidiFxSettings = Record<string, number | string | boolean>;

/** Every effect's settings for one track, keyed by effect id. */
export type MidiFxSettingsMap = Partial<Record<MidiFxId, MidiFxSettings>>;

// ─── Defaults ────────────────────────────────────────────────────────────────

/**
 * Opening state for each effect.
 *
 * These mirror the `*_DEFAULTS` in `engine/midi/fx/`; the consistency test
 * asserts they stay in step, so a default changed in the engine cannot leave a
 * stale copy here.
 */
export const MIDI_FX_DEFAULTS: Record<MidiFxId, MidiFxSettings> = {
  arpeggiator: {
    pattern: 'up',
    rate: '1/16',
    octaveRange: 1,
    swing: 0,
    gate: 0.8,
    velocityPattern: 'none',
    velocityAmount: 0.5,
    latch: false,
    sync: true,
    variation: 1,
  },
  chordTrigger: {
    chordType: 'major',
    inversion: 0,
    transpose: 0,
    voicing: 'close',
    octaveRange: 1,
    velocityScale: 1,
    triggerMode: 'single',
  },
  modifier: { ...MODIFIER_DEFAULTS },
  modulator: { ...MODULATOR_DEFAULTS },
  noteRepeater: { ...NOTE_REPEATER_DEFAULTS },
  randomizer: { ...RANDOMIZER_DEFAULTS },
  transposer: { ...TRANSPOSER_DEFAULTS },
  velocityProcessor: { ...VELOCITY_DEFAULTS },
  scripter: {
    script: '',
    enabled: true,
    preset: 'passthrough',
  },
};

/** Settings for one effect on one track, falling back to its defaults. */
export function settingsFor(map: MidiFxSettingsMap | undefined, id: MidiFxId): MidiFxSettings {
  return { ...MIDI_FX_DEFAULTS[id], ...(map?.[id] ?? {}) };
}

// ─── Typed readers ───────────────────────────────────────────────────────────
//
// Each takes the stored record and produces the config its processor expects.
// Every field is validated against the stored value's type rather than cast,
// because a project written by an older build can be missing fields or hold a
// value the engine no longer accepts.

const num = (s: MidiFxSettings, key: string, fallback: number): number =>
  typeof s[key] === 'number' && Number.isFinite(s[key]) ? (s[key] as number) : fallback;

const bool = (s: MidiFxSettings, key: string, fallback: boolean): boolean =>
  typeof s[key] === 'boolean' ? (s[key] as boolean) : fallback;

const pick = <T extends string>(
  s: MidiFxSettings, key: string, allowed: readonly T[], fallback: T,
): T => (allowed as readonly string[]).includes(s[key] as string) ? (s[key] as T) : fallback;

export const ARP_PATTERNS: readonly ArpPattern[] = ['up', 'down', 'upDown', 'random', 'chord', 'order'];
export const ARP_RATES: readonly ArpRate[] = ['1/4', '1/8', '1/8T', '1/16', '1/16T', '1/32'];
export const ARP_VELOCITY_PATTERNS: readonly VelocityPattern[] = ['none', 'accent', 'crescendo', 'diminuendo', 'random'];

export function toArpeggiatorConfig(s: MidiFxSettings): ArpeggiatorConfig {
  return {
    pattern: pick(s, 'pattern', ARP_PATTERNS, 'up'),
    rate: pick(s, 'rate', ARP_RATES, '1/16'),
    octaveRange: Math.round(num(s, 'octaveRange', 1)),
    swing: num(s, 'swing', 0),
    gate: num(s, 'gate', 0.8),
    velocityPattern: pick(s, 'velocityPattern', ARP_VELOCITY_PATTERNS, 'none'),
    velocityAmount: num(s, 'velocityAmount', 0.5),
    latch: bool(s, 'latch', false),
    sync: bool(s, 'sync', true),
  };
}

export const CHORD_TYPES: readonly ChordType[] = [
  'major', 'minor', 'diminished', 'augmented', 'major7', 'minor7', 'dominant7',
  'diminished7', 'halfDiminished', 'sus2', 'sus4', 'add9', 'major9', 'minor9',
  'power', 'custom',
];
export const VOICINGS: readonly VoicingType[] = ['close', 'spread', 'octave-doubling', 'drop2', 'drop3'];

export function toChordTriggerConfig(s: MidiFxSettings): ChordTriggerConfig {
  return {
    chordType: pick(s, 'chordType', CHORD_TYPES, 'major'),
    inversion: Math.round(num(s, 'inversion', 0)),
    transpose: Math.round(num(s, 'transpose', 0)),
    voicing: pick(s, 'voicing', VOICINGS, 'close'),
    octaveRange: Math.round(num(s, 'octaveRange', 1)),
    velocityScale: num(s, 'velocityScale', 1),
    triggerMode: pick(s, 'triggerMode', ['single', 'multi'] as const, 'single'),
  };
}

const MODIFIER_PROPERTIES: readonly ModifierProperty[] = ['noteNumber', 'velocity'];

export function toModifierConfig(s: MidiFxSettings): ModifierConfig {
  return {
    source: pick(s, 'source', MODIFIER_PROPERTIES, MODIFIER_DEFAULTS.source),
    target: pick(s, 'target', MODIFIER_PROPERTIES, MODIFIER_DEFAULTS.target),
    scale: num(s, 'scale', MODIFIER_DEFAULTS.scale),
    add: num(s, 'add', MODIFIER_DEFAULTS.add),
    thru: bool(s, 'thru', MODIFIER_DEFAULTS.thru),
  };
}

const RANDOMIZER_TARGETS: readonly RandomizerTarget[] = ['velocity', 'noteNumber'];

const MODULATOR_TARGETS: readonly ModulatorTarget[] = ['velocity', 'noteNumber'];
const MODULATOR_WAVEFORMS: readonly ModulatorWaveform[] = ['sine', 'triangle', 'square', 'saw', 'random'];

export function toModulatorConfig(s: MidiFxSettings): ModulatorConfig {
  return {
    target: pick(s, 'target', MODULATOR_TARGETS, MODULATOR_DEFAULTS.target),
    waveform: pick(s, 'waveform', MODULATOR_WAVEFORMS, MODULATOR_DEFAULTS.waveform),
    depth: num(s, 'depth', MODULATOR_DEFAULTS.depth),
    stepsPerCycle: Math.round(num(s, 'stepsPerCycle', MODULATOR_DEFAULTS.stepsPerCycle)),
  };
}

export const REPEAT_RATES: readonly RepeatRate[] = ['1/4', '1/8', '1/8T', '1/16', '1/16T', '1/32'];

export function toNoteRepeaterConfig(s: MidiFxSettings): NoteRepeaterConfig {
  return {
    rate: pick(s, 'rate', REPEAT_RATES, NOTE_REPEATER_DEFAULTS.rate),
    repetitions: Math.round(num(s, 'repetitions', NOTE_REPEATER_DEFAULTS.repetitions)),
    velocityRamp: num(s, 'velocityRamp', NOTE_REPEATER_DEFAULTS.velocityRamp),
  };
}

export function toRandomizerConfig(s: MidiFxSettings): RandomizerConfig {
  return {
    target: pick(s, 'target', RANDOMIZER_TARGETS, RANDOMIZER_DEFAULTS.target),
    inputLow: Math.round(num(s, 'inputLow', RANDOMIZER_DEFAULTS.inputLow)),
    inputHigh: Math.round(num(s, 'inputHigh', RANDOMIZER_DEFAULTS.inputHigh)),
    amount: num(s, 'amount', RANDOMIZER_DEFAULTS.amount),
    weight: num(s, 'weight', RANDOMIZER_DEFAULTS.weight),
    offset: num(s, 'offset', RANDOMIZER_DEFAULTS.offset),
  };
}

export const SCALE_NAMES: readonly ScaleName[] = [
  'chromatic', 'major', 'naturalMinor', 'harmonicMinor', 'melodicMinor',
  'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian',
  'majorPentatonic', 'minorPentatonic', 'blues', 'wholeTone',
];

export function toTransposerConfig(s: MidiFxSettings): TransposerConfig {
  return {
    transpose: Math.round(num(s, 'transpose', TRANSPOSER_DEFAULTS.transpose)),
    root: Math.round(num(s, 'root', TRANSPOSER_DEFAULTS.root)),
    scale: pick(s, 'scale', SCALE_NAMES, TRANSPOSER_DEFAULTS.scale),
  };
}

export const VELOCITY_MODES: readonly VelocityMode[] = ['value', 'compand', 'random'];

export function toVelocityConfig(s: MidiFxSettings): VelocityProcessorConfig {
  return {
    mode: pick(s, 'mode', VELOCITY_MODES, VELOCITY_DEFAULTS.mode),
    scale: num(s, 'scale', VELOCITY_DEFAULTS.scale),
    add: num(s, 'add', VELOCITY_DEFAULTS.add),
    compand: num(s, 'compand', VELOCITY_DEFAULTS.compand),
    pivot: num(s, 'pivot', VELOCITY_DEFAULTS.pivot),
    gain: num(s, 'gain', VELOCITY_DEFAULTS.gain),
    random: num(s, 'random', VELOCITY_DEFAULTS.random),
    rangeMin: Math.round(num(s, 'rangeMin', VELOCITY_DEFAULTS.rangeMin)),
    rangeMax: Math.round(num(s, 'rangeMax', VELOCITY_DEFAULTS.rangeMax)),
  };
}

export function toScripterConfig(s: MidiFxSettings): { script: string; enabled: boolean } {
  return {
    script: typeof s.script === 'string' ? s.script : '',
    enabled: bool(s, 'enabled', true),
  };
}
