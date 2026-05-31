/**
 * MIDI Types - Professional MIDI data model for browser DAW
 */

// =============================================================================
// Core MIDI Types
// =============================================================================

// 1. PURE MUSICAL STATE (Strictly for playback & serialization)
export interface MidiNote {
  id: string;
  pitch: number;        // 0-127 (MIDI standard)
  velocity: number;     // 0-127
  startBeat: number;    // Position in beats (can be fractional)
  duration: number;     // Length in beats
  channel?: number;     // MIDI channel 0-15 (default 0)
  muted?: boolean;      // Playback state
  selected?: boolean;   // Editor compatibility flag
}

// 2. EDITOR STATE (Ephemeral UI state, explicitly kept out of core engine)
export interface MidiEditorState {
  selectedNoteIds: Set<string>;
  hoveredNoteId: string | null;
  activeGhostNotes: Record<string, MidiNote>;
}

// 3. PLAYBACK STATE (Real-time DSP state tracking)
export interface MidiPlaybackState {
  activeVoices: Map<string, { noteId: string, oscNodeId: string, triggerTime: number }>;
}

// 4. CHUNKING ARCHITECTURE (For 100k+ notes)
export interface MidiRegionChunk {
  id: string;
  startBeat: number;
  endBeat: number;
  notes: MidiNote[]; // Max ~1000 notes per chunk
}

export interface MidiRegion {
  id: string;
  trackId: string;
  startBeat: number;
  durationBeats: number;
  chunks: MidiRegionChunk[]; // Replaces linear `notes: MidiNote[]`
  notes: MidiNote[]; // compatibility with editor/store paths
  
  // Backwards compatibility / ephemeral fields
  color?: string;
  name?: string;
  loop?: boolean;
}

// Keep MidiClip as an alias for compatibility
export type MidiClip = MidiRegion;

// =============================================================================
// Piano Roll State Types
// =============================================================================

export type PianoRollTool = 'select' | 'draw' | 'erase' | 'velocity';

export interface ZoomLevel {
  x: number;  // Horizontal zoom (beats per pixel)
  y: number;  // Vertical zoom (pixels per semitone)
}

export interface ScrollPosition {
  x: number;  // Scroll in pixels
  y: number;  // Scroll in pixels
}

export interface Viewport {
  startBeat: number;
  endBeat: number;
  lowPitch: number;   // Lowest visible pitch (0-127)
  highPitch: number;   // Highest visible pitch (0-127)
}

export interface DragState {
  type: 'move' | 'resize-left' | 'resize-right' | 'velocity' | 'select' | null;
  noteId: string | null;
  startX: number;
  startY: number;
  originalStartBeat: number;
  originalPitch: number;
  originalDuration: number;
  originalVelocity: number;
  deltaX: number;
  deltaY: number;
}

// =============================================================================
// Grid Types
// =============================================================================

export type GridDivision = 1 | 2 | 4 | 8 | 16 | 32 | 64 | 128 | 256;

export interface GridSettings {
  division: GridDivision;
  snap: boolean;
  showSubdivisions: boolean;
}

// =============================================================================
// Editor State
// =============================================================================

export interface PianoRollEditorState {
  // Display
  zoomLevel: ZoomLevel;
  scrollPosition: ScrollPosition;
  viewport: Viewport;
  
  // Tools
  currentTool: PianoRollTool;
  
  // Grid
  gridSettings: GridSettings;
  
  // Editing
  selectedNoteIds: Set<string>;
  draggingState: DragState | null;
  clipboard: MidiNote[];
  
  // Data
  currentClipId: string | null;
}

// =============================================================================
// Transform Types
// =============================================================================

export interface HumanizeOptions {
  timingVariance: number;   // +/- beats
  velocityVariance: number; // +/- velocity
}

export interface QuantizeOptions {
  gridDivision: GridDivision;
  strength: number;         // 0-1 (0=no quantize, 1=full quantize)
  swing?: number;           // 0-1 swing amount
}

// =============================================================================
// Instrument Types
// =============================================================================

export interface MidiInstrument {
  id: string;
  name: string;
  type: 'synth' | 'sampler' | 'external';
  trigger: (pitch: number, startTime: number, duration: number, velocity: number) => void;
  release: (pitch: number) => void;
  setParameter: (param: string, value: number) => void;
}

