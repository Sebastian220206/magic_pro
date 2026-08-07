import { bufferCacheManager } from '../audioEngine/bufferCache';
import { SYNTH_PRESETS } from '../SynthEngine';
import { InsertChain } from '../audioEngine/insertChain';
import { createProcessor } from '../plugins/processorFactory';
import { toPluginSpecs } from '../plugins/pluginSpec';
import {
    computeCompensation,
    projectLatencySamples,
    samplesToSeconds,
    trackLatencySamples,
    type PluginDescriptor,
    type TrackLatencyReport,
} from '../audioEngine/latencyCompensation';
import type { PluginSetting } from '../../models/Track';

export interface ExportClip {
  id: string;
  trackId: string;
  startBeat: number;
  duration: number;
  type: 'audio' | 'midi';
  offset: number;
  muted: boolean;
  sampleId?: string;
  fileUrl?: string;
  storageKey?: string;
  playbackRate?: number;
  fadeIn?: { duration: number; curve?: string };
  fadeOut?: { duration: number; curve?: string };
  notes?: { pitch: number; velocity: number; start: number; duration: number }[];
}

export interface ExportTrack {
  id: string;
  name: string;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  instrument?: string;
  /** Insert chain to apply, so the export matches playback. */
  plugins?: PluginSetting[];
}

export interface ExportOptions {
  startBeat?: number;
  endBeat?: number;
  sampleRate?: number;
  bitDepth?: 16 | 24 | 32;
  /**
   * Called when plugins could not be instantiated for the render. Those tracks
   * are rendered dry — surface this rather than shipping a file that quietly
   * differs from playback.
   */
  onPluginFailure?: (tracks: string[]) => void;
}

const EXPORT_TAIL_SECONDS = 2;
const MAX_RENDER_DURATION_SECONDS = 600; // cap at 10 minutes to avoid browser freeze

