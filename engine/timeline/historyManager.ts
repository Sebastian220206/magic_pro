/**
 * Undo/Redo System - Command pattern implementation for clip editing
 * 
 * Features:
 * - Command stack with unlimited history
 * - Group commands for complex operations
 * - Keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z)
 * - Memory management with history limits
 */

import { Clip } from '../timeline/types';

// =============================================================================
// Types
// =============================================================================

export type CommandType = 
  | 'addClip'
  | 'deleteClip'
  | 'moveClip'
  | 'trimClip'
  | 'splitClip'
  | 'duplicateClip'
  | 'updateClipProperty'
  | 'multiCommand'
  | 'fadeUpdate'
  | 'stretchClip'
  | 'reverseClip'
  | 'slipClip';

export interface Command {
  id: string;
  type: CommandType;
  description: string;
  timestamp: number;
  undo: () => void;
  redo: () => void;
}

export interface ClipState {
  clips: Clip[];
  selectedClipIds: Set<string>;
}

export interface HistoryState {
  past: Command[];
  future: Command[];
  maxHistory: number;
}

// =============================================================================
// Command Factory
// =============================================================================

export function createCommand(
  type: CommandType,
  description: string,
  undo: () => void,
  redo: () => void
): Command {
  return {
    id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    description,
    timestamp: Date.now(),
    undo,
    redo,
  };
}

/**
 * Create a multi-command that groups multiple operations
 */
export function createMultiCommand(
  description: string,
  commands: Command[]
): Command {
  return {
    id: `multi-${Date.now()}`,
    type: 'multiCommand',
    description,
    timestamp: Date.now(),
    undo: () => {
      // Undo in reverse order
      for (let i = commands.length - 1; i >= 0; i--) {
        commands[i].undo();
      }
    },
    redo: () => {
      // Redo in original order
      for (const cmd of commands) {
        cmd.redo();
      }
    },
  };
}

// =============================================================================
// History Manager
// =============================================================================

export class HistoryManager {
  private past: Command[] = [];
  private future: Command[] = [];
  private maxHistory: number = 100;
  private isExecuting: boolean = false;

  constructor(maxHistory: number = 100) {
    this.maxHistory = maxHistory;
  }

  /**
   * Execute a command and add to history
   */
  execute(command: Command): void {
    if (this.isExecuting) return;

    this.isExecuting = true;
    
    // Execute the command
    command.redo();
    
    // Add to past
    this.past.push(command);
    
    // Clear future (branching history)
    this.future = [];
    
    // Limit history size
    if (this.past.length > this.maxHistory) {
      this.past.shift();
    }
    
    this.isExecuting = false;
  }

  /**
   * Undo last command
   */
  undo(): Command | null {
    if (this.past.length === 0) return null;
    
    this.isExecuting = true;
    
    const command = this.past.pop()!;
    command.undo();
    this.future.push(command);
    
    this.isExecuting = false;
    
    return command;
  }

  /**
   * Redo next command
   */
  redo(): Command | null {
    if (this.future.length === 0) return null;
    
    this.isExecuting = true;
    
    const command = this.future.pop()!;
    command.redo();
    this.past.push(command);
    
    this.isExecuting = false;
    
    return command;
  }

  /**
   * Check if can undo
   */
  canUndo(): boolean {
    return this.past.length > 0;
  }

  /**
   * Check if can redo
   */
  canRedo(): boolean {
    return this.future.length > 0;
  }

  /**
   * Get undo description
   */
  getUndoDescription(): string | null {
    if (this.past.length === 0) return null;
    return this.past[this.past.length - 1].description;
  }

  /**
   * Get redo description
   */
  getRedoDescription(): string | null {
    if (this.future.length === 0) return null;
    return this.future[this.future.length - 1].description;
  }

  /**
   * Get all past commands
   */
  getHistory(): Command[] {
    return [...this.past];
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.past = [];
    this.future = [];
  }

  /**
   * Set max history size
   */
  setMaxHistory(size: number): void {
    this.maxHistory = size;
    
    // Trim if necessary
    while (this.past.length > this.maxHistory) {
      this.past.shift();
    }
  }

