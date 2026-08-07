import { NextRequest, NextResponse } from 'next/server';
import { generateChordProgression, suggestNextChord } from '@/lib/openai';
import { badRequest, requireUserId, withApiHandler } from '@/lib/apiAuth';
import { AI_RATE_LIMIT, enforceSharedRateLimit } from '@/lib/rateLimit';

export const POST = withApiHandler('ai.chords', async (request: NextRequest) => {
  const userId = await requireUserId();
  await enforceSharedRateLimit(`ai:${userId}`, AI_RATE_LIMIT);

  const body = await request.json();
  const { action, key, genre, mood, length, progression } = body;

  if (action === 'generate') {
    const bars = Math.min(Math.max(Number(length) || 4, 1), 16);
    const chords = await generateChordProgression(
      key || 'C major',
      genre || 'pop',
      mood || 'upbeat',
      bars,
    );
    return NextResponse.json({ chords });
  }

  if (action === 'suggest') {
    const chords = await suggestNextChord(
      Array.isArray(progression) ? progression.slice(0, 32) : [],
      key || 'C major',
      genre || 'pop',
    );
    return NextResponse.json({ suggestions: chords });
  }

  throw badRequest('Invalid action');
});
