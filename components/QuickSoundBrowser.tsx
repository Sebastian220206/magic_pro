"use client";

import { useState, useRef, useCallback } from "react";
import { Music, Drum, Guitar, Waves, Headphones, X, Play, Square } from "lucide-react";
import { audioEngine } from "@/engine/AudioEngineAdapter";

interface SoundItem {
  id: string;
  name: string;
  category: string;
  icon: React.ReactNode;
  color: string;
  path: string;
}

const SOUNDS: SoundItem[] = [
  { id: 'kick-1', name: '808 Kick', category: 'Drums', icon: <Drum className="w-4 h-4" />, color: '#f59e0b', path: '/audio/loops/drums/kick-808.wav' },
  { id: 'snare-1', name: 'Acoustic Snare', category: 'Drums', icon: <Drum className="w-4 h-4" />, color: '#f97316', path: '/audio/loops/drums/snare-acoustic.wav' },
  { id: 'hihat-1', name: 'Closed Hi-Hat', category: 'Drums', icon: <Drum className="w-4 h-4" />, color: '#84cc16', path: '/audio/loops/drums/hihat-closed.wav' },
  { id: 'clap-1', name: 'Reverb Clap', category: 'Drums', icon: <Drum className="w-4 h-4" />, color: '#eab308', path: '/audio/loops/drums/clap-reverb.wav' },
  { id: 'bass-1', name: 'Deep Sub', category: 'Bass', icon: <Waves className="w-4 h-4" />, color: '#a855f7', path: '/audio/loops/bass/deep-sub.wav' },
  { id: 'bass-2', name: 'Picked Bass', category: 'Bass', icon: <Waves className="w-4 h-4" />, color: '#8b5cf6', path: '/audio/loops/bass/picked-bass.wav' },
  { id: 'melody-1', name: 'Pluck Arp', category: 'Melodic', icon: <Music className="w-4 h-4" />, color: '#06b6d4', path: '/audio/loops/melodic/pluck-arp.wav' },
  { id: 'melody-2', name: 'Pad Swell', category: 'Melodic', icon: <Music className="w-4 h-4" />, color: '#3b82f6', path: '/audio/loops/melodic/pad-swell.wav' },
  { id: 'fx-1', name: 'Riser', category: 'FX', icon: <Headphones className="w-4 h-4" />, color: '#ec4899', path: '/audio/loops/fx/riser.wav' },
];

const CATEGORIES = ['Drums', 'Bass', 'Melodic', 'FX'];

interface Props {
  onClose: () => void;
  onSelectSound: (sound: SoundItem) => void;
}

export function QuickSoundBrowser({ onClose, onSelectSound }: Props) {
  const [category, setCategory] = useState('Drums');
  const [previewing, setPreviewing] = useState<string | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const filtered = SOUNDS.filter(s => s.category === category);

  const handlePreview = useCallback(async (sound: SoundItem) => {
    if (previewing === sound.id) {
      audioEngine.stopPreview();
      sourceRef.current = null;
      setPreviewing(null);
      return;
    }

    audioEngine.stopPreview();
    try {
      await audioEngine.previewLoop(sound.path);
      setPreviewing(sound.id);
      sourceRef.current = null; // previewLoop manages its own source
    } catch {
      setPreviewing(null);
    }
  }, [previewing]);

  return (
    <div className="bg-daw-panel border border-daw-border rounded-xl p-5 w-full max-w-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-sm">Quick Sounds</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              category === cat
                ? 'bg-daw-primary text-white'
                : 'bg-daw-surface text-gray-400 hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Sound list */}
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {filtered.map(sound => (
          <div
            key={sound.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-daw-surface transition group cursor-pointer"
            onClick={() => onSelectSound(sound)}
          >
            <button
              onClick={(e) => { e.stopPropagation(); handlePreview(sound); }}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition ${
                previewing === sound.id
                  ? 'bg-daw-primary text-white'
                  : 'bg-daw-surface text-gray-400 hover:text-white'
              }`}
            >
              {previewing === sound.id ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>

            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: sound.color }}
            />

            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-gray-400 shrink-0">{sound.icon}</span>
              <span className="text-white text-sm truncate">{sound.name}</span>
            </div>

            <span className="text-xs text-gray-600 opacity-0 group-hover:opacity-100 transition">Add</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-600 mt-3 text-center">
        Click a sound to preview. Click again to add to your project.
      </p>
    </div>
  );
}
