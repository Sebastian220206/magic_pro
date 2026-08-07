/**
 * Track Template Manager - Save and Load Track Presets
 *
 * Features:
 * - Save complete track state as template
 * - Load templates to create new tracks
 * - Built-in templates for common track types
 * - User templates with custom categories
 * - Search and filter templates
 * - Template versioning and compatibility
 * - Import/export templates
 * - Recently used and favorites
 */

import {
  TrackTemplate,
  TrackTemplateCategory,
  TrackTemplateManagerState,
  TrackTemplateManagerOptions,
  TrackTemplateExport,
  TemplateValidationError,
  validateTemplate,
  EffectSlotConfig,
  EffectChainConfig,
  SendConfig,
  InstrumentConfig,
  InputConfig,
  OutputConfig,
  AutomationLaneConfig,
} from './trackTemplateTypes';

import { MidiClip } from '../midi/types';

// =============================================================================
// Default State
// =============================================================================

const DEFAULT_OPTIONS: Required<TrackTemplateManagerOptions> = {
  storageKey: 'daw-track-templates',
  maxRecent: 20,
  autoSave: true,
  builtinTemplates: [],
};

// =============================================================================
// Track Template Manager
// =============================================================================

export class TrackTemplateManager {
  private state: TrackTemplateManagerState;
  private options: Required<TrackTemplateManagerOptions>;
  private listeners: Array<(state: TrackTemplateManagerState) => void> = [];

  constructor(options: TrackTemplateManagerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.state = {
      templates: [],
      selectedId: null,
      categoryFilter: null,
      searchQuery: '',
      sortBy: 'updatedAt',
      sortDirection: 'desc',
      recentlyUsed: [],
      favorites: new Set(),
    };

    this.loadFromStorage();

    // Add built-in templates
    if (this.options.builtinTemplates) {
      for (const template of this.options.builtinTemplates) {
        if (!this.state.templates.find(t => t.id === template.id)) {
          this.state.templates.push(template);
        }
      }
    }
  }

  // ===========================================================================
  // State Access
  // ===========================================================================

  public getState(): Readonly<TrackTemplateManagerState> {
    return this.state;
  }

  public getTemplates(): ReadonlyArray<TrackTemplate> {
    return this.getFilteredAndSortedTemplates();
  }

  public getTemplate(id: string): TrackTemplate | undefined {
    return this.state.templates.find(t => t.id === id);
  }

  public getTemplateCount(): number {
    return this.state.templates.length;
  }

  public getSelectedTemplate(): TrackTemplate | null {
    return this.state.templates.find(t => t.id === this.state.selectedId) ?? null;
  }

  // ===========================================================================
  // Template CRUD
  // ===========================================================================

