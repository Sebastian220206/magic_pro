/**
 * VCA Faders - Mix Groups
 *
 * Features:
 * - VCA master fader controls group of tracks
 * - Relative gain offsets per track
 * - Multiple mix groups
 * - Solo/Mute affects all tracks in group
 *
 * Signal Flow:
 * Track Volume × VCA Gain = Final Volume
 * (VCA is a remote control, not audio routing)
 */

export interface VCAFaderConfig {
  id: string;
  name: string;
  gain: number;         // dB (-60 to +12)
  color: string;
  trackIds: string[];   // Tracks controlled by this VCA
  trackOffsets: Map<string, number>; // Per-track relative offset (dB)
  locked: boolean;
}

export interface VCAFaderOptions {
  name?: string;
  color?: string;
  trackIds?: string[];
}

export interface VCAFaderState {
  vcas: VCAFaderConfig[];
  selectedVCAId: string | null;
}

export class VCAFaderManager {
  private state: VCAFaderState;
  private listeners: Array<(state: VCAFaderState) => void> = [];

  constructor() {
    this.state = {
      vcas: [],
      selectedVCAId: null,
    };
  }

  // ===========================================================================
  // VCA Management
  // ===========================================================================

  public createVCA(
    id: string,
    name: string,
    options: VCAFaderOptions = {}
  ): VCAFaderConfig {
    const vca: VCAFaderConfig = {
      id,
      name,
      gain: 0,
      color: options.color ?? '#3B82F6',
      trackIds: options.trackIds ?? [],
      trackOffsets: new Map(),
      locked: false,
    };

    this.state.vcas.push(vca);
    this.notifyListeners();
    return vca;
  }

  public deleteVCA(id: string): boolean {
    const index = this.state.vcas.findIndex(v => v.id === id);
    if (index >= 0 && !this.state.vcas[index].locked) {
      this.state.vcas.splice(index, 1);
      if (this.state.selectedVCAId === id) {
        this.state.selectedVCAId = null;
      }
      this.notifyListeners();
      return true;
    }
    return false;
  }

  public getVCA(id: string): VCAFaderConfig | undefined {
    return this.state.vcas.find(v => v.id === id);
  }

  public getVCAs(): ReadonlyArray<VCAFaderConfig> {
    return this.state.vcas;
  }

  // ===========================================================================
  // Track Management
  // ===========================================================================

  public addTrack(vcaId: string, trackId: string): boolean {
    const vca = this.state.vcas.find(v => v.id === vcaId);
    if (vca && !vca.trackIds.includes(trackId)) {
      vca.trackIds.push(trackId);
      vca.trackOffsets.set(trackId, 0);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  public removeTrack(vcaId: string, trackId: string): boolean {
    const vca = this.state.vcas.find(v => v.id === vcaId);
    if (vca) {
      const index = vca.trackIds.indexOf(trackId);
      if (index >= 0) {
        vca.trackIds.splice(index, 1);
        vca.trackOffsets.delete(trackId);
        this.notifyListeners();
        return true;
      }
    }
    return false;
  }

  public getTracks(vcaId: string): string[] {
    const vca = this.state.vcas.find(v => v.id === vcaId);
    return vca ? [...vca.trackIds] : [];
  }

  public getTrackVCA(trackId: string): VCAFaderConfig | null {
    return this.state.vcas.find(v => v.trackIds.includes(trackId)) ?? null;
  }

  // ===========================================================================
  // Gain Control
  // ===========================================================================

  public setGain(vcaId: string, db: number): void {
    const vca = this.state.vcas.find(v => v.id === vcaId);
    if (vca && !vca.locked) {
      vca.gain = Math.max(-60, Math.min(12, db));
      this.notifyListeners();
    }
  }

  public getGain(vcaId: string): number {
    const vca = this.state.vcas.find(v => v.id === vcaId);
    return vca?.gain ?? 0;
  }

  public setTrackOffset(vcaId: string, trackId: string, offsetDb: number): void {
    const vca = this.state.vcas.find(v => v.id === vcaId);
    if (vca && vca.trackIds.includes(trackId)) {
      vca.trackOffsets.set(trackId, Math.max(-60, Math.min(12, offsetDb)));
      this.notifyListeners();
    }
  }

  public getTrackOffset(vcaId: string, trackId: string): number {
    const vca = this.state.vcas.find(v => v.id === vcaId);
    return vca?.trackOffsets.get(trackId) ?? 0;
  }

  /**
   * Calculate effective gain for a track
   * Returns gain in dB to apply to track volume
   */
  public getEffectiveGain(trackId: string): number {
    const vca = this.getTrackVCA(trackId);
    if (!vca) return 0;

    const offset = vca.trackOffsets.get(trackId) ?? 0;
    return vca.gain + offset;
  }

  // ===========================================================================
  // Properties
  // ===========================================================================

  public setName(vcaId: string, name: string): void {
    const vca = this.state.vcas.find(v => v.id === vcaId);
    if (vca) {
      vca.name = name;
      this.notifyListeners();
    }
  }

  public setColor(vcaId: string, color: string): void {
    const vca = this.state.vcas.find(v => v.id === vcaId);
    if (vca) {
      vca.color = color;
      this.notifyListeners();
    }
  }

  public setLocked(vcaId: string, locked: boolean): void {
    const vca = this.state.vcas.find(v => v.id === vcaId);
    if (vca) {
      vca.locked = locked;
      this.notifyListeners();
    }
  }

  // ===========================================================================
  // Selection
  // ===========================================================================

  public selectVCA(id: string | null): void {
    this.state.selectedVCAId = id;
    this.notifyListeners();
  }

  public getSelectedVCA(): VCAFaderConfig | null {
    return this.state.vcas.find(v => v.id === this.state.selectedVCAId) ?? null;
  }

  // ===========================================================================
  // Bulk Operations
  // ===========================================================================

  public resetAllGains(): void {
    for (const vca of this.state.vcas) {
      vca.gain = 0;
    }
    this.notifyListeners();
  }

  public resetAllOffsets(): void {
    for (const vca of this.state.vcas) {
      vca.trackOffsets.clear();
    }
    this.notifyListeners();
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getState(): Readonly<VCAFaderState> {
    return this.state;
  }

  public getStateSnapshot(): VCAFaderState {
    return {
      vcas: this.state.vcas.map(v => ({
        ...v,
        trackIds: [...v.trackIds],
        trackOffsets: new Map(v.trackOffsets),
      })),
      selectedVCAId: this.state.selectedVCAId,
    };
  }

  // ===========================================================================
  // Listeners
  // ===========================================================================

  public subscribe(listener: (state: VCAFaderState) => void): () => void {
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

  public serialize(): VCAFaderState {
    return this.getStateSnapshot();
  }

  public deserialize(data: VCAFaderState): void {
    this.state = {
      vcas: data.vcas.map(v => ({
        ...v,
        trackIds: [...v.trackIds],
        trackOffsets: new Map(v.trackOffsets),
      })),
      selectedVCAId: data.selectedVCAId,
    };
    this.notifyListeners();
  }
}

export function createVCAFaderManager(): VCAFaderManager {
  return new VCAFaderManager();
}

export default VCAFaderManager;
