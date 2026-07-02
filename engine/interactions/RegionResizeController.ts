import { SnapEngine } from '@/engine/editor/SnapEngine';
import { CoordinateSystem } from '@/engine/editor/CoordinateSystem';
import { useProjectStore } from '@/store/projectStore';

const MIN_CLIP_DURATION = 0.1;

interface ResizeState {
  clipId: string;
  edge: 'left' | 'right';
  originalStartBeat: number;
  originalDuration: number;
  originalOffset: number;
  startBeat: number;
  isResizing: boolean;
}

interface GhostResize {
  newStartBeat: number;
  newDuration: number;
  newOffset: number;
}

export class RegionResizeController {
  private state: ResizeState | null = null;
  private ghostState: GhostResize | null = null;

  startResize(
    clipId: string,
    edge: 'left' | 'right',
    currentBeat: number
  ) {
    const store = useProjectStore.getState();
    const clip = store.clips.find(c => c.id === clipId);
    if (!clip) return;

    store.saveHistorySnapshot();

    this.state = {
      clipId,
      edge,
      originalStartBeat: clip.startBeat ?? clip.start,
      originalDuration: clip.duration,
      originalOffset: clip.offset ?? 0,
      startBeat: currentBeat,
      isResizing: true,
    };

    this.ghostState = {
      newStartBeat: this.state.originalStartBeat,
      newDuration: this.state.originalDuration,
      newOffset: this.state.originalOffset,
    };
  }

  updateResize(
    currentBeat: number,
    snapEngine: SnapEngine,
    coordinateSystem: CoordinateSystem
  ) {
    if (!this.state || !this.state.isResizing) return;

    const deltaBeat = currentBeat - this.state.startBeat;
    const snappedDelta = snapEngine.snapBeat(deltaBeat, coordinateSystem.getVerticalZoom());

    let newStartBeat = this.state.originalStartBeat;
    let newDuration = this.state.originalDuration;
    let newOffset = this.state.originalOffset;

    if (this.state.edge === 'left') {
      newStartBeat = this.state.originalStartBeat + snappedDelta;
      newDuration = this.state.originalDuration - snappedDelta;
      newOffset = this.state.originalOffset + snappedDelta;

      if (newDuration < MIN_CLIP_DURATION) {
        newDuration = MIN_CLIP_DURATION;
        newStartBeat = this.state.originalStartBeat + this.state.originalDuration - MIN_CLIP_DURATION;
        newOffset = newStartBeat;
      }
    } else {
      newDuration = this.state.originalDuration + snappedDelta;

      if (newDuration < MIN_CLIP_DURATION) {
        newDuration = MIN_CLIP_DURATION;
      } else {
        const endBeat = newStartBeat + newDuration;
        const snappedEnd = snapEngine.snapBeat(endBeat, coordinateSystem.getVerticalZoom());
        newDuration = snappedEnd - newStartBeat;
        if (newDuration < MIN_CLIP_DURATION) {
          newDuration = MIN_CLIP_DURATION;
        }
      }
    }

    this.ghostState = { newStartBeat, newDuration, newOffset };

    const store = useProjectStore.getState();
    store.updateClip(this.state.clipId, {
      startBeat: newStartBeat,
      start: newStartBeat,
      startTime: newStartBeat,
      duration: newDuration,
      offset: newOffset,
    });
  }

  endResize() {
    if (!this.state) return;

    this.state.isResizing = false;
    

    this.state = null;
    this.ghostState = null;
  }

  cancelResize() {
    if (!this.state) return;

    const store = useProjectStore.getState();
    store.updateClip(this.state.clipId, {
      startBeat: this.state.originalStartBeat,
      start: this.state.originalStartBeat,
      startTime: this.state.originalStartBeat,
      duration: this.state.originalDuration,
      offset: this.state.originalOffset,
    });
    ;

    this.state = null;
    this.ghostState = null;
  }

  getGhostState(): GhostResize | null {
    return this.ghostState;
  }

  isResizing(): boolean {
    return this.state?.isResizing ?? false;
  }
}
