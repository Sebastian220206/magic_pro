'use client';

/**
 * Clip Gain Handle - Draggable gain control on clip
 * 
 * Features:
 * - Vertical slider for gain adjustment
 * - dB display
 * - Real-time visual feedback
 * - Click to reset
 */

import React, { useRef, useState, useCallback, memo } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface ClipGainHandleProps {
  clipId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  gainDb: number; // -60 to +12 dB
  isVisible: boolean;
  onGainChange: (clipId: string, gainDb: number) => void;
}

const MIN_GAIN_DB = -60;
const MAX_GAIN_DB = 12;
const DEFAULT_GAIN_DB = 0;

export const ClipGainHandle = memo(function ClipGainHandle({
  clipId,
  x,
  y,
  width,
  height,
  gainDb,
  isVisible,
  onGainChange,
}: ClipGainHandleProps) {
  const handleRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [currentGainDb, setCurrentGainDb] = useState(gainDb);

  if (!isVisible) return null;

  // Calculate handle position based on gain
  const gainPercent = (gainDb - MIN_GAIN_DB) / (MAX_GAIN_DB - MIN_GAIN_DB);
  const handleY = height * (1 - gainPercent);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    setDragStartY(e.clientY);
    setCurrentGainDb(gainDb);
    
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [gainDb]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    
    e.preventDefault();
    
    const deltaY = dragStartY - e.clientY;
    const sensitivity = 0.5; // dB per pixel
    const deltaDb = deltaY * sensitivity;
    
    let newGainDb = currentGainDb + deltaDb;
    newGainDb = Math.max(MIN_GAIN_DB, Math.min(MAX_GAIN_DB, newGainDb));
    newGainDb = Math.round(newGainDb * 10) / 10; // Round to 1 decimal
    
    onGainChange(clipId, newGainDb);
  }, [isDragging, dragStartY, currentGainDb, clipId, onGainChange]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    
    e.preventDefault();
    setIsDragging(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
  }, [isDragging]);

  const handleDoubleClick = useCallback(() => {
    onGainChange(clipId, DEFAULT_GAIN_DB);
  }, [clipId, onGainChange]);

  // Determine icon based on gain
  const Icon = gainDb <= -60 ? VolumeX : Volume2;
  const isMuted = gainDb <= -60;

  return (
    <div
      ref={handleRef}
      className="absolute pointer-events-auto"
      style={{
        left: x + width - 24,
        top: y + 4,
        width: 20,
        height: Math.min(60, height - 8),
        zIndex: 30,
      }}
    >
      {/* Gain slider track */}
      <div
        className="absolute inset-x-0 rounded-full bg-black/40 overflow-hidden"
        style={{
          height: '100%',
        }}
      >
        {/* Gain level fill */}
        <div
          className={`absolute bottom-0 left-0 right-0 transition-all duration-75 ${
            isMuted ? 'bg-red-500/60' : 'bg-blue-500/60'
          }`}
          style={{
            height: `${gainPercent * 100}%`,
          }}
        />
        
        {/* Drag handle */}
        <div
          className={`absolute left-0 right-0 h-3 cursor-ns-resize transition-all ${
            isDragging ? 'bg-white' : 'bg-white/80 hover:bg-white'
          }`}
          style={{
            bottom: `${gainPercent * 100}%`,
            transform: 'translateY(50%)',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleDoubleClick}
        />
      </div>

      {/* dB display tooltip */}
      <div
        className={`absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-xs font-mono whitespace-nowrap transition-opacity ${
          isDragging ? 'opacity-100' : 'opacity-0'
        } bg-black/80 text-white`}
      >
        {gainDb > -60 ? `${gainDb > 0 ? '+' : ''}${gainDb.toFixed(1)} dB` : '-∞ dB'}
      </div>

      {/* Icon indicator */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 p-0.5">
        <Icon 
          className={`w-3 h-3 ${isMuted ? 'text-red-400' : 'text-white/70'}`} 
        />
      </div>
    </div>
  );
});

export default ClipGainHandle;
