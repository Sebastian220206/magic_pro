/**
 * Project Alternatives - Multiple Arrangements per Project
 *
 * Features:
 * - Multiple arrangement versions
 * - Switch between alternatives
 * - Duplicate/edit/delete alternatives
 * - Compare alternatives
 * - Auto-save per alternative
 *
 * Use Cases:
 * - Try different arrangements
 * - Create radio edit vs album version
 * - Keep original and remixed version
 * - A/B testing mixes
 */

export interface Alternative {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  isDefault: boolean;
  isActive: boolean;
  trackCount: number;
  duration: number; // seconds
  color: string;
}

export interface AlternativeState {
  alternatives: Alternative[];
  activeAlternativeId: string;
  lastSwitchTime: number;
}

export interface AlternativeOptions {
  name?: string;
  description?: string;
  copyFrom?: string; // Alternative ID to copy from
}

const DEFAULT_ALTERNATIVE: Alternative = {
  id: 'alt-default',
  name: 'Main',
  description: 'Default arrangement',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  isDefault: true,
  isActive: true,
  trackCount: 0,
  duration: 0,
  color: '#3B82F6',
};

export class AlternativeManager {
  private state: AlternativeState;
  private listeners: Array<(state: AlternativeState) => void> = [];

  constructor() {
    this.state = {
      alternatives: [{ ...DEFAULT_ALTERNATIVE }],
      activeAlternativeId: DEFAULT_ALTERNATIVE.id,
      lastSwitchTime: Date.now(),
    };
  }

  // ===========================================================================
  // Alternative Management
  // ===========================================================================

  public createAlternative(options: AlternativeOptions = {}): Alternative {
    const id = `alt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const alternative: Alternative = {
      id,
      name: options.name ?? `Alternative ${this.state.alternatives.length + 1}`,
      description: options.description ?? '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault: false,
      isActive: false,
      trackCount: this.getActiveAlternative()?.trackCount ?? 0,
      duration: this.getActiveAlternative()?.duration ?? 0,
      color: this.generateColor(),
    };

    this.state.alternatives.push(alternative);
    this.notifyListeners();
    return alternative;
  }

  public duplicateAlternative(sourceId: string, newName?: string): Alternative | null {
    const source = this.state.alternatives.find(a => a.id === sourceId);
    if (!source) return null;

    const id = `alt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const duplicate: Alternative = {
      ...source,
      id,
      name: newName ?? `${source.name} Copy`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault: false,
      isActive: false,
    };

    this.state.alternatives.push(duplicate);
    this.notifyListeners();
    return duplicate;
  }

  public deleteAlternative(id: string): boolean {
    const index = this.state.alternatives.findIndex(a => a.id === id);
    if (index < 0) return false;

    const alternative = this.state.alternatives[index];
    if (alternative.isDefault) return false; // Can't delete default

    this.state.alternatives.splice(index, 1);

    // If deleted was active, switch to default
    if (this.state.activeAlternativeId === id) {
      const defaultAlt = this.state.alternatives.find(a => a.isDefault);
      if (defaultAlt) {
        this.switchToAlternative(defaultAlt.id);
      }
    }

    this.notifyListeners();
    return true;
  }

  public renameAlternative(id: string, name: string): void {
    const alternative = this.state.alternatives.find(a => a.id === id);
    if (alternative) {
      alternative.name = name;
      alternative.updatedAt = Date.now();
      this.notifyListeners();
    }
  }

  public setDescription(id: string, description: string): void {
    const alternative = this.state.alternatives.find(a => a.id === id);
    if (alternative) {
      alternative.description = description;
      alternative.updatedAt = Date.now();
      this.notifyListeners();
    }
  }

  // ===========================================================================
  // Switching
  // ===========================================================================

  public switchToAlternative(id: string): boolean {
    const alternative = this.state.alternatives.find(a => a.id === id);
    if (!alternative) return false;

    // Deactivate current
    const current = this.getActiveAlternative();
    if (current) {
      current.isActive = false;
    }

    // Activate new
    alternative.isActive = true;
    this.state.activeAlternativeId = id;
    this.state.lastSwitchTime = Date.now();

    this.notifyListeners();
    return true;
  }

  public getActiveAlternative(): Alternative | null {
    return this.state.alternatives.find(a => a.id === this.state.activeAlternativeId) ?? null;
  }

  public getAlternatives(): ReadonlyArray<Alternative> {
    return this.state.alternatives;
  }

  public getAlternative(id: string): Alternative | undefined {
    return this.state.alternatives.find(a => a.id === id);
  }

  // ===========================================================================
  // Metadata
  // ===========================================================================

  public updateTrackCount(id: string, count: number): void {
    const alternative = this.state.alternatives.find(a => a.id === id);
    if (alternative) {
      alternative.trackCount = count;
      alternative.updatedAt = Date.now();
      this.notifyListeners();
    }
  }

  public updateDuration(id: string, duration: number): void {
    const alternative = this.state.alternatives.find(a => a.id === id);
    if (alternative) {
      alternative.duration = duration;
      alternative.updatedAt = Date.now();
      this.notifyListeners();
    }
  }

  // ===========================================================================
  // Compare
  // ===========================================================================

  public compareAlternatives(id1: string, id2: string): AlternativeComparison | null {
    const alt1 = this.state.alternatives.find(a => a.id === id1);
    const alt2 = this.state.alternatives.find(a => a.id === id2);

    if (!alt1 || !alt2) return null;

    return {
      alternative1: alt1,
      alternative2: alt2,
      trackCountDiff: alt1.trackCount - alt2.trackCount,
      durationDiff: alt1.duration - alt2.duration,
      createdDiff: alt1.createdAt - alt2.createdAt,
      updatedDiff: alt1.updatedAt - alt2.updatedAt,
    };
  }

  // ===========================================================================
  // Utility
  // ===========================================================================

  private generateColor(): string {
    const colors = [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
      '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
    ];
    const usedColors = this.state.alternatives.map(a => a.color);
    const availableColors = colors.filter(c => !usedColors.includes(c));
    return availableColors[0] ?? colors[Math.floor(Math.random() * colors.length)];
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getState(): Readonly<AlternativeState> {
    return this.state;
  }

  public getStateSnapshot(): AlternativeState {
    return {
      alternatives: this.state.alternatives.map(a => ({ ...a })),
      activeAlternativeId: this.state.activeAlternativeId,
      lastSwitchTime: this.state.lastSwitchTime,
    };
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  public subscribe(listener: (state: AlternativeState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  public serialize(): AlternativeState {
    return this.getStateSnapshot();
  }

  public deserialize(data: AlternativeState): void {
    this.state = {
      alternatives: data.alternatives.map(a => ({ ...a })),
      activeAlternativeId: data.activeAlternativeId,
      lastSwitchTime: data.lastSwitchTime,
    };
    this.notifyListeners();
  }
}

// =============================================================================
// Types
// =============================================================================

export interface AlternativeComparison {
  alternative1: Alternative;
  alternative2: Alternative;
  trackCountDiff: number;
  durationDiff: number;
  createdDiff: number;
  updatedDiff: number;
}

// =============================================================================
// Factory
// =============================================================================

export function createAlternativeManager(): AlternativeManager {
  return new AlternativeManager();
}

export default AlternativeManager;
