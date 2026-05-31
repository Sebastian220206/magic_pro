'use client';

/**
 * Clip Component - Professional DAW clip with full editing capabilities
 * 
 * Features:
 * - Waveform display with fade curves
 * - Trim handles (left/right edges)
 * - Fade handles
 * - Selection highlighting
 * - Stretch indicator
 * - Pointer event handling for drag operations
 * - Grid snapping
 * - Multi-selection support
 */

import React, { useRef, useState, useCallback, useMemo, memo } from 'react';
import { Clip as ClipType, EditTool } from '../engine/timeline/types';
import { ClipEditor, createClipEditor } from '../engine/timeline/clipEditor';
import { getClipColor, getWaveformColor } from '../engine/timeline/clipRenderer';

// =============================================================================
// Props
// =============================================================================

interface ClipProps {
  clip: ClipType;
  trackY: number;
  trackHeight: number;
  pixelsPerBeat: number;
  tempo: number;
  isSelected: boolean;
  isMultiSelected: boolean;
  currentTool: EditTool;
  playheadBeat: number;
  viewportStart: number;
  viewportEnd: number;
  audioBuffer?: AudioBuffer;
  
  // Actions
  onSelect: (clipId: string, addToSelection: boolean) => void;
  onDeselect: (clipId: string) => void;
  onMove: (clipId: string, newStartTime: number) => void;
  onTrim: (clipId: string, edge: 'left' | 'right', newDuration: number, newStartTime?: number) => void;
  onFadeUpdate: (clipId: string, fadeType: 'in' | 'out', duration: number) => void;
  onStretch: (clipId: string, newDuration: number, newPlaybackRate: number) => void;
  onContextMenu: (x: number, y: number, clipId: string) => void;
  onDoubleClick?: (clipId: string) => void;
}

// =============================================================================
// Constants
// =============================================================================

const HANDLE_WIDTH = 6;
const FADE_HANDLE_HEIGHT = 12;
const MIN_CLIP_WIDTH = 20;

// =============================================================================
// Component
// =============================================================================

