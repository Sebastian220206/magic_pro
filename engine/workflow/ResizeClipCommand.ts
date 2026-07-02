import { Command } from './Command';
import { useProjectStore } from '@/store/projectStore';

interface ClipSnapshot {
  id: string;
  startBeat: number;
  start: number;
  startTime: number;
  duration: number;
  offset: number;
}

export class ResizeClipCommand implements Command {
  readonly id = 'resize-clip';
  readonly label: string;

  private clipId: string;
  private original: ClipSnapshot;
  private newValues: Partial<ClipSnapshot>;

  constructor(clipId: string, newStartBeat: number, newDuration: number, newOffset: number) {
    this.clipId = clipId;
    this.label = 'Resize Clip';

    const clip = useProjectStore.getState().clips.find(c => c.id === clipId);
    this.original = {
      id: clipId,
      startBeat: clip?.startBeat ?? clip?.start ?? 0,
      start: clip?.start ?? 0,
      startTime: clip?.startTime ?? 0,
      duration: clip?.duration ?? 0,
      offset: clip?.offset ?? 0,
    };

    this.newValues = {
      startBeat: newStartBeat,
      start: newStartBeat,
      startTime: newStartBeat,
      duration: newDuration,
      offset: newOffset,
    };
  }

  execute() {
    const { updateClip } = useProjectStore.getState();
    updateClip(this.clipId, this.newValues);
  }

  undo() {
    const { updateClip } = useProjectStore.getState();
    updateClip(this.clipId, this.original);
  }

  merge(other: Command): boolean {
    if (other instanceof ResizeClipCommand && other.clipId === this.clipId) {
      this.newValues = other.newValues;
      return true;
    }
    return false;
  }
}
