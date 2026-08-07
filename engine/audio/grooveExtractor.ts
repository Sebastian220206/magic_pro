/**
 * Groove Extractor - Extract groove from audio
 *
 * Analyzes audio transients and extracts timing/velocity patterns
 * to create groove templates, like Logic Pro's "Extract Groove" feature.
 *
 * Workflow:
 * 1. Detect transients in audio
 * 2. Quantize transients to nearest grid positions
 * 3. Compute timing offsets (deviations from grid)
 * 4. Build a GrooveTemplate from the extracted pattern
 */

import { TransientDetector } from './AudioQuantizer';
import type { GrooveTemplate } from '../midi/grooveQuantize';

// =============================================================================
// Groove Extraction Types
// =============================================================================

export interface GrooveExtractionOptions {
  /** Grid resolution in beats (e.g., 0.25 for 16th notes) */
  gridResolution: number;
  /** Transient detection sensitivity (0-1) */
  sensitivity: number;
  /** Number of bars to analyze (0 = entire clip) */
  numBars: number;
  /** Starting bar for analysis (0-indexed) */
  startBar: number;
  /** Minimum offset to include in groove (eliminates micro-timing noise) */
  minOffsetThreshold: number;
  /** Maximum offset to include (caps extreme timing) */
  maxOffsetThreshold: number;
  /** Quantize velocity as well as timing */
  extractVelocity: boolean;
}

export interface ExtractedTransient {
  /** Sample index in audio */
  sampleIndex: number;
  /** Beat position */
  beat: number;
  /** Detected strength (0-1) */
  strength: number;
  /** Nearest grid position */
  gridBeat: number;
  /** Timing offset from grid (positive = late, negative = early) */
  timingOffset: number;
  /** Quantized velocity offset */
  velocityOffset: number;
}

export interface ExtractedGroove {
  /** Name for this groove */
  name: string;
  /** Description */
  description: string;
  /** Detected BPM */
  detectedBpm: number;
  /** Grid resolution used */
  gridResolution: number;
  /** All detected transients */
  transients: ExtractedTransient[];
  /** Timing offsets pattern (cyclic) */
  timingOffsets: number[];
  /** Velocity offsets pattern (cyclic) */
  velocityOffsets: number[];
  /** Average timing offset (positive = laid back, negative = pushed) */
  averageTimingOffset: number;
  /** Timing consistency (0=erratic, 1=metronomic) */
  consistency: number;
  /** Converted to GrooveTemplate */
  template: GrooveTemplate;
}

export interface GrooveExtractionResult {
  success: boolean;
  groove?: ExtractedGroove;
  error?: string;
  warnings: string[];
}

// =============================================================================
// Default Options
// =============================================================================

export const DEFAULT_EXTRACTION_OPTIONS: GrooveExtractionOptions = {
  gridResolution: 0.25,  // 16th notes
  sensitivity: 0.5,
  numBars: 0,  // entire clip
  startBar: 0,
  minOffsetThreshold: 0.005,  // ~5ms at 120 BPM
  maxOffsetThreshold: 0.15,   // ~150ms at 120 BPM
  extractVelocity: true,
};

// =============================================================================
// Groove Extractor
// =============================================================================

