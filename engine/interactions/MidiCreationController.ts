import { SnapEngine } from '@/engine/editor/SnapEngine';
import { CoordinateSystem } from '@/engine/editor/CoordinateSystem';
import { useProjectStore } from '@/store/projectStore';

export interface MidiNotePreviewState {
  clipId: string;
  pitch: number;
  startBeat: number;
  endBeat: number;
  duration: number;
  velocity: number;
}

export class MidiCreationController {
  private previewState: MidiNotePreviewState | null = null;
  private defaultDuration: number = 0.25;
  private createdNoteIds: string[] = [];

  setDefaultDuration(beats: number) {
    this.defaultDuration = Math.max(0.0625, beats);
  }

  getDefaultDuration(): number {
    return this.defaultDuration;
  }

  startCreation(
    clipId: string,
    pitch: number,
    startBeat: number,
    snapEngine: SnapEngine,
    coordinateSystem: CoordinateSystem,
    isDrag: boolean
  ): boolean {
    const store = useProjectStore.getState();
    const clip = store.clips.find(c => c.id === clipId);
    if (!clip || clip.type !== 'midi') return false;

    const snappedStart = snapEngine.snapBeat(startBeat, coordinateSystem.getVerticalZoom());
    const duration = isDrag ? 0.1 : this.defaultDuration;

    store.saveHistorySnapshot();

    this.previewState = {
      clipId,
      pitch: Math.max(0, Math.min(127, pitch)),
      startBeat: snappedStart,
      endBeat: snappedStart + duration,
      duration,
      velocity: 100,
    };

    return true;
  }

  updateCreation(
    currentBeat: number,
    pitch: number,
    snapEngine: SnapEngine,
    coordinateSystem: CoordinateSystem
  ) {
    if (!this.previewState) return;

    const snappedEnd = snapEngine.snapBeat(currentBeat, coordinateSystem.getVerticalZoom());
    let endBeat = Math.max(snappedEnd, this.previewState.startBeat + 0.0625);

    this.previewState.pitch = Math.max(0, Math.min(127, pitch));
    this.previewState.endBeat = endBeat;
    this.previewState.duration = endBeat - this.previewState.startBeat;
  }

  finalizeCreation(): boolean {
    if (!this.previewState) return false;

    const store = useProjectStore.getState();
    const noteId = `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const duration = Math.max(0.0625, this.previewState.duration);

    const note = {
      id: noteId,
      pitch: this.previewState.pitch,
      velocity: this.previewState.velocity,
      start: this.previewState.startBeat,
      startBeat: this.previewState.startBeat,
      duration,
    };

    store.addNote(this.previewState.clipId, note as any);

    this.createdNoteIds = [noteId];
    this.previewState = null;

    return true;
  }

  cancelCreation() {
    this.previewState = null;
  }

  getPreviewState(): MidiNotePreviewState | null {
    return this.previewState;
  }

  isCreating(): boolean {
    return this.previewState !== null;
  }
}
