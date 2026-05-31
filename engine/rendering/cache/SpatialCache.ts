import { Clip } from '../../../models/Clip';

export interface SpatialBucket {
  startBeat: number;
  endBeat: number;
  clips: Clip[];
}

export class SpatialCache {
  private buckets: Map<number, SpatialBucket> = new Map();
  private readonly BUCKET_SIZE_BEATS = 16; // 4 bars typically

  public buildCache(clips: Clip[]) {
    this.buckets.clear();
    
    for (const clip of clips) {
      const startBucket = Math.floor(clip.startBeat / this.BUCKET_SIZE_BEATS);
      const endBucket = Math.floor((clip.startBeat + clip.duration) / this.BUCKET_SIZE_BEATS);

      for (let i = startBucket; i <= endBucket; i++) {
        let bucket = this.buckets.get(i);
        if (!bucket) {
          bucket = { startBeat: i * this.BUCKET_SIZE_BEATS, endBeat: (i + 1) * this.BUCKET_SIZE_BEATS, clips: [] };
          this.buckets.set(i, bucket);
        }
        bucket.clips.push(clip);
      }
    }
  }

  public getClipsInRange(startBeat: number, endBeat: number): Clip[] {
    const startBucket = Math.floor(startBeat / this.BUCKET_SIZE_BEATS);
    const endBucket = Math.floor(endBeat / this.BUCKET_SIZE_BEATS);
    
    const resultSet = new Set<Clip>();
    
    for (let i = startBucket; i <= endBucket; i++) {
      const bucket = this.buckets.get(i);
      if (bucket) {
        for (const clip of bucket.clips) {
          // Double check exact intersection
          if (clip.startBeat < endBeat && clip.startBeat + clip.duration > startBeat) {
            resultSet.add(clip);
          }
        }
      }
    }
    
    return Array.from(resultSet);
  }
}

export const globalSpatialCache = new SpatialCache();
