/**
 * loadSoundFontForTrack.ts
 * Assign a SoundFont preset to a track.
 *
 * Module-level rather than a hook callback so it does not depend on a component
 * being mounted, and so it can be exercised directly in tests and from the
 * console. `useInstruments` wraps it.
 */

import { audioContextManager } from '../../audioEngine/audioContext';
import { ensureInstrumentService } from '../instrumentBootstrap';
import { getInstrumentService } from '../instrumentService';
import { SoundFontInstrument } from './SoundFontInstrument';
import { getParsedFont } from './fontCache';

/**
 * Which font each track currently holds, so selecting another preset from the
 * same bank skips the fetch and parse entirely.
 */
const trackFonts = new Map<string, { url: string; instrument: SoundFontInstrument }>();

/** Human-readable preset name, falling back to its index. */
export function presetLabel(instrument: SoundFontInstrument, presetIndex: number): string {
    const name = instrument.getPresetList?.()?.[presetIndex]?.name?.trim();
    return name && name.length > 0 ? name : `SoundFont:${presetIndex}`;
}

export interface LoadSoundFontResult {
    ok: boolean;
    /** Name of the selected preset, for display on the track. */
    label?: string;
    error?: string;
}

/**
 * Load `fileUrl` onto `trackId` and select `presetIndex`.
 *
 * Selecting a different preset from a bank the track already has loaded is a
 * zone reload only — no network, no parse. Previously every selection built a
 * new instrument and re-fetched the whole font, which on a 30 MB General MIDI
 * bank made preset switching appear broken.
 */
export async function loadSoundFontForTrack(
    trackId: string,
    fileUrl: string,
    presetIndex: number,
): Promise<LoadSoundFontResult> {
    try {
        await ensureInstrumentService();
    } catch (error) {
        return { ok: false, error: `Instrument service unavailable: ${error}` };
    }

    const ctx = audioContextManager.getContext();
    if (!ctx) return { ok: false, error: 'Audio context not available' };

    const service = getInstrumentService();

    try {
        // Fast path: same font already on this track.
        const existing = trackFonts.get(trackId);
        if (existing && existing.url === fileUrl && service.hasInstrument(trackId)) {
            if (!existing.instrument.selectPreset(presetIndex)) {
                return { ok: false, error: `Preset ${presetIndex} out of range` };
            }
            return { ok: true, label: presetLabel(existing.instrument, presetIndex) };
        }

        const { parsed } = await getParsedFont(fileUrl);

        const instrument = new SoundFontInstrument(ctx);
        await instrument.loadFromParsedData(fileUrl, parsed, new ArrayBuffer(0), fileUrl);

        if (!instrument.selectPreset(presetIndex)) {
            return {
                ok: false,
                error: `Preset ${presetIndex} out of range (font has ${parsed.presets.length})`,
            };
        }

        const label = presetLabel(instrument, presetIndex);
        if (!service.setCustomInstrument(trackId, label, instrument)) {
            return { ok: false, error: 'Instrument service rejected the instrument' };
        }

        trackFonts.set(trackId, { url: fileUrl, instrument });
        return { ok: true, label };
    } catch (error) {
        return { ok: false, error: String(error) };
    }
}

/** Forget a track's font binding, e.g. when the track is deleted. */
export function releaseTrackFont(trackId: string): void {
    trackFonts.delete(trackId);
}
