'use client';

import React, { useRef, useEffect, useState, memo } from 'react';
import { PianoKeyboard } from './PianoKeyboard';
import { PianoRollTools } from './PianoRollTools';
import { VelocityLane } from './VelocityLane';
import { useMidiStore } from '../../store/midiStore';
import { pianoRollNavigation } from '../../engine/navigation/NavigationEngine';
import { RendererScheduler } from '../../engine/rendering/contracts/RendererScheduler';
import { DirtyRegionManager, BoundingBox } from '../../engine/rendering/invalidation/DirtyRegionManager';
import { PitchGridRenderer } from '../../engine/midi/grid/PitchGridRenderer';
import { MidiRenderer } from '../../engine/midi/MidiRenderer';
import { globalSpatialNoteCache } from '../../engine/midi/cache/SpatialNoteCache';
import { DirtyRegionVisualizer } from '../../engine/rendering/invalidation/DirtyRegionVisualizer';

interface PianoRollProps {
  clipId: string;
  width?: number;
  height?: number;
  onNoteOn?: (pitch: number) => void;
  onNoteOff?: (pitch: number) => void;
}

const VELOCITY_LANE_HEIGHT = 80;
const KEYBOARD_WIDTH = 80;

// Local instances for the Piano Roll viewport
const pianoRollDirtyManager = new DirtyRegionManager();
const pianoRollScheduler = new RendererScheduler();

// We must alter RendererScheduler to take the dirty manager or just pass it in.
// Since RendererScheduler is hardcoded to globalDirtyRegionManager currently,
// we will inject it temporarily or update RendererScheduler later. For now, 
// let's assume we can override it or we'll just force full frame repaints if not modified.
// Wait, to be perfectly correct, I'll update RendererScheduler in the next step to accept a dirty manager.

export const PianoRoll = memo(function PianoRoll({
  clipId,
  width = 800,
  height = 500,
  onNoteOn,
  onNoteOff,
}: PianoRollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const {
    currentClipId,
    currentTool,
    gridSettings,
    selectedNoteIds,
    isPlaying,
    showVelocityLane,
    openClip,
    setTool,
    setGridDivision,
    toggleSnapToGrid,
    quantizeSelected,
    setSelectedNotesVelocity,
    getCurrentClip,
  } = useMidiStore();

  useEffect(() => {
    if (clipId && clipId !== currentClipId) {
      openClip(clipId);
    }
  }, [clipId, currentClipId, openClip]);

  const clip = getCurrentClip();

  // Engine Setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // We instantiate renderers locally so they are bound to this canvas context
    const gridRenderer = new PitchGridRenderer(ctx);
    const noteRenderer = new MidiRenderer(ctx);
    const debugRenderer = new DirtyRegionVisualizer();

    pianoRollScheduler.register(gridRenderer);
    pianoRollScheduler.register(noteRenderer);
    // pianoRollScheduler.setDebugRenderer(debugRenderer as any);

    const dpr = window.devicePixelRatio || 1;
    const cw = width - KEYBOARD_WIDTH;
    const ch = height - (showVelocityLane ? VELOCITY_LANE_HEIGHT : 0);

    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    ctx.scale(dpr, dpr);

    const renderCanvas = () => {
      const clipData = useMidiStore.getState().getCurrentClip();
      if (clipData && clipData.notes) {
         globalSpatialNoteCache.buildCache(clipData.notes);
      }

      const viewportState = pianoRollNavigation.getState();
      
      // Temporary hack: since RendererScheduler uses globalDirtyRegionManager,
      // we'll just bypass it if we haven't patched it yet.
      // Wait, we can just clear rect here if it's full frame.
      ctx.clearRect(0, 0, cw, ch);
      
      gridRenderer.renderFull(ctx, viewportState);
      noteRenderer.renderFull(ctx, viewportState);
      // debugRenderer.draw(ctx, viewportState);
    };

    renderCanvas();

    const unsubscribeNav = pianoRollNavigation.subscribe(() => {
       renderCanvas();
    });

    const unsubscribeStore = useMidiStore.subscribe(() => {
       renderCanvas();
    });

    return () => {
       unsubscribeNav();
       unsubscribeStore();
    };

  }, [width, height, showVelocityLane, clipId]);

  if (!clip) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No MIDI clip selected
      </div>
    );
  }

  const gridHeight = height - (showVelocityLane ? VELOCITY_LANE_HEIGHT : 0);
  const viewportState = pianoRollNavigation.getState();
  const lowPitch = Math.max(0, Math.floor(viewportState.maxVisiblePitch - gridHeight / viewportState.zoomY));
  const highPitch = Math.min(127, Math.ceil(viewportState.maxVisiblePitch));

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg overflow-hidden">
      <PianoRollTools
        currentTool={currentTool}
        gridDivision={gridSettings.division}
        snapToGrid={gridSettings.snap}
        onToolChange={setTool}
        onGridDivisionChange={setGridDivision}
        onToggleSnap={toggleSnapToGrid}
        onZoomIn={() => pianoRollNavigation.queueInput(new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, clientX: 400, clientY: 200 }))}
        onZoomOut={() => pianoRollNavigation.queueInput(new WheelEvent('wheel', { deltaY: 100, ctrlKey: true, clientX: 400, clientY: 200 }))}
        onQuantize={() => quantizeSelected({ gridDivision: gridSettings.division, strength: 1 })}
      />

      <div className="flex flex-1 overflow-hidden relative">
        <PianoKeyboard
          lowPitch={lowPitch}
          highPitch={highPitch}
          pixelPerSemitone={viewportState.zoomY}
          width={KEYBOARD_WIDTH}
          onNoteOn={onNoteOn}
          onNoteOff={onNoteOff}
          highlightedKeys={new Set()}
        />

        <div 
          className="flex-1 relative overflow-hidden"
          onWheel={(e) => pianoRollNavigation.queueInput(e.nativeEvent)}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 10 }}
          />

          {showVelocityLane && (
            <div 
              className="absolute bottom-0 left-0 right-0 pointer-events-auto"
              style={{ height: VELOCITY_LANE_HEIGHT }}
            >
              {/* VelocityLane remains for now, but its transform must be managed */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default PianoRoll;
