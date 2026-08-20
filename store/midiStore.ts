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
  TimeSignatureEvent,
  createNote,
  clampPitch,
  clampVelocity,
  pitchToNoteName,
  CCPoint,
  CCLane,
  CC_NAMES,
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
  splitNote,
  joinNotes,
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
import { snapBeat, type SnapMode } from '@/lib/snapGrid';
import { MidiScheduler } from '../engine/midi/midiScheduler';

/**
 * What the piano roll needs from the transport it is attached to.
 *
 * The editor's play/stop/seek used to drive a local `MidiScheduler` that had
 * no instruments registered and was never ticked, so pressing play made no
 * sound while `isPlaying` made the button look active.
 */
export interface MidiTransport {
    play(): void;
    stop(): void;
    seek(beat: number): void;
    setTempo(bpm: number): void;
}
import { GrooveMatcher, createGrooveMatcher, type GrooveReference, type GrooveMatchOptions, DEFAULT_MATCH_OPTIONS } from '../engine/midi/grooveMatching';
import type { ExtractedGroove } from '../engine/audio/grooveExtractor';

// =============================================================================
// Types
// =============================================================================

interface MidiClipState extends MidiClip {
  isModified: boolean;
}

interface GrooveTemplate {
  name: string;
  offsets: number[];
  division: number;
  strength: number;
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
  
  // Editor View
  activeGhostNotes: Record<string, MidiNote>;
  
  // Drag
  dragState: DragState | null;
  
  // Clipboard
  clipboard: MidiNote[];
  
  // Playback
  scheduler: MidiScheduler | null;
  /**
   * The real transport, injected by `ProjectPianoRollAdapter`.
   *
   * Not an import: `MidiRenderer` and other engine modules pull this store in,
   * and importing the project store here would drag the whole audio engine
   * into them. Injection also keeps the editor store usable on its own.
   */
  transport: MidiTransport | null;
  isPlaying: boolean;
  currentBeat: number;
  tempo: number;
  
  // UI
  showVelocityLane: boolean;
  pianoRollWidth: number;
  pianoRollHeight: number;

  // Piano Roll Editor State
  activeChannel: number;
  slideMode: boolean;
  portaMode: boolean;
  drawDuration: number;
  stepInputEnabled: boolean;
  stepGridDivision: number;
  
  // Channel Filter (null = show all channels)
  channelFilter: number | null;

  // Scale & Key
  scaleKey: number;        // 0-11 root note
  scaleType: string;       // 'major' | 'minor' | etc.
  scaleQuantizeEnabled: boolean;

  // Swing
  swing: number;           // 0-1 swing amount

  // Groove
  activeGroove: string | null;
  grooveStrength: number;  // 0-1

  // CC Data per note (controller number -> value map)
  noteCCValues: Record<string, Record<number, number>>;

  // CC Automation Lanes (continuous controller curves)
  ccLanes: Map<number, CCLane>;  // controller number -> lane data
  activeCcLane: number | null;   // currently selected CC lane for editing
  showCcLanes: boolean;          // toggle CC lanes visibility

  // Loop/Cycle markers
  loopStart: number;
  loopEnd: number;
  loopEnabled: boolean;

  // Recording
  isRecording: boolean;
  mergeMode: boolean;

  // Fold Mode
  showFoldMode: boolean;

  // Ruler
  showRulerSeconds: boolean;

  // Groove Templates
  grooveTemplates: GrooveTemplate[];

  // Groove Matching (Reference Track workflow)
  grooveMatcher: GrooveMatcher;
  grooveReferences: GrooveReference[];
  activeGrooveReferenceId: string | null;
  grooveMatchOptions: GrooveMatchOptions;

  // Clip Time Signatures (clipId -> array of time sig changes)
  clipTimeSignatures: Map<string, TimeSignatureEvent[]>;

  // Sustain Pedal
  sustainPedalCC: number;

  // Auto-Scroll (Catch Playhead)
  autoScrollEnabled: boolean;

  // MIDI Out (Note Preview)
  midiOutEnabled: boolean;

  // Color By Mode
  colorMode: 'none' | 'velocity' | 'pitch' | 'channel';

  // Undo/Redo
  undoStack: MidiNote[][];
  redoStack: MidiNote[][];
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
  
  // Tools & Modes
  setTool: (tool: PianoRollTool) => void;
  setActiveChannel: (channel: number) => void;
  setSlideMode: (active: boolean) => void;
  setPortaMode: (active: boolean) => void;
  setChannelFilter: (channel: number | null) => void;
  
  // Grid
  setGridDivision: (division: number, triplet?: boolean) => void;
  /** Bar / Beat / Division / Ticks / Smart — what the grid is measured in. */
  setSnapMode: (mode: SnapMode) => void;
  /** Relative moves by whole grid steps; absolute lands on the gridline. */
  setSnapRelative: (relative: boolean) => void;
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
  scaleQuantizeSelected: (root: number, scale: string) => void;
  setSwing: (amount: number) => void;
  setScaleKey: (key: number) => void;
  setScaleType: (type: string) => void;
  setScaleQuantizeEnabled: (enabled: boolean) => void;
      setActiveGroove: (groove: string | null) => void;
      setGrooveStrength: (strength: number) => void;
      addGrooveTemplate: (template: GrooveTemplate) => void;
      removeGrooveTemplate: (name: string) => void;
      applyGrooveTemplate: (clipId: string, templateName: string, strength: number) => void;

