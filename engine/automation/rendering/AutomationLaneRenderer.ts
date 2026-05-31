import { RendererContract } from '../../rendering/contracts/RendererScheduler';
import { ViewportState } from '../../navigation/types';
import { BoundingBox } from '../../rendering/invalidation/DirtyRegionManager';
import { BezierCurveRenderer } from './BezierCurveRenderer';
import { globalAutomationCache } from '../cache/AutomationSpatialCache';
import { useProjectStore } from '@/store/projectStore';

export class AutomationLaneRenderer implements RendererContract {
  public priority = 30; // Above clips (20), below overlays (40)

  constructor(private ctx: CanvasRenderingContext2D) {}

  public renderFull(ctx: CanvasRenderingContext2D, viewport: Readonly<ViewportState>) {
    const store = useProjectStore.getState();
    if (!store.showAutomation) return;

    const endBeat = viewport.startBeat + (ctx.canvas.width / viewport.pixelsPerBeat);

    for (const track of store.tracks) {
      if (!track.automationLanes || track.automationLanes.length === 0) continue;

      const trackIndex = store.tracks.findIndex(t => t.id === track.id);
      const laneHeight = 60; // Configurable
      const trackBaseY = trackIndex * store.trackHeight;

      for (let i = 0; i < track.automationLanes.length; i++) {
        const lane = track.automationLanes[i];
        const laneY = trackBaseY + store.trackHeight + (i * laneHeight);

        globalAutomationCache.buildCache(lane.points);
        const visiblePoints = globalAutomationCache.getPointsInRange(viewport.startBeat, endBeat);

        this.drawLane(ctx, visiblePoints, viewport, laneY, laneHeight, lane.color || '#F59E0B');
      }
    }
  }

  public renderRegion(ctx: CanvasRenderingContext2D, viewport: Readonly<ViewportState>, region: BoundingBox) {
    const store = useProjectStore.getState();
    if (!store.showAutomation) return;

    const startBeat = viewport.startBeat + (region.x / viewport.pixelsPerBeat);
    const endBeat = viewport.startBeat + ((region.x + region.width) / viewport.pixelsPerBeat);

    for (const track of store.tracks) {
      if (!track.automationLanes) continue;

      const trackIndex = store.tracks.findIndex(t => t.id === track.id);
      const laneHeight = 60; 
      const trackBaseY = trackIndex * store.trackHeight;

      for (let i = 0; i < track.automationLanes.length; i++) {
        const lane = track.automationLanes[i];
        const laneY = trackBaseY + store.trackHeight + (i * laneHeight);

        // Vertical cull check: does the dirty region intersect this specific automation lane?
        if (region.y > laneY + laneHeight || region.y + region.height < laneY) {
          continue; 
        }

        const regionPoints = globalAutomationCache.getPointsInRange(startBeat, endBeat);
        this.drawLane(ctx, regionPoints, viewport, laneY, laneHeight, lane.color || '#F59E0B');
      }
    }
  }

  private drawLane(
    ctx: CanvasRenderingContext2D, 
    points: any[], 
    viewport: Readonly<ViewportState>, 
    laneY: number, 
    laneHeight: number,
    color: string
  ) {
    if (points.length === 0) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;

    // Draw curves
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      const x1 = (p1.time - viewport.startBeat) * viewport.pixelsPerBeat;
      const x2 = (p2.time - viewport.startBeat) * viewport.pixelsPerBeat;
      const y1 = laneY + laneHeight - (p1.value / 100 * laneHeight);
      const y2 = laneY + laneHeight - (p2.value / 100 * laneHeight);

      BezierCurveRenderer.drawCurve(ctx, p1, p2, x1, y1, x2, y2);
    }

    // Draw Nodes
    ctx.fillStyle = color;
    for (const p of points) {
      const x = (p.time - viewport.startBeat) * viewport.pixelsPerBeat;
      const y = laneY + laneHeight - (p.value / 100 * laneHeight);

      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
