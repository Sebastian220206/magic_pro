'use client';

/**
 * ProjectPianoRollAdapter.tsx
 * 
 * Thin adapter layer that connects the modular PianoRoll to the projectStore.
 * 
 * Architecture:
 * projectStore (persistence) → projectSync (bridge) → midiStore (editing) → PianoRoll (UI)
 * 
 * Responsibilities:
 * - Read selected clip(s) from projectStore
 * - Sync notes to midiStore via projectSync
 * - Render modular PianoRoll component
 * - Auto-save changes back to projectStore
 */

import React, { useEffect, useMemo, useCallback } from 'react';
import { PianoRoll } from '../midi/PianoRoll';
import { useProjectSync, type PianoRollLinkMode } from '@/engine/pianoRoll/projectSync';
import { useProjectStore } from '@/store/projectStore';
import { useMidiStore } from '@/store/midiStore';

export interface ProjectPianoRollAdapterProps {
  /** Width of the piano roll editor */
  width?: number;
  /** Height of the piano roll editor */
  height?: number;
  /** Link mode for multi-clip editing */
  linkMode?: PianoRollLinkMode;
  /** Enable auto-save to projectStore */
  autoSave?: boolean;
}

export function ProjectPianoRollAdapter({
  width = 800,
  height = 500,
  linkMode = 'single',
  autoSave = true,
}: ProjectPianoRollAdapterProps) {
  // Initialize project sync (loads notes from projectStore → midiStore)
  const { save, hasUnsavedChanges } = useProjectSync({
    linkMode,
    autoSave,
  });

  // Get current state from both stores
  const projectStore = useProjectStore();
  const midiStore = useMidiStore();

  // Determine the clipId to pass to PianoRoll
  // In multi-clip modes, we use a virtual merged clip
  const effectiveClipId = useMemo(() => {
    const currentClipId = midiStore.currentClipId;
    if (currentClipId) return currentClipId;

    // Fallback: find first selected MIDI clip
    const selectedClipIds = projectStore.selectedClipIds;
    const midiClips = projectStore.clips.filter(c => 
      c.type === 'midi' && selectedClipIds.includes(c.id)
    );
    
    return midiClips[0]?.id || '';
  }, [midiStore.currentClipId, projectStore.selectedClipIds, projectStore.clips]);

  // Sync projectStore link mode changes
  useEffect(() => {
    const projectLinkMode = projectStore.pianoRollLinkMode;
    if (projectLinkMode !== linkMode) {
      // projectSync handles the mode change
      // This effect just ensures consistency
    }
  }, [projectStore.pianoRollLinkMode, linkMode]);

  // Handle explicit save (e.g., Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [save]);

  // No MIDI clip selected state
  if (!effectiveClipId) {
    return (
      <div 
        className="flex items-center justify-center bg-gray-900 text-gray-500"
        style={{ width, height }}
      >
        <div className="text-center">
          <p className="text-sm font-medium">No MIDI Region Selected</p>
          <p className="text-xs text-gray-600 mt-1">
            Select a MIDI clip in the timeline to edit
          </p>
        </div>
      </div>
    );
  }

  const handleNoteOn = useCallback((pitch: number) => {
    const state = useProjectStore.getState();
    const targetTrackId = state.focusedTrackId ?? undefined;
    if (!targetTrackId) return;
    state.triggerNote(pitch, 100, targetTrackId);
  }, []);

  const handleNoteOff = useCallback((pitch: number) => {
    const state = useProjectStore.getState();
    state.releaseNote(pitch, state.focusedTrackId ?? undefined);
  }, []);

  return (
    <div className="relative">
      {/* Unsaved changes indicator */}
      {hasUnsavedChanges() && (
        <div className="absolute top-2 right-2 z-50">
          <div className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded border border-yellow-500/30">
            Unsaved changes
          </div>
        </div>
      )}
      
      {/* Main piano roll editor */}
      <PianoRoll
        clipId={effectiveClipId}
        width={width}
        height={height}
        onNoteOn={handleNoteOn}
        onNoteOff={handleNoteOff}
      />
    </div>
  );
}

export default ProjectPianoRollAdapter;
