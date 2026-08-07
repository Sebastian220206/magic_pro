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
  maxVisiblePitch: number;
  pixelPerSemitone: number;
  width?: number;
  /** Called on mouse down (immediate, not onClick) */
  onNoteOn?: (pitch: number) => void;
  /** Called on mouse up or mouse leave */
  onNoteOff?: (pitch: number) => void;
  highlightedKeys?: Set<number>;
  /** Notes currently held — from the MIDI keyboard or a mouse press. */
  activeKeys?: Set<number>;
  /** Key range limits for scale/key visualization */
  keyLimitLow?: number;
  keyLimitHigh?: number;
  /** Whether to show key limit indicators */
  showKeyLimits?: boolean;
}

const WHITE_KEY_WIDTH = 60;
const BLACK_KEY_WIDTH = 36;
const KEY_BORDER_COLOR = '#111827';
const WHITE_KEY_COLOR = '#E5E7EB';
const BLACK_KEY_COLOR = '#1F2937';
const HIGHLIGHT_COLOR = '#FCA5A5';
/** A held note. Distinct from the scale overlay so the two never read alike. */
const ACTIVE_KEY_COLOR = '#38BDF8';

export const PianoKeyboard = memo(function PianoKeyboard({
  lowPitch,
  highPitch,
  maxVisiblePitch,
  pixelPerSemitone,
  width = 80,
  onNoteOn,
  onNoteOff,
  highlightedKeys = new Set(),
  activeKeys = new Set(),
  keyLimitLow,
  keyLimitHigh,
  showKeyLimits = false,
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
      const y = (maxVisiblePitch - pitch) * pixelPerSemitone;
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
  }, [lowPitch, highPitch, maxVisiblePitch, pixelPerSemitone]);

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
        {keys.filter(k => !k.isBlack).map(key => {
          const hasBlackKeyAbove = isBlackKey(key.pitch + 1);
          const hasBlackKeyBelow = isBlackKey(key.pitch - 1);
          
          let top = key.y;
          let height = pixelPerSemitone;
          
          if (hasBlackKeyAbove) {
            top -= 0.5 * pixelPerSemitone;
            height += 0.5 * pixelPerSemitone;
          }
          
          if (hasBlackKeyBelow) {
            height += 0.5 * pixelPerSemitone;
          }

          return (
            <div
              key={key.pitch}
              className="absolute left-0 flex items-center justify-end pr-2 cursor-pointer transition-colors hover:bg-gray-300"
              style={{
                top,
                width: WHITE_KEY_WIDTH,
                height,
                // A key being played wins over scale highlighting, so live
                // input stays readable whatever the scale overlay is doing.
                background: activeKeys.has(key.pitch)
                  ? ACTIVE_KEY_COLOR
                  : highlightedKeys.has(key.pitch)
                    ? HIGHLIGHT_COLOR
                    : (key.pitch % 12 === 0 ? '#F3F4F6' : WHITE_KEY_COLOR),
                borderBottom: `1px solid ${KEY_BORDER_COLOR}`,
                borderRight: `1px solid ${KEY_BORDER_COLOR}`,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), inset -2px 0 5px rgba(0,0,0,0.05)',
                zIndex: 1,
              }}
              onMouseDown={() => handleNoteOn(key.pitch)}
              onMouseUp={() => handleNoteOff(key.pitch)}
              onMouseLeave={() => handleNoteOff(key.pitch)}
            >
              {/* Show octave number on C */}
              {key.label.startsWith('C') && (
                <span className="text-[10px] text-gray-500 font-semibold drop-shadow-sm">
                  {key.octave}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Black keys */}
      <div className="absolute inset-0 pointer-events-none">
        {keys.filter(k => k.isBlack).map(key => (
          <div
            key={key.pitch}
            className="absolute cursor-pointer pointer-events-auto transition-colors hover:bg-gray-600"
            style={{
              top: key.y,
              left: 0,
              width: BLACK_KEY_WIDTH,
              height: pixelPerSemitone,
              background: activeKeys.has(key.pitch)
                ? ACTIVE_KEY_COLOR
                : highlightedKeys.has(key.pitch)
                  ? HIGHLIGHT_COLOR
                  : `linear-gradient(90deg, #111827 0%, ${BLACK_KEY_COLOR} 80%, #374151 100%)`,
              borderRadius: '0 3px 3px 0',
              border: `1px solid #000`,
              borderLeft: 'none',
              boxShadow: '0 2px 4px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1)',
              zIndex: 10,
            }}
            onMouseDown={() => handleNoteOn(key.pitch)}
            onMouseUp={() => handleNoteOff(key.pitch)}
            onMouseLeave={() => handleNoteOff(key.pitch)}
          />
        ))}
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

      {/* Key Limit Indicators */}
      {showKeyLimits && keyLimitLow !== undefined && keyLimitLow >= lowPitch && keyLimitLow <= highPitch && (
        <div
          className="absolute left-0 w-full h-px bg-yellow-400/60 pointer-events-none"
          style={{
            top: (highPitch - keyLimitLow) * pixelPerSemitone,
            zIndex: 5,
          }}
        >
          <span className="absolute -top-3 left-1 text-[7px] text-yellow-400 font-medium">Key Low</span>
        </div>
      )}
      {showKeyLimits && keyLimitHigh !== undefined && keyLimitHigh >= lowPitch && keyLimitHigh <= highPitch && (
        <div
          className="absolute left-0 w-full h-px bg-yellow-400/60 pointer-events-none"
          style={{
            top: (highPitch - keyLimitHigh) * pixelPerSemitone,
            zIndex: 5,
          }}
        >
          <span className="absolute -top-3 left-1 text-[7px] text-yellow-400 font-medium">Key High</span>
        </div>
      )}
    </div>
  );
});

export default PianoKeyboard;
