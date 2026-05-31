/**
 * projectSync.ts
 * Bridge layer between midiStore (editing) and projectStore (persistence)
 * 
 * Architecture:
 * UI → midiStore → projectSync → projectStore
 * 
 * Responsibilities:
 * - Load notes from projectStore → midiStore
 * - Save notes from midiStore → projectStore
 * - Handle multi-clip link modes (single, selected, folder, project)
 * - Track active clip for highlighting
 * - Batch updates for performance
 */

import { useMidiStore } from '@/store/midiStore';
import { useProjectStore } from '@/store/projectStore';
import type { Clip } from '@/models/Clip';
import type { MidiNote } from '@/engine/midi/types';

export type PianoRollLinkMode = 'single' | 'selected' | 'folder' | 'project';

export interface SyncedNote extends MidiNote {
  clipId: string;
  trackId: string;
  isActive: boolean;
}

export interface ProjectSyncState {
  linkMode: PianoRollLinkMode;
  activeClipId: string | null;
  focusedClipId: string | null;
  syncedNotes: SyncedNote[];
  sourceClipIds: string[];
}

// =============================================================================
// Note Transformation
// =============================================================================

/**
 * Convert projectStore Clip to midiStore notes
 */
function clipToNotes(
  clip: Clip,
  isActive: boolean,
  trackId: string
): SyncedNote[] {
  if (clip.type !== 'midi' || !clip.notes) return [];
  
  return clip.notes.map((note) => ({
    id: note.id,
    pitch: note.pitch,
    startBeat: note.start,
    duration: note.duration,
    velocity: note.velocity,
    selected: false,
    clipId: clip.id,
    trackId,
    isActive,
  }));
}

/**
 * Convert midiStore note back to projectStore format
 */
function noteToClipFormat(note: SyncedNote): {
  id: string;
  pitch: number;
  velocity: number;
  start: number;
  duration: number;
} {
  return {
    id: note.id,
    pitch: note.pitch,
    velocity: note.velocity,
    start: note.startBeat,
    duration: note.duration,
  };
}

// =============================================================================
// Multi-Clip Loading
// =============================================================================

/**
 * Get clips to display based on link mode
 */
function getClipsForLinkMode(
  linkMode: PianoRollLinkMode,
  projectStore: ReturnType<typeof useProjectStore.getState>
): Array<{ clip: Clip; trackId: string; isActive: boolean }> {
  const { 
    clips, 
    selectedClipIds, 
    pianoRollFocusClipId,
    tracks 
  } = projectStore;

  const midiClips = clips.filter((c): c is Clip & { type: 'midi' } => 
    c.type === 'midi'
  );

  switch (linkMode) {
    case 'single': {
      const focusClip = pianoRollFocusClipId 
        ? midiClips.find(c => c.id === pianoRollFocusClipId)
        : midiClips.find(c => selectedClipIds.includes(c.id));
      
      if (!focusClip) return [];
      return [{ clip: focusClip, trackId: focusClip.trackId, isActive: true }];
    }

    case 'selected': {
      return selectedClipIds
        .map(id => midiClips.find(c => c.id === id))
        .filter((c): c is typeof midiClips[number] => !!c)
        .map((clip, index) => ({
          clip,
          trackId: clip.trackId,
          isActive: index === 0, // First clip is active
        }));
    }

    case 'folder': {
      const focusClip = pianoRollFocusClipId 
        ? midiClips.find(c => c.id === pianoRollFocusClipId)
        : midiClips.find(c => selectedClipIds.includes(c.id));
      
      if (!focusClip) return [];
      
      // Get all clips from the same track
      const trackId = focusClip.trackId;
      return midiClips
        .filter(c => c.trackId === trackId)
        .map((clip, index) => ({
          clip,
          trackId,
          isActive: clip.id === focusClip.id,
        }));
    }

    case 'project': {
      const focusClip = pianoRollFocusClipId 
        ? midiClips.find(c => c.id === pianoRollFocusClipId)
        : midiClips.find(c => selectedClipIds.includes(c.id));
      
      return midiClips.map((clip, index) => ({
        clip,
        trackId: clip.trackId,
        isActive: focusClip ? clip.id === focusClip.id : index === 0,
      }));
    }

    default:
      return [];
  }
}

