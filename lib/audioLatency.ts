/**
 * What the Audio > Devices panel reports about latency.
 *
 * The panel used to compute its figures from an "I/O Buffer Size" setting the
 * engine never read, so the milliseconds it displayed had no relationship to
 * the audio path. The browser owns the buffer size and reports the real
 * numbers on the AudioContext; these turn those into what the panel shows.
 */

/** Milliseconds in a second, named so the conversions read as intent. */
const MS = 1000;

/**
 * Output latency in ms: how long after a sample is scheduled it is heard.
 *
 * `outputLatency` is the honest figure but is not implemented everywhere;
 * `baseLatency` is the render-quantum part and is always present, so it is the
 * floor rather than a substitute.
 */
export function outputLatencyMs(baseLatency: number, outputLatency?: number): number {
    const base = Number.isFinite(baseLatency) ? baseLatency : 0;
    const out = Number.isFinite(outputLatency as number) ? (outputLatency as number) : 0;
    return Math.max(base, out) * MS;
}

/**
 * Roundtrip in ms: in through the input and back out again.
 *
 * Input latency is not exposed to the page at all, so the output figure is
 * doubled — the same assumption a console makes when it cannot measure the
 * input side. It is an estimate, and the panel says so.
 */
export function roundTripLatencyMs(baseLatency: number, outputLatency?: number): number {
    return outputLatencyMs(baseLatency, outputLatency) * 2;
}

/**
 * The buffer size the browser has actually chosen, in samples.
 *
 * Derived from `baseLatency`, which is the render quantum expressed in
 * seconds. Web Audio gives no way to set this, which is why the panel shows it
 * rather than offering it.
 */
export function effectiveBufferSize(baseLatency: number, sampleRate: number): number {
    if (!Number.isFinite(baseLatency) || !Number.isFinite(sampleRate) || sampleRate <= 0) return 0;
    const samples = Math.round(baseLatency * sampleRate);
    if (samples <= 0) return 0;
    // Report it as the nearest power of two, which is how buffer sizes are
    // named everywhere else.
    const power = Math.round(Math.log2(samples));
    return Math.pow(2, Math.max(0, power));
}

/** `9.9` — one decimal, as the panel prints it. */
export function formatMs(ms: number): string {
    return Number.isFinite(ms) ? ms.toFixed(1) : '—';
}

/**
 * A recording offset in samples, as seconds.
 *
 * Positive pulls a take earlier, which is the correction for an interface that
 * reports its own latency short. The slider is in samples because that is the
 * unit an interface's documentation quotes.
 */
export function recordingDelaySeconds(samples: number, sampleRate: number): number {
    if (!Number.isFinite(samples) || !Number.isFinite(sampleRate) || sampleRate <= 0) return 0;
    return samples / sampleRate;
}
