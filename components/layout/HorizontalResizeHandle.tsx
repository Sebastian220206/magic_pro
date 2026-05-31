'use client';

import React, { useState, useEffect, useRef } from 'react';

interface Props {
  onDrag: (deltaY: number) => void;
  onDoubleClick?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export type HorizontalResizeHandleProps = Props;

export function HorizontalResizeHandle({
  onDrag,
  onDoubleClick,
  onDragStart,
  onDragEnd,
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    onDragStart?.();
    startYRef.current = e.clientY;

    // Disable text selection and change cursor
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';

    const onMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startYRef.current;
      startYRef.current = moveEvent.clientY;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        onDrag(deltaY);
      });
    };

    const onUp = () => {
      setIsDragging(false);
      onDragEnd?.();
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  useEffect(() => {
    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      className="horizontal-resize-handle group"
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      style={{
        height: '6px',
        cursor: 'row-resize',
        background: isDragging ? 'rgba(0,150,255,0.3)' : 'transparent',
        position: 'relative',
        zIndex: 10,
        transition: isDragging ? 'none' : 'background-color 0.15s ease',
      }}
    >
      {/* Subtle hover effect */}
      <div
        className={`absolute inset-0 group-hover:bg-white/10 ${isDragging ? 'hidden' : 'block'}`}
      />
    </div>
  );
}
