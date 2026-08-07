export interface ViewportState {
  startBeat: number;
  pixelsPerBeat: number;
  maxVisiblePitch: number;
  pixelsPerPitch: number;
  zoomY: number;
}

export interface NavigationVector {
  type: 'pan' | 'zoom' | 'zoom-vertical';
  dx: number;
  dy: number;
  anchorX: number;
  anchorY: number;
}
