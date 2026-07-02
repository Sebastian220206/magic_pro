import { NextRequest, NextResponse } from 'next/server';
import { generateChordProgression, suggestNextChord } from '@/lib/openai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, key, genre, mood, length, progression } = body;

    if (action === 'generate') {
      const chords = await generateChordProgression(
        key || 'C major',
        genre || 'pop',
        mood || 'upbeat',
        length || 4
      );
      return NextResponse.json({ chords });
    }

    if (action === 'suggest') {
      const suggestions = await suggestNextChord(
        progression || [],
        key || 'C major',
        genre || 'pop'
      );
      return NextResponse.json({ suggestions });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('AI Chords error:', error);
    return NextResponse.json({ error: 'Failed to generate chords' }, { status: 500 });
  }
}