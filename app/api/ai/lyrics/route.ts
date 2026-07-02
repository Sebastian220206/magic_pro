import { NextRequest, NextResponse } from 'next/server';
import { generateLyrics, suggestLyricLine } from '@/lib/openai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, topic, genre, structure, mood, context, rhymeScheme } = body;

    if (action === 'generate') {
      if (!topic) {
        return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
      }
      const lyrics = await generateLyrics(
        topic,
        genre || 'pop',
        structure || 'verse-chorus-verse-chorus-bridge-chorus',
        mood || 'emotional'
      );
      return NextResponse.json({ lyrics });
    }

    if (action === 'suggest') {
      if (!context) {
        return NextResponse.json({ error: 'Context is required' }, { status: 400 });
      }
      const suggestions = await suggestLyricLine(
        context,
        genre || 'pop',
        rhymeScheme
      );
      return NextResponse.json({ suggestions });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('AI Lyrics error:', error);
    return NextResponse.json({ error: 'Failed to generate lyrics' }, { status: 500 });
  }
}