      // Groove Matching (Reference Track workflow)
      extractGrooveFromClip: (clipId: string, name: string) => GrooveReference | null;
      extractGrooveFromAudio: (name: string, channelData: Float32Array, sampleRate: number, bpm: number, trackId: string) => GrooveReference | null;
      setActiveGrooveReference: (referenceId: string | null) => void;
      matchClipToReference: (clipId: string, referenceId: string, options?: Partial<GrooveMatchOptions>) => boolean;
      matchSelectedToReference: (referenceId: string, options?: Partial<GrooveMatchOptions>) => void;
      deleteGrooveReference: (referenceId: string) => void;
      setGrooveMatchOptions: (options: Partial<GrooveMatchOptions>) => void;
      setNoteCCValue: (noteId: string, controller: number, value: number) => void;
      setSustainPedal: (value: number) => void;
      zoomToSelection: () => void;
  
  // Hit Testing
  hitTest: (beat: number, pitch: number) => { type: string; noteId: string | null; note: MidiNote | null };
  
  // Playback
  initializeScheduler: (audioContext: AudioContext) => void;
  play: () => void;
  stop: () => void;
  setTempo: (bpm: number) => void;
  seekToBeat: (beat: number) => void;
  /** Attach the real transport. Called by the piano roll's project adapter. */
  setTransport: (transport: MidiTransport | null) => void;
  setCurrentBeat: (beat: number) => void;
      /**
       * Reflect the transport's play state. Written by
       * ProjectPianoRollAdapter, which mirrors the project transport into this
       * store so the editor's playhead follows the same clock as the timeline.
       */
      setIsPlaying: (playing: boolean) => void;
      scheduleClip: (clipId: string) => void;
      unscheduleClip: (clipId: string) => void;

      // Time Signature
      setClipTimeSignature: (clipId: string, beat: number, numerator: number, denominator: number) => void;
      removeClipTimeSignature: (clipId: string, beat: number) => void;
      getClipTimeSignatures: (clipId: string) => TimeSignatureEvent[];

      // UI
      toggleVelocityLane: () => void;
      setPianoRollSize: (width: number, height: number) => void;
      toggleFoldMode: () => void;
      toggleRulerSeconds: () => void;
  
  // Loop/Cycle
  setLoopStart: (beat: number) => void;
  setLoopEnd: (beat: number) => void;
  setLoopEnabled: (enabled: boolean) => void;
  setLoopRange: (start: number, end: number) => void;

  // Recording
  setIsRecording: (recording: boolean) => void;
  setMergeMode: (merge: boolean) => void;
  recordNote: (pitch: number, startBeat: number, duration: number, velocity: number) => void;

  // CC Automation Lanes
  addCcLane: (controller: number, color?: string) => void;
  removeCcLane: (controller: number) => void;
  setActiveCcLane: (controller: number | null) => void;
  toggleCcLanes: () => void;
  setCcLaneValue: (controller: number, beat: number, value: number) => void;
  setCcLaneValues: (controller: number, points: CCPoint[]) => void;
  deleteCcLanePoint: (controller: number, beat: number) => void;
  clearCcLane: (controller: number) => void;

  // Utilities
  getCurrentClip: () => MidiClipState | null;
  getNoteById: (noteId: string) => MidiNote | undefined;
  snapBeatToGrid: (beat: number) => number;
  beatToPixel: (beat: number) => number;
  pixelToBeat: (pixel: number) => number;
  pitchToPixel: (pitch: number) => number;
  pixelToPitch: (pixel: number) => number;
  
  // Split / Join
  splitNote: (noteId: string, splitBeat: number) => void;
  joinNotes: (noteIds: string[]) => void;
  
  // Draw Duration
  setDrawDuration: (duration: number) => void;
  
  // Step Sequencer
  toggleStepInput: () => void;
  setStepGridDivision: (division: number) => void;
  
  // Note API for projectSync
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  _pushUndoSnapshot: () => void;

  // Auto-Scroll
  toggleAutoScroll: () => void;

  // MIDI Out
  toggleMidiOut: () => void;

  // Color Mode
  setColorMode: (mode: 'none' | 'velocity' | 'pitch' | 'channel') => void;

  // Note Mute
  toggleMuteNote: (noteId: string) => void;
  muteSelectedNotes: () => void;
  unmuteSelectedNotes: () => void;

  // Articulation
  setNoteArticulation: (noteId: string, articulationId: number) => void;
  setSelectedNotesArticulation: (articulationId: number) => void;

  // Brush Tool
  brushNotes: (pitch: number, startBeat: number, count: number, stepBeats: number, duration: number) => void;
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
        
        undoStack: [],
        redoStack: [],

