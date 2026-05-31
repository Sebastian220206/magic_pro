/**
 * MIDI Instrument Integration
 * Connects MIDI events to instruments
 */

import {
  Instrument,
  createInstrumentFactory,
  getInstrumentFactory,
} from './instrumentFactory';

export interface TrackInstrument {
  trackId: string;
  instrumentName: string;
  instrument: Instrument | null;
  volume: number;
  pan: number;
  isMuted: boolean;
  isSolo: boolean;
}

/**
 * MIDI to Instrument Router
 * Handles routing MIDI notes from tracks to their assigned instruments
 */
export class MidiInstrumentRouter {
  private ctx: AudioContext;
  private trackInstruments = new Map<string, TrackInstrument>();
  private destination: AudioNode;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.destination = destination;

    // Ensure factory exists
    if (!getInstrumentFactory()) {
      createInstrumentFactory(ctx);
    }
  }

  /**
   * Assign an instrument to a track
   */
  assignInstrument(trackId: string, instrumentName: string): TrackInstrument | null {
    // Remove existing instrument if any
    this.removeInstrument(trackId);

    const factory = getInstrumentFactory();
    if (!factory) {
      console.warn('Instrument factory not initialized');
      return null;
    }

    // Create and connect instrument
    const instrument = factory.createAndConnect(instrumentName, this.destination);
    if (!instrument) {
      console.warn(`Failed to create instrument: ${instrumentName}`);
      return null;
    }

    const trackInst: TrackInstrument = {
      trackId,
      instrumentName,
      instrument,
      volume: 0.8,
      pan: 0,
      isMuted: false,
      isSolo: false,
    };

    this.trackInstruments.set(trackId, trackInst);
    console.log(`Assigned ${instrumentName} to track ${trackId}`);

    return trackInst;
  }

  /**
   * Remove instrument from track
   */
  removeInstrument(trackId: string): void {
    const trackInst = this.trackInstruments.get(trackId);
    if (trackInst?.instrument) {
      trackInst.instrument.dispose();
      this.trackInstruments.delete(trackId);
    }
  }

  /**
   * Get instrument for track
   */
  getInstrument(trackId: string): TrackInstrument | undefined {
    return this.trackInstruments.get(trackId);
  }

  /**
   * Handle note on MIDI event
   */
  noteOn(trackId: string, note: number, velocity = 100, time?: number): void {
    const trackInst = this.trackInstruments.get(trackId);
    if (!trackInst?.instrument || trackInst.isMuted) return;

    const effectiveVelocity = trackInst.isMuted ? 0 : velocity;
    trackInst.instrument.noteOn(note, effectiveVelocity, time);
  }

  /**
   * Handle note off MIDI event
   */
  noteOff(trackId: string, note: number, time?: number): void {
    const trackInst = this.trackInstruments.get(trackId);
    if (!trackInst?.instrument) return;

    trackInst.instrument.noteOff(note, time);
  }

  /**
   * Stop all notes on a track
   */
  allNotesOff(trackId: string, time?: number): void {
    const trackInst = this.trackInstruments.get(trackId);
    if (trackInst?.instrument) {
      trackInst.instrument.allNotesOff(time);
    }
  }

  /**
   * Stop all notes on all tracks
   */
  allNotesOffAll(time?: number): void {
    this.trackInstruments.forEach((trackInst) => {
      if (trackInst.instrument) {
        trackInst.instrument.allNotesOff(time);
      }
    });
  }

  /**
   * Set track volume
   */
  setTrackVolume(trackId: string, volume: number): void {
    const trackInst = this.trackInstruments.get(trackId);
    if (trackInst?.instrument) {
      trackInst.volume = Math.max(0, Math.min(1, volume));
      trackInst.instrument.setVolume(trackInst.volume);
    }
  }

  /**
   * Mute/unmute track
   */
  setTrackMute(trackId: string, muted: boolean): void {
    const trackInst = this.trackInstruments.get(trackId);
    if (trackInst) {
      trackInst.isMuted = muted;
    }
  }

  /**
   * Solo/unsolo track
   */
  setTrackSolo(trackId: string, solo: boolean): void {
    const trackInst = this.trackInstruments.get(trackId);
    if (trackInst) {
      trackInst.isSolo = solo;
    }
  }

  /**
   * Get all assigned instruments
   */
  getAllInstruments(): TrackInstrument[] {
    return Array.from(this.trackInstruments.values());
  }

  /**
   * Check if track has instrument
   */
  hasInstrument(trackId: string): boolean {
    return this.trackInstruments.has(trackId);
  }

  /**
   * Get instrument name for track
   */
  getInstrumentName(trackId: string): string | null {
    return this.trackInstruments.get(trackId)?.instrumentName ?? null;
  }

  /**
   * Dispose all instruments
   */
  dispose(): void {
    this.trackInstruments.forEach((trackInst) => {
      if (trackInst.instrument) {
        trackInst.instrument.dispose();
      }
    });
    this.trackInstruments.clear();
  }
}

/**
 * Singleton router instance
 */
let globalRouter: MidiInstrumentRouter | null = null;

export function createMidiRouter(
  ctx: AudioContext,
  destination: AudioNode
): MidiInstrumentRouter {
  globalRouter = new MidiInstrumentRouter(ctx, destination);
  return globalRouter;
}

export function getMidiRouter(): MidiInstrumentRouter | null {
  return globalRouter;
}

export default MidiInstrumentRouter;
