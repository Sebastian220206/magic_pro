/**
 * Instrument Factory
 * Creates and manages instrument instances based on preset names
 */

import {
  instrumentRegistry,
  getInstrument,
  type InstrumentDefinition,
} from './instrumentRegistry';
import { PolyphonicSynth } from './synthEngine';
import { Sampler } from './samplerEngine';
import { DrumMachine } from './drumMachine';
import { SoundFontInstrument } from './soundfont/SoundFontInstrument';

export type InstrumentType = 'synth' | 'sampler' | 'drumkit' | 'soundfont';

// Interface for all instrument types
export interface Instrument {
  noteOn(note: number, velocity?: number, time?: number): void;
  noteOff(note: number, time?: number): void;
  allNotesOff(time?: number): void;
  getOutput(): AudioNode;
  setVolume(volume: number): void;
  dispose(): void;
}

/**
 * Factory class for creating instruments
 */
export class InstrumentFactory {
  private ctx: AudioContext;
  private activeInstruments = new Map<string, Instrument>();

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  /**
   * Create an instrument instance
   */
  createInstrument(name: string): Instrument | null {
    const definition = getInstrument(name);
    if (!definition) {
      console.warn(`Unknown instrument: ${name}`);
      return null;
    }

    // Check if we already have an instance
    const existingKey = `${name}_${definition.engine}`;
    if (this.activeInstruments.has(existingKey)) {
      return this.activeInstruments.get(existingKey)!;
    }

    let instrument: Instrument;

    switch (definition.engine) {
      case 'synth':
        instrument = new PolyphonicSynth(this.ctx, definition.preset);
        break;

      case 'sampler':
        instrument = new Sampler(this.ctx, definition.preset);
        // Load samples asynchronously
        (instrument as Sampler).loadSamples().then(() => {
          console.log(`Sampler ${name} loaded`);
        });
        break;

      case 'drumkit':
        instrument = new DrumMachine(this.ctx, definition.preset);
        // Load samples asynchronously
        (instrument as DrumMachine).loadSamples().then(() => {
          console.log(`Drum kit ${name} loaded`);
        });
        break;

      case 'soundfont':
        instrument = new SoundFontInstrument(this.ctx);
        console.log(`SoundFont ${name} created (awaiting font file load)`);
        break;

      default:
        console.warn(`Unknown engine type: ${definition.engine}`);
        return null;
    }

    this.activeInstruments.set(existingKey, instrument);
    return instrument;
  }

  /**
   * Create instrument and connect to audio destination
   */
  createAndConnect(
    name: string,
    destination: AudioNode
  ): Instrument | null {
    const instrument = this.createInstrument(name);
    if (instrument) {
      instrument.getOutput().connect(destination);
    }
    return instrument;
  }

  /**
   * Get instrument definition
   */
  getDefinition(name: string): InstrumentDefinition | undefined {
    return getInstrument(name);
  }

  /**
   * Get engine type for instrument
   */
  getEngineType(name: string): InstrumentType | null {
    const def = getInstrument(name);
    return def?.engine ?? null;
  }

  /**
   * Dispose of a specific instrument
   */
  disposeInstrument(name: string): void {
    const key = `${name}_${getInstrument(name)?.engine}`;
    const instrument = this.activeInstruments.get(key);
    if (instrument) {
      instrument.dispose();
      this.activeInstruments.delete(key);
    }
  }

  /**
   * Dispose all instruments
   */
  disposeAll(): void {
    this.activeInstruments.forEach((instrument) => {
      instrument.dispose();
    });
    this.activeInstruments.clear();
  }

  /**
   * Get list of active instruments
   */
  getActiveInstruments(): string[] {
    return Array.from(this.activeInstruments.keys());
  }
}

/**
 * Singleton factory instance
 */
let globalFactory: InstrumentFactory | null = null;

export function createInstrumentFactory(ctx: AudioContext): InstrumentFactory {
  globalFactory = new InstrumentFactory(ctx);
  return globalFactory;
}

export function getInstrumentFactory(): InstrumentFactory | null {
  return globalFactory;
}

/**
 * Quick factory function for creating a single instrument
 */
export function createInstrument(
  ctx: AudioContext,
  name: string
): Instrument | null {
  const factory = new InstrumentFactory(ctx);
  return factory.createInstrument(name);
}

export default InstrumentFactory;