export async function renderSongOffline(
  clips: ExportClip[],
  tracks: ExportTrack[],
  tempo: number,
  options: ExportOptions = {}
): Promise<AudioBuffer> {
  const sampleRate = options.sampleRate || 44100;
  const startBeat = options.startBeat ?? 0;

  console.log('[EXPORT START]');
  console.log('tracks:', tracks.length);
  console.log('clips:', clips.length);
  console.log('duration:', 'calculating...');
  console.log('sampleRate:', sampleRate);
  console.log('tempo:', tempo);

  // ── Duration calculation with diagnostics ───────────────────────────────
  let maxEndBeat = 0;
  for (const clip of clips) {
    if (!clip.muted) {
      const s = Number(clip.startBeat) || 0;
      const d = Number(clip.duration) || 0;
      const end = s + d;
      if (end > maxEndBeat) {
        maxEndBeat = end;
      }
      if (!isFinite(end) || end < 0) {
        console.warn('[Export] Clip with invalid position:', clip.id, { startBeat: clip.startBeat, duration: clip.duration });
      }
    }
  }

  const rawSeconds = ((maxEndBeat - startBeat) / (tempo || 120)) * 60 + EXPORT_TAIL_SECONDS;
  const durationSeconds = Math.min(rawSeconds, MAX_RENDER_DURATION_SECONDS);

  if (!isFinite(durationSeconds) || durationSeconds <= 0) {
    console.error('[Export] Bad duration calculation:', { maxEndBeat, startBeat, tempo, rawSeconds });
    throw new Error(`Nothing to export — calculated duration is ${durationSeconds} (maxEndBeat=${maxEndBeat}, tempo=${tempo})`);
  }

  const frameCount = Math.ceil(durationSeconds * sampleRate);
  console.log('[Export] Duration:', durationSeconds.toFixed(2), 's, frames:', frameCount.toLocaleString(), 'tempo:', tempo);

  // Safety cap: if frameCount exceeds 50 million, warn and clamp
  if (frameCount > 50000000) {
    console.error('[Export] Frame count too large, clamping to 50M. Check timeline!');
    throw new Error('Export duration too long — check your timeline for clips with extreme positions');
  }

  const offlineCtx = new OfflineAudioContext({
    numberOfChannels: 2,
    length: frameCount,
    sampleRate,
  });

  // Build master bus
  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(offlineCtx.destination);

  // Check for solo
  const hasSolo = tracks.some(t => t.soloed);

  // Build track routing graph
  const trackNodeMap = new Map<string, {
    gainNode: GainNode;
    panNode: StereoPannerNode;
    inputNode: GainNode;
  }>();

  // Plugin delay compensation, mirroring live playback. Without it a track
  // carrying a latent plugin lands late relative to the others and the export
  // does not match what was heard. The whole render is shifted by the worst
  // case, which is trimmed off the head afterwards.
  const latencyReports: TrackLatencyReport[] = tracks.map(track => ({
    trackId: track.id,
    latencySamples: trackLatencySamples(track.plugins as PluginDescriptor[] | undefined),
  }));
  const compensation = computeCompensation(latencyReports);
  const headroomSamples = projectLatencySamples(latencyReports);

  /** Chains are built asynchronously; rendering must wait for them. */
  const chainReady: Promise<void>[] = [];
  const chains: InsertChain[] = [];
  const failedPlugins: string[] = [];

  for (const track of tracks) {
    let effectiveGain = track.volume;
    if (track.muted) effectiveGain = 0;
    if (hasSolo && !track.soloed) effectiveGain = 0;

    const gainNode = offlineCtx.createGain();
    gainNode.gain.value = effectiveGain;

    const panNode = offlineCtx.createStereoPanner();
    panNode.pan.value = track.pan;

    const inputNode = offlineCtx.createGain();
    inputNode.gain.value = 1;

    // Align this track against the most latent one.
    const compensationSeconds = samplesToSeconds(compensation.get(track.id) ?? 0, sampleRate);
    const pdcDelay = offlineCtx.createDelay(Math.max(1, headroomSamples / sampleRate + 1));
    pdcDelay.delayTime.value = compensationSeconds;

    const specs = toPluginSpecs(track.plugins);
    if (specs.length > 0) {
      // Same InsertChain as live playback — it takes a BaseAudioContext
      // precisely so it can be reused here.
      const chain = new InsertChain(offlineCtx, inputNode, gainNode, createProcessor);
      chains.push(chain);
      chainReady.push(
        chain.setSpecs(specs).then(() => {
          const built = chain.getInstanceIds().length;
          if (built < specs.length) {
            // Render dry rather than silently producing a different mix.
            failedPlugins.push(`${track.name} (${specs.length - built} of ${specs.length})`);
          }
        }),
      );
    } else {
      inputNode.connect(gainNode);
    }

    gainNode.connect(panNode);
    panNode.connect(pdcDelay);
    pdcDelay.connect(masterGain);

    trackNodeMap.set(track.id, { gainNode, panNode, inputNode });
  }

  // Schedule audio clips
  const clipStartPromises: Promise<void>[] = [];
  let scheduledCount = 0;

  for (const clip of clips) {
    if (clip.muted) continue;

    const track = tracks.find(t => t.id === clip.trackId);
    if (!track) continue;
    if (track.muted) continue;
    if (hasSolo && !track.soloed) continue;

    const trackNodes = trackNodeMap.get(clip.trackId);
    if (!trackNodes) continue;

    const rawStart = ((Number(clip.startBeat) || 0) - startBeat) / (tempo || 120) * 60;
    const clipStartSeconds = Math.max(0, rawStart);

    if (!isFinite(clipStartSeconds)) {
      console.warn('[Export] Invalid clipStartSeconds for', clip.id);
      continue;
    }

    if (clip.type === 'audio') {
      scheduledCount++;
      clipStartPromises.push(
        scheduleAudioClip(offlineCtx, clip, trackNodes.inputNode, clipStartSeconds, tempo)
      );
    } else if (clip.type === 'midi') {
      scheduledCount++;
      scheduleMidiClip(offlineCtx, clip, trackNodes.inputNode, clipStartSeconds, tempo, track.instrument);
    }
  }

  console.log('[Export] Scheduled', scheduledCount, 'clips');
  console.time('[Export] Buffer loading');
  await Promise.all(clipStartPromises);
  console.timeEnd('[Export] Buffer loading');

  // Plugin chains must exist before rendering starts — an AudioWorklet added
  // mid-render would not process the earlier part of the timeline.
  if (chainReady.length > 0) {
    await Promise.all(chainReady);
    if (failedPlugins.length > 0) {
      console.warn(
        `[Export] Some plugins could not be rendered offline and were bypassed: ${failedPlugins.join(', ')}`,
      );
      options.onPluginFailure?.(failedPlugins);
    }
  }

  console.log('[OFFLINE RENDER START]');
  console.time('[Export] OfflineAudioContext rendering');
  const startTime = performance.now();
  let renderedBuffer: AudioBuffer;
  try {
    renderedBuffer = await offlineCtx.startRendering();
  } catch (renderErr) {
    console.error('[EXPORT] OfflineAudioContext rendering failed:', renderErr);
    throw new Error(`Audio rendering failed: ${renderErr instanceof Error ? renderErr.message : renderErr}`);
  }
  const renderTime = ((performance.now() - startTime) / 1000).toFixed(1);
  console.timeEnd('[Export] OfflineAudioContext rendering');
  console.log('[OFFLINE RENDER COMPLETE]', renderTime + 's');

  chains.forEach(chain => chain.dispose());

  // Compensation delayed every track equally; remove that offset so the export
  // starts where the timeline does rather than `headroomSamples` late.
  return headroomSamples > 0
    ? trimHead(renderedBuffer, headroomSamples)
    : renderedBuffer;
}

