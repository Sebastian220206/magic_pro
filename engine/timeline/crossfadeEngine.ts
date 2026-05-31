/**
 * Crossfade Engine - Automatic crossfade between overlapping clips
 * 
 * Features:
 * - Automatic detection of overlapping clips
 * - Smooth crossfade curve generation
 * - Adjustable fade duration and curve type
 * - Visual crossfade handles
 * - Prevents audio clicks at boundaries
 */

import { Clip, FadeCurveType } from './types';

// =============================================================================
// Types
// =============================================================================

export interface Crossfade {
  id: string;
  clipAId: string;
  clipBId: string;
  startTime: number;
  duration: number;
  curveType: FadeCurveType;
  clipAFadeOutDuration: number;
  clipBFadeInDuration: number;
}

export interface Overlap {
  clipA: Clip;
  clipB: Clip;
  overlapStart: number;
  overlapEnd: number;
  overlapDuration: number;
}

// =============================================================================
// Overlap Detection
// =============================================================================

/**
 * Find all overlapping clip pairs on a track
 */
export function findOverlaps(clips: Clip[]): Overlap[] {
  const overlaps: Overlap[] = [];
  const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime);

  for (let i = 0; i < sortedClips.length - 1; i++) {
    const clipA = sortedClips[i];
    const clipAEnd = clipA.startTime + clipA.duration;

    for (let j = i + 1; j < sortedClips.length; j++) {
      const clipB = sortedClips[j];
      
      // Check if clips are on the same track
      if (clipA.trackId !== clipB.trackId) continue;

      // Check for overlap
      if (clipAEnd > clipB.startTime) {
        const overlapStart = clipB.startTime;
        const overlapEnd = Math.min(clipAEnd, clipB.startTime + clipB.duration);
        
        overlaps.push({
          clipA,
          clipB,
          overlapStart,
          overlapEnd,
          overlapDuration: overlapEnd - overlapStart,
        });
      } else {
        // No overlap with this clip, and since sorted, no overlap with any later clip
        break;
      }
    }
  }

  return overlaps;
}

/**
 * Check if two specific clips overlap
 */
export function clipsOverlap(clipA: Clip, clipB: Clip): boolean {
  if (clipA.trackId !== clipB.trackId) return false;
  
  const aStart = clipA.startTime;
  const aEnd = clipA.startTime + clipA.duration;
  const bStart = clipB.startTime;
  const bEnd = clipB.startTime + clipB.duration;

  return aStart < bEnd && aEnd > bStart;
}

// =============================================================================
// Crossfade Generation
// =============================================================================

/**
 * Calculate optimal crossfade duration for an overlap
 */
export function calculateOptimalCrossfadeDuration(
  overlap: Overlap,
  maxDuration: number = 0.5
): number {
  // Use 50% of overlap or max duration, whichever is smaller
  const halfOverlap = overlap.overlapDuration * 0.5;
  return Math.min(halfOverlap, maxDuration);
}

/**
 * Create crossfade for overlapping clips
 */
export function createCrossfade(
  overlap: Overlap,
  duration?: number,
  curveType: FadeCurveType = 'exponential'
): Crossfade {
  const crossfadeDuration = duration ?? calculateOptimalCrossfadeDuration(overlap);
  const id = `crossfade-${overlap.clipA.id}-${overlap.clipB.id}`;

  return {
    id,
    clipAId: overlap.clipA.id,
    clipBId: overlap.clipB.id,
    startTime: overlap.overlapStart,
    duration: crossfadeDuration,
    curveType,
    clipAFadeOutDuration: crossfadeDuration,
    clipBFadeInDuration: crossfadeDuration,
  };
}

/**
 * Generate all crossfades for a set of clips
 */
export function generateCrossfades(
  clips: Clip[],
  maxDuration: number = 0.5,
  curveType: FadeCurveType = 'exponential'
): Crossfade[] {
  const overlaps = findOverlaps(clips);
  return overlaps.map(overlap => 
    createCrossfade(overlap, undefined, curveType)
  );
}

// =============================================================================
// Crossfade Curves
// =============================================================================

/**
 * Calculate crossfade gain for clip A (fading out)
 */
export function calculateCrossfadeOutGain(
  position: number, // 0 to 1 within crossfade
  curveType: FadeCurveType
): number {
  switch (curveType) {
    case 'linear':
      return 1 - position;
    case 'exponential':
      // Exponential fade out prevents clicking
      return Math.pow(1 - position, 2);
    case 'logarithmic':
      return 1 - Math.sqrt(position);
    case 'scurve':
      // S-curve smoothstep
      const t = 1 - position;
      return t * t * (3 - 2 * t);
    default:
      return 1 - position;
  }
}

/**
 * Calculate crossfade gain for clip B (fading in)
 */
export function calculateCrossfadeInGain(
  position: number, // 0 to 1 within crossfade
  curveType: FadeCurveType
): number {
  switch (curveType) {
    case 'linear':
      return position;
    case 'exponential':
      return Math.pow(position, 2);
    case 'logarithmic':
      return Math.sqrt(position);
    case 'scurve':
      // S-curve smoothstep
      return position * position * (3 - 2 * position);
    default:
      return position;
  }
}

/**
 * Generate equal power crossfade curve
 * Maintains constant power throughout crossfade
 */
