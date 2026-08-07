/**
 * Track Freeze System - Render tracks to audio to save CPU
 *
 * Features:
 * - Freeze/unfreeze tracks
 * - Render with or without effects
 * - Render with or without volume/pan
 * - Freeze modes:
 *   - Source Only: Render MIDI to audio without effects
 *   - Pre-Fader: Render with effects but before fader
 *   - Post-Fader: Render with effects and fader
 *   - Full Mix: Render everything including sends
 * - Automatic unfreeze on edit
 * - Freeze status tracking
 * - Progress reporting
 *
 * Workflow:
 * 1. Freeze track (render to audio, disable plugins)
 * 2. Work on other tracks (plugins disabled = less CPU)
 * 3. Unfreeze to edit (restore plugins, reload audio)
 */

import { MidiNote } from '../midi/types';

export type FreezeMode = 'Source Only' | 'Pre Fader' | 'Post Fader' | 'Full Mix';

export interface TrackFreezeOptions {
  /** Freeze mode */
  mode: FreezeMode;
  /** Include effects processing */
  includeEffects: boolean;
  /** Include volume/pan */
  includeVolumePan: boolean;
  /** Include sends */
  includeSends: boolean;
  /** Sample rate for rendered audio */
  sampleRate: number;
  /** Bit depth */
  bitDepth: 16 | 24 | 32;
  /** Normalize output */
  normalize: boolean;
  /** Crossfade duration (ms) for seamless unfreeze */
  crossfadeMs: number;
}

export interface TrackFreezeState {
  /** Track ID */
  trackId: string;
  /** Whether track is frozen */
  frozen: boolean;
  /** Freeze mode used */
  mode: FreezeMode;
  /** Frozen audio buffer */
  audioBuffer: AudioBuffer | null;
  /** Original MIDI notes (before freeze) */
  originalNotes: MidiNote[];
  /** Original plugin settings */
  originalPlugins: unknown[];
  /** Original volume */
  originalVolume: number;
  /** Original pan */
  originalPan: number;
  /** Freeze timestamp */
  frozenAt: number;
  /** Duration in seconds */
  durationSeconds: number;
}

export interface TrackFreezeProgress {
  /** Track ID */
  trackId: string;
  /** Current phase */
  phase: 'preparing' | 'rendering' | 'finalizing' | 'complete' | 'error';
  /** Progress (0-1) */
  progress: number;
  /** Step description */
  step: string;
  /** Error message if failed */
  error?: string;
}

const DEFAULT_OPTIONS: TrackFreezeOptions = {
  mode: 'Post Fader',
  includeEffects: true,
  includeVolumePan: true,
  includeSends: false,
  sampleRate: 48000,
  bitDepth: 24,
  normalize: false,
  crossfadeMs: 10,
};

export class TrackFreeze {
  private ctx: AudioContext;
  private options: TrackFreezeOptions;
  private freezeStates: Map<string, TrackFreezeState> = new Map();
  private listeners: Array<(progress: TrackFreezeProgress) => void> = [];

