/**
 * Mute/Solo Groups - Professional track grouping for mixing
 *
 * Features:
 * - Create/delete mute/solo groups
 * - Assign tracks to groups
 * - Group mute (mute all tracks in group)
 * - Group solo (solo all tracks in group)
 * - Exclusive solo (solo one group, mute others)
 * - Group visibility toggle
 * - Color-coded groups
 * - Group naming
 *
 * Workflow:
 * 1. Create a group (e.g., "Drums", "Vocals")
 * 2. Assign tracks to groups
 * 3. Use group mute/solo for quick mixing
 */

export interface MuteSoloGroup {
  /** Unique group ID */
  id: string;
  /** Group name */
  name: string;
  /** Group color */
  color: string;
  /** Track IDs in this group */
  trackIds: string[];
  /** Whether group is muted */
  muted: boolean;
  /** Whether group is soloed */
  soloed: boolean;
  /** Whether group is visible */
  visible: boolean;
  /** Group volume (for group fader) */
  volume: number;
  /** Group pan (for group pan) */
  pan: number;
  /** Timestamp */
  createdAt: number;
}

export interface MuteSoloGroupState {
  /** All groups */
  groups: MuteSoloGroup[];
  /** Currently soloed group ID (for exclusive solo) */
  exclusiveSoloId: string | null;
  /** Global solo mode */
  soloMode: 'normal' | 'exclusive';
}

export interface MuteSoloGroupManagerOptions {
  /** Default group color */
  defaultColor: string;
  /** Maximum groups */
  maxGroups: number;
  /** Auto-create groups from track colors */
  autoGroupByColor: boolean;
}

const DEFAULT_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
];

const DEFAULT_OPTIONS: MuteSoloGroupManagerOptions = {
  defaultColor: '#3b82f6',
  maxGroups: 32,
  autoGroupByColor: false,
};

export class MuteSoloGroupManager {
  private state: MuteSoloGroupState;
  private options: MuteSoloGroupManagerOptions;
  private listeners: Array<(state: MuteSoloGroupState) => void> = [];

  constructor(options: Partial<MuteSoloGroupManagerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.state = {
      groups: [],
      exclusiveSoloId: null,
      soloMode: 'normal',
    };
  }

  // ===========================================================================
  // Group Management
  // ===========================================================================

  /**
   * Create a new group
   */
  createGroup(name: string, color?: string): MuteSoloGroup | null {
    if (this.state.groups.length >= this.options.maxGroups) {
      console.warn('[MuteSoloGroup] Maximum groups reached');
      return null;
    }

    const group: MuteSoloGroup = {
      id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      color: color ?? DEFAULT_COLORS[this.state.groups.length % DEFAULT_COLORS.length],
      trackIds: [],
      muted: false,
      soloed: false,
      visible: true,
      volume: 1,
      pan: 0,
      createdAt: Date.now(),
    };

    this.state.groups.push(group);
    this.notifyListeners();
    return group;
  }

  /**
   * Delete a group
   */
  deleteGroup(groupId: string): boolean {
    const index = this.state.groups.findIndex(g => g.id === groupId);
    if (index < 0) return false;

    this.state.groups.splice(index, 1);

    if (this.state.exclusiveSoloId === groupId) {
      this.state.exclusiveSoloId = null;
    }

    this.notifyListeners();
    return true;
  }

  /**
   * Rename a group
   */
  renameGroup(groupId: string, name: string): boolean {
    const group = this.state.groups.find(g => g.id === groupId);
    if (!group) return false;

    group.name = name;
    this.notifyListeners();
    return true;
  }

  /**
   * Set group color
   */
  setGroupColor(groupId: string, color: string): boolean {
    const group = this.state.groups.find(g => g.id === groupId);
    if (!group) return false;

    group.color = color;
    this.notifyListeners();
    return true;
  }

  /**
   * Get all groups
   */
  getGroups(): ReadonlyArray<MuteSoloGroup> {
    return this.state.groups;
  }

  /**
   * Get a specific group
   */
  getGroup(groupId: string): MuteSoloGroup | undefined {
    return this.state.groups.find(g => g.id === groupId);
  }

  /**
   * Get group by name
   */
  getGroupByName(name: string): MuteSoloGroup | undefined {
    return this.state.groups.find(g => g.name === name);
  }

  // ===========================================================================
  // Track Assignment
  // ===========================================================================

  /**
   * Add track to group
   */
  addTrackToGroup(groupId: string, trackId: string): boolean {
    const group = this.state.groups.find(g => g.id === groupId);
    if (!group) return false;

    // Remove from other groups first
    this.removeTrackFromAllGroups(trackId);

    if (!group.trackIds.includes(trackId)) {
      group.trackIds.push(trackId);
      this.notifyListeners();
    }

    return true;
  }

  /**
   * Remove track from group
   */
  removeTrackFromGroup(groupId: string, trackId: string): boolean {
    const group = this.state.groups.find(g => g.id === groupId);
    if (!group) return false;

    const index = group.trackIds.indexOf(trackId);
    if (index < 0) return false;

    group.trackIds.splice(index, 1);
    this.notifyListeners();
    return true;
  }

  /**
   * Remove track from all groups
   */
  removeTrackFromAllGroups(trackId: string): void {
    for (const group of this.state.groups) {
      const index = group.trackIds.indexOf(trackId);
      if (index >= 0) {
        group.trackIds.splice(index, 1);
      }
    }
  }

