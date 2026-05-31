'use client';

/**
 * Clip Handles Component - Draggable handles for clip editing
 * 
 * Provides:
 * - Left trim handle (adjust start time + offset)
 * - Right trim handle (adjust duration)
 * - Fade in handle (adjust fade in duration)
 * - Fade out handle (adjust fade out duration)
 * - Visual feedback during drag
 */

import React, { useRef, useState, useCallback, memo } from 'react';

// =============================================================================
// Types
// =============================================================================

type HandleType = 'left' | 'right' | 'fadeIn' | 'fadeOut';

interface ClipHandlesProps {
  clipId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fadeInDuration: number;
  fadeOutDuration: number;
  pixelsPerBeat: number;
  isVisible: boolean;
  isSelected: boolean;
  onTrimStart: (handle: 'left' | 'right', startX: number) => void;
  onTrimMove: (handle: 'left' | 'right', deltaX: number) => void;
  onTrimEnd: (handle: 'left' | 'right') => void;
  onFadeUpdate: (fadeType: 'in' | 'out', duration: number) => void;
}

// =============================================================================
// Constants
// =============================================================================

const HANDLE_WIDTH = 6;
const HANDLE_HIT_AREA = 12;
const FADE_HANDLE_HEIGHT = 12;
const MIN_FADE_WIDTH = 20;

// =============================================================================
// Component
// =============================================================================

