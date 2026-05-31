/**
 * Clip Tools - Clip manipulation operations
 * 
 * Provides atomic operations for:
 * - Splitting clips
 * - Duplicating clips
 * - Trimming clips
 * - Reversing clips
 * - Normalizing clips
 * - Merging clips
 */

import {
  Clip,
  MidiNote,
  SplitOperation,
  DuplicateOperation,
  TrimOperation,
  StretchOperation,
  FadeSettings,
} from './types';
import { generateClipId, cloneClip } from './clipEditor';

// =============================================================================
// Split Operations
// =============================================================================

/**
 * Split a clip at a specific beat position
 * Returns two new clips that replace the original
 */
export function splitClip(clip: Clip, splitTime: number): [Clip, Clip] | null {
  // Validate split position
  if (splitTime <= clip.startTime || splitTime >= clip.startTime + clip.duration) {
    return null; // Cannot split at edges
  }

  const splitOffset = splitTime - clip.startTime;

  // Create left clip (original start to split point)
  const leftClip: Clip = {
    ...clip,
    id: generateClipId(),
    duration: splitOffset,
    fadeOut: { duration: 0, curve: 'linear', gain: 1 }, // Reset fade out
    isSelected: false,
  };

  // Create right clip (split point to original end)
  const rightClip: Clip = {
    ...clip,
    id: generateClipId(),
    startTime: splitTime,
    duration: clip.duration - splitOffset,
    offset: (clip.offset || 0) + splitOffset,
    fadeIn: { duration: 0, curve: 'linear', gain: 1 }, // Reset fade in
    isSelected: false,
  };

  // Handle MIDI notes splitting
  if (clip.type === 'midi' && clip.notes) {
    leftClip.notes = clip.notes.filter(note => note.start + note.duration <= splitOffset);
    rightClip.notes = clip.notes
      .filter(note => note.start >= splitOffset)
      .map(note => ({
        ...note,
        start: note.start - splitOffset,
      }));

    // Notes that cross the split need to be truncated in left and created in right
    const crossingNotes = clip.notes.filter(
      note => note.start < splitOffset && note.start + note.duration > splitOffset
    );

    for (const note of crossingNotes) {
      // Truncated note for left clip
      leftClip.notes!.push({
        ...note,
        duration: splitOffset - note.start,
      });

      // New note for right clip
      rightClip.notes!.push({
        ...note,
        start: 0,
        duration: note.start + note.duration - splitOffset,
      });
    }
  }

  return [leftClip, rightClip];
}

/**
 * Split multiple clips at a given time (split tool across tracks)
 */
export function splitClipsAtTime(clips: Clip[], splitTime: number): Clip[] {
  const result: Clip[] = [];

  for (const clip of clips) {
    const clipEnd = clip.startTime + clip.duration;
    
    // Check if split time is within this clip
    if (splitTime > clip.startTime && splitTime < clipEnd) {
      const splitResult = splitClip(clip, splitTime);
      if (splitResult) {
        result.push(...splitResult);
      } else {
        result.push(clip);
      }
    } else {
      result.push(clip);
    }
  }

  return result;
}

// =============================================================================
// Duplicate Operations
// =============================================================================

/**
 * Duplicate a clip with optional offset
 */
export function duplicateClip(
  clip: Clip,
  offsetBeats: number = 4,
  newTrackId?: string
): Clip {
  const duplicated = cloneClip(clip);
  
  duplicated.startTime += offsetBeats;
  
  if (newTrackId) {
    duplicated.trackId = newTrackId;
  }

  // Reset transient states
  duplicated.isSelected = false;
  duplicated.isDragging = false;

  // Update name to indicate duplicate
  const baseName = clip.name.replace(/\s*\(\d+\)$/, '');
  duplicated.name = `${baseName} (2)`;

  return duplicated;
}

/**
 * Duplicate multiple clips while maintaining relative positions
 */
export function duplicateClips(
  clips: Clip[],
  offsetBeats: number = 4,
  newTrackIds?: Map<string, string>
): Clip[] {
  if (clips.length === 0) return [];

  // Find the earliest clip to use as reference
  const earliestClip = clips.reduce((earliest, clip) =>
    clip.startTime < earliest.startTime ? clip : earliest
  );

  return clips.map(clip => {
    // Calculate relative offset from earliest clip
    const relativeOffset = clip.startTime - earliestClip.startTime;
    const absoluteOffset = earliestClip.startTime + offsetBeats + relativeOffset;

    const newTrackId = newTrackIds?.get(clip.trackId);
    
    const duplicated = duplicateClip(clip, 0, newTrackId);
    duplicated.startTime = absoluteOffset;

    return duplicated;
  });
}

