'use client';

/**
 * MidiGrid - Time grid for piano roll
 * 
 * Features:
 * - Vertical grid lines for beats/subdivisions
 * - Bar markers
 * - Current playhead position
 * - Click to create notes (in draw mode)
 */

import React, { useMemo, memo } from 'react';
import { getTimeMarkers } from '../../engine/midi/quantization';

interface MidiGridProps {
  startBeat: number;
  endBeat: number;
  lowPitch: number;
  highPitch: number;
  pixelPerBeat: number;
  pixelPerSemitone: number;
  gridDivision: number;
  currentBeat?: number;
  width: number;
  height: number;
}

export const MidiGrid = memo(function MidiGrid({
  startBeat,
  endBeat,
  lowPitch,
  highPitch,
  pixelPerBeat,
  pixelPerSemitone,
  gridDivision,
  currentBeat = -1,
  width,
  height,
}: MidiGridProps) {
  // Generate time markers
  const timeMarkers = useMemo(() => {
    return getTimeMarkers(startBeat, endBeat, gridDivision as any, { numerator: 4, denominator: 4 });
  }, [startBeat, endBeat, gridDivision]);

  // Generate horizontal pitch lines
  const pitchLines = useMemo(() => {
    const lines = [];
    for (let pitch = lowPitch; pitch <= highPitch; pitch++) {
      const y = (highPitch - pitch) * pixelPerSemitone;
      const isBlackKey = [1, 3, 6, 8, 10].includes(pitch % 12);
      
      lines.push({
        pitch,
        y,
        isBlackKey,
        showLabel: pitch % 12 === 0, // Show octave on C
      });
    }
    return lines;
  }, [lowPitch, highPitch, pixelPerSemitone]);

  const playheadX = currentBeat >= 0 ? (currentBeat - startBeat) * pixelPerBeat : -1;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gray-900" />

      {/* Horizontal pitch lines */}
      {pitchLines.map(({ pitch, y, isBlackKey }) => (
        <div
          key={`pitch-${pitch}`}
          className="absolute w-full pointer-events-none"
          style={{
            top: y,
            height: pixelPerSemitone,
            backgroundColor: isBlackKey ? 'rgba(31, 41, 55, 0.5)' : 'transparent',
            borderBottom: '1px solid rgba(75, 85, 99, 0.3)',
          }}
        />
      ))}

      {/* Vertical grid lines */}
      {timeMarkers.map((marker) => {
        const x = (marker.beat - startBeat) * pixelPerBeat;
        const isBar = marker.type === 'bar';
        const isBeat = marker.type === 'beat';
        
        return (
          <div
            key={`grid-${marker.beat}`}
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: x,
              width: 1,
              backgroundColor: isBar 
                ? 'rgba(255, 255, 255, 0.3)' 
                : isBeat 
                  ? 'rgba(255, 255, 255, 0.15)' 
                  : 'rgba(255, 255, 255, 0.05)',
            }}
          >
            {isBar && marker.label && (
              <span className="absolute -top-5 left-1 text-[10px] text-gray-400">
                {marker.label}
              </span>
            )}
          </div>
        );
      })}

      {/* Playhead */}
      {playheadX >= 0 && playheadX <= width && (
        <div
          className="absolute top-0 bottom-0 w-px bg-red-500 z-50 pointer-events-none"
          style={{ left: playheadX }}
        >
          <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rounded-full" />
        </div>
      )}
    </div>
  );
});

export default MidiGrid;