export class GrooveExtractor {
  /**
   * Extract groove from audio buffer
   */
  static extractFromAudio(
    channelData: Float32Array,
    sampleRate: number,
    bpm: number,
    options: Partial<GrooveExtractionOptions> = {}
  ): GrooveExtractionResult {
    const opts = { ...DEFAULT_EXTRACTION_OPTIONS, ...options };
    const warnings: string[] = [];

    try {
      // Step 1: Detect transients
      const rawTransients = TransientDetector.detectTransients(
        channelData,
        sampleRate,
        opts.sensitivity
      );

      if (rawTransients.length === 0) {
        return {
          success: false,
          error: 'No transients detected. Try lowering sensitivity.',
          warnings,
        };
      }

      // Step 2: Convert to beat positions
      const samplesPerBeat = (60 / bpm) * sampleRate;
      const startBeat = opts.startBar * 4;  // Assume 4/4 time

      // Calculate analysis window
      let endBeat = Infinity;
      if (opts.numBars > 0) {
        endBeat = startBeat + opts.numBars * 4;
      }

      // Step 3: Analyze each transient
      const extractedTransients: ExtractedTransient[] = [];

      for (const sampleIdx of rawTransients) {
        const beat = startBeat + sampleIdx / samplesPerBeat;

        // Skip if outside analysis window
        if (beat < startBeat || beat > endBeat) continue;

        // Find nearest grid position
        const gridBeat = Math.round(beat / opts.gridResolution) * opts.gridResolution;
        const timingOffset = beat - gridBeat;

        // Filter by threshold
        if (Math.abs(timingOffset) < opts.minOffsetThreshold) continue;
        if (Math.abs(timingOffset) > opts.maxOffsetThreshold) continue;

        // Estimate velocity from audio energy around transient
        const velocityOffset = this.estimateVelocityOffset(
          channelData, sampleIdx, sampleRate
        );

        extractedTransients.push({
          sampleIndex: sampleIdx,
          beat,
          strength: 0.5,
          gridBeat,
          timingOffset,
          velocityOffset,
        });
      }

      if (extractedTransients.length === 0) {
        return {
          success: false,
          error: 'No transients within threshold range. Try adjusting thresholds.',
          warnings,
        };
      }

      // Step 4: Compute cyclic pattern
      const patternLength = this.detectPatternLength(extractedTransients, opts.gridResolution);
      const timingOffsets = new Array(patternLength).fill(0);
      const velocityOffsets = new Array(patternLength).fill(0);
      const counts = new Array(patternLength).fill(0);

      for (const t of extractedTransients) {
        const patternIndex = Math.round(t.beat / opts.gridResolution) % patternLength;
        timingOffsets[patternIndex] += t.timingOffset;
        velocityOffsets[patternIndex] += t.velocityOffset;
        counts[patternIndex]++;
      }

      // Average the offsets
      for (let i = 0; i < patternLength; i++) {
        if (counts[i] > 0) {
          timingOffsets[i] /= counts[i];
          velocityOffsets[i] /= counts[i];
        }
      }

      // Step 5: Compute statistics
      const allTimings = extractedTransients.map(t => t.timingOffset);
      const averageTimingOffset = allTimings.reduce((a, b) => a + b, 0) / allTimings.length;
      const consistency = this.computeConsistency(allTimings);

      // Step 6: Build GrooveTemplate
      const template: GrooveTemplate = {
        name: `Extracted (${Math.round(bpm)} BPM)`,
        description: `Extracted from audio at ${Math.round(bpm)} BPM`,
        offsets: timingOffsets,
        division: this.resolutionToDivision(opts.gridResolution),
        velocityOffsets: opts.extractVelocity ? velocityOffsets : undefined,
      };

      const groove: ExtractedGroove = {
        name: template.name,
        description: template.description,
        detectedBpm: bpm,
        gridResolution: opts.gridResolution,
        transients: extractedTransients,
        timingOffsets,
        velocityOffsets,
        averageTimingOffset,
        consistency,
        template,
      };

      return { success: true, groove, warnings };

    } catch (error) {
      return {
        success: false,
        error: `Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        warnings,
      };
    }
  }

  /**
   * Extract groove from MIDI notes
   */
  static extractFromMidi(
    notes: Array<{ startBeat: number; velocity: number }>,
    bpm: number,
    options: Partial<GrooveExtractionOptions> = {}
  ): GrooveExtractionResult {
    const opts = { ...DEFAULT_EXTRACTION_OPTIONS, ...options };
    const warnings: string[] = [];

    try {
      if (notes.length === 0) {
        return {
          success: false,
          error: 'No MIDI notes to extract from.',
          warnings,
        };
      }

      // Analyze each note
      const extractedTransients: ExtractedTransient[] = [];

      for (const note of notes) {
        const gridBeat = Math.round(note.startBeat / opts.gridResolution) * opts.gridResolution;
        const timingOffset = note.startBeat - gridBeat;

        // Filter by threshold
        if (Math.abs(timingOffset) < opts.minOffsetThreshold) continue;
        if (Math.abs(timingOffset) > opts.maxOffsetThreshold) continue;

        // Velocity offset (relative to median)
        const medianVelocity = this.median(notes.map(n => n.velocity));
        const velocityOffset = (note.velocity - medianVelocity) / 127;

        extractedTransients.push({
          sampleIndex: 0,
          beat: note.startBeat,
          strength: note.velocity / 127,
          gridBeat,
          timingOffset,
          velocityOffset,
        });
      }

      if (extractedTransients.length === 0) {
        return {
          success: false,
          error: 'No notes with significant timing offset.',
          warnings,
        };
      }

      // Compute cyclic pattern
      const patternLength = this.detectPatternLength(extractedTransients, opts.gridResolution);
      const timingOffsets = new Array(patternLength).fill(0);
      const velocityOffsets = new Array(patternLength).fill(0);
      const counts = new Array(patternLength).fill(0);

      for (const t of extractedTransients) {
        const patternIndex = Math.round(t.beat / opts.gridResolution) % patternLength;
        timingOffsets[patternIndex] += t.timingOffset;
        velocityOffsets[patternIndex] += t.velocityOffset;
        counts[patternIndex]++;
      }

      for (let i = 0; i < patternLength; i++) {
        if (counts[i] > 0) {
          timingOffsets[i] /= counts[i];
          velocityOffsets[i] /= counts[i];
        }
      }

      // Statistics
      const allTimings = extractedTransients.map(t => t.timingOffset);
      const averageTimingOffset = allTimings.reduce((a, b) => a + b, 0) / allTimings.length;
      const consistency = this.computeConsistency(allTimings);

      const template: GrooveTemplate = {
        name: `MIDI Extracted`,
        description: `Extracted from ${notes.length} MIDI notes`,
        offsets: timingOffsets,
        division: this.resolutionToDivision(opts.gridResolution),
        velocityOffsets: opts.extractVelocity ? velocityOffsets : undefined,
      };

      const groove: ExtractedGroove = {
        name: template.name,
        description: template.description,
        detectedBpm: bpm,
        gridResolution: opts.gridResolution,
        transients: extractedTransients,
        timingOffsets,
        velocityOffsets,
        averageTimingOffset,
        consistency,
        template,
      };

      return { success: true, groove, warnings };

    } catch (error) {
      return {
        success: false,
        error: `MIDI extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        warnings,
      };
    }
  }