        currentTool: 'select',
activeChannel: 0,
        slideMode: false,
        portaMode: false,
        gridSettings: { division: 16, snap: true, showSubdivisions: true, triplet: false, mode: 'smart', relative: true },
        zoomLevel: DEFAULT_ZOOM,
        scrollPosition: DEFAULT_SCROLL,
        viewport: DEFAULT_VIEWPORT,
        
        selectedNoteIds: new Set(),
        activeGhostNotes: {},
        dragState: null,
        clipboard: [],
        
        scheduler: null,
        transport: null,
        isPlaying: false,
        currentBeat: 0,
        tempo: 120,
        
        showVelocityLane: true,
        pianoRollWidth: 800,
        pianoRollHeight: 400,
        drawDuration: 0.25,
        stepInputEnabled: false,
        stepGridDivision: 16,
        
channelFilter: null,

        loopStart: 0,
        loopEnd: 4,
        loopEnabled: false,

        isRecording: false,
        mergeMode: true,

        showFoldMode: false,
        showRulerSeconds: false,
        grooveTemplates: [],
        grooveMatcher: createGrooveMatcher(),
        grooveReferences: [],
        activeGrooveReferenceId: null,
        grooveMatchOptions: { ...DEFAULT_MATCH_OPTIONS },
        clipTimeSignatures: new Map(),
        sustainPedalCC: 0,
        autoScrollEnabled: true,
        midiOutEnabled: true,
        colorMode: 'none',

        scaleKey: 0,
        scaleType: 'major',
        scaleQuantizeEnabled: false,

        swing: 0,
        activeGroove: null,
        grooveStrength: 1,

        noteCCValues: {},

        ccLanes: new Map(),
        activeCcLane: null,
        showCcLanes: true,

        // =============================================================================
        // Clip Management
        // =============================================================================

        setActiveChannel: (channel) => set({ activeChannel: channel }),
        setSlideMode: (active) => set({ slideMode: active }),
        setPortaMode: (active) => set({ portaMode: active }),
        setChannelFilter: (channel) => set({ channelFilter: channel }),
        setLoopStart: (beat) => set({ loopStart: beat }),
        setLoopEnd: (beat) => set({ loopEnd: beat }),
        setLoopEnabled: (enabled) => set({ loopEnabled: enabled }),
        setLoopRange: (start, end) => set({ loopStart: start, loopEnd: end }),

        setIsRecording: (recording) => set({ isRecording: recording }),
        setMergeMode: (merge) => set({ mergeMode: merge }),
        recordNote: (pitch, startBeat, duration, velocity) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;

          const clip = get().clips.get(currentClipId);
          if (!clip) return;

          // If mergeMode is off, remove overlapping notes first (same pitch AND time intersection)
          if (!get().mergeMode) {
            set((state) => {
              const clip = state.clips.get(currentClipId);
              if (!clip) return;
              clip.notes = clip.notes.filter(n => {
                if (n.pitch !== pitch) return true;
                const noteEnd = n.startBeat + n.duration;
                const newEnd = startBeat + duration;
                return !(n.startBeat < newEnd && noteEnd > startBeat);
              });
            });
          }

