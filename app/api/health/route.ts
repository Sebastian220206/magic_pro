import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { bundledSoundfontCount } from '@/lib/localSoundfonts';

/**
 * Liveness and readiness for load balancers, uptime monitors and the
 * container healthcheck.
 *
 * Deliberately unauthenticated — a probe has no session — so it must not reveal
 * anything an attacker could use. It reports whether dependencies *work*, never
 * where they are or why they failed: no connection strings, no driver messages,
 * no versions.
 *
 * `soundfonts` is here because shipping without a General MIDI bank is this
 * app's one silent failure: the picker comes up empty, every other check passes
 * and nothing is logged. A probe that counts them turns that into something you
 * can alert on.
 */
export const dynamic = 'force-dynamic';

/** How long a dependency gets before it is treated as down. */
const CHECK_TIMEOUT_MS = 3000;

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            work,
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error('timed out')), ms);
            }),
        ]);
    } finally {
        // Without this the pending timer keeps the event loop alive, which on a
        // serverless host delays the function freezing after every probe.
        if (timer) clearTimeout(timer);
    }
}

/** Can we actually reach the database, not merely construct a client? */
async function checkDatabase(): Promise<boolean> {
    try {
        await withTimeout(prisma.$queryRaw`SELECT 1`, CHECK_TIMEOUT_MS);
        return true;
    } catch (error) {
        // Logged server-side only; the response says nothing beyond "down".
        console.error('[health] database check failed:', error);
        return false;
    }
}

export async function GET() {
    const soundfonts = bundledSoundfontCount();
    const database = await checkDatabase();

    // The database is the only hard dependency: without it nobody can sign in
    // or open a project. A missing bank degrades the app but does not stop it,
    // so it is reported without failing the probe — otherwise a deploy that
    // forgot the bank would look identical to a database outage.
    const healthy = database;

    return NextResponse.json(
        {
            status: healthy ? 'ok' : 'degraded',
            checks: {
                database: database ? 'up' : 'down',
                soundfonts: soundfonts > 0 ? 'ok' : 'missing',
            },
            soundfonts,
            uptimeSeconds: Math.round(process.uptime()),
            timestamp: new Date().toISOString(),
        },
        {
            status: healthy ? 200 : 503,
            // A cached health check is worse than none — it reports the state of
            // whichever instance answered first, forever.
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        },
    );
}
