/**
 * Zustand Clip Editing Actions
 * 
 * State management for clip editing operations.
 * All actions are immutable and support undo/redo via history snapshots.
 */

import { StateCreator } from 'zustand';
import { produce } from 'immer';
import {
  Clip,
  ClipSelectionState,
  EditTool,
  ContextMenuState,
  FadeSettings,
} from '../engine/timeline/types';
import {
  splitClip,
  duplicateClip,
  duplicateClips,
  moveClip,
  moveClipsRelative,
  updateFade,
  reverseClip,
  normalizeClip,
  renameClip,
  toggleClipMute,
  setClipColor,
  stretchClip,
  pitchShift,
} from '../engine/timeline/clipTools';

// =============================================================================
// State Types
// =============================================================================

export interface ClipEditingState {
  // Clip data
  clips: Clip[];
  
  // Selection state
  selectedClipIds: Set<string>;
  lastSelectedClipId: string | null;
  
  // Tool state
  currentTool: EditTool;
  
  // Context menu
  contextMenu: ContextMenuState;
  
  // Drag state (transient)
  isDragging: boolean;
  dragClipId: string | null;
  dragHandleType: 'left' | 'right' | 'body' | 'fadeIn' | 'fadeOut' | null;
  dragStartX: number;
  dragStartY: number;
  dragOriginalStartTime: number;
  dragOriginalDuration: number;
  dragOriginalOffset: number;
  
  // Multi-drag for selection
  multiDragStartPositions: Map<string, number>; // clipId -> original startTime
}

export interface ClipEditingActions {
  // Selection
  selectClip: (clipId: string, addToSelection?: boolean) => void;
  deselectClip: (clipId: string) => void;
  deselectAllClips: () => void;
  selectAllClipsOnTrack: (trackId: string) => void;
  toggleClipSelection: (clipId: string) => void;
  selectClipsInRange: (trackId: string, startBeat: number, endBeat: number) => void;
  
  // Clip operations
  addClip: (clip: Omit<Clip, 'id'>) => string;
  deleteClip: (clipId: string) => void;
  deleteSelectedClips: () => void;
  updateClip: (clipId: string, updates: Partial<Clip>) => void;
  moveClip: (clipId: string, newStartTime: number, newTrackId?: string) => void;
  moveSelectedClips: (deltaBeats: number, deltaTrackIndex?: number, trackIds?: string[]) => void;
  
  // Split
  splitClip: (clipId: string, splitTime: number) => void;
  splitClipAtPlayhead: (clipId: string, playheadBeat: number) => void;
  
  // Duplicate
  duplicateClip: (clipId: string, offsetBeats?: number) => string;
  duplicateSelectedClips: (offsetBeats?: number) => void;
  
  // Trim
  trimClip: (clipId: string, edge: 'left' | 'right', newDuration: number, newStartTime?: number) => void;
  trimClipToSelection: (clipId: string, rangeStart: number, rangeEnd: number) => void;
  
  // Fade
  updateClipFade: (clipId: string, fadeType: 'in' | 'out', settings: Partial<FadeSettings>) => void;
  
  // Stretch/Time
  stretchClip: (clipId: string, newDuration: number, newPlaybackRate: number) => void;
  setClipPlaybackRate: (clipId: string, playbackRate: number) => void;
  setClipPitch: (clipId: string, pitchOffset: number) => void;
  
  // Audio processing
  reverseClip: (clipId: string) => void;
  normalizeClip: (clipId: string) => void;
  
  // Properties
  renameClip: (clipId: string, newName: string) => void;
  setClipColor: (clipId: string, color: string) => void;
  toggleClipMute: (clipId: string) => void;
  muteSelectedClips: () => void;
  unmuteSelectedClips: () => void;
  
  // Tool switching
  setCurrentTool: (tool: EditTool) => void;
  
  // Context menu
  showContextMenu: (x: number, y: number, clipId: string) => void;
  hideContextMenu: () => void;
  
  // Drag operations (transient state)
  startDrag: (clipId: string, handleType: 'left' | 'right' | 'body' | 'fadeIn' | 'fadeOut', x: number, y: number) => void;
  updateDrag: (x: number, y: number) => void;
  endDrag: () => void;
  
  // Utilities
  getClipById: (clipId: string) => Clip | undefined;
  getSelectedClips: () => Clip[];
  getClipsOnTrack: (trackId: string) => Clip[];
  getClipsInTimeRange: (startBeat: number, endBeat: number) => Clip[];
}

export type ClipEditingSlice = ClipEditingState & ClipEditingActions;

// =============================================================================
// Initial State
// =============================================================================

