/**
 * Screensets - Layout Management
 *
 * Features:
 * - Save/restore window layouts
 * - Panel positions and sizes
 * - Window states (maximized, minimized)
 * - Quick recall with number keys
 * - Per-project or global screensets
 *
 * Panels:
 * - Arrangement
 * - Mixer
 * - Piano Roll
 * - Step Sequencer
 * - Inspector
 * - Browser
 * - Transport
 */

export type PanelType =
  | 'arrangement'
  | 'mixer'
  | 'piano-roll'
  | 'step-sequencer'
  | 'inspector'
  | 'browser'
  | 'transport'
  | 'notes'
  | 'video'
  | 'sample-editor';

export interface PanelState {
  id: PanelType;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  docked: boolean;
  dockPosition: 'left' | 'right' | 'top' | 'bottom' | null;
}

export interface Screenset {
  id: string;
  name: string;
  description: string;
  panels: PanelState[];
  createdAt: number;
  updatedAt: number;
  isDefault: boolean;
  keyBinding?: number; // 1-9 for quick recall
}

export interface ScreensetState {
  screensets: Screenset[];
  activeScreensetId: string;
  lastSwitchTime: number;
}

export interface ScreensetOptions {
  name?: string;
  description?: string;
}

const DEFAULT_PANELS: PanelState[] = [
  { id: 'arrangement', visible: true, x: 0, y: 0, width: 1200, height: 400, minimized: false, maximized: false, docked: true, dockPosition: 'top' },
  { id: 'mixer', visible: false, x: 0, y: 400, width: 1200, height: 200, minimized: false, maximized: false, docked: true, dockPosition: 'bottom' },
  { id: 'inspector', visible: true, x: 0, y: 0, width: 250, height: 600, minimized: false, maximized: false, docked: true, dockPosition: 'left' },
  { id: 'browser', visible: false, x: 950, y: 0, width: 250, height: 600, minimized: false, maximized: false, docked: true, dockPosition: 'right' },
  { id: 'transport', visible: true, x: 300, y: 600, width: 600, height: 60, minimized: false, maximized: false, docked: false, dockPosition: null },
  { id: 'piano-roll', visible: false, x: 250, y: 400, width: 700, height: 200, minimized: false, maximized: false, docked: true, dockPosition: 'bottom' },
  { id: 'step-sequencer', visible: false, x: 250, y: 400, width: 700, height: 200, minimized: false, maximized: false, docked: true, dockPosition: 'bottom' },
];

const DEFAULT_SCREENSET: Screenset = {
  id: 'screenset-default',
  name: 'Default',
  description: 'Default layout',
  panels: DEFAULT_PANELS.map(p => ({ ...p })),
  createdAt: Date.now(),
  updatedAt: Date.now(),
  isDefault: true,
  keyBinding: 1,
};

export class ScreensetManager {
  private state: ScreensetState;
  private listeners: Array<(state: ScreensetState) => void> = [];

  constructor() {
    this.state = {
      screensets: [{ ...DEFAULT_SCREENSET, panels: DEFAULT_SCREENSET.panels.map(p => ({ ...p })) }],
      activeScreensetId: DEFAULT_SCREENSET.id,
      lastSwitchTime: Date.now(),
    };
  }

  // ===========================================================================
  // Screenset Management
  // ===========================================================================

