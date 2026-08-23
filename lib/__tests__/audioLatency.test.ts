/**
 * What the Audio > Devices panel reports about latency.
 *
 * The panel computed its figures from an "I/O Buffer Size" preference the
 * engine never read, so the milliseconds it displayed had no relationship to
 * the audio path — an authoritative-looking number that was invented. The
 * browser owns the buffer size and reports the real values on the context.
 */

import {
    outputLatencyMs, roundTripLatencyMs, effectiveBufferSize,
    formatMs, recordingDelaySeconds,
} from '../audioLatency';

describe('output latency', () => {
    it('converts seconds to milliseconds', () => {
        expect(outputLatencyMs(0.0058)).toBeCloseTo(5.8, 3);
    });

    it('prefers the larger of the two figures', () => {
        // `outputLatency` is the honest one but is not implemented everywhere,
        // so `baseLatency` is a floor rather than a substitute.
        expect(outputLatencyMs(0.005, 0.012)).toBeCloseTo(12, 3);
        expect(outputLatencyMs(0.012, 0.005)).toBeCloseTo(12, 3);
    });

    it('survives a context that reports neither', () => {
        expect(outputLatencyMs(NaN, undefined)).toBe(0);
        expect(outputLatencyMs(0, undefined)).toBe(0);
    });
});

describe('roundtrip', () => {
    it('doubles the output figure', () => {
        // Input latency is not exposed to a page at all, which is why the
        // panel labels this an estimate.
        expect(roundTripLatencyMs(0.005)).toBeCloseTo(10, 3);
    });
});

describe('effective buffer size', () => {
    it('derives the size the browser is using', () => {
        // 128 samples at 48k is the usual render quantum.
        expect(effectiveBufferSize(128 / 48000, 48000)).toBe(128);
        expect(effectiveBufferSize(256 / 44100, 44100)).toBe(256);
    });

    it('reports a power of two, as buffer sizes are named', () => {
        const size = effectiveBufferSize(130 / 48000, 48000);
        expect(Math.log2(size) % 1).toBe(0);
    });

    it('returns zero rather than nonsense when it cannot tell', () => {
        expect(effectiveBufferSize(0, 48000)).toBe(0);
        expect(effectiveBufferSize(NaN, 48000)).toBe(0);
        expect(effectiveBufferSize(0.01, 0)).toBe(0);
    });
});

describe('formatting', () => {
    it('prints one decimal', () => {
        expect(formatMs(9.94)).toBe('9.9');
        expect(formatMs(0)).toBe('0.0');
    });

    it('prints a dash when there is no figure', () => {
        expect(formatMs(NaN)).toBe('—');
        expect(formatMs(Infinity)).toBe('—');
    });
});

describe('recording delay', () => {
    it('converts the slider samples to seconds', () => {
        expect(recordingDelaySeconds(480, 48000)).toBeCloseTo(0.01, 6);
    });

    it('handles a negative offset, which pushes a take later', () => {
        expect(recordingDelaySeconds(-480, 48000)).toBeCloseTo(-0.01, 6);
    });

    it('is zero when the numbers are unusable', () => {
        expect(recordingDelaySeconds(NaN, 48000)).toBe(0);
        expect(recordingDelaySeconds(480, 0)).toBe(0);
    });
});
