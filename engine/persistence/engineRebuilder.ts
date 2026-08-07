import { audioEngine } from '@/engine/AudioEngineAdapter';
import { bufferCacheManager } from '@/engine/audioEngine/bufferCache';
import { loadAudioBuffer } from './audioFileStore';
import { loadSoundFontForTrack } from '@/engine/instruments/soundfont/loadSoundFontForTrack';

export interface RebuildOptions {
  tracks: any[];
  clips: any[];
  tempo: number;
  /** Inserts across the summed mix — restored with the per-track chains. */
  masterPlugins?: any[];
  projectFormat?: string;
  surroundFormat?: string;
  spatialAudioMode?: string;
}

export interface RebuildResult {
  success: boolean;
  tracksCreated: number;
  instrumentsLoaded: number;
  buffersRestored: number;
  errors: string[];
}

export async function rebuildEngine(options: RebuildOptions): Promise<RebuildResult> {
  const { tracks, clips, tempo, masterPlugins, projectFormat, surroundFormat, spatialAudioMode } = options;
  const result: RebuildResult = {
    success: false,
    tracksCreated: 0,
    instrumentsLoaded: 0,
    buffersRestored: 0,
    errors: [],
  };

  await audioEngine.waitForReady();

  // ── Step 1: Create track nodes ───────────────────────────────────────────
  for (const track of tracks) {
    try {
      audioEngine.createTrack(track.id);
      audioEngine.updateTrackParams(track.id, track.volume ?? 0.8, track.pan ?? 0);
      result.tracksCreated++;
    } catch (e) {
      const msg = `Failed to create track ${track.id}: ${e}`;
      console.warn('[EngineRebuilder]', msg);
      result.errors.push(msg);
    }
  }

  // ── Step 2: Restore routing graph ────────────────────────────────────────
  for (const track of tracks) {
    try {
      if (track.muted) audioEngine.muteTrack(track.id);
      if (track.soloed) audioEngine.soloTrack(track.id);

      if (track.outputBusId && track.outputBusId !== 'stereo-out') {
        audioEngine.routeTrackToTrack(track.id, track.outputBusId);
      }

      if (track.sends?.length) {
        for (const send of track.sends) {
          audioEngine.routeTrackToBus(track.id, send.busId, send.level);
        }
      }
    } catch (e) {
      result.errors.push(`Routing failed for ${track.id}: ${e}`);
    }
  }

  // ── Step 3: Restore mixer state ──────────────────────────────────────────
  for (const track of tracks) {
    try {
      const vol = track.volume ?? 0.8;
      const pan = track.pan ?? 0;
      audioEngine.updateTrackParams(track.id, vol, pan);
    } catch (e) {
      result.errors.push(`Mixer restore failed for ${track.id}: ${e}`);
    }
  }

  // ── Step 4: Load instruments (sequential, await each) ────────────────────
  for (const track of tracks) {
    // A SoundFont or WAM track owns its own sound and is restored in step 6.
    // `track.instrument` there is only a preset's display name, so looking it
    // up in the built-in registry would attach the wrong instrument.
    if (track.soundFont?.url || track.wamInstrument?.url) continue;

    if (track.instrument) {
      try {
        await audioEngine.loadInstrument(track.id, track.instrument);
        result.instrumentsLoaded++;
      } catch (e) {
        result.errors.push(`Instrument "${track.instrument}" failed for ${track.id}: ${e}`);
      }
    }
  }

  // ── Step 5: Restore audio buffers from IndexedDB ─────────────────────────
  const audioClips = (clips || []).filter((c: any) => c.type === 'audio' && c.storageKey);
  const seenKeys = new Set<string>();

  for (const clip of audioClips) {
    if (!clip.storageKey || seenKeys.has(clip.storageKey)) continue;
    seenKeys.add(clip.storageKey);

    try {
      const arrayBuffer = await loadAudioBuffer(clip.storageKey);
      if (arrayBuffer) {
        const ctx = audioEngine.getContext();
        if (ctx) {
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
          bufferCacheManager.addBuffer(clip.storageKey, audioBuffer, clip.originalName);
          result.buffersRestored++;
        }
      }
    } catch (e) {
      result.errors.push(`Buffer restore failed for ${clip.name || clip.id}: ${e}`);
    }
  }

  // ── Step 6: Restore plugin chains ────────────────────────────────────────
  for (const track of tracks) {
    if (track.plugins?.length) {
      try {
        audioEngine.updateFXChain(track.id, track.plugins);
      } catch (e) {
        result.errors.push(`Plugin chain failed for ${track.id}: ${e}`);
      }
    }

    // A Web Audio Module instrument is loaded from its URL rather than being
    // reconstructed from track state, so it has to be re-fetched on open.
    const wam = (track as { wamInstrument?: { url: string; identifier: string } }).wamInstrument;
    if (wam?.url) {
      void audioEngine
        .loadWamInstrument(track.id, wam.url, wam.identifier)
        .catch(e => console.warn(`[Rebuild] WAM instrument failed for ${track.id}:`, e));
    }

    // Same for a SoundFont preset: the track only carries the bank URL and the
    // preset index, so the .sf2 has to be fetched and the preset re-selected.
    // Without this a reopened project showed the right instrument name but
    // played the fallback synth.
    const sf = (track as {
      soundFont?: { url: string; presetIndex: number };
    }).soundFont;
    if (sf?.url) {
      void loadSoundFontForTrack(track.id, sf.url, sf.presetIndex)
        .then(r => {
          if (!r.ok) console.warn(`[Rebuild] SoundFont failed for ${track.id}: ${r.error}`);
        })
        .catch(e => console.warn(`[Rebuild] SoundFont failed for ${track.id}:`, e));
    }
  }

  // The master bus chain is project state like any other insert chain, so it
  // has to be rebuilt too or a mastered project opens with no bus compression.
  if (masterPlugins?.length) {
    try {
      audioEngine.updateMasterFXChain(masterPlugins);
    } catch (e) {
      result.errors.push(`Master chain failed: ${e}`);
    }
  }

  // ── Step 7: Set tempo & transport ────────────────────────────────────────
  audioEngine.setTempo(tempo);

  if (projectFormat) {
    audioEngine.configureAudioFormat(
      projectFormat,
      surroundFormat || '5.1 (ITU 775)',
      spatialAudioMode || 'Off'
    );
  }

  // ── Step 8: Validation ───────────────────────────────────────────────────
  result.success = result.errors.length === 0;
  console.log(`[EngineRebuilder] Rebuild complete: ${result.tracksCreated} tracks, ${result.instrumentsLoaded} instruments, ${result.buffersRestored} buffers`);

  return result;
}
