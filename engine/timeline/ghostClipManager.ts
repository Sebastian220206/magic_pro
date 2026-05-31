/**
 * Ghost Clips System - Linked duplicates that update together
 * 
 * Features:
 * - Create linked duplicate clips
 * - Edit one ghost, update all instances
 * - Visual indicator for ghost clips
 * - Source clip tracking
 * - Synchronized editing
 */

import { Clip } from './types';
import { generateClipId, cloneClip } from './clipEditor';

// =============================================================================
// Types
// =============================================================================

export interface GhostClip {
  id: string;
  sourceClipId: string;
  instanceId: string;
  startTime: number;
  trackId: string;
  isGhost: true;
}

export interface SourceClip {
  id: string;
  originalClip: Clip;
  ghostIds: Set<string>;
  properties: (keyof Clip)[];
}

export type SyncableProperty = 
  | 'fadeIn'
  | 'fadeOut'
  | 'playbackRate'
  | 'pitchOffset'
  | 'color'
  | 'name'
  | 'muted';

// Properties that sync across ghosts
export const SYNCABLE_PROPERTIES: (keyof Clip)[] = [
  'fadeIn',
  'fadeOut',
  'playbackRate',
  'pitchOffset',
  'color',
  'name',
  'muted',
];

// =============================================================================
// Ghost Clip Manager
// =============================================================================

export class GhostClipManager {
  private sourceClips: Map<string, SourceClip> = new Map();
  private ghostToSource: Map<string, string> = new Map();
  private clips: Map<string, Clip> = new Map();

  /**
   * Register a clip as a source for ghost clips
   */
  registerSourceClip(clip: Clip): SourceClip {
    const source: SourceClip = {
      id: clip.id,
      originalClip: { ...clip },
      ghostIds: new Set(),
      properties: [...SYNCABLE_PROPERTIES],
    };
    
    this.sourceClips.set(clip.id, source);
    this.clips.set(clip.id, clip);
    
    return source;
  }

  /**
   * Create a ghost clip (linked duplicate)
   */
  createGhostClip(
    sourceClipId: string,
    startTime: number,
    trackId: string,
    clips: Clip[]
  ): GhostClip | null {
    const source = this.sourceClips.get(sourceClipId);
    const sourceClip = clips.find(c => c.id === sourceClipId);
    
    if (!source || !sourceClip) return null;

    const ghostId = `ghost-${generateClipId()}`;
    const ghost: GhostClip = {
      id: ghostId,
      sourceClipId,
      instanceId: ghostId,
      startTime,
      trackId,
      isGhost: true,
    };

    // Track the relationship
    source.ghostIds.add(ghostId);
    this.ghostToSource.set(ghostId, sourceClipId);

    return ghost;
  }

  /**
   * Create a ghost clip with full Clip data
   */
  createGhostClipInstance(
    sourceClipId: string,
    startTime: number,
    trackId: string,
    clips: Clip[]
  ): Clip | null {
    const sourceClip = clips.find(c => c.id === sourceClipId);
    if (!sourceClip) return null;

    // Ensure source is registered
    if (!this.sourceClips.has(sourceClipId)) {
      this.registerSourceClip(sourceClip);
    }

    const ghostClip: Clip = {
      ...sourceClip,
      id: `ghost-${generateClipId()}`,
      startTime,
      trackId,
      // Add metadata to identify as ghost
      isGhost: true,
      sourceClipId,
    } as Clip;

    const source = this.sourceClips.get(sourceClipId)!;
    source.ghostIds.add(ghostClip.id);
    this.ghostToSource.set(ghostClip.id, sourceClipId);
    this.clips.set(ghostClip.id, ghostClip);

    return ghostClip;
  }

  /**
   * Check if a clip is a ghost
   */
  isGhostClip(clipId: string): boolean {
    return this.ghostToSource.has(clipId);
  }

  /**
   * Get source clip ID for a ghost
   */
  getSourceClipId(ghostClipId: string): string | null {
    return this.ghostToSource.get(ghostClipId) || null;
  }

  /**
   * Get all ghost IDs for a source clip
   */
  getGhostIds(sourceClipId: string): string[] {
    const source = this.sourceClips.get(sourceClipId);
    return source ? Array.from(source.ghostIds) : [];
  }

