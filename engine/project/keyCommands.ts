/**
 * Key Commands - Full Customization
 *
 * Features:
 * - Custom keyboard shortcuts
 * - Command categories (transport, edit, view, etc.)
 * - Conflict detection
 * - Import/export key maps
 * - Preset key maps (Logic, Pro Tools, Ableton)
 *
 * Categories:
 * - Transport: play, stop, record, etc.
 * - Edit: cut, copy, paste, delete, etc.
 * - View: zoom, scroll, etc.
 * - Tools: pencil, eraser, etc.
 * - MIDI: quantize, humanize, etc.
 */

export type KeyCommandCategory =
  | 'transport'
  | 'edit'
  | 'view'
  | 'tools'
  | 'midi'
  | 'mixer'
  | 'arrangement'
  | 'global';

export interface KeyBinding {
  key: string;
  modifiers: {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
  };
}

export interface KeyCommand {
  id: string;
  name: string;
  description: string;
  category: KeyCommandCategory;
  binding: KeyBinding | null;
  enabled: boolean;
  scope: 'global' | 'editor' | 'mixer' | 'arrangement';
}

export interface KeyCommandState {
  commands: KeyCommand[];
  activePreset: string;
  customBindings: Map<string, KeyBinding>;
}

export interface KeyCommandPreset {
  id: string;
  name: string;
  description: string;
  bindings: Record<string, KeyBinding>;
}

export interface KeyCommandOptions {
  preset?: string;
  customBindings?: Record<string, KeyBinding>;
}

// =============================================================================
// Default Commands
// =============================================================================

const DEFAULT_COMMANDS: Omit<KeyCommand, 'binding'>[] = [
  // Transport
  { id: 'transport.play', name: 'Play', description: 'Start playback', category: 'transport', enabled: true, scope: 'global' },
  { id: 'transport.stop', name: 'Stop', description: 'Stop playback', category: 'transport', enabled: true, scope: 'global' },
  { id: 'transport.record', name: 'Record', description: 'Start recording', category: 'transport', enabled: true, scope: 'global' },
  { id: 'transport.pause', name: 'Pause', description: 'Pause playback', category: 'transport', enabled: true, scope: 'global' },
  { id: 'transport.skip-forward', name: 'Skip Forward', description: 'Skip forward', category: 'transport', enabled: true, scope: 'global' },
  { id: 'transport.skip-backward', name: 'Skip Backward', description: 'Skip backward', category: 'transport', enabled: true, scope: 'global' },
  { id: 'transport.goto-start', name: 'Go to Start', description: 'Go to start of project', category: 'transport', enabled: true, scope: 'global' },
  { id: 'transport.goto-end', name: 'Go to End', description: 'Go to end of project', category: 'transport', enabled: true, scope: 'global' },

  // Edit
  { id: 'edit.undo', name: 'Undo', description: 'Undo last action', category: 'edit', enabled: true, scope: 'global' },
  { id: 'edit.redo', name: 'Redo', description: 'Redo last action', category: 'edit', enabled: true, scope: 'global' },
  { id: 'edit.cut', name: 'Cut', description: 'Cut selection', category: 'edit', enabled: true, scope: 'global' },
  { id: 'edit.copy', name: 'Copy', description: 'Copy selection', category: 'edit', enabled: true, scope: 'global' },
  { id: 'edit.paste', name: 'Paste', description: 'Paste from clipboard', category: 'edit', enabled: true, scope: 'global' },
  { id: 'edit.delete', name: 'Delete', description: 'Delete selection', category: 'edit', enabled: true, scope: 'global' },
  { id: 'edit.select-all', name: 'Select All', description: 'Select all', category: 'edit', enabled: true, scope: 'global' },
  { id: 'edit.deselect', name: 'Deselect', description: 'Deselect all', category: 'edit', enabled: true, scope: 'global' },

  // View
  { id: 'view.zoom-in', name: 'Zoom In', description: 'Zoom in', category: 'view', enabled: true, scope: 'global' },
  { id: 'view.zoom-out', name: 'Zoom Out', description: 'Zoom out', category: 'view', enabled: true, scope: 'global' },
  { id: 'view.zoom-fit', name: 'Zoom to Fit', description: 'Zoom to fit selection', category: 'view', enabled: true, scope: 'global' },
  { id: 'view.zoom-selection', name: 'Zoom to Selection', description: 'Zoom to selection', category: 'view', enabled: true, scope: 'global' },

  // Tools
  { id: 'tools.pointer', name: 'Pointer Tool', description: 'Select pointer tool', category: 'tools', enabled: true, scope: 'editor' },
  { id: 'tools.pencil', name: 'Pencil Tool', description: 'Select pencil tool', category: 'tools', enabled: true, scope: 'editor' },
  { id: 'tools.eraser', name: 'Eraser Tool', description: 'Select eraser tool', category: 'tools', enabled: true, scope: 'editor' },
  { id: 'tools.scissors', name: 'Scissors Tool', description: 'Select scissors tool', category: 'tools', enabled: true, scope: 'editor' },
  { id: 'tools.glue', name: 'Glue Tool', description: 'Select glue tool', category: 'tools', enabled: true, scope: 'editor' },

  // MIDI
  { id: 'midi.quantize', name: 'Quantize', description: 'Quantize selected notes', category: 'midi', enabled: true, scope: 'editor' },
  { id: 'midi.humanize', name: 'Humanize', description: 'Humanize selected notes', category: 'midi', enabled: true, scope: 'editor' },
  { id: 'midi.transpose-up', name: 'Transpose Up', description: 'Transpose up one semitone', category: 'midi', enabled: true, scope: 'editor' },
  { id: 'midi.transpose-down', name: 'Transpose Down', description: 'Transpose down one semitone', category: 'midi', enabled: true, scope: 'editor' },
  { id: 'midi.velocity-up', name: 'Velocity Up', description: 'Increase velocity', category: 'midi', enabled: true, scope: 'editor' },
  { id: 'midi.velocity-down', name: 'Velocity Down', description: 'Decrease velocity', category: 'midi', enabled: true, scope: 'editor' },
];

