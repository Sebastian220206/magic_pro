import {
    MAX_COMPENSATION_SAMPLES,
    computeCompensation,
    pluginLatencySamples,
    projectLatencySamples,
    samplesToSeconds,
    trackLatencySamples,
} from '@/engine/audioEngine/latencyCompensation';

describe('pluginLatencySamples', () => {
    test('looks up known processors', () => {
        expect(pluginLatencySamples({ pluginId: 'limiter' })).toBe(64);
        expect(pluginLatencySamples({ type: 'linear-phase-eq' })).toBe(512);
    });

    test('unknown processors are treated as zero-latency', () => {
        expect(pluginLatencySamples({ pluginId: 'reverb' })).toBe(0);
        expect(pluginLatencySamples({})).toBe(0);
        expect(pluginLatencySamples(null)).toBe(0);
    });

    test('a self-reported latency wins over the registry', () => {
        expect(pluginLatencySamples({ pluginId: 'limiter', latencySamples: 256 })).toBe(256);
    });

    test('bypassed plugins contribute nothing', () => {
        expect(pluginLatencySamples({ pluginId: 'limiter', enabled: false })).toBe(0);
    });

    test('negative or fractional reports are sanitised', () => {
        expect(pluginLatencySamples({ latencySamples: -10 })).toBe(0);
        expect(pluginLatencySamples({ latencySamples: 10.6 })).toBe(11);
    });
});

describe('trackLatencySamples', () => {
    test('latency adds in series', () => {
        expect(trackLatencySamples([
            { pluginId: 'limiter' },          // 64
            { pluginId: 'linear-phase-eq' },  // 512
        ])).toBe(576);
    });

    test('an empty chain has no latency', () => {
        expect(trackLatencySamples([])).toBe(0);
        expect(trackLatencySamples(undefined)).toBe(0);
    });
});

describe('computeCompensation', () => {
    test('pads every track up to the slowest one', () => {
        const result = computeCompensation([
            { trackId: 'a', latencySamples: 0 },
            { trackId: 'b', latencySamples: 512 },
            { trackId: 'c', latencySamples: 64 },
        ]);

        expect(result.get('a')).toBe(512);
        expect(result.get('b')).toBe(0);   // the reference — never delayed further
        expect(result.get('c')).toBe(448);
    });

    test('all tracks end up aligned', () => {
        const reports = [
            { trackId: 'a', latencySamples: 0 },
            { trackId: 'b', latencySamples: 512 },
            { trackId: 'c', latencySamples: 64 },
        ];
        const comp = computeCompensation(reports);

        const arrival = reports.map(r => r.latencySamples + comp.get(r.trackId)!);
        expect(new Set(arrival).size).toBe(1);
    });

    test('adds nothing when no plugin reports latency', () => {
        const result = computeCompensation([
            { trackId: 'a', latencySamples: 0 },
            { trackId: 'b', latencySamples: 0 },
        ]);
        expect(result.get('a')).toBe(0);
        expect(result.get('b')).toBe(0);
    });

    test('handles a single track', () => {
        const result = computeCompensation([{ trackId: 'only', latencySamples: 128 }]);
        expect(result.get('only')).toBe(0);
    });

    test('is empty for no tracks', () => {
        expect(computeCompensation([]).size).toBe(0);
    });

    test('clamps a runaway latency report', () => {
        const result = computeCompensation([
            { trackId: 'a', latencySamples: 0 },
            { trackId: 'bad', latencySamples: Number.MAX_SAFE_INTEGER },
        ]);
        expect(result.get('a')).toBe(MAX_COMPENSATION_SAMPLES);
    });

    test('treats malformed reports as zero', () => {
        const result = computeCompensation([
            { trackId: 'a', latencySamples: NaN },
            { trackId: 'b', latencySamples: -5 },
        ]);
        expect(result.get('a')).toBe(0);
        expect(result.get('b')).toBe(0);
    });
});

describe('helpers', () => {
    test('samplesToSeconds converts at the project rate', () => {
        expect(samplesToSeconds(48000, 48000)).toBe(1);
        expect(samplesToSeconds(2400, 48000)).toBeCloseTo(0.05, 9);
    });

    test('samplesToSeconds is defensive', () => {
        expect(samplesToSeconds(0, 48000)).toBe(0);
        expect(samplesToSeconds(100, 0)).toBe(0);
        expect(samplesToSeconds(NaN, 48000)).toBe(0);
    });

    test('projectLatencySamples reports the worst track', () => {
        expect(projectLatencySamples([
            { trackId: 'a', latencySamples: 64 },
            { trackId: 'b', latencySamples: 512 },
        ])).toBe(512);
    });
});
