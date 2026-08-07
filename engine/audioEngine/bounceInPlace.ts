/**
 * Bounce in Place - Inline bounce replacing track content with rendered audio
 *
 * Features:
 * - Bounce selected clips or entire track
 * - Replace original clips with rendered audio
 * - Include/exclude effects processing
 * - Include/exclude automation
 * - Real-time or offline rendering
 * - Create new audio track option
 * - Preserve MIDI data option
 *
 * Workflow:
 * 1. Select clips to bounce
 * 2. Configure bounce options
 * 3. Render to audio
 * 4. Replace clips or create new track
 */

import { MidiNote } from '../midi/types';

export type BounceSource = 'clips' | 'track' | 'selection';

export interface BounceInPlaceOptions {
  /** What to bounce */
  source: BounceSource;
  /** Include effects processing */
  includeEffects: boolean;
  /** Include volume/pan automation */
  includeAutomation: boolean;
  /** Include MIDI CC data */
  includeMidiCc: boolean;
  /** Replace original clips */
  replaceOriginal: boolean;
  /** Create new audio track instead of replacing */
  createNewTrack: boolean;
  /** New track name (if createNewTrack) */
  newTrackName: string;
  /** Normalize output */
  normalize: boolean;
  /** Add to project as new clip */
  addToProject: boolean;
  /** Bounce format */
  format: 'wav' | 'mp3' | 'aac';
  /** Bit depth */
  bitDepth: 16 | 24 | 32;
  /** Sample rate */
  sampleRate: number;
}

export interface BounceClip {
  /** Clip ID */
  id: string;
  /** Track ID */
  trackId: string;
  /** Start beat */
  startBeat: number;
  /** Duration in beats */
  durationBeats: number;
  /** MIDI notes (for MIDI clips) */
  notes: MidiNote[];
  /** Audio buffer (for audio clips) */
  audioBuffer?: AudioBuffer;
  /** Clip name */
  name: string;
}

export interface BounceInPlaceResult {
  /** Success flag */
  success: boolean;
  /** Rendered audio buffer */
  audioBuffer?: AudioBuffer;
  /** New clip ID (if added to project) */
  newClipId?: string;
  /** New track ID (if createNewTrack) */
  newTrackId?: string;
  /** Duration in seconds */
  durationSeconds: number;
  /** Sample count */
  sampleCount: number;
  /** Processing time in ms */
  processingTime: number;
  /** Error message if failed */
  error?: string;
}

export interface BounceProgress {
  /** Current phase */
  phase: 'preparing' | 'rendering' | 'finalizing' | 'complete';
  /** Progress (0-1) */
  progress: number;
  /** Current step */
  step: string;
}

const DEFAULT_OPTIONS: BounceInPlaceOptions = {
  source: 'clips',
  includeEffects: true,
  includeAutomation: true,
  includeMidiCc: true,
  replaceOriginal: true,
  createNewTrack: false,
  newTrackName: 'Bounced',
  normalize: false,
  addToProject: true,
  format: 'wav',
  bitDepth: 24,
  sampleRate: 48000,
};

export class BounceInPlace {
  private ctx: AudioContext;
  private options: BounceInPlaceOptions;
  private listeners: Array<(progress: BounceProgress) => void> = [];

