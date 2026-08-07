/**
 * latencyCompensation.ts
 * Plugin delay compensation (PDC).
 *
 * Several processors cannot produce a sample without looking ahead: a limiter
 * needs its lookahead window, a linear-phase EQ needs its FIR half-length, an
 * oversampled saturator needs its resampling filters. Each therefore emits
 * audio later than it received it.
 *
 * Without compensation, a track carrying such a plugin drifts late relative to
 * every other track, and no amount of nudging fixes it because the offset
 * changes with the plugin chain. The fix is to delay *every* track to match the
 * worst offender, so all of them arrive at the master aligned.
 *
 * This module is pure arithmetic so the alignment rules can be tested directly;
 * `routingEngine` applies the results to real DelayNodes.
 */

/** Latency introduced by each known processor, in samples at the project rate. */
export const PLUGIN_LATENCY_SAMPLES: Readonly<Record<string, number>> = {
    // Lookahead limiters must buffer their lookahead window.
    limiter: 64,
    'wasm-limiter': 64,
    brickwall: 64,
    // Linear-phase EQ uses a symmetric FIR; latency is half the kernel.
    'linear-phase-eq': 512,
    // Oversampled processors pay for their resampling filters.
    saturation: 32,
    'wasm-saturation': 32,
    // Everything else is reported as zero-latency unless it says otherwise.
};

/** Upper bound on added delay, so a misreporting plugin cannot stall playback. */
export const MAX_COMPENSATION_SAMPLES = 96_000; // 2s at 48kHz

export interface PluginDescriptor {
    /** Registry id or type name. */
    id?: string;
    pluginId?: string;
    type?: string;
    enabled?: boolean;
    /** A plugin may report its own latency; this wins over the registry. */
    latencySamples?: number;
}

export interface TrackLatencyReport {
    trackId: string;
    latencySamples: number;
}

/**
 * Latency of a single plugin.
 *
 * A self-reported value is trusted first — that is how a third-party or WASM
 * plugin declares its own delay. Bypassed plugins contribute nothing.
 */
export function pluginLatencySamples(plugin: PluginDescriptor | null | undefined): number {
    if (!plugin) return 0;
    if (plugin.enabled === false) return 0;

    if (typeof plugin.latencySamples === 'number' && Number.isFinite(plugin.latencySamples)) {
        return Math.max(0, Math.round(plugin.latencySamples));
    }

    const key = plugin.pluginId ?? plugin.type ?? plugin.id;
    if (!key) return 0;

    return PLUGIN_LATENCY_SAMPLES[key] ?? 0;
}

/** Total latency of a track's insert chain — latencies add in series. */
export function trackLatencySamples(plugins: PluginDescriptor[] | undefined): number {
    if (!plugins || plugins.length === 0) return 0;
    return plugins.reduce((total, plugin) => total + pluginLatencySamples(plugin), 0);
}

/**
 * Delay to add to each track so all of them line up at the master bus.
 *
 * The slowest track defines the reference; every other track is padded by the
 * difference. The slowest track itself receives zero extra delay, so
 * compensation never adds more latency than the project already had.
 *
 * Returns samples, keyed by track id.
 */
export function computeCompensation(
    reports: TrackLatencyReport[],
    maxCompensationSamples: number = MAX_COMPENSATION_SAMPLES,
): Map<string, number> {
    const result = new Map<string, number>();
    if (reports.length === 0) return result;

    const sanitised = reports.map(r => ({
        trackId: r.trackId,
        latencySamples: Number.isFinite(r.latencySamples) ? Math.max(0, r.latencySamples) : 0,
    }));

    const worst = Math.min(
        sanitised.reduce((max, r) => Math.max(max, r.latencySamples), 0),
        maxCompensationSamples,
    );

    for (const report of sanitised) {
        const delay = Math.max(0, Math.min(worst - report.latencySamples, maxCompensationSamples));
        result.set(report.trackId, delay);
    }

    return result;
}

/** Convert a sample count to seconds for a DelayNode. */
export function samplesToSeconds(samples: number, sampleRate: number): number {
    if (!Number.isFinite(samples) || samples <= 0) return 0;
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) return 0;
    return samples / sampleRate;
}

/** Total latency the project reports to the user, in samples. */
export function projectLatencySamples(reports: TrackLatencyReport[]): number {
    return reports.reduce((max, r) => Math.max(max, Math.max(0, r.latencySamples || 0)), 0);
}
