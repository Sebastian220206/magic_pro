import { NextRequest, NextResponse } from 'next/server';
import { generateMelody } from '@/lib/openai';
import { badRequest, requireUserId, withApiHandler } from '@/lib/apiAuth';
import { AI_RATE_LIMIT, enforceSharedRateLimit } from '@/lib/rateLimit';

export const POST = withApiHandler('ai.melody', async (request: NextRequest) => {
  const userId = await requireUserId();
  await enforceSharedRateLimit(`ai:${userId}`, AI_RATE_LIMIT);

  const body = await request.json();
  const { key, scale, genre, bars, tempo } = body;

  if (!key) throw badRequest('Key is required');

  const melody = await generateMelody(
    key,
    scale || 'major',
    genre || 'pop',
    Math.min(Math.max(Number(bars) || 4, 1), 32),
    Math.min(Math.max(Number(tempo) || 120, 20), 999),
  );

  return NextResponse.json(melody);
});
