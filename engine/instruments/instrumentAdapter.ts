/**
 * Instrument Adapter for MIDI Scheduler
 * Wraps instrument engines to match the MidiInstrument interface
 */

import { Instrument } from './instrumentFactory';

export interface MidiInstrument {
  trigger(pitch: number, time: number, duration: number, velocity: number): void;
  release(pitch: number): void;
}

/**
 * Adapter class that wraps our instrument engines to work with the MIDI scheduler
 */
export class InstrumentAdapter implements MidiInstrument {
  private instrument: Instrument;
  private activeNotes = new Map<number, number>(); // pitch -> timeoutId

  constructor(instrument: Instrument) {
    this.instrument = instrument;
  }

  /**
   * Trigger a note (called by MIDI scheduler)
   */
  trigger(pitch: number, time: number, duration: number, velocity: number): void {
    // Velocity range 0-300 (extended beyond standard MIDI 127 for boost)
    const vel = Math.max(0, velocity);

    // Note on at the specified time
    this.instrument.noteOn(pitch, vel, time);

    // Clear any existing timeout for this pitch
    const existingTimeout = this.activeNotes.get(pitch);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule note off after duration
    const durationMs = duration * 1000;
    const timeoutId = window.setTimeout(() => {
      this.instrument.noteOff(pitch, time + duration);
      this.activeNotes.delete(pitch);
    }, durationMs);

    this.activeNotes.set(pitch, timeoutId);
  }

  /**
   * Release a note immediately
   */
  release(pitch: number): void {
    // Clear the scheduled note-off
    const timeoutId = this.activeNotes.get(pitch);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.activeNotes.delete(pitch);
    }

    // Send note off immediately
    this.instrument.noteOff(pitch);
  }

  /**
   * Get the underlying instrument
   */
  getInstrument(): Instrument {
    return this.instrument;
  }

  /**
   * Dispose the adapter and instrument
   */
  dispose(): void {
    // Clear all pending timeouts
    this.activeNotes.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    this.activeNotes.clear();

    // Dispose the instrument
    this.instrument.dispose();
  }
}

/**
 * Create an adapter for an instrument
 */
export function createInstrumentAdapter(instrument: Instrument): InstrumentAdapter {
  return new InstrumentAdapter(instrument);
}

export default InstrumentAdapter;
