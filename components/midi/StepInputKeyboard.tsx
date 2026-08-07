'use client';

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface StepInputKeyboardProps {
  onNoteInput: (pitch: number, velocity: number, duration: number) => void;
  isOpen: boolean;
  onClose: () => void;
  selectedDuration?: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// C3=48 to B4=71
const WHITE_KEYS = [48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71];
const BLACK_KEYS = [49, 51, 54, 56, 58, 61, 63, 66, 68, 70];

// Musical typing map: computer key -> pitch
const KEY_MAP: Record<string, number> = {
  a: 48, w: 49, s: 50, e: 51, d: 52, f: 53, t: 54, g: 55, y: 56, h: 57,
  u: 58, j: 59, k: 60, o: 61, l: 62, p: 63, // Semicolon maps to nothing useful, skip
  z: 64, x: 66, c: 67, v: 69, b: 71,
};
// Also add shifted black keys
KEY_MAP[';'] = 65; // F4

const KEY_WIDTH = 28;
const KEY_HEIGHT = 120;
const BLACK_KEY_WIDTH = 20;
const BLACK_KEY_HEIGHT = 72;

function noteName(pitch: number): string {
  const octave = Math.floor(pitch / 12) - 1;
  return `${NOTE_NAMES[pitch % 12]}${octave}`;
}

const StepInputKeyboard = memo(function StepInputKeyboard({
  onNoteInput,
  isOpen,
  onClose,
  selectedDuration = 0.25,
}: StepInputKeyboardProps) {
  const [velocity, setVelocity] = useState(100);
  const [duration, setDuration] = useState(selectedDuration);
  const [activeKey, setActiveKey] = useState<number | null>(null);
  const [activePitches, setActivePitches] = useState<Set<number>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  const handleNoteOn = useCallback((pitch: number) => {
    onNoteInput(pitch, velocity, duration);
    setActivePitches(prev => new Set(prev).add(pitch));
    setTimeout(() => {
      setActivePitches(prev => {
        const next = new Set(prev);
        next.delete(pitch);
        return next;
      });
    }, 150);
  }, [onNoteInput, velocity, duration]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const key = e.key.toLowerCase();
      if (key === 'escape') { onClose(); return; }
      const pitch = KEY_MAP[key];
      if (pitch !== undefined) {
        e.preventDefault();
        handleNoteOn(pitch);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleNoteOn]);

  // Click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handleClick), 0);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  const durationOptions = useMemo(() => [
    { label: '1/4', value: 1 },
    { label: '1/8', value: 0.5 },
    { label: '1/16', value: 0.25 },
    { label: '1/32', value: 0.125 },
  ], []);

  if (!isOpen) return null;

  const whiteKeyEls = WHITE_KEYS.map(pitch => {
    const idx = WHITE_KEYS.indexOf(pitch);
    const x = idx * KEY_WIDTH;
    const isActive = activePitches.has(pitch);
    return (
      <g key={`w-${pitch}`}>
        <rect
          x={x} y={0} width={KEY_WIDTH - 1} height={KEY_HEIGHT}
          fill={isActive ? '#bbdefb' : '#ffffff'}
          stroke="#999" strokeWidth={0.5}
          rx={2} ry={2}
          style={{ cursor: 'pointer', transition: 'fill 0.1s' }}
          onMouseDown={() => handleNoteOn(pitch)}
          onMouseEnter={() => setActiveKey(pitch)}
          onMouseLeave={() => setActiveKey(null)}
        />
        <text
          x={x + KEY_WIDTH / 2} y={KEY_HEIGHT - 8}
          textAnchor="middle" fill="#666"
          fontSize={9} fontFamily="sans-serif"
        >{noteName(pitch)}</text>
      </g>
    );
  });

  const blackKeyEls = BLACK_KEYS.map(pitch => {
    // Find position: black key between adjacent white keys
    const whiteIndex = WHITE_KEYS.indexOf(pitch - 1);
    const x = (whiteIndex + 1) * KEY_WIDTH - BLACK_KEY_WIDTH / 2;
    const isActive = activePitches.has(pitch);
    return (
      <g key={`b-${pitch}`}>
        <rect
          x={x} y={0} width={BLACK_KEY_WIDTH} height={BLACK_KEY_HEIGHT}
          fill={isActive ? '#555' : '#222'}
          stroke="#111" strokeWidth={0.5}
          rx={2} ry={2}
          style={{ cursor: 'pointer', transition: 'fill 0.1s' }}
          onMouseDown={() => handleNoteOn(pitch)}
        />
        <text
          x={x + BLACK_KEY_WIDTH / 2} y={12}
          textAnchor="middle" fill="#888"
          fontSize={7} fontFamily="sans-serif"
        >{noteName(pitch)}</text>
      </g>
    );
  });

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div
        ref={panelRef}
        className="pointer-events-auto bg-[#1e1e1e] border border-[#444] rounded-lg shadow-2xl p-3"
        style={{ width: 480 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-300 text-xs font-bold">Step Input Keyboard</span>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 text-sm leading-none px-1"
          >✕</button>
        </div>

        {/* Keyboard SVG */}
        <svg width={WHITE_KEYS.length * KEY_WIDTH} height={KEY_HEIGHT} className="mb-3">
          {whiteKeyEls}
          {blackKeyEls}
        </svg>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Velocity */}
          <div className="flex items-center gap-1">
            <span className="text-gray-500 text-[10px]">Vel:</span>
            <input
              type="range" min={1} max={127} value={velocity}
              onChange={e => setVelocity(Number(e.target.value))}
              className="w-20 h-1"
            />
            <span className="text-gray-300 text-[10px] w-6 text-right tabular-nums">{velocity}</span>
          </div>

          <div className="w-px h-4 bg-gray-700" />

          {/* Duration buttons */}
          <div className="flex gap-1">
            {durationOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDuration(opt.value)}
                className={`px-2 py-0.5 text-[10px] rounded ${
                  duration === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#333] text-gray-400 hover:bg-[#444]'
                }`}
              >{opt.label}</button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Close hint */}
          <span className="text-gray-600 text-[9px]">Esc to close</span>
        </div>
      </div>
    </div>,
    document.body
  );
});

export default StepInputKeyboard;
