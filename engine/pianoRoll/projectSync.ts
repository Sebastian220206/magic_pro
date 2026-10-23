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

/** Timeline position of a clip, tolerating the `start` / `startBeat` aliases. */
export function clipStartBeat(clip: Pick<Clip, 'start' | 'startBeat'>): number {
  const raw = clip.startBeat ?? clip.start ?? 0;
  return Number.isFinite(raw) ? raw : 0;
}

/**
 * Convert projectStore Clip to midiStore notes.
 *
 * Notes are stored **clip-relative** in projectStore but the piano roll draws
 * everything — grid, bar numbers, loop markers and the playhead — in absolute
 * timeline beats. They are therefore translated to absolute here and back again
 * on save. Without this, notes in a region that does not begin at bar 1 render
 * shifted left by the region's start, and the playhead sweeps past them at the
 * wrong time.
 */
function clipToNotes(
  clip: Clip,
  isActive: boolean,
  trackId: string
): SyncedNote[] {
  if (clip.type !== 'midi' || !clip.notes) return [];

  const offset = clipStartBeat(clip);

  return clip.notes.map((note) => ({
    id: note.id,
    pitch: note.pitch,
    startBeat: offset + note.start,
    duration: note.duration,
    velocity: note.velocity,
    selected: false,
    clipId: clip.id,
    trackId,
    isActive,
  }));
}

/**
 * Convert a midiStore note back to projectStore format.
 *
 * `clipStart` is the timeline position of the owning clip; the note's absolute
 * beat is rebased to clip-relative for storage.
 */
