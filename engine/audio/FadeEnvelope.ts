export type FadeCurveType = 'linear' | 'equalPower' | 'exponential' | 'logarithmic' | 'sCurve';

export function calculateFadeInGain(t: number, curve: FadeCurveType): number {
  switch (curve) {
    case 'linear':
      return t;
    case 'equalPower':
      return Math.sin((t * Math.PI) / 2);
    case 'exponential':
      return t * t;
    case 'logarithmic':
      return Math.sqrt(t);
    case 'sCurve':
      return t * t * (3 - 2 * t);
  }
}

export function calculateFadeOutGain(t: number, curve: FadeCurveType): number {
  return calculateFadeInGain(1 - t, curve);
}

export function generateFadeInCurve(samples: number, curve: FadeCurveType): Float32Array {
  const arr = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    arr[i] = calculateFadeInGain(i / (samples - 1 || 1), curve);
  }
  return arr;
}

export function generateFadeOutCurve(samples: number, curve: FadeCurveType): Float32Array {
  const arr = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    arr[i] = calculateFadeOutGain(i / (samples - 1 || 1), curve);
  }
  return arr;
}

export function generateCrossfadeCurves(
  samples: number,
  curve: FadeCurveType
): { fadeOut: Float32Array; fadeIn: Float32Array } {
  const fadeOut = new Float32Array(samples);
  const fadeIn = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1 || 1);
    fadeOut[i] = calculateFadeOutGain(t, curve);
    fadeIn[i] = calculateFadeInGain(t, curve);
  }
  return { fadeOut, fadeIn };
}

export function gainAtTimeInClip(
  clipStartTime: number,
  clipDuration: number,
  currentTime: number,
  fadeInDuration: number,
  fadeOutDuration: number,
  fadeInCurve: FadeCurveType,
  fadeOutCurve: FadeCurveType
): number {
  const localTime = currentTime - clipStartTime;
  if (localTime < 0 || localTime > clipDuration) return 0;

  let gain = 1;

  if (fadeInDuration > 0 && localTime < fadeInDuration) {
    const t = localTime / fadeInDuration;
    gain *= calculateFadeInGain(t, fadeInCurve);
  }

  if (fadeOutDuration > 0 && localTime > clipDuration - fadeOutDuration) {
    const t = (localTime - (clipDuration - fadeOutDuration)) / fadeOutDuration;
    gain *= calculateFadeOutGain(t, fadeOutCurve);
  }

  return gain;
}
