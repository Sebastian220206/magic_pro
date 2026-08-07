/**
 * MIDI Event Types - Comprehensive Event List for MIDI Editing
 *
 * Supports all standard MIDI message types plus:
 * - Meta events (tempo, time signature, key signature, text)
 * - System exclusive messages
 * - Multi-track events
 * - Event groups (note on/off pairs)
 */

import { MidiNote } from './types';

// =============================================================================
// Base Event Types
// =============================================================================

export type EventType =
  | 'note-on'
  | 'note-off'
  | 'poly-aftertouch'
  | 'control-change'
  | 'program-change'
  | 'channel-aftertouch'
  | 'pitch-bend'
  | 'system-exclusive'
  | 'meta-text'
  | 'meta-tempo'
  | 'meta-time-signature'
  | 'meta-key-signature'
  | 'meta-marker'
  | 'meta-cue-point'
  | 'meta-program-name'
  | 'meta-track-name';

export interface BaseMidiEvent {
  id: string;
  type: EventType;
  tick: number;           // Position in ticks (from sequence start)
  beat: number;           // Position in beats
  channel: number;        // MIDI channel 0-15
  trackIndex: number;     // Track index in sequence
  selected: boolean;
  muted: boolean;
}

// =============================================================================
// Note Events (paired Note On + Note Off)
// =============================================================================

export interface NoteEvent extends BaseMidiEvent {
  type: 'note-on' | 'note-off';
  pitch: number;          // 0-127
  velocity: number;       // 0-127
  duration: number;       // In ticks
  durationBeats: number;  // In beats
  noteOffTick: number;    // Tick position of corresponding Note Off
}

// =============================================================================
// Channel Voice Messages
// =============================================================================

export interface PolyAftertouchEvent extends BaseMidiEvent {
  type: 'poly-aftertouch';
  pitch: number;          // 0-127
  pressure: number;       // 0-127
}

export interface ControlChangeEvent extends BaseMidiEvent {
  type: 'control-change';
  controller: number;     // 0-127 (CC number)
  value: number;          // 0-127
  controllerName?: string; // Human-readable name (e.g., "Modulation Wheel")
}

export interface ProgramChangeEvent extends BaseMidiEvent {
  type: 'program-change';
  program: number;        // 0-127
  bankMsb?: number;       // Bank select MSB (0-127)
  bankLsb?: number;       // Bank select LSB (0-127)
  programName?: string;   // Human-readable name (e.g., "Acoustic Grand Piano")
}

export interface ChannelAftertouchEvent extends BaseMidiEvent {
  type: 'channel-aftertouch';
  pressure: number;       // 0-127
}

export interface PitchBendEvent extends BaseMidiEvent {
  type: 'pitch-bend';
  value: number;          // 0-16383 (14-bit value)
  valueCentered: number;  // -1.0 to 1.0 (centered at 0)
}

// =============================================================================
// System Exclusive
// =============================================================================

export interface SystemExclusiveEvent extends BaseMidiEvent {
  type: 'system-exclusive';
  manufacturerId: number; // Manufacturer ID
  data: Uint8Array;       // Raw SysEx data
  dataString?: string;    // Hex string representation
}

// =============================================================================
// Meta Events
// =============================================================================

export interface MetaEvent extends BaseMidiEvent {
  type: 'meta-text' | 'meta-tempo' | 'meta-time-signature' | 'meta-key-signature'
      | 'meta-marker' | 'meta-cue-point' | 'meta-program-name' | 'meta-track-name';
}

export interface MetaTextEvent extends MetaEvent {
  type: 'meta-text' | 'meta-marker' | 'meta-cue-point' | 'meta-program-name' | 'meta-track-name';
  text: string;
  textType?: string;      // Specific text type (copyright, lyric, etc.)
}

export interface MetaTempoEvent extends MetaEvent {
  type: 'meta-tempo';
  bpm: number;            // Beats per minute
  microsecondsPerBeat: number; // For exact timing
}

export interface MetaTimeSignatureEvent extends MetaEvent {
  type: 'meta-time-signature';
  numerator: number;
  denominator: number;
  clocksPerClick: number;
  notated32ndNotesPerBeat: number;
}

export interface MetaKeySignatureEvent extends MetaEvent {
  type: 'meta-key-signature';
  key: string;            // e.g., "C", "Gm", "Eb"
  sharpsFlats: number;    // -7 to 7
  mode: 'major' | 'minor';
}

// =============================================================================
// Union Type
// =============================================================================

export type MidiEvent =
  | NoteEvent
  | PolyAftertouchEvent
  | ControlChangeEvent
  | ProgramChangeEvent
  | ChannelAftertouchEvent
  | PitchBendEvent
  | SystemExclusiveEvent
  | MetaTextEvent
  | MetaTempoEvent
  | MetaTimeSignatureEvent
  | MetaKeySignatureEvent;

// =============================================================================
// Event Display
// =============================================================================

export interface EventDisplayProperties {
  color: string;
  icon: string;
  label: string;
  description: string;
}

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  'note-on': '#3B82F6',
  'note-off': '#3B82F6',
  'poly-aftertouch': '#8B5CF6',
  'control-change': '#10B981',
  'program-change': '#F59E0B',
  'channel-aftertouch': '#8B5CF6',
  'pitch-bend': '#EF4444',
  'system-exclusive': '#6B7280',
  'meta-text': '#6B7280',
  'meta-tempo': '#EC4899',
  'meta-time-signature': '#EC4899',
  'meta-key-signature': '#EC4899',
  'meta-marker': '#F59E0B',
  'meta-cue-point': '#F59E0B',
  'meta-program-name': '#6B7280',
  'meta-track-name': '#6B7280',
};

