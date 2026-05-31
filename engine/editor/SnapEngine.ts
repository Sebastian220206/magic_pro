/**
 * SnapEngine.ts
 * Logic for grid and object snapping.
 */

export interface SnapSettings {
    enabled: boolean;
    gridDivision: number; // 4 = quarter, 16 = sixteenth, etc.
    snapToObjects: boolean;
    magneticStrength: number; // pixels within which to snap
}

export class SnapEngine {
    constructor(private settings: SnapSettings) {}

    updateSettings(settings: Partial<SnapSettings>) {
        this.settings = { ...this.settings, ...settings };
    }

    snapBeat(beat: number, zoomX: number): number {
        if (!this.settings.enabled) return beat;

        const gridUnit = 4 / this.settings.gridDivision;
        const snapped = Math.round(beat / gridUnit) * gridUnit;
        
        // Only snap if within magnetic range
        const distancePixels = Math.abs(snapped - beat) * zoomX;
        if (distancePixels <= this.settings.magneticStrength) {
            return snapped;
        }

        return beat;
    }

    /**
     * Snap to a list of specific points (e.g. clip edges, playhead)
     */
    snapToPoints(beat: number, points: number[], zoomX: number): number {
        if (!this.settings.snapToObjects) return beat;

        let closestPoint = beat;
        let minDistance = this.settings.magneticStrength / zoomX;

        for (const p of points) {
            const dist = Math.abs(p - beat);
            if (dist < minDistance) {
                minDistance = dist;
                closestPoint = p;
            }
        }

        return closestPoint;
    }
}