const initialState: ClipEditingState = {
  clips: [],
  selectedClipIds: new Set(),
  lastSelectedClipId: null,
  currentTool: 'select',
  contextMenu: {
    visible: false,
    x: 0,
    y: 0,
    clipId: null,
  },
  isDragging: false,
  dragClipId: null,
  dragHandleType: null,
  dragStartX: 0,
  dragStartY: 0,
  dragOriginalStartTime: 0,
  dragOriginalDuration: 0,
  dragOriginalOffset: 0,
  multiDragStartPositions: new Map(),
};

// =============================================================================
// Slice Creator
// =============================================================================

export const createClipEditingSlice: StateCreator<ClipEditingSlice> = (set, get) => {
  const update = (fn: (state: ClipEditingSlice) => void) => set(produce(fn));
  return {
  ...initialState,

  // ==========================================================================
  // Selection Actions
  // ==========================================================================

  selectClip: (clipId, addToSelection = false) => {
    update(state => {
      if (addToSelection) {
        state.selectedClipIds.add(clipId);
      } else {
        state.selectedClipIds.clear();
        state.selectedClipIds.add(clipId);
      }
      state.lastSelectedClipId = clipId;
    });
  },

  deselectClip: (clipId) => {
    update(state => {
      state.selectedClipIds.delete(clipId);
      if (state.lastSelectedClipId === clipId) {
        // Find another selected clip
        const remaining = Array.from(state.selectedClipIds);
        state.lastSelectedClipId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
      }
    });
  },

  deselectAllClips: () => {
    update(state => {
      state.selectedClipIds.clear();
      state.lastSelectedClipId = null;
    });
  },

  selectAllClipsOnTrack: (trackId) => {
    update(state => {
      const trackClips = state.clips.filter(c => c.trackId === trackId);
      for (const clip of trackClips) {
        state.selectedClipIds.add(clip.id);
      }
      if (trackClips.length > 0) {
        state.lastSelectedClipId = trackClips[trackClips.length - 1].id;
      }
    });
  },

  toggleClipSelection: (clipId) => {
    update(state => {
      if (state.selectedClipIds.has(clipId)) {
        state.selectedClipIds.delete(clipId);
        if (state.lastSelectedClipId === clipId) {
          const remaining = Array.from(state.selectedClipIds);
          state.lastSelectedClipId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
        }
      } else {
        state.selectedClipIds.add(clipId);
        state.lastSelectedClipId = clipId;
      }
    });
  },

  selectClipsInRange: (trackId, startBeat, endBeat) => {
    update(state => {
      const rangeClips = state.clips.filter(
        c => c.trackId === trackId &&
             c.startTime < endBeat &&
             c.startTime + c.duration > startBeat
      );
      for (const clip of rangeClips) {
        state.selectedClipIds.add(clip.id);
      }
      if (rangeClips.length > 0) {
        state.lastSelectedClipId = rangeClips[rangeClips.length - 1].id;
      }
    });
  },

  // ==========================================================================
  // Clip CRUD Actions
  // ==========================================================================

  addClip: (clip) => {
    const id = `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newClip: Clip = {
      ...clip,
      id,
      fadeIn: clip.fadeIn || { duration: 0, curve: 'exponential', gain: 1 },
      fadeOut: clip.fadeOut || { duration: 0, curve: 'exponential', gain: 1 },
      playbackRate: clip.playbackRate ?? 1,
      pitchOffset: clip.pitchOffset ?? 0,
      stretchMode: clip.stretchMode || 'none',
      muted: clip.muted ?? false,
      loop: clip.loop ?? false,
    };

    update(state => {
      state.clips.push(newClip);
    });

    return id;
  },

  deleteClip: (clipId) => {
    update(state => {
      const index = state.clips.findIndex(c => c.id === clipId);
      if (index !== -1) {
        state.clips.splice(index, 1);
      }
      state.selectedClipIds.delete(clipId);
      if (state.lastSelectedClipId === clipId) {
        state.lastSelectedClipId = null;
      }
    });
  },

  deleteSelectedClips: () => {
    update(state => {
      state.clips = state.clips.filter(c => !state.selectedClipIds.has(c.id));
      state.selectedClipIds.clear();
      state.lastSelectedClipId = null;
    });
  },

  updateClip: (clipId, updates) => {
    update(state => {
      const clip = state.clips.find(c => c.id === clipId);
      if (clip) {
        Object.assign(clip, updates);
      }
    });
  },

  // ==========================================================================
  // Movement Actions
  // ==========================================================================

  moveClip: (clipId, newStartTime, newTrackId) => {
    update(state => {
      const clip = state.clips.find(c => c.id === clipId);
      if (clip) {
        const moved = moveClip(clip, newStartTime, newTrackId);
        Object.assign(clip, moved);
      }
    });
  },

  moveSelectedClips: (deltaBeats, deltaTrackIndex, trackIds) => {
    update(state => {
      const selectedClips = state.clips.filter(c => state.selectedClipIds.has(c.id));
      const movedClips = moveClipsRelative(selectedClips, deltaBeats, deltaTrackIndex, trackIds);

      for (const movedClip of movedClips) {
        const original = state.clips.find(c => c.id === movedClip.id);
        if (original) {
          original.startTime = movedClip.startTime;
          if (movedClip.trackId !== original.trackId) {
            original.trackId = movedClip.trackId;
          }
        }
      }
    });
  },

  // ==========================================================================
  // Split Actions
  // ==========================================================================

  splitClip: (clipId, splitTime) => {
    update(state => {
      const clipIndex = state.clips.findIndex(c => c.id === clipId);
      if (clipIndex === -1) return;

      const clip = state.clips[clipIndex];
      const result = splitClip(clip, splitTime);
      
      if (result) {
        const [leftClip, rightClip] = result;
        // Replace original with left clip
        state.clips[clipIndex] = leftClip;
        // Insert right clip after
        state.clips.splice(clipIndex + 1, 0, rightClip);

        // Update selection
        if (state.selectedClipIds.has(clipId)) {
          state.selectedClipIds.delete(clipId);
          state.selectedClipIds.add(rightClip.id); // Select the new right clip
        }
      }
    });
  },

  splitClipAtPlayhead: (clipId, playheadBeat) => {
    const clip = get().getClipById(clipId);
    if (clip && playheadBeat > clip.startTime && playheadBeat < clip.startTime + clip.duration) {
      get().splitClip(clipId, playheadBeat);
    }
  },

  // ==========================================================================
  // Duplicate Actions
  // ==========================================================================

  duplicateClip: (clipId, offsetBeats = 4) => {
    const clip = get().getClipById(clipId);
    if (!clip) return '';

    const duplicated = duplicateClip(clip, offsetBeats);
    
    update(state => {
      state.clips.push(duplicated);
    });

    return duplicated.id;
  },

  duplicateSelectedClips: (offsetBeats = 4) => {
    update(state => {
      const selectedClips = state.clips.filter(c => state.selectedClipIds.has(c.id));
      if (selectedClips.length === 0) return;

      const duplicated = duplicateClips(selectedClips, offsetBeats);
      
      // Add duplicated clips
      for (const clip of duplicated) {
        state.clips.push(clip);
      }

      // Select new clips
      state.selectedClipIds.clear();
      for (const clip of duplicated) {
        state.selectedClipIds.add(clip.id);
      }
      if (duplicated.length > 0) {
        state.lastSelectedClipId = duplicated[duplicated.length - 1].id;
      }
    });
  },

  // ==========================================================================
  // Trim Actions
  // ==========================================================================

  trimClip: (clipId, edge, newDuration, newStartTime) => {
    update(state => {
      const clip = state.clips.find(c => c.id === clipId);
      if (!clip) return;

      const offsetDelta = newStartTime !== undefined ? newStartTime - clip.startTime : 0;

      clip.duration = Math.max(0.1, newDuration);
      if (newStartTime !== undefined) {
        clip.startTime = newStartTime;
        clip.offset = (clip.offset || 0) + offsetDelta;
      }
    });
  },

  trimClipToSelection: (clipId, rangeStart, rangeEnd) => {
    update(state => {
      const clip = state.clips.find(c => c.id === clipId);
      if (!clip) return;

      const clipEnd = clip.startTime + clip.duration;
      
      if (clipEnd <= rangeStart || clip.startTime >= rangeEnd) return;

      const newStart = Math.max(clip.startTime, rangeStart);
      const newEnd = Math.min(clipEnd, rangeEnd);
      const offsetDelta = newStart - clip.startTime;

      clip.startTime = newStart;
      clip.duration = newEnd - newStart;
      clip.offset = (clip.offset || 0) + offsetDelta;
    });
  },

  // ==========================================================================
  // Fade Actions
  // ==========================================================================

  updateClipFade: (clipId, fadeType, settings) => {
    update(state => {
      const clip = state.clips.find(c => c.id === clipId);
      if (clip) {
        const updated = updateFade(clip, fadeType, settings);
        if (fadeType === 'in') {
          clip.fadeIn = updated.fadeIn;
        } else {
          clip.fadeOut = updated.fadeOut;
        }
      }
    });
  },

  // ==========================================================================
  // Stretch/Time Actions
  // ==========================================================================

  stretchClip: (clipId, newDuration, newPlaybackRate) => {
    update(state => {
      const clip = state.clips.find(c => c.id === clipId);
      if (clip) {
        const stretched = stretchClip(clip, { clipId, newDuration, newPlaybackRate });
        clip.duration = stretched.duration;
        clip.playbackRate = stretched.playbackRate;
        clip.stretchMode = stretched.stretchMode;
      }
    });
  },

  setClipPlaybackRate: (clipId, playbackRate) => {
    update(state => {
      const clip = state.clips.find(c => c.id === clipId);
      if (clip) {
        // Adjust duration to compensate
        const ratio = playbackRate / clip.playbackRate;
        clip.duration = clip.duration / ratio;
        clip.playbackRate = playbackRate;
      }
    });
  },

  setClipPitch: (clipId, pitchOffset) => {
    update(state => {
      const clip = state.clips.find(c => c.id === clipId);
      if (clip) {
        clip.pitchOffset = pitchOffset;
      }
    });
  },

  // ==========================================================================
  // Audio Processing Actions
  // ==========================================================================

  reverseClip: (clipId) => {
    update(state => {
      const clip = state.clips.find(c => c.id === clipId);
      if (clip) {
        const reversed = reverseClip(clip);
        clip.playbackRate = reversed.playbackRate;
      }
    });
  },

  normalizeClip: (clipId) => {
    update(state => {
      const clip = state.clips.find(c => c.id === clipId);
      if (clip) {
        // In real implementation, this would analyze and adjust gain
        // For now, we just mark it as normalized
        // clip.normalized = true;
      }
    });
  },

  // ==========================================================================
  // Property Actions
  // ==========================================================================

  renameClip: (clipId, newName) => {
    update(state => {
      const clip = state.clips.find(c => c.id === clipId);
      if (clip) {
        const renamed = renameClip(clip, newName);
        clip.name = renamed.name;
      }
    });
  },

  setClipColor: (clipId, color) => {
    update(state => {
      const clip = state.clips.find(c => c.id === clipId);
      if (clip) {
        const colored = setClipColor(clip, color);
        clip.color = colored.color;
      }
    });
  },

  toggleClipMute: (clipId) => {
    update(state => {
      const clip = state.clips.find(c => c.id === clipId);
      if (clip) {
        const muted = toggleClipMute(clip);
        clip.muted = muted.muted;
      }
    });
  },

  muteSelectedClips: () => {
    update(state => {
      for (const clipId of state.selectedClipIds) {
        const clip = state.clips.find(c => c.id === clipId);
        if (clip) clip.muted = true;
      }
    });
  },

  unmuteSelectedClips: () => {
    update(state => {
      for (const clipId of state.selectedClipIds) {
        const clip = state.clips.find(c => c.id === clipId);
        if (clip) clip.muted = false;
      }
    });
  },

  // ==========================================================================
  // Tool Actions
  // ==========================================================================

  setCurrentTool: (tool) => {
    update(state => {
      state.currentTool = tool;
    });
  },

  // ==========================================================================
  // Context Menu Actions
  // ==========================================================================

  showContextMenu: (x, y, clipId) => {
    update(state => {
      state.contextMenu = {
        visible: true,
        x,
        y,
        clipId,
      };
    });
  },

  hideContextMenu: () => {
    update(state => {
      state.contextMenu.visible = false;
    });
  },

  // ==========================================================================
  // Drag Actions (Transient)
  // ==========================================================================

  startDrag: (clipId, handleType, x, y) => {
    const clip = get().getClipById(clipId);
    if (!clip) return;

    update(state => {
      state.isDragging = true;
      state.dragClipId = clipId;
      state.dragHandleType = handleType;
      state.dragStartX = x;
      state.dragStartY = y;
      state.dragOriginalStartTime = clip.startTime;
      state.dragOriginalDuration = clip.duration;
      state.dragOriginalOffset = clip.offset || 0;

      // Store positions for multi-drag
      if (state.selectedClipIds.has(clipId)) {
        for (const id of state.selectedClipIds) {
          const c = state.clips.find(cl => cl.id === id);
          if (c) {
            state.multiDragStartPositions.set(id, c.startTime);
          }
        }
      } else {
        state.multiDragStartPositions.clear();
        state.multiDragStartPositions.set(clipId, clip.startTime);
      }
    });
  },

  updateDrag: (x, y) => {
    // This is handled by the component using clipEditor calculations
    update(state => {
      state.dragStartX = x;
      state.dragStartY = y;
    });
  },

  endDrag: () => {
    update(state => {
      state.isDragging = false;
      state.dragClipId = null;
      state.dragHandleType = null;
      state.multiDragStartPositions.clear();
    });
  },

  // ==========================================================================
  // Getter Helpers
  // ==========================================================================

  getClipById: (clipId) => {
    return get().clips.find(c => c.id === clipId);
  },

  getSelectedClips: () => {
    return get().clips.filter(c => get().selectedClipIds.has(c.id));
  },

  getClipsOnTrack: (trackId) => {
    return get().clips.filter(c => c.trackId === trackId);
  },

  getClipsInTimeRange: (startBeat, endBeat) => {
    return get().clips.filter(
      c => c.startTime < endBeat && c.startTime + c.duration > startBeat
    );
  },
};
}
