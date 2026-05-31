# Professional MIDI System Architecture

## Overview

This document describes the architecture of a professional MIDI piano roll system for a browser-based DAW, similar to Logic Pro or Ableton Live.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MIDI SYSTEM ARCHITECTURE                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW                                        │
└─────────────────────────────────────────────────────────────────────────────┘

MIDI Data Flow:
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PIANO ROLL EDITOR                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ PianoKeyboard│  │   MidiGrid   │  │  MidiNotes   │  │ VelocityLane │      │
│  │  (vertical)  │  │ (horizontal) │  │ (rectangles) │  │ (bar graph)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘      │
│        ↓                  ↓                 ↓                 ↓               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                     MIDI STORE (Zustand)                                  │ │
│  │  • midiClips[]  • selectedNotes[]  • currentTool  • gridDivision       │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                      ↓                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                     MIDI SCHEDULER                                       │ │
│  │  • Beat → Time conversion                                              │ │
│  │  • Note scheduling with Web Audio clock                                  │ │
│  │  • Instrument triggering                                                 │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                      ↓                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                     INSTRUMENTS                                        │ │
│  │  • Synth (Oscillator + Envelope)                                        │ │
│  │  • Sampler (AudioBuffer playback)                                        │ │
│  │  • External MIDI (Web MIDI API)                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

Signal Flow:

┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  MidiClip   │───→│  Scheduler  │───→│  Instrument │───→│Mix Channel  │
│  (notes)    │    │  (timing)   │    │  (audio)    │    │  (gain/pan) │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
     ↑
┌─────────────┐
│ Piano Roll  │
│  (editor)   │
└─────────────┘
```

## Component Structure

```
components/midi/
├── PianoRoll.tsx           # Main container component
├── PianoKeyboard.tsx       # Vertical piano keys
├── MidiGrid.tsx           # Time grid with beat lines
├── MidiNote.tsx           # Individual note rectangle
├── VelocityLane.tsx       # Velocity editor bar graph
├── PianoRollTools.tsx     # Tool selection toolbar
└── PianoRollRuler.tsx     # Time ruler/transport

engine/midi/
├── types.ts               # MIDI data model types
├── midiScheduler.ts       # Note scheduling/playback
├── midiEditor.ts          # Note editing operations
├── quantization.ts        # Grid quantization
├── midiTransforms.ts      # Transpose, humanize, etc.
└── pianoRollRenderer.ts   # Grid/note rendering

store/
└── midiStore.ts           # Zustand store for MIDI state
```

## Data Model

### MidiNote
```typescript
interface MidiNote {
  id: string;
  pitch: number;        // 0-127 (MIDI standard)
  velocity: number;     // 0-127
  startBeat: number;    // Position in beats
  duration: number;     // Length in beats
  channel?: number;     // MIDI channel 0-15
  selected?: boolean;   // UI selection state
}
```

### MidiClip
```typescript
interface MidiClip {
  id: string;
  trackId: string;      // Associated track
  startBeat: number;    // Clip start position
  length: number;       // Clip duration
  notes: MidiNote[];    // Notes within clip
  color?: string;       // UI color
  name?: string;        // Clip name
}
```

### Piano Roll State
```typescript
interface PianoRollState {
  // Display
  zoomLevel: { x: number; y: number };
  scrollPosition: { x: number; y: number };
  viewport: { startBeat: number; endBeat: number; lowPitch: number; highPitch: number };
  
  // Tools
  currentTool: 'select' | 'draw' | 'erase' | 'velocity';
  
  // Grid
  gridDivision: number; // 4=1/4, 8=1/8, 16=1/16, etc.
  snapToGrid: boolean;
  
  // Editing
  selectedNoteIds: Set<string>;
  draggingState: DragState | null;
  
  // Data
  currentClip: MidiClip | null;
}
```

## Web Audio API Integration

### MIDI Scheduling
```typescript
// Convert beats to seconds
function beatsToSeconds(beats: number, bpm: number): number {
  return (beats / bpm) * 60;
}