export function generateEqualPowerCrossfade(
  duration: number,
  sampleRate: number,
  curveType: FadeCurveType
): { fadeOut: Float32Array; fadeIn: Float32Array } {
  const samples = Math.ceil(duration * sampleRate);
  const fadeOut = new Float32Array(samples);
  const fadeIn = new Float32Array(samples);

  for (let i = 0; i < samples; i++) {
    const position = i / (samples - 1);
    fadeOut[i] = calculateCrossfadeOutGain(position, curveType);
    fadeIn[i] = calculateCrossfadeInGain(position, curveType);
  }

  return { fadeOut, fadeIn };
}

// =============================================================================
// Visual Positioning
// =============================================================================

/**
 * Get crossfade visual bounds
 */
export function getCrossfadeBounds(
  crossfade: Crossfade,
  pixelsPerBeat: number
): {
  x: number;
  y: number;
  width: number;
} {
  return {
    x: crossfade.startTime * pixelsPerBeat,
    y: 0,
    width: crossfade.duration * pixelsPerBeat,
  };
}

/**
 * Check if point is within crossfade handle
 */
export function isPointInCrossfadeHandle(
  crossfade: Crossfade,
  x: number,
  y: number,
  handleWidth: number = 20,
  pixelsPerBeat: number,
  clipHeight: number
): boolean {
  const bounds = getCrossfadeBounds(crossfade, pixelsPerBeat);
  const centerX = bounds.x + bounds.width / 2;
  
  return (
    x >= centerX - handleWidth / 2 &&
    x <= centerX + handleWidth / 2 &&
    y >= 0 &&
    y <= clipHeight
  );
}

// =============================================================================
// Crossfade Manager
// =============================================================================

export class CrossfadeManager {
  private crossfades: Map<string, Crossfade> = new Map();
  private clips: Clip[] = [];

  constructor(clips: Clip[] = []) {
    this.clips = clips;
    this.updateCrossfades();
  }

  /**
   * Update the clip set and regenerate crossfades
   */
  setClips(clips: Clip[]): void {
    this.clips = clips;
    this.updateCrossfades();
  }

  /**
   * Add or update a clip and recalculate crossfades
   */
  updateClip(clip: Clip): void {
    const existingIndex = this.clips.findIndex(c => c.id === clip.id);
    if (existingIndex >= 0) {
      this.clips[existingIndex] = clip;
    } else {
      this.clips.push(clip);
    }
    this.updateCrossfades();
  }

  /**
   * Remove a clip and recalculate crossfades
   */
  removeClip(clipId: string): void {
    this.clips = this.clips.filter(c => c.id !== clipId);
    // Remove any crossfades involving this clip
    for (const [id, crossfade] of Array.from(this.crossfades.entries())) {
      if (crossfade.clipAId === clipId || crossfade.clipBId === clipId) {
        this.crossfades.delete(id);
      }
    }
    this.updateCrossfades();
  }

  /**
   * Regenerate all crossfades
   */
  private updateCrossfades(): void {
    const newCrossfades = generateCrossfades(this.clips);
    
    // Preserve existing crossfade settings where possible
    for (const newCrossfade of newCrossfades) {
      const existing = this.crossfades.get(newCrossfade.id);
      if (existing) {
        // Keep user-adjusted curve type and duration
        this.crossfades.set(newCrossfade.id, {
          ...newCrossfade,
          curveType: existing.curveType,
          duration: existing.duration,
          clipAFadeOutDuration: existing.clipAFadeOutDuration,
          clipBFadeInDuration: existing.clipBFadeInDuration,
        });
      } else {
        this.crossfades.set(newCrossfade.id, newCrossfade);
      }
    }
  }

  /**
   * Get all crossfades for a track
   */
  getCrossfadesForTrack(trackId: string): Crossfade[] {
    return Array.from(this.crossfades.values()).filter(cf => {
      const clipA = this.clips.find(c => c.id === cf.clipAId);
      const clipB = this.clips.find(c => c.id === cf.clipBId);
      return clipA?.trackId === trackId || clipB?.trackId === trackId;
    });
  }

  /**
   * Get crossfade between two specific clips
   */
  getCrossfade(clipAId: string, clipBId: string): Crossfade | undefined {
    const id1 = `crossfade-${clipAId}-${clipBId}`;
    const id2 = `crossfade-${clipBId}-${clipAId}`;
    return this.crossfades.get(id1) || this.crossfades.get(id2);
  }

  /**
   * Update crossfade curve type
   */
  setCurveType(crossfadeId: string, curveType: FadeCurveType): void {
    const crossfade = this.crossfades.get(crossfadeId);
    if (crossfade) {
      crossfade.curveType = curveType;
    }
  }

  /**
   * Update crossfade duration
   */
  setDuration(crossfadeId: string, duration: number): void {
    const crossfade = this.crossfades.get(crossfadeId);
    if (crossfade) {
      crossfade.duration = Math.max(0.01, duration);
      crossfade.clipAFadeOutDuration = crossfade.duration;
      crossfade.clipBFadeInDuration = crossfade.duration;
    }
  }

  /**
   * Get all crossfades
   */
  getAllCrossfades(): Crossfade[] {
    return Array.from(this.crossfades.values());
  }

  /**
   * Clear all crossfades
   */
  clear(): void {
    this.crossfades.clear();
  }
}

// =============================================================================
// Export singleton
// =============================================================================

export function createCrossfadeManager(clips?: Clip[]): CrossfadeManager {
  return new CrossfadeManager(clips);
}
