import { SelectionManager } from '@/engine/editor/SelectionManager';
import { CoordinateSystem } from '@/engine/editor/CoordinateSystem';
import { useProjectStore } from '@/store/projectStore';

interface MarqueeState {
  startBeat: number;
  startTrackIndex: number;
  startScreenX: number;
  startScreenY: number;
  currentBeat: number;
  currentTrackIndex: number;
  currentScreenX: number;
  currentScreenY: number;
  isSelecting: boolean;
}

interface MarqueeRect {
  minBeat: number;
  maxBeat: number;
  minTrack: number;
  maxTrack: number;
}

export interface MarqueeScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class MarqueeController {
  private state: MarqueeState | null = null;

  constructor(
    private selectionManager: SelectionManager,
    private coordinateSystem: CoordinateSystem
  ) {}

  startMarquee(
    beat: number,
    trackIndex: number,
    screenX: number,
    screenY: number,
    shiftKey: boolean
  ) {
    if (!shiftKey) {
      this.selectionManager.clear();
      useProjectStore.getState().deselectAllClips();
    }

    this.state = {
      startBeat: beat,
      startTrackIndex: trackIndex,
      startScreenX: screenX,
      startScreenY: screenY,
      currentBeat: beat,
      currentTrackIndex: trackIndex,
      currentScreenX: screenX,
      currentScreenY: screenY,
      isSelecting: true,
    };
  }

  updateMarquee(
    currentBeat: number,
    currentTrackIndex: number,
    currentScreenX: number,
    currentScreenY: number
  ) {
    if (!this.state || !this.state.isSelecting) return;

    this.state.currentBeat = currentBeat;
    this.state.currentTrackIndex = currentTrackIndex;
    this.state.currentScreenX = currentScreenX;
    this.state.currentScreenY = currentScreenY;

    this.updateSelection();
  }

  endMarquee() {
    if (!this.state) return;

    this.updateSelection();
    this.state.isSelecting = false;
    this.state = null;
  }

  private updateSelection() {
    if (!this.state) return;

    const rect = this.getMarqueeRect();
    if (!rect) return;

    const store = useProjectStore.getState();
    const { clips, tracks } = store;
    const selectedIds: string[] = [];

    for (const clip of clips) {
      const trackIndex = tracks.findIndex(t => t.id === clip.trackId);
      if (trackIndex < 0) continue;

      const clipStart = clip.startBeat ?? clip.start;
      const clipEnd = clipStart + clip.duration;

      const overlapsBeat = clipStart < rect.maxBeat && clipEnd > rect.minBeat;
      const overlapsTrack = trackIndex < rect.maxTrack && (trackIndex + 1) > rect.minTrack;

      if (overlapsBeat && overlapsTrack) {
        selectedIds.push(clip.id);
        this.selectionManager.select(clip.id, 'clip', true);
      }
    }

    if (selectedIds.length > 0) {
      store.selectClips(selectedIds);
    }
  }

  getMarqueeRect(): MarqueeRect | null {
    if (!this.state) return null;

    return {
      minBeat: Math.min(this.state.startBeat, this.state.currentBeat),
      maxBeat: Math.max(this.state.startBeat, this.state.currentBeat),
      minTrack: Math.min(this.state.startTrackIndex, this.state.currentTrackIndex),
      maxTrack: Math.max(this.state.startTrackIndex, this.state.currentTrackIndex),
    };
  }

  getScreenRect(): MarqueeScreenRect | null {
    if (!this.state) return null;

    const x = Math.min(this.state.startScreenX, this.state.currentScreenX);
    const y = Math.min(this.state.startScreenY, this.state.currentScreenY);
    const width = Math.abs(this.state.currentScreenX - this.state.startScreenX);
    const height = Math.abs(this.state.currentScreenY - this.state.startScreenY);

    return { x, y, width, height };
  }

  getState(): MarqueeState | null {
    return this.state;
  }

  isSelecting(): boolean {
    return this.state?.isSelecting ?? false;
  }
}
