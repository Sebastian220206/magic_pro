/**
 * projectExport.ts
 * Render the whole project to an audio file.
 *
 * `projectStore.exportAsAudioFiles` was a `console.log` that closed the export
 * dialog — the last step of writing a track produced nothing at all. This
 * assembles the render inputs from project state, renders offline through the
 * same path playback uses, and hands back both the buffer and an encoded file.
 *
 * Lives in the engine rather than the store so it can be tested without the
 * store, and reused by the export dialog, share, and any future stem export.
 */

import { renderSongOffline, type ExportClip, type ExportTrack } from './OfflineRenderer';
import { encodeWav } from './wavEncoder';
import { tagWavBlob } from './wavMetadata';
import { analyseLoudness, type LoudnessAnalysis } from '../metering/offlineLoudness';
import type { Track, PluginSetting } from '../../models/Track';
import type { Clip } from '../../models/Clip';

export type ExportFileFormat = 'wav' | 'mp3';

export interface ProjectExportSettings {
    format?: ExportFileFormat;
    sampleRate?: number;
    bitDepth?: 16 | 24 | 32;
    /** Defaults to the whole project. */
    startBeat?: number;
    endBeat?: number;
    /** Include only these tracks. Defaults to all of them. */
    trackIds?: string[];
    fileName?: string;
    /** Delivery metadata, carried through to the result for tagging. */
    metadata?: ExportMetadata;
}

/** Tags a delivered master carries. */
export interface ExportMetadata {
    title?: string;
    artist?: string;
    album?: string;
    year?: string;
    /** International Standard Recording Code. */
    isrc?: string;
    comment?: string;
}

export interface ProjectExportResult {
    buffer: AudioBuffer;
    blob: Blob;
    fileName: string;
    /** Tracks rendered dry because their plugins would not instantiate. */
    degradedTracks: string[];
    /** Set when the requested format fell back to WAV. */
    formatNotice?: string;
    /** Metadata carried with the render, for tagging on delivery. */
    metadata?: ExportMetadata;
    /**
     * Loudness of what was actually rendered.
     *
     * A mastering target ("-14 LUFS, true peak -1 dBTP") is only meaningful if
     * the delivered file can be checked against it, so the bounce measures
     * itself rather than leaving it to a separate tool.
     */
    loudness: LoudnessAnalysis;
}

export interface ProjectExportInput {
    tracks: Track[];
    clips: Clip[];
    tempo: number;
    projectName?: string;
    masterPlugins?: PluginSetting[];
}

/** Timeline position of a clip, tolerating the `start`/`startBeat` aliases. */
function clipStart(clip: Clip): number {
    const raw = (clip as unknown as { startBeat?: number }).startBeat ?? clip.start ?? 0;
    return Number.isFinite(raw) ? raw : 0;
}

/** Last beat any clip occupies. */
export function projectEndBeat(clips: Clip[]): number {
    return clips.reduce((end, c) => Math.max(end, clipStart(c) + (c.duration ?? 0)), 0);
}

function toExportClip(clip: Clip): ExportClip {
    return {
        id: clip.id,
        trackId: clip.trackId,
        startBeat: clipStart(clip),
        duration: clip.duration,
        type: clip.type === 'midi' ? 'midi' : 'audio',
        offset: clip.offset ?? 0,
        muted: clip.muted ?? false,
        sampleId: clip.sampleId,
        fileUrl: clip.fileUrl,
        storageKey: clip.storageKey,
        playbackRate: clip.playbackRate,
        fadeIn: clip.fadeIn,
        fadeOut: clip.fadeOut,
        notes: clip.notes,
    } as ExportClip;
}

function toExportTrack(track: Track): ExportTrack {
    return {
        id: track.id,
        name: track.name,
        volume: track.volume ?? 0.8,
        pan: track.pan ?? 0,
        muted: track.muted ?? false,
        soloed: track.soloed ?? false,
        instrument: track.instrument,
        plugins: track.plugins,
    };
}

function sanitiseFileName(name: string): string {
    const cleaned = name.replace(/[\\/:*?"<>|]+/g, '-').trim();
    return cleaned.length > 0 ? cleaned : 'Untitled';
}

/**
 * Render the project and encode it.
 *
 * MP3 needs an encoder this app does not bundle, so it is reported as a
 * fallback to WAV rather than silently handing back a mislabelled file.
 */
export async function exportProjectAudio(
    input: ProjectExportInput,
    settings: ProjectExportSettings = {},
): Promise<ProjectExportResult> {
    const { tracks, clips, tempo } = input;

    const included = settings.trackIds?.length
        ? tracks.filter(t => settings.trackIds!.includes(t.id))
        : tracks;

    const trackIds = new Set(included.map(t => t.id));
    // Bus and folder tracks carry no clips of their own; they still need to be
    // present so sends and routing resolve.
    const exportClips = clips.filter(c => trackIds.has(c.trackId)).map(toExportClip);

    const startBeat = settings.startBeat ?? 0;
    const endBeat = settings.endBeat ?? projectEndBeat(clips.filter(c => trackIds.has(c.trackId)));
    if (!(endBeat > startBeat)) {
        throw new Error('Nothing to export: the project has no audible range.');
    }

    const degradedTracks: string[] = [];
    const buffer = await renderSongOffline(
        exportClips,
        included.map(toExportTrack),
        tempo,
        {
            startBeat,
            endBeat,
            sampleRate: settings.sampleRate,
            bitDepth: settings.bitDepth,
            onPluginFailure: failed => degradedTracks.push(...failed),
        },
    );

    // Tags go into the file itself, not just the result object — a delivered
    // master should arrive with its ISRC already embedded.
    const blob = await tagWavBlob(
        await encodeWav(buffer, { bitDepth: settings.bitDepth ?? 24 }),
        settings.metadata,
    );

    const channels = Array.from(
        { length: buffer.numberOfChannels },
        (_, i) => buffer.getChannelData(i),
    );
    const loudness = analyseLoudness(channels, buffer.sampleRate);

    const base = sanitiseFileName(settings.fileName ?? input.projectName ?? 'Untitled');
    const requested = settings.format ?? 'wav';

    return {
        buffer,
        blob,
        fileName: `${base}.wav`,
        degradedTracks,
        loudness,
        metadata: settings.metadata,
        formatNotice: requested === 'mp3'
            ? 'MP3 encoding is not available in the browser build — exported as WAV.'
            : undefined,
    };
}

/** The minimum a download needs — stems supply this without a full result. */
export interface DownloadableExport {
    blob: Blob;
    fileName: string;
}

/** Save a rendered export to the user's downloads. No-op outside a browser. */
export function downloadExport(result: DownloadableExport): void {
    if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return;

    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoke on the next tick; revoking synchronously can cancel the download.
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
