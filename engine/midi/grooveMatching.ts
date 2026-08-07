/**
 * Groove Matching - Match groove from reference track
 *
 * Features:
 * - Extract groove from a reference track (MIDI or audio)
 * - Apply reference groove to other tracks
 * - Match timing and velocity characteristics
 * - "Match to Reference Track" workflow like Logic Pro
 */

import type { MidiNote } from './types';
import type { GrooveTemplate } from './grooveQuantize';
import { applyGrooveToNotes } from './grooveQuantize';
import { GrooveExtractor, type ExtractedGroove, type GrooveExtractionOptions } from '../audio/grooveExtractor';

// =============================================================================
// Groove Matching Types
// =============================================================================

export interface GrooveMatchOptions {
  /** Strength of groove application (0-1) */
  strength: number;
  /** Grid resolution in beats */
  gridResolution: number;
  /** Match timing only (ignore velocity) */
  timingOnly: boolean;
  /** Preserve original note velocities */
  preserveVelocity: boolean;
  /** Quantize before applying groove */
  preQuantize: boolean;
  /** Pre-quantize grid division */
  preQuantizeDivision: number;
}

export interface GrooveReference {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Source type */
  sourceType: 'midi' | 'audio' | 'template';
  /** Extracted groove data */
  groove: ExtractedGroove;
  /** Original MIDI notes (if source is MIDI) */
  midiNotes?: MidiNote[];
  /** Track ID this was extracted from */
  trackId?: string;
  /** Timestamp */
  createdAt: number;
}

export interface GrooveMatchResult {
  success: boolean;
  /** Modified notes with groove applied */
  notes?: MidiNote[];
  /** Applied groove reference */
  appliedReference?: GrooveReference;
  error?: string;
  stats: {
    notesProcessed: number;
    averageTimingShift: number;
    maxTimingShift: number;
  };
}

export interface GrooveMatchState {
  /** Available groove references */
  references: GrooveReference[];
  /** Currently active reference */
  activeReferenceId: string | null;
  /** Default match options */
  defaultOptions: GrooveMatchOptions;
}

// =============================================================================
// Default Options
// =============================================================================

export const DEFAULT_MATCH_OPTIONS: GrooveMatchOptions = {
  strength: 1.0,
  gridResolution: 0.25,
  timingOnly: false,
  preserveVelocity: false,
  preQuantize: false,
  preQuantizeDivision: 16,
};

// =============================================================================
// Groove Matcher
// =============================================================================

export class GrooveMatcher {
  private state: GrooveMatchState;

  constructor() {
    this.state = {
      references: [],
      activeReferenceId: null,
      defaultOptions: { ...DEFAULT_MATCH_OPTIONS },
    };
  }

  // ===========================================================================
  // Reference Management
  // ===========================================================================

  /**
   * Create a groove reference from MIDI notes
   */
  public createReferenceFromMidi(
    name: string,
    notes: MidiNote[],
    trackId: string,
    options: Partial<GrooveExtractionOptions> = {}
  ): GrooveReference | null {
    if (notes.length === 0) return null;

    // Estimate BPM from note spacing
    const bpm = this.estimateBpm(notes);

    const result = GrooveExtractor.extractFromMidi(notes, bpm, options);

    if (!result.success || !result.groove) {
      console.error('[GrooveMatcher] MIDI extraction failed:', result.error);
      return null;
    }

    const reference: GrooveReference = {
      id: `midi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      sourceType: 'midi',
      groove: result.groove,
      midiNotes: notes,
      trackId,
      createdAt: Date.now(),
    };

    this.state.references.push(reference);
    return reference;
  }

  /**
   * Create a groove reference from audio
   */
  public createReferenceFromAudio(
    name: string,
    channelData: Float32Array,
    sampleRate: number,
    bpm: number,
    trackId: string,
    options: Partial<GrooveExtractionOptions> = {}
  ): GrooveReference | null {
    const result = GrooveExtractor.extractFromAudio(
      channelData,
      sampleRate,
      bpm,
      options
    );

    if (!result.success || !result.groove) {
      console.error('[GrooveMatcher] Audio extraction failed:', result.error);
      return null;
    }

    const reference: GrooveReference = {
      id: `audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      sourceType: 'audio',
      groove: result.groove,
      trackId,
      createdAt: Date.now(),
    };

    this.state.references.push(reference);
    return reference;
  }

