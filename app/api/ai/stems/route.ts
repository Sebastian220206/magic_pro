import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 })
    }

    const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/flac', 'audio/aiff', 'audio/mp4', 'audio/x-m4a']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported audio format' }, { status: 400 })
    }

    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 100MB)' }, { status: 400 })
    }

    return NextResponse.json({
      stems: ['vocals', 'drums', 'bass', 'other'],
      message: 'Stem separation is not yet available on the server. Use the client-side stem splitter for frequency-based separation.',
    })
  } catch (error) {
    console.error('AI Stems error:', error)
    return NextResponse.json({ error: 'Failed to separate stems' }, { status: 500 })
  }
}