  /**
   * Update a clip and sync to all ghosts
   */
  updateClipWithSync(
    clipId: string,
    updates: Partial<Clip>,
    updateFn: (clipId: string, updates: Partial<Clip>) => void
  ): { updatedIds: string[]; property: keyof Clip; value: any }[] {
    const results: { updatedIds: string[]; property: keyof Clip; value: any }[] = [];

    // Check if this is a source clip
    const source = this.sourceClips.get(clipId);
    
    if (source) {
      // This is a source clip - sync to all ghosts
      const ghostIds = Array.from(source.ghostIds);
      
      for (const [property, value] of Object.entries(updates)) {
        if (SYNCABLE_PROPERTIES.includes(property as SyncableProperty)) {
          // Update all ghosts
          for (const ghostId of ghostIds) {
            updateFn(ghostId, { [property]: value });
          }
          
          results.push({
            updatedIds: ghostIds,
            property: property as keyof Clip,
            value,
          });
        }
      }
      
      // Update source clip reference
      Object.assign(source.originalClip, updates);
    } else if (this.ghostToSource.has(clipId)) {
      // This is a ghost clip - sync back to source and other ghosts
      const sourceId = this.ghostToSource.get(clipId)!;
      const sourceData = this.sourceClips.get(sourceId);
      
      if (sourceData) {
        const allGhostIds = Array.from(sourceData.ghostIds);
        
        for (const [property, value] of Object.entries(updates)) {
          if (SYNCABLE_PROPERTIES.includes(property as SyncableProperty)) {
            // Update source
            updateFn(sourceId, { [property]: value });
            
            // Update all other ghosts (excluding the one that triggered)
            for (const ghostId of allGhostIds) {
              if (ghostId !== clipId) {
                updateFn(ghostId, { [property]: value });
              }
            }
            
            results.push({
              updatedIds: [sourceId, ...allGhostIds.filter(id => id !== clipId)],
              property: property as keyof Clip,
              value,
            });
          }
        }
        
        // Update source clip reference
        Object.assign(sourceData.originalClip, updates);
      }
    }

    return results;
  }

  /**
   * Convert ghost to independent clip
   */
  unghostClip(ghostClip: Clip): Clip {
    const sourceId = this.ghostToSource.get(ghostClip.id);
    
    if (sourceId) {
      const source = this.sourceClips.get(sourceId);
      if (source) {
        source.ghostIds.delete(ghostClip.id);
      }
      this.ghostToSource.delete(ghostClip.id);
    }

    // Return clip without ghost properties
    const { isGhost, sourceClipId, ...independentClip } = ghostClip as any;
    return {
      ...independentClip,
      id: generateClipId(), // New ID for independence
    };
  }

  /**
   * Delete a ghost clip
   */
  deleteGhostClip(ghostClipId: string): void {
    const sourceId = this.ghostToSource.get(ghostClipId);
    
    if (sourceId) {
      const source = this.sourceClips.get(sourceId);
      if (source) {
        source.ghostIds.delete(ghostClipId);
      }
    }
    
    this.ghostToSource.delete(ghostClipId);
    this.clips.delete(ghostClipId);
  }

  /**
   * Delete a source clip and all its ghosts
   */
  deleteSourceClip(sourceClipId: string): string[] {
    const source = this.sourceClips.get(sourceClipId);
    const ghostIds: string[] = [];
    
    if (source) {
      // Collect all ghost IDs
      for (const ghostId of Array.from(source.ghostIds)) {
        ghostIds.push(ghostId);
        this.ghostToSource.delete(ghostId);
        this.clips.delete(ghostId);
      }
      
      this.sourceClips.delete(sourceClipId);
      this.clips.delete(sourceClipId);
    }
    
    return ghostIds;
  }

  /**
   * Get all source clips
   */
  getAllSourceClips(): SourceClip[] {
    return Array.from(this.sourceClips.values());
  }

  /**
   * Get all ghost clips
   */
  getAllGhostClips(): Clip[] {
    return Array.from(this.ghostToSource.keys())
      .map(id => this.clips.get(id))
      .filter((clip): clip is Clip => !!clip);
  }

  /**
   * Get ghost count for a source
   */
  getGhostCount(sourceClipId: string): number {
    const source = this.sourceClips.get(sourceClipId);
    return source ? source.ghostIds.size : 0;
  }

  /**
   * Clear all ghost data
   */
  clear(): void {
    this.sourceClips.clear();
    this.ghostToSource.clear();
    this.clips.clear();
  }
}

// =============================================================================
// Visual Helpers
// =============================================================================

/**
 * Get ghost clip visual styling
 */
export function getGhostClipStyle(isGhost: boolean): {
  borderStyle: string;
  borderWidth: number;
  borderColor: string;
  opacity: number;
} {
  if (!isGhost) {
    return {
      borderStyle: 'solid',
      borderWidth: 0,
      borderColor: 'transparent',
      opacity: 1,
    };
  }

  return {
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    opacity: 0.9,
  };
}

/**
 * Render ghost indicator
 */
export function renderGhostIndicator(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  ghostCount: number
): void {
  if (ghostCount <= 0) return;

  ctx.save();
  
  // Draw ghost icon
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.arc(x + 12, y + 12, 8, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw ghost count
  ctx.fillStyle = '#000';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ghostCount.toString(), x + 12, y + 12);
  
  // Draw link indicator
  if (ghostCount > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + width - 20, y + 8);
    ctx.lineTo(x + width - 12, y + 8);
    ctx.lineTo(x + width - 12, y + 16);
    ctx.stroke();
  }
  
  ctx.restore();
}

// =============================================================================
// Export
// =============================================================================

export function createGhostClipManager(): GhostClipManager {
  return new GhostClipManager();
}

export default GhostClipManager;
