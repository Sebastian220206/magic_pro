import { NavigationVector } from './types';

export class GestureInterpreter {
  public static processQueue(events: Event[]): NavigationVector[] {
    const vectors: NavigationVector[] = [];
    
    for (const event of events) {
      if (event instanceof WheelEvent) {
        vectors.push(this.normalizeWheelEvent(event));
      }
      // Future: pointer events (touch/pen) parsing could be added here
    }
    
    return vectors;
  }

  private static normalizeWheelEvent(e: WheelEvent): NavigationVector {
    const isPinch = e.ctrlKey; // Standard browser indicator for trackpad pinch
    
    let dx = e.deltaX;
    let dy = e.deltaY;
    
    // Fallback for line-mode mice to convert into pseudo-pixels
    if (e.deltaMode === 1) { 
      dx *= 16; 
      dy *= 16; 
    } 

    if (isPinch && e.shiftKey) {
      // Ctrl+Shift+Scroll -> Vertical (pitch) zoom
      return { type: 'zoom-vertical', dx: 0, dy: dy, anchorX: e.clientX, anchorY: e.clientY };
    }

    if (isPinch) {
      // Zoom: dy contains the pinch delta
      return { type: 'zoom', dx: 0, dy: dy, anchorX: e.clientX, anchorY: e.clientY };
    }

    if (e.shiftKey && dx === 0) { 
      // Shift+Scroll -> Horizontal Pan (common fallback for mice without horiz-wheel)
      dx = dy; 
      dy = 0; 
    } 

    return { type: 'pan', dx, dy, anchorX: e.clientX, anchorY: e.clientY };
  }
}
