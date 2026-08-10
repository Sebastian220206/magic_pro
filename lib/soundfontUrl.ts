/**
 * How a bundled SoundFont's filename becomes a URL.
 *
 * Extracted so the client-side instrument picker and the server-side
 * `localSoundfonts` module cannot disagree. They must not: a project saved
 * with a URL built one way and resolved the other loses its instruments, and
 * does so silently — the track simply plays nothing.
 *
 * `lib/localSoundfonts.ts` imports `fs` and `path`, so a client component
 * cannot reach it. This file has no imports and is safe on both sides.
 */
export function soundfontFileUrl(fileName: string): string {
    return `/soundfonts/${encodeURIComponent(fileName)}`;
}
