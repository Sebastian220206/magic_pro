/**
 * InteractionManager.ts
 * Central orchestrator for all pointer and keyboard input in the editor.
 */

import { CoordinateSystem } from './CoordinateSystem';
import { ToolManager } from './ToolManager';
import { SelectionManager } from './SelectionManager';
import { SnapEngine } from './SnapEngine';
import { InteractionEvent } from './types/tools';

export class InteractionManager {
    private isPointerDown = false;

    constructor(
        private coordinateSystem: CoordinateSystem,
        private toolManager: ToolManager,
        private selectionManager: SelectionManager,
        private snapEngine: SnapEngine
    ) {}

    handlePointerDown(e: PointerEvent | MouseEvent, targetElement: HTMLElement) {
        this.isPointerDown = true;
        targetElement.setPointerCapture((e as any).pointerId);

        const event = this.createInteractionEvent(e, targetElement);
        const tool = this.toolManager.getActiveTool();
        if (tool) {
            tool.onPointerDown(event);
        }
    }

    handlePointerMove(e: PointerEvent | MouseEvent, targetElement: HTMLElement) {
        const event = this.createInteractionEvent(e, targetElement);
        const tool = this.toolManager.getActiveTool();
        if (tool) {
            tool.onPointerMove(event);
        }

        // Update cursor based on tool
        if (tool) {
            targetElement.style.cursor = tool.cursor;
        }
    }

    handlePointerUp(e: PointerEvent | MouseEvent, targetElement: HTMLElement) {
        this.isPointerDown = false;
        targetElement.releasePointerCapture((e as any).pointerId);

        const event = this.createInteractionEvent(e, targetElement);
        const tool = this.toolManager.getActiveTool();
        if (tool) {
            tool.onPointerUp(event);
        }
    }

    handleKeyDown(e: KeyboardEvent) {
        const tool = this.toolManager.getActiveTool();
        if (tool?.onKeyDown) {
            tool.onKeyDown(e.key, {
                shift: e.shiftKey,
                ctrl: e.ctrlKey,
                alt: e.altKey,
                meta: e.metaKey
            });
        }
    }

    private createInteractionEvent(e: PointerEvent | MouseEvent, target: HTMLElement): InteractionEvent {
        const rect = target.getBoundingClientRect();
        const screenPoint = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        const editorPoint = this.coordinateSystem.screenToEditor(screenPoint);

        return {
            screenPoint,
            editorPoint,
            originalEvent: e,
            modifiers: {
                shift: e.shiftKey,
                ctrl: e.ctrlKey,
                alt: e.altKey,
                meta: e.metaKey
            }
        };
    }
}