  /**
   * Get current state
   */
  getState(): HistoryState {
    return {
      past: [...this.past],
      future: [...this.future],
      maxHistory: this.maxHistory,
    };
  }
}

// =============================================================================
// Clip Editing Commands
// =============================================================================

export function createAddClipCommand(
  clip: Clip,
  addFn: (clip: Clip) => void,
  removeFn: (clipId: string) => void
): Command {
  return createCommand(
    'addClip',
    `Add clip "${clip.name}"`,
    () => removeFn(clip.id),
    () => addFn(clip)
  );
}

export function createDeleteClipCommand(
  clip: Clip,
  removeFn: (clipId: string) => void,
  addFn: (clip: Clip) => void
): Command {
  return createCommand(
    'deleteClip',
    `Delete clip "${clip.name}"`,
    () => addFn(clip),
    () => removeFn(clip.id)
  );
}

export function createMoveClipCommand(
  clipId: string,
  clipName: string,
  oldStartTime: number,
  newStartTime: number,
  moveFn: (clipId: string, startTime: number) => void
): Command {
  return createCommand(
    'moveClip',
    `Move clip "${clipName}"`,
    () => moveFn(clipId, oldStartTime),
    () => moveFn(clipId, newStartTime)
  );
}

export function createTrimClipCommand(
  clipId: string,
  clipName: string,
  oldStartTime: number,
  oldDuration: number,
  newStartTime: number,
  newDuration: number,
  trimFn: (clipId: string, startTime: number, duration: number) => void
): Command {
  return createCommand(
    'trimClip',
    `Trim clip "${clipName}"`,
    () => trimFn(clipId, oldStartTime, oldDuration),
    () => trimFn(clipId, newStartTime, newDuration)
  );
}

export function createSplitClipCommand(
  clipId: string,
  clipName: string,
  splitTime: number,
  originalClip: Clip,
  splitResult: [Clip, Clip] | null,
  splitFn: (clipId: string, splitTime: number) => [Clip, Clip] | null,
  mergeFn: (leftClip: Clip, rightClip: Clip, original: Clip) => void
): Command {
  if (!splitResult) {
    return createCommand(
      'splitClip',
      `Split clip "${clipName}"`,
      () => { console.warn('[History] Split clip redo unavailable: split failed'); },
      () => { console.warn('[History] Split clip undo unavailable: split failed'); }
    );
  }

  const [leftClip, rightClip] = splitResult;

  return createCommand(
    'splitClip',
    `Split clip "${clipName}" at ${splitTime.toFixed(2)}`,
    () => mergeFn(leftClip, rightClip, originalClip),
    () => splitFn(clipId, splitTime)
  );
}

export function createUpdatePropertyCommand(
  clipId: string,
  clipName: string,
  property: string,
  oldValue: any,
  newValue: any,
  updateFn: (clipId: string, value: any) => void
): Command {
  return createCommand(
    'updateClipProperty',
    `Update ${property} on "${clipName}"`,
    () => updateFn(clipId, oldValue),
    () => updateFn(clipId, newValue)
  );
}

// =============================================================================
// Keyboard Handler
// =============================================================================

export function setupHistoryKeyboardShortcuts(
  historyManager: HistoryManager,
  onUndo?: (cmd: Command | null) => void,
  onRedo?: (cmd: Command | null) => void
): () => void {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl/Cmd + Z = Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      const cmd = historyManager.undo();
      onUndo?.(cmd);
    }
    
    // Ctrl/Cmd + Shift + Z = Redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      const cmd = historyManager.redo();
      onRedo?.(cmd);
    }
    
    // Ctrl/Cmd + Y = Redo (alternative)
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      const cmd = historyManager.redo();
      onRedo?.(cmd);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}

// =============================================================================
// Export
// =============================================================================

export function createHistoryManager(maxHistory?: number): HistoryManager {
  return new HistoryManager(maxHistory);
}

export default HistoryManager;
