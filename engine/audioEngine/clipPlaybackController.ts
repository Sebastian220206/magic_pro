/**
 * Clip Playback Controller - Audio engine integration for clip playback
 * 
 * Manages:
 * - Scheduled playback with timing precision
 * - Fade curves (gain automation)
 * - Time stretching (playbackRate)
 * - Pitch shifting (detune)
 * - Reverse playback
 * - Multi-clip scheduling
 */

import { Clip, ClipAudioConfig, FadeCurve, FadeCurveType } from '../timeline/types';

// =============================================================================
// Types
// =============================================================================

interface ScheduledClip {
  clip: Clip;
  sourceNode: AudioBufferSourceNode;
  gainNode: GainNode;
  fadeInNode?: GainNode;
  fadeOutNode?: GainNode;
  startTime: number;
  scheduledEnd: number;
}

interface PlaybackContext {
  audioContext: AudioContext;
  destination: AudioNode;
  tempo: number;
  playheadBeat: number;
  isPlaying: boolean;
}

// =============================================================================
// Gain Curve Calculations
// =============================================================================

/**
 * Create an AudioParam automation for fade curves
 */
export function applyFadeCurve(
  gainParam: AudioParam,
  fade: FadeCurve,
  startTime: number,
  duration: number,
  audioContext: AudioContext
): void {
  const curveType = fade.type;
  const steps = Math.max(10, Math.floor(duration * audioContext.sampleRate / 100));
  const curve = new Float32Array(steps);

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    curve[i] = calculateFadeValue(t, curveType);
  }

  // Apply curve
  gainParam.setValueCurveAtTime(curve, startTime, duration);
}

/**
 * Calculate fade value at time t (0-1)
 */
export function calculateFadeValue(t: number, curveType: FadeCurveType): number {
  switch (curveType) {
    case 'linear':
      return t;
    case 'exponential':
      // Exponential fade: prevents clicking
      return Math.pow(t, 2);
    case 'logarithmic':
      return Math.sqrt(t);
    case 'scurve':
      // Smoothstep: 3t^2 - 2t^3
      return t * t * (3 - 2 * t);
    default:
      return t;
  }
}

/**
 * Create fade automation using exponentialRamp
 */
export function applyExponentialFade(
  gainParam: AudioParam,
  startValue: number,
  endValue: number,
  startTime: number,
  duration: number,
  fadeType: 'in' | 'out'
): void {
  // Prevent zero values for exponential ramp
  const safeStart = Math.max(0.001, startValue);
  const safeEnd = Math.max(0.001, endValue);

  gainParam.setValueAtTime(fadeType === 'in' ? 0.001 : safeStart, startTime);
  
  if (fadeType === 'in') {
    gainParam.exponentialRampToValueAtTime(safeEnd, startTime + duration);
  } else {
    gainParam.exponentialRampToValueAtTime(0.001, startTime + duration);
  }
}

// =============================================================================
// Clip Playback Controller
// =============================================================================

export class ClipPlaybackController {
  private audioContext: AudioContext;
  private destination: AudioNode;
  private scheduledClips: Map<string, ScheduledClip> = new Map();
  private tempo = 120;
  private isPlaying = false;

  constructor(audioContext: AudioContext, destination: AudioNode = audioContext.destination) {
    this.audioContext = audioContext;
    this.destination = destination;
  }

  /**
   * Convert beat position to AudioContext time
   */
  beatToTime(beat: number, playheadBeat: number, playheadTime: number): number {
    const beatDelta = beat - playheadBeat;
    const timeDelta = (beatDelta * 60) / this.tempo;
    return playheadTime + timeDelta;
  }

