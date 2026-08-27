/**
 * What the Limiter's two modes and its Soft Knee switch actually change.
 *
 * Kept out of the plugin so the differences can be asserted without a
 * `DynamicsCompressorNode` — and so "Legacy" and "Precision" are a description
 * of behaviour rather than two labels on the same processor.
 */

export type LimiterMode = 'legacy' | 'precision';

export const LIMITER_MODES: readonly { id: LimiterMode; label: string; hint: string }[] = [
    {
        id: 'legacy',
        label: 'Legacy',
        hint: 'Softer catch; fast peaks can slip a little past the ceiling',
    },
    {
        id: 'precision',
        label: 'Precision',
        hint: 'Nothing passes the ceiling — a clipper backs up the limiter',
    },
];

export interface LimiterModeProfile {
    /** Seconds. Precision grabs instantly; Legacy has a little give. */
    attack: number;
    /** Multiplies the release the user dialled in. */
    releaseScale: number;
    /**
     * A hard clip at the ceiling after the limiter.
     *
     * This is what makes Precision a brickwall: a `DynamicsCompressorNode` at
     * 20:1 is not one, and a transient shorter than its attack goes through.
     */
    clip: boolean;
}

export const LIMITER_MODE_PROFILES: Readonly<Record<LimiterMode, LimiterModeProfile>> = {
    legacy: { attack: 0.001, releaseScale: 1, clip: false },
    precision: { attack: 0, releaseScale: 0.6, clip: true },
};

export function limiterProfile(mode: string): LimiterModeProfile {
    return LIMITER_MODE_PROFILES[mode as LimiterMode] ?? LIMITER_MODE_PROFILES.legacy;
}

/** The compressor knee each Soft Knee setting asks for, in dB. */
export function limiterKnee(softKnee: boolean): number {
    return softKnee ? 6 : 0;
}

/**
 * The clipper's transfer curve: straight through, then flat at the ceiling.
 *
 * Built here rather than in the plugin so the shape can be checked directly —
 * a clipper that does not actually flatten is indistinguishable from one that
 * does until something exceeds it.
 */
export function clipCurve(ceilingDb: number, samples = 2048): Float32Array<ArrayBuffer> {
    const ceiling = Math.min(1, Math.pow(10, Math.min(0, ceilingDb) / 20));
    const curve = new Float32Array(new ArrayBuffer(samples * 4));
    for (let i = 0; i < samples; i++) {
        const x = (i * 2) / (samples - 1) - 1;
        curve[i] = Math.max(-ceiling, Math.min(ceiling, x));
    }
    return curve;
}

/** Release, in seconds, that the plugin should actually use. */
export function effectiveRelease(releaseSeconds: number, mode: string): number {
    const scaled = releaseSeconds * limiterProfile(mode).releaseScale;
    return Math.max(0.002, Math.min(2, Number.isFinite(scaled) ? scaled : 0.1));
}
