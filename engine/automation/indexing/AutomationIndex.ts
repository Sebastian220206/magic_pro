import { AutomationPoint } from '../types';

export class AutomationIndex {
  constructor(private points: AutomationPoint[]) {}

  /**
   * O(log n) lookup for the bounding points around a specific transport beat.
   * Returns [floorPoint, ceilPoint].
   * If time is before the first point, returns [null, firstPoint].
   * If time is after the last point, returns [lastPoint, null].
   * If points array is empty, returns [null, null].
   */
  public findSegmentAtTime(beat: number): [AutomationPoint | null, AutomationPoint | null] {
    if (!this.points || this.points.length === 0) return [null, null];
    
    let low = 0;
    let high = this.points.length - 1;

    // Check bounds early for optimization
    if (beat < this.points[0].beat) {
      return [null, this.points[0]];
    }
    if (beat >= this.points[high].beat) {
      return [this.points[high], null];
    }

    // Binary search for the floor point
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      
      if (this.points[mid].beat <= beat) {
        if (mid === this.points.length - 1 || this.points[mid + 1].beat > beat) {
          return [this.points[mid], this.points[mid + 1] || null];
        }
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return [null, null];
  }
}
