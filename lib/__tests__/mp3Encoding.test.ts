import {
    parseBitRate,
    encodedChannelCount,
    bitRateFor,
    filterSubsonic,
    toInt16,
    downmixToMono,
    encodeMp3,
} from '../mp3Encoding';

function tone(hz: number, seconds: number, sampleRate = 44100): Float32Array {
    const samples = new Float32Array(Math.round(seconds * sampleRate));
    for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin((2 * Math.PI * hz * i) / sampleRate) * 0.5;
    }
    return samples;
}

function peak(samples: Float32Array): number {
    let max = 0;
    for (const sample of samples) max = Math.max(max, Math.abs(sample));
    return max;
}

describe('MP3 settings reaching the encoder', () => {
    it('reads a bit rate out of its label', () => {
        expect(parseBitRate('320 kbit/s', 192)).toBe(320);
        expect(parseBitRate('128 kbit/s', 192)).toBe(128);
    });

    it('falls back rather than handing the encoder a NaN', () => {
        expect(parseBitRate(undefined, 192)).toBe(192);
        expect(parseBitRate('', 192)).toBe(192);
        expect(parseBitRate('best please', 192)).toBe(192);
    });

    it('uses the mono bit rate only for a mono file', () => {
        const settings = { bitRateMono: '96 kbit/s', bitRateStereo: '256 kbit/s' };
        expect(bitRateFor(settings, 2)).toBe(256);
        expect(bitRateFor(settings, 1)).toBe(96);
        // Mono mode downmixes, so it takes the mono rate from a stereo source.
        expect(bitRateFor({ ...settings, stereoMode: 'Mono' }, 2)).toBe(96);
    });

    it('only the Mono stereo mode changes the channel count', () => {
        expect(encodedChannelCount({ stereoMode: 'Stereo' }, 2)).toBe(2);
        expect(encodedChannelCount({ stereoMode: 'Joint Stereo' }, 2)).toBe(2);
        expect(encodedChannelCount({ stereoMode: 'Mono' }, 2)).toBe(1);
        expect(encodedChannelCount({}, 1)).toBe(1);
    });

    it('removes subsonic content and leaves audible content alone', () => {
        const rumble = tone(3, 1);
        const music = tone(1000, 1);
        const rumbleBefore = peak(rumble);
        const musicBefore = peak(music);

        filterSubsonic(rumble, 44100);
        filterSubsonic(music, 44100);

        expect(peak(rumble)).toBeLessThan(rumbleBefore * 0.5);
        expect(peak(music)).toBeGreaterThan(musicBefore * 0.9);
    });

    it('converts float samples to signed 16-bit without wrapping', () => {
        const source = new Float32Array([0, 1, -1, 2, -2, 0.5]);
        const out = new Int16Array(6);
        toInt16(source, out, 0, 6);
        expect(out[0]).toBe(0);
        expect(out[1]).toBe(32767);
        expect(out[2]).toBe(-32768);
        // Out-of-range input clamps rather than wrapping to the opposite sign.
        expect(out[3]).toBe(32767);
        expect(out[4]).toBe(-32768);
        expect(out[5]).toBeCloseTo(16383, -1);
    });

    it('averages channels when downmixing', () => {
        const left = new Float32Array([1, 0, -1]);
        const right = new Float32Array([0, 1, -1]);
        expect(Array.from(downmixToMono([left, right]))).toEqual([0.5, 0.5, -1]);
        // A single channel is passed through, not copied.
        expect(downmixToMono([left])).toBe(left);
    });

    it('encodes real MP3 bytes, starting with a frame sync', () => {
        const encoded = encodeMp3([tone(440, 0.3), tone(440, 0.3)], 44100, {
            bitRateStereo: '128 kbit/s',
        });
        expect(encoded).not.toBeNull();
        expect(encoded!.length).toBeGreaterThan(1000);
        // Every MP3 frame header opens with eleven set bits.
        expect(encoded![0]).toBe(0xff);
        expect(encoded![1] & 0xe0).toBe(0xe0);
    });

    it('a higher bit rate produces a larger file', () => {
        const channels = () => [tone(440, 0.5), tone(660, 0.5)];
        const low = encodeMp3(channels(), 44100, { bitRateStereo: '96 kbit/s' });
        const high = encodeMp3(channels(), 44100, { bitRateStereo: '320 kbit/s' });
        expect(low).not.toBeNull();
        expect(high).not.toBeNull();
        expect(high!.length).toBeGreaterThan(low!.length * 2);
    });

    it('Mono mode encodes at the mono bit rate', () => {
        const channels = () => [tone(440, 0.5), tone(660, 0.5)];
        const stereo = encodeMp3(channels(), 44100, { bitRateStereo: '320 kbit/s', bitRateMono: '96 kbit/s' });
        const mono = encodeMp3(channels(), 44100, {
            stereoMode: 'Mono', bitRateStereo: '320 kbit/s', bitRateMono: '96 kbit/s',
        });
        // Constant bit rate: the size difference is the bit rate, and choosing
        // Mono is what makes the mono figure the one that applies.
        expect(mono!.length).toBeLessThan(stereo!.length / 3);
    });

    it('does not modify the caller buffer when filtering', () => {
        const source = tone(3, 0.2);
        const copy = Float32Array.from(source);
        encodeMp3([source], 44100, { filterBelow10Hz: true });
        expect(Array.from(source)).toEqual(Array.from(copy));
    });

    it('reports failure instead of returning empty bytes', () => {
        expect(encodeMp3([], 44100)).toBeNull();
        expect(encodeMp3([new Float32Array(0)], 44100)).toBeNull();
    });
});