// =============================================================================
// Sync Operations
// =============================================================================

let isSyncing = false;
let pendingSave = false;

/**
 * Load notes from projectStore into midiStore
 * Called when:
 * - Opening piano roll
 * - Changing link mode
 * - Selecting different clips
 */
export function loadFromProjectStore(
  linkMode: PianoRollLinkMode = 'single',
  activeClipId: string | null = null
): void {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const projectStore = useProjectStore.getState();
    const midiStore = useMidiStore.getState();

    // Get clips based on link mode
    const clipsToLoad = getClipsForLinkMode(linkMode, projectStore);

    if (clipsToLoad.length === 0) {
      midiStore.closeClip();
      isSyncing = false;
      return;
    }

    // Merge all notes with clip tagging
    const allNotes: SyncedNote[] = clipsToLoad.flatMap(({ clip, trackId, isActive }) =>
      clipToNotes(clip, isActive, trackId)
    );

    // Determine primary clip for editing
    const primaryClip = clipsToLoad.find(c => c.isActive) || clipsToLoad[0];

    // Load into midiStore
    // Create a virtual "merged" clip for multi-clip editing
    const mergedClipId = `merged-${primaryClip.clip.id}`;
    
    // Clear existing clips and create merged clip
    midiStore.clips.clear();
    
    // Create virtual clip containing all notes
    const virtualClip = {
      id: mergedClipId,
      trackId: primaryClip.trackId,
      startBeat: 0,
      length: Math.max(...clipsToLoad.map(c => c.clip.startBeat + c.clip.duration)),
      notes: allNotes,
      color: primaryClip.clip.color || '#3B82F6',
      name: clipsToLoad.length === 1 
        ? primaryClip.clip.name 
        : `${clipsToLoad.length} Regions`,
      isModified: false,
    };

    midiStore.clips.set(mergedClipId, virtualClip);
    midiStore.currentClipId = mergedClipId;
    
    // Store metadata for later sync back
    (midiStore as any)._syncMetadata = {
      linkMode,
      sourceClipIds: clipsToLoad.map(c => c.clip.id),
      activeClipId: primaryClip.clip.id,
    };

    // Reset selection
    midiStore.selectedNoteIds.clear();

  } finally {
    isSyncing = false;
  }
}

/**
 * Save notes from midiStore back to projectStore
 * Called when:
 * - Notes are modified
 * - Closing piano roll
 * - Explicit save action
 */
export function saveToProjectStore(): void {
  if (isSyncing) {
    pendingSave = true;
    return;
  }
  
  isSyncing = true;
  
  try {
    const midiStore = useMidiStore.getState();
    const projectStore = useProjectStore.getState();

    const syncMetadata = (midiStore as any)._syncMetadata as {
      linkMode: PianoRollLinkMode;
      sourceClipIds: string[];
      activeClipId: string;
    } | undefined;

    if (!syncMetadata) {
      isSyncing = false;
      return;
    }

    const currentClip = midiStore.getCurrentClip();
    if (!currentClip) {
      isSyncing = false;
      return;
    }

    // Group notes by clipId
    const notesByClip = new Map<string, SyncedNote[]>();
    
    for (const note of currentClip.notes as SyncedNote[]) {
      const clipId = note.clipId || syncMetadata.activeClipId;
      if (!notesByClip.has(clipId)) {
        notesByClip.set(clipId, []);
      }
      notesByClip.get(clipId)!.push(note);
    }

    // Update each source clip
    Array.from(notesByClip.entries()).forEach(([clipId, notes]) => {
      const clip = projectStore.clips.find(c => c.id === clipId);
      if (!clip || clip.type !== 'midi') return;

      // Convert notes back to project format
      const updatedNotes = notes.map(noteToClipFormat);

      // Update the clip in projectStore
      projectStore.updateClip(clipId, {
        notes: updatedNotes,
      });
    });

    // Handle notes that belong to clips not in our source set
    // (e.g., notes moved between clips in multi-clip mode)
    const currentSourceIds = new Set(syncMetadata.sourceClipIds);
    
    for (const note of currentClip.notes as SyncedNote[]) {
      if (!currentSourceIds.has(note.clipId)) {
        // Note was moved to a different clip - add it there
        const targetClip = projectStore.clips.find(c => c.id === note.clipId);
        if (targetClip && targetClip.type === 'midi') {
          const existingNotes = targetClip.notes || [];
          const newNote = noteToClipFormat(note);
          
          // Check if note already exists
          const exists = existingNotes.some(n => n.id === newNote.id);
          if (!exists) {
            projectStore.updateClip(note.clipId, {
              notes: [...existingNotes, newNote],
            });
          }
        }
      }
    }

    // Mark as saved
    currentClip.isModified = false;

  } finally {
    isSyncing = false;
    
    // Handle pending save
    if (pendingSave) {
      pendingSave = false;
      setTimeout(saveToProjectStore, 0);
    }
  }
}

