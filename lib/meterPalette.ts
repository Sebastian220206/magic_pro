/**
 * The one level-meter colour scale.
 *
 * `VerticalMeter`, `HorizontalMeter` and `TrackLevelMeter` each carried their
 * own copy of green/amber/red and their own thresholds. They are imperative —
 * they write `style.backgroundColor` or paint a canvas gradient, so no
 * stylesheet can reach them — which made three silently divergent scales easy
 * and a retheme error-prone.
 *
 * The thresholds here are the ones those three already used and are deliberately
 * unchanged: a meter that reads amber at a different level than before is a
 * regression, not a restyle.
 */

/** Signal is in its nominal range. */
export const METER_NOMINAL = '#4ade80';
/** Approaching full scale — roughly −12 dBFS and above. */
export const METER_WARNING = '#fbbf24';
/** Clipping, or close enough that it will. */
export const METER_CLIP = '#ff4d4d';
/** Peak-hold tick, drawn over whichever band it lands in. */
export const METER_PEAK = 'rgba(255,255,255,0.75)';
/** Unlit meter bed. Darker than the panel it sits on, so an idle meter reads as off. */
export const METER_BED = 'rgba(4, 7, 11, 0.75)';

/** Fraction of full scale at which the scale turns amber. */
export const WARNING_AT = 0.8;
/** Fraction of full scale at which the scale turns red. */
export const CLIP_AT = 0.95;

/**
 * Colour for a discrete bar whose height is `level` (0–1).
 *
 * `VerticalMeter` paints one solid bar rather than a gradient, so it needs the
 * band rather than the ramp. Its historical thresholds were 0.7 and 0.9 —
 * slightly earlier than the gradient's, because a solid bar has no ramp to warn
 * you on the way up.
 */
export function meterBandColor(level: number): string {
    if (level > 0.9) return METER_CLIP;
    if (level > 0.7) return METER_WARNING;
    return METER_NOMINAL;
}

/**
 * Paint the standard green-amber-red ramp along a canvas gradient.
 * `nominal` lets a caller tint the quiet end (a track meter in its track
 * colour, say) while keeping the warning and clip bands fixed.
 */
export function applyMeterGradient(gradient: CanvasGradient, nominal: string = METER_NOMINAL): CanvasGradient {
    gradient.addColorStop(0, nominal);
    gradient.addColorStop(WARNING_AT, METER_WARNING);
    gradient.addColorStop(CLIP_AT, METER_CLIP);
    return gradient;
}
