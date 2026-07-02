import { SnapEngine } from '@/engine/editor/SnapEngine';
import { CoordinateSystem } from '@/engine/editor/CoordinateSystem';
import { useProjectStore } from '@/store/projectStore';
import { Clip } from '@/models/Clip';

interface DragState {
  clipIds: string[];
  startBeat: number;
  startTrackIndex: number;
  originalPositions: Map<string, { startBeat: number; trackId: string; start: number; startTime: number }>;
  isCopyDrag: boolean;
  isDragging: boolean;
  isCopyCreated: boolean;
}

export class RegionDragController {
  private state: DragState | null = null;
  private ghostPosition: { beat: number; trackIndex: number } | null = null;

  startDrag(
    clipId: string,
    startBeat: number,
    startTrackIndex: number,
    altKey: boolean
  ) {
    const store = useProjectStore.getState();
    const selectedIds = store.selectedClipIds;

    const targetIds = selectedIds.includes(clipId) ? selectedIds : [clipId];
    let dragIds = targetIds;
    const originalPositions = new Map<string, { startBeat: number; trackId: string; start: number; startTime: number }>();

    if (altKey) {
      store.saveHistorySnapshot();
      const clones: Clip[] = [];
      const cloneIds: string[] = [];

      for (const id of targetIds) {
        const clip = store.clips.find(c => c.id === id);
        if (!clip) continue;

        const newId = `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-copy`;
        const clone: Clip = {
          ...clip,
          id: newId,
          name: `${clip.name} Copy`,
        };
        clones.push(clone);
        cloneIds.push(newId);

        originalPositions.set(newId, {
          startBeat: clip.startBeat ?? clip.start,
          trackId: clip.trackId,
          start: clip.start,
          startTime: clip.startTime,
        });
      }

      useProjectStore.setState(s => ({ clips: [...s.clips, ...clones] }));
      store.selectClips(cloneIds);
      dragIds = cloneIds;
    } else {
      store.saveHistorySnapshot();
      for (const id of targetIds) {
        const clip = store.clips.find(c => c.id === id);
        if (clip) {
          originalPositions.set(id, {
            startBeat: clip.startBeat ?? clip.start,
            trackId: clip.trackId,
            start: clip.start,
            startTime: clip.startTime,
          });
        }
      }
    }

    this.state = {
      clipIds: dragIds.filter(id => originalPositions.has(id)),
      startBeat,
      startTrackIndex,
      originalPositions,
      isCopyDrag: altKey,
      isDragging: true,
      isCopyCreated: altKey,
    };

    this.ghostPosition = { beat: startBeat, trackIndex: startTrackIndex };
  }

  updateDrag(
    currentBeat: number,
    currentTrackIndex: number,
    snapEngine: SnapEngine,
    coordinateSystem: CoordinateSystem
  ) {
    if (!this.state || !this.state.isDragging) return;

    const deltaBeat = currentBeat - this.state.startBeat;
    const snappedDelta = snapEngine.snapBeat(deltaBeat, coordinateSystem.getVerticalZoom());

    const trackDelta = Math.round(currentTrackIndex - this.state.startTrackIndex);

    this.ghostPosition = {
      beat: snappedDelta,
      trackIndex: trackDelta,
    };

    const store = useProjectStore.getState();
    for (const id of this.state.clipIds) {
      const orig = this.state.originalPositions.get(id);
      if (!orig) continue;

      const newStartBeat = Math.max(0, orig.startBeat + snappedDelta);
      const tracks = store.tracks;
      const origTrackIndex = tracks.findIndex(t => t.id === orig.trackId);
      let newTrackId = orig.trackId;

      if (trackDelta !== 0) {
        const targetIndex = Math.max(0, Math.min(origTrackIndex + trackDelta, tracks.length - 1));
        newTrackId = tracks[targetIndex]?.id ?? orig.trackId;
      }

      store.updateClip(id, {
        startBeat: newStartBeat,
        start: newStartBeat,
        startTime: newStartBeat,
        trackId: newTrackId,
      });
    }
  }

  endDrag(): { moved: boolean; clipIds: string[] } | null {
    if (!this.state) return null;

    this.state.isDragging = false;

    if (!this.state.isCopyDrag) {
      
    }

    const result = {
      moved: true,
      clipIds: [...this.state.clipIds],
    };

    this.state = null;
    this.ghostPosition = null;

    return result;
  }

  cancelDrag() {
    if (!this.state) return;

    if (this.state.isCopyDrag) {
      for (const id of this.state.clipIds) {
        useProjectStore.getState().deleteClip(id);
      }
      useProjectStore.getState().deselectAllClips();
    } else {
      const store = useProjectStore.getState();
      for (const id of this.state.clipIds) {
        const orig = this.state.originalPositions.get(id);
        if (orig) {
          store.updateClip(id, {
            startBeat: orig.startBeat,
            start: orig.start,
            startTime: orig.startTime,
            trackId: orig.trackId,
          });
        }
      }
      ;
    }

    this.state = null;
    this.ghostPosition = null;
  }

  getGhostPosition(): { beat: number; trackIndex: number } | null {
    return this.ghostPosition;
  }

  isDragging(): boolean {
    return this.state?.isDragging ?? false;
  }

  isCopyDrag(): boolean {
    return this.state?.isCopyDrag ?? false;
  }

  getClipIds(): string[] {
    return this.state?.clipIds ?? [];
  }
}