// =============================================================================
// Trim Operations
// =============================================================================

/**
 * Apply trim operation to a clip
 */
export function trimClip(clip: Clip, operation: TrimOperation): Clip {
  return {
    ...clip,
    startTime: operation.newStartTime ?? clip.startTime,
    duration: operation.newDuration,
    offset: operation.newOffset ?? clip.offset ?? 0,
  };
}

/**
 * Trim clip to selection range
 */
export function trimClipToRange(
  clip: Clip,
  rangeStart: number,
  rangeEnd: number
): Clip | null {
  const clipEnd = clip.startTime + clip.duration;

  // Check if clip overlaps with range
  if (clipEnd <= rangeStart || clip.startTime >= rangeEnd) {
    return null; // Clip is completely outside range
  }

  const newStartTime = Math.max(clip.startTime, rangeStart);
  const newEndTime = Math.min(clipEnd, rangeEnd);
  const newDuration = newEndTime - newStartTime;
  const offsetDelta = newStartTime - clip.startTime;

  return {
    ...clip,
    startTime: newStartTime,
    duration: newDuration,
    offset: (clip.offset || 0) + offsetDelta,
  };
}

// =============================================================================
// Stretch/Time Operations
// =============================================================================

/**
 * Apply time stretch to a clip
 */
export function stretchClip(clip: Clip, operation: StretchOperation): Clip {
  return {
    ...clip,
    duration: operation.newDuration,
    playbackRate: operation.newPlaybackRate,
    stretchMode: 'time',
  };
}

/**
 * Change clip playback rate while maintaining visual duration
 */
export function changePlaybackRate(clip: Clip, newRate: number): Clip {
  // Adjust duration to compensate for rate change
  // Higher rate = shorter duration
  const rateRatio = clip.playbackRate / newRate;
  const newDuration = clip.duration * rateRatio;

  return {
    ...clip,
    playbackRate: newRate,
    duration: newDuration,
  };
}

/**
 * Pitch shift without changing duration
 */
export function pitchShift(clip: Clip, semitones: number): Clip {
  return {
    ...clip,
    pitchOffset: clip.pitchOffset + semitones,
  };
}

// =============================================================================
// Audio Processing Operations
// =============================================================================

/**
 * Reverse a clip (play backwards)
 */
export function reverseClip(clip: Clip): Clip {
  return {
    ...clip,
    playbackRate: -Math.abs(clip.playbackRate), // Negative rate = reverse
  };
}

/**
 * Check if clip is reversed
 */
export function isClipReversed(clip: Clip): boolean {
  return clip.playbackRate < 0;
}

/**
 * Normalize clip (placeholder for actual audio processing)
 * In real implementation, this would analyze audio and adjust gain
 */
export function normalizeClip(clip: Clip, targetPeak: number = 0.95): Clip {
  // This is a placeholder - real implementation would:
  // 1. Analyze audio buffer to find peak amplitude
  // 2. Calculate gain needed to reach targetPeak
  // 3. Apply gain to clip or audio buffer

  return {
    ...clip,
    // Add a flag or property to indicate normalization was applied
    // normalized: true,
    // normalizationGain: calculatedGain,
  };
}

// =============================================================================
// Fade Operations
// =============================================================================

/**
 * Update clip fade settings
 */
export function updateFade(
  clip: Clip,
  fadeType: 'in' | 'out',
  settings: Partial<FadeSettings>
): Clip {
  if (fadeType === 'in') {
    return {
      ...clip,
      fadeIn: {
        ...clip.fadeIn,
        ...settings,
      },
    };
  } else {
    return {
      ...clip,
      fadeOut: {
        ...clip.fadeOut,
        ...settings,
      },
    };
  }
}

/**
 * Calculate fade gain at a specific point in time
 */
export function calculateFadeGain(
  fade: FadeSettings,
  position: number,    // 0 to fade.duration
  fadeType: 'in' | 'out'
): number {
  if (fade.duration === 0) {
    return fadeType === 'in' ? 0 : 1;
  }

  const t = Math.max(0, Math.min(1, position / fade.duration));
  let gain: number;

  switch (fade.curve) {
    case 'linear':
      gain = t;
      break;
    case 'exponential':
      gain = t * t;
      break;
    case 'logarithmic':
      gain = Math.sqrt(t);
      break;
    case 'scurve':
      // Smooth step function
      gain = t * t * (3 - 2 * t);
      break;
    default:
      gain = t;
  }

  // For fade out, invert the gain
  if (fadeType === 'out') {
    gain = 1 - gain;
  }

  return gain * fade.gain;
}

