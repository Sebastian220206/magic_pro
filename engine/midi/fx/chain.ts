/**
 * The MIDI FX slot's live processor, one per track.
 *
 * `store/projectStore.ts` special-cased the Chord Trigger: it built one, called
 * `noteOn`, and every other effect in `engine/midi/fx` stayed unreachable. This
 * is the general form — the store asks for notes and gets notes back, without
 * knowing which effect produced them.
 *
 * Two kinds of effect live behind one interface:
 *
 *   - **Transforms** rewrite the note you played and hand it straight back.
 *     Chord Trigger, Modifier, Modulator, Randomizer, Transposer, Velocity
 *     Processor.
 *   - **Generators** swallow the note and emit their own on the transport's
 *     clock. The Arpeggiator and the Note Repeater, today.
 *
 * `noteOn()` returning an empty array is therefore not a failure; it means a
 * generator took the note and will sound it from `tick()`. The store must not
 * treat that as "play nothing" and fall back to the raw pitch, which is why it
 * is stated here rather than left to be inferred.
 *
 * Processors carry sounding-voice state, so they are held outside the store —
 * the same reason `midiFxProcessors` was held outside it before.
 */

import { createArpeggiator, type Arpeggiator } from './arpeggiator';
import { createChordTrigger, type ChordTrigger } from './chordTrigger';
import { createModifier, type Modifier } from './modifier';
import { createModulator, type Modulator } from './modulator';
import { createNoteRepeater, type NoteRepeater } from './noteRepeater';
import { createRandomizer, type Randomizer } from './randomizer';
import { createScripter, type Scripter } from './scripter';
import { createTransposer, type Transposer } from './transposer';
import { createVelocityProcessor, type VelocityProcessor } from './velocityProcessor';
import {
  settingsFor, toArpeggiatorConfig, toChordTriggerConfig, toModifierConfig,
  toModulatorConfig, toNoteRepeaterConfig,
  toRandomizerConfig, toScripterConfig, toTransposerConfig, toVelocityConfig,
  type MidiFxSettingsMap,
} from '@/lib/midiFxSettings';
import type { MidiFxId } from '@/lib/midiFxCatalog';

export interface MidiFxNote {
  pitch: number;
  velocity: number;
}

/** Where a generator's notes go, since they arrive between key presses. */
export interface MidiFxSink {
  noteOn(trackId: string, pitch: number, velocity: number): void;
  noteOff(trackId: string, pitch: number): void;
}

type Processor =
  | { kind: 'arpeggiator'; id: 'arpeggiator'; impl: Arpeggiator }
  | { kind: 'repeater'; id: 'noteRepeater'; impl: NoteRepeater }
  | { kind: 'transform'; id: 'chordTrigger'; impl: ChordTrigger }
  | { kind: 'transform'; id: 'modifier'; impl: Modifier }
  | { kind: 'transform'; id: 'modulator'; impl: Modulator }
  | { kind: 'transform'; id: 'randomizer'; impl: Randomizer }
  | { kind: 'transform'; id: 'transposer'; impl: Transposer }
  | { kind: 'transform'; id: 'velocityProcessor'; impl: VelocityProcessor }
  // The Scripter answers in events rather than notes and keeps no record of
  // what it sounded, so the pitches it produced are tracked here. Without it a
  // script that transposes releases the key you pressed and leaves its own
  // note ringing.
  | { kind: 'transform'; id: 'scripter'; impl: Scripter; sounding: Map<number, number[]> };

interface Entry {
  processor: Processor;
  /** The settings the processor was last configured with, to skip no-op writes. */
  applied: string;
}

/** Effects this chain can build. Every catalogue entry has a processor. */
export function hasProcessor(id: string | null | undefined): id is MidiFxId {
  return id === 'arpeggiator' || id === 'chordTrigger' || id === 'modifier'
    || id === 'modulator' || id === 'noteRepeater'
    || id === 'randomizer' || id === 'transposer' || id === 'velocityProcessor'
    || id === 'scripter';
}

/** The two processors that sound their own notes on `tick` rather than answering. */
type GeneratorProcessor =
  | { kind: 'arpeggiator'; id: 'arpeggiator'; impl: Arpeggiator }
  | { kind: 'repeater'; id: 'noteRepeater'; impl: NoteRepeater };

/** True when the processor sounds its own notes on `tick` rather than answering. */
function isGenerator(p: Processor): p is GeneratorProcessor {
  return p.kind === 'arpeggiator' || p.kind === 'repeater';
}