  /**
   * Create a groove reference from a template
   */
  public createReferenceFromTemplate(
    template: GrooveTemplate,
    bpm: number = 120
  ): GrooveReference {
    const groove: ExtractedGroove = {
      name: template.name,
      description: template.description,
      detectedBpm: bpm,
      gridResolution: 0.25,
      transients: [],
      timingOffsets: template.offsets,
      velocityOffsets: template.velocityOffsets ?? [],
      averageTimingOffset: template.offsets.reduce((a, b) => a + b, 0) / template.offsets.length,
      consistency: 0.8,
      template,
    };

    const reference: GrooveReference = {
      id: `template_${template.name.replace(/\s+/g, '_').toLowerCase()}`,
      name: template.name,
      sourceType: 'template',
      groove,
      createdAt: Date.now(),
    };

    // Avoid duplicates
    const existing = this.state.references.findIndex(r => r.id === reference.id);
    if (existing >= 0) {
      this.state.references[existing] = reference;
    } else {
      this.state.references.push(reference);
    }

    return reference;
  }

  /**
   * Delete a groove reference
   */
  public deleteReference(id: string): boolean {
    const index = this.state.references.findIndex(r => r.id === id);
    if (index < 0) return false;

    this.state.references.splice(index, 1);
    if (this.state.activeReferenceId === id) {
      this.state.activeReferenceId = null;
    }
    return true;
  }

  /**
   * Get all references
   */
  public getReferences(): ReadonlyArray<GrooveReference> {
    return this.state.references;
  }

  /**
   * Get a specific reference
   */
  public getReference(id: string): GrooveReference | undefined {
    return this.state.references.find(r => r.id === id);
  }

  /**
   * Set active reference
   */
  public setActiveReference(id: string | null): void {
    this.state.activeReferenceId = id;
  }

  /**
   * Get active reference
   */
  public getActiveReference(): GrooveReference | undefined {
    if (!this.state.activeReferenceId) return undefined;
    return this.state.references.find(r => r.id === this.state.activeReferenceId);
  }

  // ===========================================================================
  // Groove Matching
  // ===========================================================================