export const ClipHandles = memo(function ClipHandles({
  clipId,
  x,
  y,
  width,
  height,
  fadeInDuration,
  fadeOutDuration,
  pixelsPerBeat,
  isVisible,
  isSelected,
  onTrimStart,
  onTrimMove,
  onTrimEnd,
  onFadeUpdate,
}: ClipHandlesProps) {
  const containerRef = useRef<SVGSVGElement>(null);
  const [activeHandle, setActiveHandle] = useState<HandleType | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [visualFadeIn, setVisualFadeIn] = useState(fadeInDuration);
  const [visualFadeOut, setVisualFadeOut] = useState(fadeOutDuration);

  // Calculate pixel positions
  const pixelFadeIn = fadeInDuration * pixelsPerBeat;
  const pixelFadeOut = fadeOutDuration * pixelsPerBeat;
  const visualPixelFadeIn = visualFadeIn * pixelsPerBeat;
  const visualPixelFadeOut = visualFadeOut * pixelsPerBeat;

  // Early return if not visible
  if (!isVisible) return null;

  // =============================================================================
  // Trim Handle Events
  // =============================================================================

  const handleLeftPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setActiveHandle('left');
    setDragStartX(e.clientX);
    onTrimStart('left', e.clientX);
    
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [onTrimStart]);

  const handleRightPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setActiveHandle('right');
    setDragStartX(e.clientX);
    onTrimStart('right', e.clientX);
    
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [onTrimStart]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!activeHandle || activeHandle === 'fadeIn' || activeHandle === 'fadeOut') return;

    e.preventDefault();
    
    const deltaX = e.clientX - dragStartX;
    onTrimMove(activeHandle as 'left' | 'right', deltaX);
  }, [activeHandle, dragStartX, onTrimMove]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!activeHandle || activeHandle === 'fadeIn' || activeHandle === 'fadeOut') return;

    e.preventDefault();
    
    onTrimEnd(activeHandle as 'left' | 'right');
    setActiveHandle(null);
    
    (e.target as Element).releasePointerCapture(e.pointerId);
  }, [activeHandle, onTrimEnd]);

  // =============================================================================
  // Fade Handle Events
  // =============================================================================

  const handleFadeInPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setActiveHandle('fadeIn');
    setDragStartX(e.clientX);
    setVisualFadeIn(fadeInDuration);
    
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [fadeInDuration]);

  const handleFadeOutPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setActiveHandle('fadeOut');
    setDragStartX(e.clientX);
    setVisualFadeOut(fadeOutDuration);
    
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [fadeOutDuration]);

  const handleFadePointerMove = useCallback((e: React.PointerEvent) => {
    if (!activeHandle || (activeHandle !== 'fadeIn' && activeHandle !== 'fadeOut')) return;

    e.preventDefault();
    
    const deltaX = e.clientX - dragStartX;
    const deltaBeats = deltaX / pixelsPerBeat;

    if (activeHandle === 'fadeIn') {
      const newDuration = Math.max(0, Math.min(visualFadeIn + deltaBeats, width / pixelsPerBeat * 0.5));
      setVisualFadeIn(newDuration);
    } else {
      const newDuration = Math.max(0, Math.min(visualFadeOut - deltaBeats, width / pixelsPerBeat * 0.5));
      setVisualFadeOut(newDuration);
    }
  }, [activeHandle, dragStartX, pixelsPerBeat, visualFadeIn, visualFadeOut, width]);

  const handleFadePointerUp = useCallback((e: React.PointerEvent) => {
    if (!activeHandle || (activeHandle !== 'fadeIn' && activeHandle !== 'fadeOut')) return;

    e.preventDefault();
    
    if (activeHandle === 'fadeIn') {
      onFadeUpdate('in', Math.round(visualFadeIn * 1000) / 1000);
    } else {
      onFadeUpdate('out', Math.round(visualFadeOut * 1000) / 1000);
    }
    
    setActiveHandle(null);
    setVisualFadeIn(fadeInDuration);
    setVisualFadeOut(fadeOutDuration);
    
    (e.target as Element).releasePointerCapture(e.pointerId);
  }, [activeHandle, fadeInDuration, fadeOutDuration, onFadeUpdate, visualFadeIn, visualFadeOut]);

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <svg
      ref={containerRef}
      className="absolute pointer-events-none"
      style={{
        left: x,
        top: y,
        width,
        height,
        zIndex: 20,
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Left trim handle */}
      <g className="pointer-events-auto">
        {/* Hit area */}
        <rect
          x={0}
          y={0}
          width={HANDLE_HIT_AREA}
          height={height}
          fill="transparent"
          cursor="w-resize"
          onPointerDown={handleLeftPointerDown}
        />
        {/* Visual indicator */}
        <rect
          x={0}
          y={height * 0.25}
          width={activeHandle === 'left' ? HANDLE_WIDTH + 2 : HANDLE_WIDTH}
          height={height * 0.5}
          rx={2}
          fill={activeHandle === 'left' ? '#FCD34D' : 'rgba(255,255,255,0.5)'}
          style={{
            filter: activeHandle === 'left' ? 'drop-shadow(0 0 2px rgba(252,211,78,0.8))' : 'none',
            transition: 'all 0.1s ease',
          }}
        />
        {/* Trim lines */}
        <line
          x1={HANDLE_WIDTH / 2}
          y1={height * 0.3}
          x2={HANDLE_WIDTH / 2}
          y2={height * 0.7}
          stroke={activeHandle === 'left' ? '#1F2937' : 'rgba(255,255,255,0.8)'}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </g>

      {/* Right trim handle */}
      <g className="pointer-events-auto">
        {/* Hit area */}
        <rect
          x={width - HANDLE_HIT_AREA}
          y={0}
          width={HANDLE_HIT_AREA}
          height={height}
          fill="transparent"
          cursor="e-resize"
          onPointerDown={handleRightPointerDown}
        />
        {/* Visual indicator */}
        <rect
          x={width - (activeHandle === 'right' ? HANDLE_WIDTH + 2 : HANDLE_WIDTH)}
          y={height * 0.25}
          width={activeHandle === 'right' ? HANDLE_WIDTH + 2 : HANDLE_WIDTH}
          height={height * 0.5}
          rx={2}
          fill={activeHandle === 'right' ? '#FCD34D' : 'rgba(255,255,255,0.5)'}
          style={{
            filter: activeHandle === 'right' ? 'drop-shadow(0 0 2px rgba(252,211,78,0.8))' : 'none',
            transition: 'all 0.1s ease',
          }}
        />
        {/* Trim lines */}
        <line
          x1={width - HANDLE_WIDTH / 2}
          y1={height * 0.3}
          x2={width - HANDLE_WIDTH / 2}
          y2={height * 0.7}
          stroke={activeHandle === 'right' ? '#1F2937' : 'rgba(255,255,255,0.8)'}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </g>

      {/* Fade in handle */}
      {fadeInDuration > 0 && (
        <g
          className="pointer-events-auto"
          onPointerDown={handleFadeInPointerDown}
          onPointerMove={handleFadePointerMove}
          onPointerUp={handleFadePointerUp}
        >
          <rect
            x={0}
            y={0}
            width={Math.max(MIN_FADE_WIDTH, visualPixelFadeIn)}
            height={FADE_HANDLE_HEIGHT}
            fill="transparent"
            cursor="ns-resize"
          />
          <path
            d={`M 0,${FADE_HANDLE_HEIGHT} L ${visualPixelFadeIn},0 L ${visualPixelFadeIn},${FADE_HANDLE_HEIGHT} Z`}
            fill={activeHandle === 'fadeIn' ? 'rgba(252,211,78,0.4)' : 'rgba(255,255,255,0.2)'}
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={1}
          />
          {/* Fade in icon */}
          <text
            x={8}
            y={FADE_HANDLE_HEIGHT - 2}
            fontSize={10}
            fill="rgba(255,255,255,0.8)"
            style={{ userSelect: 'none' }}
          >
            in
          </text>
        </g>
      )}

      {/* Fade out handle */}
      {fadeOutDuration > 0 && (
        <g
          className="pointer-events-auto"
          onPointerDown={handleFadeOutPointerDown}
          onPointerMove={handleFadePointerMove}
          onPointerUp={handleFadePointerUp}
        >
          <rect
            x={width - Math.max(MIN_FADE_WIDTH, visualPixelFadeOut)}
            y={0}
            width={Math.max(MIN_FADE_WIDTH, visualPixelFadeOut)}
            height={FADE_HANDLE_HEIGHT}
            fill="transparent"
            cursor="ns-resize"
          />
          <path
            d={`M ${width - visualPixelFadeOut},${FADE_HANDLE_HEIGHT} L ${width - visualPixelFadeOut},0 L ${width},${FADE_HANDLE_HEIGHT} Z`}
            fill={activeHandle === 'fadeOut' ? 'rgba(252,211,78,0.4)' : 'rgba(255,255,255,0.2)'}
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={1}
          />
          {/* Fade out icon */}
          <text
            x={width - 20}
            y={FADE_HANDLE_HEIGHT - 2}
            fontSize={10}
            fill="rgba(255,255,255,0.8)"
            style={{ userSelect: 'none' }}
          >
            out
          </text>
        </g>
      )}

      {/* Active drag indicator */}
      {activeHandle && (
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="none"
          stroke="#FCD34D"
          strokeWidth={2}
          strokeDasharray="4 4"
          pointerEvents="none"
        />
      )}
    </svg>
  );
});

export default ClipHandles;
