/**
 * Clip Editor - Core editing engine for DAW clips
 * 
 * Handles all clip editing operations with performance optimization:
 * - Pointer events for smooth drag interactions
 * - RequestAnimationFrame for visual updates
 * - Grid snapping with magnetic threshold
 * - Multi-clip selection support
 */

import {
  Clip,
  ClipDragState,
  ClipSelectionState,
  HandleType,
  GridSettings,
  SnapResult,
  ClipBounds,
  FadeSettings,
} from './types';

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  HANDLE_WIDTH: 6,              // Pixels for trim handle detection
  FADE_HANDLE_HEIGHT: 12,     // Pixels for fade handle size
  MIN_CLIP_DURATION: 0.1,     // Minimum clip duration in beats
  SNAP_THRESHOLD: 8,          // Pixels for magnetic snap
  SCROLL_THRESHOLD: 50,       // Pixels from edge to trigger scroll
  DRAG_START_THRESHOLD: 3,    // Pixels before drag starts
};

// =============================================================================
// Coordinate Conversions
// =============================================================================

export class ClipEditor {
  private pixelsPerBeat: number;
  private gridSettings: GridSettings;
  private tempo: number;

  constructor(pixelsPerBeat: number, tempo: number = 120, gridSettings?: GridSettings) {
    this.pixelsPerBeat = pixelsPerBeat;
    this.tempo = tempo;
    this.gridSettings = gridSettings ?? {
      division: '1/4',
      snapEnabled: true,
      snapThreshold: CONFIG.SNAP_THRESHOLD,
      showGridLines: true,
    };
  }

  /**
   * Convert beat position to pixel X coordinate
   */
  beatToPixel(beat: number): number {
    return beat * this.pixelsPerBeat;
  }

  /**
   * Convert pixel X coordinate to beat position
   */
  pixelToBeat(pixel: number): number {
    return pixel / this.pixelsPerBeat;
  }

  /**
   * Convert time (seconds) to beats
   */
  timeToBeats(seconds: number): number {
    return (seconds * this.tempo) / 60;
  }

  /**
   * Convert beats to time (seconds)
   */
  beatsToTime(beats: number): number {
    return (beats * 60) / this.tempo;
  }

  // =============================================================================
  // Hit Detection
  // =============================================================================

  /**
   * Determine which part of a clip was clicked
   */
  getHandleType(
    clip: Clip,
    mouseX: number,
    mouseY: number,
    clipBounds: ClipBounds
  ): HandleType | null {
    const { x, y, width, height } = clipBounds;
    
    // Check if within clip bounds vertically
    if (mouseY < y || mouseY > y + height) {
      return null;
    }

    // Check if within clip bounds horizontally
    if (mouseX < x || mouseX > x + width) {
      return null;
    }

    // Check fade handles first (inner area near edges)
    const fadeHandleWidth = Math.min(width * 0.3, 50);
    
    // Fade in handle (left side, upper portion)
    if (mouseX >= x && mouseX <= x + fadeHandleWidth && mouseY <= y + CONFIG.FADE_HANDLE_HEIGHT) {
      return 'fadeIn';
    }

    // Fade out handle (right side, upper portion)
    if (mouseX >= x + width - fadeHandleWidth && mouseX <= x + width && mouseY <= y + CONFIG.FADE_HANDLE_HEIGHT) {
      return 'fadeOut';
    }

    // Check trim handles (edges)
    if (mouseX >= x && mouseX <= x + CONFIG.HANDLE_WIDTH) {
      return 'left';
    }

    if (mouseX >= x + width - CONFIG.HANDLE_WIDTH && mouseX <= x + width) {
      return 'right';
    }

    // Body (center area)
    return 'body';
  }

  /**
   * Check if point is within clip bounds
   */
  isPointInClip(
    clip: Clip,
    mouseX: number,
    mouseY: number,
    trackY: number,
    trackHeight: number
  ): boolean {
    const clipX = this.beatToPixel(clip.startTime);
    const clipWidth = this.beatToPixel(clip.duration);

    return (
      mouseX >= clipX &&
      mouseX <= clipX + clipWidth &&
      mouseY >= trackY &&
      mouseY <= trackY + trackHeight
    );
  }

  // =============================================================================
  // Grid Snapping
  // =============================================================================

  /**
   * Get snap division in beats based on current zoom
   */
  getSnapDivision(): number {
    const divisions: Record<string, number> = {
      '1/1': 4,
      '1/2': 2,
      '1/4': 1,
      '1/8': 0.5,
      '1/16': 0.25,
      '1/32': 0.125,
      '1/64': 0.0625,
    };
    return divisions[this.gridSettings.division] ?? 1;
  }

  /**
   * Calculate nearest grid line position
   */
  getNearestGridLine(beatPosition: number): number {
    const division = this.getSnapDivision();
    return Math.round(beatPosition / division) * division;
  }

