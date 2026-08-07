import {
  AI_RATE_LIMIT,
  __resetRateLimits,
  consume,
  enforceRateLimit,
} from '@/lib/rateLimit';
import { ApiError } from '@/lib/apiAuth';

describe('rateLimit', () => {
  beforeEach(() => {
    __resetRateLimits();
    jest.useRealTimers();
  });

  test('allows requests up to the limit', () => {
    for (let i = 0; i < 3; i++) {
      expect(consume('k', { limit: 3, windowMs: 1000 }).allowed).toBe(true);
    }
  });

  test('blocks the request that exceeds the limit', () => {
    const options = { limit: 2, windowMs: 1000 };
    consume('k', options);
    consume('k', options);

    expect(consume('k', options).allowed).toBe(false);
  });

  test('reports remaining budget', () => {
    const options = { limit: 3, windowMs: 1000 };
    expect(consume('k', options).remaining).toBe(2);
    expect(consume('k', options).remaining).toBe(1);
    expect(consume('k', options).remaining).toBe(0);
  });

  test('tracks keys independently', () => {
    const options = { limit: 1, windowMs: 1000 };
    expect(consume('user-a', options).allowed).toBe(true);
    expect(consume('user-b', options).allowed).toBe(true);
    expect(consume('user-a', options).allowed).toBe(false);
  });

  test('resets once the window elapses', () => {
    jest.useFakeTimers();
    const options = { limit: 1, windowMs: 1000 };

    expect(consume('k', options).allowed).toBe(true);
    expect(consume('k', options).allowed).toBe(false);

    jest.advanceTimersByTime(1001);

    expect(consume('k', options).allowed).toBe(true);
  });

  test('enforceRateLimit throws a 429 ApiError when exhausted', () => {
    const options = { limit: 1, windowMs: 60_000 };
    enforceRateLimit('k', options);

    try {
      enforceRateLimit('k', options);
      fail('expected enforceRateLimit to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(429);
    }
  });

  test('AI endpoints are budgeted per minute', () => {
    expect(AI_RATE_LIMIT.windowMs).toBe(60_000);
    expect(AI_RATE_LIMIT.limit).toBeGreaterThan(0);
  });
});
