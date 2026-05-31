/**
 * MIDI Store - Zustand store for MIDI state management
 * 
 * Features:
 * - MIDI clips and notes state
 * - Piano roll editor state
 * - Selection management
 * - Transform actions
 * - Integration with MIDI editor and scheduler
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
  MidiNote,
  MidiClip,
  PianoRollTool,
  ZoomLevel,
  ScrollPosition,
  Viewport,
  GridSettings,
  DragState,
  createNote,
  clampPitch,
  clampVelocity,
  pitchToNoteName,
} from '../engine/midi/types';
import {
  addNote,
  deleteNote,
  deleteNotes,
  moveNote,
  moveNotes,
  resizeNote,
  setNoteVelocity,
  selectNote,
  selectNotesById,
  selectAllNotes,
  deselectAllNotes,
  invertSelection,
  selectNotesInRegion,
  getSelectedNotes,
  getSelectedNoteIds,
  copyNotes,
  cutNotes,
  pasteNotes,
  duplicateNotes,
  startDrag,
  updateDrag,
  applyDragToNote,
  commitDrag,
  hitTestNote,
  createMidiClip,
  splitClip,
  mergeClips,
  cropClip,
} from '../engine/midi/midiEditor';
import {
  quantizeNotes,
  QuantizeOptions,
} from '../engine/midi/quantization';
import {
  transposeNotes,
  humanizeNotes,
  scaleVelocity,
  randomizeVelocity,
  HumanizeOptions,
} from '../engine/midi/midiTransforms';
import { MidiScheduler } from '../engine/midi/midiScheduler';

// =============================================================================
// Types
// =============================================================================

interface MidiClipState extends MidiClip {
  isModified: boolean;
}

interface MidiState {
  // Data
  clips: Map<string, MidiClipState>;
  currentClipId: string | null;
  
  // Editor State
  currentTool: PianoRollTool;
  gridSettings: GridSettings;
  zoomLevel: ZoomLevel;
  scrollPosition: ScrollPosition;
  viewport: Viewport;
  
  // Selection
  selectedNoteIds: Set<string>;
  
  // Drag
  dragState: DragState | null;
  
  // Clipboard
  clipboard: MidiNote[];
  
  // Playback
  scheduler: MidiScheduler | null;
  isPlaying: boolean;
  currentBeat: number;
  tempo: number;
  
  // UI
  showVelocityLane: boolean;
  pianoRollWidth: number;
  pianoRollHeight: number;
}

interface MidiActions {
  // Clip Management
  createClip: (trackId: string, startBeat: number, length: number, name?: string) => string;
  deleteClip: (clipId: string) => void;
  openClip: (clipId: string) => void;
  closeClip: () => void;
  renameClip: (clipId: string, name: string) => void;
  setClipColor: (clipId: string, color: string) => void;
  duplicateClip: (clipId: string) => void;
  splitClip: (clipId: string, splitBeat: number) => [string, string] | null;
  mergeClips: (clipIds: string[]) => string | null;
  
  // Note Editing
  addNote: (pitch: number, startBeat: number, duration: number, velocity?: number) => void;
  deleteNote: (noteId: string) => void;
  deleteSelectedNotes: () => void;
  moveNote: (noteId: string, deltaBeats: number, deltaPitch: number) => void;
  moveSelectedNotes: (deltaBeats: number, deltaPitch: number) => void;
  resizeNote: (noteId: string, newDuration: number, fromRight?: boolean) => void;
  setNoteVelocity: (noteId: string, velocity: number) => void;
  setSelectedNotesVelocity: (velocity: number) => void;
  
  // Selection
  selectNote: (noteId: string, addToSelection?: boolean) => void;
  selectNotesById: (noteIds: string[], addToSelection?: boolean) => void;
  selectAllNotes: () => void;
  deselectAllNotes: () => void;
  invertSelection: () => void;
  selectNotesInRegion: (startBeat: number, endBeat: number, lowPitch: number, highPitch: number) => void;
  getSelectedNotes: () => MidiNote[];
  getSelectedNoteIds: () => string[];
  
  // Clipboard
  copySelectedNotes: () => void;
  cutSelectedNotes: () => void;
  pasteNotes: (beat?: number) => void;
  duplicateSelectedNotes: () => void;
  
  // Drag Operations
  startDrag: (type: DragState['type'], noteId: string, x: number, y: number) => void;
  updateDrag: (x: number, y: number) => void;
  endDrag: () => void;
  
  // Tools
  setTool: (tool: PianoRollTool) => void;
  
  // Grid
  setGridDivision: (division: number) => void;
  toggleSnapToGrid: () => void;
  
  // Zoom
  setZoomLevel: (zoom: Partial<ZoomLevel>) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  
  // Scroll
  setScrollPosition: (position: Partial<ScrollPosition>) => void;
  scrollToNote: (pitch: number) => void;
  scrollToBeat: (beat: number) => void;
  
  // Transforms
  transposeSelected: (semitones: number) => void;
  quantizeSelected: (options: QuantizeOptions) => void;
  humanizeSelected: (options: HumanizeOptions) => void;
  scaleSelectedVelocity: (factor: number) => void;
  randomizeSelectedVelocity: (min: number, max: number) => void;
  
  // Hit Testing
  hitTest: (beat: number, pitch: number) => { type: string; noteId: string | null; note: MidiNote | null };
  
  // Playback
  initializeScheduler: (audioContext: AudioContext) => void;
  play: () => void;
  stop: () => void;
  setTempo: (bpm: number) => void;
  seekToBeat: (beat: number) => void;
  scheduleClip: (clipId: string) => void;
  unscheduleClip: (clipId: string) => void;
  
  // UI
  toggleVelocityLane: () => void;
  setPianoRollSize: (width: number, height: number) => void;
  
  // Utilities
  getCurrentClip: () => MidiClipState | null;
  getNoteById: (noteId: string) => MidiNote | undefined;
  snapBeatToGrid: (beat: number) => number;
  beatToPixel: (beat: number) => number;
  pixelToBeat: (pixel: number) => number;
  pitchToPixel: (pitch: number) => number;
  pixelToPitch: (pixel: number) => number;
  
  // Note API for projectSync
  setNotes: (notes: MidiNote[]) => void;
  getNotes: () => MidiNote[];
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_ZOOM: ZoomLevel = { x: 40, y: 12 }; // 40px per beat, 12px per semitone
const DEFAULT_SCROLL: ScrollPosition = { x: 0, y: 600 }; // Scroll to middle C area
const DEFAULT_VIEWPORT: Viewport = {
  startBeat: 0,
  endBeat: 16,
  lowPitch: 36,  // C2
  highPitch: 96, // C7
};

const MIN_ZOOM_X = 10;
const MAX_ZOOM_X = 200;
const MIN_ZOOM_Y = 8;
const MAX_ZOOM_Y = 24;

// =============================================================================
// Store Creation
// =============================================================================

export const useMidiStore = create<MidiState & MidiActions>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // Initial State
        clips: new Map(),
        currentClipId: null,
        
        currentTool: 'select',
        gridSettings: {
          division: 16, // 1/16 by default
          snap: true,
          showSubdivisions: true,
        },
        zoomLevel: DEFAULT_ZOOM,
        scrollPosition: DEFAULT_SCROLL,
        viewport: DEFAULT_VIEWPORT,
        
        selectedNoteIds: new Set(),
        dragState: null,
        clipboard: [],
        
        scheduler: null,
        isPlaying: false,
        currentBeat: 0,
        tempo: 120,
        
        showVelocityLane: true,
        pianoRollWidth: 800,
        pianoRollHeight: 400,

        // =============================================================================
        // Clip Management
        // =============================================================================

        createClip: (trackId, startBeat, length, name) => {
          const clip = createMidiClip(trackId, startBeat, length, name);
          const clipState: MidiClipState = { ...clip, isModified: false };
          
          set((state) => {
            state.clips.set(clip.id, clipState);
          });
          
          return clip.id;
        },

        deleteClip: (clipId) => {
          set((state) => {
            state.clips.delete(clipId);
            if (state.currentClipId === clipId) {
              state.currentClipId = null;
            }
          });
        },

        openClip: (clipId) => {
          set((state) => {
            state.currentClipId = clipId;
            // Reset selection when opening new clip
            state.selectedNoteIds.clear();
            // Scroll to first note or start
            const clip = state.clips.get(clipId);
            if (clip && clip.notes.length > 0) {
              const firstNote = clip.notes.reduce((min, n) => 
                n.startBeat < min.startBeat ? n : min
              );
              state.scrollPosition.x = firstNote.startBeat * state.zoomLevel.x;
            }
          });
        },

        closeClip: () => {
          set((state) => {
            state.currentClipId = null;
            state.selectedNoteIds.clear();
          });
        },

        renameClip: (clipId, name) => {
          set((state) => {
            const clip = state.clips.get(clipId);
            if (clip) clip.name = name;
          });
        },

        setClipColor: (clipId, color) => {
          set((state) => {
            const clip = state.clips.get(clipId);
            if (clip) clip.color = color;
          });
        },

        duplicateClip: (clipId) => {
          const clip = get().clips.get(clipId);
          if (!clip) return;
          
          const newClip: MidiClipState = {
            ...clip,
            id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            startBeat: clip.startBeat + clip.durationBeats,
            notes: clip.notes.map(n => ({
              ...n,
              id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            })),
            isModified: false,
          };
          
          set((state) => {
            state.clips.set(newClip.id, newClip);
          });
        },

        splitClip: (clipId, splitBeat) => {
          const clip = get().clips.get(clipId);
          if (!clip) return null;
          
          const [clip1, clip2] = splitClip(clip, splitBeat);
          
          set((state) => {
            state.clips.set(clip1.id, { ...clip1, isModified: true });
            state.clips.set(clip2.id, { ...clip2, isModified: true });
            state.clips.delete(clipId);
          });
          
          return [clip1.id, clip2.id];
        },

        mergeClips: (clipIds) => {
          const clips = clipIds.map(id => get().clips.get(id)).filter(Boolean) as MidiClipState[];
          if (clips.length < 2) return null;
          
          const merged = mergeClips(clips);
          if (!merged) return null;
          
          set((state) => {
            for (const clipId of clipIds) {
              state.clips.delete(clipId);
            }
            state.clips.set(merged.id, { ...merged, isModified: true });
          });
          
          return merged.id;
        },

        // =============================================================================
        // Note Editing
        // =============================================================================

        addNote: (pitch, startBeat, duration, velocity = 100) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          
          const clip = get().clips.get(currentClipId);
          if (!clip) return;
          
          // Apply grid snap if enabled
          let finalStartBeat = startBeat;
          if (get().gridSettings.snap) {
            const gridSize = 4 / get().gridSettings.division;
            finalStartBeat = Math.round(startBeat / gridSize) * gridSize;
          }
          
          const newNote = createNote(
            clampPitch(pitch),
            finalStartBeat,
            duration,
            velocity
          );
          
          set((state) => {
            const clip = state.clips.get(currentClipId);
            if (clip) {
              clip.notes.push(newNote);
              clip.isModified = true;
              // Select the new note
              state.selectedNoteIds.clear();
              state.selectedNoteIds.add(newNote.id);
            }
          });
        },

        deleteNote: (noteId) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          
          set((state) => {
            const clip = state.clips.get(currentClipId);
            if (clip) {
              const index = clip.notes.findIndex(n => n.id === noteId);
              if (index >= 0) {
                clip.notes.splice(index, 1);
                clip.isModified = true;
                state.selectedNoteIds.delete(noteId);
              }
            }
          });
        },

        deleteSelectedNotes: () => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          
          const selectedIds = get().selectedNoteIds;
          if (selectedIds.size === 0) return;
          
          set((state) => {
            const clip = state.clips.get(currentClipId);
            if (clip) {
              clip.notes = clip.notes.filter(n => !selectedIds.has(n.id));
              clip.isModified = true;
              state.selectedNoteIds.clear();
            }
          });
        },

        moveNote: (noteId, deltaBeats, deltaPitch) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          
          set((state) => {
            const clip = state.clips.get(currentClipId);
            const note = clip?.notes.find(n => n.id === noteId);
            if (note) {
              note.startBeat = Math.max(0, note.startBeat + deltaBeats);
              note.pitch = clampPitch(note.pitch + deltaPitch);
              if (clip) clip.isModified = true;
            }
          });
        },

        moveSelectedNotes: (deltaBeats, deltaPitch) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          
          const selectedIds = get().selectedNoteIds;
          if (selectedIds.size === 0) return;
          
          set((state) => {
            const clip = state.clips.get(currentClipId);
            if (clip) {
              for (const note of clip.notes) {
                if (selectedIds.has(note.id)) {
                  note.startBeat = Math.max(0, note.startBeat + deltaBeats);
                  note.pitch = clampPitch(note.pitch + deltaPitch);
                }
              }
              clip.isModified = true;
            }
          });
        },

        resizeNote: (noteId, newDuration, fromRight = true) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          
          set((state) => {
            const clip = state.clips.get(currentClipId);
            const note = clip?.notes.find(n => n.id === noteId);
            if (note) {
              if (fromRight) {
                note.duration = Math.max(0.01, newDuration);
              } else {
                const endBeat = note.startBeat + note.duration;
                const newStart = Math.max(0, note.startBeat + newDuration);
                note.startBeat = newStart;
                note.duration = endBeat - newStart;
              }
              if (clip) clip.isModified = true;
            }
          });
        },

        setNoteVelocity: (noteId, velocity) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          
          set((state) => {
            const clip = state.clips.get(currentClipId);
            const note = clip?.notes.find(n => n.id === noteId);
            if (note) {
              note.velocity = clampVelocity(velocity);
              if (clip) clip.isModified = true;
            }
          });
        },

        setSelectedNotesVelocity: (velocity) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          
          const selectedIds = get().selectedNoteIds;
          if (selectedIds.size === 0) return;
          
          set((state) => {
            const clip = state.clips.get(currentClipId);
            if (clip) {
              for (const note of clip.notes) {
                if (selectedIds.has(note.id)) {
                  note.velocity = clampVelocity(velocity);
                }
              }
              clip.isModified = true;
            }
          });
        },

        // =============================================================================
        // Selection
        // =============================================================================

        selectNote: (noteId, addToSelection = false) => {
          set((state) => {
            if (addToSelection) {
              if (state.selectedNoteIds.has(noteId)) {
                state.selectedNoteIds.delete(noteId);
              } else {
                state.selectedNoteIds.add(noteId);
              }
            } else {
              state.selectedNoteIds.clear();
              state.selectedNoteIds.add(noteId);
            }
          });
        },

        selectNotesById: (noteIds, addToSelection = false) => {
          set((state) => {
            if (!addToSelection) {
              state.selectedNoteIds.clear();
            }
            for (const id of noteIds) {
              state.selectedNoteIds.add(id);
            }
          });
        },

        selectAllNotes: () => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          
          const clip = get().clips.get(currentClipId);
          if (!clip) return;
          
          set((state) => {
            state.selectedNoteIds.clear();
            for (const note of clip.notes) {
              state.selectedNoteIds.add(note.id);
            }
          });
        },

        deselectAllNotes: () => {
          set((state) => {
            state.selectedNoteIds.clear();
          });
        },

        invertSelection: () => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          
          const clip = get().clips.get(currentClipId);
          if (!clip) return;
          
          set((state) => {
            const newSelection = new Set<string>();
            for (const note of clip.notes) {
              if (!state.selectedNoteIds.has(note.id)) {
                newSelection.add(note.id);
              }
            }
            state.selectedNoteIds = newSelection;
          });
        },

        selectNotesInRegion: (startBeat, endBeat, lowPitch, highPitch) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          
          const clip = get().clips.get(currentClipId);
          if (!clip) return;
          
          const minBeat = Math.min(startBeat, endBeat);
          const maxBeat = Math.max(startBeat, endBeat);
          const minPitch = Math.min(lowPitch, highPitch);
          const maxPitch = Math.max(lowPitch, highPitch);
          
          set((state) => {
            for (const note of clip.notes) {
              const inRegion =
                note.startBeat >= minBeat &&
                note.startBeat < maxBeat &&
                note.pitch >= minPitch &&
                note.pitch <= maxPitch;
              
              if (inRegion) {
                state.selectedNoteIds.add(note.id);
              }
            }
          });
        },

        getSelectedNotes: () => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return [];
          
          const clip = get().clips.get(currentClipId);
          if (!clip) return [];
          
          const selectedIds = get().selectedNoteIds;
          return clip.notes.filter(n => selectedIds.has(n.id));
        },

        getSelectedNoteIds: () => {
          return Array.from(get().selectedNoteIds);
        },

        // =============================================================================
        // Clipboard
        // =============================================================================

        copySelectedNotes: () => {
          const selectedNotes = get().getSelectedNotes();
          if (selectedNotes.length === 0) return;
          
          set((state) => {
            state.clipboard = selectedNotes.map(n => ({
              ...n,
              selected: false,
            }));
          });
        },

        cutSelectedNotes: () => {
          get().copySelectedNotes();
          get().deleteSelectedNotes();
        },

        pasteNotes: (beat) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          
          const clipboard = get().clipboard;
          if (clipboard.length === 0) return;
          
          set((state) => {
            const clip = state.clips.get(currentClipId);
            if (!clip) return;
            
            // Calculate paste offset
            const sortedClipboard = [...clipboard].sort((a, b) => a.startBeat - b.startBeat);
            const firstNoteStart = sortedClipboard[0].startBeat;
            const pasteOffset = (beat ?? 0) - firstNoteStart;
            
            // Paste notes
            const pastedNotes: MidiNote[] = [];
            for (const note of clipboard) {
              const newNote: MidiNote = {
                ...note,
                id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                startBeat: Math.max(0, note.startBeat + pasteOffset),
                selected: false,
              };
              clip.notes.push(newNote);
              pastedNotes.push(newNote);
            }
            
            clip.isModified = true;
            
            // Select pasted notes
            state.selectedNoteIds.clear();
            for (const note of pastedNotes) {
              state.selectedNoteIds.add(note.id);
            }
          });
        },

        duplicateSelectedNotes: () => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          
          const selectedNotes = get().getSelectedNotes();
          if (selectedNotes.length === 0) return;
          
          // Find rightmost selected note
          const rightmostEnd = Math.max(...selectedNotes.map(n => n.startBeat + n.duration));
          
          set((state) => {
            const clip = state.clips.get(currentClipId);
            if (!clip) return;
            
            const duplicated: MidiNote[] = [];
            for (const note of selectedNotes) {
              const newNote: MidiNote = {
                ...note,
                id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                startBeat: note.startBeat + rightmostEnd,
                selected: false,
              };
              clip.notes.push(newNote);
              duplicated.push(newNote);
            }
            
            clip.isModified = true;
            
            // Select duplicated notes
            state.selectedNoteIds.clear();
            for (const note of duplicated) {
              state.selectedNoteIds.add(note.id);
            }
          });
        },

        // =============================================================================
        // Drag Operations
        // =============================================================================

        startDrag: (type, noteId, x, y) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          
          const clip = get().clips.get(currentClipId);
          const note = clip?.notes.find(n => n.id === noteId);
          if (!note) return;
          
          set((state) => {
            state.dragState = {
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
          });
        },

        updateDrag: (x, y) => {
          set((state) => {
            if (!state.dragState) return;
            
            state.dragState.deltaX = x - state.dragState.startX;
            state.dragState.deltaY = y - state.dragState.startY;
          });
        },

        endDrag: () => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          
          const dragState = get().dragState;
          if (!dragState) return;
          
          const { zoomLevel, gridSettings } = get();
          
          set((state) => {
            const clip = state.clips.get(currentClipId);
            if (!clip) return;
            
            const targetNote = clip.notes.find(n => n.id === dragState.noteId);
            if (!targetNote) return;
            
            // Apply drag
            switch (dragState.type) {
              case 'move': {
                const deltaBeats = dragState.deltaX / zoomLevel.x;
                const deltaPitch = Math.round(-dragState.deltaY / zoomLevel.y);
                
                let newStart = targetNote.startBeat + deltaBeats;
                const newPitch = clampPitch(targetNote.pitch + deltaPitch);
                
                // Apply grid snap
                if (gridSettings.snap) {
                  const gridSize = 4 / gridSettings.division;
                  newStart = Math.round(newStart / gridSize) * gridSize;
                }
                
                const finalDeltaBeats = newStart - targetNote.startBeat;
                const finalDeltaPitch = newPitch - targetNote.pitch;
                
                // Apply to all selected notes
                const selectedIds = state.selectedNoteIds;
                for (const note of clip.notes) {
                  if (selectedIds.has(note.id)) {
                    note.startBeat = Math.max(0, note.startBeat + finalDeltaBeats);
                    note.pitch = clampPitch(note.pitch + finalDeltaPitch);
                  }
                }
                break;
              }
              
              case 'resize-right': {
                const deltaBeats = dragState.deltaX / zoomLevel.x;
                const newDuration = Math.max(0.01, targetNote.duration + deltaBeats);
                targetNote.duration = newDuration;
                break;
              }
              
              case 'resize-left': {
                const deltaBeats = dragState.deltaX / zoomLevel.x;
                const endBeat = targetNote.startBeat + targetNote.duration;
                let newStart = Math.max(0, targetNote.startBeat + deltaBeats);
                
                if (gridSettings.snap) {
                  const gridSize = 4 / gridSettings.division;
                  newStart = Math.round(newStart / gridSize) * gridSize;
                }
                
                newStart = Math.min(newStart, endBeat - 0.01);
                targetNote.startBeat = newStart;
                targetNote.duration = endBeat - newStart;
                break;
              }
              
              case 'velocity': {
                const deltaVelocity = -Math.round(dragState.deltaY / 2);
                const newVelocity = clampVelocity(targetNote.velocity + deltaVelocity);
                
                // Apply to all selected
                const selectedIds = state.selectedNoteIds;
                for (const note of clip.notes) {
                  if (selectedIds.has(note.id)) {
                    note.velocity = newVelocity;
                  }
                }
                break;
              }
            }
            
            clip.isModified = true;
            state.dragState = null;
          });
        },

        // =============================================================================
        // Tools
        // =============================================================================

        setTool: (tool) => {
          set((state) => {
            state.currentTool = tool;
          });
        },

        // =============================================================================
        // Grid
        // =============================================================================

        setGridDivision: (division) => {
          set((state) => {
            state.gridSettings.division = division as any;
          });
        },

        toggleSnapToGrid: () => {
          set((state) => {
            state.gridSettings.snap = !state.gridSettings.snap;
          });
        },

        // =============================================================================
        // Zoom
        // =============================================================================

        setZoomLevel: (zoom) => {
          set((state) => {
            state.zoomLevel = {
              x: Math.max(MIN_ZOOM_X, Math.min(MAX_ZOOM_X, zoom.x ?? state.zoomLevel.x)),
              y: Math.max(MIN_ZOOM_Y, Math.min(MAX_ZOOM_Y, zoom.y ?? state.zoomLevel.y)),
            };
          });
        },

        zoomIn: () => {
          const { zoomLevel } = get();
          get().setZoomLevel({
            x: zoomLevel.x * 1.2,
            y: zoomLevel.y * 1.1,
          });
        },

        zoomOut: () => {
          const { zoomLevel } = get();
          get().setZoomLevel({
            x: zoomLevel.x / 1.2,
            y: zoomLevel.y / 1.1,
          });
        },

        resetZoom: () => {
          set((state) => {
            state.zoomLevel = DEFAULT_ZOOM;
          });
        },

        // =============================================================================
        // Scroll
        // =============================================================================

        setScrollPosition: (position) => {
          set((state) => {
            state.scrollPosition = {
              x: position.x ?? state.scrollPosition.x,
              y: position.y ?? state.scrollPosition.y,
            };
          });
        },

        scrollToNote: (pitch) => {
          const { zoomLevel } = get();
          set((state) => {
            // Center the note vertically
            state.scrollPosition.y = (127 - pitch) * zoomLevel.y - state.pianoRollHeight / 2;
          });
        },

        scrollToBeat: (beat) => {
          const { zoomLevel } = get();
          set((state) => {
            state.scrollPosition.x = beat * zoomLevel.x - state.pianoRollWidth / 2;
          });
        },

        // =============================================================================
        // Transforms
        // =============================================================================

        transposeSelected: (semitones) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          
          const selectedIds = get().selectedNoteIds;
          if (selectedIds.size === 0) return;
          
          set((state) => {
            const clip = state.clips.get(currentClipId);
            if (!clip) return;
            
            for (const note of clip.notes) {
              if (selectedIds.has(note.id)) {
                note.pitch = clampPitch(note.pitch + semitones);
              }
            }
            clip.isModified = true;
          });
        },

        quantizeSelected: (options) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          
          const selectedIds = get().selectedNoteIds;
          if (selectedIds.size === 0) return;
          
          set((state) => {
            const clip = state.clips.get(currentClipId);
            if (!clip) return;
            
            const selectedNotes = clip.notes.filter(n => selectedIds.has(n.id));
            const quantized = quantizeNotes(selectedNotes, options);
            
            // Update quantized notes
            for (let i = 0; i < quantized.length; i++) {
              const originalIndex = clip.notes.findIndex(n => n.id === selectedNotes[i].id);
              if (originalIndex >= 0) {
                clip.notes[originalIndex] = quantized[i];
              }
            }
            clip.isModified = true;
          });
        },

        humanizeSelected: (options) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          
          const selectedIds = get().selectedNoteIds;
          if (selectedIds.size === 0) return;
          
          set((state) => {
            const clip = state.clips.get(currentClipId);
            if (!clip) return;
            
            const selectedNotes = clip.notes.filter(n => selectedIds.has(n.id));
            const humanized = humanizeNotes(selectedNotes, options);
            
            // Update humanized notes
            for (let i = 0; i < humanized.length; i++) {
              const originalIndex = clip.notes.findIndex(n => n.id === selectedNotes[i].id);
              if (originalIndex >= 0) {
                clip.notes[originalIndex] = humanized[i];
              }
            }
            clip.isModified = true;
          });
        },

        scaleSelectedVelocity: (factor) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          
          const selectedIds = get().selectedNoteIds;
          if (selectedIds.size === 0) return;
          
          set((state) => {
            const clip = state.clips.get(currentClipId);
            if (!clip) return;
            
            for (const note of clip.notes) {
              if (selectedIds.has(note.id)) {
                note.velocity = clampVelocity(note.velocity * factor);
              }
            }
            clip.isModified = true;
          });
        },

        randomizeSelectedVelocity: (min, max) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          
          const selectedIds = get().selectedNoteIds;
          if (selectedIds.size === 0) return;
          
          set((state) => {
            const clip = state.clips.get(currentClipId);
            if (!clip) return;
            
            for (const note of clip.notes) {
              if (selectedIds.has(note.id)) {
                note.velocity = Math.floor(Math.random() * (max - min + 1)) + min;
              }
            }
            clip.isModified = true;
          });
        },

        // =============================================================================
        // Hit Testing
        // =============================================================================

        hitTest: (beat, pitch) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) {
            return { type: 'none', noteId: null, note: null };
          }
          
          const clip = get().clips.get(currentClipId);
          if (!clip) {
            return { type: 'none', noteId: null, note: null };
          }
          
          const result = hitTestNote(clip.notes, beat, pitch, 0.1);
          return {
            type: result.type || 'none',
            noteId: result.noteId,
            note: result.note,
          };
        },

        // =============================================================================
        // Playback
        // =============================================================================

        initializeScheduler: (audioContext) => {
          set((state) => {
            state.scheduler = new MidiScheduler(audioContext, { getTempoEvents: () => [], getTimeSignature: () => ({ numerator: 4, denominator: 4 }), beatToSeconds: (b: number) => (b / 120) * 60 } as any);
          });
        },

        play: () => {
          const { scheduler } = get();
          if (!scheduler) return;
          
          scheduler.start(0);
          
          set((state) => {
            state.isPlaying = true;
          });
        },

        stop: () => {
          const { scheduler } = get();
          if (!scheduler) return;
          
          scheduler.stop();
          
          set((state) => {
            state.isPlaying = false;
          });
        },

        setTempo: (bpm) => {
          const { scheduler } = get();
          if (scheduler) {
            (scheduler as any).setTempo(bpm);
          }
          
          set((state) => {
            state.tempo = bpm;
          });
        },

        seekToBeat: (beat) => {
          const { scheduler } = get();
          if (scheduler) {
            (scheduler as any).seekToBeat(beat);
          }
          
          set((state) => {
            state.currentBeat = beat;
          });
        },

        scheduleClip: (clipId) => {
          const { scheduler } = get();
          if (!scheduler) return;
          
          const clip = get().clips.get(clipId);
          if (clip) {
            scheduler.scheduleRegion(clip);
          }
        },

        unscheduleClip: (clipId) => {
          const { scheduler } = get();
          if (!scheduler) return;
          
          scheduler.unscheduleRegion(clipId);
        },

        // =============================================================================
        // UI
        // =============================================================================

        toggleVelocityLane: () => {
          set((state) => {
            state.showVelocityLane = !state.showVelocityLane;
          });
        },

        setPianoRollSize: (width, height) => {
          set((state) => {
            state.pianoRollWidth = width;
            state.pianoRollHeight = height;
          });
        },

        // =============================================================================
        // Utilities
        // =============================================================================

        getCurrentClip: () => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return null;
          return get().clips.get(currentClipId) || null;
        },

        getNoteById: (noteId) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return undefined;
          
          const clip = get().clips.get(currentClipId);
          return clip?.notes.find(n => n.id === noteId);
        },

        snapBeatToGrid: (beat) => {
          const { gridSettings } = get();
          const gridSize = 4 / gridSettings.division;
          return Math.round(beat / gridSize) * gridSize;
        },

        beatToPixel: (beat) => {
          return beat * get().zoomLevel.x;
        },

        pixelToBeat: (pixel) => {
          return pixel / get().zoomLevel.x;
        },

        pitchToPixel: (pitch) => {
          // Invert because higher pitches are at top (lower y)
          return (127 - pitch) * get().zoomLevel.y;
        },

        pixelToPitch: (pixel) => {
          // Invert the calculation
          return 127 - Math.round(pixel / get().zoomLevel.y);
        },

        // =============================================================================
        // Note API for projectSync
        // =============================================================================

        setNotes: (notes) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          
          set((state) => {
            const clip = state.clips.get(currentClipId);
            if (clip) {
              clip.notes = notes;
              clip.isModified = true;
            }
          });
        },

        getNotes: () => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return [];
          
          const clip = get().clips.get(currentClipId);
          return clip?.notes || [];
        },
      }))
    ),
    { name: 'midi-store' }
  )
);

// =============================================================================
// Selectors
// =============================================================================

export const selectCurrentClip = (state: MidiState) => 
  state.currentClipId ? state.clips.get(state.currentClipId) : null;

export const selectSelectedNotes = (state: MidiState) => {
  const clip = selectCurrentClip(state);
  if (!clip) return [];
  return clip.notes.filter(n => state.selectedNoteIds.has(n.id));
};

export const selectNotesInViewport = (state: MidiState) => {
  const clip = selectCurrentClip(state);
  if (!clip) return [];
  
  const { viewport } = state;
  return clip.notes.filter(n => 
    n.startBeat >= viewport.startBeat &&
    n.startBeat <= viewport.endBeat &&
    n.pitch >= viewport.lowPitch &&
    n.pitch <= viewport.highPitch
  );
};

export default useMidiStore;
