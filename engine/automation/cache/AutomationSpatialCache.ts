import { AutomationPoint } from '../../../models/AutomationPoint';

const BUCKET_SIZE_BEATS = 4; // 1 bar chunks

export class AutomationSpatialCache {
  private buckets = new Map<number, AutomationPoint[]>();

  public buildCache(points: AutomationPoint[]) {
    this.buckets.clear();

    // Assuming points are sorted by time, but we don't strictly require it here
    for (const point of points) {
      const bucketIdx = Math.floor(point.time / BUCKET_SIZE_BEATS);

      let bucket = this.buckets.get(bucketIdx);
      if (!bucket) {
        bucket = [];
        this.buckets.set(bucketIdx, bucket);
      }

      bucket.push(point);
    }
  }

  public getPointsInRange(startBeat: number, endBeat: number): AutomationPoint[] {
    const startBucket = Math.floor(startBeat / BUCKET_SIZE_BEATS);
    const endBucket = Math.floor(endBeat / BUCKET_SIZE_BEATS);

    const result: AutomationPoint[] = [];

    // We expand the bucket range by 1 on each side so we always fetch the adjacent 
    // boundary points required to draw continuous bezier curves between buckets.
    for (let b = startBucket - 1; b <= endBucket + 1; b++) {
      const bucket = this.buckets.get(b);
      if (!bucket) continue;

      for (const point of bucket) {
        result.push(point);
      }
    }

    return result.sort((a, b) => a.time - b.time);
  }
}

export const globalAutomationCache = new AutomationSpatialCache();
