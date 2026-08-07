/**
 * instrumentBootstrap.ts
 * Brings the instrument service up and attaches instruments to tracks.
 *
 * Lives in the engine layer rather than in the React hook so both the store and
 * UI can call it without a circular import, and so the instrument graph's
 * lifetime is tied to the application rather than to whichever component
 * happened to mount first.
 *
 * Previously this ran inside `useInstruments`, which only `LibraryPanel`
 * mounted — and its cleanup called `service.dispose()`. Closing the Library
 * therefore destroyed every loaded instrument, and under React StrictMode the
 * mount/unmount/mount cycle tore it down immediately after loading. Playback
 * silently fell back to the built-in synth.
 */

import { audioContextManager } from '../audioEngine/audioContext';
import { getInstrumentService } from './instrumentService';

export interface TrackInstrumentRef {
    id: string;
    instrument?: string;
    /** Present when the track's sound comes from a SoundFont preset. */
    soundFont?: { url: string; presetIndex: number };
    /** Present when the track's sound comes from a Web Audio Module. */
    wamInstrument?: { url: string };
}

/** Shared so concurrent callers await one initialisation rather than racing. */
let initPromise: Promise<void> | null = null;

/**
 * Ensure the audio context and instrument service are ready.
 *
 * Idempotent. A failure clears the memo so a later call can retry — the context
 * may simply not have been unlocked by a user gesture yet.
 */
export async function ensureInstrumentService(): Promise<void> {
    if (!initPromise) {
        initPromise = (async () => {
            if (!audioContextManager.getContext()) {
                await audioContextManager.initialize();
            }
            await getInstrumentService().initialize();
        })().catch(error => {
            initPromise = null;
            throw error;
        });
    }
    return initPromise;
}

/**
 * Initialise the service and attach instruments for any track that names one
 * but does not yet have it loaded.
 *
 * `onTrackReady` reports tracks whose instrument was successfully attached, so
 * the caller can mark them loaded in its own state.
 */
export async function initializeInstruments(
    tracks: TrackInstrumentRef[] = [],
    onTrackReady?: (trackId: string, updates: { instrumentLoaded: boolean }) => void,
): Promise<void> {
    await ensureInstrumentService();

    const service = getInstrumentService();
    for (const track of tracks) {
        if (!track.instrument || service.hasInstrument(track.id)) continue;
        // SoundFont and WAM tracks are restored from their own persisted
        // reference by `rebuildEngine`. Their `instrument` is a preset's
        // display name, so looking it up here would attach an unrelated
        // built-in on top of — or in a race, instead of — the real one.
        if (track.soundFont?.url || track.wamInstrument?.url) continue;
        if (service.assignInstrument(track.id, track.instrument)) {
            onTrackReady?.(track.id, { instrumentLoaded: true });
        }
    }
}

/** Reset memoised initialisation. Test-only. */
export function __resetInstrumentBootstrap(): void {
    initPromise = null;
}
