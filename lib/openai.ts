import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateChordProgression(
  key: string,
  genre: string,
  mood: string,
  length: number = 4
): Promise<string[]> {
  const prompt = `Generate a ${length}-bar chord progression in ${key} ${genre} style with a ${mood} mood.
Return only the chord symbols separated by spaces (e.g., "Cmaj7 Am7 Dm7 G7").`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 100,
  });

  const content = response.choices[0].message.content?.trim() || '';
  return content.split(/\s+/).filter(Boolean);
}

export async function suggestNextChord(
  currentProgression: string[],
  key: string,
  genre: string
): Promise<string[]> {
  const prompt = `Given the chord progression: ${currentProgression.join(' ')} in ${key} ${genre},
suggest 4 possible next chords. Return only chord symbols separated by spaces.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 50,
  });

  const content = response.choices[0].message.content?.trim() || '';
  return content.split(/\s+/).filter(Boolean);
}

export async function generateMelody(
  key: string,
  scale: string,
  genre: string,
  bars: number = 4,
  tempo: number = 120
): Promise<{ notes: Array<{ pitch: number; start: number; duration: number; velocity: number }> }> {
  const prompt = `Generate a ${bars}-bar melody in ${key} ${scale} scale, ${genre} style, ${tempo} BPM.
Return JSON: { "notes": [{ "pitch": 60, "start": 0, "duration": 0.5, "velocity": 100 }, ...] }
Pitch: MIDI note number (60 = middle C). Start/duration in beats.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  });

  try {
    return JSON.parse(response.choices[0].message.content || '{"notes":[]}');
  } catch {
    return { notes: [] };
  }
}

export async function generateAutoMixSuggestions(
  tracks: Array<{ name: string; type: string; level: number; freqProfile?: string }>
): Promise<string[]> {
  const trackInfo = tracks.map(t => `${t.name} (${t.type}): level ${t.level}${t.freqProfile ? `, ${t.freqProfile}` : ''}`).join('\n');
  
  const prompt = `Analyze this mix and suggest 5 specific mixing actions:\n${trackInfo}\n\nReturn as numbered list.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 300,
  });

  const content = response.choices[0].message.content?.trim() || '';
  return content.split('\n').filter(l => l.trim().match(/^\d/)).map(l => l.replace(/^\d+\.\s*/, ''));
}

export async function generateLyrics(
  topic: string,
  genre: string,
  structure: string = 'verse-chorus-verse-chorus-bridge-chorus',
  mood: string = 'emotional'
): Promise<string> {
  const prompt = `Write ${genre} lyrics about "${topic}" with ${mood} mood.
Structure: ${structure}.
Return only the lyrics with section labels (Verse 1, Chorus, etc.).`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
    max_tokens: 500,
  });

  return response.choices[0].message.content?.trim() || '';
}

export async function suggestLyricLine(
  context: string,
  genre: string,
  rhymeScheme?: string
): Promise<string[]> {
  const prompt = `Given this lyric context:\n${context}\n\nSuggest 4 next lines for a ${genre} song${rhymeScheme ? ` with ${rhymeScheme} rhyme scheme` : ''}.
Return only the lines, one per line.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
    max_tokens: 100,
  });

  return response.choices[0].message.content?.trim().split('\n').filter(Boolean) || [];
}