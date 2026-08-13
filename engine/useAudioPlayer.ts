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
        if (!playing) {
            scheduler.stopPlayback();
            return;
        }

        // The beat the user pressed play at, captured now rather than after the
        // awaits below. The store's transport loop starts the moment `playing`
        // flips, so `playheadRef.current` has already moved on by the time the
        // buffer work finishes — reading it late made every playback start a
        // little further in than the last, until the start beat had marched
        // past the end of the project and nothing sounded at all.
        const startBeat = playheadRef.current;
        let cancelled = false;

        const begin = () => {
            if (cancelled) return;
            const clipsWithBuffers = clipsRef.current.map(c => ({
                ...c,
                buffer: buffersRef.current.get(c.id) || (c.fileUrl ? buffersRef.current.get(c.fileUrl) : undefined)
            }));
            scheduler.startPlayback(
                clipsWithBuffers as any,
                tracksRef.current as any,
                startBeat,
                tempoRef.current
            );
        };

        // Make sure we have decoded buffers for all current clips before starting.
        // loadBuffers is fast (cache-first) so the await is usually a no-op.
        loadBuffers(clipsRef.current).then(() => {
            if (cancelled) return;

            // Only a clip with a source can ever produce a buffer. Clips without
            // a fileUrl — an empty recording slot, a MIDI-backed take — were
            // counted as "still loading", so every single playback paid the
            // 500ms wait below for buffers that were never going to arrive.
            const missingBuffers = clipsRef.current.filter(c =>
                c.type === 'audio' && c.fileUrl &&
                !buffersRef.current.has(c.id) && !buffersRef.current.has(c.fileUrl)
            );

            if (missingBuffers.length > 0) {
                console.warn(`[useAudioPlayer] Missing buffers for ${missingBuffers.length} clips, waiting...`);
                setTimeout(begin, 500);
                return;
            }

            console.log(`[useAudioPlayer] Starting playback with ${buffersRef.current.size} buffers`);
            begin();
        });

        // Cleanup: if playing goes false — or the component unmounts — stop, and
        // make sure a pending start cannot fire after the stop.
        return () => {
            cancelled = true;
            scheduler.stopPlayback();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playing]); // Only re-run when playing toggles

    // ── 4. Live tempo sync ─────────────────────────────────────────────────────
    //
    // Push the project's whole tempo track, not just the current BPM. The
    // scheduler integrates it to convert beats to time, so tempo changes and
    // ramps actually move the audio rather than only the readout.

    const tempoPoints = useProjectStore(s => s.globalTracks.tempo);

    useEffect(() => {
        const points = (tempoPoints ?? [])
            .filter(p => typeof p.value === 'number')
            .map(p => ({
                time: p.time,
                value: p.value as number,
                type: p.type === 'ramp' ? ('ramp' as const) : ('jump' as const),
            }));

        if (points.length > 0) {
            scheduler.setTempoMap(points);
        } else {
            // No tempo track — fall back to the project's scalar BPM.
            scheduler.setTempo(tempo);
        }
    }, [tempoPoints, tempo]);

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
