import { NextResponse } from 'next/server';
import { resolveUpstreamUrl } from '@/engine/plugins/wam/allowlist';
import { requireUserId, withApiHandler } from '@/lib/apiAuth';

/**
 * Serve Web Audio Module plugin assets from our own origin.
 *
 * `Cross-Origin-Embedder-Policy: require-corp` (next.config.js) blocks any
 * cross-origin subresource that doesn't send CORP, which the community plugin
 * host does not. Proxying puts the plugin's module, worklet and wasm on our
 * origin so they load.
 *
 * The path is **mirrored**, not passed as a query parameter, because a plugin
 * is a directory of files with relative imports: `index.js` importing
 * `./gui.js` must resolve to this same route one level up. A query-param proxy
 * would break every plugin that ships more than one file.
 *
 * ⚠️ Anything served here executes same-origin. `resolveUpstreamUrl` enforces
 * the host allowlist and rejects traversal; do not loosen it. See
 * `engine/plugins/wam/allowlist.ts` for the trust model.
 */

/** Cap a single asset. Plugin bundles are small; samples belong elsewhere. */
const MAX_BYTES = 25 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 20_000;

/** Content types by extension — the browser refuses modules served as text/plain. */
const CONTENT_TYPES: Record<string, string> = {
    js: 'text/javascript; charset=utf-8',
    mjs: 'text/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8',
    wasm: 'application/wasm',
    css: 'text/css; charset=utf-8',
    html: 'text/html; charset=utf-8',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
};

function contentTypeFor(path: string, upstream: string | null): string {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    if (CONTENT_TYPES[ext]) return CONTENT_TYPES[ext];
    // Never echo an upstream type for an unknown extension — a mislabelled
    // script served same-origin is an execution risk.
    return upstream?.startsWith('image/') ? upstream : 'application/octet-stream';
}

export const GET = withApiHandler('wam.proxy', async (
    _request: Request,
    { params }: { params: { path: string[] } },
) => {
    // Signed-in users only: this route makes outbound requests on our behalf.
    await requireUserId();

    const upstreamUrl = resolveUpstreamUrl(params.path ?? []);
    if (!upstreamUrl) {
        return NextResponse.json({ error: 'Not an allowed plugin path' }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    try {
        const upstream = await fetch(upstreamUrl, {
            signal: controller.signal,
            headers: { accept: '*/*' },
        });

        if (!upstream.ok) {
            return NextResponse.json(
                { error: `Plugin asset unavailable (${upstream.status})` },
                { status: upstream.status === 404 ? 404 : 502 },
            );
        }

        const declared = Number(upstream.headers.get('content-length') ?? '0');
        if (declared > MAX_BYTES) {
            return NextResponse.json({ error: 'Plugin asset too large' }, { status: 413 });
        }

        const body = await upstream.arrayBuffer();
        if (body.byteLength > MAX_BYTES) {
            return NextResponse.json({ error: 'Plugin asset too large' }, { status: 413 });
        }

        const joined = (params.path ?? []).join('/');
        return new NextResponse(body, {
            status: 200,
            headers: {
                'Content-Type': contentTypeFor(joined, upstream.headers.get('content-type')),
                // Lets the asset load under require-corp.
                'Cross-Origin-Resource-Policy': 'cross-origin',
                'X-Content-Type-Options': 'nosniff',
                // Plugin bundles are versioned by path and effectively immutable.
                'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
            },
        });
    } catch (error) {
        if ((error as Error)?.name === 'AbortError') {
            return NextResponse.json({ error: 'Plugin host timed out' }, { status: 504 });
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
});
