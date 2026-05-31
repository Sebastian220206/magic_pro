/**
 * Instruments Engine - Main Export
 * Central export point for the instrument system
 */

// Core instrument engines
export { PolyphonicSynth, type SynthPreset, type ADSREnvelope } from './synthEngine';
export { Sampler, type SampleZone, type SampleMap } from './samplerEngine';
export { DrumMachine, type DrumPad, type DrumKit } from './drumMachine';

// Factory and registry
export {
  InstrumentFactory,
  createInstrument,
  createInstrumentFactory,
  getInstrumentFactory,
  type Instrument,
  type InstrumentType,
} from './instrumentFactory';

export {
  instrumentRegistry,
  getInstrument,
  getInstrumentsByCategory,
  getAllInstrumentNames,
  getAllCategories,
  hasInstrument,
  type InstrumentDefinition,
  type InstrumentEngine,
} from './instrumentRegistry';

// MIDI integration
export {
  MidiInstrumentRouter,
  createMidiRouter,
  getMidiRouter,
  type TrackInstrument,
} from './midiIntegration';

// Sound library
export {
  extendedSynthPresets,
  samplerInstruments,
  drumKitInstruments,
  soundLibraryCategories,
  getSoundInfo,
  getSoundsByCategory,
  getAllSounds,
  type SoundInfo,
} from '../soundLibrary/instruments';

// Instrument adapter for MIDI integration
export {
  InstrumentAdapter,
  createInstrumentAdapter,
  type MidiInstrument,
} from './instrumentAdapter';

// Instrument service
export {
  InstrumentService,
  getInstrumentService,
  createInstrumentService,
} from './instrumentService';

// Default factory function for quick instrument creation
export { createInstrument as default } from './instrumentFactory';