/**
 * Drop `samples` from the start of a buffer.
 *
 * Used to undo the uniform shift introduced by delay compensation. Returns the
 * original buffer when the trim would consume all of it.
 */
function trimHead(buffer: AudioBuffer, samples: number): AudioBuffer {
    const offset = Math.max(0, Math.min(Math.round(samples), buffer.length - 1));
    if (offset === 0) return buffer;

    const trimmed = new OfflineAudioContext({
        numberOfChannels: buffer.numberOfChannels,
        length: buffer.length - offset,
        sampleRate: buffer.sampleRate,
    }).createBuffer(buffer.numberOfChannels, buffer.length - offset, buffer.sampleRate);

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        trimmed.getChannelData(channel).set(buffer.getChannelData(channel).subarray(offset));
    }
    return trimmed;
}

async function scheduleAudioClip(
  ctx: OfflineAudioContext,
  clip: ExportClip,
  inputNode: AudioNode,
  clipStartSeconds: number,
  tempo: number,
): Promise<void> {
  // Guard: invalid start time would crash OfflineAudioContext
  if (!isFinite(clipStartSeconds) || clipStartSeconds < 0) {
    console.warn('[Export] Invalid clip start time for clip', clip.id, clipStartSeconds);
    return;
  }
  if (!isFinite(tempo) || tempo <= 0) {
    console.warn('[Export] Invalid tempo, skipping clip', clip.id);
    return;
  }

  const bufferId = clip.sampleId || clip.id;
  let buffer = bufferCacheManager.getBuffer(bufferId);

  // Fallback: try storageKey (used by engineRebuilder after page reload)
  if (!buffer && clip.storageKey) {
    buffer = bufferCacheManager.getBuffer(clip.storageKey) ?? null;
  }

  if (!buffer && clip.fileUrl) {
    try {
      console.log('[Export] Loading buffer from URL:', clip.fileUrl);
      buffer = await bufferCacheManager.load(clip.fileUrl);
    } catch (e) {
      console.warn('[Export] Failed to load buffer for clip', clip.id, e);
      return;
    }
  }

  if (!buffer) {
    console.warn('[Export] No buffer for clip', clip.id, 'bufferId:', bufferId);
    return;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = clip.playbackRate ?? 1;

  let output: AudioNode = source;
  if ((clip.fadeIn?.duration ?? 0) > 0 || (clip.fadeOut?.duration ?? 0) > 0) {
    const envGain = ctx.createGain();
    envGain.gain.setValueAtTime(0, clipStartSeconds);

    if ((clip.fadeIn?.duration ?? 0) > 0) {
      const fadeInSec = (clip.fadeIn!.duration / tempo) * 60;
      envGain.gain.linearRampToValueAtTime(1, clipStartSeconds + fadeInSec);
    } else {
      envGain.gain.setValueAtTime(1, clipStartSeconds);
    }

    const clipEndSeconds = clipStartSeconds + (clip.duration / tempo) * 60;
    if ((clip.fadeOut?.duration ?? 0) > 0) {
      const fadeOutSec = (clip.fadeOut!.duration / tempo) * 60;
      envGain.gain.setValueAtTime(1, clipEndSeconds - fadeOutSec);
      envGain.gain.linearRampToValueAtTime(0, clipEndSeconds);
    }
    envGain.gain.setValueAtTime(0, clipEndSeconds);

    source.connect(envGain);
    output = envGain;
  }

  output.connect(inputNode);

  const offsetSeconds = (clip.offset || 0) / tempo * 60;
  source.start(clipStartSeconds, offsetSeconds);
}

function scheduleMidiClip(
  ctx: OfflineAudioContext,
  clip: ExportClip,
  inputNode: AudioNode,
  clipStartSeconds: number,
  tempo: number,
  instrument?: string,
): void {
  const notes = clip.notes;
  if (!notes || notes.length === 0) return;

  // Safety: cap MIDI notes to prevent hanging from thousands of AudioNodes
  const MAX_MIDI_NOTES = 5000;
  if (notes.length > MAX_MIDI_NOTES) {
    console.warn(`[Export] Clip ${clip.id} has ${notes.length} notes — limiting to ${MAX_MIDI_NOTES}`);
  }
  const notesToSchedule = notes.slice(0, MAX_MIDI_NOTES);

  const preset = SYNTH_PRESETS[instrument || 'piano'] || SYNTH_PRESETS.piano;

  for (const note of notesToSchedule) {
    const noteStart = clipStartSeconds + (note.start / tempo) * 60;
    const noteDuration = Math.max((note.duration / tempo) * 60, 0.05);
    const freq = 440 * Math.pow(2, (note.pitch - 69) / 12);
    const velScale = note.velocity / 127;

    const filter = ctx.createBiquadFilter();
    filter.type = preset.filter.type;
    filter.frequency.value = preset.filter.frequency;
    filter.Q.value = preset.filter.q;

    const envGain = ctx.createGain();
    envGain.gain.setValueAtTime(0, noteStart);

    const { attack, decay, sustain, release } = preset.envelope;
    envGain.gain.linearRampToValueAtTime(1.0 * velScale, noteStart + attack);
    envGain.gain.linearRampToValueAtTime(
      Math.max(sustain * velScale, 0.001),
      noteStart + attack + decay
    );

    const noteEnd = noteStart + noteDuration;
    envGain.gain.setValueAtTime(envGain.gain.value, noteEnd);
    envGain.gain.linearRampToValueAtTime(0.001, noteEnd + release);

    filter.connect(envGain);
    envGain.connect(inputNode);

    preset.oscillators.forEach(oscConfig => {
      const osc = ctx.createOscillator();
      osc.type = oscConfig.type;
      osc.frequency.value = freq;
      osc.detune.value = oscConfig.detune;

      const oscGain = ctx.createGain();
      oscGain.gain.value = oscConfig.gain * 0.2;

      osc.connect(oscGain);
      oscGain.connect(filter);

      osc.start(noteStart);
      osc.stop(noteEnd + release);
    });
  }
}
