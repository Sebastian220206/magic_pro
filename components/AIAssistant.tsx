'use client';

import { useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { Wand2, Music, Guitar, Mic, Sparkles, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

type AITab = 'chords' | 'melody' | 'automix' | 'lyrics';

interface MelodyNote {
  pitch: number;
  start: number;
  duration: number;
  velocity: number;
}

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AITab>('chords');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  const tracks = useProjectStore(s => s.tracks);
  const clips = useProjectStore(s => s.clips);

  return (
    <div className="flex flex-col bg-[#1a1a1a] border-t border-black/40 select-none">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 px-3 flex items-center justify-between bg-[#252525] cursor-pointer hover:bg-[#2a2a2a] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[11px] font-bold text-gray-300">AI Assistant</span>
        </div>
        {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" /> : <ChevronUp className="w-3.5 h-3.5 text-gray-500" />}
      </div>

      {isOpen && (
        <div className="flex flex-col bg-[#161616]">
          <div className="flex border-b border-black/40">
            {[
              { id: 'chords' as const, label: 'Chords', icon: Guitar },
              { id: 'melody' as const, label: 'Melody', icon: Music },
              { id: 'automix' as const, label: 'Mix', icon: Wand2 },
              { id: 'lyrics' as const, label: 'Lyrics', icon: Mic },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setResult(''); setError(''); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 h-8 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                    activeTab === tab.id
                      ? 'text-purple-300 bg-purple-500/10 border-b-2 border-purple-500'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-3">
            {activeTab === 'chords' && <ChordPanel setLoading={setLoading} setResult={setResult} setError={setError} loading={loading} result={result} error={error} />}
            {activeTab === 'melody' && <MelodyPanel setLoading={setLoading} setResult={setResult} setError={setError} loading={loading} result={result} error={error} />}
            {activeTab === 'automix' && <AutoMixPanel setLoading={setLoading} setResult={setResult} setError={setError} loading={loading} result={result} error={error} tracks={tracks} />}
            {activeTab === 'lyrics' && <LyricsPanel setLoading={setLoading} setResult={setResult} setError={setError} loading={loading} result={result} error={error} />}
          </div>
        </div>
      )}
    </div>
  );
}

function ChordPanel({ setLoading, setResult, setError, loading, result }: {
  setLoading: (v: boolean) => void;
  setResult: (v: string) => void;
  setError: (v: string) => void;
  loading: boolean;
  result: string;
  error: string;
}) {
  const [key, setKey] = useState('C major');
  const [genre, setGenre] = useState('pop');
  const [mood, setMood] = useState('upbeat');

  const generate = async () => {
    setLoading(true); setResult(''); setError('');
    try {
      const res = await fetch('/api/ai/chords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', key, genre, mood }),
      });
      if (!res.ok) throw new Error('Failed to generate');
      const data = await res.json();
      setResult(data.chords?.join('  ') || 'No chords generated');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AIPanel
      title="Chord Progression"
      description="Generate a chord progression in your chosen key, genre, and mood."
      fields={[
        { label: 'Key', value: key, onChange: setKey, options: ['C major', 'G major', 'D major', 'A major', 'E major', 'A minor', 'E minor', 'D minor'] },
        { label: 'Genre', value: genre, onChange: setGenre, options: ['pop', 'rock', 'jazz', 'electronic', 'hip hop', 'lo-fi', 'classical'] },
        { label: 'Mood', value: mood, onChange: setMood, options: ['upbeat', 'melancholic', 'dark', 'dreamy', 'energetic', 'chill'] },
      ]}
      onGenerate={generate}
      loading={loading}
      result={result}
    />
  );
}

function MelodyPanel({ setLoading, setResult, setError, loading, result }: {
  setLoading: (v: boolean) => void;
  setResult: (v: string) => void;
  setError: (v: string) => void;
  loading: boolean;
  result: string;
  error: string;
}) {
  const [key, setKey] = useState('C');
  const [scale, setScale] = useState('major');
  const [genre, setGenre] = useState('pop');
  const [bars, setBars] = useState(4);

  const generate = async () => {
    setLoading(true); setResult(''); setError('');
    try {
      const res = await fetch('/api/ai/melody', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, scale, genre, bars }),
      });
      if (!res.ok) throw new Error('Failed to generate');
      const data = await res.json();
      const noteCount = data.notes?.length || 0;
      setResult(`Generated ${noteCount} notes in ${key} ${scale} (${genre}, ${bars} bars)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AIPanel
      title="Melody Generation"
      description="Generate a melody in your chosen key, scale, and genre."
      fields={[
        { label: 'Key', value: key, onChange: setKey, options: ['C', 'G', 'D', 'A', 'E', 'F', 'Bb'] },
        { label: 'Scale', value: scale, onChange: setScale, options: ['major', 'minor', 'pentatonic major', 'pentatonic minor', 'blues', 'dorian', 'phrygian'] },
        { label: 'Genre', value: genre, onChange: setGenre, options: ['pop', 'rock', 'electronic', 'jazz', 'lo-fi', 'cinematic'] },
        { label: 'Bars', value: String(bars), onChange: v => setBars(Number(v)), options: ['2', '4', '8', '16'] },
      ]}
      onGenerate={generate}
      loading={loading}
      result={result}
    />
  );
}

function AutoMixPanel({ setLoading, setResult, setError, loading, result, tracks }: {
  setLoading: (v: boolean) => void;
  setResult: (v: string) => void;
  setError: (v: string) => void;
  loading: boolean;
  result: string;
  error: string;
  tracks: any[];
}) {
  const generate = async () => {
    setLoading(true); setResult(''); setError('');
    try {
      const trackData = tracks.map(t => ({
        name: t.name,
        type: t.type,
        level: t.volume || 0.8,
      }));
      const res = await fetch('/api/ai/automix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: trackData }),
      });
      if (!res.ok) throw new Error('Failed to generate');
      const data = await res.json();
      setResult(data.suggestions?.join('\n') || 'No suggestions');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AIPanel
      title="Auto-Mix Suggestions"
      description="Analyze your mix and get actionable suggestions for gain staging, EQ, and levels."
      fields={[]}
      onGenerate={generate}
      loading={loading}
      result={result}
      tracksPresent={tracks.length}
    />
  );
}

function LyricsPanel({ setLoading, setResult, setError, loading, result }: {
  setLoading: (v: boolean) => void;
  setResult: (v: string) => void;
  setError: (v: string) => void;
  loading: boolean;
  result: string;
  error: string;
}) {
  const [topic, setTopic] = useState('');
  const [genre, setGenre] = useState('pop');
  const [mood, setMood] = useState('emotional');

  const generate = async () => {
    if (!topic.trim()) { setError('Enter a topic'); return; }
    setLoading(true); setResult(''); setError('');
    try {
      const res = await fetch('/api/ai/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', topic, genre, mood }),
      });
      if (!res.ok) throw new Error('Failed to generate');
      const data = await res.json();
      setResult(data.lyrics || 'No lyrics generated');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AIPanel
      title="Lyric Assistant"
      description="Generate lyrics based on topic, genre, and mood."
      fields={[
        { label: 'Topic', value: topic, onChange: setTopic, input: true },
        { label: 'Genre', value: genre, onChange: setGenre, options: ['pop', 'rock', 'hip hop', 'country', 'R&B', 'electronic', 'folk'] },
        { label: 'Mood', value: mood, onChange: setMood, options: ['emotional', 'upbeat', 'dark', 'romantic', 'angry', 'hopeful'] },
      ]}
      onGenerate={generate}
      loading={loading}
      result={result}
    />
  );
}

function AIPanel({ title, description, fields, onGenerate, loading, result, tracksPresent }: {
  title: string;
  description: string;
  fields: Array<{ label: string; value: string; onChange: (v: string) => void; options?: string[]; input?: boolean }>;
  onGenerate: () => void;
  loading: boolean;
  result: string;
  tracksPresent?: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[10px] text-gray-500 leading-relaxed">{description}</div>

      <div className="flex flex-col gap-2">
        {fields.map(field => (
          <div key={field.label} className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-gray-400 w-14 shrink-0">{field.label}</span>
            {field.input ? (
              <input
                type="text"
                value={field.value}
                onChange={e => field.onChange(e.target.value)}
                className="flex-1 h-7 px-2 bg-[#0d0d0d] border border-black/60 rounded text-[11px] text-gray-200 focus:outline-none focus:border-purple-600"
                placeholder={`Enter ${field.label.toLowerCase()}...`}
              />
            ) : (
              <select
                value={field.value}
                onChange={e => field.onChange(e.target.value)}
                className="flex-1 h-7 px-2 bg-[#0d0d0d] border border-black/60 rounded text-[11px] text-gray-200 focus:outline-none focus:border-purple-600 cursor-pointer appearance-none"
              >
                {field.options?.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>

      {tracksPresent !== undefined && tracksPresent === 0 && (
        <div className="text-[10px] text-yellow-500/80">Add tracks to the project before auto-mix analysis.</div>
      )}

      <button
        onClick={onGenerate}
        disabled={loading || (tracksPresent !== undefined && tracksPresent === 0)}
        className="flex items-center justify-center gap-1.5 h-8 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 rounded text-[11px] font-bold text-white transition-colors"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
        {loading ? 'Generating...' : `Generate ${title}`}
      </button>

      {result && (
        <div className="mt-1 p-2.5 bg-[#0d0d0d] border border-purple-900/30 rounded text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar-v">
          {result}
        </div>
      )}
    </div>
  );
}