'use client';

/**
 * TimelineWithClipEditing - Example integration of clip editing system
 * 
 * Demonstrates:
 * - Rendering clips with editing capabilities
 * - Pointer event handling for drag/trim/stretch
 * - Multi-selection support
 * - Context menu integration
 * - Grid snapping visualization
 * - Tool switching (select, split, draw, etc.)
 */

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Clip as ClipType, EditTool } from '../engine/timeline/types';
import { ClipEditor, createClipEditor } from '../engine/timeline/clipEditor';
import { Clip } from './Clip';
import { ClipHandles } from './ClipHandles';
import { ClipContextMenu } from './ClipContextMenu';
import { useProjectStore } from '../store/projectStore';

// =============================================================================
// Props
// =============================================================================

interface TimelineWithClipEditingProps {
  trackId: string;
  trackIndex: number;
  trackY: number;
  trackHeight: number;
  pixelsPerBeat: number;
  tempo: number;
  playheadBeat: number;
  isPlaying: boolean;
  viewportStart: number;
  viewportEnd: number;
}

// =============================================================================
// Component
// =============================================================================

export function TimelineWithClipEditing({
  trackId,
  trackIndex,
  trackY,
  trackHeight,
  pixelsPerBeat,
  tempo,
  playheadBeat,
  isPlaying,
  viewportStart,
  viewportEnd,
}: TimelineWithClipEditingProps) {
  // Refs
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // Store
  const {
    clips,
    selectedClipIds,
    currentTool,
    contextMenu,
    selectClip,
    deselectClip,
    deselectAllClips,
    toggleClipSelection,
    moveClip,
    moveSelectedClips,
    updateClip,
    splitClip,
    splitClipAtPlayhead,
    duplicateClip,
    duplicateSelectedClips,
    deleteClip,
    updateClipFade,
    stretchClip,
    setClipPlaybackRate,
    setClipPitch,
    reverseClip,
    renameClip,
    setClipColor,
    toggleClipMute,
    showContextMenu,
    hideContextMenu,
    setCurrentTool,
  } = useProjectStore();

  // Local state
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);

  // Get clips for this track
  const trackClips = useMemo(() =>
    clips.filter(c => c.trackId === trackId),
    [clips, trackId]
  );

  // Clip editor instance
  const clipEditor = useMemo(() =>
    createClipEditor(pixelsPerBeat, tempo),
    [pixelsPerBeat, tempo]
  );

  // Update snap division based on zoom
  useEffect(() => {
    clipEditor.updateSnapDivisionForZoom(pixelsPerBeat);
  }, [clipEditor, pixelsPerBeat]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === 'Shift') setIsShiftPressed(true);

      // Tool shortcuts (matching ToolsMenu.tsx)
      switch (e.key.toLowerCase()) {
        case 'a':
          setCurrentTool('pointer');
          break;
        case 'p':
          setCurrentTool('pencil');
          break;
        case 'e':
          setCurrentTool('erase');
          break;
        case 't':
          setCurrentTool('text');
          break;
        case 's':
          setCurrentTool('scissors');
          break;
        case 'g':
          setCurrentTool('glue');
          break;
        case 'o':
          setCurrentTool('solo');
          break;
        case 'm':
          setCurrentTool('mute');
          break;
        case 'z':
          setCurrentTool('zoom');
          break;
        case 'f':
          setCurrentTool('fade');
          break;
        case 'q':
          setCurrentTool('automation-select');
          break;
        case 'w':
          setCurrentTool('automation-curve');
          break;
        case 'r':
          setCurrentTool('marquee');
          break;
        case 'x':
          setCurrentTool('flex');
          break;
      }

      // Non-letter shortcuts
      switch (e.key) {
        case 'Delete':
        case 'Backspace': {
          const { marqueeSelection, setMarqueeSelection } = useProjectStore.getState();
          if (currentTool === 'marquee' && marqueeSelection && marqueeSelection.clipIds.length > 0) {
            marqueeSelection.clipIds.forEach(id => deleteClip(id));
            setMarqueeSelection(null);
          } else {
            selectedClipIds.forEach(id => deleteClip(id));
          }
          break;
        }
        case 'd':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            duplicateSelectedClips();
          }
          break;
        case 'Escape':
          deselectAllClips();
          hideContextMenu();
          useProjectStore.getState().setMarqueeSelection(null);
          break;
      }

      // Marquee tool shortcuts
      if (currentTool === 'marquee') {
        const { marqueeSelection, setLocators, movePlayhead, playing, setMarqueeSelection } = useProjectStore.getState();
        if (marqueeSelection) {
          switch (e.key.toLowerCase()) {
            case 's': {
              e.preventDefault();
              const clips = useProjectStore.getState().clips;
              marqueeSelection.clipIds.forEach(cid => {
                const clip = clips.find(c => c.id === cid);
                if (!clip) return;
                const clipEnd = clip.start + clip.duration;
                if (marqueeSelection.startBeat > clip.start && marqueeSelection.startBeat < clipEnd) {
                  splitClip(clip.id, marqueeSelection.startBeat);
                }
                if (marqueeSelection.endBeat > clip.start && marqueeSelection.endBeat < clipEnd) {
                  splitClip(clip.id, marqueeSelection.endBeat);
                }
              });
              break;
            }
            case '/': {
              e.preventDefault();
              setLocators(marqueeSelection.startBeat, marqueeSelection.endBeat);
              break;
            }
            case 'Enter': {
              e.preventDefault();
              movePlayhead(marqueeSelection.startBeat);
              if (!playing) {
                const { play } = useProjectStore.getState();
                play();
              }
              break;
            }
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setCurrentTool, deleteClip, duplicateSelectedClips, deselectAllClips, hideContextMenu, splitClip, currentTool]);

  // =============================================================================
  // Track Event Handlers
  // =============================================================================

  const handleTrackPointerDown = useCallback((e: React.PointerEvent) => {
    // Start selection box if clicking on empty area with select tool
    if ((currentTool === 'select' || currentTool === 'pointer') && e.target === trackRef.current) {
      const rect = trackRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setSelectionStart({ x, y });
      setSelectionBox({ x, y, width: 0, height: 0 });
      setIsSelecting(true);

      if (!isShiftPressed) {
        deselectAllClips();
      }

      (e.target as Element).setPointerCapture(e.pointerId);
    }
  }, [currentTool, isShiftPressed, deselectAllClips]);

  const handleTrackPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isSelecting || !selectionStart) return;

    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setSelectionBox({
      x: Math.min(selectionStart.x, x),
      y: Math.min(selectionStart.y, y),
      width: Math.abs(x - selectionStart.x),
      height: Math.abs(y - selectionStart.y),
    });
  }, [isSelecting, selectionStart]);

  const handleTrackPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isSelecting || !selectionBox) {
      setIsSelecting(false);
      setSelectionStart(null);
      return;
    }

    // Select clips in selection box
    const selectedInBox = clipEditor.getClipsInSelection(
      trackClips as any,
      selectionBox.x,
      selectionBox.y,
      selectionBox.width,
      selectionBox.height,
      new Map([[trackId, 0]]),
      trackHeight
    );

    for (const clipId of selectedInBox) {
      toggleClipSelection(clipId);
    }

    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionBox(null);

    (e.target as Element).releasePointerCapture(e.pointerId);
  }, [isSelecting, selectionBox, clipEditor, trackClips, trackId, trackHeight, selectClip]);

  // =============================================================================
  // Clip Handlers
  // =============================================================================

  const handleClipSelect = useCallback((clipId: string, addToSelection: boolean) => {
    if (addToSelection || isShiftPressed) {
      toggleClipSelection(clipId);
    } else {
      selectClip(clipId);
    }
  }, [isShiftPressed, toggleClipSelection, selectClip]);

  const handleClipMove = useCallback((clipId: string, newStartTime: number) => {
    if (selectedClipIds.includes(clipId) && selectedClipIds.length > 1) {
      // Move all selected clips relatively
      const clip = clips.find(c => c.id === clipId);
      if (clip) {
        const deltaBeats = newStartTime - clip.start;
        moveSelectedClips(deltaBeats);
      }
    } else {
      moveClip(clipId, newStartTime);
    }
  }, [selectedClipIds, clips, moveSelectedClips, moveClip]);

  const handleClipTrim = useCallback((clipId: string, edge: 'left' | 'right', newDuration: number, newStartTime?: number) => {
    if (edge === 'left' && newStartTime !== undefined) {
      updateClip(clipId, { start: newStartTime, duration: newDuration });
    } else {
      updateClip(clipId, { duration: newDuration });
    }
  }, [updateClip]);

  const handleClipFadeUpdate = useCallback((clipId: string, fadeType: 'in' | 'out', duration: number) => {
    updateClipFade(clipId, fadeType, { duration });
  }, [updateClipFade]);

  const handleClipStretch = useCallback((clipId: string, newDuration: number, newPlaybackRate: number) => {
    stretchClip(clipId, newDuration, newPlaybackRate);
  }, [stretchClip]);

  const handleClipContextMenu = useCallback((x: number, y: number, clipId: string) => {
    showContextMenu(x, y, clipId);
  }, [showContextMenu]);

  const handleClipDoubleClick = useCallback((clipId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (clip) {
      selectClip(clipId);
    }
  }, [clips, selectClip]);

  // =============================================================================
  // Context Menu Handlers
  // =============================================================================

  const handleContextMenuSplit = useCallback((clipId: string, splitTime: number) => {
    splitClip(clipId, splitTime);
    hideContextMenu();
  }, [splitClip, hideContextMenu]);

  const handleContextMenuDuplicate = useCallback((clipId: string) => {
    duplicateClip(clipId);
    hideContextMenu();
  }, [duplicateClip, hideContextMenu]);

  const handleContextMenuDelete = useCallback((clipId: string) => {
    deleteClip(clipId);
    hideContextMenu();
  }, [deleteClip, hideContextMenu]);

  const handleContextMenuReverse = useCallback((clipId: string) => {
    reverseClip(clipId);
    hideContextMenu();
  }, [reverseClip, hideContextMenu]);

  const handleContextMenuNormalize = useCallback((_clipId: string) => {
    // Audio normalization not yet implemented
    hideContextMenu();
  }, [hideContextMenu]);

  const handleContextMenuRename = useCallback((clipId: string) => {
    const newName = prompt('Enter new name:');
    if (newName) {
      renameClip(clipId, newName);
    }
    hideContextMenu();
  }, [renameClip, hideContextMenu]);

  const handleContextMenuToggleMute = useCallback((clipId: string) => {
    toggleClipMute(clipId);
    hideContextMenu();
  }, [toggleClipMute, hideContextMenu]);

  const handleContextMenuSetColor = useCallback((clipId: string, color: string) => {
    setClipColor(clipId, color);
  }, [setClipColor]);

  // Get context menu clip
  const contextMenuClip = useMemo(() =>
    contextMenu.clipId ? clips.find(c => c.id === contextMenu.clipId) : undefined,
    [contextMenu.clipId, clips]
  );

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <>
      {/* Track lane */}
      <div
        ref={trackRef}
        className="absolute w-full"
        style={{
          top: trackY,
          height: trackHeight,
          backgroundColor: trackIndex % 2 === 0 ? 'rgba(30,30,30,0.5)' : 'rgba(40,40,40,0.5)',
        }}
        onPointerDown={handleTrackPointerDown}
        onPointerMove={handleTrackPointerMove}
        onPointerUp={handleTrackPointerUp}
      >
        {/* Grid lines */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: '100%', height: '100%' }}
        >
          {/* Draw vertical grid lines */}
          {Array.from({ length: Math.ceil((viewportEnd - viewportStart) * 4) }, (_, i) => {
            const beat = Math.floor(viewportStart) + i * 0.25;
            const x = (beat - viewportStart) * pixelsPerBeat;
            if (x < 0 || x > 10000) return null;

            const isBar = beat % 4 === 0;
            const isBeat = beat % 1 === 0;

            return (
              <line
                key={beat}
                x1={x}
                y1={0}
                x2={x}
                y2={trackHeight}
                stroke={isBar ? 'rgba(255,255,255,0.15)' : isBeat ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'}
                strokeWidth={isBar ? 1 : 0.5}
              />
            );
          })}
        </svg>

        {/* Clips */}
        {trackClips.map(clip => (
          <Clip
            key={clip.id}
            clip={clip as ClipType}
            trackY={0}
            trackHeight={trackHeight}
            pixelsPerBeat={pixelsPerBeat}
            tempo={tempo}
            isSelected={selectedClipIds.includes(clip.id)}
            isMultiSelected={selectedClipIds.length > 1 && selectedClipIds.includes(clip.id)}
            currentTool={currentTool as EditTool}
            playheadBeat={playheadBeat}
            viewportStart={viewportStart}
            viewportEnd={viewportEnd}
            onSelect={handleClipSelect}
            onDeselect={deselectClip}
            onMove={handleClipMove}
            onTrim={handleClipTrim}
            onFadeUpdate={handleClipFadeUpdate}
            onStretch={handleClipStretch}
            onContextMenu={handleClipContextMenu}
            onDoubleClick={handleClipDoubleClick}
          />
        ))}

        {/* Selection box */}
        {selectionBox && (
          <div
            className="absolute border-2 border-blue-400 bg-blue-400/10 pointer-events-none"
            style={{
              left: selectionBox.x,
              top: selectionBox.y,
              width: selectionBox.width,
              height: selectionBox.height,
            }}
          />
        )}

        {/* Track border */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-700" />
      </div>

      {/* Context Menu */}
      <ClipContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        clipId={contextMenu.clipId}
        clip={contextMenuClip as ClipType | undefined}
        playheadBeat={playheadBeat}
        onSplit={handleContextMenuSplit}
        onDuplicate={handleContextMenuDuplicate}
        onDelete={handleContextMenuDelete}
        onReverse={handleContextMenuReverse}
        onNormalize={handleContextMenuNormalize}
        onRename={handleContextMenuRename}
        onToggleMute={handleContextMenuToggleMute}
        onSetColor={handleContextMenuSetColor}
        onLock={(id) => { console.warn('Clip lock not implemented'); hideContextMenu(); }}
        onUnlock={(id) => { console.warn('Clip unlock not implemented'); hideContextMenu(); }}
        onClose={hideContextMenu}
      />
    </>
  );
}

export default TimelineWithClipEditing;
