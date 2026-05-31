/**
 * useAudioPlayer.ts
 * React hook that wires the Zustand project store to audioEngine2 + scheduler.
 *
 * Responsibilities:
 *  1. Buffer management — preloads every audio clip's fileUrl into an AudioBuffer.
 *     Keeps a ref-stable Map<clipId, AudioBuffer> so the scheduler can find them.
 *  2. Transport wiring — watches store.playing and calls scheduler.startPlayback /
 *     stopPlayback accordingly.
 *  3. Track sync — whenever tracks change, updates gain/pan in the engine.
 *  4. Tempo sync — passes live tempo changes to the running scheduler.
 *
 * Usage — mount exactly once near the root (e.g. the project page):
 *
 *   useAudioPlayer();
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { audioEngineAdapter } from './AudioEngineAdapter';
import { advancedScheduler as scheduler } from './audioEngine/scheduler';
import { decodeFromUrl } from './audioImport';
import { Clip } from '@/models/Clip';

// ─── Module-level buffer cache (survives re-renders across the whole session) ──
// Exported so other modules (e.g. waveform renderer) can read the same cache.
export const audioBufferCache = new Map<string, AudioBuffer>();

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAudioPlayer() {
    // Get a stable reference to the Zustand store selector so we can access
    // state inside callbacks without stale closure issues.
    const clips    = useProjectStore(s => s.clips);
    const tracks   = useProjectStore(s => s.tracks);
    const playing  = useProjectStore(s => s.playing);
    const playhead = useProjectStore(s => s.playhead);
    const tempo    = useProjectStore(s => s.tempo);

    // Stable ref to the buffer map so effect callbacks don't go stale.
    const buffersRef = useRef<Map<string, AudioBuffer>>(audioBufferCache);

    // ── 1. Buffer loading ──────────────────────────────────────────────────────
    //
    // Whenever clips change, load any new audio fileUrls we haven't seen before.
    // Already-loaded clips are skipped (Map lookup is O(1)).

    const loadBuffers = useCallback(async (clipsToLoad: Clip[]) => {
        const audioClips = clipsToLoad.filter(
            c => c.type === 'audio' && c.fileUrl && !buffersRef.current.has(c.id),
        );

        // Ensure AudioContext is created and resumed before loading
        const ctx = audioEngineAdapter.getContext();
        if (ctx && ctx.state === 'suspended') {
            try {
                await ctx.resume();
            } catch (error) {
                console.warn('[useAudioPlayer] Could not resume AudioContext:', error);
            }
        }

        await Promise.allSettled(
            audioClips.map(async clip => {
                try {
                    const buffer = await decodeFromUrl(clip.fileUrl!);
                    buffersRef.current.set(clip.id, buffer);
                    // Also key by fileUrl so the scheduler fallback works
                    buffersRef.current.set(clip.fileUrl!, buffer);
                    console.log(`[useAudioPlayer] Successfully loaded buffer for "${clip.name}"`);
                } catch (err) {
                    console.warn(`[useAudioPlayer] Failed to load "${clip.name}":`, err);
                }
            }),
        );
    }, []);

    useEffect(() => {
        loadBuffers(clips);
    }, [clips, loadBuffers]);

    // ── 2. Track node creation + parameter sync ────────────────────────────────
    //
    // Ensure every track has a gain/pan/mute node in the engine and that those
    // nodes reflect the current volume / pan / muted / soloed state.
    //
    // We use syncTrack() rather than individual set* calls so that the solo
    // group is recalculated atomically across all tracks on every change.

    useEffect(() => {
        tracks.forEach(track => {
            // MUST ENSURE GRAPH NODES EXIST BEFORE SYNCING
            if (!audioEngineAdapter.getTrackNodes(track.id)) {
                audioEngineAdapter.createTrack(track.id);
            }

            audioEngineAdapter.syncTrack(
                track.id,
                track.volume,
                track.pan,
                track.muted,
                track.soloed,
            );
        });
    }, [tracks]);

    // ── 3. Transport wiring ────────────────────────────────────────────────────
    //
    // React to store.playing changes.
    // When true  → build a snapshot and hand it to the scheduler.
    // When false → stop the scheduler and all active audio sources.

    const playheadRef = useRef(playhead);
    const tempoRef    = useRef(tempo);
    const clipsRef    = useRef(clips);
    const tracksRef   = useRef(tracks);

    // Keep refs fresh without triggering the transport effect
    useEffect(() => { playheadRef.current = playhead; }, [playhead]);
    useEffect(() => { tempoRef.current    = tempo;    }, [tempo]);
    useEffect(() => { clipsRef.current    = clips;    }, [clips]);
    useEffect(() => { tracksRef.current   = tracks;   }, [tracks]);

    useEffect(() => {
        if (playing) {
            // Make sure we have decoded buffers for all current clips before starting.
            // loadBuffers is fast (cache-first) so the await is usually a no-op.
            loadBuffers(clipsRef.current).then(() => {
                // Double-check that we're still in playing state and have buffers
                if (!playing) return;
                
                const audioClips = clipsRef.current.filter(c => c.type === 'audio');
                const missingBuffers = audioClips.filter(c => 
                    !buffersRef.current.has(c.id) && !buffersRef.current.has(c.fileUrl!)
                );
                
                if (missingBuffers.length > 0) {
                    console.warn(`[useAudioPlayer] Missing buffers for ${missingBuffers.length} clips, waiting...`);
                    // Wait a bit more for buffers to load
                    setTimeout(() => {
                        const clipsWithBuffers = clipsRef.current.map(c => ({
                            ...c,
                            buffer: buffersRef.current.get(c.id) || (c.fileUrl ? buffersRef.current.get(c.fileUrl) : undefined)
                        }));
                        scheduler.startPlayback(
                            clipsWithBuffers as any,
                            tracksRef.current as any,
                            playheadRef.current,
                            tempoRef.current
                        );
                    }, 500);
                    return;
                }
                
                console.log(`[useAudioPlayer] Starting playback with ${buffersRef.current.size} buffers`);
                const clipsWithBuffers = clipsRef.current.map(c => ({
                    ...c,
                    buffer: buffersRef.current.get(c.id) || (c.fileUrl ? buffersRef.current.get(c.fileUrl) : undefined)
                }));
                scheduler.startPlayback(
                    clipsWithBuffers as any,
                    tracksRef.current as any,
                    playheadRef.current,
                    tempoRef.current
                );
            });
        } else {
            scheduler.stopPlayback();
        }

        // Cleanup: if component unmounts while playing, stop everything.
        return () => {
            if (playing) scheduler.stopPlayback();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playing]); // Only re-run when playing toggles

    // ── 4. Live tempo sync ─────────────────────────────────────────────────────
    //
    // Forward tempo changes to the running scheduler so future clip scheduling
    // uses the correct BPM without restarting playback.

    useEffect(() => {
        if (playing) {
            scheduler.setTempo(tempo);
        }
    }, [tempo, playing]);

    // ── 5. Master volume ───────────────────────────────────────────────────────

    const masterVolume = useProjectStore(s => s.settings.masterVolume);
    const masterPan = useProjectStore(s => s.settings.masterPan);
    const masterMuted = useProjectStore(s => s.settings.masterMuted);

    useEffect(() => {
        audioEngineAdapter.setMasterVolume(masterVolume);
        audioEngineAdapter.setMasterPan(masterPan);
        // Note: Master muted is handled via volume in adapter/V2 for now
        if (masterMuted) audioEngineAdapter.setMasterVolume(0);
    }, [masterVolume, masterPan, masterMuted]);
}