  /**
   * Schedule a clip for playback
   */
  scheduleClip(
    clip: Clip,
    buffer: AudioBuffer,
    playheadBeat: number,
    playheadTime: number,
    masterGain: number = 1.0
  ): void {
    // Calculate timing
    const clipStartTime = this.beatToTime(clip.startTime, playheadBeat, playheadTime);
    const clipDuration = (clip.duration * 60) / this.tempo;
    const offsetSeconds = ((clip.offset || 0) * 60) / this.tempo;

    // Stop if already scheduled
    this.unscheduleClip(clip.id);

    // Create source node
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = Math.abs(clip.playbackRate);

    // Apply detune for pitch shifting
    if (clip.pitchOffset !== 0) {
      source.detune.value = clip.pitchOffset * 100; // semitones to cents
    }

    // Handle reverse playback
    if (clip.playbackRate < 0) {
      source.playbackRate.value = -clip.playbackRate;
      // For reverse, we play from the end
      // This is a simplified approach - full reverse requires buffer manipulation
    }

    // Create gain nodes for fades
    const fadeInGain = this.audioContext.createGain();
    const fadeOutGain = this.audioContext.createGain();
    const clipGain = this.audioContext.createGain();

    // Connect chain: source -> fadeIn -> fadeOut -> clipGain -> destination
    source.connect(fadeInGain);
    fadeInGain.connect(fadeOutGain);
    fadeOutGain.connect(clipGain);
    clipGain.connect(this.destination);

    // Apply fade in
    if (clip.fadeIn.duration > 0) {
      const fadeInDuration = (clip.fadeIn.duration * 60) / this.tempo;
      applyFadeCurve(
        fadeInGain.gain,
        { type: clip.fadeIn.curve, duration: fadeInDuration, startGain: 0, endGain: 1 },
        clipStartTime,
        Math.min(fadeInDuration, clipDuration),
        this.audioContext
      );
    } else {
      fadeInGain.gain.setValueAtTime(1, clipStartTime);
    }

    // Apply fade out
    if (clip.fadeOut.duration > 0) {
      const fadeOutDuration = (clip.fadeOut.duration * 60) / this.tempo;
      const fadeOutStart = clipStartTime + clipDuration - fadeOutDuration;
      
      // Fade out starts at 1 and goes to 0
      fadeOutGain.gain.setValueAtTime(1, Math.max(clipStartTime, fadeOutStart - 0.001));
      applyFadeCurve(
        fadeOutGain.gain,
        { type: clip.fadeOut.curve, duration: fadeOutDuration, startGain: 1, endGain: 0 },
        Math.max(clipStartTime, fadeOutStart),
        Math.min(fadeOutDuration, clipDuration),
        this.audioContext
      );
    } else {
      fadeOutGain.gain.setValueAtTime(1, clipStartTime);
    }

    // Set clip gain
    clipGain.gain.setValueAtTime(masterGain, clipStartTime);

    // Calculate actual duration considering playback rate
    const actualDuration = clipDuration / Math.abs(clip.playbackRate);

    // Start playback
    if (clip.playbackRate < 0) {
      // Reverse playback - start from end of buffer
      const bufferDuration = buffer.duration;
      const startOffset = bufferDuration - offsetSeconds - actualDuration;
      source.start(clipStartTime, Math.max(0, startOffset), actualDuration);
    } else {
      source.start(clipStartTime, offsetSeconds, actualDuration);
    }

    // Store scheduled clip
    const scheduled: ScheduledClip = {
      clip,
      sourceNode: source,
      gainNode: clipGain,
      fadeInNode: fadeInGain,
      fadeOutNode: fadeOutGain,
      startTime: clipStartTime,
      scheduledEnd: clipStartTime + actualDuration,
    };

    this.scheduledClips.set(clip.id, scheduled);

    // Cleanup when done
    source.onended = () => {
      this.scheduledClips.delete(clip.id);
      
      // Disconnect nodes
      try {
        source.disconnect();
        fadeInGain.disconnect();
        fadeOutGain.disconnect();
        clipGain.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    };
  }

  /**
   * Unschedule a clip (stop playback)
   */
  unscheduleClip(clipId: string): void {
    const scheduled = this.scheduledClips.get(clipId);
    if (!scheduled) return;

    try {
      // Apply quick fade out to prevent clicking
      const now = this.audioContext.currentTime;
      scheduled.gainNode.gain.cancelScheduledValues(now);
      scheduled.gainNode.gain.setValueAtTime(scheduled.gainNode.gain.value, now);
      scheduled.gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.01);

      // Stop after fade
      scheduled.sourceNode.stop(now + 0.02);
    } catch (e) {
      // Clip may have already stopped
    }

    this.scheduledClips.delete(clipId);
  }