  /**
   * Apply reference groove to MIDI notes
   */
  public applyToNotes(
    notes: MidiNote[],
    referenceId: string,
    options: Partial<GrooveMatchOptions> = {}
  ): GrooveMatchResult {
    const reference = this.state.references.find(r => r.id === referenceId);
    if (!reference) {
      return {
        success: false,
        error: `Reference not found: ${referenceId}`,
        stats: { notesProcessed: 0, averageTimingShift: 0, maxTimingShift: 0 },
      };
    }

    const opts = { ...this.state.defaultOptions, ...options };

    try {
      let processedNotes = [...notes];

      // Pre-quantize if requested
      if (opts.preQuantize) {
        const gridSize = 4 / opts.preQuantizeDivision;
        processedNotes = processedNotes.map(note => ({
          ...note,
          startBeat: Math.round(note.startBeat / gridSize) * gridSize,
        }));
      }

      // Calculate grid division from resolution
      const gridDivision = this.resolutionToDivision(opts.gridResolution);

      // Apply groove
      const resultNotes = applyGrooveToNotes(
        processedNotes,
        reference.groove.template,
        opts.strength,
        gridDivision
      );

      // Preserve original velocities if requested
      const finalNotes = opts.preserveVelocity
        ? resultNotes.map((note, i) => ({
            ...note,
            velocity: notes[i]?.velocity ?? note.velocity,
          }))
        : resultNotes;

      // Compute stats
      let totalShift = 0;
      let maxShift = 0;

      for (let i = 0; i < finalNotes.length; i++) {
        const shift = Math.abs(finalNotes[i].startBeat - notes[i].startBeat);
        totalShift += shift;
        maxShift = Math.max(maxShift, shift);
      }

      return {
        success: true,
        notes: finalNotes,
        appliedReference: reference,
        stats: {
          notesProcessed: finalNotes.length,
          averageTimingShift: finalNotes.length > 0 ? totalShift / finalNotes.length : 0,
          maxTimingShift: maxShift,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: `Match failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stats: { notesProcessed: 0, averageTimingShift: 0, maxTimingShift: 0 },
      };
    }
  }

  /**
   * Match notes to a specific reference track's groove
   * (High-level API for "Match to Reference Track" workflow)
   */
  public matchToReferenceTrack(
    notes: MidiNote[],
    referenceTrackId: string,
    options: Partial<GrooveMatchOptions> = {}
  ): GrooveMatchResult {
    // Find the reference for this track
    const reference = this.state.references.find(
      r => r.trackId === referenceTrackId
    );

    if (!reference) {
      return {
        success: false,
        error: `No groove reference found for track: ${referenceTrackId}`,
        stats: { notesProcessed: 0, averageTimingShift: 0, maxTimingShift: 0 },
      };
    }

    return this.applyToNotes(notes, reference.id, options);
  }

  // ===========================================================================
  // Groove Analysis
  // ===========================================================================

  /**
   * Analyze similarity between two references
   */
  public analyzeSimilarity(
    referenceIdA: string,
    referenceIdB: string
  ): {
    timingSimilarity: number;
    velocitySimilarity: number;
    overallSimilarity: number;
  } | null {
    const refA = this.state.references.find(r => r.id === referenceIdA);
    const refB = this.state.references.find(r => r.id === referenceIdB);

    if (!refA || !refB) return null;

    // Align patterns
    const maxLen = Math.max(
      refA.groove.timingOffsets.length,
      refB.groove.timingOffsets.length
    );

    const patternA = this.padPattern(refA.groove.timingOffsets, maxLen);
    const patternB = this.padPattern(refB.groove.timingOffsets, maxLen);

    // Timing similarity
    let sumSqDiff = 0;
    for (let i = 0; i < maxLen; i++) {
      sumSqDiff += (patternA[i] - patternB[i]) ** 2;
    }
    const rmse = Math.sqrt(sumSqDiff / maxLen);
    const timingSimilarity = Math.max(0, 1 - rmse / 0.1);

    // Velocity similarity
    let velocitySimilarity = 0.5;
    if (
      refA.groove.velocityOffsets.length > 0 &&
      refB.groove.velocityOffsets.length > 0
    ) {
      const velA = this.padPattern(refA.groove.velocityOffsets, maxLen);
      const velB = this.padPattern(refB.groove.velocityOffsets, maxLen);
      let velDiff = 0;
      for (let i = 0; i < maxLen; i++) {
        velDiff += (velA[i] - velB[i]) ** 2;
      }
      velocitySimilarity = Math.max(0, 1 - Math.sqrt(velDiff / maxLen) / 0.5);
    }

    return {
      timingSimilarity,
      velocitySimilarity,
      overallSimilarity: timingSimilarity * 0.7 + velocitySimilarity * 0.3,
    };
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getState(): Readonly<GrooveMatchState> {
    return this.state;
  }

  public setDefaultOptions(options: Partial<GrooveMatchOptions>): void {
    this.state.defaultOptions = { ...this.state.defaultOptions, ...options };
  }

  // ===========================================================================
  // Helper Functions
  // ===========================================================================

  private estimateBpm(notes: MidiNote[]): number {
    if (notes.length < 2) return 120;

    const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat);
    const intervals: number[] = [];

    for (let i = 1; i < Math.min(sorted.length, 32); i++) {
      const interval = sorted[i].startBeat - sorted[i - 1].startBeat;
      if (interval > 0 && interval < 4) {  // Filter reasonable intervals
        intervals.push(interval);
      }
    }

    if (intervals.length === 0) return 120;

    // Median interval
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];

    // Convert to BPM (assuming quarter note grid)
    const bpm = 60 / medianInterval;
    return Math.max(40, Math.min(300, bpm));
  }

  private resolutionToDivision(resolution: number): number {
    if (resolution >= 1) return 4;
    if (resolution >= 0.5) return 8;
    if (resolution >= 0.25) return 16;
    if (resolution >= 0.125) return 32;
    return 16;
  }

  private padPattern(pattern: number[], targetLength: number): number[] {
    const result = [...pattern];
    while (result.length < targetLength) {
      result.push(0);
    }
    return result;
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  public clearReferences(): void {
    this.state.references = [];
    this.state.activeReferenceId = null;
  }

  public dispose(): void {
    this.clearReferences();
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createGrooveMatcher(): GrooveMatcher {
  return new GrooveMatcher();
}

export default GrooveMatcher;
