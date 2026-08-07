'use client';

/**
 * MidiNote Component - Individual MIDI note rectangle
 * 
 * Features:
 * - Draggable note body
 * - Resize handles on edges
 * - Velocity-based color
 * - Selection highlighting
 * - Ghost state during drag
 */

import React, { useCallback, memo } from 'react';
import { MidiNote } from '../../engine/midi/types';

interface MidiNoteProps {
  note: MidiNote;
  pitchToY: (pitch: number) => number;
  beatToX: (beat: number) => number;
  pixelPerBeat: number;
  pixelPerSemitone: number;
  color: string;
  isDragging?: boolean;
  onMouseDown?: (e: React.MouseEvent, note: MidiNote, handle: 'body' | 'left' | 'right') => void;
}

export const MidiNoteComponent = memo(function MidiNoteComponent({
  note,
  pitchToY,
  beatToX,
  pixelPerBeat,
  pixelPerSemitone,
  color,
  isDragging = false,
  onMouseDown,
}: MidiNoteProps) {
  const x = beatToX(note.startBeat);
  const y = pitchToY(note.pitch);
  const width = Math.max(4, note.duration * pixelPerBeat);
  const height = pixelPerSemitone - 1;

  // Velocity-based opacity (0-127 mapped to 0.3-1.0)
  const opacity = 0.3 + (note.velocity / 127) * 0.7;
  const noteColor = note.color || color;

  const handleMouseDown = useCallback((e: React.MouseEvent, handle: 'body' | 'left' | 'right') => {
    e.stopPropagation();
    onMouseDown?.(e, note, handle);
  }, [note, onMouseDown]);

  return (
    <div
      className={`
        absolute rounded-sm overflow-hidden cursor-grab
        ${note.selected ? 'ring-2 ring-white z-20' : 'z-10'}
        ${isDragging ? 'opacity-70 cursor-grabbing' : ''}
        transition-shadow hover:ring-1 hover:ring-white/50
      `}
      style={{
        left: x,
        top: y,
        width,
        height,
        backgroundColor: noteColor,
        opacity,
        transform: isDragging ? 'scale(1.02)' : undefined,
      }}
      onMouseDown={(e) => handleMouseDown(e, 'body')}
    >
      {/* Resize left handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize hover:bg-white/30"
        onMouseDown={(e) => handleMouseDown(e, 'left')}
      />

      {/* Resize right handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize hover:bg-white/30"
        onMouseDown={(e) => handleMouseDown(e, 'right')}
      />

      {/* Note label (only if wide enough) */}
      {width > 30 && (
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] text-white font-medium truncate pointer-events-none select-none">
          {note.velocity}
        </span>
      )}
    </div>
  );
});

export default MidiNoteComponent;
