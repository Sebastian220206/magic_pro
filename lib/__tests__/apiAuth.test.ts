/**
 * Regression tests for the API authorization helpers.
 *
 * These cover the bugs that made every project readable and writable by any
 * caller: routes previously fell back to a hard-coded `'user-1'` identity when
 * no session existed, and the project save path upserted by id without ever
 * checking ownership.
 */

const mockGetSession = jest.fn();
const mockFindUnique = jest.fn();

jest.mock('@/lib/auth', () => ({
  getSession: () => mockGetSession(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

import {
  ApiError,
  requireAdminId,
  requireProjectOwner,
  requireUserId,
  toErrorResponse,
} from '@/lib/apiAuth';

const signedInAs = (id: string, role = 'user') =>
  mockGetSession.mockResolvedValue({ user: { id, role } });

const signedOut = () => mockGetSession.mockResolvedValue(null);

async function statusOf(fn: () => Promise<unknown>): Promise<number> {
  try {
    await fn();
    return 200;
  } catch (error) {
    if (error instanceof ApiError) return error.status;
    throw error;
  }
}

describe('requireUserId', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns the session user id', async () => {
    signedInAs('user-42');
    await expect(requireUserId()).resolves.toBe('user-42');
  });

  test('rejects anonymous callers with 401 instead of falling back to user-1', async () => {
    signedOut();
    await expect(statusOf(requireUserId)).resolves.toBe(401);
  });
});

describe('requireAdminId', () => {
  beforeEach(() => jest.clearAllMocks());

  test('allows admins', async () => {
    signedInAs('admin-1', 'admin');
    await expect(requireAdminId()).resolves.toBe('admin-1');
  });

  test('rejects non-admins with 403', async () => {
    signedInAs('user-1', 'user');
    await expect(statusOf(requireAdminId)).resolves.toBe(403);
  });

  test('rejects anonymous callers with 401', async () => {
    signedOut();
    await expect(statusOf(requireAdminId)).resolves.toBe(401);
  });
});

describe('requireProjectOwner', () => {
  beforeEach(() => jest.clearAllMocks());

  test('allows the owner', async () => {
    signedInAs('owner');
    mockFindUnique.mockResolvedValue({ userId: 'owner' });

    await expect(requireProjectOwner('proj-1')).resolves.toBe('owner');
  });

  test('rejects a different user with 403', async () => {
    signedInAs('attacker');
    mockFindUnique.mockResolvedValue({ userId: 'victim' });

    await expect(statusOf(() => requireProjectOwner('proj-1'))).resolves.toBe(403);
  });

  test('reports a missing project as 404', async () => {
    signedInAs('owner');
    mockFindUnique.mockResolvedValue(null);

    await expect(statusOf(() => requireProjectOwner('nope'))).resolves.toBe(404);
  });

  test('rejects anonymous callers before touching the database', async () => {
    signedOut();

    await expect(statusOf(() => requireProjectOwner('proj-1'))).resolves.toBe(401);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});

describe('toErrorResponse', () => {
  test('surfaces ApiError status and message', async () => {
    const response = toErrorResponse(new ApiError(403, 'Forbidden'), 'test');
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  test('does not leak internals from unexpected errors', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = toErrorResponse(
      new Error('Prisma: connection string postgres://user:secret@host/db'),
      'test',
    );

    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBe('Internal Server Error');
    // The secret must appear nowhere in the response — not in the message, and
    // not smuggled into any field added later.
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(JSON.stringify(body)).not.toContain('postgres://');
    expect(Object.keys(body).sort()).toEqual(['error', 'requestId']);

    spy.mockRestore();
  });

  test('gives a 500 a request id that matches its header', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = toErrorResponse(new Error('boom'), 'test');
    const body = await response.json();

    // The id is what connects a user saying "it failed" to the log line that
    // says why, so it has to reach the client both ways.
    expect(typeof body.requestId).toBe('string');
    expect(body.requestId).not.toHaveLength(0);
    expect(response.headers.get('X-Request-Id')).toBe(body.requestId);

    spy.mockRestore();
  });

  test('does not report an ApiError as an incident', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // A 401 or 404 is the system working. Reporting them would bury real bugs.
    toErrorResponse(new ApiError(404, 'Project not found'), 'test');

    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });
});
