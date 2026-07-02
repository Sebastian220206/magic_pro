export interface TransientPoint {
  sampleIndex: number;
  beat: number;
  strength: number;
}

export interface QuantizeOptions {
  gridResolution: number;
  strength: number;
  swing: number;
  sensitivity: number;
}

export class TransientDetector {
  static detectTransients(
    channelData: Float32Array,
    sampleRate: number,
    sensitivity: number = 0.5
  ): number[] {
    const transients: number[] = [];
    const threshold = 0.1 + (1 - sensitivity) * 0.3;

    // Compute spectral flux
    const frameSize = 1024;
    const hopSize = 512;
    let prevSpectrum = new Float32Array(frameSize / 2 + 1);

    for (let start = 0; start + frameSize < channelData.length; start += hopSize) {
      const frame = new Float32Array(frameSize);
      for (let i = 0; i < frameSize; i++) {
        frame[i] = channelData[start + i] * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (frameSize - 1)));
      }

      // Compute magnitude spectrum
      const spectrum = new Float32Array(frameSize / 2 + 1);
      for (let k = 0; k <= frameSize / 2; k++) {
        let real = 0, imag = 0;
        for (let n = 0; n < frameSize; n++) {
          const angle = (-2 * Math.PI * k * n) / frameSize;
          real += frame[n] * Math.cos(angle);
          imag += frame[n] * Math.sin(angle);
        }
        spectrum[k] = Math.sqrt(real * real + imag * imag);
      }

      // Spectral flux: sum of positive differences
      let flux = 0;
      for (let k = 0; k < spectrum.length; k++) {
        const diff = spectrum[k] - prevSpectrum[k];
        if (diff > 0) flux += diff;
      }
      prevSpectrum = spectrum;

      // Median normalization
      if (flux > threshold) {
        transients.push(start + hopSize / 2);
      }
    }

    return transients;
  }

  static detectBeats(
    channelData: Float32Array,
    sampleRate: number,
    bpm: number
  ): number[] {
    const transients = this.detectTransients(channelData, sampleRate);
    if (transients.length === 0) return [];

    const beatInterval = (60 / bpm) * sampleRate;

    // Find the best grid alignment
    const sorted = [...transients].sort((a, b) => a - b);
    const beats: number[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i] - beats[beats.length - 1];
      if (gap >= beatInterval * 0.5) {
        beats.push(sorted[i]);
      }
    }

    return beats;
  }
}

export class AudioQuantizer {
  static quantizeClip(
    channelData: Float32Array,
    sampleRate: number,
    bpm: number,
    startBeat: number,
    options: QuantizeOptions
  ): Float32Array {
    const transients = TransientDetector.detectTransients(
      channelData, sampleRate, options.sensitivity
    );

    if (transients.length === 0) return channelData;

    const samplesPerBeat = (60 / bpm) * sampleRate;
    const output = new Float32Array(channelData.length);

    // Build transient -> target grid mapping
    const gridPositions: Array<{ source: number; target: number }> = [];
    for (const t of transients) {
      const transientBeat = startBeat + t / samplesPerBeat;
      const gridBeat = Math.round(transientBeat / options.gridResolution) * options.gridResolution;
      const appliedBeat = transientBeat + (gridBeat - transientBeat) * options.strength;
      const targetSample = (appliedBeat - startBeat) * samplesPerBeat;

      gridPositions.push({ source: t, target: Math.round(targetSample) });
    }

    // Interpolate audio to new positions
    let srcIdx = 0;
    let gridIdx = 0;

    while (srcIdx < channelData.length && gridIdx < gridPositions.length - 1) {
      const seg = gridPositions[gridIdx];
      const nextSeg = gridPositions[gridIdx + 1];
      const srcLen = nextSeg.source - seg.source;
      const tgtLen = nextSeg.target - seg.target;

      for (let i = 0; i < srcLen && seg.target + i < output.length; i++) {
        const mapPos = srcLen > 0 ? (i / srcLen) * tgtLen : i;
        const tgtPos = seg.target + Math.round(mapPos);
        if (tgtPos >= 0 && tgtPos < output.length && seg.source + i < channelData.length) {
          output[tgtPos] = channelData[seg.source + i];
        }
      }

      srcIdx += srcLen;
      gridIdx++;
    }

    // Copy remaining samples
    for (let i = srcIdx; i < channelData.length && i < output.length; i++) {
      output[i] = channelData[i];
    }

    return output;
  }
}
