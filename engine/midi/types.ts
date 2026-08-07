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
  slide?: boolean;      // FL Studio style slide
  portamento?: boolean; // FL Studio style portamento
  muted?: boolean;      // Playback state
  selected?: boolean;   // Editor compatibility flag
  color?: string;       // Per-note color for visual organization
  articulationId?: number; // Articulation ID (0-127)
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

export interface TimeSignatureEvent {
  beat: number;
  numerator: number;
  denominator: number;
}

export interface MidiRegion {
  id: string;
  trackId: string;
  startBeat: number;
  durationBeats: number;
  chunks: MidiRegionChunk[]; // Replaces linear `notes: MidiNote[]`
  notes: MidiNote[]; // compatibility with editor/store paths
  timeSignatures: TimeSignatureEvent[]; // Time signature changes within the clip
  
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

export type PianoRollTool = 'select' | 'draw' | 'erase' | 'velocity' | 'lasso' | 'mute' | 'brush' | 'scissors' | 'glue' | 'finger' | 'quantize' | 'zoom' | 'automation-select' | 'automation-curve';

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
  type: 'move' | 'resize-left' | 'resize-right' | 'velocity' | 'select' | 'lasso' | null;
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
  zoomLevel: ZoomLevel;
  scrollPosition: ScrollPosition;
  viewport: Viewport;
  currentTool: PianoRollTool;
  activeChannel: number;
  slideMode: boolean;
  portaMode: boolean;
  gridSettings: GridSettings;
  drawDuration: number;
  lassoSelection: {
    active: boolean;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    startBeat: number;
    endBeat: number;
  } | null;
  stepInputEnabled: boolean;
  stepGridDivision: GridDivision;
  selectedNoteIds: Set<string>;
  draggingState: DragState | null;
  clipboard: MidiNote[];
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
  scaleKey?: number;        // 0-11 root note of scale
  scaleType?: ScaleType;    // Scale for scale quantization
}

// =============================================================================
// Scale & Key Types
// =============================================================================

export type ScaleType = 'major' | 'minor' | 'dorian' | 'mixolydian' | 'natural-minor' | 'harmonic-minor' | 'pentatonic' | 'blues' | 'chromatic';

export const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  'natural-minor': [0, 2, 3, 5, 7, 8, 10],
  'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export const SCALE_NAMES: Record<ScaleType, string> = {
  major: 'Major',
  minor: 'Minor',
  dorian: 'Dorian',
  mixolydian: 'Mixolydian',
  'natural-minor': 'Natural Minor',
  'harmonic-minor': 'Harmonic Minor',
  pentatonic: 'Pentatonic',
  blues: 'Blues',
  chromatic: 'Chromatic',
};

export function getScalePitches(root: number, scale: ScaleType): number[] {
  const intervals = SCALE_INTERVALS[scale];
  return intervals.map(interval => root + interval);
}

export function isPitchInScale(pitch: number, root: number, scale: ScaleType): boolean {
  const scalePitches = getScalePitches(root, scale);
  const normalized = pitch % 12;
  return scalePitches.some(p => p % 12 === normalized);
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
// CC Automation Types
// =============================================================================

export interface CCPoint {
  beat: number;
  value: number;  // 0-127
}

export interface CCLane {
  id: string;
  controller: number;  // MIDI CC number (0-127)
  name: string;
  color: string;
  points: CCPoint[];
  visible: boolean;
  height: number;  // Lane height in pixels
}

export const DEFAULT_CC_LANES: CCLane[] = [
  { id: 'cc-1', controller: 1, name: 'Mod Wheel', color: '#3B82F6', points: [], visible: true, height: 80 },
  { id: 'cc-7', controller: 7, name: 'Volume', color: '#10B981', points: [], visible: true, height: 80 },
  { id: 'cc-10', controller: 10, name: 'Pan', color: '#F59E0B', points: [], visible: true, height: 80 },
  { id: 'cc-11', controller: 11, name: 'Expression', color: '#EF4444', points: [], visible: true, height: 80 },
  { id: 'cc-64', controller: 64, name: 'Sustain', color: '#8B5CF6', points: [], visible: true, height: 80 },
  { id: 'cc-74', controller: 74, name: 'Filter Cutoff', color: '#EC4899', points: [], visible: true, height: 80 },
  { id: 'cc-91', controller: 91, name: 'Reverb Send', color: '#06B6D4', points: [], visible: true, height: 80 },
  { id: 'cc-93', controller: 93, name: 'Chorus Send', color: '#84CC16', points: [], visible: true, height: 80 },
];

export const CC_NAMES: Record<number, string> = {
  1: 'Mod Wheel',
  2: 'Breath Control',
  4: 'Foot Controller',
  5: 'Portamento Time',
  7: 'Volume',
  8: 'Balance',
  10: 'Pan',
  11: 'Expression',
  12: 'Effect Control 1',
  13: 'Effect Control 2',
  16: 'General Purpose 1',
  17: 'General Purpose 2',
  18: 'General Purpose 3',
  19: 'General Purpose 4',
  64: 'Sustain Pedal',
  65: 'Portamento',
  66: 'Sostenuto',
  67: 'Soft Pedal',
  68: 'Legato Footswitch',
  69: 'Hold 2',
  70: 'Sound Variation',
  71: 'Timbre/Harmonic Intensity',
  72: 'Release Time',
  73: 'Attack Time',
  74: 'Brightness/Filter Cutoff',
  75: 'Decay Time',
  76: 'Vibrato Rate',
  77: 'Vibrato Depth',
  78: 'Vibrato Delay',
  79: 'Sound Controller 10',
  80: 'General Purpose 5',
  81: 'General Purpose 6',
  82: 'General Purpose 7',
  83: 'General Purpose 8',
  84: 'Portamento Control',
  91: 'Reverb Send',
  92: 'Tremolo Send',
  93: 'Chorus Send',
  94: 'Celeste Send',
  95: 'Phaser Send',
  96: 'Data Increment',
  97: 'Data Decrement',
  98: 'NRPN LSB',
  99: 'NRPN MSB',
  100: 'RPN LSB',
  101: 'RPN MSB',
  120: 'All Sound Off',
  121: 'Reset All Controllers',
  122: 'Local Control',
  123: 'All Notes Off',
  124: 'Omni Off',
  125: 'Omni On',
  126: 'Mono On',
  127: 'Poly On',
};

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
  channel: number = 0,
  slide: boolean = false,
  portamento: boolean = false
): MidiNote {
  return {
    id: generateNoteId(),
    pitch: clampPitch(pitch),
    velocity: clampVelocity(velocity),
    startBeat,
    duration,
    channel,
    slide,
    portamento,
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
