import { NextRequest, NextResponse } from 'next/server'
import { requireUserId, withApiHandler } from '@/lib/apiAuth'

/**
 * Server-side stem separation.
 *
 * Not implemented — it needs a hosted source-separation model (e.g. Demucs)
 * plus a job queue, neither of which exists yet. The endpoint answers 501
 * without reading the request body so callers do not upload a large file only
 * to have it discarded. `lib/stemSeparation.ts` provides the client-side
 * frequency-band splitter used in the meantime.
 */
export const POST = withApiHandler('ai.stems', async (_request: NextRequest) => {
  await requireUserId();

  return NextResponse.json(
    {
      error: 'Server-side stem separation is not available yet.',
      hint: 'Use the client-side frequency-band splitter (lib/stemSeparation.ts).',
    },
    { status: 501 },
  );
});
