'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HorizontalResizeHandle } from './HorizontalResizeHandle';

interface Props {
  top: React.ReactNode;
  bottom: React.ReactNode;
  initialTopHeight?: number;
  minTop?: number;
  maxTop?: number;
  storageKey?: string;
  onResize?: (topHeight: number) => void;
}

function loadFromLocalStorage(key: string): number | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(key);
  return stored ? parseInt(stored, 10) : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export type HorizontalSplitViewProps = Props;

export function HorizontalSplitView({
  top,
  bottom,
  initialTopHeight = 300,
  minTop = 200,
  maxTop,
  storageKey = 'daw_top_panel_height',
  onResize,
}: Props) {
  const [topHeight, setTopHeight] = useState<number>(
    loadFromLocalStorage(storageKey) || initialTopHeight
  );
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(storageKey, topHeight.toString());
  }, [topHeight, storageKey]);

  const handleDrag = useCallback((deltaY: number) => {
    const safeMaxTop = maxTop || (containerRef.current ? containerRef.current.clientHeight - 200 : typeof window !== 'undefined' ? window.innerHeight - 200 : 800);
    setTopHeight((prev) => {
      const next = clamp(prev + deltaY, minTop, safeMaxTop);
      if (onResize) onResize(next);
      return next;
    });
  }, [minTop, maxTop, onResize]);

  const handleDoubleClick = useCallback(() => {
    setTopHeight(initialTopHeight);
    if (onResize) onResize(initialTopHeight);
  }, [initialTopHeight, onResize]);

  return (
    <div ref={containerRef} className="flex flex-col h-full w-full overflow-hidden relative container">
      {/* Top Panel */}
      <div
        style={{ height: topHeight, flexShrink: 0 }}
        className="overflow-hidden"
      >
        {top}
      </div>

      {/* Resize Handle */}
      <HorizontalResizeHandle
        onDrag={handleDrag}
        onDoubleClick={handleDoubleClick}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => setIsDragging(false)}
      />

      {/* Bottom Panel */}
      <div style={{ flex: 1 }} className="overflow-hidden bg-[#1a1a1a]">
        {bottom}
      </div>

      {/* Drag overlay line */}
      {isDragging && (
        <div
          className="drag-line"
          style={{
            position: 'absolute',
            top: topHeight,
            left: 0,
            right: 0,
            height: '2px',
            background: 'rgba(0,150,255,0.8)',
            zIndex: 1000,
            pointerEvents: 'none',
            boxShadow: '0 0 8px rgba(0, 150, 255, 0.6)',
          }}
        />
      )}
    </div>
  );
}
