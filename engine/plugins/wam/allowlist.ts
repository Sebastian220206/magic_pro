/**
 * allowlist.ts
 * Which hosts WAM plugins may be fetched from.
 *
 * ⚠️ Plugin code is served through our own proxy and therefore runs **same
 * origin**. Its DSP half is sandboxed (an AudioWorklet has no DOM), but the
 * loader and GUI run in the page with full privilege: they can read
 * `localStorage`, read the session cookie, and call our authenticated API
 * routes. WAM 2.0 has no sandbox for this.
 *
 * The allowlist is therefore a security control, not a convenience. Never
 * accept a user-supplied URL in production, and prefer serving the proxy from a
 * separate origin if this is ever exposed to untrusted plugins.
 */

/** Upstream origins the proxy will fetch from. */
export const ALLOWED_PLUGIN_HOSTS: readonly string[] = [
    'www.webaudiomodules.com',
    'webaudiomodules.com',
];

/** Root of the community catalogue. `plugins.json` sits directly under this. */
export const COMMUNITY_BASE = 'https://www.webaudiomodules.com/community';

/**
 * Where plugin bundles actually live.
 *
 * Note this is *not* the same as `COMMUNITY_BASE`: the index is at
 * `/community/plugins.json` but the assets it lists are served from
 * `/community/plugins/<path>`. Resolving a plugin path against the index's own
 * directory yields a 404.
 */
export const COMMUNITY_ASSET_BASE = `${COMMUNITY_BASE}/plugins`;

/** Where the proxy is mounted in this app. */
export const PLUGIN_PROXY_PREFIX = '/api/wam';

/**
 * True when a URL may be fetched by the proxy.
 *
 * Rejects anything not on the allowlist, any non-HTTPS scheme, and any attempt
 * to smuggle credentials or a different host through the URL.
 */
export function isAllowedPluginUrl(raw: string): boolean {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        return false;
    }

    if (url.protocol !== 'https:') return false;
    if (url.username || url.password) return false;

    return ALLOWED_PLUGIN_HOSTS.includes(url.hostname);
}

/**
 * Map a proxied path back to its upstream URL.
 *
 * `path` is the segment list after the proxy prefix, e.g.
 * `['burns-audio', 'distortion', 'index.js']`.
 *
 * Returns null when the path escapes the catalogue root — `..` traversal would
 * otherwise let a caller reach arbitrary paths on the upstream host.
 */
export function resolveUpstreamUrl(path: string[]): string | null {
    if (path.length === 0) return null;
    if (path.some(segment => segment === '..' || segment === '.' || segment.includes('\\'))) {
        return null;
    }

    const candidate = `${COMMUNITY_ASSET_BASE}/${path.map(encodeURIComponent).join('/')}`;
    if (!isAllowedPluginUrl(candidate)) return null;

    // Re-check after normalisation in case encoding hid a traversal.
    if (!candidate.startsWith(`${COMMUNITY_ASSET_BASE}/`)) return null;

    return candidate;
}

/** The proxied URL a plugin should be loaded from, given its catalogue path. */
export function toProxiedPluginUrl(catalogPath: string): string {
    const clean = catalogPath.replace(/^\/+/, '');
    return `${PLUGIN_PROXY_PREFIX}/${clean}`;
}
