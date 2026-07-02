import { SnapEngine } from '@/engine/editor/SnapEngine';
import { CoordinateSystem } from '@/engine/editor/CoordinateSystem';
import { useProjectStore } from '@/store/projectStore';
import { TrackType } from '@/models/Track';
import { Clip } from '@/models/Clip';

const REGION_COLORS: Record<string, string> = {
  'audio': '#4ade80',
  'midi': '#60a5fa',
  'software-instrument': '#a78bfa',
  'drummer': '#f59e0b',
  'pattern': '#34d399',
};

const DEFAULT_DURATION = 4;

export interface RegionPreviewState {
  trackId: string;
  startBeat: number;
  endBeat: number;
  duration: number;
  type: 'audio' | 'midi' | 'pattern';
}

export class RegionCreationController {
  private previewState: RegionPreviewState | null = null;
  private createdClipIds: string[] = [];

  startCreation(
    startBeat: number,
    trackIndex: number,
    snapEngine: SnapEngine,
    coordinateSystem: CoordinateSystem
  ): boolean {
    const store = useProjectStore.getState();
    const tracks = store.tracks;
    const track = tracks[trackIndex];

    if (!track) return false;

    const snappedStart = snapEngine.snapBeat(startBeat, coordinateSystem.getVerticalZoom());
    const type = this.getRegionTypeForTrack(track.type);

    store.saveHistorySnapshot();

    this.previewState = {
      trackId: track.id,
      startBeat: snappedStart,
      endBeat: snappedStart + DEFAULT_DURATION,
      duration: DEFAULT_DURATION,
      type,
    };

    this.createdClipIds = [];

    return true;
  }

  updateCreation(
    currentBeat: number,
    snapEngine: SnapEngine,
    coordinateSystem: CoordinateSystem
  ) {
    if (!this.previewState) return;

    const snappedEnd = snapEngine.snapBeat(currentBeat, coordinateSystem.getVerticalZoom());
    let endBeat = snappedEnd;

    if (endBeat <= this.previewState.startBeat) {
      endBeat = this.previewState.startBeat + 0.1;
    }

    this.previewState.endBeat = endBeat;
    this.previewState.duration = endBeat - this.previewState.startBeat;
  }

  finalizeCreation(): boolean {
    if (!this.previewState) {
      
      return false;
    }

    const store = useProjectStore.getState();
    const clipId = `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const duration = Math.max(0.1, this.previewState.duration);

    const track = store.tracks.find(t => t.id === this.previewState!.trackId);
    const clip: Clip = {
      id: clipId,
      trackId: this.previewState.trackId,
      type: this.previewState.type as any,
      name: this.getDefaultName(this.previewState.type),
      color: REGION_COLORS[this.previewState.type] || '#888',
      alternativeId: track?.activeAlternativeId || '',
      start: this.previewState.startBeat,
      startBeat: this.previewState.startBeat,
      startTime: this.previewState.startBeat,
      duration,
      offset: 0,
      muted: false,
      loop: false,
      fadeIn: { duration: 0, curve: 'linear', gain: 1 },
      fadeOut: { duration: 0, curve: 'linear', gain: 1 },
      playbackRate: 1,
      pitchOffset: 0,
      stretchMode: 'none',
      qSwing: 0,
      transpose: 0,
      velocityOffset: 0,
    };

    if (this.previewState.type === 'midi') {
      clip.notes = [];
    }

    useProjectStore.setState(s => ({ clips: [...s.clips, clip] }));
    store.selectClips([clipId]);

    this.createdClipIds = [clipId];
    this.previewState = null;

    return true;
  }

  cancelCreation() {
    if (!this.previewState) return;

    this.previewState = null;
    this.createdClipIds = [];
    
  }

  getPreviewState(): RegionPreviewState | null {
    return this.previewState;
  }

  isCreating(): boolean {
    return this.previewState !== null;
  }

  private getRegionTypeForTrack(trackType: TrackType): 'audio' | 'midi' | 'pattern' {
    switch (trackType) {
      case 'audio':
        return 'audio';
      case 'midi':
      case 'software-instrument':
      case 'drummer':
      case 'external-midi':
        return 'midi';
      default:
        return 'midi';
    }
  }

  private getDefaultName(type: string): string {
    switch (type) {
      case 'audio': return 'Audio Region';
      case 'midi': return 'MIDI Region';
      case 'pattern': return 'Pattern Region';
      default: return 'Region';
    }
  }
}
