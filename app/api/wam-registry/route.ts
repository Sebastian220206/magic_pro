import { NextResponse } from 'next/server';
import { COMMUNITY_BASE, toProxiedPluginUrl } from '@/engine/plugins/wam/allowlist';
import { requireUserId, withApiHandler } from '@/lib/apiAuth';

/**
 * The Web Audio Module plugin catalogue.
 *
 * Fetches the community index and rewrites each entry's relative `path` into a
 * URL served by our proxy, so the client never needs to know the upstream host
 * and can't be pointed at an arbitrary one.
 *
 * Mounted outside `/api/wam` so it doesn't collide with the proxy's catch-all.
 */

/** Reads the session, so it can never be statically rendered. */
export const dynamic = 'force-dynamic';

const CATALOG_URL = `${COMMUNITY_BASE}/plugins.json`;
const TIMEOUT_MS = 15_000;

export interface WamCatalogEntry {
    identifier: string;
    name: string;
    vendor: string;
    description?: string;
    website?: string;
    keywords: string[];
    categories: string[];
    /** Proxied URL of the plugin's entry module. */
    url: string;
    /** Proxied URL of the screenshot, when the entry has one. */
    thumbnail?: string;
    isInstrument: boolean;
}

interface UpstreamEntry {
    identifier?: string;
    name?: string;
    vendor?: string;
    description?: string;
    website?: string;
    keywords?: string[];
    category?: string[];
    thumbnail?: string;
    path?: string;
}

/** Cached in module scope — the catalogue changes rarely and this is a proxy. */
let cache: { at: number; entries: WamCatalogEntry[] } | null = null;
const CACHE_MS = 10 * 60 * 1000;

function normalise(raw: UpstreamEntry): WamCatalogEntry | null {
    if (!raw?.path || !raw.name) return null;

    const categories = raw.category ?? [];
    return {
        identifier: raw.identifier ?? raw.path,
        name: raw.name,
        vendor: raw.vendor ?? 'Unknown',
        description: raw.description,
        website: raw.website,
        keywords: raw.keywords ?? [],
        categories,
        url: toProxiedPluginUrl(raw.path),
        thumbnail: raw.thumbnail ? toProxiedPluginUrl(raw.thumbnail) : undefined,
        // Instruments take MIDI and produce sound; they cannot sit in an
        // insert chain, so the UI has to offer them differently.
        isInstrument: categories.includes('Instrument'),
    };
}

export const GET = withApiHandler('wam.registry', async () => {
    await requireUserId();

    if (cache && Date.now() - cache.at < CACHE_MS) {
        return NextResponse.json({ plugins: cache.entries, cached: true });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const upstream = await fetch(CATALOG_URL, { signal: controller.signal });
        if (!upstream.ok) {
            return NextResponse.json(
                { error: `Plugin catalogue unavailable (${upstream.status})` },
                { status: 502 },
            );
        }

        const raw = await upstream.json();
        const list: UpstreamEntry[] = Array.isArray(raw) ? raw : raw?.plugins ?? [];
        const entries = list
            .map(normalise)
            .filter((e): e is WamCatalogEntry => e !== null);

        cache = { at: Date.now(), entries };
        return NextResponse.json({ plugins: entries, cached: false });
    } catch (error) {
        if ((error as Error)?.name === 'AbortError') {
            return NextResponse.json({ error: 'Plugin catalogue timed out' }, { status: 504 });
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
});
