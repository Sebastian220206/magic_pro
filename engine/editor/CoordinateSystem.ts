/**
 * coordinates.ts
 * Types for the editor coordinate system.
 */

export interface ScreenPoint {
    x: number;
    y: number;
}

export interface EditorPoint {
    beat: number;
    /** 
     * In Timeline: track index (0, 1, 2...)
     * In Piano Roll: pitch (0..127)
     */
    vertical: number;
}

export interface Viewport {
    scrollX: number;
    scrollY: number;
    zoomX: number; // pixels per beat
    zoomY: number; // pixels per unit (trackHeight or semitoneHeight)
    width: number;
    height: number;
}

/**
 * CoordinateSystem.ts
 * High-precision math for mapping between screen pixels and musical units.
 */

export class CoordinateSystem {
    constructor(private viewport: Viewport) {}

    setViewport(viewport: Viewport) {
        this.viewport = viewport;
    }

    screenToEditor(point: ScreenPoint): EditorPoint {
        const { scrollX, scrollY, zoomX, zoomY } = this.viewport;
        return {
            beat: (point.x + scrollX) / zoomX,
            vertical: (point.y + scrollY) / zoomY
        };
    }

    editorToScreen(point: EditorPoint): ScreenPoint {
        const { scrollX, scrollY, zoomX, zoomY } = this.viewport;
        return {
            x: (point.beat * zoomX) - scrollX,
            y: (point.vertical * zoomY) - scrollY
        };
    }

    /** 
     * Convert beat duration to pixel width 
     */
    beatToPixels(beats: number): number {
        return beats * this.viewport.zoomX;
    }

    /** 
     * Convert pixel width to beat duration 
     */
    pixelsToBeats(pixels: number): number {
        return pixels / this.viewport.zoomX;
    }

    /**
     * Get vertical unit height (track or semitone)
     */
    getVerticalZoom(): number {
        return this.viewport.zoomY;
    }
}
