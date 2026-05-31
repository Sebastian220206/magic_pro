export type InvalidationSource = 
  | 'PLAYHEAD' 
  | 'CLIP_DRAG' 
  | 'CLIP_RESIZE' 
  | 'OVERLAY' 
  | 'AUTOMATION' 
  | 'VIEWPORT_PAN' 
  | 'VIEWPORT_ZOOM'
  | 'FULL_FRAME';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  source?: InvalidationSource;
}

export class DirtyRegionManager {
  private dirtyRects: BoundingBox[] = [];
  private fullFrameRequested = false;

  public markDirty(rect: BoundingBox) {
    if (this.fullFrameRequested) return;
    if (rect.source === 'VIEWPORT_PAN' || rect.source === 'VIEWPORT_ZOOM' || rect.source === 'FULL_FRAME') {
      this.fullFrameRequested = true;
      this.dirtyRects = [];
      return;
    }
    
    // Add margin for antialiasing bleed
    this.dirtyRects.push({
      x: Math.floor(rect.x) - 1,
      y: Math.floor(rect.y) - 1,
      width: Math.ceil(rect.width) + 2,
      height: Math.ceil(rect.height) + 2,
      source: rect.source
    });
  }

  public isFullFrame(): boolean {
    return this.fullFrameRequested;
  }

  public getRegions(): BoundingBox[] {
    return this.dirtyRects;
  }

  public getMergedRegion(): BoundingBox | null {
    if (this.fullFrameRequested) return null; // Handled specially
    if (this.dirtyRects.length === 0) return null;
    
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const rect of this.dirtyRects) {
      if (rect.x < minX) minX = rect.x;
      if (rect.y < minY) minY = rect.y;
      if (rect.x + rect.width > maxX) maxX = rect.x + rect.width;
      if (rect.y + rect.height > maxY) maxY = rect.y + rect.height;
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      source: 'FULL_FRAME' // Merged representation
    };
  }

  public clear() {
    this.dirtyRects = [];
    this.fullFrameRequested = false;
  }
}

export const globalDirtyRegionManager = new DirtyRegionManager();
