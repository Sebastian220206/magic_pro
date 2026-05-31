/**
 * Slip Editing - Move audio content within clip boundaries
 * 
 * Features:
 * - Drag waveform inside clip to change offset
 * - Clip start time remains fixed
 * - Visual feedback showing waveform movement
 * - Boundary constraints prevent slipping beyond clip edges
 */

import { Clip } from './types';

// =============================================================================
// Types
// =============================================================================

export interface SlipState {
  isSlipping: boolean;
  clipId: string | null;
  startX: number;
  originalOffset: number;
  originalDuration: number;
  currentOffset: number;
}

export interface SlipConstraints {
  minOffset: number;
  maxOffset: number;
  bufferDuration: number;
}

// =============================================================================
// Slip Calculations
// =============================================================================

/**
 * Calculate new offset when slipping
 */
export function calculateSlipOffset(
  originalOffset: number,
  deltaPixels: number,
  pixelsPerBeat: number,
  tempo: number
): number {
  // Convert pixel delta to beat delta, then to seconds offset
  const deltaBeats = deltaPixels / pixelsPerBeat;
  const deltaSeconds = (deltaBeats * 60) / tempo;
  
  return originalOffset + deltaSeconds;
}

/**
 * Constrain offset to valid range based on audio buffer duration
 */
export function constrainSlipOffset(
  offset: number,
  clipDuration: number,
  bufferDuration: number
): number {
  // Minimum offset is 0
  const minOffset = 0;
  
  // Maximum offset allows at least clipDuration worth of audio
  const maxOffset = Math.max(0, bufferDuration - clipDuration);
  
  return Math.max(minOffset, Math.min(maxOffset, offset));
}

/**
 * Check if slip is possible (clip has audio buffer reference)
 */
export function canSlip(clip: Clip): boolean {
  return clip.type === 'audio' && !!clip.bufferId;
}

// =============================================================================
// Slip Operations
// =============================================================================

/**
 * Apply slip to a clip
 */
export function slipClip(
  clip: Clip,
  newOffset: number,
  bufferDuration: number
): Clip {
  const constrainedOffset = constrainSlipOffset(
    newOffset,
    clip.duration,
    bufferDuration
  );

  return {
    ...clip,
    offset: constrainedOffset,
  };
}

/**
 * Reset slip to zero offset
 */
export function resetSlip(clip: Clip): Clip {
  return {
    ...clip,
    offset: 0,
  };
}

/**
 * Get slip constraints for a clip
 */
export function getSlipConstraints(
  clip: Clip,
  bufferDuration: number
): SlipConstraints {
  return {
    minOffset: 0,
    maxOffset: Math.max(0, bufferDuration - clip.duration),
    bufferDuration,
  };
}

// =============================================================================
// Visual Feedback
// =============================================================================

/**
 * Calculate visual offset for waveform during slip
 */
export function calculateVisualSlipOffset(
  clip: Clip,
  pixelsPerBeat: number,
  tempo: number
): number {
  // Convert seconds offset to pixels
  const beatOffset = (clip.offset * tempo) / 60;
  return beatOffset * pixelsPerBeat;
}

/**
 * Generate slip preview path
 */
export function generateSlipPreviewPath(
  clipWidth: number,
  clipHeight: number,
  slipOffset: number,
  waveformData?: Float32Array
): string {
  if (!waveformData) return '';

  const centerY = clipHeight / 2;
  const samplesPerPixel = waveformData.length / 2 / clipWidth;
  let path = `M 0 ${centerY}`;

  for (let x = 0; x < clipWidth; x++) {
    const sampleIdx = Math.floor((x + slipOffset) * samplesPerPixel);
    if (sampleIdx >= 0 && sampleIdx < waveformData.length / 2) {
      const min = waveformData[sampleIdx * 2];
      const max = waveformData[sampleIdx * 2 + 1];
      const amplitude = (max - min) * centerY;
      path += ` L ${x} ${centerY - amplitude}`;
    }
  }

  return path;
}

// =============================================================================
// Slip Editing Manager
// =============================================================================

export class SlipEditingManager {
  private state: SlipState = {
    isSlipping: false,
    clipId: null,
    startX: 0,
    originalOffset: 0,
    originalDuration: 0,
    currentOffset: 0,
  };

  private pixelsPerBeat: number = 40;
  private tempo: number = 120;

  constructor(pixelsPerBeat?: number, tempo?: number) {
    if (pixelsPerBeat) this.pixelsPerBeat = pixelsPerBeat;
    if (tempo) this.tempo = tempo;
  }

  /**
   * Start slip editing
   */
  startSlip(clip: Clip, startX: number): boolean {
    if (!canSlip(clip)) return false;

    this.state = {
      isSlipping: true,
      clipId: clip.id,
      startX,
      originalOffset: clip.offset || 0,
      originalDuration: clip.duration,
      currentOffset: clip.offset || 0,
    };

    return true;
  }

  /**
   * Update slip during drag
   */
  updateSlip(currentX: number, bufferDuration: number): number {
    if (!this.state.isSlipping) return this.state.currentOffset;

    const deltaPixels = currentX - this.state.startX;
    const newOffset = calculateSlipOffset(
      this.state.originalOffset,
      deltaPixels,
      this.pixelsPerBeat,
      this.tempo
    );

    this.state.currentOffset = constrainSlipOffset(
      newOffset,
      this.state.originalDuration,
      bufferDuration
    );

    return this.state.currentOffset;
  }

  /**
   * End slip editing
   */
  endSlip(): { clipId: string; offset: number } | null {
    if (!this.state.isSlipping) return null;

    const result = {
      clipId: this.state.clipId!,
      offset: this.state.currentOffset,
    };

    this.state = {
      isSlipping: false,
      clipId: null,
      startX: 0,
      originalOffset: 0,
      originalDuration: 0,
      currentOffset: 0,
    };

    return result;
  }

  /**
   * Cancel slip operation
   */
  cancelSlip(): string | null {
    if (!this.state.isSlipping) return null;
    const clipId = this.state.clipId;
    
    this.state = {
      isSlipping: false,
      clipId: null,
      startX: 0,
      originalOffset: 0,
      originalDuration: 0,
      currentOffset: 0,
    };

    return clipId;
  }

  /**
   * Check if currently slipping
   */
  isSlipping(): boolean {
    return this.state.isSlipping;
  }

  /**
   * Get current slip state
   */
  getState(): SlipState {
    return { ...this.state };
  }

  /**
   * Get current offset during slip
   */
  getCurrentOffset(): number {
    return this.state.currentOffset;
  }

  /**
   * Update pixels per beat
   */
  setPixelsPerBeat(pixelsPerBeat: number): void {
    this.pixelsPerBeat = pixelsPerBeat;
  }

  /**
   * Update tempo
   */
  setTempo(tempo: number): void {
    this.tempo = tempo;
  }
}

// =============================================================================
// Export
// =============================================================================

export function createSlipEditingManager(
  pixelsPerBeat?: number,
  tempo?: number
): SlipEditingManager {
  return new SlipEditingManager(pixelsPerBeat, tempo);
}
