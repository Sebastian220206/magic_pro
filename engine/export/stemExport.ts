/**
 * stemExport.ts
 * Render one audio file per bus, for delivery or a remix pack.
 *
 * `engine/export/stemExporter.ts` exists but is an island — nothing outside
 * `engine/export/index.ts` imports it, and it does not go through the offline
 * renderer that freeze, bounce and project export all share. This builds stems
 * on that same path so a stem matches what the mix actually does.
 *
 * The delivery rule that matters: every stem starts at the same beat and is the
 * same length, so dropping them into another session lines them up with no
 * trimming.
 */

import { exportProjectAudio, projectEndBeat, type ProjectExportInput } from './projectExport';
import type { Track } from '../../models/Track';

export interface StemExportSettings {
    /** Busses (or tracks) to render, one stem each. Defaults to every bus. */
    busIds?: string[];
    sampleRate?: number;
    bitDepth?: 16 | 24 | 32;
    /** Defaults to the start of the project. */
    startBeat?: number;
    endBeat?: number;
}

export interface Stem {
    busId: string;
    name: string;
    fileName: string;
    buffer: AudioBuffer;
    blob: Blob;
    /** True when this stem rendered without its plugins. */
    degraded: boolean;
}

/** Every track that feeds `busId`, directly or through another bus. */
export function tracksFeeding(busId: string, tracks: Track[]): string[] {
    const collected = new Set<string>([busId]);

    // Walk down the tree until it stops growing; bus trees are shallow, and
    // this tolerates a cycle rather than recursing forever on one.
    let grew = true;
    while (grew) {
        grew = false;
        for (const track of tracks) {
            const parent = track.outputBusId;
            if (parent && collected.has(parent) && !collected.has(track.id)) {
                collected.add(track.id);
                grew = true;
            }
        }
    }
    return [...collected];
}

/**
 * Render one stem per bus.
 *
 * All stems share a single start and end beat, computed once across the whole
 * project, so they are frame-aligned with each other.
 */
export async function exportStems(
    input: ProjectExportInput,
    settings: StemExportSettings = {},
): Promise<Stem[]> {
    const busIds = settings.busIds?.length
        ? settings.busIds
        : input.tracks.filter(t => t.type === 'bus').map(t => t.id);

    if (busIds.length === 0) {
        throw new Error('Nothing to export: the project has no busses.');
    }

    // One range for every stem — this is what keeps them aligned.
    const startBeat = settings.startBeat ?? 0;
    const endBeat = settings.endBeat ?? projectEndBeat(input.clips);
    if (!(endBeat > startBeat)) {
        throw new Error('Nothing to export: the project has no audible range.');
    }

    const stems: Stem[] = [];
    for (const busId of busIds) {
        const bus = input.tracks.find(t => t.id === busId);
        const name = bus?.name ?? busId;
        const feeding = tracksFeeding(busId, input.tracks);

        const result = await exportProjectAudio(input, {
            trackIds: feeding,
            startBeat,
            endBeat,
            sampleRate: settings.sampleRate,
            bitDepth: settings.bitDepth,
            fileName: name,
        });

        stems.push({
            busId,
            name,
            fileName: result.fileName,
            buffer: result.buffer,
            blob: result.blob,
            degraded: result.degradedTracks.length > 0,
        });
    }

    return stems;
}