function build(id: MidiFxId): Processor | null {
  switch (id) {
    case 'arpeggiator': return { kind: 'arpeggiator', id, impl: createArpeggiator() };
    case 'noteRepeater': return { kind: 'repeater', id, impl: createNoteRepeater() };
    case 'chordTrigger': return { kind: 'transform', id, impl: createChordTrigger() };
    case 'modifier': return { kind: 'transform', id, impl: createModifier() };
    case 'modulator': return { kind: 'transform', id, impl: createModulator() };
    case 'randomizer': return { kind: 'transform', id, impl: createRandomizer() };
    case 'transposer': return { kind: 'transform', id, impl: createTransposer() };
    case 'velocityProcessor': return { kind: 'transform', id, impl: createVelocityProcessor() };
    case 'scripter': return { kind: 'transform', id, impl: createScripter({ autoRun: false }), sounding: new Map() };
    default: return null;
  }
}

function apply(processor: Processor, settings: MidiFxSettingsMap | undefined): void {
  switch (processor.id) {
    case 'arpeggiator':
      processor.impl.deserialize(toArpeggiatorConfig(settingsFor(settings, 'arpeggiator')));
      break;
    case 'chordTrigger':
      // `deserialize` rather than the individual setters: there is no
      // `setTriggerMode`, so a field-by-field write would silently leave
      // Single/Multi at whatever it was built with.
      processor.impl.deserialize(toChordTriggerConfig(settingsFor(settings, 'chordTrigger')));
      break;
    case 'modifier':
      processor.impl.setConfig(toModifierConfig(settingsFor(settings, 'modifier')));
      break;
    case 'modulator':
      processor.impl.setConfig(toModulatorConfig(settingsFor(settings, 'modulator')));
      break;
    case 'noteRepeater':
      processor.impl.deserialize(toNoteRepeaterConfig(settingsFor(settings, 'noteRepeater')));
      break;
    case 'randomizer':
      processor.impl.setConfig(toRandomizerConfig(settingsFor(settings, 'randomizer')));
      break;
    case 'transposer':
      processor.impl.setConfig(toTransposerConfig(settingsFor(settings, 'transposer')));
      break;
    case 'velocityProcessor':
      processor.impl.setConfig(toVelocityConfig(settingsFor(settings, 'velocityProcessor')));
      break;
    case 'scripter': {
      const config = toScripterConfig(settingsFor(settings, 'scripter'));
      processor.impl.setEnabled(config.enabled);
      if (config.script) {
        processor.impl.setScript(config.script);
        // The editor only writes a script that already compiled, so a failure
        // here means a project saved by an older build. Leaving it uncompiled
        // makes every note a no-op rather than a throw.
        processor.impl.compile();
      }
      break;
    }
  }
}

export interface MidiFxTrack {
  id: string;
  midiFx?: string | null;
  midiFxSettings?: MidiFxSettingsMap;
}

class MidiFxChain {
  private entries = new Map<string, Entry>();
  private sink: MidiFxSink | null = null;
  /** Tracks with a generator, so `tick` does not walk every track. */
  private generators = new Set<string>();

  setSink(sink: MidiFxSink | null): void {
    this.sink = sink;
  }

  /**
   * The processor for a track, built or reconfigured as needed.
   *
   * Returns null when the slot is empty or holds an effect with no processor,
   * and drops any processor the track used to have — otherwise removing an
   * effect would leave its voices sounding.
   */
  private entryFor(track: MidiFxTrack | undefined): Entry | null {
    if (!track) return null;

    const id = track.midiFx;
    if (!hasProcessor(id)) {
      this.release(track.id);
      return null;
    }

    let entry = this.entries.get(track.id);
    if (!entry || entry.processor.id !== id) {
      const processor = build(id);
      if (!processor) return null;
      this.release(track.id);
      entry = { processor, applied: '' };
      this.entries.set(track.id, entry);
      if (isGenerator(processor)) this.generators.add(track.id);
    }

    // Settings are written through on every lookup rather than on change,
    // because the store hands over a fresh object each render and there is no
    // change event to subscribe to. Comparing the serialised form keeps that
    // to a string compare in the common case where nothing moved.
    const stamp = JSON.stringify(track.midiFxSettings?.[id] ?? {});
    if (stamp !== entry.applied) {
      apply(entry.processor, track.midiFxSettings);
      entry.applied = stamp;
    }
    return entry;
  }