          // Use existing addNote logic (handles grid snap, clamping, undo snapshot)
          get().addNote(pitch, startBeat, duration, velocity);
        },

        // =============================================================================
        // CC Automation Lanes
        // =============================================================================

        addCcLane: (controller, color) => set((state) => {
          if (state.ccLanes.has(controller)) return;
          const lane: CCLane = {
            id: `cc-${controller}`,
            controller,
            name: CC_NAMES[controller] || `CC ${controller}`,
            color: color || '#3B82F6',
            points: [],
            visible: true,
            height: 80,
          };
          state.ccLanes.set(controller, lane);
          state.activeCcLane = controller;
        }),

        removeCcLane: (controller) => set((state) => {
          state.ccLanes.delete(controller);
          if (state.activeCcLane === controller) {
            state.activeCcLane = state.ccLanes.keys().next().value ?? null;
          }
        }),

        setActiveCcLane: (controller) => set({ activeCcLane: controller }),

        toggleCcLanes: () => set((state) => ({ showCcLanes: !state.showCcLanes })),

        setCcLaneValue: (controller, beat, value) => set((state) => {
          const lane = state.ccLanes.get(controller);
          if (!lane) return;
          const clampedValue = Math.max(0, Math.min(127, Math.round(value)));
          const existingIndex = lane.points.findIndex(p => p.beat === beat);
          if (existingIndex >= 0) {
            lane.points[existingIndex] = { beat, value: clampedValue };
          } else {
            lane.points.push({ beat, value: clampedValue });
            lane.points.sort((a, b) => a.beat - b.beat);
          }
        }),

        setCcLaneValues: (controller, points) => set((state) => {
          const lane = state.ccLanes.get(controller);
          if (!lane) return;
          lane.points = points.sort((a, b) => a.beat - b.beat);
        }),

        deleteCcLanePoint: (controller, beat) => set((state) => {
          const lane = state.ccLanes.get(controller);
          if (!lane) return;
          lane.points = lane.points.filter(p => p.beat !== beat);
        }),

        clearCcLane: (controller) => set((state) => {
          const lane = state.ccLanes.get(controller);
          if (!lane) return;
          lane.points = [];
        }),

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
            state.activeGhostNotes = {};
            
            const clip = state.clips.get(clipId);
            if (clip) {
              // Scroll to first note or start
              if (clip.notes.length > 0) {
                const firstNote = clip.notes.reduce((min, n) => 
                  n.startBeat < min.startBeat ? n : min
                );
                state.scrollPosition.x = firstNote.startBeat * state.zoomLevel.x;
              }
              
              // Populate ghost notes (notes from other clips on the same track)
              for (const [id, otherClip] of state.clips.entries()) {
                if (id !== clipId && otherClip.trackId === clip.trackId) {
                  // Adjust start times to be relative to the opened clip or absolute?
                  // For the piano roll, usually they are rendered in absolute or clip-relative time.
                  // For now, we'll just dump them into activeGhostNotes as absolute, and MidiRenderer needs to offset them
                  // if the view is relative, but the current PianoRoll uses viewport absolute time.
                  for (const note of otherClip.notes) {
                     // note.startBeat is relative to the clip start, so we need to make it absolute
                     // and then relative to the current clip if the editor is relative.
                     // The editor viewport uses absolute beat positions!
                     // So we must shift the note to its absolute position.
                     const absoluteStart = note.startBeat + otherClip.startBeat;
                     state.activeGhostNotes[note.id] = {
                       ...note,
                       startBeat: absoluteStart
                     };
                  }
                }
              }
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
          
          get()._pushUndoSnapshot();
          
          // Apply grid snap if enabled
          let finalStartBeat = startBeat;
          if (get().gridSettings.snap) {
            const gridSize = 4 / get().gridSettings.division;
            finalStartBeat = Math.floor(startBeat / gridSize) * gridSize;
          }
          
          // Don't clamp duration to clip boundary, allow notes to extend freely
          const clampedDuration = duration;
          if (clampedDuration <= 0) return;
          
          const newNote = createNote(
            clampPitch(pitch),
            finalStartBeat,
            clampedDuration,
            velocity,
            get().activeChannel,
            get().slideMode,
            get().portaMode
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
          
          get()._pushUndoSnapshot();
          
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
          
          get()._pushUndoSnapshot();
          
          set((state) => {
            const clip = state.clips.get(currentClipId);
            if (clip) {
              clip.notes = clip.notes.filter(n => !selectedIds.has(n.id));
              clip.isModified = true;
              state.selectedNoteIds.clear();
            }
          });
        },

        randomizeSelectedVelocity: (min, max) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          
          const selectedIds = get().selectedNoteIds;
          if (selectedIds.size === 0) return;

          get()._pushUndoSnapshot();

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

        setNotes: (notes: MidiNote[]) => {
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
          
          const pixelsPerBeat = get().zoomLevel.x;
          const tolerance = Math.max(0.05, 6 / pixelsPerBeat);
          const result = hitTestNote(clip.notes, beat, pitch, tolerance);
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

        /*
         * Transport actions delegate to the project store, which owns the
         * transport. This store only mirrors `isPlaying` / `currentBeat` for
         * the editor's playhead — `ProjectPianoRollAdapter` keeps them in step.
         *
         * They used to drive a local `MidiScheduler` and write `isPlaying`
         * here directly. Nothing ever registered an instrument on that
         * scheduler and nothing ticked its lookahead, so it could not produce
         * a sound; meanwhile the flag made the piano roll's play button look
         * active while the real transport stood still. Writing the flag here
         * would also fight the mirror, so these no longer set it at all.
         */
        setTransport: (transport) => set((state) => {
          state.transport = transport as MidiTransport | null;
        }),

        play: () => {
          get().transport?.play();
        },

        stop: () => {
          get().transport?.stop();
        },

        setTempo: (bpm) => {
          get().transport?.setTempo(bpm);
          set((state) => {
            state.tempo = bpm;
          });
        },

        seekToBeat: (beat) => {
          // The project's seek stops a rolling transport first, so one press
          // of Go to Start both stops and rewinds.
          get().transport?.seek(beat);
        },

        setCurrentBeat: (beat) => set({ currentBeat: beat }),

        setIsPlaying: (playing) => set({ isPlaying: playing }),

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
        // Time Signature
        // =============================================================================

        setClipTimeSignature: (clipId, beat, numerator, denominator) => {
          set((state) => {
            const events = state.clipTimeSignatures.get(clipId) || [];
            const existingIndex = events.findIndex(e => e.beat === beat);
            const event: TimeSignatureEvent = { beat, numerator, denominator };
            if (existingIndex >= 0) {
              events[existingIndex] = event;
            } else {
              events.push(event);
              events.sort((a, b) => a.beat - b.beat);
            }
            state.clipTimeSignatures.set(clipId, events);
          });
        },

        removeClipTimeSignature: (clipId, beat) => {
          set((state) => {
            const events = state.clipTimeSignatures.get(clipId);
            if (!events) return;
            const filtered = events.filter(e => e.beat !== beat);
            if (filtered.length === 0) {
              state.clipTimeSignatures.delete(clipId);
            } else {
              state.clipTimeSignatures.set(clipId, filtered);
            }
          });
        },

        getClipTimeSignatures: (clipId) => {
          const events = get().clipTimeSignatures.get(clipId);
          if (!events) return [];
          return [...events].sort((a, b) => a.beat - b.beat);
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

        toggleFoldMode: () => {
          set((state) => {
            state.showFoldMode = !state.showFoldMode;
          });
        },

        toggleRulerSeconds: () => {
          set((state) => {
            state.showRulerSeconds = !state.showRulerSeconds;
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
          if (!gridSettings.snap) return beat;
          return snapBeat(beat, {
            mode: gridSettings.mode,
            division: gridSettings.division,
            triplet: gridSettings.triplet,
            beatsPerBar: 4,
            pixelsPerBeat: get().zoomLevel?.x,
          });
        },

        beatToPixel: (beat) => {
          return beat * get().zoomLevel.x;
        },

        pixelToBeat: (pixel) => {
          return pixel / get().zoomLevel.x;
        },

        pitchToPixel: (pitch) => {
          return (127 - pitch) * get().zoomLevel.y;
        },

        pixelToPitch: (pixel) => {
          return 127 - Math.round(pixel / get().zoomLevel.y);
        },

        moveNote: (noteId, deltaBeats, deltaPitch) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          
          get()._pushUndoSnapshot();
          
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
          
          get()._pushUndoSnapshot();
          
          set((state) => {
            const clip = state.clips.get(currentClipId);
            if (!clip) return;
            const clipEnd = clip.durationBeats;
            for (const note of clip.notes) {
              if (selectedIds.has(note.id)) {
                note.startBeat = Math.max(0, Math.min(note.startBeat + deltaBeats, clipEnd - 0.01));
                note.pitch = clampPitch(note.pitch + deltaPitch);
              }
            }
            clip.isModified = true;
          });
        },

        resizeNote: (noteId, newDuration, fromRight = true) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          
          get()._pushUndoSnapshot();
          
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
          
          get()._pushUndoSnapshot();
          
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
          
          get()._pushUndoSnapshot();
          
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
            clip.isModified = true;
          });
        },

        scaleQuantizeSelected: (root, scale) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          const selectedIds = get().selectedNoteIds;
          if (selectedIds.size === 0) return;
          get()._pushUndoSnapshot();
          set((state) => {
            const clip = state.clips.get(currentClipId);
            if (!clip) return;
            const { quantizeScale } = require('../engine/midi/quantization');
            for (const note of clip.notes) {
              if (selectedIds.has(note.id)) {
                const normalized = note.pitch % 12;
                const intervals = scale === 'chromatic' ? [0,1,2,3,4,5,6,7,8,9,10,11] : [];
                if (scale !== 'chromatic') {
                  const scaleMap: Record<string, number[]> = {
                    major: [0,2,4,5,7,9,11],
                    minor: [0,2,3,5,7,8,10],
                    dorian: [0,2,3,5,7,9,10],
                    mixolydian: [0,2,4,5,7,9,10],
                    'natural-minor': [0,2,3,5,7,8,10],
                    'harmonic-minor': [0,2,3,5,7,8,11],
                    pentatonic: [0,2,4,7,9],
                    blues: [0,3,5,6,7,10],
                  };
                  const scaleIntervals = scaleMap[scale] || [0,2,4,5,7,9,11];
                  let closestInterval = scaleIntervals[0];
                  let minDist = 12;
                  for (const interval of scaleIntervals) {
                    const dist = Math.abs(normalized - ((root + interval) % 12));
                    if (dist < minDist) { minDist = dist; closestInterval = (root + interval) % 12; }
                  }
                  const pitchClassDiff = closestInterval - normalized;
                  note.pitch = Math.max(0, Math.min(127, note.pitch + pitchClassDiff));
                }
              }
            }
            clip.isModified = true;
          });
        },

        setSwing: (amount) => set({ swing: amount }),
        setScaleKey: (key) => set({ scaleKey: key }),
        setScaleType: (type) => set({ scaleType: type }),
        setScaleQuantizeEnabled: (enabled) => set({ scaleQuantizeEnabled: enabled }),
        setActiveGroove: (groove) => set({ activeGroove: groove }),
        setGrooveStrength: (strength) => set({ grooveStrength: strength }),

        addGrooveTemplate: (template) => {
          set((state) => {
            const existing = state.grooveTemplates.findIndex(t => t.name === template.name);
            if (existing >= 0) {
              state.grooveTemplates[existing] = template;
            } else {
              state.grooveTemplates.push(template);
            }
          });
        },

        removeGrooveTemplate: (name) => {
          set((state) => {
            state.grooveTemplates = state.grooveTemplates.filter(t => t.name !== name);
          });
        },

        applyGrooveTemplate: (clipId, templateName, strength) => {
          const state = get();
          const template = state.grooveTemplates.find(t => t.name === templateName);
          if (!template) return;

          const clip = state.clips.get(clipId);
          if (!clip) return;

          const gridDivision = template.division;
          const gridSize = 4 / gridDivision;

          set((state) => {
            const targetClip = state.clips.get(clipId);
            if (!targetClip) return;

            for (let i = 0; i < targetClip.notes.length; i++) {
              const note = targetClip.notes[i];
              const offsetIndex = i % template.offsets.length;
              const offsetBeats = template.offsets[offsetIndex] * strength * gridSize;
              note.startBeat = Math.max(0, note.startBeat + offsetBeats);
            }
            targetClip.isModified = true;
          });
        },

        // =============================================================================
        // Groove Matching (Reference Track workflow)
        // =============================================================================

        extractGrooveFromClip: (clipId, name) => {
          const state = get();
          const clip = state.clips.get(clipId);
          if (!clip || clip.notes.length === 0) return null;

          const reference = state.grooveMatcher.createReferenceFromMidi(
            name,
            clip.notes,
            clip.trackId,
            { gridResolution: 4 / (clip.timeSignatures?.[0]?.denominator ?? 4) }
          );

          if (reference) {
            set({ grooveReferences: [...state.grooveMatcher.getReferences()] });
          }

          return reference;
        },

        extractGrooveFromAudio: (name, channelData, sampleRate, bpm, trackId) => {
          const state = get();
          const reference = state.grooveMatcher.createReferenceFromAudio(
            name,
            channelData,
            sampleRate,
            bpm,
            trackId
          );

          if (reference) {
            set({ grooveReferences: [...state.grooveMatcher.getReferences()] });
          }

          return reference;
        },

        setActiveGrooveReference: (referenceId) => {
          const state = get();
          state.grooveMatcher.setActiveReference(referenceId);
          set({ activeGrooveReferenceId: referenceId });
        },

        matchClipToReference: (clipId, referenceId, options) => {
          const state = get();
          const clip = state.clips.get(clipId);
          if (!clip) return false;

          const result = state.grooveMatcher.applyToNotes(
            clip.notes,
            referenceId,
            { ...state.grooveMatchOptions, ...options }
          );

          if (!result.success || !result.notes) return false;

          set((state) => {
            const targetClip = state.clips.get(clipId);
            if (!targetClip) return;
            targetClip.notes = result.notes!;
            targetClip.isModified = true;
          });

          return true;
        },

        matchSelectedToReference: (referenceId, options) => {
          const state = get();
          const currentClipId = state.currentClipId;
          if (!currentClipId) return;

          const clip = state.clips.get(currentClipId);
          if (!clip) return;

          const selectedIds = state.selectedNoteIds;
          if (selectedIds.size === 0) return;

          // Get selected notes
          const selectedNotes = clip.notes.filter(n => selectedIds.has(n.id));

          const result = state.grooveMatcher.applyToNotes(
            selectedNotes,
            referenceId,
            { ...state.grooveMatchOptions, ...options }
          );

          if (!result.success || !result.notes) return;

          // Apply results to the selected notes
          set((state) => {
            const targetClip = state.clips.get(currentClipId);
            if (!targetClip) return;

            for (const updatedNote of result.notes!) {
              const existing = targetClip.notes.find(n => n.id === updatedNote.id);
              if (existing) {
                existing.startBeat = updatedNote.startBeat;
                existing.velocity = updatedNote.velocity;
              }
            }
            targetClip.isModified = true;
          });
        },

        deleteGrooveReference: (referenceId) => {
          const state = get();
          state.grooveMatcher.deleteReference(referenceId);
          set({
            grooveReferences: [...state.grooveMatcher.getReferences()],
            activeGrooveReferenceId: state.activeGrooveReferenceId === referenceId
              ? null
              : state.activeGrooveReferenceId,
          });
        },

        setGrooveMatchOptions: (options) => {
          set((state) => {
            state.grooveMatchOptions = { ...state.grooveMatchOptions, ...options };
          });
        },

        setNoteCCValue: (noteId, controller, value) => {
          set((state) => {
            if (!state.noteCCValues[noteId]) state.noteCCValues[noteId] = {};
            state.noteCCValues[noteId][controller] = value;
          });
        },

        setSustainPedal: (value) => {
          set({ sustainPedalCC: value });
        },

        zoomToSelection: () => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          const clip = get().clips.get(currentClipId);
          if (!clip) return;
          const selectedIds = get().selectedNoteIds;
          if (selectedIds.size === 0) return;
          let minBeat = Infinity, maxBeat = -Infinity, minPitch = 127, maxPitch = 0;
          for (const note of clip.notes) {
            if (selectedIds.has(note.id)) {
              if (note.startBeat < minBeat) minBeat = note.startBeat;
              const end = note.startBeat + note.duration;
              if (end > maxBeat) maxBeat = end;
              if (note.pitch < minPitch) minPitch = note.pitch;
              if (note.pitch > maxPitch) maxPitch = note.pitch;
            }
          }
          if (minBeat === Infinity) return;
          const margin = 2;
          const targetStart = Math.max(0, minBeat - margin);
          const targetEnd = maxBeat + margin;
          const targetLow = Math.max(0, minPitch - 8);
          const targetHigh = Math.min(127, maxPitch + 8);
          const cw = get().pianoRollWidth;
          const ch = get().pianoRollHeight;
          if (cw > 0 && targetEnd > targetStart) {
            const newZoomX = Math.min(200, Math.max(10, cw / (targetEnd - targetStart)));
            const newZoomY = Math.min(24, Math.max(8, ch / (targetHigh - targetLow + 1)));
            set((state) => {
              state.zoomLevel = { x: newZoomX, y: newZoomY };
              state.scrollPosition = { x: targetStart * newZoomX, y: (127 - targetHigh) * newZoomY };
            });
          }
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

          get()._pushUndoSnapshot();

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

          get()._pushUndoSnapshot();

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

          get()._pushUndoSnapshot();

          const { zoomLevel, gridSettings } = get();
          
          set((state) => {
            const clip = state.clips.get(currentClipId);
            if (!clip) return;
            const clipDuration = clip.durationBeats;
            
            const targetNote = clip.notes.find(n => n.id === dragState.noteId);
            if (!targetNote) return;
            
            // Apply drag — using dragState.original* values for correct computation
            switch (dragState.type) {
              case 'move': {
                const deltaBeats = dragState.deltaX / zoomLevel.x;
                const deltaPitch = Math.round(-dragState.deltaY / zoomLevel.y);
                
                let newStart = dragState.originalStartBeat + deltaBeats;
                const newPitch = clampPitch(dragState.originalPitch + deltaPitch);
                
                // Apply grid snap
                if (gridSettings.snap) {
                  const gridSize = 4 / gridSettings.division;
                  newStart = Math.floor(newStart / gridSize) * gridSize;
                }
                
                const finalDeltaBeats = newStart - dragState.originalStartBeat;
                const finalDeltaPitch = newPitch - dragState.originalPitch;
                
                // Apply to all selected notes — clamp each note individually
                const selectedIds = state.selectedNoteIds;
                for (const note of clip.notes) {
                  if (selectedIds.has(note.id)) {
                    const clampedStart = Math.max(0, note.startBeat + finalDeltaBeats);
                    note.startBeat = clampedStart;
                    note.pitch = clampPitch(note.pitch + finalDeltaPitch);
                  }
                }
                break;
              }
              
              case 'resize-right': {
                const deltaBeats = dragState.deltaX / zoomLevel.x;
                let newEnd = dragState.originalStartBeat + dragState.originalDuration + deltaBeats;
                
                if (gridSettings.snap) {
                  const gridSize = 4 / gridSettings.division;
                  newEnd = Math.floor(newEnd / gridSize) * gridSize;
                }
                
                const newDuration = Math.max(0.01, newEnd - targetNote.startBeat);
                targetNote.duration = newDuration;
                break;
              }
              
              case 'resize-left': {
                const deltaBeats = dragState.deltaX / zoomLevel.x;
                const endBeat = dragState.originalStartBeat + dragState.originalDuration;
                let newStart = Math.max(0, dragState.originalStartBeat + deltaBeats);
                
                if (gridSettings.snap) {
                  const gridSize = 4 / gridSettings.division;
                  newStart = Math.floor(newStart / gridSize) * gridSize;
                }
                
                // Clamp against note's own endBeat
                newStart = Math.min(Math.max(0, newStart), endBeat - 0.01);
                targetNote.startBeat = newStart;
                targetNote.duration = Math.max(0.01, endBeat - newStart);
                break;
              }
              
              case 'velocity': {
                const deltaVelocity = -Math.round(dragState.deltaY / 2);
                const newVelocity = clampVelocity(dragState.originalVelocity + deltaVelocity);
                
                // Apply to all selected — preserve relative velocity differences
                const selectedIds = state.selectedNoteIds;
                for (const note of clip.notes) {
                  if (selectedIds.has(note.id)) {
                    note.velocity = clampVelocity(note.velocity + deltaVelocity);
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

        splitNote: (noteId, splitBeat) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          get()._pushUndoSnapshot();
          set((state) => {
            const clip = state.clips.get(currentClipId);
            if (!clip) return;
            const updated = splitNote(clip, noteId, splitBeat);
            state.clips.set(currentClipId, { ...updated, isModified: true });
          });
        },

        joinNotes: (noteIds) => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          get()._pushUndoSnapshot();
          set((state) => {
            const clip = state.clips.get(currentClipId);
            if (!clip) return;
            const updated = joinNotes(clip, noteIds);
            state.clips.set(currentClipId, { ...updated, isModified: true });
          });
        },

        setDrawDuration: (duration) => {
          set((state) => {
            state.drawDuration = duration;
          });
        },

        toggleStepInput: () => {
          set((state) => {
            state.stepInputEnabled = !state.stepInputEnabled;
          });
        },

        setStepGridDivision: (division) => {
          set((state) => {
            state.stepGridDivision = division as any;
          });
        },

        // =============================================================================
        // Grid
        // =============================================================================

        setGridDivision: (division, triplet = false) => {
          set((state) => {
            state.gridSettings.division = division as any;
            state.gridSettings.triplet = triplet;
            // Choosing a value is choosing to snap by it. Leaving the mode on
            // Bar while the menu ticks 1/16 would show one grid and use another.
            state.gridSettings.mode = 'division';
          });
        },

        setSnapMode: (mode) => {
          set((state) => {
            state.gridSettings.mode = mode;
          });
        },

        setSnapRelative: (relative) => {
          set((state) => {
            state.gridSettings.relative = relative;
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

          get()._pushUndoSnapshot();

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

          get()._pushUndoSnapshot();

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

          get()._pushUndoSnapshot();

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

          get()._pushUndoSnapshot();

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

        // Undo/Redo

        _pushUndoSnapshot: () => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          const clip = get().clips.get(currentClipId);
          if (!clip) return;
          const snapshot: MidiNote[] = JSON.parse(JSON.stringify(clip.notes));
          set((state) => {
            state.undoStack.push(snapshot);
            if (state.undoStack.length > 50) state.undoStack.shift();
            state.redoStack = [];
          });
        },

        undo: () => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          const stack = get().undoStack;
          if (stack.length === 0) return;
          const previousState = stack[stack.length - 1];

          set((state) => {
            const clip = state.clips.get(currentClipId);
            if (!clip) return;
            const currentNotes: MidiNote[] = JSON.parse(JSON.stringify(clip.notes));
            state.redoStack.push(currentNotes);
            clip.notes = previousState;
            clip.isModified = true;
            state.undoStack.pop();
          });
        },

        redo: () => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return;
          const stack = get().redoStack;
          if (stack.length === 0) return;
          const nextState = stack[stack.length - 1];

          set((state) => {
            const clip = state.clips.get(currentClipId);
            if (!clip) return;
            const currentNotes: MidiNote[] = JSON.parse(JSON.stringify(clip.notes));
            state.undoStack.push(currentNotes);
            clip.notes = nextState;
            clip.isModified = true;
            state.redoStack.pop();
          });
        },

        canUndo: () => {
          return get().undoStack.length > 0;
        },

        canRedo: () => {
          return get().redoStack.length > 0;
        },

        getNotes: () => {
          const currentClipId = get().currentClipId;
          if (!currentClipId) return [];

          const clip = get().clips.get(currentClipId);
          return clip?.notes || [];
        },

        // Auto-Scroll
        toggleAutoScroll: () => {
          set((state) => {
            state.autoScrollEnabled = !state.autoScrollEnabled;
          });
        },

        // MIDI Out
        toggleMidiOut: () => {
          set((state) => {
            state.midiOutEnabled = !state.midiOutEnabled;
          });
        },

        // Color Mode
        setColorMode: (mode) => {
          set((state) => {
            state.colorMode = mode;
          });
        },

        // Note Mute
        toggleMuteNote: (noteId) => {
          set((state) => {
            for (const [, clip] of state.clips) {
              const note = clip.notes.find(n => n.id === noteId);
              if (note) {
                note.muted = !note.muted;
                clip.isModified = true;
                break;
              }
            }
          });
        },

        muteSelectedNotes: () => {
          set((state) => {
            const selectedIds = state.selectedNoteIds;
            for (const [, clip] of state.clips) {
              for (const note of clip.notes) {
                if (selectedIds.has(note.id)) {
                  note.muted = true;
                }
              }
              clip.isModified = true;
            }
          });
        },

        unmuteSelectedNotes: () => {
          set((state) => {
            const selectedIds = state.selectedNoteIds;
            for (const [, clip] of state.clips) {
              for (const note of clip.notes) {
                if (selectedIds.has(note.id)) {
                  note.muted = false;
                }
              }
              clip.isModified = true;
            }
          });
        },

        // Articulation
        setNoteArticulation: (noteId, articulationId) => {
          set((state) => {
            for (const [, clip] of state.clips) {
              const note = clip.notes.find(n => n.id === noteId);
              if (note) {
                note.articulationId = articulationId;
                clip.isModified = true;
                break;
              }
            }
          });
        },

        setSelectedNotesArticulation: (articulationId) => {
          set((state) => {
            const selectedIds = state.selectedNoteIds;
            for (const [, clip] of state.clips) {
              for (const note of clip.notes) {
                if (selectedIds.has(note.id)) {
                  note.articulationId = articulationId;
                }
              }
              clip.isModified = true;
            }
          });
        },

        // Brush Tool
        brushNotes: (pitch, startBeat, count, stepBeats, duration) => {
          set((state) => {
            const currentClipId = state.currentClipId;
            if (!currentClipId) return;
            const clip = state.clips.get(currentClipId);
            if (!clip) return;
            const idPrefix = Date.now().toString(36);
            for (let i = 0; i < count; i++) {
              clip.notes.push({
                id: `${idPrefix}-${i}`,
                pitch,
                velocity: 100,
                startBeat: startBeat + i * stepBeats,
                duration,
                channel: state.activeChannel,
              });
            }
            clip.isModified = true;
          });
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

/**
 * Editor-store handle for debugging and end-to-end tests, alongside
 * `window.__projectStore`.
 *
 * Development only. The piano roll takes its transport actions from this
 * store, so a test needs it to check that they reach the real transport
 * rather than clicking a button and hoping it found the right one.
 */
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    (window as unknown as Record<string, unknown>).__midiStore = useMidiStore;
}