  // ===========================================================================
  // Helper Functions
  // ===========================================================================

  private static estimateVelocityOffset(
    channelData: Float32Array,
    sampleIdx: number,
    sampleRate: number
  ): number {
    // Estimate velocity from RMS energy in a window around the transient
    const windowSize = Math.floor(sampleRate * 0.01);  // 10ms window
    const start = Math.max(0, sampleIdx - windowSize);
    const end = Math.min(channelData.length, sampleIdx + windowSize);

    let sum = 0;
    let count = 0;
    for (let i = start; i < end; i++) {
      sum += channelData[i] * channelData[i];
      count++;
    }

    const rms = count > 0 ? Math.sqrt(sum / count) : 0;
    // Normalize to -1 to 1 range (relative to a reference level)
    return Math.max(-1, Math.min(1, (rms - 0.1) * 5));
  }

  private static detectPatternLength(
    transients: ExtractedTransient[],
    gridResolution: number
  ): number {
    // Find the greatest common divisor of pattern positions
    if (transients.length === 0) return 4;

    const positions = transients.map(t =>
      Math.round(t.beat / gridResolution)
    );

    // Find GCD of all position differences
    let gcd = 1;
    for (let i = 1; i < positions.length; i++) {
      const diff = Math.abs(positions[i] - positions[0]);
      if (diff > 0) {
        gcd = this.gcd(gcd, diff);
      }
    }

    // Pattern length should be a reasonable size (4-16 steps)
    const patternLength = Math.max(4, Math.min(16, gcd * 4));
    return patternLength;
  }

  private static gcd(a: number, b: number): number {
    while (b > 0) {
      const temp = b;
      b = a % b;
      a = temp;
    }
    return a;
  }

  private static computeConsistency(timings: number[]): number {
    if (timings.length < 2) return 1;

    const mean = timings.reduce((a, b) => a + b, 0) / timings.length;
    const variance = timings.reduce((sum, t) => sum + (t - mean) ** 2, 0) / timings.length;
    const stdDev = Math.sqrt(variance);

    // Normalize: 0 stdDev = 1.0 consistency, 0.1 stdDev = 0.0 consistency
    return Math.max(0, 1 - stdDev / 0.1);
  }

  private static median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private static resolutionToDivision(resolution: number): number {
    // Convert beat resolution to grid division
    if (resolution >= 1) return 4;      // Quarter notes
    if (resolution >= 0.5) return 8;    // Eighth notes
    if (resolution >= 0.25) return 16;  // 16th notes
    if (resolution >= 0.125) return 32; // 32nd notes
    return 16;
  }
}

