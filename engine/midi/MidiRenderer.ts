import { RendererContract } from '../rendering/contracts/RendererScheduler';
import { ViewportState } from '../navigation/types';
import { BoundingBox } from '../rendering/invalidation/DirtyRegionManager';
import { globalSpatialNoteCache } from './cache/SpatialNoteCache';
import { useMidiStore } from '@/store/midiStore';

export class MidiRenderer implements RendererContract {
  public priority = 25; // Draws on top of grid (10), below overlays (40)

  constructor(private ctx: CanvasRenderingContext2D) {}

  public renderFull(ctx: CanvasRenderingContext2D, viewport: Readonly<ViewportState>) {
    const state = useMidiStore.getState();
    const clip = state.getCurrentClip();
    if (!clip || !clip.notes) return;

    const endBeat = viewport.startBeat + (ctx.canvas.width / viewport.pixelsPerBeat);
    const minPitch = viewport.maxVisiblePitch - (ctx.canvas.height / viewport.zoomY);
    
    // O(1) query
    const visibleNotes = globalSpatialNoteCache.getNotesInRegion(viewport.startBeat, endBeat, minPitch, viewport.maxVisiblePitch);

    this.drawNotes(ctx, visibleNotes, viewport, state.selectedNoteIds, clip.color || '#3B82F6');
  }

  public renderRegion(ctx: CanvasRenderingContext2D, viewport: Readonly<ViewportState>, region: BoundingBox) {
    const state = useMidiStore.getState();
    const clip = state.getCurrentClip();
    if (!clip || !clip.notes) return;

    const startBeat = viewport.startBeat + (region.x / viewport.pixelsPerBeat);
    const endBeat = viewport.startBeat + ((region.x + region.width) / viewport.pixelsPerBeat);
    
    const maxPitch = viewport.maxVisiblePitch - (region.y / viewport.zoomY);
    const minPitch = viewport.maxVisiblePitch - ((region.y + region.height) / viewport.zoomY);

    const regionNotes = globalSpatialNoteCache.getNotesInRegion(startBeat, endBeat, minPitch, maxPitch);

    this.drawNotes(ctx, regionNotes, viewport, state.selectedNoteIds, clip.color || '#3B82F6');
  }

  private drawNotes(ctx: CanvasRenderingContext2D, notes: any[], viewport: Readonly<ViewportState>, selectedIds: Set<string>, baseColor: string) {
    const { pixelsPerBeat, startBeat, maxVisiblePitch, zoomY } = viewport;

    ctx.save();
    
    for (const note of notes) {
      const x = (note.startBeat - startBeat) * pixelsPerBeat;
      const y = (maxVisiblePitch - note.pitch) * zoomY;
      const w = note.duration * pixelsPerBeat;
      const h = zoomY - 1;

      const isSelected = selectedIds.has(note.id);
      
      // Shadow / Glow for selected
      if (isSelected) {
        ctx.shadowColor = 'white';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5;
      } else {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
      }

      ctx.fillStyle = isSelected ? '#60A5FA' : baseColor;
      
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 2);
      ctx.fill();
      ctx.stroke();

      // Velocity shading
      ctx.fillStyle = `rgba(0,0,0,${1 - (note.velocity / 127)})`;
      ctx.fill();
    }

    ctx.restore();
  }
}
