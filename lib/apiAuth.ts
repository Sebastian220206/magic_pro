/**
 * apiAuth.ts
 * Shared authentication, authorization and error handling for API routes.
 *
 * Every route that touches user-owned data must go through `requireUserId` (or
 * `requireProjectOwner`) rather than reading the session inline. Routes used to
 * fall back to a hard-coded `'user-1'` identity when no session was present,
 * which made every project readable and writable by anonymous callers.
 */

import { NextResponse } from 'next/server';
import { getSession } from './auth';
import { prisma } from './prisma';
import { reportError } from './observability';

/** An error carrying the HTTP status that should be returned to the client. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const unauthorized = () => new ApiError(401, 'Unauthorized');
export const forbidden = () => new ApiError(403, 'Forbidden');
export const notFound = (what = 'Resource') => new ApiError(404, `${what} not found`);
export const badRequest = (message: string) => new ApiError(400, message);

/**
 * Resolve the signed-in user's id, or throw a 401.
 */
export async function requireUserId(): Promise<string> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) throw unauthorized();
  return userId;
}

/**
 * Resolve the signed-in user's id and assert the `admin` role, or throw.
 */
export async function requireAdminId(): Promise<string> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) throw unauthorized();
  if (session?.user?.role !== 'admin') throw forbidden();
  return userId;
}

/**
 * Assert that the signed-in user owns `projectId`.
 *
 * Returns the caller's user id so routes can use it without re-reading the
 * session. Throws 401 when signed out, 404 when the project does not exist and
 * 403 when it belongs to somebody else.
 */
export async function requireProjectOwner(projectId: string): Promise<string> {
  const userId = await requireUserId();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });

  if (!project) throw notFound('Project');
  if (project.userId !== userId) throw forbidden();

  return userId;
}

/**
 * Convert a thrown error into a client-safe JSON response.
 *
 * `ApiError`s carry a message that is safe to surface, and are expected — a 401
 * or a 404 is not an incident, so they are not reported. Anything else is a bug:
 * it is reported with full detail server-side and answered with a generic 500,
 * because stack traces and Prisma internals must never reach the client.
 *
 * The 500 carries a `requestId`, echoed in `X-Request-Id`. That is what lets a
 * user's "it failed" be matched to the log line that explains why.
 */
export function toErrorResponse(
  error: unknown,
  context: string,
  request?: Request,
): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const requestId = reportError(error, {
    context,
    method: request?.method,
    // Path only — a query string can carry identifiers or tokens.
    path: request ? new URL(request.url).pathname : undefined,
  });

  return NextResponse.json(
    { error: 'Internal Server Error', requestId },
    { status: 500, headers: { 'X-Request-Id': requestId } },
  );
}

/**
 * Wrap a route handler so thrown `ApiError`s become responses and unexpected
 * errors are reported rather than leaked.
 *
 * ```ts
 * export const POST = withApiHandler('project.save', async (req) => { ... });
 * ```
 */
export function withApiHandler<Args extends unknown[]>(
  context: string,
  handler: (...args: Args) => Promise<NextResponse | Response>,
): (...args: Args) => Promise<NextResponse | Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      // Route handlers take the request first, when they take one at all.
      const request = args[0] instanceof Request ? args[0] : undefined;
      return toErrorResponse(error, context, request);
    }
  };
}