  /**
   * Snap beat position to grid if within threshold
   */
  snapToGrid(beatPosition: number, pixelX: number): SnapResult {
    if (!this.gridSettings.snapEnabled) {
      return { snapped: false, value: beatPosition, distance: 0 };
    }

    const targetGridBeat = this.getNearestGridLine(beatPosition);
    const targetPixelX = this.beatToPixel(targetGridBeat);
    const pixelDistance = Math.abs(targetPixelX - pixelX);

    if (pixelDistance <= this.gridSettings.snapThreshold) {
      return {
        snapped: true,
        value: targetGridBeat,
        distance: pixelDistance,
      };
    }

    return { snapped: false, value: beatPosition, distance: pixelDistance };
  }

  /**
   * Dynamic snap division based on zoom level
   */
  updateSnapDivisionForZoom(pixelsPerBeat: number): void {
    this.pixelsPerBeat = pixelsPerBeat;
    
    // Auto-adjust grid division based on zoom
    if (pixelsPerBeat < 20) {
      this.gridSettings.division = '1/1';
    } else if (pixelsPerBeat < 40) {
      this.gridSettings.division = '1/2';
    } else if (pixelsPerBeat < 80) {
      this.gridSettings.division = '1/4';
    } else if (pixelsPerBeat < 160) {
      this.gridSettings.division = '1/8';
    } else if (pixelsPerBeat < 320) {
      this.gridSettings.division = '1/16';
    } else {
      this.gridSettings.division = '1/32';
    }
  }

  // =============================================================================
  // Drag Calculations
  // =============================================================================

  /**
   * Calculate new clip position during drag
   */
  calculateDragPosition(
    dragState: ClipDragState,
    currentX: number,
    shiftKey: boolean
  ): { newStartTime: number; isSnapped: boolean } {
    const deltaPixels = currentX - dragState.startX;
    const deltaBeats = this.pixelToBeat(deltaPixels);
    const newStartTime = dragState.originalStartTime + deltaBeats;

    // Apply snap unless shift is held (precision mode)
    if (!shiftKey && this.gridSettings.snapEnabled) {
      const pixelX = this.beatToPixel(newStartTime);
      const snapResult = this.snapToGrid(newStartTime, pixelX);
      return {
        newStartTime: snapResult.value,
        isSnapped: snapResult.snapped,
      };
    }

    return { newStartTime, isSnapped: false };
  }

  /**
   * Calculate new clip duration during trim
   */
  calculateTrim(
    dragState: ClipDragState,
    currentX: number,
    handleType: 'left' | 'right',
    shiftKey: boolean
  ): { newStartTime: number; newDuration: number; newOffset: number } {
    const deltaPixels = currentX - dragState.startX;
    const deltaBeats = this.pixelToBeat(deltaPixels);

    if (handleType === 'left') {
      // Trimming left edge
      let newStartTime = dragState.originalStartTime + deltaBeats;
      let newDuration = dragState.originalDuration - deltaBeats;
      let newOffset = (dragState.originalOffset || 0) + deltaBeats;

      // Apply constraints
      if (newDuration < CONFIG.MIN_CLIP_DURATION) {
        newDuration = CONFIG.MIN_CLIP_DURATION;
        newStartTime = dragState.originalStartTime + dragState.originalDuration - CONFIG.MIN_CLIP_DURATION;
        newOffset = (dragState.originalOffset || 0) + dragState.originalDuration - CONFIG.MIN_CLIP_DURATION;
      }

      // Snap
      if (!shiftKey && this.gridSettings.snapEnabled) {
        const snapResult = this.snapToGrid(newStartTime, this.beatToPixel(newStartTime));
        if (snapResult.snapped) {
          const diff = snapResult.value - newStartTime;
          newStartTime = snapResult.value;
          newDuration -= diff;
          newOffset += diff;
        }
      }

      return { newStartTime, newDuration, newOffset };
    } else {
      // Trimming right edge
      let newDuration = dragState.originalDuration + deltaBeats;

      // Apply minimum duration
      if (newDuration < CONFIG.MIN_CLIP_DURATION) {
        newDuration = CONFIG.MIN_CLIP_DURATION;
      }

      // Snap
      if (!shiftKey && this.gridSettings.snapEnabled) {
        const endTime = dragState.originalStartTime + newDuration;
        const snapResult = this.snapToGrid(endTime, this.beatToPixel(endTime));
        if (snapResult.snapped) {
          newDuration = snapResult.value - dragState.originalStartTime;
        }
      }

      return {
        newStartTime: dragState.originalStartTime,
        newDuration,
        newOffset: dragState.originalOffset || 0,
      };
    }
  }

  /**
   * Calculate stretch (time-stretch) operation
   */
  calculateStretch(
    dragState: ClipDragState,
    currentX: number
  ): { newDuration: number; playbackRate: number } {
    const deltaPixels = currentX - dragState.startX;
    const deltaBeats = this.pixelToBeat(deltaPixels);
    
    let newDuration = dragState.originalDuration + deltaBeats;
    
    // Ensure minimum duration
    if (newDuration < CONFIG.MIN_CLIP_DURATION) {
      newDuration = CONFIG.MIN_CLIP_DURATION;
    }

    // Calculate playback rate
    const playbackRate = dragState.originalDuration / newDuration;

    return { newDuration, playbackRate };
  }

