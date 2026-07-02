import { MidiNote, MidiEditorState, MidiRegionChunk } from './types';
import { MoveMidiNotesCommand, RootStoreMidiApi } from './MidiCommands';
import type { MidiRenderer } from './MidiRenderer';

interface Viewport {
  startBeat: number;
  pixelsPerBeat: number;
  maxVisiblePitch: number;
  pixelsPerPitch: number;
}

export interface MidiToolContext {
  regionId: string;
  chunk: MidiRegionChunk;
  viewport: Viewport;
  editorState: MidiEditorState;
  store: RootStoreMidiApi;
  dispatchCommand: (cmd: any) => void;
  audioContext: AudioContext;
}

export abstract class MidiTool {
  constructor(protected context: MidiToolContext) {}
  abstract onPointerDown(e: PointerEvent, beat: number, pitch: number): void;
  abstract onPointerMove(e: PointerEvent, beat: number, pitch: number): void;
  abstract onPointerUp(e: PointerEvent, beat: number, pitch: number): void;
  abstract onCancel(): void;
}

export class MidiDrawTool extends MidiTool {
  private draggingNote: MidiNote | null = null;
  private startBeat = 0;
  private startPitch = 0;
  private originalNotes: MidiNote[] = [];

  onPointerDown(e: PointerEvent, beat: number, pitch: number) {
    // Basic hit test: find note under cursor
    const exactPitch = Math.floor(pitch);
    const hitNote = this.context.chunk.notes.find(n => 
      beat >= n.startBeat && beat <= n.startBeat + n.duration && n.pitch === exactPitch
    );

    if (hitNote) {
      this.draggingNote = { ...hitNote };
      this.startBeat = hitNote.startBeat;
      this.startPitch = hitNote.pitch;
      this.originalNotes = [hitNote];
    } else {
      // Implementation omitted: create new note block
    }
  }

  onPointerMove(e: PointerEvent, beat: number, pitch: number) {
    if (this.draggingNote) {
      // Update ephemeral UI state via Redux (NOT playback state)
      // This provides 60fps dragging without triggering heavy DSP invalidations
      // Example: store.dispatch(setEphemeralGhostNotes(...))
    }
  }

  onPointerUp(e: PointerEvent, beat: number, pitch: number) {
    if (this.draggingNote) {
      const deltaBeat = beat - this.startBeat;
      const deltaPitch = Math.floor(pitch) - this.startPitch;

      const newNote = {
        ...this.draggingNote,
        startBeat: Math.max(0, this.draggingNote.startBeat + deltaBeat),
        pitch: Math.max(0, Math.min(127, this.draggingNote.pitch + deltaPitch))
      };

      // Finalize move with an undoable command
      const cmd = new MoveMidiNotesCommand(
        this.context.regionId,
        this.context.chunk.id,
        [newNote],
        this.originalNotes
      );
      this.context.dispatchCommand(cmd);
      this.draggingNote = null;
    }
  }

  onCancel() {
    // Revert ephemeral UI state
    this.draggingNote = null;
  }
}