  /**
   * Unschedule all clips
   */
  unscheduleAll(): void {
    for (const clipId of Array.from(this.scheduledClips.keys())) {
      this.unscheduleClip(clipId);
    }
    this.scheduledClips.clear();
  }

  /**
   * Update tempo (affects scheduling calculations)
   */
  setTempo(tempo: number): void {
    this.tempo = tempo;
  }

  /**
   * Get currently scheduled clips
   */
  getScheduledClips(): Map<string, ScheduledClip> {
    return new Map(this.scheduledClips);
  }

  /**
   * Check if a clip is currently playing
   */
  isClipPlaying(clipId: string): boolean {
    const scheduled = this.scheduledClips.get(clipId);
    if (!scheduled) return false;

    const now = this.audioContext.currentTime;
    return now >= scheduled.startTime && now < scheduled.scheduledEnd;
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.unscheduleAll();
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate effective clip duration considering playback rate
 */
export function calculateEffectiveDuration(
  clipDuration: number,
  playbackRate: number
): number {
  return clipDuration / Math.abs(playbackRate);
}

/**
 * Calculate sample offset for reverse playback
 */
export function calculateReverseOffset(
  bufferDuration: number,
  clipOffset: number,
  clipDuration: number,
  playbackRate: number
): number {
  const effectiveDuration = calculateEffectiveDuration(clipDuration, playbackRate);
  return bufferDuration - clipOffset - effectiveDuration;
}

/**
 * Create a reversed audio buffer
 */
export async function createReversedBuffer(
  audioContext: AudioContext,
  buffer: AudioBuffer
): Promise<AudioBuffer> {
  const reversed = audioContext.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const originalData = buffer.getChannelData(channel);
    const reversedData = reversed.getChannelData(channel);

    for (let i = 0; i < buffer.length; i++) {
      reversedData[i] = originalData[buffer.length - 1 - i];
    }
  }

  return reversed;
}

/**
 * Pre-schedule clips for lookahead
 */
export function scheduleClipsInRange(
  controller: ClipPlaybackController,
  clips: Clip[],
  buffers: Map<string, AudioBuffer>,
  playheadBeat: number,
  lookaheadBeats: number = 4
): void {
  const now = controller['audioContext'].currentTime;

  for (const clip of clips) {
    // Skip if clip is too far in the future
    if (clip.startTime > playheadBeat + lookaheadBeats) continue;

    // Skip if clip has already passed
    if (clip.startTime + clip.duration < playheadBeat) continue;

    // Skip if no buffer
    if (!clip.bufferId) continue;
    const buffer = buffers.get(clip.bufferId);
    if (!buffer) continue;

    // Schedule the clip
    controller.scheduleClip(clip, buffer, playheadBeat, now);
  }
}

/**
 * Update scheduled clips when playhead jumps
 */
export function updateScheduleForJump(
  controller: ClipPlaybackController,
  clips: Clip[],
  buffers: Map<string, AudioBuffer>,
  newPlayheadBeat: number,
  isPlaying: boolean
): void {
  // Clear existing schedule
  controller.unscheduleAll();

  if (!isPlaying) return;

  // Re-schedule from new position
  scheduleClipsInRange(controller, clips, buffers, newPlayheadBeat);
}

// =============================================================================
// Export singleton
// =============================================================================

export function createClipPlaybackController(
  audioContext: AudioContext,
  destination?: AudioNode
): ClipPlaybackController {
  return new ClipPlaybackController(audioContext, destination);
}
