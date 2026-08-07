/**
 * Track Stacks - Folder and Summing Stacks
 *
 * Features:
 * - Folder Stacks: Organize tracks visually, collapse/expand
 * - Summing Stacks: Route audio through a bus, apply effects to group
 * - Master fader for group volume control
 * - Solo/Mute affects all child tracks
 *
 * Signal Flow:
 * Child Tracks → Summing Bus → Parent Stack → Output
 */

export type StackType = 'folder' | 'summing';

export interface TrackStackConfig {
  id: string;
  name: string;
  type: StackType;
  color: string;
  childTrackIds: string[];
  collapsed: boolean;
  muted: boolean;
  soloed: boolean;
  volume: number; // dB for summing stacks
  pan: number;    // -1 to 1 for summing stacks
  enabled: boolean;
}

export interface TrackStackOptions {
  name?: string;
  type?: StackType;
  color?: string;
  childTrackIds?: string[];
}

export interface TrackStackState {
  stacks: TrackStackConfig[];
  selectedStackId: string | null;
}

export class TrackStackManager {
  private state: TrackStackState;
  private listeners: Array<(state: TrackStackState) => void> = [];

  constructor() {
    this.state = {
      stacks: [],
      selectedStackId: null,
    };
  }

  // ===========================================================================
  // Stack Management
  // ===========================================================================

  public createStack(
    id: string,
    name: string,
    type: StackType = 'folder',
    options: Partial<Pick<TrackStackConfig, 'color' | 'childTrackIds'>> = {}
  ): TrackStackConfig {
    const stack: TrackStackConfig = {
      id,
      name,
      type,
      color: options.color ?? '#6B7280',
      childTrackIds: options.childTrackIds ?? [],
      collapsed: false,
      muted: false,
      soloed: false,
      volume: 0,
      pan: 0,
      enabled: true,
    };

    this.state.stacks.push(stack);
    this.notifyListeners();
    return stack;
  }

  public deleteStack(id: string): boolean {
    const index = this.state.stacks.findIndex(s => s.id === id);
    if (index >= 0) {
      this.state.stacks.splice(index, 1);
      if (this.state.selectedStackId === id) {
        this.state.selectedStackId = null;
      }
      this.notifyListeners();
      return true;
    }
    return false;
  }

  public getStack(id: string): TrackStackConfig | undefined {
    return this.state.stacks.find(s => s.id === id);
  }

  public getStacks(): ReadonlyArray<TrackStackConfig> {
    return this.state.stacks;
  }

  // ===========================================================================
  // Child Track Management
  // ===========================================================================