// =============================================================================
// Clip Movement
// =============================================================================

/**
 * Move clip to new position
 */
export function moveClip(
  clip: Clip,
  newStartTime: number,
  newTrackId?: string
): Clip {
  return {
    ...clip,
    startTime: newStartTime,
    trackId: newTrackId ?? clip.trackId,
  };
}

/**
 * Move multiple clips while maintaining relative positions
 */
export function moveClipsRelative(
  clips: Clip[],
  deltaBeats: number,
  deltaTrackIndex: number = 0,
  trackIds: string[] = []
): Clip[] {
  return clips.map((clip, index) => {
    const newTrackId = deltaTrackIndex !== 0 && trackIds.length > 0
      ? trackIds[Math.max(0, Math.min(trackIds.length - 1, index + deltaTrackIndex))]
      : clip.trackId;

    return moveClip(clip, clip.startTime + deltaBeats, newTrackId);
  });
}

// =============================================================================
// Clip Merging
// =============================================================================

/**
 * Merge adjacent clips (must be on same track with no gap)
 */
export function mergeClips(clips: Clip[]): Clip | null {
  if (clips.length < 2) return clips[0] ?? null;

  // Sort by start time
  const sorted = [...clips].sort((a, b) => a.startTime - b.startTime);
  
  // Verify all clips are on same track
  const trackId = sorted[0].trackId;
  if (!sorted.every(c => c.trackId === trackId)) {
    return null; // Cannot merge clips from different tracks
  }

  // Check for gaps
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev.startTime + prev.duration < curr.startTime - 0.001) {
      return null; // Gap exists, cannot merge
    }
  }

  // Create merged clip
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  // For audio clips, we'd need to actually concatenate the buffers
  // This is a simplified version that just extends the duration
  return {
    ...first,
    id: generateClipId(),
    duration: last.startTime + last.duration - first.startTime,
    name: `${first.name} (Merged)`,
    fadeIn: first.fadeIn,
    fadeOut: last.fadeOut,
    // Note: In real implementation, we'd merge the actual audio buffers
  };
}

// =============================================================================
// Utility Operations
// =============================================================================

/**
 * Rename a clip
 */
export function renameClip(clip: Clip, newName: string): Clip {
  return {
    ...clip,
    name: newName,
  };
}

/**
 * Mute/unmute a clip
 */
export function toggleClipMute(clip: Clip): Clip {
  return {
    ...clip,
    muted: !clip.muted,
  };
}

/**
 * Set clip color
 */
export function setClipColor(clip: Clip, color: string): Clip {
  return {
    ...clip,
    color,
  };
}

/**
 * Lock/unlock a clip (prevent editing)
 */
export function toggleClipLock(clip: Clip, locked?: boolean): Clip {
  return {
    ...clip,
    // locked: locked ?? !clip.locked,
  };
}

// =============================================================================
// MIDI Specific Operations
// =============================================================================

/**
 * Transpose MIDI notes in a clip
 */
export function transposeMidiClip(clip: Clip, semitones: number): Clip {
  if (clip.type !== 'midi' || !clip.notes) return clip;

  return {
    ...clip,
    notes: clip.notes.map(note => ({
      ...note,
      pitch: Math.max(0, Math.min(127, note.pitch + semitones)),
    })),
  };
}

/**
 * Quantize MIDI notes to grid
 */
export function quantizeMidiClip(
  clip: Clip,
  gridDivision: number,
  strength: number = 1.0
): Clip {
  if (clip.type !== 'midi' || !clip.notes) return clip;

  return {
    ...clip,
    notes: clip.notes.map(note => {
      const quantizedStart = Math.round(note.start / gridDivision) * gridDivision;
      const diff = quantizedStart - note.start;
      const newStart = note.start + diff * strength;

      return {
        ...note,
        start: newStart,
      };
    }),
  };
}

/**
 * Adjust velocity of all MIDI notes
 */
export function adjustMidiVelocity(clip: Clip, delta: number): Clip {
  if (clip.type !== 'midi' || !clip.notes) return clip;

  return {
    ...clip,
    notes: clip.notes.map(note => ({
      ...note,
      velocity: Math.max(1, Math.min(127, note.velocity + delta)),
    })),
  };
}
