/**
 * Instrument Service
 * Manages instrument lifecycle and integration with the audio engine
 */

import { audioContextManager } from '../audioEngine/audioContext';
import { routingEngine } from '../audioEngine/routingEngine';
import {
  createInstrumentFactory,
  getInstrumentFactory,
  createInstrumentAdapter,
  InstrumentAdapter,
  hasInstrument,
} from '../instruments';
import type { Instrument } from '../instruments';

interface TrackInstrumentAssignment {
  trackId: string;
  instrumentName: string;
  adapter: InstrumentAdapter;
  connected: boolean;
}

/**
 * Service to manage track instruments and connect them to the audio engine
 */
export class InstrumentService {
  private assignments = new Map<string, TrackInstrumentAssignment>();
  private initialized = false;

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const ctx = audioContextManager.getContext();
    if (!ctx) {
      console.warn('Audio context not available');
      return;
    }

    createInstrumentFactory(ctx);
    this.initialized = true;
    console.log('Instrument service initialized');
  }

  /**
   * Assign an instrument to a track
   */
  assignInstrument(trackId: string, instrumentName: string): boolean {
    if (!hasInstrument(instrumentName)) {
      console.warn(`Unknown instrument: ${instrumentName}`);
      return false;
    }

    // Remove existing assignment
    this.removeInstrument(trackId);

    const factory = getInstrumentFactory();
    if (!factory) {
      console.warn('Instrument factory not initialized');
      return false;
    }

    // Create instrument
    const instrument = factory.createInstrument(instrumentName);
    if (!instrument) {
      console.warn(`Failed to create instrument: ${instrumentName}`);
      return false;
    }

    // Create adapter
    const adapter = createInstrumentAdapter(instrument);

    // Connect to audio engine destination
    const ctx = audioContextManager.getContext();
    if (ctx) {
      instrument.getOutput().connect(ctx.destination);
    }

    // Store assignment
    this.assignments.set(trackId, {
      trackId,
      instrumentName,
      adapter,
      connected: true,
    });

    console.log(`Assigned ${instrumentName} to track ${trackId}`);
    return true;
  }

  /**
   * Remove instrument from track
   */
  removeInstrument(trackId: string): void {
    const assignment = this.assignments.get(trackId);
    if (!assignment) return;

    // Disconnect from audio engine
    try {
      const inst = assignment.adapter.getInstrument();
      inst.getOutput().disconnect();
    } catch {
      // Already disconnected
    }

    // Dispose adapter and instrument
    assignment.adapter.dispose();
    this.assignments.delete(trackId);

    console.log(`Removed instrument from track ${trackId}`);
  }

  /**
   * Get the adapter for a track
   */
  getAdapter(trackId: string): InstrumentAdapter | undefined {
    return this.assignments.get(trackId)?.adapter;
  }

  /**
   * Get instrument name for track
   */
  getInstrumentName(trackId: string): string | undefined {
    return this.assignments.get(trackId)?.instrumentName;
  }

  /**
   * Check if track has instrument
   */
  hasInstrument(trackId: string): boolean {
    return this.assignments.has(trackId);
  }

  /**
   * Get all assignments
   */
  getAllAssignments(): TrackInstrumentAssignment[] {
    return Array.from(this.assignments.values());
  }

  /**
   * Handle note on for a track
   */
  noteOn(trackId: string, note: number, velocity: number, time?: number): void {
    const assignment = this.assignments.get(trackId);
    if (!assignment) return;

    const inst = assignment.adapter.getInstrument();
    inst.noteOn(note, velocity, time);
  }

  /**
   * Handle note off for a track
   */
  noteOff(trackId: string, note: number, time?: number): void {
    const assignment = this.assignments.get(trackId);
    if (!assignment) return;

    const inst = assignment.adapter.getInstrument();
    inst.noteOff(note, time);
  }

  /**
   * Stop all notes on a track
   */
  allNotesOff(trackId: string, time?: number): void {
    const assignment = this.assignments.get(trackId);
    if (!assignment) return;

    const inst = assignment.adapter.getInstrument();
    inst.allNotesOff(time);
  }

  /**
   * Set track volume
   */
  setVolume(trackId: string, volume: number): void {
    const assignment = this.assignments.get(trackId);
    if (!assignment) return;

    const inst = assignment.adapter.getInstrument();
    inst.setVolume(volume);
  }

  /**
   * Dispose all instruments
   */
  dispose(): void {
    this.assignments.forEach((assignment) => {
      assignment.adapter.dispose();
    });
    this.assignments.clear();
    this.initialized = false;
  }
}

// Singleton instance
let instrumentService: InstrumentService | null = null;

export function getInstrumentService(): InstrumentService {
  if (!instrumentService) {
    instrumentService = new InstrumentService();
  }
  return instrumentService;
}

export function createInstrumentService(): InstrumentService {
  instrumentService = new InstrumentService();
  return instrumentService;
}

export default InstrumentService;
