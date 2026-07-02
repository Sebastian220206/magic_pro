import { getTimelineEditor } from '@/engine/editor/EditorCore';
import { useProjectStore } from '@/store/projectStore';
import { CoordinateSystem } from '@/engine/editor/CoordinateSystem';
import { ZoomParams } from './ZoomController';

let scrollContainer: HTMLElement | null = null;

export function registerTimelineScrollContainer(el: HTMLElement | null) {
  scrollContainer = el;
}

export function getViewportScrollX(): number {
  const editor = getTimelineEditor();
  const viewport = (editor.coordinateSystem as any).viewport;
  return viewport?.scrollX ?? 0;
}

export function getViewportWidth(): number {
  const editor = getTimelineEditor();
  const viewport = (editor.coordinateSystem as any).viewport;
  return viewport?.width ?? 1000;
}

export class ViewportManager {
  private animationId: number | null = null;
  private isAnimating = false;

  applyZoom(params: ZoomParams): void {
    const { zoom, scrollX } = params;
    const editor = getTimelineEditor();
    const roundedZoom = Math.round(zoom);

    useProjectStore.getState().setZoom(roundedZoom);
    editor.updateViewport({ zoomX: roundedZoom, scrollX });

    if (scrollContainer) {
      scrollContainer.scrollLeft = scrollX;
    }
  }

  animateTo(targetZoom: number, targetScrollX: number, duration = 200): void {
    this.cancelAnimation();

    const startZoom = useProjectStore.getState().zoom;
    const startScrollX = getViewportScrollX();
    const startTime = performance.now();
    this.isAnimating = true;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / Math.max(duration, 1), 1);
      const ease = 1 - Math.pow(1 - t, 3);

      const currentZoom = startZoom + (targetZoom - startZoom) * ease;
      const currentScrollX = startScrollX + (targetScrollX - startScrollX) * ease;

      this.applyZoom({ zoom: currentZoom, scrollX: currentScrollX });

      if (t < 1) {
        this.animationId = requestAnimationFrame(animate);
      } else {
        this.applyZoom({ zoom: targetZoom, scrollX: targetScrollX });
        this.isAnimating = false;
        this.animationId = null;
      }
    };

    this.animationId = requestAnimationFrame(animate);
  }

  cancelAnimation(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.isAnimating = false;
  }
}
