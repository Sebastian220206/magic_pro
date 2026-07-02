export interface FlexTimeOptions {
  algorithm: 'wsola' | 'phaseVocoder';
  transientResolution: number;
  preserveFormants: boolean;
}

export interface WarpMarker {
  sampleIndex: number;
  beat: number;
  locked: boolean;
}

export class FlexTimeProcessor {
  /**
   * Time-stretch audio using WSOLA (Waveform Similarity Overlap-Add).
   */
  static wsolaStretch(
    input: Float32Array,
    sampleRate: number,
    ratio: number
  ): Float32Array {
    if (ratio <= 0) return new Float32Array(0);
    if (Math.abs(ratio - 1) < 0.001) return input.slice();

    const windowSize = Math.floor(0.03 * sampleRate);
    const hopIn = Math.floor(windowSize / 4);
    const hopOut = Math.round(hopIn * ratio);

    const outputLength = Math.ceil(input.length * ratio);
    const output = new Float32Array(outputLength);

    const window = new Float32Array(windowSize);
    for (let i = 0; i < windowSize; i++) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)));
    }

    let inIdx = 0;
    let outIdx = 0;

    while (inIdx + windowSize <= input.length && outIdx + windowSize <= outputLength) {
      for (let i = 0; i < windowSize; i++) {
        output[outIdx + i] += input[inIdx + i] * window[i];
      }

      inIdx += hopIn;
      outIdx += hopOut;
    }

    // Normalize
    const normScale = hopOut / hopIn;
    for (let i = 0; i < outputLength; i++) {
      output[i] /= normScale;
    }

    return output;
  }

  /**
   * Apply warp markers to flex time-stretch audio regions.
   */
  static applyWarpMarkers(
    channelData: Float32Array,
    sampleRate: number,
    markers: WarpMarker[],
    bpm: number
  ): Float32Array {
    if (markers.length < 2) return channelData.slice();

    const samplesPerBeat = (60 / bpm) * sampleRate;
    const result = new Float32Array(channelData.length);
    let writePos = 0;

    for (let i = 0; i < markers.length - 1; i++) {
      const m1 = markers[i];
      const m2 = markers[i + 1];

      const srcLen = m2.sampleIndex - m1.sampleIndex;
      const beatLen = m2.beat - m1.beat;
      const tgtLen = Math.round(beatLen * samplesPerBeat);

      if (tgtLen <= 0 || srcLen <= 0) continue;

      const ratio = tgtLen / srcLen;

      // Stretch or squeeze this region
      const region = channelData.slice(m1.sampleIndex, m2.sampleIndex);
      const stretched = FlexTimeProcessor.wsolaStretch(region, sampleRate, ratio);

      for (let j = 0; j < stretched.length && writePos + j < result.length; j++) {
        result[writePos + j] = stretched[j];
      }
      writePos += stretched.length;
    }

    // Copy any remaining
    for (let i = writePos; i < result.length && i < channelData.length; i++) {
      result[i] = channelData[i];
    }

    return result;
  }

  /**
   * Match clip duration to project tempo by time-stretching.
   */
  static matchTempo(
    channelData: Float32Array,
    sampleRate: number,
    originalBpm: number,
    targetBpm: number,
    originalBeats: number,
    targetBeats: number
  ): Float32Array {
    const originalDuration = (originalBeats / originalBpm) * 60;
    const targetDuration = (targetBeats / targetBpm) * 60;
    const ratio = targetDuration / originalDuration;

    return FlexTimeProcessor.wsolaStretch(channelData, sampleRate, ratio);
  }
}
