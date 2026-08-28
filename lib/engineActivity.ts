/**
 * Turning the scheduler's counts into something a meter can draw.
 *
 * The two bars this feeds replaced a pair that were hard-coded: one at
 * `w-[20%]` with `animate-pulse`, one at `w-[45%]`, beside a bare `Activity`
 * icon with no handler — and the group carried `group-hover:opacity-100`, so
 * it brightened under the cursor and read as a control while being completely
 * inert.
 *
 * The obvious replacement was `audioContextManager.getPerformanceMetrics()`.
 * It is a trap: its `cpuUsage` is `activeSources * 0.1` where `activeSources`
 * is initialised to 0 and incremented nowhere, so it is permanently 0, and its
 * `memoryUsage` is a 100MB constant. `advancedScheduler.getPerformanceMetrics()`
 * counts a `Set<AudioBufferSourceNode>` that is genuinely maintained.
 */

/** Voices at which the meter reads full. Named, and stated in the tooltip. */
export const VOICE_CEILING = 64;

/** Clips scheduled ahead at which the meter reads full. */
export const CLIP_CEILING = 32;

export interface EngineActivity {
    activeSources: number;
    scheduledClips: number;
}

/** A 0..1 bar width from a count, safe against nonsense. */
export function loadFraction(count: number, ceiling: number): number {
    if (!Number.isFinite(count) || count <= 0) return 0;
    const top = Number.isFinite(ceiling) && ceiling > 0 ? ceiling : 1;
    return Math.min(1, count / top);
}

/**
 * What the readout says on hover.
 *
 * Says the transport is stopped rather than showing zeros without explanation:
 * a meter at zero because nothing is playing and a meter at zero because it is
 * broken looked identical here for a long time.
 */
export function activityTitle(metrics: EngineActivity, playing: boolean): string {
    if (!playing) return 'Transport stopped — nothing scheduled';
    const voices = metrics.activeSources;
    const clips = metrics.scheduledClips;
    return `${voices} voice${voices === 1 ? '' : 's'} of ${VOICE_CEILING}, ` +
        `${clips} clip${clips === 1 ? '' : 's'} scheduled`;
}