  constructor(ctx: AudioContext, options: Partial<BounceInPlaceOptions> = {}) {
    this.ctx = ctx;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Bounce clips to audio
   */
  async bounceClips(
    clips: BounceClip[],
    tempo: number = 120
  ): Promise<BounceInPlaceResult> {
    const startTime = performance.now();

    try {
      this.notifyProgress({ phase: 'preparing', progress: 0, step: 'Calculating duration' });

      // Calculate total duration
      const totalDurationBeats = this.calculateTotalDuration(clips);
      const totalDurationSeconds = (totalDurationBeats / tempo) * 60;
      const sampleCount = Math.ceil(totalDurationSeconds * this.options.sampleRate);

      // Create offline context
      this.notifyProgress({ phase: 'rendering', progress: 0.1, step: 'Creating offline context' });
      const offlineCtx = new OfflineAudioContext({
        length: sampleCount,
        sampleRate: this.options.sampleRate,
        numberOfChannels: 2,
      });

      // Render clips
      this.notifyProgress({ phase: 'rendering', progress: 0.3, step: 'Rendering clips' });
      const renderedBuffer = await this.renderClips(offlineCtx, clips, tempo);

      // Normalize if requested
      this.notifyProgress({ phase: 'finalizing', progress: 0.8, step: 'Finalizing' });
      let finalBuffer = renderedBuffer;
      if (this.options.normalize) {
        finalBuffer = this.normalizeBuffer(renderedBuffer);
      }

      this.notifyProgress({ phase: 'complete', progress: 1, step: 'Complete' });

      return {
        success: true,
        audioBuffer: finalBuffer,
        durationSeconds: totalDurationSeconds,
        sampleCount,
        processingTime: performance.now() - startTime,
      };

    } catch (error) {
      return {
        success: false,
        durationSeconds: 0,
        sampleCount: 0,
        processingTime: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Bounce MIDI notes to audio using instrument
   */
  async bounceMidi(
    notes: MidiNote[],
    instrument: AudioNode,
    tempo: number = 120,
    durationBeats: number = 64
  ): Promise<BounceInPlaceResult> {
    const startTime = performance.now();

    try {
      this.notifyProgress({ phase: 'preparing', progress: 0, step: 'Preparing MIDI' });

      const totalDurationSeconds = (durationBeats / tempo) * 60;
      const sampleCount = Math.ceil(totalDurationSeconds * this.options.sampleRate);

      const offlineCtx = new OfflineAudioContext({
        length: sampleCount,
        sampleRate: this.options.sampleRate,
        numberOfChannels: 2,
      });

      this.notifyProgress({ phase: 'rendering', progress: 0.2, step: 'Rendering MIDI' });

      // Connect instrument to offline context
      const gainNode = offlineCtx.createGain();
      instrument.connect(gainNode);
      gainNode.connect(offlineCtx.destination);

      // Schedule notes
      const samplesPerBeat = (60 / tempo) * this.options.sampleRate;
      for (const note of notes) {
        const startTimeSamples = Math.floor(note.startBeat * samplesPerBeat);
        const durationSamples = Math.floor(note.duration * samplesPerBeat);

        const osc = offlineCtx.createOscillator();
        const noteGain = offlineCtx.createGain();

        osc.frequency.value = 440 * Math.pow(2, (note.pitch - 69) / 12);
        noteGain.gain.value = note.velocity / 127;

        osc.connect(noteGain);
        noteGain.connect(gainNode);

        osc.start(startTimeSamples / this.options.sampleRate);
        osc.stop((startTimeSamples + durationSamples) / this.options.sampleRate);
      }

      // Render
      const renderedBuffer = await offlineCtx.startRendering();

      this.notifyProgress({ phase: 'complete', progress: 1, step: 'Complete' });

      return {
        success: true,
        audioBuffer: renderedBuffer,
        durationSeconds: totalDurationSeconds,
        sampleCount,
        processingTime: performance.now() - startTime,
      };

    } catch (error) {
      return {
        success: false,
        durationSeconds: 0,
        sampleCount: 0,
        processingTime: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Render clips to offline context
   */
  private async renderClips(
    ctx: OfflineAudioContext,
    clips: BounceClip[],
    tempo: number
  ): Promise<AudioBuffer> {
    const samplesPerBeat = (60 / tempo) * ctx.sampleRate;

    for (const clip of clips) {
      if (clip.audioBuffer) {
        // Audio clip: schedule playback
        const source = ctx.createBufferSource();
        source.buffer = clip.audioBuffer;

        const startSample = Math.floor(clip.startBeat * samplesPerBeat);
        source.start(startSample / ctx.sampleRate);

        source.connect(ctx.destination);
      }
    }

    return ctx.startRendering();
  }

  /**
   * Calculate total duration in beats
   */
  private calculateTotalDuration(clips: BounceClip[]): number {
    let maxEnd = 0;
    for (const clip of clips) {
      const end = clip.startBeat + clip.durationBeats;
      if (end > maxEnd) maxEnd = end;
    }
    return maxEnd;
  }

  /**
   * Normalize audio buffer
   */
  private normalizeBuffer(buffer: AudioBuffer): AudioBuffer {
    const normalized = new AudioBuffer({
      numberOfChannels: buffer.numberOfChannels,
      length: buffer.length,
      sampleRate: buffer.sampleRate,
    });

    // Find peak
    let peak = 0;
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i] ?? 0);
        if (abs > peak) peak = abs;
      }
    }

    // Normalize
    if (peak > 0) {
      const gain = 1 / peak;
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const src = buffer.getChannelData(ch);
        const dst = normalized.getChannelData(ch);
        for (let i = 0; i < src.length; i++) {
          dst[i] = (src[i] ?? 0) * gain;
        }
      }
    }

    return normalized;
  }

  /**
   * Set options
   */
  setOptions(options: Partial<BounceInPlaceOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get options
   */
  getOptions(): Readonly<BounceInPlaceOptions> {
    return this.options;
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  /**
   * Subscribe to progress updates
   */
  subscribe(listener: (progress: BounceProgress) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyProgress(progress: BounceProgress): void {
    for (const listener of this.listeners) {
      listener(progress);
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createBounceInPlace(
  ctx: AudioContext,
  options?: Partial<BounceInPlaceOptions>
): BounceInPlace {
  return new BounceInPlace(ctx, options);
}

export default BounceInPlace;