// =============================================================================
// Event Types
// =============================================================================

export type MidiNoteEvent = 
  | { type: 'note-on'; pitch: number; velocity: number; time: number }
  | { type: 'note-off'; pitch: number; time: number };

// =============================================================================
// Utility Functions
// =============================================================================

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTE_NAMES_SHARP = NOTE_NAMES;
export const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Convert pitch number to note name
 * @param pitch 0-127
 * @param useSharps Use sharp notation (default) or flats
 */
export function pitchToNoteName(pitch: number, useSharps: boolean = true): string {
  if (pitch < 0 || pitch > 127) return '??';
  const octave = Math.floor(pitch / 12) - 1;
  const noteIndex = pitch % 12;
  const names = useSharps ? NOTE_NAMES_SHARP : NOTE_NAMES_FLAT;
  return `${names[noteIndex]}${octave}`;
}

/**
 * Convert note name to pitch number
 * @param noteName e.g., "C4", "F#3", "Bb5"
 */
export function noteNameToPitch(noteName: string): number {
  const match = noteName.match(/^([A-G][#b]?)(-?\d+)$/i);
  if (!match) return 60; // Default to middle C
  
  const note = match[1].toUpperCase();
  const octave = parseInt(match[2]);
  
  const noteIndex = NOTE_NAMES_SHARP.indexOf(note);
  if (noteIndex === -1) return 60;
  
  return (octave + 1) * 12 + noteIndex;
}

/**
 * Check if pitch is a black key
 */
export function isBlackKey(pitch: number): boolean {
  const noteIndex = pitch % 12;
  return [1, 3, 6, 8, 10].includes(noteIndex);
}

/**
 * Check if pitch is a white key
 */
export function isWhiteKey(pitch: number): boolean {
  return !isBlackKey(pitch);
}

/**
 * Get frequency from MIDI pitch
 */
export function pitchToFrequency(pitch: number): number {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}

/**
 * Get MIDI pitch from frequency
 */
export function frequencyToPitch(frequency: number): number {
  return 69 + 12 * Math.log2(frequency / 440);
}

/**
 * Clamp velocity to valid range
 */
export function clampVelocity(velocity: number): number {
  return Math.max(0, Math.min(127, Math.round(velocity)));
}

/**
 * Clamp pitch to valid range
 */
export function clampPitch(pitch: number): number {
  return Math.max(0, Math.min(127, Math.round(pitch)));
}

/**
 * Generate unique note ID
 */
export function generateNoteId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate unique clip ID
 */
export function generateClipId(): string {
  return `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new note with defaults
 */
export function createNote(
  pitch: number,
  startBeat: number,
  duration: number,
  velocity: number = 100,
  channel: number = 0
): MidiNote {
  return {
    id: generateNoteId(),
    pitch: clampPitch(pitch),
    velocity: clampVelocity(velocity),
    startBeat,
    duration,
    channel,
    muted: false,
    selected: false,
  };
}

/**
 * Clone a note with new ID
 */
export function cloneNote(note: MidiNote, newId?: string): MidiNote {
  return {
    ...note,
    id: newId || generateNoteId(),
    muted: note.muted || false,
  };
}

/**
 * Sort notes by start time, then pitch
 */
export function sortNotes(notes: MidiNote[]): MidiNote[] {
  return [...notes].sort((a, b) => {
    if (a.startBeat !== b.startBeat) {
      return a.startBeat - b.startBeat;
    }
    return a.pitch - b.pitch;
  });
}

/**
 * Get note range from array of notes
 */
export function getNoteRange(notes: MidiNote[]): { min: number; max: number } | null {
  if (notes.length === 0) return null;
  
  let min = 127;
  let max = 0;
  
  for (const note of notes) {
    min = Math.min(min, note.pitch);
    max = Math.max(max, note.pitch);
  }
  
  return { min, max };
}

/**
 * Get time range from array of notes
 */
export function getTimeRange(notes: MidiNote[]): { start: number; end: number } | null {
  if (notes.length === 0) return null;
  
  let start = Infinity;
  let end = 0;
  
  for (const note of notes) {
    start = Math.min(start, note.startBeat);
    end = Math.max(end, note.startBeat + note.duration);
  }
  
  return { start, end };
}
