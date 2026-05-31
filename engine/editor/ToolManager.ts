/**
 * tools.ts
 * Tool interfaces for the editor.
 */

import { ScreenPoint, EditorPoint } from './coordinates';

export interface InteractionEvent {
    screenPoint: ScreenPoint;
    editorPoint: EditorPoint;
    originalEvent: PointerEvent | MouseEvent;
    modifiers: {
        shift: boolean;
        ctrl: boolean;
        alt: boolean;
        meta: boolean;
    };
}

export interface Tool {
    readonly id: string;
    readonly cursor: string;

    onPointerDown(event: InteractionEvent): void;
    onPointerMove(event: InteractionEvent): void;
    onPointerUp(event: InteractionEvent): void;
    
    onKeyDown?(key: string, modifiers: InteractionEvent['modifiers']): void;
    onCancel?(): void;

    /** 
     * Optional callback for custom tool overlays 
     */
    renderOverlay?(ctx: CanvasRenderingContext2D): void;
}

/**
 * ToolManager.ts
 * Manages the active tool and tool transitions.
 */

export class ToolManager {
    private tools: Map<string, Tool> = new Map();
    private activeToolId: string | null = null;

    constructor() {}

    registerTool(tool: Tool) {
        this.tools.set(tool.id, tool);
    }

    setActiveTool(id: string) {
        if (this.tools.has(id)) {
            const current = this.getActiveTool();
            if (current?.onCancel) current.onCancel();
            this.activeToolId = id;
        }
    }

    getActiveTool(): Tool | null {
        return this.activeToolId ? this.tools.get(this.activeToolId) || null : null;
    }

    getTool(id: string): Tool | null {
        return this.tools.get(id) || null;
    }
}
