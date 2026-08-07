/**
 * mediaConfig.ts
 * URLs for the marketing video assets.
 *
 * These live in the environment rather than in code so the footage can be
 * replaced without a deploy. They are `NEXT_PUBLIC_` because they are public
 * asset URLs — nothing here is a secret.
 *
 * Values are trimmed. Pasting into a hosting dashboard very easily carries a
 * trailing newline, and that has already cost this project one outage: a
 * newline on `GOOGLE_CLIENT_ID` made Google answer `invalid_client`, which
 * reads exactly like a deleted OAuth client. A newline on a URL would be just
 * as invisible and would simply produce a 404.
 *
 * Note these must be read as complete literals rather than looked up
 * dynamically — Next.js inlines `process.env.NEXT_PUBLIC_*` at build time by
 * static analysis, so `process.env[name]` would be `undefined` in the browser.
 */

/** Trim, and treat a whitespace-only value as absent. */
function clean(raw: string | undefined): string | undefined {
    if (!raw) return undefined;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

export interface MediaConfig {
    /** Looping background for the welcome hero. */
    heroLoopUrl?: string;
    /** First frame, shown while the loop buffers. */
    heroPosterUrl?: string;
    /** Looping background for the dashboard strip. */
    dashboardLoopUrl?: string;
}

export const mediaConfig: MediaConfig = {
    heroLoopUrl: clean(process.env.NEXT_PUBLIC_HERO_LOOP_URL),
    heroPosterUrl: clean(process.env.NEXT_PUBLIC_HERO_POSTER_URL),
    dashboardLoopUrl: clean(process.env.NEXT_PUBLIC_DASHBOARD_LOOP_URL),
};
