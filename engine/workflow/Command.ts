/**
 * Command.ts
 * Base interface for reversible actions in the DAW.
 */

export interface Command {
    /** Unique identifier for the command type. */
    readonly id: string;
    
    /** Human-readable name for the undo/redo menu. */
    readonly label: string;

    /** Execute the action. */
    execute(): void;

    /** Revert the action. */
    undo(): void;

    /** 
     * Optional: Merge with another command.
     * Useful for batching multiple small edits (like dragging a slider) into one undo step.
     */
    merge?(other: Command): boolean;
}

/**
 * CommandManager.ts
 * Manages the undo/redo stacks and handles command execution.
 */

export class CommandManager {
    private undoStack: Command[] = [];
    private redoStack: Command[] = [];
    private maxHistory: number = 100;

    constructor(maxHistory = 100) {
        this.maxHistory = maxHistory;
    }

    /**
     * Execute a new command and add it to the undo stack.
     * Clears the redo stack.
     */
    execute(command: Command) {
        // Attempt to merge with the last command if applicable
        const lastCommand = this.undoStack[this.undoStack.length - 1];
        if (lastCommand && lastCommand.id === command.id && lastCommand.merge?.(command)) {
            console.log(`[CommandManager] Merged command: ${command.label}`);
            return;
        }

        command.execute();
        this.undoStack.push(command);
        this.redoStack = [];

        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }

        console.log(`[CommandManager] Executed: ${command.label}`);
    }

    undo() {
        const command = this.undoStack.pop();
        if (command) {
            command.undo();
            this.redoStack.push(command);
            console.log(`[CommandManager] Undone: ${command.label}`);
        }
    }

    redo() {
        const command = this.redoStack.pop();
        if (command) {
            command.execute();
            this.undoStack.push(command);
            console.log(`[CommandManager] Redone: ${command.label}`);
        }
    }

    canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    getUndoLabel(): string | null {
        return this.undoStack[this.undoStack.length - 1]?.label ?? null;
    }

    getRedoLabel(): string | null {
        return this.redoStack[this.redoStack.length - 1]?.label ?? null;
    }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }
}

export const commandManager = new CommandManager();
