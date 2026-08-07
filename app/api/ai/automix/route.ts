import { NextRequest, NextResponse } from 'next/server';
import { generateAutoMixSuggestions } from '@/lib/openai';
import { badRequest, requireUserId, withApiHandler } from '@/lib/apiAuth';
import { AI_RATE_LIMIT, enforceSharedRateLimit } from '@/lib/rateLimit';

export const POST = withApiHandler('ai.automix', async (request: NextRequest) => {
  const userId = await requireUserId();
  await enforceSharedRateLimit(`ai:${userId}`, AI_RATE_LIMIT);

  const body = await request.json();
  const { tracks } = body;

  if (!Array.isArray(tracks)) throw badRequest('Tracks array is required');
  if (tracks.length === 0) throw badRequest('At least one track is required');

  // Cap the payload: the track list is forwarded into a model prompt, so an
  // unbounded array is both a cost and a latency problem.
  const suggestions = await generateAutoMixSuggestions(tracks.slice(0, 64));
  return NextResponse.json({ suggestions });
});
