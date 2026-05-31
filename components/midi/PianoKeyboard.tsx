'use client';

/**
 * Piano Keyboard - Vertical piano keyboard component
 * 
 * Features:
 * - White and black keys
 * - Note names on hover
 * - Octave markers
 * - Click to audition notes
 */

import React, { useMemo, memo, useCallback } from 'react';
import { pitchToNoteName, isBlackKey } from '../../engine/midi/types';

interface PianoKeyboardProps {
  lowPitch: number;
  highPitch: number;
  pixelPerSemitone: number;
  width?: number;
  /** Called on mouse down (immediate, not onClick) */
  onNoteOn?: (pitch: number) => void;
  /** Called on mouse up or mouse leave */
  onNoteOff?: (pitch: number) => void;
  highlightedKeys?: Set<number>;
}

const WHITE_KEY_WIDTH = 60;
const BLACK_KEY_WIDTH = 40;
const KEY_BORDER_COLOR = '#374151';
const WHITE_KEY_COLOR = '#F3F4F6';
const BLACK_KEY_COLOR = '#1F2937';
const HIGHLIGHT_COLOR = '#3B82F6';

export const PianoKeyboard = memo(function PianoKeyboard({
  lowPitch,
  highPitch,
  pixelPerSemitone,
  width = 80,
  onNoteOn,
  onNoteOff,
  highlightedKeys = new Set(),
}: PianoKeyboardProps) {
  // Generate keys from high to low (top to bottom in UI)
  const keys = useMemo(() => {
    const result: Array<{
      pitch: number;
      isBlack: boolean;
      y: number;
      label: string;
      octave: number;
    }> = [];
    
    for (let pitch = highPitch; pitch >= lowPitch; pitch--) {
      const isBlack = isBlackKey(pitch);
      const y = (highPitch - pitch) * pixelPerSemitone;
      const label = pitchToNoteName(pitch);
      const octave = Math.floor(pitch / 12) - 1;
      
      result.push({
        pitch,
        isBlack,
        y,
        label,
        octave,
      });
    }
    
    return result;
  }, [lowPitch, highPitch, pixelPerSemitone]);

  const handleNoteOn = useCallback((pitch: number) => {
    onNoteOn?.(pitch);
  }, [onNoteOn]);

  const handleNoteOff = useCallback((pitch: number) => {
    onNoteOff?.(pitch);
  }, [onNoteOff]);

  const totalHeight = (highPitch - lowPitch + 1) * pixelPerSemitone;

  return (
    <div 
      className="relative bg-gray-900 border-r border-gray-700 flex-shrink-0"
      style={{ width, height: totalHeight }}
    >
      {/* White keys container */}
      <div className="absolute inset-0">
        {keys.filter(k => !k.isBlack).map(key => (
          <div
            key={key.pitch}
            className="absolute left-0 flex items-center justify-end pr-2 cursor-pointer transition-colors hover:bg-gray-200"
            style={{
              top: key.y,
              width: WHITE_KEY_WIDTH,
              height: pixelPerSemitone,
              backgroundColor: highlightedKeys.has(key.pitch) 
                ? HIGHLIGHT_COLOR 
                : WHITE_KEY_COLOR,
              borderBottom: `1px solid ${KEY_BORDER_COLOR}`,
              borderRight: `1px solid ${KEY_BORDER_COLOR}`,
            }}
            onMouseDown={() => handleNoteOn(key.pitch)}
            onMouseUp={() => handleNoteOff(key.pitch)}
            onMouseLeave={() => handleNoteOff(key.pitch)}
          >
            {/* Show octave number on C */}
            {key.label.startsWith('C') && (
              <span className="text-[10px] text-gray-500 font-medium">
                {key.octave}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Black keys */}
      <div className="absolute inset-0 pointer-events-none">
        {keys.filter(k => k.isBlack).map(key => {
          // Calculate position relative to surrounding white keys
          const noteIndex = key.pitch % 12;
          const offset = [1, 3].includes(noteIndex) ? pixelPerSemitone * 0.7 : pixelPerSemitone * 0.3;
          
          return (
            <div
              key={key.pitch}
              className="absolute cursor-pointer pointer-events-auto transition-colors hover:bg-gray-600"
              style={{
                top: key.y - offset,
                left: 0,
                width: BLACK_KEY_WIDTH,
                height: pixelPerSemitone * 0.6,
                backgroundColor: highlightedKeys.has(key.pitch) 
                  ? HIGHLIGHT_COLOR 
                  : BLACK_KEY_COLOR,
                borderRadius: '0 3px 3px 0',
                zIndex: 10,
              }}
              onMouseDown={() => handleNoteOn(key.pitch)}
              onMouseUp={() => handleNoteOff(key.pitch)}
              onMouseLeave={() => handleNoteOff(key.pitch)}
            />
          );
        })}
      </div>

      {/* Middle C marker */}
      {lowPitch <= 60 && highPitch >= 60 && (
        <div
          className="absolute left-0 w-full h-px bg-blue-400 pointer-events-none"
          style={{
            top: (highPitch - 60) * pixelPerSemitone,
            zIndex: 5,
          }}
        >
          <span className="absolute -top-3 left-1 text-[8px] text-blue-400">C4</span>
        </div>
      )}
    </div>
  );
});

export default PianoKeyboard;