  public addChildTrack(stackId: string, trackId: string): boolean {
    const stack = this.state.stacks.find(s => s.id === stackId);
    if (stack && !stack.childTrackIds.includes(trackId)) {
      stack.childTrackIds.push(trackId);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  public removeChildTrack(stackId: string, trackId: string): boolean {
    const stack = this.state.stacks.find(s => s.id === stackId);
    if (stack) {
      const index = stack.childTrackIds.indexOf(trackId);
      if (index >= 0) {
        stack.childTrackIds.splice(index, 1);
        this.notifyListeners();
        return true;
      }
    }
    return false;
  }

  public getChildTracks(stackId: string): string[] {
    const stack = this.state.stacks.find(s => s.id === stackId);
    return stack ? [...stack.childTrackIds] : [];
  }

  public getParentStack(trackId: string): TrackStackConfig | null {
    return this.state.stacks.find(s => s.childTrackIds.includes(trackId)) ?? null;
  }

  // ===========================================================================
  // Stack Properties
  // ===========================================================================

  public setName(stackId: string, name: string): void {
    const stack = this.state.stacks.find(s => s.id === stackId);
    if (stack) {
      stack.name = name;
      this.notifyListeners();
    }
  }

  public setColor(stackId: string, color: string): void {
    const stack = this.state.stacks.find(s => s.id === stackId);
    if (stack) {
      stack.color = color;
      this.notifyListeners();
    }
  }

  public setCollapsed(stackId: string, collapsed: boolean): void {
    const stack = this.state.stacks.find(s => s.id === stackId);
    if (stack) {
      stack.collapsed = collapsed;
      this.notifyListeners();
    }
  }

  public toggleCollapsed(stackId: string): void {
    const stack = this.state.stacks.find(s => s.id === stackId);
    if (stack) {
      stack.collapsed = !stack.collapsed;
      this.notifyListeners();
    }
  }

  public setMute(stackId: string, muted: boolean): void {
    const stack = this.state.stacks.find(s => s.id === stackId);
    if (stack) {
      stack.muted = muted;
      this.notifyListeners();
    }
  }

  public toggleMute(stackId: string): void {
    const stack = this.state.stacks.find(s => s.id === stackId);
    if (stack) {
      stack.muted = !stack.muted;
      this.notifyListeners();
    }
  }

  public setSolo(stackId: string, soloed: boolean): void {
    const stack = this.state.stacks.find(s => s.id === stackId);
    if (stack) {
      stack.soloed = soloed;
      this.notifyListeners();
    }
  }

  public toggleSolo(stackId: string): void {
    const stack = this.state.stacks.find(s => s.id === stackId);
    if (stack) {
      stack.soloed = !stack.soloed;
      this.notifyListeners();
    }
  }

  public setVolume(stackId: string, db: number): void {
    const stack = this.state.stacks.find(s => s.id === stackId);
    if (stack && stack.type === 'summing') {
      stack.volume = Math.max(-60, Math.min(12, db));
      this.notifyListeners();
    }
  }

  public setPan(stackId: string, pan: number): void {
    const stack = this.state.stacks.find(s => s.id === stackId);
    if (stack && stack.type === 'summing') {
      stack.pan = Math.max(-1, Math.min(1, pan));
      this.notifyListeners();
    }
  }

  public setEnabled(stackId: string, enabled: boolean): void {
    const stack = this.state.stacks.find(s => s.id === stackId);
    if (stack) {
      stack.enabled = enabled;
      this.notifyListeners();
    }
  }

  // ===========================================================================
  // Selection
  // ===========================================================================

  public selectStack(id: string | null): void {
    this.state.selectedStackId = id;
    this.notifyListeners();
  }

  public getSelectedStack(): TrackStackConfig | null {
    return this.state.stacks.find(s => s.id === this.state.selectedStackId) ?? null;
  }

  // ===========================================================================
  // Bulk Operations
  // ===========================================================================

  public muteAll(): void {
    for (const stack of this.state.stacks) {
      stack.muted = true;
    }
    this.notifyListeners();
  }

  public unmuteAll(): void {
    for (const stack of this.state.stacks) {
      stack.muted = false;
    }
    this.notifyListeners();
  }

  public soloAll(): void {
    for (const stack of this.state.stacks) {
      stack.soloed = true;
    }
    this.notifyListeners();
  }

  public unsoloAll(): void {
    for (const stack of this.state.stacks) {
      stack.soloed = false;
    }
    this.notifyListeners();
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getState(): Readonly<TrackStackState> {
    return this.state;
  }

  public getStateSnapshot(): TrackStackState {
    return {
      stacks: this.state.stacks.map(s => ({ ...s, childTrackIds: [...s.childTrackIds] })),
      selectedStackId: this.state.selectedStackId,
    };
  }

  // ===========================================================================
  // Listeners
  // ===========================================================================

  public subscribe(listener: (state: TrackStackState) => void): () => void {
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

  public serialize(): TrackStackState {
    return this.getStateSnapshot();
  }

  public deserialize(data: TrackStackState): void {
    this.state = {
      stacks: data.stacks.map(s => ({ ...s, childTrackIds: [...s.childTrackIds] })),
      selectedStackId: data.selectedStackId,
    };
    this.notifyListeners();
  }
}

export function createTrackStackManager(): TrackStackManager {
  return new TrackStackManager();
}

export default TrackStackManager;
