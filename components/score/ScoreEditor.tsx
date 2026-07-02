'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { ScoreRenderer, DEFAULT_SCORE_CONFIG } from '@/engine/score';
import type { ScoreConfig, ScoreNote } from '@/engine/score';

interface ScoreEditorProps {
  notes: ScoreNote[];
  config?: Partial<ScoreConfig>;
  width?: number;
  height?: number;
  selectedNoteIds?: Set<string>;
  onNoteClick?: (noteId: string) => void;
  tempo?: number;
}

export function ScoreEditor({
  notes,
  config,
  width = 800,
  height = 200,
  selectedNoteIds,
  onNoteClick,
  tempo,
}: ScoreEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ScoreRenderer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderer = new ScoreRenderer(ctx);
    renderer.config = { ...DEFAULT_SCORE_CONFIG, ...config };
    if (tempo) renderer.config = { ...renderer.config, bpm: tempo };

    const scNotes = notes.map(n => ({
      ...n,
      selected: selectedNoteIds?.has(n.id) || false,
    }));
    renderer.notes = scNotes;

    renderer.renderFull(ctx, {
      startBeat: 0,
      pixelsPerBeat: renderer.config.zoomX,
      maxVisiblePitch: 127,
      zoomY: 1,
      pixelsPerPitch: 1,
    });

    rendererRef.current = renderer;
  }, [notes, config, width, height, selectedNoteIds, tempo]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onNoteClick) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ppb = config?.zoomX ?? DEFAULT_SCORE_CONFIG.zoomX;
      const clickBeat = x / ppb;

      const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat);
      const tolerance = 0.5;
      const clicked = sorted.find(
        n => Math.abs(n.startBeat - clickBeat) < tolerance && !n.muted
      );
      if (clicked) onNoteClick(clicked.id);
    },
    [notes, onNoteClick, config]
  );

  return (
    <div className="score-editor bg-[#0d0d0d] rounded border border-gray-800 overflow-auto select-none">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="cursor-pointer"
        onClick={handleCanvasClick}
      />
    </div>
  );
}