  /**
   * Notes to sound for a key press.
   *
   * An empty array means a generator took the note — see the note at the top
   * of this file. A track with no effect returns the note unchanged, so the
   * caller has one code path rather than a null check.
   */
  noteOn(track: MidiFxTrack | undefined, pitch: number, velocity: number): MidiFxNote[] {
    const entry = this.entryFor(track);
    if (!entry) return [{ pitch, velocity }];

    if (isGenerator(entry.processor)) {
      entry.processor.impl.noteOn(pitch, velocity);
      if (!entry.processor.impl.getState().isPlaying) {
        entry.processor.impl.start();
      }
      return [];
    }

    if (entry.processor.id === 'chordTrigger') {
      return entry.processor.impl.noteOn(pitch, velocity)
        .filter(e => e.type === 'note-on')
        .map(e => ({ pitch: e.pitch, velocity: e.velocity }));
    }

    if (entry.processor.id === 'scripter') {
      const { impl, sounding } = entry.processor;
      // A bypassed script passes the note through rather than swallowing it;
      // `processEvent` returns nothing when disabled, which would be silence.
      if (!impl.isEnabled()) return [{ pitch, velocity }];

      const notes = impl.processEvent({ type: 'noteOn', pitch, velocity, beat: 0 })
        .filter(e => e.type === 'note-on')
        .map(e => ({ pitch: e.pitch, velocity: e.velocity }));
      sounding.set(pitch, notes.map(n => n.pitch));
      return notes;
    }

    return entry.processor.impl.noteOn(pitch, velocity);
  }

  /** Pitches to release for a key lift. */
  noteOff(track: MidiFxTrack | undefined, pitch: number): number[] {
    const entry = this.entryFor(track);
    if (!entry) return [pitch];

    if (isGenerator(entry.processor)) {
      const prevActive = new Set(entry.processor.impl.getState().activeNotes);
      entry.processor.impl.noteOff(pitch);
      const curActive = entry.processor.impl.getState().activeNotes;
      const released: number[] = [];
      for (const p of prevActive) {
        if (!curActive.has(p)) {
          released.push(p);
          if (this.sink && track) {
            this.sink.noteOff(track.id, p);
          }
        }
      }
      return released;
    }

    if (entry.processor.id === 'chordTrigger') {
      return entry.processor.impl.noteOff(pitch)
        .filter(e => e.type === 'note-off')
        .map(e => e.pitch);
    }

    if (entry.processor.id === 'scripter') {
      const { impl, sounding } = entry.processor;
      if (!impl.isEnabled()) return [pitch];

      const sounded = sounding.get(pitch);
      sounding.delete(pitch);
      // The script still gets told the key lifted, so a handler that ends a
      // phrase on release runs; what it returns is added to the release.
      const fromScript = impl.processEvent({ type: 'noteOff', pitch, beat: 0 })
        .filter(e => e.type === 'note-off')
        .map(e => e.pitch);
      return Array.from(new Set([...(sounded ?? []), ...fromScript]));
    }

    return entry.processor.impl.noteOff(pitch);
  }

  /**
   * Advance every generator to `beat`.
   *
   * Driven by the scheduler's `transportTick`, which already fires every 25 ms
   * off the AudioContext clock. Nothing in the transport had to change to
   * reach this — the event was being emitted and only the UI listened.
   */
  tick(beat: number): void {
    if (this.generators.size === 0 || !this.sink) return;

    for (const trackId of Array.from(this.generators)) {
      const entry = this.entries.get(trackId);
      if (!entry || !isGenerator(entry.processor)) {
        this.generators.delete(trackId);
        continue;
      }

      for (const event of entry.processor.impl.processStep(beat)) {
        if (event.type === 'note-on') {
          this.sink.noteOn(trackId, event.pitch, event.velocity);
        } else {
          this.sink.noteOff(trackId, event.pitch);
        }
      }
    }
  }

  /** Silence and forget a track's processor. */
  release(trackId: string): void {
    const entry = this.entries.get(trackId);
    if (entry && this.sink) {
      // The Chord Trigger reports its held voices as events; the rest report
      // bare pitches. Normalising here keeps the sink's interface to one shape.
      const pitches = isGenerator(entry.processor)
        ? Array.from(entry.processor.impl.getState().activeNotes)
        : entry.processor.id === 'chordTrigger'
          ? entry.processor.impl.allNotesOff()
            .filter(e => e.type === 'note-off')
            .map(e => e.pitch)
          : entry.processor.id === 'scripter'
            ? Array.from(entry.processor.sounding.values()).flat()
            : entry.processor.impl.allNotesOff();
      for (const pitch of pitches) this.sink.noteOff(trackId, pitch);
    }
    if (entry && isGenerator(entry.processor)) entry.processor.impl.stop();
    this.entries.delete(trackId);
    this.generators.delete(trackId);
  }

  /** Stop every generator, for a transport stop. */
  stopAll(): void {
    for (const trackId of Array.from(this.generators)) {
      const entry = this.entries.get(trackId);
      if (!entry || !isGenerator(entry.processor)) continue;
      if (this.sink) {
        for (const pitch of Array.from(entry.processor.impl.getState().activeNotes)) {
          this.sink.noteOff(trackId, pitch);
        }
      }
      entry.processor.impl.stop();
      entry.processor.impl.reset();
    }
  }
}

export const midiFxChain = new MidiFxChain();
