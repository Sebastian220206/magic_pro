/**
 * The shared rate limiter.
 *
 * This is the one guarding endpoints that bill per call, so the properties that
 * matter are: it counts in one place for every instance, the count-and-check is
 * atomic, and it degrades rather than 500s when the table is not there yet.
 */

jest.mock('@/lib/prisma', () => ({
    prisma: {
        $queryRaw: jest.fn(),
        rateLimitWindow: { deleteMany: jest.fn() },
    },
}));

import { prisma } from '@/lib/prisma';
import {
    __resetRateLimits,
    consumeShared,
    enforceSharedRateLimit,
    sweepSharedWindows,
    AI_RATE_LIMIT,
    UPLOAD_RATE_LIMIT,
} from '@/lib/rateLimit';
import { ApiError } from '@/lib/apiAuth';

const queryRaw = prisma.$queryRaw as unknown as jest.Mock;
const deleteMany = prisma.rateLimitWindow.deleteMany as unknown as jest.Mock;

/** The database answering with a given count for the current window. */
function windowWith(count: number, resetInMs = 60_000) {
    queryRaw.mockResolvedValueOnce([
        { count, resetAt: new Date(Date.now() + resetInMs) },
    ]);
}

const OPTIONS = { limit: 3, windowMs: 60_000 };

beforeEach(() => {
    jest.clearAllMocks();
    __resetRateLimits();
});

describe('consumeShared', () => {
    it('allows a request while under the limit', async () => {
        windowWith(1);

        const result = await consumeShared('ai:user-1', OPTIONS);

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2);
    });

    it('allows the request that exactly reaches the limit', async () => {
        windowWith(3);

        const result = await consumeShared('ai:user-1', OPTIONS);

        // The limit is inclusive: the 3rd of 3 is still allowed.
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(0);
    });

    it('refuses once the count passes the limit', async () => {
        windowWith(4);

        const result = await consumeShared('ai:user-1', OPTIONS);

        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
    });

    it('counts and checks in a single statement', async () => {
        windowWith(1);

        await consumeShared('ai:user-1', OPTIONS);

        // Two concurrent requests that each read 19 and then wrote 20 would
        // both be allowed. The increment has to happen inside the database.
        expect(queryRaw).toHaveBeenCalledTimes(1);
        const sql = queryRaw.mock.calls[0][0].join('');
        expect(sql).toContain('ON CONFLICT');
        expect(sql).toContain('INSERT INTO');
    });

    it('lets the database decide whether the window expired', async () => {
        windowWith(1);

        await consumeShared('ai:user-1', OPTIONS);

        // Comparing against NOW() rather than a value from the app means
        // instances with skewed clocks still agree on the window.
        expect(queryRaw.mock.calls[0][0].join('')).toContain('NOW()');
    });

    it('reports the reset time the database returned, not a locally computed one', async () => {
        const resetAt = new Date(Date.now() + 12_345);
        queryRaw.mockResolvedValueOnce([{ count: 1, resetAt }]);

        const result = await consumeShared('ai:user-1', OPTIONS);

        expect(result.resetAt).toBe(resetAt.getTime());
    });

    it('copes with a driver returning count as a string', async () => {
        // Some Postgres drivers hand back bigint-ish columns as strings; a
        // string would make every comparison against the limit nonsense.
        queryRaw.mockResolvedValueOnce([
            { count: '4' as unknown as number, resetAt: new Date(Date.now() + 1000) },
        ]);

        expect((await consumeShared('k', OPTIONS)).allowed).toBe(false);
    });

    it('separates keys', async () => {
        windowWith(4);
        expect((await consumeShared('ai:user-a', OPTIONS)).allowed).toBe(false);

        windowWith(1);
        expect((await consumeShared('ai:user-b', OPTIONS)).allowed).toBe(true);
    });
});

describe('when the shared window is unavailable', () => {
    it('falls back to in-process counting rather than failing the request', async () => {
        // The realistic trigger: code deployed before its migration ran.
        queryRaw.mockRejectedValue(new Error('relation "RateLimitWindow" does not exist'));
        const spy = jest.spyOn(console, 'error').mockImplementation(() => { });

        const first = await consumeShared('ai:user-1', OPTIONS);

        expect(first.allowed).toBe(true);
        spy.mockRestore();
    });

    it('still enforces a limit while degraded', async () => {
        queryRaw.mockRejectedValue(new Error('down'));
        const spy = jest.spyOn(console, 'error').mockImplementation(() => { });

        for (let i = 0; i < 3; i++) {
            expect((await consumeShared('k', OPTIONS)).allowed).toBe(true);
        }
        expect((await consumeShared('k', OPTIONS)).allowed).toBe(false);

        spy.mockRestore();
    });

    it('warns once, not on every request', async () => {
        queryRaw.mockRejectedValue(new Error('down'));
        const spy = jest.spyOn(console, 'error').mockImplementation(() => { });

        for (let i = 0; i < 5; i++) await consumeShared(`k${i}`, OPTIONS);

        // A database outage must not also become a log flood.
        expect(spy).toHaveBeenCalledTimes(1);
        spy.mockRestore();
    });

    it('falls back when the statement returns no row', async () => {
        queryRaw.mockResolvedValueOnce([]);

        expect((await consumeShared('k', OPTIONS)).allowed).toBe(true);
    });
});

describe('enforceSharedRateLimit', () => {
    it('passes silently while under the limit', async () => {
        windowWith(1);

        await expect(enforceSharedRateLimit('k', OPTIONS)).resolves.toBeUndefined();
    });

    it('throws a 429 carrying a retry hint', async () => {
        windowWith(9, 30_000);

        try {
            await enforceSharedRateLimit('k', OPTIONS);
            throw new Error('expected enforceSharedRateLimit to throw');
        } catch (error) {
            expect(error).toBeInstanceOf(ApiError);
            expect((error as ApiError).status).toBe(429);
            // Without a wait hint a client just retries immediately.
            expect((error as ApiError).message).toMatch(/Try again in \d+s/);
        }
    });
});

describe('sweepSharedWindows', () => {
    it('deletes only windows that have already expired', async () => {
        deleteMany.mockResolvedValueOnce({ count: 7 });

        expect(await sweepSharedWindows()).toBe(7);

        const where = deleteMany.mock.calls[0][0].where;
        expect(where.resetAt.lte).toBeInstanceOf(Date);
    });
});

describe('budgets', () => {
    it('limits AI endpoints per minute', () => {
        expect(AI_RATE_LIMIT.windowMs).toBe(60_000);
        expect(AI_RATE_LIMIT.limit).toBeGreaterThan(0);
    });

    it('limits uploads per minute', () => {
        expect(UPLOAD_RATE_LIMIT.windowMs).toBe(60_000);
        expect(UPLOAD_RATE_LIMIT.limit).toBeGreaterThan(0);
    });
});
