/**
 * MIDI Editor - Core note editing operations
 * 
 * Features:
 * - Add/delete/move/resize notes
 * - Selection management
 * - Drag operations with constraints
 * - Clipboard operations
 */

import {
  MidiNote,
  MidiClip,
  DragState,
  createNote,
  cloneNote,
  clampPitch,
  clampVelocity,
  sortNotes,
  generateNoteId,
} from './types';

// =============================================================================
// Note Operations
// =============================================================================

/**
 * Add a note to a clip
 */
export function addNote(
  clip: MidiClip,
  note: Omit<MidiNote, 'id'>
): { clip: MidiClip; note: MidiNote } {
  const newNote: MidiNote = {
    ...note,
    id: generateNoteId(),
    selected: false,
  };
  
  return {
    clip: {
      ...clip,
      notes: [...clip.notes, newNote],
    },
    note: newNote,
  };
}

/**
 * Delete a note from a clip
 */
export function deleteNote(clip: MidiClip, noteId: string): MidiClip {
  return {
    ...clip,
    notes: clip.notes.filter(n => n.id !== noteId),
  };
}

/**
 * Delete multiple notes
 */
export function deleteNotes(clip: MidiClip, noteIds: string[]): MidiClip {
  const idSet = new Set(noteIds);
  return {
    ...clip,
    notes: clip.notes.filter(n => !idSet.has(n.id)),
  };
}

/**
 * Move a note by delta beats and semitones
 */
export function moveNote(
  note: MidiNote,
  deltaBeats: number,
  deltaPitch: number
): MidiNote {
  return {
    ...note,
    startBeat: Math.max(0, note.startBeat + deltaBeats),
    pitch: clampPitch(note.pitch + deltaPitch),
  };
}

/**
 * Move multiple notes by the same delta
 */
export function moveNotes(
  notes: MidiNote[],
  deltaBeats: number,
  deltaPitch: number,
  noteIds?: string[] // If provided, only move these notes
): MidiNote[] {
  const idSet = noteIds ? new Set(noteIds) : null;
  
  return notes.map(note => {
    if (idSet && !idSet.has(note.id)) return note;
    
    return moveNote(note, deltaBeats, deltaPitch);
  });
}

/**
 * Resize a note duration
 */
export function resizeNote(
  note: MidiNote,
  newDuration: number,
  fromRight: boolean = true
): MidiNote {
  if (fromRight) {
    // Resize from right edge (default)
    return {
      ...note,
      duration: Math.max(0.01, newDuration),
    };
  } else {
    // Resize from left edge - move start and adjust duration
    const endBeat = note.startBeat + note.duration;
    const newStart = note.startBeat + newDuration;
    
    return {
      ...note,
      startBeat: Math.max(0, newStart),
      duration: Math.max(0.01, endBeat - newStart),
    };
  }
}

/**
 * Set note velocity
 */
export function setNoteVelocity(note: MidiNote, velocity: number): MidiNote {
  return {
    ...note,
    velocity: clampVelocity(velocity),
  };
}

/**
 * Set velocity for multiple notes
 */
export function setNotesVelocity(
  notes: MidiNote[],
  velocity: number,
  noteIds?: string[]
): MidiNote[] {
  const idSet = noteIds ? new Set(noteIds) : null;
  
  return notes.map(note => {
    if (idSet && !idSet.has(note.id)) return note;
    return setNoteVelocity(note, velocity);
  });
}

// =============================================================================
// Selection
// =============================================================================

/**
 * Select a single note
 */
export function selectNote(
  notes: MidiNote[],
  noteId: string,
  addToSelection: boolean = false,
  exclusive: boolean = false
): MidiNote[] {
  if (exclusive) {
    // Only select this note, deselect all others
    return notes.map(n => ({
      ...n,
      selected: n.id === noteId,
    }));
  }
  
  if (addToSelection) {
    // Toggle selection for this note
    return notes.map(n => {
      if (n.id === noteId) {
        return { ...n, selected: !n.selected };
      }
      return n;
    });
  }
  
  // Select only this note, clear others
  return notes.map(n => ({
    ...n,
    selected: n.id === noteId,
  }));
}

/**
 * Select multiple notes by ID
 */