  /**
   * Calculate fade handle drag
   */
  calculateFadeDrag(
    clip: Clip,
    handleType: 'fadeIn' | 'fadeOut',
    currentX: number,
    clipX: number,
    clipWidth: number
  ): FadeSettings {
    const relativeX = currentX - clipX;
    const maxFadeBeats = clip.duration * 0.5; // Max 50% of clip
    
    let fadeDuration: number;
    
    if (handleType === 'fadeIn') {
      // Fade in from left edge
      const pixelFade = Math.max(0, Math.min(relativeX, clipWidth * 0.5));
      fadeDuration = this.pixelToBeat(pixelFade);
    } else {
      // Fade out from right edge
      const pixelFade = Math.max(0, Math.min(clipWidth - relativeX, clipWidth * 0.5));
      fadeDuration = this.pixelToBeat(pixelFade);
    }

    // Clamp to maximum
    fadeDuration = Math.min(fadeDuration, maxFadeBeats);

    return {
      duration: fadeDuration,
      curve: clip.fadeIn?.curve || 'exponential',
      gain: 1.0,
    };
  }

  // =============================================================================
  // Multi-Selection
  // =============================================================================

  /**
   * Get clips within selection rectangle
   */
  getClipsInSelection(
    clips: Clip[],
    selectionX: number,
    selectionY: number,
    selectionWidth: number,
    selectionHeight: number,
    trackYs: Map<string, number>,
    trackHeight: number
  ): string[] {
    const selectedIds: string[] = [];

    for (const clip of clips) {
      const trackY = trackYs.get(clip.trackId);
      if (trackY === undefined) continue;

      const clipX = this.beatToPixel(clip.startTime);
      const clipWidth = this.beatToPixel(clip.duration);
      const clipY = trackY;

      // Check intersection
      const intersects = !(
        clipX + clipWidth < selectionX ||
        clipX > selectionX + selectionWidth ||
        clipY + trackHeight < selectionY ||
        clipY > selectionY + selectionHeight
      );

      if (intersects) {
        selectedIds.push(clip.id);
      }
    }

    return selectedIds;
  }

  // =============================================================================
  // Clip Bounds Calculation
  // =============================================================================

  /**
   * Calculate pixel bounds for a clip
   */
  getClipBounds(
    clip: Clip,
    trackY: number,
    trackHeight: number
  ): ClipBounds {
    return {
      x: this.beatToPixel(clip.startTime),
      y: trackY,
      width: Math.max(this.beatToPixel(clip.duration), 2), // Minimum 2px visible
      height: trackHeight,
    };
  }

  /**
   * Check if clip is visible in viewport
   */
  isClipVisible(
    clip: Clip,
    viewportStart: number,
    viewportEnd: number
  ): boolean {
    const clipStart = clip.startTime;
    const clipEnd = clip.startTime + clip.duration;

    return clipEnd >= viewportStart && clipStart <= viewportEnd;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate unique clip ID
 */
export function generateClipId(): string {
  return `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Deep clone a clip
 */
export function cloneClip(clip: Clip, newId?: string): Clip {
  return {
    ...clip,
    id: newId || generateClipId(),
    isSelected: false,
    isDragging: false,
    waveformCache: undefined, // Don't clone cache
  };
}

/**
 * Check if two clips overlap
 */
export function clipsOverlap(clipA: Clip, clipB: Clip): boolean {
  if (clipA.trackId !== clipB.trackId) return false;
  
  const aStart = clipA.startTime;
  const aEnd = clipA.startTime + clipA.duration;
  const bStart = clipB.startTime;
  const bEnd = clipB.startTime + clipB.duration;

  return aStart < bEnd && aEnd > bStart;
}

/**
 * Merge overlapping clips (for consolidation)
 */
export function mergeOverlappingClips(clips: Clip[]): Clip[] {
  // Sort by start time
  const sorted = [...clips].sort((a, b) => a.startTime - b.startTime);
  const merged: Clip[] = [];

  for (const clip of sorted) {
    const last = merged[merged.length - 1];
    
    if (last && last.trackId === clip.trackId && clipsOverlap(last, clip)) {
      // Merge - extend duration
      last.duration = Math.max(
        last.startTime + last.duration,
        clip.startTime + clip.duration
      ) - last.startTime;
    } else {
      merged.push(cloneClip(clip));
    }
  }

  return merged;
}

// =============================================================================
// Export singleton instance creator
// =============================================================================

export function createClipEditor(
  pixelsPerBeat: number,
  tempo?: number,
  gridSettings?: GridSettings
): ClipEditor {
  return new ClipEditor(pixelsPerBeat, tempo, gridSettings);
}
