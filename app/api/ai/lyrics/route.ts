import { NextRequest, NextResponse } from 'next/server';
import { generateLyrics, suggestLyricLine } from '@/lib/openai';
import { badRequest, requireUserId, withApiHandler } from '@/lib/apiAuth';
import { AI_RATE_LIMIT, enforceSharedRateLimit } from '@/lib/rateLimit';

export const POST = withApiHandler('ai.lyrics', async (request: NextRequest) => {
  const userId = await requireUserId();
  await enforceSharedRateLimit(`ai:${userId}`, AI_RATE_LIMIT);

  const body = await request.json();
  const { action, topic, genre, structure, mood, context, rhymeScheme } = body;

  if (action === 'generate') {
    if (!topic) throw badRequest('Topic is required');
    const lyrics = await generateLyrics(
      String(topic).slice(0, 500),
      genre || 'pop',
      structure || 'verse-chorus-verse-chorus-bridge-chorus',
      mood || 'emotional',
    );
    return NextResponse.json({ lyrics });
  }

  if (action === 'suggest') {
    if (!context) throw badRequest('Context is required');
    const suggestions = await suggestLyricLine(
      String(context).slice(0, 2000),
      genre || 'pop',
      rhymeScheme,
    );
    return NextResponse.json({ suggestions });
  }

  throw badRequest('Invalid action');
});