export const Clip = memo(function Clip({
  clip,
  trackY,
  trackHeight,
  pixelsPerBeat,
  tempo,
  isSelected,
  isMultiSelected,
  currentTool,
  playheadBeat,
  viewportStart,
  viewportEnd,
  audioBuffer,
  onSelect,
  onDeselect,
  onMove,
  onTrim,
  onFadeUpdate,
  onStretch,
  onContextMenu,
  onDoubleClick,
}: ClipProps) {
  // Refs
  const clipRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  
  // State
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<'left' | 'right' | 'body' | 'fadeIn' | 'fadeOut' | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragOriginalStart, setDragOriginalStart] = useState(clip.startTime);
  const [dragOriginalDuration, setDragOriginalDuration] = useState(clip.duration);
  const [visualStart, setVisualStart] = useState(clip.startTime);
  const [visualDuration, setVisualDuration] = useState(clip.duration);
  const [showSnapIndicator, setShowSnapIndicator] = useState(false);
  const [snapPosition, setSnapPosition] = useState(0);

  // Memoized values
  const clipEditor = useMemo(() => createClipEditor(pixelsPerBeat, tempo), [pixelsPerBeat, tempo]);
  
  const pixelX = useMemo(() => clipEditor.beatToPixel(clip.startTime), [clip.startTime, clipEditor]);
  const pixelWidth = useMemo(() => Math.max(MIN_CLIP_WIDTH, clipEditor.beatToPixel(clip.duration)), [clip.duration, clipEditor]);
  const pixelFadeIn = useMemo(() => clipEditor.beatToPixel(clip.fadeIn.duration), [clip.fadeIn.duration, clipEditor]);
  const pixelFadeOut = useMemo(() => clipEditor.beatToPixel(clip.fadeOut.duration), [clip.fadeOut.duration, clipEditor]);
  
  const isVisible = useMemo(() => {
    const clipEnd = clip.startTime + clip.duration;
    return clipEnd >= viewportStart && clip.startTime <= viewportEnd;
  }, [clip.startTime, clip.duration, viewportStart, viewportEnd]);

  const clipColor = useMemo(() => getClipColor(clip, isSelected, isHovered, isDragging), [clip, isSelected, isHovered, isDragging]);
  const waveformColor = useMemo(() => getWaveformColor(clip, isSelected), [clip, isSelected]);

  // Early return if not visible
  if (!isVisible) return null;

  // =============================================================================
  // Event Handlers
  // =============================================================================

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = clipRef.current?.getBoundingClientRect();
    if (!rect) return;

    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    // Determine handle type
    let handle: typeof dragHandle = 'body';
    
    if (localX <= HANDLE_WIDTH) {
      handle = 'left';
    } else if (localX >= rect.width - HANDLE_WIDTH) {
      handle = 'right';
    } else if (localY <= FADE_HANDLE_HEIGHT && localX <= pixelFadeIn + 10) {
      handle = 'fadeIn';
    } else if (localY <= FADE_HANDLE_HEIGHT && localX >= rect.width - pixelFadeOut - 10) {
      handle = 'fadeOut';
    }

    // Split tool mode
    if (currentTool === 'split' && handle === 'body') {
      // Trigger split at playhead
      return;
    }

    // Selection logic
    if (!isSelected && !e.shiftKey) {
      onSelect(clip.id, false);
    } else if (e.shiftKey) {
      if (isSelected) {
        onDeselect(clip.id);
      } else {
        onSelect(clip.id, true);
      }
    }

    // Start drag
    setIsDragging(true);
    setDragHandle(handle);
    setDragStartX(e.clientX);
    setDragStartY(e.clientY);
    setDragOriginalStart(clip.startTime);
    setDragOriginalDuration(clip.duration);
    setVisualStart(clip.startTime);
    setVisualDuration(clip.duration);

    // Capture pointer
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [clip, isSelected, currentTool, onSelect, onDeselect, pixelFadeIn, pixelFadeOut]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !dragHandle) return;

    e.preventDefault();

    // Use RAF for smooth updates
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      const deltaX = e.clientX - dragStartX;
      const deltaBeats = clipEditor.pixelToBeat(deltaX);

      switch (dragHandle) {
        case 'body': {
          const newStart = dragOriginalStart + deltaBeats;
          const snapResult = clipEditor.snapToGrid(newStart, clipEditor.beatToPixel(newStart));
          
          setVisualStart(snapResult.value);
          setShowSnapIndicator(snapResult.snapped);
          setSnapPosition(clipEditor.beatToPixel(snapResult.value));
          break;
        }
        
        case 'left': {
          const trimResult = clipEditor.calculateTrim(
            {
              isDragging: true,
              clipId: clip.id,
              handleType: 'left',
              startX: dragStartX,
              startY: dragStartY,
              originalStartTime: dragOriginalStart,
              originalDuration: dragOriginalDuration,
              originalOffset: clip.offset || 0,
              shiftKey: e.shiftKey,
              altKey: e.altKey,
            },
            e.clientX,
            'left',
            e.shiftKey
          );
          
          setVisualStart(trimResult.newStartTime);
          setVisualDuration(trimResult.newDuration);
          break;
        }
        
        case 'right': {
          if (e.shiftKey) {
            // Stretch mode
            const stretchResult = clipEditor.calculateStretch(
              {
                isDragging: true,
                clipId: clip.id,
                handleType: 'right',
                startX: dragStartX,
                startY: dragStartY,
                originalStartTime: dragOriginalStart,
                originalDuration: dragOriginalDuration,
                originalOffset: clip.offset || 0,
                shiftKey: true,
                altKey: e.altKey,
              },
              e.clientX
            );
            setVisualDuration(stretchResult.newDuration);
          } else {
            // Trim mode
            const trimResult = clipEditor.calculateTrim(
              {
                isDragging: true,
                clipId: clip.id,
                handleType: 'right',
                startX: dragStartX,
                startY: dragStartY,
                originalStartTime: dragOriginalStart,
                originalDuration: dragOriginalDuration,
                originalOffset: clip.offset || 0,
                shiftKey: false,
                altKey: e.altKey,
              },
              e.clientX,
              'right',
              e.shiftKey
            );
            setVisualDuration(trimResult.newDuration);
          }
          break;
        }
        
        case 'fadeIn': {
          const fade = clipEditor.calculateFadeDrag(clip, 'fadeIn', e.clientX - pixelX, pixelX, pixelWidth);
          onFadeUpdate(clip.id, 'in', fade.duration);
          break;
        }
        
        case 'fadeOut': {
          const fade = clipEditor.calculateFadeDrag(clip, 'fadeOut', e.clientX - pixelX, pixelX, pixelWidth);
          onFadeUpdate(clip.id, 'out', fade.duration);
          break;
        }
      }
    });
  }, [isDragging, dragHandle, dragStartX, dragStartY, dragOriginalStart, dragOriginalDuration, clip, clipEditor, pixelX, pixelWidth, onFadeUpdate]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !dragHandle) return;

    e.preventDefault();
    
    // Cancel any pending RAF
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    // Apply changes based on handle type
    switch (dragHandle) {
      case 'body': {
        const finalStart = Math.round(visualStart * 1000) / 1000;
        if (finalStart !== clip.startTime) {
          onMove(clip.id, finalStart);
        }
        break;
      }
      
      case 'left': {
        const newStart = Math.round(visualStart * 1000) / 1000;
        const newDuration = Math.round(visualDuration * 1000) / 1000;
        if (newStart !== clip.startTime || newDuration !== clip.duration) {
          onTrim(clip.id, 'left', newDuration, newStart);
        }
        break;
      }
      
      case 'right': {
        const newDuration = Math.round(visualDuration * 1000) / 1000;
        if (e.shiftKey) {
          // Apply stretch
          const newRate = dragOriginalDuration / newDuration;
          onStretch(clip.id, newDuration, newRate);
        } else if (newDuration !== clip.duration) {
          onTrim(clip.id, 'right', newDuration);
        }
        break;
      }
    }

    // Reset state
    setIsDragging(false);
    setDragHandle(null);
    setShowSnapIndicator(false);
    setVisualStart(clip.startTime);
    setVisualDuration(clip.duration);
    
    (e.target as Element).releasePointerCapture(e.pointerId);
  }, [isDragging, dragHandle, visualStart, visualDuration, clip, onMove, onTrim, onStretch, dragOriginalDuration]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e.clientX, e.clientY, clip.id);
  }, [clip.id, onContextMenu]);

  const handleDoubleClick = useCallback(() => {
    onDoubleClick?.(clip.id);
  }, [clip.id, onDoubleClick]);

  // =============================================================================
  // Render Helpers
  // =============================================================================

  const renderFadePath = (type: 'in' | 'out', width: number, height: number): string => {
    const fade = type === 'in' ? clip.fadeIn : clip.fadeOut;
    if (fade.duration <= 0) return '';

    const fadeWidth = clipEditor.beatToPixel(fade.duration);
    const effectiveWidth = Math.min(fadeWidth, width * 0.5);
    
    let path = 'M ';
    
    if (type === 'in') {
      path += `0,${height} `;
      
      // Generate curve
      const steps = 20;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = t * effectiveWidth;
        let y: number;
        
        switch (fade.curve) {
          case 'exponential':
            y = height - (t * t) * (height * 0.3);
            break;
          case 'logarithmic':
            y = height - Math.sqrt(t) * (height * 0.3);
            break;
          case 'scurve':
            y = height - (t * t * (3 - 2 * t)) * (height * 0.3);
            break;
          default: // linear
            y = height - t * (height * 0.3);
        }
        
        path += `L ${x},${y} `;
      }
      
      path += `L ${effectiveWidth},${height} Z`;
    } else {
      path += `${width},${height} `;
      
      const steps = 20;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = width - t * effectiveWidth;
        let y: number;
        
        switch (fade.curve) {
          case 'exponential':
            y = height - ((1-t) * (1-t)) * (height * 0.3);
            break;
          case 'logarithmic':
            y = height - Math.sqrt(1-t) * (height * 0.3);
            break;
          case 'scurve':
            y = height - ((1-t) * (1-t) * (3 - 2 * (1-t))) * (height * 0.3);
            break;
          default:
            y = height - (1-t) * (height * 0.3);
        }
        
        path += `L ${x},${y} `;
      }
      
      path += `L ${width - effectiveWidth},${height} Z`;
    }
    
    return path;
  };

  // Calculate visual position
  const displayX = isDragging && dragHandle === 'body' 
    ? clipEditor.beatToPixel(visualStart)
    : pixelX;
  const displayWidth = isDragging && (dragHandle === 'left' || dragHandle === 'right')
    ? Math.max(MIN_CLIP_WIDTH, clipEditor.beatToPixel(visualDuration))
    : pixelWidth;

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <>
      {/* Snap indicator */}
      {showSnapIndicator && (
        <div
          className="absolute top-0 bottom-0 w-px bg-yellow-400 z-50 pointer-events-none"
          style={{ left: snapPosition }}
        />
      )}

      {/* Main clip container */}
      <div
        ref={clipRef}
        className={`
          absolute cursor-move select-none overflow-hidden
          ${isSelected ? 'ring-2 ring-white ring-opacity-80' : ''}
          ${isDragging ? 'opacity-80 z-50' : 'z-10'}
          ${clip.muted ? 'opacity-50' : ''}
        `}
        style={{
          left: displayX,
          top: trackY,
          width: displayWidth,
          height: trackHeight,
          backgroundColor: clipColor,
          borderRadius: 4,
          boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.2)',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Waveform visualization */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={displayWidth}
          height={trackHeight}
          preserveAspectRatio="none"
        >
          {/* Simplified waveform representation */}
          <rect
            x="0"
            y={trackHeight * 0.3}
            width={displayWidth}
            height={trackHeight * 0.4}
            fill={waveformColor}
            opacity={0.6}
          />
          
          {/* Center line */}
          <line
            x1="0"
            y1={trackHeight / 2}
            x2={displayWidth}
            y2={trackHeight / 2}
            stroke={waveformColor}
            strokeWidth={1}
            opacity={0.4}
          />
        </svg>

        {/* Fade curves */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={displayWidth}
          height={trackHeight}
        >
          {clip.fadeIn.duration > 0 && (
            <path
              d={renderFadePath('in', displayWidth, trackHeight)}
              fill="rgba(255,255,255,0.15)"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth={1}
            />
          )}
          {clip.fadeOut.duration > 0 && (
            <path
              d={renderFadePath('out', displayWidth, trackHeight)}
              fill="rgba(255,255,255,0.15)"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth={1}
            />
          )}
        </svg>

        {/* Stretch indicator */}
        {clip.playbackRate !== 1 && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
            <div
              className="absolute inset-0"
              style={{
                background: `repeating-linear-gradient(
                  45deg,
                  transparent,
                  transparent ${20 / clip.playbackRate}px,
                  rgba(255,200,100,0.5) ${20 / clip.playbackRate}px,
                  rgba(255,200,100,0.5) ${40 / clip.playbackRate}px
                )`,
              }}
            />
          </div>
        )}

        {/* Trim handles */}
        {(isHovered || isSelected || isDragging) && (
          <>
            {/* Left handle */}
            <div
              className={`
                absolute left-0 top-0 bottom-0 w-1.5 cursor-w-resize
                ${dragHandle === 'left' ? 'bg-yellow-400' : 'bg-white/30'}
                hover:bg-yellow-400/60
              `}
              style={{ width: HANDLE_WIDTH }}
            />
            
            {/* Right handle */}
            <div
              className={`
                absolute right-0 top-0 bottom-0 w-1.5 cursor-e-resize
                ${dragHandle === 'right' ? 'bg-yellow-400' : 'bg-white/30'}
                hover:bg-yellow-400/60
              `}
              style={{ width: HANDLE_WIDTH }}
            />
          </>
        )}

        {/* Fade handles */}
        {(isHovered || isSelected) && (
          <>
            {/* Fade in handle */}
            {clip.fadeIn.duration > 0 && (
              <div
                className="absolute top-0 h-3 bg-white/40 hover:bg-white/60 cursor-ns-resize rounded-sm"
                style={{ 
                  left: 4, 
                  width: Math.max(8, pixelFadeIn - 8),
                }}
              />
            )}
            
            {/* Fade out handle */}
            {clip.fadeOut.duration > 0 && (
              <div
                className="absolute top-0 h-3 bg-white/40 hover:bg-white/60 cursor-ns-resize rounded-sm"
                style={{ 
                  right: 4, 
                  width: Math.max(8, pixelFadeOut - 8),
                }}
              />
            )}
          </>
        )}

        {/* Clip name */}
        <div 
          className="absolute top-1 left-1.5 right-1.5 text-xs font-medium text-white truncate pointer-events-none"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
        >
          {clip.name}
        </div>

        {/* Multi-selection indicator */}
        {isMultiSelected && !isSelected && (
          <div className="absolute inset-0 border-2 border-blue-400/50 rounded pointer-events-none" />
        )}

        {/* Reverse indicator */}
        {clip.playbackRate < 0 && (
          <div className="absolute bottom-1 right-1 text-xs text-white/80 bg-black/30 px-1 rounded">
            ←
          </div>
        )}

        {/* Muted indicator */}
        {clip.muted && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-2xl text-white/40">M</span>
          </div>
        )}
      </div>
    </>
  );
});

export default Clip;
