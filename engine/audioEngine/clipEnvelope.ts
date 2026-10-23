/**
 * clipEnvelope.ts
 * Clip gain + fade-in/out envelope, shared by live playback and offline export
 * so the two can't drift apart.
 */

export type FadeCurve = 'linear' | 'exponential' | 'scurve' | 'logarithmic' | string | undefined;

export interface ClipEnvelopeSpec {
    /** Linear clip gain (1 = unity). */
    level: number;
    /** Region length in seconds. */
    clipSeconds: number;
    fadeInSeconds: number;
    fadeOutSeconds: number;
    fadeInCurve?: FadeCurve;
    fadeOutCurve?: FadeCurve;
}

export function fadeShape(x: number, curve?: FadeCurve): number {
    const t = Math.max(0, Math.min(1, x));
    switch (curve) {
        case 'exponential': return t * t;
        case 'logarithmic': return Math.sqrt(t);
        case 'scurve': return 0.5 - 0.5 * Math.cos(Math.PI * t);
        default: return t;
    }
}

/** Normalise fade lengths so they fit inside the clip without overlapping. */
export function normaliseEnvelope(spec: ClipEnvelopeSpec): ClipEnvelopeSpec {
    const clipSeconds = Math.max(0, spec.clipSeconds);
    const fi = Math.max(0, Math.min(clipSeconds, spec.fadeInSeconds || 0));
    const fo = Math.max(0, Math.min(clipSeconds - fi, spec.fadeOutSeconds || 0));
    const level = Number.isFinite(spec.level) && spec.level >= 0 ? spec.level : 1;
    return { ...spec, level, clipSeconds, fadeInSeconds: fi, fadeOutSeconds: fo };
}

/** Envelope gain at `t` seconds into the clip. */
export function envelopeAt(spec: ClipEnvelopeSpec, t: number): number {
    const { fadeInSeconds: fi, fadeOutSeconds: fo, clipSeconds, level } = spec;
    let g = 1;
    if (fi > 0 && t < fi) g *= fadeShape(t / fi, spec.fadeInCurve);
    if (fo > 0 && t > clipSeconds - fo) g *= fadeShape((clipSeconds - t) / fo, spec.fadeOutCurve);
    return g * level;
}

/**
 * Schedule the envelope on `param`, entering the clip `enterAt` seconds in
 * (non-zero when playback starts mid-clip) at context time `when`.
 */
export function scheduleClipEnvelope(
    param: AudioParam,
    rawSpec: ClipEnvelopeSpec,
    enterAt: number,
    when: number,
): void {
    const spec = normaliseEnvelope(rawSpec);
    const { fadeInSeconds: fi, fadeOutSeconds: fo, clipSeconds } = spec;

    param.cancelScheduledValues(when);
    param.setValueAtTime(envelopeAt(spec, enterAt), when);

    const curveTo = (fromT: number, toT: number) => {
        const span = toT - fromT;
        if (span <= 0.0005) return;
        const steps = Math.max(2, Math.min(256, Math.ceil(span * 200)));
        const values = new Float32Array(steps);
        for (let i = 0; i < steps; i++) values[i] = envelopeAt(spec, fromT + (span * i) / (steps - 1));
        const at = when + (fromT - enterAt);
        try {
            param.setValueCurveAtTime(values, at, span);
        } catch {
            // Some engines reject curves touching another event; fall back safely.
            try {
                param.setValueAtTime(values[0], at + 0.0001);
                param.linearRampToValueAtTime(values[steps - 1], at + span);
            } catch {
                // Ignore if AudioParam timeline is already populated at this exact sample
            }
        }
    };

    if (fi > enterAt) curveTo(enterAt, fi);
    const foStart = Math.max(enterAt, clipSeconds - fo);
    // Add 0.0002s separation if fade-out immediately touches fade-in end to prevent Web Audio NotSupportedError
    const safeFoStart = (fi > enterAt && foStart <= fi) ? Math.min(clipSeconds, fi + 0.0002) : foStart;
    if (fo > 0 && safeFoStart < clipSeconds) curveTo(safeFoStart, clipSeconds);
}
