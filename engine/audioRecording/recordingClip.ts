/**
 * recordingClip.ts
 * Clip model for recorded audio and timeline integration
 */

import { useProjectStore } from '@/store/projectStore';
import type { Clip } from '@/models/Clip';
import { generateWaveformData, generateBipolarWaveformData } from './waveformAnalyzer';

export interface RecordingClip {
  id: string;
  trackId: string;
  startTime: number;
  duration: number;
  audioBuffer: AudioBuffer;
  waveform: number[];
  name?: string;
  createdAt: number;
  gain?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface CreateClipOptions {
  trackId: string;
  startTime: number;
  duration: number;
  audioBuffer: AudioBuffer;
  waveform: number[];
  name?: string;
  gain?: number;
}

/**
 * Generate a unique clip ID
 */
function generateClipId(): string {
  return `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a recording clip from recording result
 */
export function createRecordingClip(options: CreateClipOptions): RecordingClip {
  return {
    id: generateClipId(),
    trackId: options.trackId,
    startTime: options.startTime,
    duration: options.duration,
    audioBuffer: options.audioBuffer,
    waveform: options.waveform,
    name: options.name || `Recording ${new Date().toLocaleTimeString()}`,
    createdAt: Date.now(),
    gain: options.gain ?? 1.0,
  };
}

/**
 * Create a clip from raw audio data (for testing or file import)
 */
export async function createClipFromBuffer(
  audioContext: AudioContext,
  options: Omit<CreateClipOptions, 'audioBuffer' | 'waveform' | 'duration'> & {
    buffer: ArrayBuffer | Float32Array;
    sampleRate?: number;
    channels?: number;
  }
): Promise<RecordingClip> {
  let audioBuffer: AudioBuffer;

  if (options.buffer instanceof ArrayBuffer) {
    // Decode audio data
    audioBuffer = await audioContext.decodeAudioData(options.buffer);
  } else {
    // Create from Float32Array
    const sampleRate = options.sampleRate || audioContext.sampleRate;
    const channels = options.channels || 2;
    const duration = options.buffer.length / sampleRate;

    audioBuffer = audioContext.createBuffer(channels, options.buffer.length, sampleRate);

    for (let ch = 0; ch < channels; ch++) {
      audioBuffer.getChannelData(ch).set(options.buffer);
    }
  }

  const waveform = generateWaveformData(audioBuffer, 1000);

  return createRecordingClip({
    ...options,
    audioBuffer,
    waveform,
    duration: audioBuffer.duration,
  });
}

/**
 * Add a recording clip to the project timeline
 */
export function addClipToTimeline(clip: RecordingClip): void {
  const store = useProjectStore.getState();
  
  // Get the track
  const track = store.tracks.find((t) => t.id === clip.trackId);
  if (!track) {
    console.warn(`Track ${clip.trackId} not found`);
    return;
  }

  const { tempo } = useProjectStore.getState();
  const durationInBeats = clip.duration * (tempo / 60);

  const RESOLUTION = 1000;
  const numChannels = clip.audioBuffer.numberOfChannels;

  // Build the waveformPeaks structure that WaveformCanvas.tsx requires:
  // { channels: [{ min: number[], max: number[] }, ...], resolution, durationSeconds, numChannels }
  const waveformChannels = Array.from({ length: numChannels }, (_, ch) => {
    // Temporarily extract this channel into a mono AudioBuffer so
    // generateBipolarWaveformData can read getChannelData(0).
    // We just pass the real buffer and tell the helper which channel index to use.
    const channelData = clip.audioBuffer.getChannelData(ch);
    const totalSamples = channelData.length;
    const samplesPerPoint = totalSamples / RESOLUTION;
    const min: number[] = [];
    const max: number[] = [];
    for (let i = 0; i < RESOLUTION; i++) {
      const start = Math.floor(i * samplesPerPoint);
      const end   = Math.floor((i + 1) * samplesPerPoint);
      let lo = 0, hi = 0;
      for (let j = start; j < end && j < totalSamples; j++) {
        const s = channelData[j];
        if (s < lo) lo = s;
        if (s > hi) hi = s;
      }
      min.push(lo);
      max.push(hi);
    }
    return { min, max };
  });

  const waveformPeaks = {
    channels: waveformChannels.map(ch => ({
      min: new Float32Array(ch.min),
      max: new Float32Array(ch.max),
    })),
    resolution: RESOLUTION,
    durationSeconds: clip.audioBuffer.duration,
    numChannels,
  };

  const fadeIn = typeof clip.fadeIn === 'number' ? { duration: clip.fadeIn, curve: 'linear' as const, gain: 1 } : clip.fadeIn;
  const fadeOut = typeof clip.fadeOut === 'number' ? { duration: clip.fadeOut, curve: 'linear' as const, gain: 1 } : clip.fadeOut;
  const trackClip: Clip = {
    id: clip.id,
    trackId: clip.trackId,
    type: 'audio',
    name: clip.name || 'Audio Recording',
    color: track.color || '#3b82f6',
    alternativeId: track.activeAlternativeId || 'default',
    start: clip.startTime,
    startTime: clip.startTime,
    // Written explicitly: the scheduler's window test reads `startBeat`, and a
    // clip that carried only `start` was dropped before it could be scheduled.
    startBeat: clip.startTime,
    duration: durationInBeats,
    offset: 0,
    muted: false,
    loop: false,
    qSwing: 0,
    transpose: 0,
    velocityOffset: 0,
    fileUrl: undefined,
    sampleId: clip.id,
    waveformPeaks,
    fadeIn: fadeIn ?? { duration: 0, curve: 'linear', gain: 1 },
    fadeOut: fadeOut ?? { duration: 0, curve: 'linear', gain: 1 },
    playbackRate: 1,
    pitchOffset: 0,
    stretchMode: 'none',
  };

  // 1. Add to track's own clips array (for persistence/track management)
  const existingTrackClips = track.clips || [];
  store.updateTrack(clip.trackId, { clips: [...existingTrackClips, trackClip] });

  // 2. Add to global store's clips array (Source of truth for Timeline UI)
  useProjectStore.setState(s => ({ 
    clips: [...s.clips, trackClip] 
  }));

  // Add to buffer cache for playback (System A)
  const { audioEngine: engine } = require('../AudioEngineAdapter');
  if (engine.addBuffer) {
    engine.addBuffer(clip.id, clip.audioBuffer);
  } else {
    console.warn('[RecordingClip] addBuffer not found in audioEngine');
  }

  // Add to buffer cache for playback (System B / Scheduler)
  try {
    const { audioBufferCache } = require('../useAudioPlayer');
    if (audioBufferCache) {
      audioBufferCache.set(clip.id, clip.audioBuffer);
      console.log(`[RecordingClip] Buffer cached for scheduler: ${clip.id}`);
    }
  } catch (err) {
    console.warn('[RecordingClip] Could not sync with System B cache:', err);
  }
}

/**
 * Update a clip's properties
 */
export function updateClip(clipId: string, updates: Partial<RecordingClip>): void {
  const store = useProjectStore.getState();
  const track = store.tracks.find((t) =>
    t.clips?.some((c) => c.id === clipId)
  );

  if (!track || !track.clips) return;
  const clipIndex = track.clips.findIndex((c: Clip) => c.id === clipId);
  if (clipIndex === -1) return;

  const updatedClip = {
    ...track.clips[clipIndex],
    ...updates,
  } as Clip;

  const updatedClips = [...(track.clips || [])];
  updatedClips[clipIndex] = updatedClip;

  store.updateTrack(track.id, { clips: updatedClips });
}

/**
 * Remove a clip from the timeline
 */
export function removeClip(clipId: string): void {
  const store = useProjectStore.getState();
  const track = store.tracks.find((t) =>
    t.clips?.some((c) => c.id === clipId)
  );

  if (!track) return;

  const updatedClips = track.clips?.filter((c: Clip) => c.id !== clipId) || [];
  store.updateTrack(track.id, { clips: updatedClips });

  // Remove from buffer cache
  const { removeBuffer } = require('../audioEngine/bufferCache');
  removeBuffer(clipId);
}

/**
 * Split a clip at a specific time
 */
export function splitClip(clip: RecordingClip, splitTime: number): [RecordingClip, RecordingClip] {
  const splitSample = Math.floor(splitTime * clip.audioBuffer.sampleRate);
  const sampleRate = clip.audioBuffer.sampleRate;
  const channels = clip.audioBuffer.numberOfChannels;

  // Create two new audio buffers
  const leftDuration = splitTime;
  const rightDuration = clip.duration - splitTime;

  const audioContext = clip.audioBuffer.sampleRate ? 
    new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: clip.audioBuffer.sampleRate }) : 
    null;
  
  if (!audioContext) {
    throw new Error('Could not create AudioContext for buffer splitting');
  }

  const leftBuffer = audioContext.createBuffer(
    channels,
    splitSample,
    sampleRate
  );
  const rightBuffer = audioContext.createBuffer(
    channels,
    clip.audioBuffer.length - splitSample,
    sampleRate
  );

  // Copy data
  for (let ch = 0; ch < channels; ch++) {
    const srcData = clip.audioBuffer.getChannelData(ch);
    leftBuffer.getChannelData(ch).set(srcData.subarray(0, splitSample));
    rightBuffer.getChannelData(ch).set(srcData.subarray(splitSample));
  }

  // Generate waveforms
  const leftWaveform = generateWaveformData(leftBuffer, Math.floor(1000 * (splitTime / clip.duration)));
  const rightWaveform = generateWaveformData(rightBuffer, Math.floor(1000 * ((clip.duration - splitTime) / clip.duration)));

  const leftClip: RecordingClip = {
    ...clip,
    id: generateClipId(),
    duration: leftDuration,
    audioBuffer: leftBuffer,
    waveform: leftWaveform,
    fadeOut: Math.min(clip.fadeOut || 0, 0.01), // Add small fade at split
  };

  const rightClip: RecordingClip = {
    ...clip,
    id: generateClipId(),
    startTime: clip.startTime + splitTime,
    duration: rightDuration,
    audioBuffer: rightBuffer,
    waveform: rightWaveform,
    fadeIn: Math.min(clip.fadeIn || 0, 0.01), // Add small fade at split
  };

  return [leftClip, rightClip];
}

/**
 * Trim a clip (non-destructive, just updates start/duration)
 */
export function trimClip(clip: RecordingClip, newStart: number, newDuration: number): RecordingClip {
  return {
    ...clip,
    startTime: newStart,
    duration: newDuration,
  };
}

/**
 * Apply gain to clip
 */
export function setClipGain(clip: RecordingClip, gain: number): RecordingClip {
  return {
    ...clip,
    gain,
  };
}

/**
 * Set fade in/out times
 */
export function setClipFades(
  clip: RecordingClip,
  fadeIn: number,
  fadeOut: number
): RecordingClip {
  return {
    ...clip,
    fadeIn,
    fadeOut,
  };
}

/**
 * Duplicate a clip
 */
export function duplicateClip(clip: RecordingClip, newStartTime?: number): RecordingClip {
  return {
    ...clip,
    id: generateClipId(),
    startTime: newStartTime ?? clip.startTime + clip.duration,
    name: `${clip.name} (Copy)`,
  };
}

/**
 * Export clip to downloadable URL
 */
export function exportClipToUrl(clip: RecordingClip): string {
  const { encodeWav } = require('./wavEncoder');
  const blob = encodeWav(clip.audioBuffer);
  return URL.createObjectURL(blob);
}

/**
 * Get clip thumbnail data (for UI preview)
 */
export function getClipThumbnail(clip: RecordingClip, width: number): number[] {
  // Downsample waveform to fit display width
  const samples = clip.waveform;
  if (samples.length <= width) return samples;

  const step = samples.length / width;
  const result: number[] = [];

  for (let i = 0; i < width; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);

    // Find peak in this slice
    let peak = 0;
    for (let j = start; j < end && j < samples.length; j++) {
      if (Math.abs(samples[j]) > peak) {
        peak = Math.abs(samples[j]);
      }
    }
    result.push(peak);
  }

  return result;
}

// Default export
export default {
  createRecordingClip,
  createClipFromBuffer,
  addClipToTimeline,
  updateClip,
  removeClip,
  splitClip,
  trimClip,
  setClipGain,
  setClipFades,
  duplicateClip,
  exportClipToUrl,
  getClipThumbnail,
};
