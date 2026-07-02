import { NextRequest, NextResponse } from 'next/server';
import { generateMelody } from '@/lib/openai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, scale, genre, bars, tempo } = body;

    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 });
    }

    const melody = await generateMelody(
      key,
      scale || 'major',
      genre || 'pop',
      bars || 4,
      tempo || 120
    );

    return NextResponse.json(melody);
  } catch (error) {
    console.error('AI Melody error:', error);
    return NextResponse.json({ error: 'Failed to generate melody' }, { status: 500 });
  }
}