export function selectNotesById(
  notes: MidiNote[],
  noteIds: string[],
  addToSelection: boolean = false
): MidiNote[] {
  const idSet = new Set(noteIds);
  
  if (addToSelection) {
    return notes.map(n => ({
      ...n,
      selected: idSet.has(n.id) ? true : n.selected,
    }));
  }
  
  return notes.map(n => ({
    ...n,
    selected: idSet.has(n.id),
  }));
}

/**
 * Select all notes
 */
export function selectAllNotes(notes: MidiNote[]): MidiNote[] {
  return notes.map(n => ({ ...n, selected: true }));
}

/**
 * Deselect all notes
 */
export function deselectAllNotes(notes: MidiNote[]): MidiNote[] {
  return notes.map(n => ({ ...n, selected: false }));
}

/**
 * Invert selection
 */
export function invertSelection(notes: MidiNote[]): MidiNote[] {
  return notes.map(n => ({ ...n, selected: !n.selected }));
}

/**
 * Select notes in a rectangular region
 */
export function selectNotesInRegion(
  notes: MidiNote[],
  startBeat: number,
  endBeat: number,
  lowPitch: number,
  highPitch: number,
  addToSelection: boolean = false
): MidiNote[] {
  const minBeat = Math.min(startBeat, endBeat);
  const maxBeat = Math.max(startBeat, endBeat);
  const minPitch = Math.min(lowPitch, highPitch);
  const maxPitch = Math.max(lowPitch, highPitch);
  
  return notes.map(note => {
    const noteInRegion =
      note.startBeat >= minBeat &&
      note.startBeat < maxBeat &&
      note.pitch >= minPitch &&
      note.pitch <= maxPitch;
    
    if (addToSelection && noteInRegion) {
      return { ...note, selected: true };
    }
    
    return { ...note, selected: noteInRegion };
  });
}

/**
 * Get selected notes
 */
export function getSelectedNotes(notes: MidiNote[]): MidiNote[] {
  return notes.filter(n => n.selected);
}

/**
 * Get selected note IDs
 */
export function getSelectedNoteIds(notes: MidiNote[]): string[] {
  return notes.filter(n => n.selected).map(n => n.id);
}

// =============================================================================
// Clipboard
// =============================================================================

/**
 * Copy selected notes to clipboard
 */
export function copyNotes(notes: MidiNote[]): MidiNote[] {
  return notes
    .filter(n => n.selected)
    .map(n => ({ ...n, selected: false }));
}

/**
 * Cut selected notes (copy and delete)
 */
export function cutNotes(clip: MidiClip): { clip: MidiClip; clipboard: MidiNote[] } {
  const clipboard = copyNotes(clip.notes);
  
  return {
    clip: {
      ...clip,
      notes: clip.notes.filter(n => !n.selected),
    },
    clipboard,
  };
}

/**
 * Paste notes from clipboard
 * @param offsetBeat Position to paste at (optional, uses first note position if not provided)
 */
export function pasteNotes(
  clip: MidiClip,
  clipboard: MidiNote[],
  offsetBeat?: number
): MidiClip {
  if (clipboard.length === 0) return clip;
  
  // Calculate offset
  const sortedClipboard = sortNotes(clipboard);
  const firstNoteStart = sortedClipboard[0].startBeat;
  const offset = offsetBeat !== undefined ? offsetBeat - firstNoteStart : 0;
  
  // Clone notes with new IDs and offset
  const newNotes = clipboard.map(note => cloneNote({
    ...note,
    startBeat: note.startBeat + offset,
  }));
  
  return {
    ...clip,
    notes: [...clip.notes, ...newNotes],
  };
}

/**
 * Duplicate selected notes
 */
export function duplicateNotes(
  clip: MidiClip,
  offsetBeats: number = 0.25
): MidiClip {
  const selectedNotes = getSelectedNotes(clip.notes);
  
  if (selectedNotes.length === 0) return clip;
  
  // Find rightmost selected note
  const rightmostEnd = Math.max(...selectedNotes.map(n => n.startBeat + n.duration));
  
  // Clone with offset
  const duplicated = selectedNotes.map(note => cloneNote({
    ...note,
    startBeat: note.startBeat + offsetBeats,
    selected: false,
  }));
  
  return {
    ...clip,
    notes: [...clip.notes, ...duplicated],
  };
}

// =============================================================================
// Drag Operations
// =============================================================================

/**
 * Start a drag operation
 */
