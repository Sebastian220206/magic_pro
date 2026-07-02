export const MIN_ZOOM = 5;
export const MAX_ZOOM = 400;
export const DEFAULT_ZOOM = 80;
export const ZOOM_FACTOR = 1.25;
export const DRAG_THRESHOLD = 5;

export interface ZoomParams {
  zoom: number;
  scrollX: number;
}

export class ZoomController {
  zoomIn(
    anchorBeat: number,
    currentZoom: number,
    scrollX: number,
    viewportWidth: number,
    factor = ZOOM_FACTOR
  ): ZoomParams {
    const newZoom = Math.min(currentZoom * factor, MAX_ZOOM);
    if (newZoom === currentZoom) return { zoom: currentZoom, scrollX };
    return this.calculateAnchorZoom(anchorBeat, currentZoom, newZoom, scrollX, viewportWidth);
  }

  zoomOut(
    anchorBeat: number,
    currentZoom: number,
    scrollX: number,
    viewportWidth: number,
    factor = ZOOM_FACTOR
  ): ZoomParams {
    const newZoom = Math.max(currentZoom / factor, MIN_ZOOM);
    if (newZoom === currentZoom) return { zoom: currentZoom, scrollX };
    return this.calculateAnchorZoom(anchorBeat, currentZoom, newZoom, scrollX, viewportWidth);
  }

  zoomToArea(startBeat: number, endBeat: number, viewportWidth: number): ZoomParams {
    const beatRange = endBeat - startBeat;
    if (beatRange <= 0.001) return { zoom: DEFAULT_ZOOM, scrollX: 0 };

    const margin = 0.08;
    const availableWidth = viewportWidth * (1 - margin * 2);
    let newZoom = Math.round(availableWidth / beatRange);
    newZoom = Math.min(Math.max(newZoom, MIN_ZOOM), MAX_ZOOM);
    const newScrollX = Math.max(0, Math.round(startBeat * newZoom - viewportWidth * margin));

    return { zoom: newZoom, scrollX: newScrollX };
  }

  zoomToFit(
    clipStartBeats: number[],
    clipEndBeats: number[],
    viewportWidth: number,
    currentZoom = DEFAULT_ZOOM
  ): ZoomParams {
    if (clipStartBeats.length === 0) {
      return { zoom: DEFAULT_ZOOM, scrollX: 0 };
    }

    const minStart = Math.min(...clipStartBeats);
    const maxEnd = Math.max(...clipEndBeats);
    const projectDuration = maxEnd - minStart;

    if (projectDuration <= 0.001) {
      return { zoom: currentZoom, scrollX: Math.max(0, Math.round(minStart * currentZoom - viewportWidth * 0.1)) };
    }

    const margin = 0.05;
    const availableWidth = viewportWidth * (1 - margin * 2);
    let newZoom = Math.round(availableWidth / projectDuration);
    newZoom = Math.min(Math.max(newZoom, MIN_ZOOM), MAX_ZOOM);
    const newScrollX = Math.max(0, Math.round(minStart * newZoom - viewportWidth * margin));

    return { zoom: newZoom, scrollX: newScrollX };
  }

  setZoomLevel(
    level: number,
    anchorBeat: number,
    currentZoom: number,
    scrollX: number,
    viewportWidth: number
  ): ZoomParams {
    const newZoom = Math.min(Math.max(Math.round(level), MIN_ZOOM), MAX_ZOOM);
    if (newZoom === currentZoom) return { zoom: currentZoom, scrollX };
    return this.calculateAnchorZoom(anchorBeat, currentZoom, newZoom, scrollX, viewportWidth);
  }

  private calculateAnchorZoom(
    anchorBeat: number,
    oldZoom: number,
    newZoom: number,
    scrollX: number,
    _viewportWidth: number
  ): ZoomParams {
    const anchorScreenX = anchorBeat * oldZoom - scrollX;
    const newScrollX = Math.round(Math.max(0, anchorBeat * newZoom - anchorScreenX));

    return { zoom: Math.round(newZoom), scrollX: newScrollX };
  }
}