export const EVENT_TYPE_ICONS: Record<EventType, string> = {
  'note-on': '♪',
  'note-off': '♪',
  'poly-aftertouch': '◆',
  'control-change': '⊞',
  'program-change': '⊟',
  'channel-aftertouch': '◆',
  'pitch-bend': '↕',
  'system-exclusive': '⬡',
  'meta-text': 'T',
  'meta-tempo': '♩',
  'meta-time-signature': '.AllowUser',
  'meta-key-signature': '♯',
  'meta-marker': '◆',
  'meta-cue-point': '◆',
  'meta-program-name': '⊟',
  'meta-track-name': '⊟',
};

// =============================================================================
// Sorting
// =============================================================================

export type EventSortField = 'tick' | 'type' | 'channel' | 'pitch' | 'velocity' | 'controller' | 'trackIndex';
export type SortDirection = 'asc' | 'desc';

export interface EventSortOptions {
  field: EventSortField;
  direction: SortDirection;
}

// =============================================================================
// Event Editing
// =============================================================================

export interface EventEditDelta {
  tick?: number;
  channel?: number;
  pitch?: number;
  velocity?: number;
  controller?: number;
  value?: number;
  program?: number;
  text?: string;
  bpm?: number;
  numerator?: number;
  denominator?: number;
}

// =============================================================================
// Conversion Helpers
// =============================================================================

export function midiNoteToEvent(note: MidiNote, trackIndex: number = 0): NoteEvent {
  const noteOffTick = note.startBeat + note.duration;
  return {
    id: note.id,
    type: 'note-on',
    tick: note.startBeat,
    beat: note.startBeat,
    channel: note.channel ?? 0,
    trackIndex,
    selected: note.selected ?? false,
    muted: note.muted ?? false,
    pitch: note.pitch,
    velocity: note.velocity,
    duration: note.duration,
    durationBeats: note.duration,
    noteOffTick,
  };
}

export function eventToMidiNote(event: NoteEvent): MidiNote {
  return {
    id: event.id,
    pitch: event.pitch,
    velocity: event.velocity,
    startBeat: event.beat,
    duration: event.durationBeats,
    channel: event.channel,
    muted: event.muted,
    selected: event.selected,
  };
}

// =============================================================================
// CC Number Names
// =============================================================================

export const CC_NAMES: Record<number, string> = {
  0: 'Bank Select (MSB)',
  1: 'Modulation Wheel',
  2: 'Breath Controller',
  4: 'Foot Controller',
  5: 'Portamento Time',
  6: 'Data Entry (MSB)',
  7: 'Channel Volume',
  8: 'Balance',
  10: 'Pan',
  11: 'Expression',
  12: 'Effect Control 1',
  13: 'Effect Control 2',
  16: 'General Purpose 1',
  17: 'General Purpose 2',
  18: 'General Purpose 3',
  19: 'General Purpose 4',
  32: 'Bank Select (LSB)',
  33: 'Modulation Wheel (LSB)',
  34: 'Breath Controller (LSB)',
  36: 'Foot Controller (LSB)',
  37: 'Portamento Time (LSB)',
  38: 'Data Entry (LSB)',
  39: 'Channel Volume (LSB)',
  40: 'Balance (LSB)',
  42: 'Pan (LSB)',
  43: 'Expression (LSB)',
  44: 'Effect Control 1 (LSB)',
  45: 'Effect Control 2 (LSB)',
  48: 'General Purpose 1 (LSB)',
  49: 'General Purpose 2 (LSB)',
  50: 'General Purpose 3 (LSB)',
  51: 'General Purpose 4 (LSB)',
  64: 'Sustain Pedal',
  65: 'Portamento On/Off',
  66: 'Sostenuto',
  67: 'Soft Pedal',
  68: 'Legato Footswitch',
  69: 'Hold 2',
  70: 'Sound Controller 1 (Sound Variation)',
  71: 'Sound Controller 2 (Resonance)',
  72: 'Sound Controller 3 (Release Time)',
  73: 'Sound Controller 4 (Attack Time)',
  74: 'Sound Controller 5 (Brightness)',
  75: 'Sound Controller 6',
  76: 'Sound Controller 7',
  77: 'Sound Controller 8',
  78: 'Sound Controller 9',
  79: 'Sound Controller 10',
  80: 'General Purpose 5',
  81: 'General Purpose 6',
  82: 'General Purpose 7',
  83: 'General Purpose 8',
  84: 'Portamento Control',
  91: 'Effects 1 Depth (Reverb)',
  92: 'Effects 2 Depth (Tremolo)',
  93: 'Effects 3 Depth (Chorus)',
  94: 'Effects 4 Depth (Detune)',
  95: 'Effects 5 Depth (Phaser)',
  96: 'Data Increment',
  97: 'Data Decrement',
  98: 'Non-Registered Parameter Number (LSB)',
  99: 'Non-Registered Parameter Number (MSB)',
  100: 'Registered Parameter Number (LSB)',
  101: 'Registered Parameter Number (MSB)',
  120: 'All Sound Off',
  121: 'Reset All Controllers',
  122: 'Local Control On/Off',
  123: 'All Notes Off',
  124: 'Omni Mode Off',
  125: 'Omni Mode On',
  126: 'Mono Mode',
  127: 'Poly Mode',
};

export function getControllerName(controller: number): string {
  return CC_NAMES[controller] ?? `CC${controller}`;
}

export default MidiEvent;
