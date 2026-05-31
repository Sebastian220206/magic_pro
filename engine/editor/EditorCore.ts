/**
 * EditorCore.ts
 * Bootstraps the editor interaction system.
 */

import { CoordinateSystem, Viewport } from './CoordinateSystem';
import { ToolManager } from './ToolManager';
import { SelectionManager } from './SelectionManager';
import { SnapEngine, SnapSettings } from './SnapEngine';
import { InteractionManager } from './InteractionManager';
import { SelectTool } from './tools/SelectTool';
import { DrawTool } from './tools/DrawTool';
import { SplitTool } from './tools/SplitTool';
import { MarqueeTool } from './tools/MarqueeTool';

export class EditorCore {
    readonly coordinateSystem: CoordinateSystem;
    readonly toolManager: ToolManager;
    readonly selectionManager: SelectionManager;
    readonly snapEngine: SnapEngine;
    readonly interactionManager: InteractionManager;

    constructor(initialViewport: Viewport, initialSnap: SnapSettings) {
        this.coordinateSystem = new CoordinateSystem(initialViewport);
        this.toolManager = new ToolManager();
        this.selectionManager = new SelectionManager();
        this.snapEngine = new SnapEngine(initialSnap);
        
        this.interactionManager = new InteractionManager(
            this.coordinateSystem,
            this.toolManager,
            this.selectionManager,
            this.snapEngine
        );

        // Register default tools
        const selectTool = new SelectTool(
            this.selectionManager,
            this.snapEngine,
            this.coordinateSystem
        );
        this.toolManager.registerTool(selectTool);
        
        const drawTool = new DrawTool(this.snapEngine);
        this.toolManager.registerTool(drawTool);

        const splitTool = new SplitTool(this.snapEngine);
        this.toolManager.registerTool(splitTool);

        const marqueeTool = new MarqueeTool(this.selectionManager, this.coordinateSystem);
        this.toolManager.registerTool(marqueeTool);

        this.toolManager.setActiveTool('select');
    }

    updateViewport(viewport: Partial<Viewport>) {
        const current = (this.coordinateSystem as any).viewport;
        const next = { ...current, ...viewport };
        this.coordinateSystem.setViewport(next);
    }
}

// Global instance for the main timeline (simplified for now)
let timelineEditor: EditorCore | null = null;

export function getTimelineEditor(): EditorCore {
    if (!timelineEditor) {
        timelineEditor = new EditorCore(
            { scrollX: 0, scrollY: 0, zoomX: 100, zoomY: 80, width: 1000, height: 800 },
            { enabled: true, gridDivision: 16, snapToObjects: true, magneticStrength: 10 }
        );
    }
    return timelineEditor;
}
