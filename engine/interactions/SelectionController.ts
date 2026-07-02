import { SelectionManager } from '@/engine/editor/SelectionManager';
import { useProjectStore } from '@/store/projectStore';

export class SelectionController {
  constructor(private selectionManager: SelectionManager) {}

  handleClick(clipId: string | null, shiftKey: boolean) {
    const store = useProjectStore.getState();

    if (clipId) {
      if (shiftKey) {
        this.selectionManager.toggle(clipId, 'clip');
        store.toggleClipSelection(clipId);
      } else {
        this.selectionManager.select(clipId, 'clip', false);
        store.selectClips([clipId]);
      }
    } else {
      if (!shiftKey) {
        this.selectionManager.clear();
        store.deselectAllClips();
      }
    }
  }

  clearSelection() {
    this.selectionManager.clear();
    useProjectStore.getState().deselectAllClips();
  }

  getSelectedIds(): string[] {
    return this.selectionManager.getSelectedIds();
  }

  isSelected(id: string): boolean {
    return this.selectionManager.isSelected(id);
  }
}
