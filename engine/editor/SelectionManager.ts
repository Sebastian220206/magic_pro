/**
 * SelectionManager.ts
 * Manages unique selections for clips, notes, and automation points.
 */

export type SelectionType = 'clip' | 'note' | 'automation';

export interface SelectionItem {
    id: string;
    type: SelectionType;
}

export class SelectionManager {
    private selectedIds: Set<string> = new Set();
    private activeType: SelectionType = 'clip';

    constructor() {}

    select(id: string, type: SelectionType, additive: boolean = false) {
        if (this.activeType !== type) {
            this.clear();
            this.activeType = type;
        }

        if (!additive) {
            this.selectedIds.clear();
        }

        this.selectedIds.add(id);
    }

    deselect(id: string) {
        this.selectedIds.delete(id);
    }

    toggle(id: string, type: SelectionType) {
        if (this.activeType !== type) {
            this.clear();
            this.activeType = type;
        }

        if (this.selectedIds.has(id)) {
            this.selectedIds.delete(id);
        } else {
            this.selectedIds.add(id);
        }
    }

    clear() {
        this.selectedIds.clear();
    }

    getSelectedIds(): string[] {
        return Array.from(this.selectedIds);
    }

    getType(): SelectionType {
        return this.activeType;
    }

    isSelected(id: string): boolean {
        return this.selectedIds.has(id);
    }
}
