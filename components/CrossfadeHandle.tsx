'use client';

/**
 * Crossfade Handle - Visual control for clip crossfades
 * 
 * Features:
 * - Display crossfade between overlapping clips
 * - Adjustable curve type
 * - Visual fade curves
 * - Click to adjust fade duration
 */

import React, { useRef, useState, useCallback, memo } from 'react';
import { Link2, Unlink } from 'lucide-react';
import { Crossfade } from '../engine/timeline/crossfadeEngine';
import { FadeCurveType } from '../engine/timeline/types';

interface CrossfadeHandleProps {
  crossfade: Crossfade;
  pixelsPerBeat: number;
  trackY: number;
  trackHeight: number;
  isVisible: boolean;
  isSelected: boolean;
  onCurveChange: (crossfadeId: string, curveType: FadeCurveType) => void;
  onDurationChange: (crossfadeId: string, duration: number) => void;
}

const CURVE_COLORS: Record<FadeCurveType, string> = {
  linear: '#60A5FA',
  exponential: '#34D399',
  logarithmic: '#FBBF24',
  scurve: '#A78BFA',
};

export const CrossfadeHandle = memo(function CrossfadeHandle({
  crossfade,
  pixelsPerBeat,
  trackY,
  trackHeight,
  isVisible,
  isSelected,
  onCurveChange,
  onDurationChange,
}: CrossfadeHandleProps) {
  const handleRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  if (!isVisible) return null;

  const x = crossfade.startTime * pixelsPerBeat;
  const width = crossfade.duration * pixelsPerBeat;
  const centerX = x + width / 2;

  // Generate curve path
  const generateCurvePath = (type: FadeCurveType): string => {
    const height = 24;
    const steps = 20;
    let path = `M 0,${height}`;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      let y: number;

      switch (type) {
        case 'linear':
          y = height * (1 - t);
          break;
        case 'exponential':
          y = height * (1 - t * t);
          break;
        case 'logarithmic':
          y = height * (1 - Math.sqrt(t));
          break;
        case 'scurve':
          y = height * (1 - t * t * (3 - 2 * t));
          break;
        default:
          y = height * (1 - t);
      }

      path += ` L ${t * width},${y}`;
    }

    return path;
  };

  const handleCurveClick = useCallback(() => {
    const curves: FadeCurveType[] = ['linear', 'exponential', 'logarithmic', 'scurve'];
    const currentIndex = curves.indexOf(crossfade.curveType);
    const nextCurve = curves[(currentIndex + 1) % curves.length];
    onCurveChange(crossfade.id, nextCurve);
  }, [crossfade.id, crossfade.curveType, onCurveChange]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    (e.target as Element).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div
      ref={handleRef}
      className="absolute pointer-events-auto"
      style={{
        left: x,
        top: trackY + trackHeight - 28,
        width,
        height: 28,
        zIndex: isDragging ? 50 : 25,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background */}
      <div
        className="absolute inset-0 rounded-sm"
        style={{
          background: `linear-gradient(to top, ${CURVE_COLORS[crossfade.curveType]}30, transparent)`,
          opacity: isHovered || isSelected ? 0.6 : 0.3,
        }}
      />

      {/* Curve visualization */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${width} 28`}
        preserveAspectRatio="none"
      >
        <path
          d={generateCurvePath(crossfade.curveType)}
          fill="none"
          stroke={CURVE_COLORS[crossfade.curveType]}
          strokeWidth={2}
          opacity={isHovered || isSelected ? 1 : 0.7}
        />
      </svg>

      {/* Center handle */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
          w-4 h-4 rounded-full cursor-pointer transition-all
          ${isDragging ? 'bg-white scale-125' : 'bg-white/80 hover:bg-white'}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onClick={handleCurveClick}
      >
        <Link2 className="w-3 h-3 text-gray-800 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>

      {/* Duration indicator */}
      {(isHovered || isSelected) && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-black/80 rounded text-xs text-white whitespace-nowrap">
          {crossfade.duration.toFixed(3)}b
        </div>
      )}

      {/* Curve type label */}
      {(isHovered || isSelected) && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white uppercase tracking-wider">
          {crossfade.curveType}
        </div>
      )}

      {/* Selection highlight */}
      {isSelected && (
        <div className="absolute -inset-0.5 border-2 border-yellow-400 rounded-sm pointer-events-none" />
      )}
    </div>
  );
});

export default CrossfadeHandle;
