'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';

interface GoToBeatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToBeat: (beat: number) => void;
  currentBeat: number;
}

export function GoToBeatDialog({ isOpen, onClose, onGoToBeat, currentBeat }: GoToBeatDialogProps) {
  const [mode, setMode] = useState<'beat' | 'bar'>('beat');
  const [value, setValue] = useState(Math.floor(currentBeat).toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(Math.floor(currentBeat).toString());
      setMode('beat');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, currentBeat]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleGo = useCallback(() => {
    const num = parseInt(value);
    if (isNaN(num) || num < 0) return;
    const beat = mode === 'bar' ? num * 4 : num;
    onGoToBeat(beat);
    onClose();
  }, [value, mode, onGoToBeat, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-5 w-72"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-200">Go to Beat/Measure</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setMode('beat')}
            className={`px-3 py-1 text-xs rounded transition-colors ${mode === 'beat' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
          >
            Beat
          </button>
          <button
            onClick={() => setMode('bar')}
            className={`px-3 py-1 text-xs rounded transition-colors ${mode === 'bar' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
          >
            Bar
          </button>
        </div>

        <input
          ref={inputRef}
          type="number"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleGo(); }}
          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-200 text-sm mb-4 focus:outline-none focus:border-blue-500"
          placeholder={mode === 'beat' ? 'Enter beat number...' : 'Enter bar number...'}
        />

        <div className="flex justify-end gap-2">
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
            Go
          </button>
        </div>
      </div>
    </div>
  );
}

export default GoToBeatDialog;