  public createTemplate(template: Omit<TrackTemplate, 'id' | 'createdAt' | 'updatedAt' | 'version'>): TrackTemplate {
    const newTemplate: TrackTemplate = {
      ...template,
      id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    const validationErrors = validateTemplate(newTemplate);
    const criticalErrors = validationErrors.filter(e => e.severity === 'error');
    if (criticalErrors.length > 0) {
      throw new Error(`Template validation failed: ${criticalErrors.map(e => e.message).join(', ')}`);
    }

    this.state.templates.push(newTemplate);
    this.saveToStorage();
    this.notifyListeners();
    return newTemplate;
  }

  public updateTemplate(id: string, updates: Partial<TrackTemplate>): boolean {
    const index = this.state.templates.findIndex(t => t.id === id);
    if (index < 0) return false;

    const template = this.state.templates[index];
    if (template.isBuiltIn) {
      // Create a copy for built-in templates
      const copy = { ...template, ...updates, isBuiltIn: false };
      copy.id = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      copy.name = `${template.name} (Copy)`;
      copy.updatedAt = Date.now();
      this.state.templates.push(copy);
    } else {
      Object.assign(template, updates, { updatedAt: Date.now() });
    }

    this.saveToStorage();
    this.notifyListeners();
    return true;
  }

  public deleteTemplate(id: string): boolean {
    const index = this.state.templates.findIndex(t => t.id === id);
    if (index < 0) return false;

    const template = this.state.templates[index];
    if (template.isBuiltIn) {
      return false; // Cannot delete built-in templates
    }

    this.state.templates.splice(index, 1);
    this.state.favorites.delete(id);
    this.state.recentlyUsed = this.state.recentlyUsed.filter(tid => tid !== id);

    if (this.state.selectedId === id) {
      this.state.selectedId = null;
    }

    this.saveToStorage();
    this.notifyListeners();
    return true;
  }

  public duplicateTemplate(id: string): TrackTemplate | null {
    const original = this.state.templates.find(t => t.id === id);
    if (!original) return null;

    const newTemplate: TrackTemplate = {
      ...original,
      id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: `${original.name} (Copy)`,
      isBuiltIn: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: original.version,
    };

    this.state.templates.push(newTemplate);
    this.saveToStorage();
    this.notifyListeners();
    return newTemplate;
  }

  // ===========================================================================
  // Template Operations
  // ===========================================================================

  public createTemplateFromTrack(config: {
    trackType: TrackTemplate['trackType'];
    name: string;
    color: string;
    volume: number;
    pan: number;
    muted: boolean;
    solo: boolean;
    gain: number;
    input?: InputConfig;
    output?: OutputConfig;
    instrument?: InstrumentConfig;
    effects?: EffectChainConfig;
    sends?: SendConfig[];
    automationLanes?: AutomationLaneConfig[];
    defaultClips?: MidiClip[];
  }): TrackTemplate {
    return this.createTemplate({
      name: config.name,
      description: `Template created from ${config.trackType} track`,
      author: 'User',
      category: 'custom',
      tags: [config.trackType],
      isBuiltIn: false,
      isFavorite: false,
      trackType: config.trackType,
      namePrefix: config.name,
      color: config.color,
      volume: config.volume,
      pan: config.pan,
      muted: config.muted,
      solo: config.solo,
      gain: config.gain,
      input: config.input ?? { type: 'mono' },
      output: config.output ?? { type: 'master' },
      instrument: config.instrument,
      effects: config.effects ?? { slots: [], preGain: 0, postGain: 0 },
      sends: config.sends ?? [],
      automationLanes: config.automationLanes ?? [],
      defaultClips: config.defaultClips,
    });
  }

  public applyTemplate(template: TrackTemplate): {
    trackType: TrackTemplate['trackType'];
    name: string;
    color: string;
    volume: number;
    pan: number;
    muted: boolean;
    solo: boolean;
    gain: number;
    input: InputConfig;
    output: OutputConfig;
    instrument?: InstrumentConfig;
    effects: EffectChainConfig;
    sends: SendConfig[];
    automationLanes: AutomationLaneConfig[];
    defaultClips?: MidiClip[];
  } {
    this.addToRecentlyUsed(template.id);
    return {
      trackType: template.trackType,
      name: template.namePrefix,
      color: template.color,
      volume: template.volume,
      pan: template.pan,
      muted: template.muted,
      solo: template.solo,
      gain: template.gain,
      input: { ...template.input },
      output: { ...template.output },
      instrument: template.instrument ? { ...template.instrument } : undefined,
      effects: {
        slots: template.effects.slots.map(s => ({ ...s })),
        preGain: template.effects.preGain,
        postGain: template.effects.postGain,
      },
      sends: template.sends.map(s => ({ ...s })),
      automationLanes: template.automationLanes.map(l => ({
        ...l,
        points: l.points.map(p => ({ ...p })),
      })),
      defaultClips: template.defaultClips?.map(c => ({
        ...c,
        notes: c.notes.map(n => ({ ...n })),
      })),
    };
  }

  // ===========================================================================
  // Selection & Filtering
  // ===========================================================================

  public selectTemplate(id: string | null): void {
    this.state.selectedId = id;
    this.notifyListeners();
  }

  public setCategoryFilter(category: TrackTemplateCategory | null): void {
    this.state.categoryFilter = category;
    this.notifyListeners();
  }

  public setSearchQuery(query: string): void {
    this.state.searchQuery = query;
    this.notifyListeners();
  }

  public setSortBy(sortBy: TrackTemplateManagerState['sortBy'], direction?: 'asc' | 'desc'): void {
    this.state.sortBy = sortBy;
    if (direction) {
      this.state.sortDirection = direction;
    }
    this.notifyListeners();
  }

  private getFilteredAndSortedTemplates(): TrackTemplate[] {
    let templates = [...this.state.templates];

    // Filter by category
    if (this.state.categoryFilter) {
      templates = templates.filter(t => t.category === this.state.categoryFilter);
    }

    // Filter by search query
    if (this.state.searchQuery) {
      const query = this.state.searchQuery.toLowerCase();
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort
    templates.sort((a, b) => {
      let comparison = 0;
      switch (this.state.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'createdAt':
          comparison = a.createdAt - b.createdAt;
          break;
        case 'updatedAt':
          comparison = a.updatedAt - b.updatedAt;
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
      }
      return this.state.sortDirection === 'asc' ? comparison : -comparison;
    });

    return templates;
  }

  // ===========================================================================
  // Favorites
  // ===========================================================================

  public toggleFavorite(id: string): void {
    if (this.state.favorites.has(id)) {
      this.state.favorites.delete(id);
    } else {
      this.state.favorites.add(id);
    }
    this.saveToStorage();
    this.notifyListeners();
  }

  public isFavorite(id: string): boolean {
    return this.state.favorites.has(id);
  }

  public getFavorites(): TrackTemplate[] {
    return this.state.templates.filter(t => this.state.favorites.has(t.id));
  }

  // ===========================================================================
  // Recently Used
  // ===========================================================================

  private addToRecentlyUsed(id: string): void {
    this.state.recentlyUsed = this.state.recentlyUsed.filter(tid => tid !== id);
    this.state.recentlyUsed.unshift(id);
    if (this.state.recentlyUsed.length > this.options.maxRecent) {
      this.state.recentlyUsed = this.state.recentlyUsed.slice(0, this.options.maxRecent);
    }
    this.saveToStorage();
    this.notifyListeners();
  }

  public getRecentlyUsed(): TrackTemplate[] {
    return this.state.recentlyUsed
      .map(id => this.state.templates.find(t => t.id === id))
      .filter((t): t is TrackTemplate => t !== undefined);
  }

  // ===========================================================================
  // Import/Export
  // ===========================================================================

  public exportTemplate(id: string): TrackTemplateExport | null {
    const template = this.state.templates.find(t => t.id === id);
    if (!template) return null;

    return {
      format: 'json',
      version: 1,
      template: { ...template },
      metadata: {
        exportedAt: Date.now(),
        exportedBy: 'DAW',
        dawVersion: '1.0.0',
      },
    };
  }

  public importTemplate(data: TrackTemplateExport): TrackTemplate | null {
    if (!data.template || !data.template.id) {
      return null;
    }

    // Check for existing template with same ID
    const existing = this.state.templates.find(t => t.id === data.template.id);
    if (existing) {
      // Create new ID
      data.template.id = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }

    const validationErrors = validateTemplate(data.template);
    const criticalErrors = validationErrors.filter(e => e.severity === 'error');
    if (criticalErrors.length > 0) {
      return null;
    }

    data.template.isBuiltIn = false;
    data.template.updatedAt = Date.now();
    this.state.templates.push(data.template);
    this.saveToStorage();
    this.notifyListeners();
    return data.template;
  }

  public exportAllTemplates(): string {
    return JSON.stringify({
      version: 1,
      templates: this.state.templates.filter(t => !t.isBuiltIn),
    }, null, 2);
  }

  public importAllTemplates(json: string): number {
    try {
      const data = JSON.parse(json);
      let count = 0;

      if (data.templates && Array.isArray(data.templates)) {
        for (const template of data.templates) {
          if (this.importTemplate({ format: 'json', version: 1, template, metadata: { exportedAt: Date.now(), exportedBy: 'Import', dawVersion: '1.0.0' } })) {
            count++;
          }
        }
      }

      return count;
    } catch {
      return 0;
    }
  }

  // ===========================================================================
  // Validation
  // ===========================================================================

  public validateTemplate(template: TrackTemplate): TemplateValidationError[] {
    return validateTemplate(template);
  }

  public compareTemplates(template: TrackTemplate, target: Partial<TrackTemplate>): {
    field: string;
    templateValue: unknown;
    targetValue: unknown;
  }[] {
    const differences: { field: string; templateValue: unknown; targetValue: unknown }[] = [];

    const fields: (keyof TrackTemplate)[] = [
      'trackType', 'color', 'volume', 'pan', 'muted', 'solo', 'gain',
    ];

    for (const field of fields) {
      if (field in target && template[field] !== target[field]) {
        differences.push({
          field,
          templateValue: template[field],
          targetValue: target[field],
        });
      }
    }

    return differences;
  }

  // ===========================================================================
  // Storage
  // ===========================================================================

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.options.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.state.templates = data.templates ?? [];
        this.state.recentlyUsed = data.recentlyUsed ?? [];
        this.state.favorites = new Set(data.favorites ?? []);
      }
    } catch {
      // Ignore storage errors
    }
  }

  private saveToStorage(): void {
    if (!this.options.autoSave) return;

    try {
      localStorage.setItem(this.options.storageKey, JSON.stringify({
        templates: this.state.templates,
        recentlyUsed: this.state.recentlyUsed,
        favorites: Array.from(this.state.favorites),
      }));
    } catch {
      // Ignore storage errors
    }
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  public subscribe(listener: (state: TrackTemplateManagerState) => void): () => void {
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

  public dispose(): void {
    this.state.templates = [];
    this.state.selectedId = null;
    this.state.recentlyUsed = [];
    this.state.favorites.clear();
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createTrackTemplateManager(options?: TrackTemplateManagerOptions): TrackTemplateManager {
  return new TrackTemplateManager(options);
}

export default TrackTemplateManager;
