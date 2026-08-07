'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { X, Search, Music } from 'lucide-react';

interface LocateNoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLocateNote: (pitch: number, beat?: number) => void;
  currentClip: { notes: Array<{ id: string; pitch: number; startBeat: number; duration: number }> } | null;
}

function pitchToNoteName(pitch: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(pitch / 12) - 1;
  return `${names[pitch % 12]}${octave}`;
}

export const LocateNoteDialog = memo(function LocateNoteDialog({
  isOpen,
  onClose,
  onLocateNote,
  currentClip,
}: LocateNoteDialogProps) {
  const [mode, setMode] = useState<'pitch' | 'beat' | 'note'>('pitch');
  const [pitchValue, setPitchValue] = useState('60');
  const [beatValue, setBeatValue] = useState('0');
  const [noteId, setNoteId] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const availableNotes = useMemo(() => {
    if (!currentClip?.notes) return [];
    return currentClip.notes.map(note => ({
      id: note.id,
      label: `${pitchToNoteName(note.pitch)} @ ${note.startBeat.toFixed(2)} (${note.duration.toFixed(2)} beats)`
    }));
  }, [currentClip]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleGo = useCallback(() => {
    if (mode === 'pitch') {
      const pitch = Math.max(0, Math.min(127, parseInt(pitchValue) || 60));
      onLocateNote(pitch);
    } else if (mode === 'beat') {
      const beat = Math.max(0, parseFloat(beatValue) || 0);
      onLocateNote(60, beat);
    } else if (mode === 'note' && noteId) {
      const note = currentClip?.notes.find(n => n.id === noteId);
      if (note) {
        onLocateNote(note.pitch, note.startBeat);
      }
    }
    onClose();
  }, [mode, pitchValue, beatValue, noteId, onLocateNote, onClose, currentClip]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-5 w-80"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Music className="w-4 h-4" />
            Locate Note
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setMode('pitch')}
            className={`px-3 py-1 text-xs rounded transition-colors flex-1 ${mode === 'pitch' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
          >
            By Pitch
          </button>
          <button
            onClick={() => setMode('beat')}
            className={`px-3 py-1 text-xs rounded transition-colors flex-1 ${mode === 'beat' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
          >
            By Beat
          </button>
          <button
            onClick={() => setMode('note')}
            className={`px-3 py-1 text-xs rounded transition-colors flex-1 ${mode === 'note' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
            disabled={!currentClip?.notes?.length}
          >
            By Note
          </button>
        </div>

        {mode === 'pitch' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-500" />
              <input
                ref={inputRef}
                type="number"
                min="0"
                max="127"
                value={pitchValue}
                onChange={(e) => setPitchValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleGo(); }}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-200 text-sm focus:outline-none focus:border-blue-500"
                placeholder="Enter pitch (0-127)..."
              />
            </div>
            <div className="text-xs text-gray-500">
              Middle C = 60 | Range: 0-127
            </div>
            {/* Quick pitch buttons */}
            <div className="flex flex-wrap gap-1">
              {['C-1', 'C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'].map((name, i) => {
                const pitch = (i + 1) * 12;
                return (
                  <button
                    key={name}
                    onClick={() => { setPitchValue(pitch.toString()); handleGo(); }}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      parseInt(pitchValue) === pitch ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {mode === 'beat' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-500" />
              <input
                ref={inputRef}
                type="number"
                min="0"
                step="0.25"
                value={beatValue}
                onChange={(e) => setBeatValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleGo(); }}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-200 text-sm focus:outline-none focus:border-blue-500"
                placeholder="Enter beat position..."
              />
            </div>
            <div className="text-xs text-gray-500">
              Enter beat position (e.g., 4.5 for beat 4.5)
            </div>
            {/* Quick beat buttons */}
            <div className="flex flex-wrap gap-1">
              {[0, 1, 2, 3, 4, 8, 12, 16, 32].map(beat => (
                <button
                  key={beat}
                  onClick={() => { setBeatValue(beat.toString()); handleGo(); }}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    parseFloat(beatValue) === beat ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'
                  }`}
                >
                  Bar {Math.floor(beat / 4) + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'note' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-500" />
              <select
                value={noteId}
                onChange={(e) => setNoteId(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleGo(); }}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-200 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">Select a note...</option>
                {availableNotes.map(note => (
                  <option key={note.id} value={note.id}>
                    {note.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-gray-500">
              {availableNotes.length} notes in current clip
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGo}
            className="px-4 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors"
          >
            Locate
          </button>
        </div>
      </div>
    </div>
  );
});

export default LocateNoteDialog;