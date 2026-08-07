'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { MidiNote } from '../../engine/midi/types';
import { pitchToNoteName } from '../../engine/midi/types';

interface NoteEditPopoverProps {
  note: MidiNote | null;
  position: { x: number; y: number } | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateNote: (noteId: string, updates: Partial<MidiNote>) => void;
  onDeleteNote: (noteId: string) => void;
}

const POPOVER_WIDTH = 220;
const POPOVER_HEIGHT = 340;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export default function NoteEditPopover({
  note,
  position,
  isOpen,
  onClose,
  onUpdateNote,
  onDeleteNote,
}: NoteEditPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x: 0, y: 0 });

  // Local editing state
  const [pitch, setPitch] = useState(60);
  const [velocity, setVelocity] = useState(100);
  const [duration, setDuration] = useState(0.25);
  const [channel, setChannel] = useState(0);
  const [startBeat, setStartBeat] = useState(0);
  const [muted, setMuted] = useState(false);
  const [slide, setSlide] = useState(false);
  const [portamento, setPortamento] = useState(false);

  // Sync local state from note prop
  useEffect(() => {
    if (note) {
      setPitch(note.pitch);
      setVelocity(note.velocity);
      setDuration(note.duration);
      setChannel(note.channel ?? 0);
      setStartBeat(note.startBeat);
      setMuted(note.muted ?? false);
      setSlide(note.slide ?? false);
      setPortamento(note.portamento ?? false);
    }
  }, [note]);

  // Adjust position to stay in viewport
  useEffect(() => {
    if (position && isOpen) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let x = position.x;
      let y = position.y - 20; // offset above the note
      if (x + POPOVER_WIDTH > vw - 10) x = vw - POPOVER_WIDTH - 10;
      if (x < 10) x = 10;
      if (y + POPOVER_HEIGHT > vh - 10) y = position.y + 20; // show below instead
      if (y < 10) y = 10;
      setAdjustedPos({ x, y });
    }
  }, [position, isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Click outside to close (with delay to avoid same-click close)
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (e.detail >= 2) return; // double-click on a note re-targets the popover — don't close
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isOpen, onClose]);

  const handleSave = useCallback(() => {
    if (!note) return;
    onUpdateNote(note.id, {
      pitch: clamp(Math.round(pitch), 0, 127),
      velocity: clamp(Math.round(velocity), 0, 127),
      duration: Math.max(0.125, duration),
      channel: clamp(channel, 0, 15),
      startBeat: Math.max(0, startBeat),
      muted,
      slide,
      portamento,
    });
    onClose();
  }, [note, pitch, velocity, duration, channel, startBeat, muted, slide, portamento, onUpdateNote, onClose]);

  const handleDelete = useCallback(() => {
    if (!note) return;
    onDeleteNote(note.id);
    onClose();
  }, [note, onDeleteNote, onClose]);

  if (!isOpen || !note || !position) return null;

  const noteName = pitchToNoteName(pitch);

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[100] bg-[#2d2d2d] border border-[#444] rounded-lg shadow-2xl transition-opacity duration-150"
      style={{
        left: adjustedPos.x,
        top: adjustedPos.y,
        width: POPOVER_WIDTH,
        opacity: 1,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#444]">
        <span className="text-gray-200 text-xs font-bold">Note Properties</span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-200 text-sm">✕</button>
      </div>

      <div className="p-3 space-y-2 text-xs">
        {/* Pitch */}
        <div className="flex items-center gap-2">
          <label className="text-gray-400 w-16">Pitch</label>
          <input
            type="number" min={0} max={127} value={pitch}
            onChange={e => setPitch(Number(e.target.value))}
            className="w-14 bg-[#1a1a1a] border border-[#333] rounded px-1 py-0.5 text-gray-200 text-center"
          />
          <span className="text-gray-500">{noteName}</span>
        </div>

        {/* Velocity */}
        <div className="flex items-center gap-2">
          <label className="text-gray-400 w-16">Velocity</label>
          <input
            type="range" min={0} max={127} value={velocity}
            onChange={e => setVelocity(Number(e.target.value))}
            className="flex-1 h-1"
          />
          <span className="text-gray-300 w-6 text-right tabular-nums">{velocity}</span>
        </div>

        {/* Duration */}
        <div className="flex items-center gap-2">
          <label className="text-gray-400 w-16">Duration</label>
          <input
            type="number" min={0.125} step={0.125} value={duration}
            onChange={e => setDuration(Math.max(0.125, Number(e.target.value)))}
            className="w-20 bg-[#1a1a1a] border border-[#333] rounded px-1 py-0.5 text-gray-200"
          />
          <span className="text-gray-500">beats</span>
        </div>

        {/* Start Beat */}
        <div className="flex items-center gap-2">
          <label className="text-gray-400 w-16">Start</label>
          <input
            type="number" min={0} step={0.125} value={startBeat}
            onChange={e => setStartBeat(Math.max(0, Number(e.target.value)))}
            className="w-20 bg-[#1a1a1a] border border-[#333] rounded px-1 py-0.5 text-gray-200"
          />
          <span className="text-gray-500">beats</span>
        </div>

        {/* Channel */}
        <div className="flex items-center gap-2">
          <label className="text-gray-400 w-16">Channel</label>
          <select
            value={channel}
            onChange={e => setChannel(Number(e.target.value))}
            className="bg-[#1a1a1a] border border-[#333] rounded px-1 py-0.5 text-gray-200 flex-1"
          >
            {Array.from({ length: 16 }).map((_, i) => (
              <option key={i} value={i}>Ch {i + 1}</option>
            ))}
          </select>
        </div>

        {/* Checkboxes */}
        <div className="flex items-center gap-3 pt-1">
          <label className="flex items-center gap-1 text-gray-400 cursor-pointer">
            <input type="checkbox" checked={muted} onChange={e => setMuted(e.target.checked)} className="w-3 h-3" />
            Muted
          </label>
          <label className="flex items-center gap-1 text-gray-400 cursor-pointer">
            <input type="checkbox" checked={slide} onChange={e => setSlide(e.target.checked)} className="w-3 h-3" />
            Slide
          </label>
          <label className="flex items-center gap-1 text-gray-400 cursor-pointer">
            <input type="checkbox" checked={portamento} onChange={e => setPortamento(e.target.checked)} className="w-3 h-3" />
            Portamento
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-[#444]">
          <button
            onClick={handleSave}
            className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
          >Apply</button>
          <button
            onClick={handleDelete}
            className="px-2 py-1 bg-red-700 hover:bg-red-800 text-white text-xs rounded"
          >Delete</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