export function startDrag(
  type: DragState['type'],
  noteId: string,
  x: number,
  y: number,
  note: MidiNote
): DragState {
  return {
    type,
    noteId,
    startX: x,
    startY: y,
    originalStartBeat: note.startBeat,
    originalPitch: note.pitch,
    originalDuration: note.duration,
    originalVelocity: note.velocity,
    deltaX: 0,
    deltaY: 0,
  };
}

/**
 * Update drag operation with new mouse position
 */
export function updateDrag(
  drag: DragState,
  x: number,
  y: number
): DragState {
  return {
    ...drag,
    deltaX: x - drag.startX,
    deltaY: y - drag.startY,
  };
}

/**
 * Apply drag to a note (returns the modified note without saving)
 */
export function applyDragToNote(
  note: MidiNote,
  drag: DragState,
  pixelsPerBeat: number,
  pixelsPerSemitone: number,
  snapToGrid?: (beat: number) => number
): MidiNote {
  if (!drag.type) return note;
  
  switch (drag.type) {
    case 'move': {
      const deltaBeats = drag.deltaX / pixelsPerBeat;
      const deltaPitch = Math.round(-drag.deltaY / pixelsPerSemitone);
      
      let newStart = Math.max(0, drag.originalStartBeat + deltaBeats);
      
      // Apply grid snapping if provided
      if (snapToGrid) {
        newStart = snapToGrid(newStart);
      }
      
      return {
        ...note,
        startBeat: newStart,
        pitch: clampPitch(drag.originalPitch + deltaPitch),
      };
    }
    
    case 'resize-left': {
      const deltaBeats = drag.deltaX / pixelsPerBeat;
      const endBeat = drag.originalStartBeat + drag.originalDuration;
      let newStart = drag.originalStartBeat + deltaBeats;
      
      if (snapToGrid) {
        newStart = snapToGrid(newStart);
      }
      
      // Prevent negative duration
      newStart = Math.min(newStart, endBeat - 0.01);
      
      return {
        ...note,
        startBeat: Math.max(0, newStart),
        duration: endBeat - newStart,
      };
    }
    
    case 'resize-right': {
      const deltaBeats = drag.deltaX / pixelsPerBeat;
      let newDuration = drag.originalDuration + deltaBeats;
      
      // Minimum duration
      newDuration = Math.max(0.01, newDuration);
      
      return {
        ...note,
        duration: newDuration,
      };
    }
    
    case 'velocity': {
      const deltaVelocity = -Math.round(drag.deltaY / 2); // 2 pixels = 1 velocity unit
      return {
        ...note,
        velocity: clampVelocity(drag.originalVelocity + deltaVelocity),
      };
    }
    
    default:
      return note;
  }
}

/**
 * Commit drag operation (apply to all selected notes for move)
 */
export function commitDrag(
  clip: MidiClip,
  drag: DragState,
  pixelsPerBeat: number,
  pixelsPerSemitone: number,
  snapToGrid?: (beat: number) => number
): MidiClip {
  if (!drag.type || !drag.noteId) return clip;
  
  const targetNote = clip.notes.find(n => n.id === drag.noteId);
  if (!targetNote) return clip;
  
  // Calculate the delta that was applied to the dragged note
  const draggedResult = applyDragToNote(targetNote, drag, pixelsPerBeat, pixelsPerSemitone, snapToGrid);
  
  const deltaBeats = draggedResult.startBeat - targetNote.startBeat;
  const deltaPitch = draggedResult.pitch - targetNote.pitch;
  const deltaDuration = draggedResult.duration - targetNote.duration;
  const deltaVelocity = draggedResult.velocity - targetNote.velocity;
  
  // Apply to all selected notes
  const updatedNotes = clip.notes.map(note => {
    // For move: apply to all selected notes
    if (drag.type === 'move' && note.selected && note.id !== drag.noteId) {
      return {
        ...note,
        startBeat: Math.max(0, note.startBeat + deltaBeats),
        pitch: clampPitch(note.pitch + deltaPitch),
      };
    }
    
    // For the dragged note itself
    if (note.id === drag.noteId) {
      return draggedResult;
    }
    
    return note;
  });
  
  return {
    ...clip,
    notes: updatedNotes,
  };
}

// =============================================================================
// Hit Testing
// =============================================================================

