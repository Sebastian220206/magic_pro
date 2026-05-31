'use client';

/**
 * VelocityLane - Velocity editor bar graph
 * 
 * Features:
 * - Bar graph display of note velocities
 * - Drag to change velocity
 * - Min/Max indicators
 * - Average velocity display
 */

import React, { useMemo, memo, useCallback, useState, useRef } from 'react';
import { MidiNote } from '../../engine/midi/types';

interface VelocityLaneProps {
  notes: MidiNote[];
  selectedNoteIds: Set<string>;
  startBeat: number;
  endBeat: number;
  pixelPerBeat: number;
  height: number;
  onVelocityChange: (noteId: string, velocity: number) => void;
  onVelocityChangeSelected: (velocity: number) => void;
  color: string;
}

export const VelocityLane = memo(function VelocityLane({
  notes,
  selectedNoteIds,
  startBeat,
  endBeat,
  pixelPerBeat,
  height,
  onVelocityChange,
  onVelocityChangeSelected,
  color,
}: VelocityLaneProps) {
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter visible notes
  const visibleNotes = useMemo(() => {
    return notes.filter(
      n => n.startBeat >= startBeat && n.startBeat < endBeat
    );
  }, [notes, startBeat, endBeat]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (visibleNotes.length === 0) {
      return { min: 0, max: 0, avg: 0 };
    }
    const velocities = visibleNotes.map(n => n.velocity);
    return {
      min: Math.min(...velocities),
      max: Math.max(...velocities),
      avg: Math.round(velocities.reduce((a, b) => a + b, 0) / velocities.length),
    };
  }, [visibleNotes]);

  const handleMouseDown = useCallback((e: React.MouseEvent, note: MidiNote) => {
    e.stopPropagation();
    setDragging(true);

    const startY = e.clientY;
    const startVelocity = note.velocity;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const newVelocity = Math.max(1, Math.min(127, startVelocity + Math.round(deltaY / 2)));
      
      if (selectedNoteIds.has(note.id)) {
        onVelocityChangeSelected(newVelocity);
      } else {
        onVelocityChange(note.id, newVelocity);
      }
    };

    const handleMouseUp = () => {
      setDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [selectedNoteIds, onVelocityChange, onVelocityChangeSelected]);

  return (
    <div 
      ref={containerRef}
      className="relative border-t border-gray-700 bg-gray-900 overflow-hidden"
      style={{ height }}
    >
      {/* Background grid */}
      <div className="absolute inset-0 flex items-end pb-2 px-2 gap-4 text-[10px] text-gray-500">
        <span>Min: {stats.min}</span>
        <span>Avg: {stats.avg}</span>
        <span>Max: {stats.max}</span>
      </div>

      {/* Velocity bars */}
      {visibleNotes.map(note => {
        const x = (note.startBeat - startBeat) * pixelPerBeat;
        const barHeight = (note.velocity / 127) * (height - 20);
        const isSelected = selectedNoteIds.has(note.id);
        
        return (
          <div
            key={note.id}
            className={`
              absolute bottom-2 rounded-t-sm cursor-ns-resize
              transition-all duration-75
              ${isSelected ? 'ring-2 ring-white' : ''}
              ${dragging ? 'pointer-events-none' : ''}
            `}
            style={{
              left: x,
              width: Math.max(4, note.duration * pixelPerBeat),
              height: barHeight,
              backgroundColor: isSelected ? color : `${color}80`,
            }}
            onMouseDown={(e) => handleMouseDown(e, note)}
          >
            {/* Velocity value */}
            {barHeight > 15 && (
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-white font-medium">
                {note.velocity}
              </span>
            )}
          </div>
        );
      })}

      {/* 50% reference line */}
      <div 
        className="absolute w-full border-t border-gray-600 border-dashed pointer-events-none"
        style={{ bottom: 2 + (height - 20) * 0.5 }}
      />
    </div>
  );
});

export default VelocityLane;
