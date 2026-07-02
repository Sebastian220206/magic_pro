import { Command } from './Command';
import { useProjectStore } from '@/store/projectStore';

interface DuplicatedClipInfo {
  newId: string;
  originalId: string;
}

export class DuplicateClipCommand implements Command {
  readonly id = 'duplicate-clip';
  readonly label: string;

  private sourceClipId: string;
  private targetBeat: number;
  private targetTrackId: string;
  private duplicatedClip: DuplicatedClipInfo | null = null;

  constructor(sourceClipId: string, targetBeat: number, targetTrackId: string) {
    this.sourceClipId = sourceClipId;
    this.targetBeat = targetBeat;
    this.targetTrackId = targetTrackId;
    this.label = 'Duplicate Clip';
  }

  execute() {
    const store = useProjectStore.getState();
    const source = store.clips.find(c => c.id === this.sourceClipId);
    if (!source) return;

    const newId = `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const clone = {
      ...source,
      id: newId,
      startBeat: this.targetBeat,
      start: this.targetBeat,
      startTime: this.targetBeat,
      trackId: this.targetTrackId,
      name: `${source.name} Copy`,
    };

    this.duplicatedClip = { newId, originalId: this.sourceClipId };

    store.saveHistorySnapshot();
    store.addClip(clone);
    store.selectClips([newId]);
  }

  undo() {
    if (!this.duplicatedClip) return;
    const store = useProjectStore.getState();
    store.deleteClip(this.duplicatedClip.newId);
    store.selectClips([this.sourceClipId]);
  }

  merge(other: Command): boolean {
    return false;
  }
}
