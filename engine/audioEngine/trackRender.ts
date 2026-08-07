/**
 * trackRender.ts
 * Offline rendering of a single track — the machinery behind Freeze and
 * Bounce in Place.
 *
 * Both features answer the same question: "render this track exactly as it
 * sounds now, and play the result back instead of recomputing it." Freeze is
 * reversible and keeps the source material; Bounce in Place replaces it.
 *
 * `engine/audioEngine/trackFreeze.ts` and `bounceInPlace.ts` contain earlier,
 * unreferenced implementations that assume a constant tempo and their own MIDI
 * rendering path. This module instead reuses `renderSongOffline`, which is the
 * renderer the export path already relies on, so a frozen track sounds like the
 * exported file.
 */

import { renderSongOffline, type ExportClip, type ExportTrack } from '../export/OfflineRenderer';
import type { TempoPoint } from './tempoMap';
import type { PluginSetting } from '../../models/Track';

export interface RenderableNote {
    pitch: number;
    velocity: number;
    start: number;
    duration: number;
}

export interface RenderableClip {
    id: string;
    trackId: string;
    type: string;
    start?: number;
    startBeat?: number;
    duration: number;
    offset?: number;
    muted?: boolean;
    sampleId?: string;
    fileUrl?: string;
    storageKey?: string;
    playbackRate?: number;
    notes?: RenderableNote[];
}

export interface RenderableTrack {
    id: string;
    name: string;
    volume: number;
    pan: number;
    muted: boolean;
    soloed: boolean;
    instrument?: string;
    /** Insert chain, baked into the render when freezing. */
    plugins?: PluginSetting[];
}

export interface TrackRenderResult {
    buffer: AudioBuffer;
    /** Timeline beat the rendered audio begins at. */
    startBeat: number;
    /** Length of the rendered region in beats. */
    durationBeats: number;
    /** Ids of the clips that were consumed. */
    sourceClipIds: string[];
}

const beatOf = (clip: RenderableClip) => clip.startBeat ?? clip.start ?? 0;

/**
 * The beat range a set of clips occupies.
 *
 * Freeze always renders from beat 0 so the resulting buffer can be dropped onto
 * the timeline at a known origin; rendering from the first clip would require
 * every consumer to track an extra offset.
 */
export function clipSpan(clips: RenderableClip[]): { startBeat: number; endBeat: number } {
    if (clips.length === 0) return { startBeat: 0, endBeat: 0 };

    let endBeat = 0;
    for (const clip of clips) {
        endBeat = Math.max(endBeat, beatOf(clip) + (clip.duration ?? 0));
    }
    return { startBeat: 0, endBeat };
}

/**
 * Render one track's clips to a buffer.
 *
 * The track is rendered unmuted and unsoloed at unity gain and centre pan, so
 * the frozen audio carries only the instrument and its inserts. Fader, pan and
 * mute stay live on the channel strip and continue to apply afterwards — which
 * is what makes a frozen track still mixable.
 */
export async function renderTrackOffline(
    track: RenderableTrack,
    clips: RenderableClip[],
    tempo: number,
    options: { sampleRate?: number; tempoMap?: TempoPoint[] } = {},
): Promise<TrackRenderResult | null> {
    const own = clips.filter(c => c.trackId === track.id && !c.muted);
    if (own.length === 0) return null;

    const { endBeat } = clipSpan(own);
    if (endBeat <= 0) return null;

    const exportClips: ExportClip[] = own.map(clip => ({
        id: clip.id,
        trackId: clip.trackId,
        startBeat: beatOf(clip),
        duration: clip.duration,
        type: clip.type === 'midi' ? 'midi' : 'audio',
        offset: clip.offset ?? 0,
        muted: false,
        sampleId: clip.sampleId,
        fileUrl: clip.fileUrl,
        storageKey: clip.storageKey,
        playbackRate: clip.playbackRate,
        notes: clip.notes,
    }));

    // Inserts are baked in — freeing their CPU is the point of freezing — but
    // fader, pan, mute and solo stay live on the channel strip so a frozen
    // track is still mixable.
    const exportTrack: ExportTrack = {
        id: track.id,
        name: track.name,
        volume: 1,
        pan: 0,
        muted: false,
        soloed: false,
        instrument: track.instrument,
        plugins: track.plugins,
    };

    const buffer = await renderSongOffline(exportClips, [exportTrack], tempo, {
        startBeat: 0,
        endBeat,
        sampleRate: options.sampleRate,
    });

    return {
        buffer,
        startBeat: 0,
        durationBeats: endBeat,
        sourceClipIds: own.map(c => c.id),
    };
}

/** Cache key under which a track's frozen audio is stored. */
export const freezeBufferId = (trackId: string) => `freeze:${trackId}`;

/** Id of the synthetic clip that plays a frozen track. */
export const freezeClipId = (trackId: string) => `freeze-clip:${trackId}`;
