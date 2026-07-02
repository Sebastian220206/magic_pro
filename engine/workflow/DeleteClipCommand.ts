import { Command } from './Command';
import { useProjectStore } from '@/store/projectStore';
import { Clip } from '@/models/Clip';

export class DeleteClipCommand implements Command {
  readonly id = 'delete-clip';
  readonly label: string;

  private clipIds: string[];
  private deletedClips: Clip[] = [];

  constructor(clipIds: string[]) {
    this.clipIds = clipIds;
    this.label = clipIds.length > 1 ? `Delete ${clipIds.length} Clips` : 'Delete Clip';

    const store = useProjectStore.getState();
    for (const id of clipIds) {
      const clip = store.clips.find(c => c.id === id);
      if (clip) {
        this.deletedClips.push({ ...clip });
      }
    }
  }

  execute() {
    const store = useProjectStore.getState();
    store.saveHistorySnapshot();
    for (const id of this.clipIds) {
      store.deleteClip(id);
    }
    store.deselectAllClips();
  }

  undo() {
    const store = useProjectStore.getState();
    store.saveHistorySnapshot();
    for (const clip of this.deletedClips) {
      store.addClip(clip);
    }
    store.selectClips(this.clipIds);
  }

  merge(other: Command): boolean {
    return false;
  }
}