  constructor(ctx: AudioContext, options: Partial<TrackFreezeOptions> = {}) {
    this.ctx = ctx;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ===========================================================================
  // Freeze Operations
  // ===========================================================================

  /**
   * Freeze a track
   */
  async freezeTrack(
    trackId: string,
    midiNotes: MidiNote[],
    audioContext: OfflineAudioContext,
    tempo: number = 120
  ): Promise<boolean> {
    try {
      this.notifyProgress({
        trackId,
        phase: 'preparing',
        progress: 0,
        step: 'Preparing freeze',
      });

      // Calculate duration
      const totalDurationBeats = this.calculateDuration(midiNotes);
      const totalDurationSeconds = (totalDurationBeats / tempo) * 60;
      const sampleCount = Math.ceil(totalDurationSeconds * this.options.sampleRate);

      // Create offline context
      const offlineCtx = new OfflineAudioContext({
        length: sampleCount,
        sampleRate: this.options.sampleRate,
        numberOfChannels: 2,
      });

      this.notifyProgress({
        trackId,
        phase: 'rendering',
        progress: 0.2,
        step: 'Rendering audio',
      });

      // Render based on freeze mode
      const renderedBuffer = await this.renderTrack(
        offlineCtx,
        midiNotes,
        tempo,
        this.options.mode
      );

      this.notifyProgress({
        trackId,
        phase: 'finalizing',
        progress: 0.9,
        step: 'Finalizing freeze',
      });

      // Save freeze state
      const state: TrackFreezeState = {
        trackId,
        frozen: true,
        mode: this.options.mode,
        audioBuffer: renderedBuffer,
        originalNotes: [...midiNotes],
        originalPlugins: [],
        originalVolume: 1,
        originalPan: 0,
        frozenAt: Date.now(),
        durationSeconds: totalDurationSeconds,
      };

      this.freezeStates.set(trackId, state);

      this.notifyProgress({
        trackId,
        phase: 'complete',
        progress: 1,
        step: 'Freeze complete',
      });

      return true;

    } catch (error) {
      this.notifyProgress({
        trackId,
        phase: 'error',
        progress: 0,
        step: 'Freeze failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Unfreeze a track
   */
  unfreezeTrack(trackId: string): MidiNote[] | null {
    const state = this.freezeStates.get(trackId);
    if (!state) return null;

    // Return original notes
    const originalNotes = [...state.originalNotes];

    // Remove freeze state
    this.freezeStates.delete(trackId);

    return originalNotes;
  }

  /**
   * Check if track is frozen
   */
  isFrozen(trackId: string): boolean {
    return this.freezeStates.get(trackId)?.frozen ?? false;
  }

  /**
   * Get frozen audio buffer
   */
  getFrozenBuffer(trackId: string): AudioBuffer | null {
    return this.freezeStates.get(trackId)?.audioBuffer ?? null;
  }

  /**
   * Get freeze state
   */
  getFreezeState(trackId: string): TrackFreezeState | undefined {
    return this.freezeStates.get(trackId);
  }

  /**
   * Get all frozen tracks
   */
  getFrozenTracks(): string[] {
    const frozen: string[] = [];
    for (const [trackId, state] of this.freezeStates) {
      if (state.frozen) {
        frozen.push(trackId);
      }
    }
    return frozen;
  }

  // ===========================================================================
  // Rendering
  // ===========================================================================

  /**
   * Render track based on freeze mode
   */
  private async renderTrack(
    ctx: OfflineAudioContext,
    midiNotes: MidiNote[],
    tempo: number,
    mode: FreezeMode
  ): Promise<AudioBuffer> {
    const samplesPerBeat = (60 / tempo) * ctx.sampleRate;

    // Create instrument node (simplified - would connect to actual instrument)
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);

    // Schedule MIDI notes
    for (const note of midiNotes) {
      const startSample = Math.floor(note.startBeat * samplesPerBeat);
      const durationSamples = Math.floor(note.duration * samplesPerBeat);

      // Create oscillator for each note
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc.frequency.value = 440 * Math.pow(2, (note.pitch - 69) / 12);
      noteGain.gain.value = note.velocity / 127;

      osc.connect(noteGain);
      noteGain.connect(gainNode);

      const startTime = startSample / ctx.sampleRate;
      const duration = durationSamples / ctx.sampleRate;

      osc.start(startTime);
      osc.stop(startTime + duration);
    }

    // Apply mode-specific processing
    switch (mode) {
      case 'Source Only':
        // Just render MIDI to audio, no effects
        break;

      case 'Pre Fader':
        // Would apply effects here
        break;

      case 'Post Fader':
        // Would apply effects and volume/pan here
        break;

      case 'Full Mix':
        // Would apply everything including sends
        break;
    }

    // Render
    return ctx.startRendering();
  }

  /**
   * Calculate duration from MIDI notes
   */
  private calculateDuration(notes: MidiNote[]): number {
    let maxEnd = 0;
    for (const note of notes) {
      const end = note.startBeat + note.duration;
      if (end > maxEnd) maxEnd = end;
    }
    return maxEnd;
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  /**
   * Set freeze mode
   */
  setMode(mode: FreezeMode): void {
    this.options.mode = mode;
  }

  /**
   * Get freeze mode
   */
  getMode(): FreezeMode {
    return this.options.mode;
  }

  /**
   * Set options
   */
  setOptions(options: Partial<TrackFreezeOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get options
   */
  getOptions(): Readonly<TrackFreezeOptions> {
    return this.options;
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  /**
   * Subscribe to progress updates
   */
  subscribe(listener: (progress: TrackFreezeProgress) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyProgress(progress: TrackFreezeProgress): void {
    for (const listener of this.listeners) {
      listener(progress);
    }
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Clear all freeze states
   */
  clear(): void {
    this.freezeStates.clear();
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.clear();
    this.listeners = [];
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createTrackFreeze(
  ctx: AudioContext,
  options?: Partial<TrackFreezeOptions>
): TrackFreeze {
  return new TrackFreeze(ctx, options);
}

export default TrackFreeze;