// =============================================================================
// Key Command Presets
// =============================================================================

export const KEY_COMMAND_PRESETS: Record<string, KeyCommandPreset> = {
  'default': {
    id: 'default',
    name: 'Default',
    description: 'Default key commands',
    bindings: {
      'transport.play': { key: ' ', modifiers: { ctrl: false, alt: false, shift: false, meta: false } },
      'transport.stop': { key: ' ', modifiers: { ctrl: false, alt: false, shift: true, meta: false } },
      'transport.record': { key: 'r', modifiers: { ctrl: false, alt: false, shift: false, meta: false } },
      'transport.skip-forward': { key: 'ArrowRight', modifiers: { ctrl: false, alt: false, shift: false, meta: false } },
      'transport.skip-backward': { key: 'ArrowLeft', modifiers: { ctrl: false, alt: false, shift: false, meta: false } },
      'transport.goto-start': { key: 'ArrowLeft', modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      'transport.goto-end': { key: 'ArrowRight', modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      'edit.undo': { key: 'z', modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      'edit.redo': { key: 'z', modifiers: { ctrl: true, alt: false, shift: true, meta: false } },
      'edit.cut': { key: 'x', modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      'edit.copy': { key: 'c', modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      'edit.paste': { key: 'v', modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      'edit.delete': { key: 'Delete', modifiers: { ctrl: false, alt: false, shift: false, meta: false } },
      'edit.select-all': { key: 'a', modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      'view.zoom-in': { key: '=', modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      'view.zoom-out': { key: '-', modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      'view.zoom-fit': { key: '0', modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      'tools.pointer': { key: '1', modifiers: { ctrl: false, alt: false, shift: false, meta: false } },
      'tools.pencil': { key: '2', modifiers: { ctrl: false, alt: false, shift: false, meta: false } },
      'tools.eraser': { key: '3', modifiers: { ctrl: false, alt: false, shift: false, meta: false } },
      'tools.scissors': { key: '4', modifiers: { ctrl: false, alt: false, shift: false, meta: false } },
      'tools.glue': { key: '5', modifiers: { ctrl: false, alt: false, shift: false, meta: false } },
      'midi.quantize': { key: 'q', modifiers: { ctrl: false, alt: false, shift: false, meta: false } },
      'midi.humanize': { key: 'h', modifiers: { ctrl: false, alt: false, shift: false, meta: false } },
      'midi.transpose-up': { key: 'ArrowUp', modifiers: { ctrl: false, alt: false, shift: false, meta: false } },
      'midi.transpose-down': { key: 'ArrowDown', modifiers: { ctrl: false, alt: false, shift: false, meta: false } },
    },
  },
  'logic-pro': {
    id: 'logic-pro',
    name: 'Logic Pro',
    description: 'Logic Pro key commands',
    bindings: {
      'transport.play': { key: ' ', modifiers: { ctrl: false, alt: false, shift: false, meta: false } },
      'transport.record': { key: 'r', modifiers: { ctrl: false, alt: false, shift: false, meta: false } },
      'edit.undo': { key: 'z', modifiers: { ctrl: false, alt: false, shift: false, meta: true } },
      'edit.redo': { key: 'z', modifiers: { ctrl: false, alt: false, shift: true, meta: true } },
    },
  },
  'pro-tools': {
    id: 'pro-tools',
    name: 'Pro Tools',
    description: 'Pro Tools key commands',
    bindings: {
      'transport.play': { key: ' ', modifiers: { ctrl: false, alt: false, shift: false, meta: false } },
      'transport.record': { key: 'F12', modifiers: { ctrl: false, alt: false, shift: false, meta: false } },
      'edit.undo': { key: 'z', modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
    },
  },
  'ableton': {
    id: 'ableton',
    name: 'Ableton Live',
    description: 'Ableton Live key commands',
    bindings: {
      'transport.play': { key: ' ', modifiers: { ctrl: false, alt: false, shift: false, meta: false } },
      'transport.record': { key: 'F9', modifiers: { ctrl: false, alt: false, shift: false, meta: false } },
    },
  },
};

// =============================================================================
// Key Command Manager
// =============================================================================

export class KeyCommandManager {
  private state: KeyCommandState;
  private listeners: Array<(command: string) => void> = [];

  constructor(options: KeyCommandOptions = {}) {
    const preset = KEY_COMMAND_PRESETS[options.preset ?? 'default'];

    this.state = {
      commands: DEFAULT_COMMANDS.map(cmd => ({
        ...cmd,
        binding: preset.bindings[cmd.id] ?? null,
      })),
      activePreset: options.preset ?? 'default',
      customBindings: new Map(Object.entries(options.customBindings ?? {})),
    };
  }

  // ===========================================================================
  // Command Management
  // ===========================================================================

  public getCommand(id: string): KeyCommand | undefined {
    return this.state.commands.find(cmd => cmd.id === id);
  }

  public getCommands(): ReadonlyArray<KeyCommand> {
    return this.state.commands;
  }

  public getCommandsByCategory(category: KeyCommandCategory): ReadonlyArray<KeyCommand> {
    return this.state.commands.filter(cmd => cmd.category === category);
  }

  public getCommandsByScope(scope: KeyCommand['scope']): ReadonlyArray<KeyCommand> {
    return this.state.commands.filter(cmd => cmd.scope === scope);
  }

  // ===========================================================================
  // Binding Management
  // ===========================================================================

  public setBinding(commandId: string, binding: KeyBinding | null): boolean {
    const command = this.state.commands.find(cmd => cmd.id === commandId);
    if (!command) return false;

    // Check for conflicts
    if (binding) {
      const conflict = this.findBindingConflict(binding, commandId);
      if (conflict) {
        console.warn(`[KeyCommands] Binding conflict: ${bindingToString(binding)} is already bound to ${conflict.name}`);
        // Remove conflicting binding
        conflict.binding = null;
      }
    }

    command.binding = binding;
    this.notifyListeners(commandId);
    return true;
  }

  public getBinding(commandId: string): KeyBinding | null {
    const command = this.state.commands.find(cmd => cmd.id === commandId);
    return command?.binding ?? null;
  }

  public findBindingConflict(binding: KeyBinding, excludeCommandId?: string): KeyCommand | null {
    return this.state.commands.find(cmd =>
      cmd.id !== excludeCommandId &&
      cmd.binding &&
      bindingsEqual(cmd.binding, binding)
    ) ?? null;
  }

  public findCommandByBinding(binding: KeyBinding): KeyCommand | null {
    return this.state.commands.find(cmd =>
      cmd.binding &&
      bindingsEqual(cmd.binding, binding)
    ) ?? null;
  }

  // ===========================================================================
  // Preset Management
  // ===========================================================================

  public loadPreset(presetId: string): boolean {
    const preset = KEY_COMMAND_PRESETS[presetId];
    if (!preset) return false;

    this.state.activePreset = presetId;

    for (const command of this.state.commands) {
      command.binding = preset.bindings[command.id] ?? null;
    }

    this.notifyListeners('all');
    return true;
  }

  public getActivePreset(): string {
    return this.state.activePreset;
  }

  public getPresets(): ReadonlyArray<KeyCommandPreset> {
    return Object.values(KEY_COMMAND_PRESETS);
  }

  // ===========================================================================
  // Import/Export
  // ===========================================================================

  public exportKeyMap(): string {
    const bindings: Record<string, KeyBinding> = {};
    for (const cmd of this.state.commands) {
      if (cmd.binding) {
        bindings[cmd.id] = cmd.binding;
      }
    }

    const data = {
      preset: this.state.activePreset,
      bindings,
    };
    return JSON.stringify(data, null, 2);
  }

  public importKeyMap(json: string): boolean {
    try {
      const data = JSON.parse(json) as { preset?: string; bindings: Record<string, KeyBinding> };

      if (data.preset) {
        this.state.activePreset = data.preset;
      }

      for (const [commandId, binding] of Object.entries(data.bindings)) {
        this.setBinding(commandId, binding);
      }

      return true;
    } catch (error) {
      console.error('[KeyCommands] Import failed:', error);
      return false;
    }
  }

  // ===========================================================================
  // Event Handling
  // ===========================================================================

  public handleKeyboardEvent(event: KeyboardEvent): string | null {
    const binding: KeyBinding = {
      key: event.key,
      modifiers: {
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
      },
    };

    const command = this.findCommandByBinding(binding);
    if (command && command.enabled) {
      this.notifyListeners(command.id);
      return command.id;
    }

    return null;
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getState(): Readonly<KeyCommandState> {
    return this.state;
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  public subscribe(listener: (commandId: string) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(commandId: string): void {
    for (const listener of this.listeners) {
      listener(commandId);
    }
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  public serialize(): KeyCommandState {
    return {
      ...this.state,
      commands: this.state.commands.map(cmd => ({ ...cmd, binding: cmd.binding ? { ...cmd.binding } : null })),
      customBindings: new Map(this.state.customBindings),
    };
  }

  public deserialize(data: KeyCommandState): void {
    this.state = {
      ...data,
      commands: data.commands.map(cmd => ({ ...cmd, binding: cmd.binding ? { ...cmd.binding } : null })),
      customBindings: new Map(data.customBindings),
    };
    this.notifyListeners('all');
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

export function bindingToString(binding: KeyBinding): string {
  const parts: string[] = [];
  if (binding.modifiers.ctrl) parts.push('Ctrl');
  if (binding.modifiers.alt) parts.push('Alt');
  if (binding.modifiers.shift) parts.push('Shift');
  if (binding.modifiers.meta) parts.push('Cmd');
  parts.push(binding.key);
  return parts.join('+');
}

function bindingsEqual(a: KeyBinding, b: KeyBinding): boolean {
  return (
    a.key === b.key &&
    a.modifiers.ctrl === b.modifiers.ctrl &&
    a.modifiers.alt === b.modifiers.alt &&
    a.modifiers.shift === b.modifiers.shift &&
    a.modifiers.meta === b.modifiers.meta
  );
}

// =============================================================================
// Factory
// =============================================================================

export function createKeyCommandManager(options?: KeyCommandOptions): KeyCommandManager {
  return new KeyCommandManager(options);
}

export default KeyCommandManager;