// Schedule a note
function scheduleNote(
  note: MidiNote,
  clipStartBeat: number,
  audioContext: AudioContext,
  instrument: Instrument
): void {
  const startTime = audioContext.currentTime + 
    beatsToSeconds(note.startBeat + clipStartBeat, tempo);
  const duration = beatsToSeconds(note.duration, tempo);
  
  instrument.trigger(note.pitch, startTime, duration, note.velocity);
}
```

## Performance Strategy

### Virtual Rendering
- Only render notes within viewport
- Calculate visible pitch range (typically C2-C7 = 60 notes)
- Calculate visible time range based on zoom
- Use `requestAnimationFrame` for smooth scrolling

### Memoization
- `React.memo` on `MidiNote` components
- Memoized grid line calculations
- Cached note position calculations

### Drag Optimization
- Use pointer events for 60fps drag
- Update local state during drag, batch store updates
- Throttle store updates to 16ms

## Keyboard Shortcuts

| Key | Tool |
|-----|------|
| `B` | Draw Tool |
| `E` | Erase Tool |
| `V` | Velocity Tool |
| `S` | Select Tool |
| `Delete` | Delete selected notes |
| `Alt+Drag` | Duplicate note |
| `Shift+Click` | Add to selection |
| `Cmd+A` | Select all |
| `↑/↓` | Transpose selected |
| `←/→` | Nudge selected |
| `1-4` | Grid division (1/4, 1/8, 1/16, 1/32) |
| `Q` | Quantize selected |

## Quantization

```typescript
function quantizeNote(note: MidiNote, gridDivision: number): MidiNote {
  const gridSize = 4 / gridDivision; // 1/4 = 1.0, 1/16 = 0.25
  const quantizedStart = Math.round(note.startBeat / gridSize) * gridSize;
  
  return {
    ...note,
    startBeat: quantizedStart,
  };
}
```

## File Structure

```
engine/midi/
├── README_MIDI.md           # This file
├── types.ts                 # MIDI data types
├── midiScheduler.ts         # Playback scheduling
├── midiEditor.ts            # Note operations
├── quantization.ts          # Quantization logic
├── midiTransforms.ts        # Transform tools
└── pianoRollRenderer.ts     # Rendering helpers

components/midi/
├── PianoRoll.tsx
├── PianoKeyboard.tsx
├── MidiGrid.tsx
├── MidiNote.tsx
├── VelocityLane.tsx
├── PianoRollTools.tsx
└── PianoRollRuler.tsx

store/
└── midiStore.ts

hooks/
├── useMidiPlayback.ts
├── usePianoRoll.ts
└── useMidiEditing.ts
```

## API Reference

### MidiEditor
```typescript
class MidiEditor {
  // Note operations
  addNote(clip: MidiClip, note: Omit<MidiNote, 'id'>): MidiNote;
  deleteNote(clip: MidiClip, noteId: string): void;
  moveNote(note: MidiNote, deltaBeats: number, deltaPitch: number): MidiNote;
  resizeNote(note: MidiNote, newDuration: number): MidiNote;
  setVelocity(note: MidiNote, velocity: number): MidiNote;
  
  // Selection
  selectNote(note: MidiNote, addToSelection: boolean): void;
  selectNotesInRange(notes: MidiNote[], startBeat: number, endBeat: number, lowPitch: number, highPitch: number): void;
  clearSelection(): void;
  
  // Transforms
  transposeNotes(notes: MidiNote[], semitones: number): MidiNote[];
  humanizeNotes(notes: MidiNote[], timingVariance: number, velocityVariance: number): MidiNote[];
  scaleVelocity(notes: MidiNote[], factor: number): MidiNote[];
  randomizeVelocity(notes: MidiNote[], min: number, max: number): MidiNote[];
  
  // Quantization
  quantizeNotes(notes: MidiNote[], gridDivision: number, strength?: number): MidiNote[];
}
```

### MidiScheduler
```typescript
class MidiScheduler {
  constructor(audioContext: AudioContext);
  
  // Playback
  scheduleClip(clip: MidiClip, startTime: number, tempo: number): void;
  unscheduleClip(clipId: string): void;
  
  // Control
  start(): void;
  stop(): void;
  setTempo(bpm: number): void;
  
  // Instruments
  setInstrument(trackId: string, instrument: Instrument): void;
}
```

## Integration with Timeline

```typescript
// Connect MIDI clip to piano roll
function openMidiClipInPianoRoll(clip: MidiClip): void {
  midiStore.setCurrentClip(clip);
  uiStore.openPanel('pianoRoll');
}

// Schedule MIDI clip for playback
function scheduleMidiClip(
  clip: MidiClip,
  scheduler: MidiScheduler,
  startBeat: number,
  tempo: number
): void {
  const startTime = beatsToSeconds(startBeat, tempo);
  scheduler.scheduleClip(clip, startTime, tempo);
}
```

## Pitch to Note Name Mapping

```typescript
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function pitchToNoteName(pitch: number): string {
  const octave = Math.floor(pitch / 12) - 1;
  const noteIndex = pitch % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

function noteNameToPitch(noteName: string): number {
  // Parse "C4" → 60
  const match = noteName.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return 60;
  
  const note = match[1];
  const octave = parseInt(match[2]);
  const noteIndex = NOTE_NAMES.indexOf(note);
  
  return (octave + 1) * 12 + noteIndex;
}
```

## Future Enhancements

1. **MIDI Effects**: Arpeggiator, chord generator, scale quantizer
2. **Controllers**: CC automation lanes (modulation, pitch bend)
3. **Import/Export**: MIDI file import/export
4. **Step Sequencer**: Alternative drum programming interface
5. **Score Editor**: Traditional notation view
6. **MIDI Learn**: Map hardware controllers
7. **Groove Templates**: Swing/shuffle quantization

## References

- MIDI Specification: https://www.midi.org/specifications
- Web MIDI API: https://webaudio.github.io/web-midi-api/
- Web Audio API: https://webaudio.github.io/web-audio-api/
