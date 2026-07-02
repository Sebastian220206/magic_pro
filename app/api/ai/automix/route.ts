import { NextRequest, NextResponse } from 'next/server';
import { generateAutoMixSuggestions } from '@/lib/openai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tracks } = body;

    if (!tracks || !Array.isArray(tracks)) {
      return NextResponse.json({ error: 'Tracks array is required' }, { status: 400 });
    }

    const suggestions = await generateAutoMixSuggestions(tracks);
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('AI Auto-mix error:', error);
    return NextResponse.json({ error: 'Failed to generate mix suggestions' }, { status: 500 });
  }
}