function noteToClipFormat(note: SyncedNote, clipStart: number): {
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
    // Never allow a negative offset: dragging a note left of its region start
    // would otherwise persist as a position before the clip.
    start: Math.max(0, note.startBeat - clipStart),
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

    // Create virtual clip containing all notes
    const mergedClipId = `merged-${primaryClip.clip.id}`;
    
    // The virtual clip spans absolute timeline beats, matching the notes it
    // holds and the grid the editor draws.
    const virtualClip = {
      id: mergedClipId,
      trackId: primaryClip.trackId,
      startBeat: Math.min(...clipsToLoad.map(c => clipStartBeat(c.clip))),
      durationBeats: Math.max(...clipsToLoad.map(c => clipStartBeat(c.clip) + c.clip.duration)),
      chunks: [],
      notes: allNotes,
      color: primaryClip.clip.color || '#3B82F6',
      name: clipsToLoad.length === 1 
        ? primaryClip.clip.name 
        : `${clipsToLoad.length} Regions`,
      isModified: false,
    } as any;

    // Load CC lanes from primary clip's ccData
    const ccLanesMap = new Map<number, any>();
    if (primaryClip.clip.ccData) {
      const offset = clipStartBeat(primaryClip.clip);
      Object.entries(primaryClip.clip.ccData).forEach(([ctrlStr, pts]) => {
        const ctrl = Number(ctrlStr);
        ccLanesMap.set(ctrl, {
          id: `cc-${ctrl}`,
          controller: ctrl,
          name: `CC ${ctrl}`,
          color: '#3B82F6',
          points: pts.map(p => ({ beat: offset + p.time, value: p.value })),
          visible: true,
          height: 80,
        });
      });
    }

    // Use setState to comply with Immer middleware (state is frozen and cannot be mutated directly)
    useMidiStore.setState({
      clips: new Map<string, any>().set(mergedClipId, virtualClip),
      currentClipId: mergedClipId,
      selectedNoteIds: new Set(),
      ...(ccLanesMap.size > 0 ? { ccLanes: ccLanesMap } : {}),
      _syncMetadata: {
        linkMode,
        sourceClipIds: clipsToLoad.map(c => c.clip.id),
        activeClipId: primaryClip.clip.id,
      },
    } as any);

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

    // Group notes by clipId (seed with all sourceClipIds so deleting the last note updates the clip to [])
    const notesByClip = new Map<string, SyncedNote[]>();
    for (const srcId of syncMetadata.sourceClipIds) {
      notesByClip.set(srcId, []);
    }
    
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

      // Rebase absolute editor beats back to clip-relative storage.
      const offset = clipStartBeat(clip);
      const updatedNotes = notes.map(note => noteToClipFormat(note, offset));

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
          const newNote = noteToClipFormat(note, clipStartBeat(targetClip));
          
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

    // Save CC lanes back to active/primary clip
    if (midiStore.ccLanes && midiStore.ccLanes.size > 0 && syncMetadata.activeClipId) {
      const activeClip = projectStore.clips.find(c => c.id === syncMetadata.activeClipId);
      if (activeClip && activeClip.type === 'midi') {
        const offset = clipStartBeat(activeClip);
        const ccData: Record<number, Array<{ time: number; value: number }>> = {};
        midiStore.ccLanes.forEach((lane, ctrl) => {
          if (lane.points && lane.points.length > 0) {
            ccData[ctrl] = lane.points.map(p => ({
              time: Math.max(0, p.beat - offset),
              value: p.value
            })).sort((a, b) => a.time - b.time);
          }
        });
        projectStore.updateClip(syncMetadata.activeClipId, { ccData });
      }
    }

    // Push snapshot into project undo history so Ctrl+Z from main timeline undoes piano roll edits
    projectStore.saveHistorySnapshot();

    // Mark as saved (use setState because midiStore uses Immer middleware - state is frozen)
    if (currentClip.id) {
      useMidiStore.setState({
        clips: new Map(useMidiStore.getState().clips).set(currentClip.id, {
          ...currentClip,
          isModified: false,
        }),
      } as any);
    }

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
/**
 * Mirror notes recorded into projectStore while the transport rolls.
 *
 * `loadFromProjectStore` only runs on mount and selection change, so a take
 * recorded into the focused clip never appears in an already-open piano roll
 * — and the release that lengthens each note lands there equally silently.
 * This subscribes the other direction: while `recording` is true, notes that
 * appear in a sync-source clip are appended to the merged editor clip
 * (clip-relative → absolute beats), and lengthened durations grow with them.
 *
 * Only additive: notes are never removed or re-pitched here, so an edit made
 * in the piano roll mid-take cannot be reverted by the mirror. `isModified`
 * is deliberately left alone — these notes already live in projectStore, so
 * there is nothing to save back, and marking modified would bounce them
 * through the autosave every 100ms.
 */
export function subscribeToProjectRecording(): () => void {
  return useProjectStore.subscribe((state, prev) => {
    const prevClips = (prev as unknown as { clips?: unknown }).clips;
    if (state.clips === prevClips || !state.recording) return;

    const midi = useMidiStore.getState();
    const meta = (midi as unknown as { _syncMetadata?: { sourceClipIds?: string[] } })._syncMetadata;
    if (!meta?.sourceClipIds?.length) return;
    const sources = new Set(meta.sourceClipIds);
    if (!midi.getCurrentClip()) return;

    useMidiStore.setState((s) => {
      const merged = s.clips.get(s.currentClipId ?? '');
      if (!merged) return;
      for (const clip of state.clips) {
        if (!sources.has(clip.id) || clip.type !== 'midi' || !clip.notes) continue;
        const offset = clipStartBeat(clip);
        for (const n of clip.notes) {
          const existing = (merged.notes as SyncedNote[]).find((m) => m.id === n.id);
          if (!existing) {
            (merged.notes as SyncedNote[]).push({
              id: n.id,
              pitch: n.pitch,
              startBeat: offset + (n.start ?? 0),
              duration: n.duration,
              velocity: n.velocity,
              selected: false,
              clipId: clip.id,
              trackId: clip.trackId,
              isActive: true,
            });
          } else if (n.duration > existing.duration) {
            existing.duration = n.duration;
          }
        }
      }
    });
  });
}

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
    const unsubRecording = subscribeToProjectRecording();

    return () => {
      // Flush any pending saves on unmount
      flushSync();
      unsubscribeRef.current?.();
      unsubRecording();
    };
  }, [linkMode, autoSave]);

  // Reload when selected clip changes
  useEffect(() => {
    let prevSelected = useProjectStore.getState().selectedClipIds;
    const unsub = useProjectStore.subscribe(() => {
      const current = useProjectStore.getState().selectedClipIds;
      if (JSON.stringify(current) !== JSON.stringify(prevSelected)) {
        prevSelected = current;
        loadFromProjectStore(linkMode);
      }
    });
    return unsub;
  }, [linkMode]);

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
