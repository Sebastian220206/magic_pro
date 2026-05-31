'use client';

/**
 * Mixer Fader - Professional volume fader with dB scale
 * 
 * Features:
 * - Logarithmic fader curve (like real mixers)
 * - dB display
 * - Smooth animation
 * - Double-click to reset
 * - Visual feedback
 */

import React, { useRef, useState, useCallback, memo, useMemo } from 'react';

interface MixerFaderProps {
  valueDb: number;           // -Infinity to +12dB
  onChange: (db: number) => void;
  width?: number;
  height?: number;
  label?: string;
  color?: string;
  showMeter?: boolean;
  meterValue?: number;       // 0-1
  disabled?: boolean;
}

// Logarithmic fader curve (maps 0-1 to -60 to +12 dB)
const MIN_DB = -60;
const MAX_DB = 12;
const UNITY_DB = 0;

export const MixerFader = memo(function MixerFader({
  valueDb,
  onChange,
  width = 60,
  height = 200,
  label = 'Volume',
  color = '#3B82F6',
  showMeter = true,
  meterValue = 0,
  disabled = false,
}: MixerFaderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverDb, setHoverDb] = useState<number | null>(null);

  // Convert dB to fader position (0-1)
  const dbToPosition = useCallback((db: number): number => {
    if (db <= MIN_DB) return 0;
    if (db >= MAX_DB) return 1;
    
    // Logarithmic curve
    const normalized = (db - MIN_DB) / (MAX_DB - MIN_DB);
    return Math.pow(normalized, 0.5); // Square root for better feel
  }, []);

  // Convert fader position (0-1) to dB
  const positionToDb = useCallback((pos: number): number => {
    if (pos <= 0) return MIN_DB;
    if (pos >= 1) return MAX_DB;
    
    const normalized = Math.pow(pos, 2); // Inverse square
    return MIN_DB + normalized * (MAX_DB - MIN_DB);
  }, []);

  const faderPos = useMemo(() => dbToPosition(valueDb), [valueDb, dbToPosition]);
  const displayDb = hoverDb !== null ? hoverDb : valueDb;

  // Handle pointer events
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const y = e.clientY - rect.top;
    const pos = 1 - Math.max(0, Math.min(1, y / rect.height));
    onChange(positionToDb(pos));
    
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [disabled, onChange, positionToDb]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || disabled) return;
    
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const y = e.clientY - rect.top;
    const pos = 1 - Math.max(0, Math.min(1, y / rect.height));
    const newDb = positionToDb(pos);
    
    setHoverDb(newDb);
    onChange(newDb);
  }, [isDragging, disabled, onChange, positionToDb]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsDragging(false);
    setHoverDb(null);
    (e.target as Element).releasePointerCapture(e.pointerId);
  }, []);

  const handleDoubleClick = useCallback(() => {
    if (!disabled) {
      onChange(UNITY_DB);
    }
  }, [disabled, onChange]);

  // Generate tick marks
  const ticks = useMemo(() => {
    const tickMarks = [];
    const tickDbValues = [-60, -48, -36, -24, -18, -12, -6, -3, 0, 3, 6, 9, 12];
    
    for (const db of tickDbValues) {
      const pos = dbToPosition(db);
      const isUnity = db === 0;
      
      tickMarks.push(
        <div
          key={db}
          className={`absolute left-0 right-0 flex items-center ${isUnity ? 'font-bold' : ''}`}
          style={{ top: `${(1 - pos) * 100}%` }}
        >
          <div className={`h-px ${isUnity ? 'w-4 bg-yellow-400' : 'w-2 bg-gray-500'}`} />
          <span className={`ml-1 text-[10px] ${isUnity ? 'text-yellow-400' : 'text-gray-400'}`}>
            {db === MIN_DB ? '-∞' : db > 0 ? `+${db}` : db}
          </span>
        </div>
      );
    }
    return tickMarks;
  }, [dbToPosition]);

  return (
    <div 
      className="flex flex-col items-center"
      style={{ width, height: height + 40 }}
    >
      {/* Label */}
      <div className="text-xs font-medium text-gray-400 mb-1">{label}</div>
      
      {/* dB Display */}
      <div className={`text-sm font-mono mb-2 ${disabled ? 'text-gray-600' : 'text-white'}`}>
        {displayDb <= MIN_DB ? '-∞' : displayDb > 0 ? `+${displayDb.toFixed(1)}` : displayDb.toFixed(1)}
      </div>
      
      {/* Fader Track */}
      <div
        ref={trackRef}
        className={`relative rounded-full bg-gray-800 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        style={{ width: 12, height }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        {/* Background track */}
        <div className="absolute inset-x-0 top-2 bottom-2 bg-gray-900 rounded-full overflow-hidden">
          {/* Fill */}
          <div
            className="absolute bottom-0 left-0 right-0 transition-all duration-75"
            style={{
              height: `${faderPos * 100}%`,
              background: `linear-gradient(to top, ${color}80, ${color})`,
            }}
          />
          
          {/* Meter (optional) */}
          {showMeter && (
            <div
              className="absolute bottom-0 left-0 right-0 bg-green-500/30"
              style={{ height: `${meterValue * 100}%` }}
            />
          )}
        </div>
        
        {/* Ticks */}
        <div className="absolute -left-8 top-2 bottom-2 w-6">
          {ticks}
        </div>
        
        {/* Fader Handle */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 w-8 h-4 rounded 
            ${disabled ? 'bg-gray-600' : 'bg-white shadow-lg'}
            ${isDragging ? 'scale-110' : ''} transition-transform`}
          style={{ bottom: `${faderPos * 100}%`, transform: `translateX(-50%) translateY(50%)` }}
        >
          {/* Center line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-800 -translate-x-1/2" />
        </div>
      </div>
      
      {/* 0dB indicator */}
      <div className="text-[10px] text-gray-500 mt-1">0dB</div>
    </div>
  );
});

export default MixerFader;