/**
 * Subscribe to midiStore changes and auto-save
 */
export function subscribeToMidiChanges(): () => void {
  let lastModified = false;
  
  const unsubscribe = useMidiStore.subscribe(
    (state) => state.clips,
    (clips) => {
      // Check if any clip is modified
      const isModified = Array.from(clips.values()).some(c => c.isModified);
      
      if (isModified && !lastModified) {
        // Schedule save
        scheduleSave();
      }
      
      lastModified = isModified;
    }
  );

  return unsubscribe;
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  // Debounce saves by 100ms
  saveTimeout = setTimeout(() => {
    saveToProjectStore();
    saveTimeout = null;
  }, 100);
}

// =============================================================================
// Link Mode Management
// =============================================================================

/**
 * Set the piano roll link mode
 */
export function setLinkMode(mode: PianoRollLinkMode): void {
  const projectStore = useProjectStore.getState();
  projectStore.setPianoRollLinkMode(mode);
  
  // Reload with new mode
  loadFromProjectStore(mode, projectStore.pianoRollFocusClipId);
}

/**
 * Set the focused clip (for single/folder modes)
 */
export function setFocusedClip(clipId: string | null): void {
  const projectStore = useProjectStore.getState();
  projectStore.setPianoRollFocusClipId(clipId);
  
  // Reload with new focus
  loadFromProjectStore(projectStore.pianoRollLinkMode, clipId);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get current sync state
 */
export function getSyncState(): ProjectSyncState {
  const midiStore = useMidiStore.getState();
  const projectStore = useProjectStore.getState();
  
  const syncMetadata = (midiStore as any)._syncMetadata as {
    linkMode: PianoRollLinkMode;
    sourceClipIds: string[];
    activeClipId: string;
  } | undefined;

  const currentClip = midiStore.getCurrentClip();
  
  return {
    linkMode: syncMetadata?.linkMode || projectStore.pianoRollLinkMode || 'single',
    activeClipId: syncMetadata?.activeClipId || null,
    focusedClipId: projectStore.pianoRollFocusClipId,
    syncedNotes: (currentClip?.notes as SyncedNote[]) || [],
    sourceClipIds: syncMetadata?.sourceClipIds || [],
  };
}

/**
 * Check if there are unsaved changes
 */
export function hasUnsavedChanges(): boolean {
  const midiStore = useMidiStore.getState();
  return Array.from(midiStore.clips.values()).some(c => c.isModified);
}

/**
 * Force immediate save
 */
export function flushSync(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  saveToProjectStore();
}

// =============================================================================
// React Hook
// =============================================================================

import { useEffect, useCallback, useRef } from 'react';

export interface UseProjectSyncOptions {
  linkMode?: PianoRollLinkMode;
  autoSave?: boolean;
}

/**
 * React hook for project sync
 */
export function useProjectSync(options: UseProjectSyncOptions = {}) {
  const { linkMode = 'single', autoSave = true } = options;
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Load on mount
  useEffect(() => {
    loadFromProjectStore(linkMode);
    
    if (autoSave) {
      unsubscribeRef.current = subscribeToMidiChanges();
    }

    return () => {
      // Flush any pending saves on unmount
      flushSync();
      unsubscribeRef.current?.();
    };
  }, [linkMode, autoSave]);

  // Manual save callback
  const save = useCallback(() => {
    flushSync();
  }, []);

  // Reload callback
  const reload = useCallback(() => {
    loadFromProjectStore(linkMode);
  }, [linkMode]);

  return {
    save,
    reload,
    hasUnsavedChanges,
  };
}
