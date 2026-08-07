/**
 * Arrangement Track - Sections, Markers, Cycle Regions
 *
 * Features:
 * - Named sections (Verse, Chorus, Bridge, etc.)
 * - Markers for navigation
 * - Cycle regions for loop playback
 * - Arrangement editing (move, copy, delete sections)
 *
 * Signal Flow:
 * ArrangementTrack → Timeline → Playhead → Transport
 */

export type SectionType = 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro' | 'custom';

export interface ArrangementSection {
  id: string;
  name: string;
  type: SectionType;
  startBeat: number;
  endBeat: number;
  color: string;
  locked: boolean;
}

export interface ArrangementMarker {
  id: string;
  name: string;
  beat: number;
  color: string;
  type: 'position' | 'span';
  endBeat?: number; // For span markers
}

export interface CycleRegion {
  id: string;
  name: string;
  startBeat: number;
  endBeat: number;
  enabled: boolean;
  color: string;
}

export interface ArrangementState {
  sections: ArrangementSection[];
  markers: ArrangementMarker[];
  cycleRegions: CycleRegion[];
  activeCycleRegionId: string | null;
  selectedSectionIds: string[];
  selectedMarkerIds: string[];
  snapToGrid: boolean;
  gridResolution: number; // beats
}

export interface ArrangementOptions {
  sections?: ArrangementSection[];
  markers?: ArrangementMarker[];
  cycleRegions?: CycleRegion[];
}

const SECTION_COLORS: Record<SectionType, string> = {
  intro: '#3B82F6',
  verse: '#10B981',
  chorus: '#F59E0B',
  bridge: '#8B5CF6',
  outro: '#EF4444',
  custom: '#6B7280',
};

export class ArrangementTrack {
  private state: ArrangementState;
  private listeners: Array<(state: ArrangementState) => void> = [];

  constructor(options: ArrangementOptions = {}) {
    this.state = {
      sections: options.sections ?? [],
      markers: options.markers ?? [],
      cycleRegions: options.cycleRegions ?? [],
      activeCycleRegionId: null,
      selectedSectionIds: [],
      selectedMarkerIds: [],
      snapToGrid: true,
      gridResolution: 1,
    };
  }

  // ===========================================================================
  // Sections
  // ===========================================================================

  public addSection(
    name: string,
    type: SectionType,
    startBeat: number,
    endBeat: number,
    options: Partial<Pick<ArrangementSection, 'color' | 'locked'>> = {}
  ): ArrangementSection {
    const section: ArrangementSection = {
      id: `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      type,
      startBeat,
      endBeat,
      color: options.color ?? SECTION_COLORS[type],
      locked: options.locked ?? false,
    };

    this.state.sections.push(section);
    this.state.sections.sort((a, b) => a.startBeat - b.startBeat);
    this.notifyListeners();
    return section;
  }

  public updateSection(id: string, updates: Partial<Omit<ArrangementSection, 'id'>>): void {
    const section = this.state.sections.find(s => s.id === id);
    if (section && !section.locked) {
      Object.assign(section, updates);
      this.state.sections.sort((a, b) => a.startBeat - b.startBeat);
      this.notifyListeners();
    }
  }

  public deleteSection(id: string): boolean {
    const index = this.state.sections.findIndex(s => s.id === id);
    if (index >= 0 && !this.state.sections[index].locked) {
      this.state.sections.splice(index, 1);
      this.state.selectedSectionIds = this.state.selectedSectionIds.filter(sid => sid !== id);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  public moveSection(id: string, newStartBeat: number): void {
    const section = this.state.sections.find(s => s.id === id);
    if (section && !section.locked) {
      const duration = section.endBeat - section.startBeat;
      section.startBeat = newStartBeat;
      section.endBeat = newStartBeat + duration;
      this.state.sections.sort((a, b) => a.startBeat - b.startBeat);
      this.notifyListeners();
    }
  }

  public duplicateSection(id: string, offsetBeats: number): ArrangementSection | null {
    const section = this.state.sections.find(s => s.id === id);
    if (!section) return null;

    return this.addSection(
      `${section.name} Copy`,
      section.type,
      section.startBeat + offsetBeats,
      section.endBeat + offsetBeats,
      { color: section.color }
    );
  }

  public getSectionAtBeat(beat: number): ArrangementSection | null {
    return this.state.sections.find(s => beat >= s.startBeat && beat < s.endBeat) ?? null;
  }

  public getSections(): ReadonlyArray<ArrangementSection> {
    return this.state.sections;
  }

  // ===========================================================================
  // Markers
  // ===========================================================================

  public addMarker(
    name: string,
    beat: number,
    type: 'position' | 'span' = 'position',
    options: Partial<Pick<ArrangementMarker, 'color' | 'endBeat'>> = {}
  ): ArrangementMarker {
    const marker: ArrangementMarker = {
      id: `marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      beat,
      color: options.color ?? '#EF4444',
      type,
      endBeat: options.endBeat,
    };

    this.state.markers.push(marker);
    this.state.markers.sort((a, b) => a.beat - b.beat);
    this.notifyListeners();
    return marker;
  }

