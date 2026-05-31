/**
 * Clip Editing System - Type Definitions
 * 
 * Comprehensive type system for professional DAW clip editing
 */

// =============================================================================
// Core Clip Types
// =============================================================================

export type ClipType = 'audio' | 'midi';

export interface Clip {
  id: string;
  trackId: string;
  type: ClipType;
  
  // Timing
  startTime: number;      // Start position in beats
  duration: number;       // Length in beats
  offset: number;         // Sample offset within source buffer
  
  // Audio reference
  bufferId?: string;      // Reference to audio buffer in cache
  fileUrl?: string;       // Source file URL
  
  // Metadata
  name: string;
  color: string;
  muted: boolean;
  loop: boolean;
  
  // Fade settings
  fadeIn: FadeSettings;
  fadeOut: FadeSettings;
  
  // Playback settings
  playbackRate: number;   // 0.25x - 4x, 1.0 = normal
  pitchOffset: number;    // Semitones, 0 = normal
  
  // Stretch/Time manipulation
  stretchMode: StretchMode;
  
  // MIDI specific
  notes?: MidiNote[];
  
  // Selection state (transient)
  isSelected?: boolean;
  isDragging?: boolean;
  
  // Visual cache
  waveformCache?: WaveformCache;
}

export interface FadeSettings {
  duration: number;       // Duration in beats
  curve: FadeCurveType;   // Linear, exponential, S-curve
  gain: number;           // Target gain (0-1)
}

export type FadeCurveType = 'linear' | 'exponential' | 'scurve' | 'logarithmic';

export type StretchMode = 'none' | 'time' | 'pitch' | 'both';

export interface MidiNote {
  id: string;
  start: number;          // Beat position
  duration: number;       // Length in beats
  pitch: number;          // MIDI note number (0-127)
  velocity: number;       // 0-127
}

export interface WaveformCache {
  peaks: Float32Array;    // Min/max pairs
  samplesPerPixel: number;
  width: number;
  height: number;
}

// =============================================================================
// Clip Editing Types
// =============================================================================

export type HandleType = 'left' | 'right' | 'body' | 'fadeIn' | 'fadeOut';

export interface ClipDragState {
  isDragging: boolean;
  clipId: string | null;
  handleType: HandleType | null;
  startX: number;
  startY: number;
  originalStartTime: number;
  originalDuration: number;
  originalOffset: number;
  shiftKey: boolean;
  altKey: boolean;
}

export interface ClipSelectionState {
  selectedClipIds: Set<string>;
  lastSelectedClipId: string | null;
}

export interface TrimOperation {
  clipId: string;
  edge: 'left' | 'right';
  newStartTime?: number;
  newDuration: number;
  newOffset?: number;
}

export interface SplitOperation {
  clipId: string;
  splitTime: number;      // Beat position to split at
}

export interface DuplicateOperation {
  clipId: string;
  offsetBeats: number;    // Distance to offset duplicate
}

export interface StretchOperation {
  clipId: string;
  newDuration: number;
  newPlaybackRate: number;
}

// =============================================================================
// Tool Types
// =============================================================================

export type EditTool = 'select' | 'split' | 'draw' | 'erase' | 'zoom' | 'mute';

export interface ToolState {
  currentTool: EditTool;
  cursor: string;
}

// =============================================================================
// Grid/Snap Types
// =============================================================================

export type GridDivision = '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/32' | '1/64';

export interface GridSettings {
  division: GridDivision;
  snapEnabled: boolean;
  snapThreshold: number;  // Pixels
  showGridLines: boolean;
}

export interface SnapResult {
  snapped: boolean;
  value: number;          // Snapped beat position
  distance: number;       // Distance to snap point
}

// =============================================================================
// Context Menu Types
// =============================================================================

export type ContextMenuAction = 
  | 'split'
  | 'duplicate'
  | 'delete'
  | 'reverse'
  | 'normalize'
  | 'rename'
  | 'mute'
  | 'solo'
  | 'lock'
  | 'unlock';

export interface ContextMenuItem {
  id: ContextMenuAction;
  label: string;
  icon: string;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  clipId: string | null;
}

// =============================================================================
// Audio Engine Integration Types
// =============================================================================

export interface ClipPlaybackState {
  clipId: string;
  sourceNode?: AudioBufferSourceNode;
  gainNode?: GainNode;
  startTime: number;      // AudioContext time
  scheduledEndTime?: number;
  isPlaying: boolean;
}

export interface FadeCurve {
  type: FadeCurveType;
  duration: number;
  startGain: number;
  endGain: number;
}

export interface ClipAudioConfig {
  buffer: AudioBuffer;
  playbackRate: number;
  detune: number;         // Cents
  fadeIn?: FadeCurve;
  fadeOut?: FadeCurve;
  gain: number;         // 0-1
}

// =============================================================================
// Visual/Rendering Types
// =============================================================================

export interface ClipVisualState {
  isSelected: boolean;
  isHovered: boolean;
  isDragging: boolean;
  isResizing: boolean;
  showHandles: boolean;
  showWaveform: boolean;
  showFades: boolean;
}

export interface WaveformRenderOptions {
  width: number;
  height: number;
  color: string;
  fadeInColor?: string;
  fadeOutColor?: string;
  backgroundColor?: string;
  sampleRate: number;
  pixelsPerSecond: number;
}

export interface ClipBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// =============================================================================
// Event Types
// =============================================================================

export interface ClipEvent {
  type: 'trim' | 'split' | 'move' | 'duplicate' | 'delete' | 'stretch' | 'fade';
  clipId: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export type ClipEventHandler = (event: ClipEvent) => void;

// =============================================================================
// History/Undo Types
// =============================================================================

export interface ClipEditHistory {
  past: ClipStateSnapshot[];
  future: ClipStateSnapshot[];
}

export interface ClipStateSnapshot {
  clips: Clip[];
  timestamp: number;
  description: string;
}