// =============================================================================
// Utility: Compare Two Grooves
// =============================================================================

export interface GrooveComparison {
  /** How similar the timing patterns are (0-1) */
  timingSimilarity: number;
  /** How similar the velocity patterns are (0-1) */
  velocitySimilarity: number;
  /** Overall similarity (0-1) */
  overallSimilarity: number;
  /** Average timing difference between grooves */
  timingDifference: number;
}

export function compareGrooves(
  grooveA: ExtractedGroove,
  grooveB: ExtractedGroove
): GrooveComparison {
  // Align patterns to same length
  const maxLen = Math.max(grooveA.timingOffsets.length, grooveB.timingOffsets.length);
  const patternA = padPattern(grooveA.timingOffsets, maxLen);
  const patternB = padPattern(grooveB.timingOffsets, maxLen);

  // Compute timing similarity (1 - normalized RMSE)
  let sumSquaredDiff = 0;
  for (let i = 0; i < maxLen; i++) {
    sumSquaredDiff += (patternA[i] - patternB[i]) ** 2;
  }
  const rmse = Math.sqrt(sumSquaredDiff / maxLen);
  const timingSimilarity = Math.max(0, 1 - rmse / 0.1);

  // Velocity similarity
  let velocitySimilarity = 0.5;
  if (grooveA.velocityOffsets.length > 0 && grooveB.velocityOffsets.length > 0) {
    const velA = padPattern(grooveA.velocityOffsets, maxLen);
    const velB = padPattern(grooveB.velocityOffsets, maxLen);
    let velDiff = 0;
    for (let i = 0; i < maxLen; i++) {
      velDiff += (velA[i] - velB[i]) ** 2;
    }
    velocitySimilarity = Math.max(0, 1 - Math.sqrt(velDiff / maxLen) / 0.5);
  }

  const overallSimilarity = timingSimilarity * 0.7 + velocitySimilarity * 0.3;
  const timingDifference = Math.abs(grooveA.averageTimingOffset - grooveB.averageTimingOffset);

  return {
    timingSimilarity,
    velocitySimilarity,
    overallSimilarity,
    timingDifference,
  };
}

function padPattern(pattern: number[], targetLength: number): number[] {
  const result = [...pattern];
  while (result.length < targetLength) {
    result.push(0);
  }
  return result;
}

// =============================================================================
// Utility: Merge Grooves
// =============================================================================

export function mergeGrooves(
  grooves: ExtractedGroove[],
  weights?: number[]
): ExtractedGroove {
  if (grooves.length === 0) {
    throw new Error('No grooves to merge');
  }

  if (grooves.length === 1) {
    return grooves[0];
  }

  const w = weights ?? grooves.map(() => 1 / grooves.length);
  const totalWeight = w.reduce((a, b) => a + b, 0);
  const normalizedWeights = w.map(wi => wi / totalWeight);

  // Find max pattern length
  const maxLen = Math.max(...grooves.map(g => g.timingOffsets.length));

  // Merge timing offsets
  const mergedTiming = new Array(maxLen).fill(0);
  const mergedVelocity = new Array(maxLen).fill(0);

  for (let g = 0; g < grooves.length; g++) {
    const groove = grooves[g];
    const weight = normalizedWeights[g];

    for (let i = 0; i < groove.timingOffsets.length; i++) {
      mergedTiming[i] += groove.timingOffsets[i] * weight;
    }

    for (let i = 0; i < groove.velocityOffsets.length; i++) {
      mergedVelocity[i] += groove.velocityOffsets[i] * weight;
    }
  }

  const template: GrooveTemplate = {
    name: `Merged (${grooves.length} sources)`,
    description: `Merged from ${grooves.length} groove sources`,
    offsets: mergedTiming,
    division: grooves[0].template.division,
    velocityOffsets: mergedVelocity,
  };

  return {
    name: template.name,
    description: template.description,
    detectedBpm: grooves[0].detectedBpm,
    gridResolution: grooves[0].gridResolution,
    transients: [],
    timingOffsets: mergedTiming,
    velocityOffsets: mergedVelocity,
    averageTimingOffset: mergedTiming.reduce((a, b) => a + b, 0) / mergedTiming.length,
    consistency: grooves.reduce((sum, g) => sum + g.consistency, 0) / grooves.length,
    template,
  };
}

export default GrooveExtractor;
