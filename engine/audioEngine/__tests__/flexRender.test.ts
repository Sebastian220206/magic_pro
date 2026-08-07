import {
    flexCacheKey,
    isFlexActive,
    processChannel,
    renderFlexBuffer,
    resample,
    semitonesToRatio,
} from '@/engine/audioEngine/flexRender';

/** Minimal stand-in for AudioBuffer — jsdom/node provide none. */
function fakeBuffer(channels: Float32Array[], sampleRate = 48000): AudioBuffer {
    return {
        numberOfChannels: channels.length,
        length: channels[0]?.length ?? 0,
        sampleRate,
        duration: (channels[0]?.length ?? 0) / sampleRate,
        getChannelData: (i: number) => channels[i],
    } as unknown as AudioBuffer;
}

const createBuffer = (channels: number, length: number, sampleRate: number) =>
    fakeBuffer(Array.from({ length: channels }, () => new Float32Array(length)), sampleRate);

/** A 1s sine, long enough for WSOLA's 30ms windows to engage. */
function sine(freq: number, seconds = 1, sampleRate = 48000): Float32Array {
    const data = new Float32Array(Math.floor(seconds * sampleRate));
    for (let i = 0; i < data.length; i++) {
        data[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
    }
    return data;
}

describe('isFlexActive', () => {
    test('off unless explicitly enabled', () => {
        expect(isFlexActive({})).toBe(false);
        expect(isFlexActive({ flexTimeFactor: 2 })).toBe(false);
        expect(isFlexActive({ flexEnabled: true, flexMode: 'off', flexTimeFactor: 2 })).toBe(false);
    });

    test('off when the settings are no-ops', () => {
        expect(isFlexActive({ flexEnabled: true, flexMode: 'time', flexTimeFactor: 1 })).toBe(false);
        expect(isFlexActive({ flexEnabled: true, flexMode: 'pitch', flexPitchOffset: 0 })).toBe(false);
    });

    test('on for a real stretch or shift', () => {
        expect(isFlexActive({ flexEnabled: true, flexMode: 'time', flexTimeFactor: 1.5 })).toBe(true);
        expect(isFlexActive({ flexEnabled: true, flexMode: 'pitch', flexPitchOffset: 2 })).toBe(true);
    });

    test('respects the mode when both values are set', () => {
        // Mode 'time' must ignore the pitch offset.
        expect(isFlexActive({ flexEnabled: true, flexMode: 'time', flexTimeFactor: 1, flexPitchOffset: 5 }))
            .toBe(false);
    });
});

describe('semitonesToRatio', () => {
    test('an octave is 2x', () => {
        expect(semitonesToRatio(12)).toBeCloseTo(2, 9);
        expect(semitonesToRatio(-12)).toBeCloseTo(0.5, 9);
    });

    test('unison is 1x', () => {
        expect(semitonesToRatio(0)).toBe(1);
    });
});

describe('resample', () => {
    test('halves length when doubling rate', () => {
        const input = new Float32Array(100).fill(1);
        expect(resample(input, 2).length).toBe(50);
    });

    test('doubles length when halving rate', () => {
        const input = new Float32Array(100).fill(1);
        expect(resample(input, 0.5).length).toBe(200);
    });

    test('passes through at unity', () => {
        const input = sine(440, 0.01);
        expect(Array.from(resample(input, 1))).toEqual(Array.from(input));
    });

    test('is defensive about bad ratios', () => {
        const input = new Float32Array(10).fill(0.5);
        expect(resample(input, 0).length).toBe(10);
        expect(resample(input, NaN).length).toBe(10);
    });
});

describe('processChannel', () => {
    const sampleRate = 48000;

    test('stretching lengthens the signal', () => {
        const input = sine(440, 1, sampleRate);
        const output = processChannel(input, sampleRate, {
            flexEnabled: true, flexMode: 'time', flexTimeFactor: 2,
        });
        expect(output.length).toBeGreaterThan(input.length * 1.5);
    });

    test('compressing shortens the signal', () => {
        const input = sine(440, 1, sampleRate);
        const output = processChannel(input, sampleRate, {
            flexEnabled: true, flexMode: 'time', flexTimeFactor: 0.5,
        });
        expect(output.length).toBeLessThan(input.length);
    });

    test('pitch shifting roughly preserves duration', () => {
        const input = sine(440, 1, sampleRate);
        const output = processChannel(input, sampleRate, {
            flexEnabled: true, flexMode: 'pitch', flexPitchOffset: 12,
        });
        // Stretch-then-resample should land near the original length.
        expect(output.length).toBeGreaterThan(input.length * 0.7);
        expect(output.length).toBeLessThan(input.length * 1.3);
    });

    test('produces finite samples', () => {
        const input = sine(440, 0.5, sampleRate);
        const output = processChannel(input, sampleRate, {
            flexEnabled: true, flexMode: 'time+pitch', flexTimeFactor: 1.25, flexPitchOffset: -3,
        });
        expect(output.length).toBeGreaterThan(0);
        expect(output.every(Number.isFinite)).toBe(true);
    });
});

describe('renderFlexBuffer', () => {
    test('returns the source untouched when flex is inactive', () => {
        const source = fakeBuffer([sine(440, 0.1)]);
        expect(renderFlexBuffer(source, {}, createBuffer)).toBe(source);
    });

    test('produces a new buffer when stretching', () => {
        const source = fakeBuffer([sine(440, 1)]);
        const result = renderFlexBuffer(
            source,
            { flexEnabled: true, flexMode: 'time', flexTimeFactor: 2 },
            createBuffer,
        );

        expect(result).not.toBe(source);
        expect(result.length).toBeGreaterThan(source.length);
    });

    test('preserves channel count', () => {
        const source = fakeBuffer([sine(440, 0.5), sine(660, 0.5)]);
        const result = renderFlexBuffer(
            source,
            { flexEnabled: true, flexMode: 'time', flexTimeFactor: 1.5 },
            createBuffer,
        );

        expect(result.numberOfChannels).toBe(2);
    });
});

describe('flexCacheKey', () => {
    test('changes with the settings', () => {
        const a = flexCacheKey('clip-1', { flexMode: 'time', flexTimeFactor: 1.5 });
        const b = flexCacheKey('clip-1', { flexMode: 'time', flexTimeFactor: 2 });
        expect(a).not.toBe(b);
    });

    test('is stable for identical settings', () => {
        const settings = { flexMode: 'pitch' as const, flexPitchOffset: 3 };
        expect(flexCacheKey('clip-1', settings)).toBe(flexCacheKey('clip-1', settings));
    });

    test('distinguishes clips', () => {
        const settings = { flexMode: 'time' as const, flexTimeFactor: 2 };
        expect(flexCacheKey('a', settings)).not.toBe(flexCacheKey('b', settings));
    });
});
