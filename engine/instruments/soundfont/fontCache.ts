/**
 * fontCache.ts
 * Shared cache for downloaded and parsed SoundFonts.
 *
 * `SoundFontLoader.loadFromPath` fetches unconditionally, and
 * `useInstruments.loadSoundFont` built a fresh `SoundFontInstrument` for every
 * selection — so changing preset re-downloaded and re-parsed the entire font.
 * With a 30 MB General MIDI bank that meant tens of seconds and a fresh 30 MB
 * transfer per click, which read as "presets don't load".
 *
 * Two layers:
 *  - an in-memory map of parsed fonts, so switching preset costs nothing;
 *  - the existing IndexedDB byte cache, so a reload avoids the network.
 */

import { SoundFontParser, type Sf2ParsedData } from './SoundFontParser';
import { getCachedFont, setCachedFont } from '@/lib/soundfontCache';

export interface LoadedFont {
    url: string;
    parsed: Sf2ParsedData;
    byteLength: number;
}

/** url → parsed font. Also dedupes concurrent loads of the same URL. */
const memory = new Map<string, Promise<LoadedFont>>();

/** Read the font's bytes, preferring the IndexedDB cache over the network. */
async function fetchBytes(url: string): Promise<ArrayBuffer> {
    try {
        const cached = await getCachedFont(url);
        if (cached?.data && cached.data.byteLength > 0) return cached.data;
    } catch {
        // Cache unavailable (private mode, quota) — fall through to network.
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch SoundFont: ${url} (${response.status})`);

    const buffer = await response.arrayBuffer();

    // Store for next time. A quota failure must not fail the load.
    try {
        await setCachedFont(url, buffer, '1', buffer.byteLength);
    } catch {
        // Non-fatal.
    }

    return buffer;
}

/**
 * Get a font, parsing it at most once per URL for the lifetime of the page.
 *
 * Concurrent callers share the same in-flight promise, so clicking through
 * several presets while the first load is still running does not start
 * additional 30 MB downloads.
 */
export function getParsedFont(url: string): Promise<LoadedFont> {
    const existing = memory.get(url);
    if (existing) return existing;

    const pending = (async (): Promise<LoadedFont> => {
        const buffer = await fetchBytes(url);
        const parsed = new SoundFontParser().parse(buffer);
        if (!parsed.presets.length) {
            throw new Error(`SoundFont has no presets: ${url}`);
        }
        return { url, parsed, byteLength: buffer.byteLength };
    })().catch(error => {
        // Never cache a failure; the user may simply be offline.
        memory.delete(url);
        throw error;
    });

    memory.set(url, pending);
    return pending;
}

/** True when the font is already parsed and switching preset is instant. */
export function isFontReady(url: string): boolean {
    return memory.has(url);
}

/** Drop a font from the in-memory cache. Test-only / recovery. */
export function forgetFont(url: string): void {
    memory.delete(url);
}