  public updateMarker(id: string, updates: Partial<Omit<ArrangementMarker, 'id'>>): void {
    const marker = this.state.markers.find(m => m.id === id);
    if (marker) {
      Object.assign(marker, updates);
      this.state.markers.sort((a, b) => a.beat - b.beat);
      this.notifyListeners();
    }
  }

  public deleteMarker(id: string): boolean {
    const index = this.state.markers.findIndex(m => m.id === id);
    if (index >= 0) {
      this.state.markers.splice(index, 1);
      this.state.selectedMarkerIds = this.state.selectedMarkerIds.filter(mid => mid !== id);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  public getMarkerAtBeat(beat: number): ArrangementMarker | null {
    return this.state.markers.find(m => {
      if (m.type === 'span' && m.endBeat !== undefined) {
        return beat >= m.beat && beat < m.endBeat;
      }
      return m.beat === beat;
    }) ?? null;
  }

  public getMarkers(): ReadonlyArray<ArrangementMarker> {
    return this.state.markers;
  }

  // ===========================================================================
  // Cycle Regions
  // ===========================================================================

  public addCycleRegion(
    name: string,
    startBeat: number,
    endBeat: number,
    options: Partial<Pick<CycleRegion, 'color' | 'enabled'>> = {}
  ): CycleRegion {
    const region: CycleRegion = {
      id: `cycle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      startBeat,
      endBeat,
      enabled: options.enabled ?? true,
      color: options.color ?? '#3B82F6',
    };

    this.state.cycleRegions.push(region);
    this.notifyListeners();
    return region;
  }

  public updateCycleRegion(id: string, updates: Partial<Omit<CycleRegion, 'id'>>): void {
    const region = this.state.cycleRegions.find(r => r.id === id);
    if (region) {
      Object.assign(region, updates);
      this.notifyListeners();
    }
  }

  public deleteCycleRegion(id: string): boolean {
    const index = this.state.cycleRegions.findIndex(r => r.id === id);
    if (index >= 0) {
      this.state.cycleRegions.splice(index, 1);
      if (this.state.activeCycleRegionId === id) {
        this.state.activeCycleRegionId = null;
      }
      this.notifyListeners();
      return true;
    }
    return false;
  }

  public setActiveCycleRegion(id: string | null): void {
    this.state.activeCycleRegionId = id;
    this.notifyListeners();
  }

  public getActiveCycleRegion(): CycleRegion | null {
    return this.state.cycleRegions.find(r => r.id === this.state.activeCycleRegionId) ?? null;
  }

  public getCycleRegions(): ReadonlyArray<CycleRegion> {
    return this.state.cycleRegions;
  }

  // ===========================================================================
  // Selection
  // ===========================================================================

  public selectSection(id: string, multi = false): void {
    if (multi) {
      const index = this.state.selectedSectionIds.indexOf(id);
      if (index >= 0) {
        this.state.selectedSectionIds.splice(index, 1);
      } else {
        this.state.selectedSectionIds.push(id);
      }
    } else {
      this.state.selectedSectionIds = [id];
    }
    this.notifyListeners();
  }

  public clearSelection(): void {
    this.state.selectedSectionIds = [];
    this.state.selectedMarkerIds = [];
    this.notifyListeners();
  }

  // ===========================================================================
  // Grid
  // ===========================================================================

  public setSnapToGrid(enabled: boolean): void {
    this.state.snapToGrid = enabled;
    this.notifyListeners();
  }

  public setGridResolution(beats: number): void {
    this.state.gridResolution = Math.max(0.25, beats);
    this.notifyListeners();
  }

  public snapBeat(beat: number): number {
    if (!this.state.snapToGrid) return beat;
    return Math.round(beat / this.state.gridResolution) * this.state.gridResolution;
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getState(): Readonly<ArrangementState> {
    return this.state;
  }

  public getStateSnapshot(): ArrangementState {
    return {
      ...this.state,
      sections: [...this.state.sections],
      markers: [...this.state.markers],
      cycleRegions: [...this.state.cycleRegions],
      selectedSectionIds: [...this.state.selectedSectionIds],
      selectedMarkerIds: [...this.state.selectedMarkerIds],
    };
  }

  // ===========================================================================
  // Listeners
  // ===========================================================================

  public subscribe(listener: (state: ArrangementState) => void): () => void {
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

  public serialize(): ArrangementState {
    return this.getStateSnapshot();
  }

  public deserialize(data: ArrangementState): void {
    this.state = {
      ...data,
      sections: [...data.sections],
      markers: [...data.markers],
      cycleRegions: [...data.cycleRegions],
      selectedSectionIds: [...data.selectedSectionIds],
      selectedMarkerIds: [...data.selectedMarkerIds],
    };
    this.notifyListeners();
  }
}

export function createArrangementTrack(options?: ArrangementOptions): ArrangementTrack {
  return new ArrangementTrack(options);
}

export default ArrangementTrack;