export interface HitTestResult {
  type: 'note' | 'resize-left' | 'resize-right' | 'velocity' | null;
  noteId: string | null;
  note: MidiNote | null;
}

/**
 * Test if a point hits a note
 */
export function hitTestNote(
  notes: MidiNote[],
  beat: number,
  pitch: number,
  hitTolerance: number = 0.1
): HitTestResult {
  // Find notes at this pitch
  const notesAtPitch = notes.filter(n => n.pitch === Math.round(pitch));
  
  for (const note of notesAtPitch) {
    const endBeat = note.startBeat + note.duration;
    
    // Check if within note bounds
    if (beat >= note.startBeat - hitTolerance && beat <= endBeat + hitTolerance) {
      // Check edges for resize handles
      const isNearLeftEdge = Math.abs(beat - note.startBeat) < hitTolerance * 2;
      const isNearRightEdge = Math.abs(beat - endBeat) < hitTolerance * 2;
      
      if (isNearLeftEdge) {
        return { type: 'resize-left', noteId: note.id, note };
      }
      
      if (isNearRightEdge) {
        return { type: 'resize-right', noteId: note.id, note };
      }
      
      return { type: 'note', noteId: note.id, note };
    }
  }
  
  return { type: null, noteId: null, note: null };
}

/**
 * Get note at position (for draw/erase tools)
 */
export function getNoteAtPosition(
  notes: MidiNote[],
  beat: number,
  pitch: number,
  tolerance: number = 0.5
): MidiNote | null {
  const result = hitTestNote(notes, beat, pitch, tolerance);
  return result.note;
}

// =============================================================================
// Note Splitting & Joining
// =============================================================================

/**
 * Split a note at a specific beat position, creating two notes.
 * Returns the original clip with the note split, or the clip unchanged if split point is invalid.
 */
export function splitNote(
  clip: MidiClip,
  noteId: string,
  splitBeat: number
): MidiClip {
  const note = clip.notes.find(n => n.id === noteId);
  if (!note) return clip;

  const noteEnd = note.startBeat + note.duration;
  // Split point must be strictly inside the note
  if (splitBeat <= note.startBeat + 0.001 || splitBeat >= noteEnd - 0.001) {
    return clip;
  }

  const leftDuration = splitBeat - note.startBeat;
  const rightDuration = noteEnd - splitBeat;

  const leftNote: MidiNote = {
    ...note,
    id: generateNoteId(),
    startBeat: note.startBeat,
    duration: leftDuration,
    selected: false,
  };

  const rightNote: MidiNote = {
    ...note,
    id: generateNoteId(),
    startBeat: splitBeat,
    duration: rightDuration,
    selected: false,
  };

  const newNotes = clip.notes.flatMap(n => {
    if (n.id === noteId) {
      return [leftNote, rightNote];
    }
    return [n];
  });

  return { ...clip, notes: newNotes };
}

/**
 * Join adjacent notes of the same pitch into a single sustained note.
 * Notes must be exactly adjacent (end of one = start of next) and same pitch.
 */
export function joinNotes(clip: MidiClip, noteIds: string[]): MidiClip {
  if (noteIds.length < 2) return clip;

  const idSet = new Set(noteIds);
  const selectedNotes = clip.notes.filter(n => idSet.has(n.id));

  if (selectedNotes.length < 2) return clip;

  // All selected notes must be the same pitch
  const firstPitch = selectedNotes[0].pitch;
  if (!selectedNotes.every(n => n.pitch === firstPitch)) return clip;

  // Sort by start beat
  const sorted = [...selectedNotes].sort((a, b) => a.startBeat - b.startBeat);

  // Check that all notes are adjacent (end of one = start of next)
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = sorted[i - 1].startBeat + sorted[i - 1].duration;
    if (Math.abs(sorted[i].startBeat - prevEnd) > 0.001) return clip;
  }

  const joinedStart = sorted[0].startBeat;
  const joinedEnd = sorted[sorted.length - 1].startBeat + sorted[sorted.length - 1].duration;
  const joinedDuration = joinedEnd - joinedStart;

  // Use velocity of the first note (most common convention)
  const joinedVelocity = sorted[0].velocity;

  const joinedNote: MidiNote = {
    ...sorted[0],
    id: generateNoteId(),
    startBeat: joinedStart,
    duration: joinedDuration,
    velocity: joinedVelocity,
    selected: false,
  };

  const newNotes = clip.notes.filter(n => !idSet.has(n.id));
  const insertIndex = newNotes.findIndex(n => n.startBeat >= joinedStart);
  if (insertIndex === -1) {
    newNotes.push(joinedNote);
  } else {
    newNotes.splice(insertIndex, 0, joinedNote);
  }

  return { ...clip, notes: newNotes };
}

