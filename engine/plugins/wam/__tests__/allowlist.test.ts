/**
 * Security tests for the plugin proxy allowlist.
 *
 * Anything this permits is fetched by our server and then served from our own
 * origin, where it executes with full page privilege. A hole here is both an
 * SSRF and an arbitrary-code-execution vector, so these cases are deliberately
 * adversarial.
 */

import {
    COMMUNITY_ASSET_BASE,
    isAllowedPluginUrl,
    resolveUpstreamUrl,
    toProxiedPluginUrl,
} from '@/engine/plugins/wam/allowlist';

describe('isAllowedPluginUrl', () => {
    test('accepts the community host over https', () => {
        expect(isAllowedPluginUrl('https://www.webaudiomodules.com/community/a/index.js')).toBe(true);
    });

    test('rejects an unknown host', () => {
        expect(isAllowedPluginUrl('https://evil.example.com/plugin.js')).toBe(false);
    });

    test('rejects plain http', () => {
        expect(isAllowedPluginUrl('http://www.webaudiomodules.com/community/a.js')).toBe(false);
    });

    test('rejects non-web schemes', () => {
        expect(isAllowedPluginUrl('file:///etc/passwd')).toBe(false);
        expect(isAllowedPluginUrl('data:text/javascript,alert(1)')).toBe(false);
    });

    test('rejects embedded credentials', () => {
        // `user@allowed` style URLs are a classic host-confusion trick.
        expect(isAllowedPluginUrl('https://user:pw@www.webaudiomodules.com/a.js')).toBe(false);
    });

    test('rejects a lookalike host', () => {
        expect(isAllowedPluginUrl('https://www.webaudiomodules.com.evil.net/a.js')).toBe(false);
        expect(isAllowedPluginUrl('https://notwebaudiomodules.com/a.js')).toBe(false);
    });

    test('rejects malformed input', () => {
        expect(isAllowedPluginUrl('not a url')).toBe(false);
        expect(isAllowedPluginUrl('')).toBe(false);
    });
});

describe('resolveUpstreamUrl', () => {
    test('maps a plugin path onto the catalogue root', () => {
        expect(resolveUpstreamUrl(['burns-audio', 'distortion', 'index.js']))
            .toBe(`${COMMUNITY_ASSET_BASE}/burns-audio/distortion/index.js`);
    });

    test('rejects an empty path', () => {
        expect(resolveUpstreamUrl([])).toBeNull();
    });

    test('rejects parent traversal', () => {
        expect(resolveUpstreamUrl(['..', 'secret.json'])).toBeNull();
        expect(resolveUpstreamUrl(['a', '..', '..', 'etc'])).toBeNull();
    });

    test('rejects current-directory segments', () => {
        expect(resolveUpstreamUrl(['.', 'index.js'])).toBeNull();
    });

    test('rejects backslash smuggling', () => {
        expect(resolveUpstreamUrl(['a\\..\\b', 'index.js'])).toBeNull();
    });

    test('encodes segments so a slash cannot escape the root', () => {
        const url = resolveUpstreamUrl(['a/../../b', 'index.js']);
        // Either rejected, or encoded such that it stays under the base.
        if (url !== null) expect(url.startsWith(`${COMMUNITY_ASSET_BASE}/`)).toBe(true);
    });

    test('never leaves the catalogue root', () => {
        const paths = [
            ['plugin', 'index.js'],
            ['a', 'b', 'c', 'd.wasm'],
            ['weird name', 'gui.js'],
        ];
        for (const p of paths) {
            const url = resolveUpstreamUrl(p);
            expect(url).not.toBeNull();
            expect(url!.startsWith(`${COMMUNITY_ASSET_BASE}/`)).toBe(true);
        }
    });
});

describe('toProxiedPluginUrl', () => {
    test('mirrors the catalogue path under the proxy prefix', () => {
        expect(toProxiedPluginUrl('burns-audio/distortion/index.js'))
            .toBe('/api/wam/burns-audio/distortion/index.js');
    });

    test('tolerates a leading slash', () => {
        expect(toProxiedPluginUrl('/burns-audio/x/index.js'))
            .toBe('/api/wam/burns-audio/x/index.js');
    });

    test('keeps relative sibling imports resolvable', () => {
        // A plugin's index.js importing './gui.js' must land back on the proxy
        // in the same directory — that only works if paths are mirrored.
        const entry = toProxiedPluginUrl('vendor/plug/index.js');
        const sibling = new URL('./gui.js', `https://host${entry}`).pathname;
        expect(sibling).toBe('/api/wam/vendor/plug/gui.js');
    });
});