  public createScreenset(options: ScreensetOptions = {}): Screenset {
    const id = `screenset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const activeScreenset = this.getActiveScreenset();

    const screenset: Screenset = {
      id,
      name: options.name ?? `Screenset ${this.state.screensets.length + 1}`,
      description: options.description ?? '',
      panels: activeScreenset
        ? activeScreenset.panels.map(p => ({ ...p }))
        : DEFAULT_PANELS.map(p => ({ ...p })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault: false,
    };

    this.state.screensets.push(screenset);
    this.notifyListeners();
    return screenset;
  }

  public duplicateScreenset(sourceId: string, newName?: string): Screenset | null {
    const source = this.state.screensets.find(s => s.id === sourceId);
    if (!source) return null;

    const id = `screenset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const duplicate: Screenset = {
      ...source,
      id,
      name: newName ?? `${source.name} Copy`,
      panels: source.panels.map(p => ({ ...p })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault: false,
    };

    this.state.screensets.push(duplicate);
    this.notifyListeners();
    return duplicate;
  }

  public deleteScreenset(id: string): boolean {
    const index = this.state.screensets.findIndex(s => s.id === id);
    if (index < 0) return false;

    const screenset = this.state.screensets[index];
    if (screenset.isDefault) return false;

    this.state.screensets.splice(index, 1);

    if (this.state.activeScreensetId === id) {
      const defaultScreenset = this.state.screensets.find(s => s.isDefault);
      if (defaultScreenset) {
        this.switchToScreenset(defaultScreenset.id);
      }
    }

    this.notifyListeners();
    return true;
  }

  public renameScreenset(id: string, name: string): void {
    const screenset = this.state.screensets.find(s => s.id === id);
    if (screenset) {
      screenset.name = name;
      screenset.updatedAt = Date.now();
      this.notifyListeners();
    }
  }

  // ===========================================================================
  // Panel Management
  // ===========================================================================

  public updatePanel(panelId: PanelType, updates: Partial<PanelState>): void {
    const screenset = this.getActiveScreenset();
    if (!screenset) return;

    const panel = screenset.panels.find(p => p.id === panelId);
    if (panel) {
      Object.assign(panel, updates);
      screenset.updatedAt = Date.now();
      this.notifyListeners();
    }
  }

  public getPanel(panelId: PanelType): PanelState | null {
    const screenset = this.getActiveScreenset();
    return screenset?.panels.find(p => p.id === panelId) ?? null;
  }

  public togglePanelVisibility(panelId: PanelType): void {
    const screenset = this.getActiveScreenset();
    if (!screenset) return;

    const panel = screenset.panels.find(p => p.id === panelId);
    if (panel) {
      panel.visible = !panel.visible;
      screenset.updatedAt = Date.now();
      this.notifyListeners();
    }
  }

  public minimizePanel(panelId: PanelType): void {
    this.updatePanel(panelId, { minimized: true });
  }

  public maximizePanel(panelId: PanelType): void {
    this.updatePanel(panelId, { maximized: true, minimized: false });
  }

  public restorePanel(panelId: PanelType): void {
    this.updatePanel(panelId, { minimized: false, maximized: false });
  }

  // ===========================================================================
  // Switching
  // ===========================================================================

  public switchToScreenset(id: string): boolean {
    const screenset = this.state.screensets.find(s => s.id === id);
    if (!screenset) return false;

    this.state.activeScreensetId = id;
    this.state.lastSwitchTime = Date.now();

    this.notifyListeners();
    return true;
  }

  public switchToScreensetByIndex(index: number): boolean {
    const screenset = this.state.screensets.find(s => s.keyBinding === index + 1);
    if (screenset) {
      return this.switchToScreenset(screenset.id);
    }
    return false;
  }

  public getActiveScreenset(): Screenset | null {
    return this.state.screensets.find(s => s.id === this.state.activeScreensetId) ?? null;
  }

  public getScreensets(): ReadonlyArray<Screenset> {
    return this.state.screensets;
  }

  public getScreenset(id: string): Screenset | undefined {
    return this.state.screensets.find(s => s.id === id);
  }

  // ===========================================================================
  // Key Binding
  // ===========================================================================

  public setKeyBinding(screensetId: string, key: number): void {
    const screenset = this.state.screensets.find(s => s.id === screensetId);
    if (!screenset) return;

    // Clear existing binding for this key
    const existing = this.state.screensets.find(s => s.keyBinding === key);
    if (existing) {
      existing.keyBinding = undefined;
    }

    screenset.keyBinding = key;
    this.notifyListeners();
  }

  public getKeyBinding(key: number): Screenset | null {
    return this.state.screensets.find(s => s.keyBinding === key) ?? null;
  }

  // ===========================================================================
  // Import/Export
  // ===========================================================================

  public exportScreensets(): string {
    return JSON.stringify(this.state.screensets, null, 2);
  }

  public importScreensets(json: string): boolean {
    try {
      const screensets = JSON.parse(json) as Screenset[];
      this.state.screensets = screensets;
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('[Screensets] Import failed:', error);
      return false;
    }
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getState(): Readonly<ScreensetState> {
    return this.state;
  }

  public getStateSnapshot(): ScreensetState {
    return {
      screensets: this.state.screensets.map(s => ({
        ...s,
        panels: s.panels.map(p => ({ ...p })),
      })),
      activeScreensetId: this.state.activeScreensetId,
      lastSwitchTime: this.state.lastSwitchTime,
    };
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  public subscribe(listener: (state: ScreensetState) => void): () => void {
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

  public serialize(): ScreensetState {
    return this.getStateSnapshot();
  }

  public deserialize(data: ScreensetState): void {
    this.state = {
      screensets: data.screensets.map(s => ({
        ...s,
        panels: s.panels.map(p => ({ ...p })),
      })),
      activeScreensetId: data.activeScreensetId,
      lastSwitchTime: data.lastSwitchTime,
    };
    this.notifyListeners();
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createScreensetManager(): ScreensetManager {
  return new ScreensetManager();
}

export default ScreensetManager;