/**
 * Create a new empty clip
 */
export function createMidiClip(
  trackId: string,
  startBeat: number,
  durationBeats: number,
  name?: string
): MidiClip {
  return {
    id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    trackId,
    startBeat,
    durationBeats,
    chunks: [],
    notes: [],
    name: name || 'MIDI Clip',
    color: '#3B82F6',
    loop: false,
    timeSignatures: [],
  };
}

/**
 * Split a clip at a beat position
 */
export function splitClip(clip: MidiClip, splitBeat: number): [MidiClip, MidiClip] {
  const clipStart = clip.startBeat ?? 0;
  const clipDuration = (clip as any).length ?? clip.durationBeats ?? 8;
  const relativeSplit = splitBeat - clipStart;
  if (!Number.isFinite(relativeSplit) || relativeSplit <= 0) return [clip, { ...clip, id: clip.id + '-copy' }];

  // Notes for first clip
  const notes1 = clip.notes.filter(n => n.startBeat < relativeSplit).map(n => ({
    ...n,
    duration: n.startBeat + n.duration > relativeSplit
      ? relativeSplit - n.startBeat
      : n.duration,
  }));
  
  // Notes for second clip
  const notes2 = clip.notes
    .filter(n => n.startBeat + n.duration > relativeSplit)
    .map(n => ({
      ...n,
      startBeat: Math.max(0, n.startBeat - relativeSplit),
    }));
  
  const clip1: MidiClip = {
    ...clip,
    durationBeats: relativeSplit,
    notes: notes1,
  };
  
  const clip2: MidiClip = {
    ...clip,
    id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    startBeat: splitBeat,
    durationBeats: clipDuration - relativeSplit,
    notes: notes2,
  };
  
  return [clip1, clip2];
}

/**
 * Merge multiple clips into one
 */
export function mergeClips(clips: MidiClip[]): MidiClip | null {
  if (clips.length === 0) return null;
  if (clips.length === 1) return clips[0];
  
  const sorted = [...clips].sort((a, b) => a.startBeat - b.startBeat);
  const first = sorted[0];
  
  // Merge all notes
  const allNotes: MidiNote[] = [];
  
  for (const clip of sorted) {
    const offset = clip.startBeat - first.startBeat;
    
    for (const note of clip.notes) {
      allNotes.push({
        ...note,
        id: generateNoteId(),
        startBeat: note.startBeat + offset,
        selected: false,
      });
    }
  }
  
  // Calculate total length
  const last = sorted[sorted.length - 1];
  const totalLength = last.startBeat + last.durationBeats - first.startBeat;
  
  return {
    ...first,
    durationBeats: totalLength,
    notes: allNotes,
  };
}

/**
 * Crop clip to new bounds
 */
export function cropClip(
  clip: MidiClip,
  newStartBeat: number,
  newDurationBeats: number
): MidiClip {
  const relativeStart = newStartBeat - clip.startBeat;
  const relativeEnd = relativeStart + newDurationBeats;
  
  const croppedNotes = clip.notes
    .filter(n => {
      const noteEnd = n.startBeat + n.duration;
      return n.startBeat < relativeEnd && noteEnd > relativeStart;
    })
    .map(n => {
      const noteEnd = n.startBeat + n.duration;
      
      // Adjust notes that extend beyond bounds
      let newStart = n.startBeat;
      let newDuration = n.duration;
      
      if (n.startBeat < relativeStart) {
        newStart = relativeStart;
        newDuration = noteEnd - relativeStart;
      }
      
      if (noteEnd > relativeEnd) {
        newDuration = relativeEnd - newStart;
      }
      
      // Adjust to new clip start
      return {
        ...n,
        startBeat: newStart - relativeStart,
        duration: Math.max(0.01, newDuration),
      };
    });
  
  return {
    ...clip,
    startBeat: newStartBeat,
    durationBeats: newDurationBeats,
    notes: croppedNotes,
  };
}
