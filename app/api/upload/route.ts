import { NextRequest, NextResponse } from 'next/server';
import { badRequest, requireUserId, withApiHandler, ApiError } from '@/lib/apiAuth';
import { UPLOAD_RATE_LIMIT, enforceSharedRateLimit } from '@/lib/rateLimit';

/**
 * Upload an audio asset to object storage.
 *
 * Rate limited because it is the most expensive unauthenticated-cost surface in
 * the app: a signed-in account could otherwise push 100 MB per request into
 * storage indefinitely, and storage is billed by the gigabyte-month with no
 * ceiling. The limit is shared across instances — a per-instance one would
 * scale up with concurrency, which is precisely when abuse happens.
 */

/** Anything larger is rejected before it is read into memory. */
const MAX_BYTES = 100 * 1024 * 1024;

/**
 * `file.type` is supplied by the client and is not proof of anything, so it is
 * treated as a cheap first filter rather than a guarantee. The bucket serves
 * files with the stored content type, which is why `text/html` must never get
 * through: that would turn storage into a same-origin XSS host.
 */
const ALLOWED_TYPES = new Set([
  'audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/ogg', 'audio/flac',
  'audio/aiff', 'audio/x-aiff', 'audio/mp4', 'audio/x-m4a',
]);

export const POST = withApiHandler('upload', async (request: NextRequest) => {
  const userId = await requireUserId();
  await enforceSharedRateLimit(`upload:${userId}`, UPLOAD_RATE_LIMIT);

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) throw badRequest('No file provided');
  if (!ALLOWED_TYPES.has(file.type)) {
    throw badRequest(`Unsupported file type: ${file.type}`);
  }
  if (file.size > MAX_BYTES) {
    throw new ApiError(413, 'File too large (max 100MB)');
  }

  // The name is attacker-controlled and becomes part of a storage path, so it
  // is rewritten rather than sanitised — no separators, no traversal, no
  // leading dot.
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '');
  const storagePath = `users/${userId}/${Date.now()}-${safeName || 'audio'}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { storage } = await import('@/lib/storage');
  const publicUrl = await storage.uploadBuffer(
    'audio-assets', storagePath, buffer, file.type);

  return NextResponse.json({
    url: publicUrl,
    path: storagePath,
    name: file.name,
    size: file.size,
    type: file.type,
  });
});

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