  /**
   * Get groups for a track
   */
  getTrackGroups(trackId: string): MuteSoloGroup[] {
    return this.state.groups.filter(g => g.trackIds.includes(trackId));
  }

  /**
   * Check if track is in a group
   */
  isTrackInGroup(trackId: string, groupId?: string): boolean {
    if (groupId) {
      const group = this.state.groups.find(g => g.id === groupId);
      return group?.trackIds.includes(trackId) ?? false;
    }
    return this.state.groups.some(g => g.trackIds.includes(trackId));
  }

  // ===========================================================================
  // Mute/Solo Operations
  // ===========================================================================

  /**
   * Mute a group
   */
  muteGroup(groupId: string, muted: boolean = true): string[] {
    const group = this.state.groups.find(g => g.id === groupId);
    if (!group) return [];

    group.muted = muted;
    if (muted) {
      group.soloed = false;  // Un-solo when muting
    }

    this.notifyListeners();
    return [...group.trackIds];
  }

  /**
   * Solo a group
   */
  soloGroup(groupId: string, soloed: boolean = true): string[] {
    const group = this.state.groups.find(g => g.id === groupId);
    if (!group) return [];

    if (this.state.soloMode === 'exclusive') {
      // Exclusive solo: un-solo all other groups
      for (const g of this.state.groups) {
        g.soloed = false;
      }
      this.state.exclusiveSoloId = soloed ? groupId : null;
    }

    group.soloed = soloed;
    if (soloed) {
      group.muted = false;  // Un-mute when soloing
    }

    this.notifyListeners();
    return [...group.trackIds];
  }

  /**
   * Mute all groups
   */
  muteAll(): void {
    for (const group of this.state.groups) {
      group.muted = true;
      group.soloed = false;
    }
    this.state.exclusiveSoloId = null;
    this.notifyListeners();
  }

  /**
   * Unmute all groups
   */
  unmuteAll(): void {
    for (const group of this.state.groups) {
      group.muted = false;
    }
    this.notifyListeners();
  }

  /**
   * Solo all groups
   */
  soloAll(): void {
    for (const group of this.state.groups) {
      group.soloed = true;
      group.muted = false;
    }
    this.notifyListeners();
  }

  /**
   * Un-solo all groups
   */
  unsoloAll(): void {
    for (const group of this.state.groups) {
      group.soloed = false;
    }
    this.state.exclusiveSoloId = null;
    this.notifyListeners();
  }

  /**
   * Set solo mode
   */
  setSoloMode(mode: 'normal' | 'exclusive'): void {
    this.state.soloMode = mode;
    if (mode === 'normal') {
      this.state.exclusiveSoloId = null;
    }
    this.notifyListeners();
  }

  /**
   * Get effective mute state for a track
   * Returns true if track should be muted based on group states
   */
  getEffectiveMute(trackId: string): boolean {
    const trackGroups = this.getTrackGroups(trackId);
    if (trackGroups.length === 0) return false;

    // Check if any group is soloed
    const hasSolo = this.state.groups.some(g => g.soloed);
    if (hasSolo) {
      // Track is muted unless it's in a soloed group
      return !trackGroups.some(g => g.soloed);
    }

    // Check if any group is muted
    return trackGroups.some(g => g.muted);
  }

  /**
   * Get effective solo state for a track
   */
  getEffectiveSolo(trackId: string): boolean {
    const trackGroups = this.getTrackGroups(trackId);
    return trackGroups.some(g => g.soloed);
  }

  // ===========================================================================
  // Group Volume/Pan
  // ===========================================================================

  /**
   * Set group volume
   */
  setGroupVolume(groupId: string, volume: number): void {
    const group = this.state.groups.find(g => g.id === groupId);
    if (group) {
      group.volume = Math.max(0, Math.min(1, volume));
      this.notifyListeners();
    }
  }

  /**
   * Set group pan
   */
  setGroupPan(groupId: string, pan: number): void {
    const group = this.state.groups.find(g => g.id === groupId);
    if (group) {
      group.pan = Math.max(-1, Math.min(1, pan));
      this.notifyListeners();
    }
  }

  /**
   * Get group volume
   */
  getGroupVolume(groupId: string): number {
    return this.state.groups.find(g => g.id === groupId)?.volume ?? 1;
  }

  /**
   * Get group pan
   */
  getGroupPan(groupId: string): number {
    return this.state.groups.find(g => g.id === groupId)?.pan ?? 0;
  }

  // ===========================================================================
  // State
  // ===========================================================================

  /**
   * Get state
   */
  getState(): Readonly<MuteSoloGroupState> {
    return this.state;
  }

  /**
   * Set state
   */
  setState(state: Partial<MuteSoloGroupState>): void {
    this.state = { ...this.state, ...state };
    this.notifyListeners();
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: MuteSoloGroupState) => void): () => void {
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
  // Cleanup
  // ===========================================================================

  /**
   * Clear all groups
   */
  clear(): void {
    this.state.groups = [];
    this.state.exclusiveSoloId = null;
    this.notifyListeners();
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.clear();
    this.listeners = [];
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createMuteSoloGroupManager(
  options?: Partial<MuteSoloGroupManagerOptions>
): MuteSoloGroupManager {
  return new MuteSoloGroupManager(options);
}

export default MuteSoloGroupManager;
