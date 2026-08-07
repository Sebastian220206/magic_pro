/**
 * WAV metadata chunks — the tags a delivered master carries.
 *
 * Round-trips through the reader, and checks the file stays a valid RIFF that
 * a decoder can still find the audio in.
 */

import { buildInfoChunk, withWavMetadata, readWavMetadata } from '../wavMetadata';

const ascii = (s: string) => [...s].map(c => c.charCodeAt(0));

/** A minimal but valid WAV: RIFF/WAVE, fmt, data. */
function makeWav(dataBytes = 8): ArrayBuffer {
    const total = 12 + 24 + 8 + dataBytes;
    const buf = new ArrayBuffer(total);
    const view = new DataView(buf);
    const bytes = new Uint8Array(buf);

    bytes.set(ascii('RIFF'), 0);
    view.setUint32(4, total - 8, true);
    bytes.set(ascii('WAVE'), 8);

    bytes.set(ascii('fmt '), 12);
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);         // PCM
    view.setUint16(22, 2, true);         // stereo
    view.setUint32(24, 48000, true);
    view.setUint32(28, 48000 * 2 * 3, true);
    view.setUint16(32, 6, true);
    view.setUint16(34, 24, true);

    bytes.set(ascii('data'), 36);
    view.setUint32(40, dataBytes, true);
    for (let i = 0; i < dataBytes; i++) bytes[44 + i] = i + 1;

    return buf;
}

const readId = (buf: ArrayBuffer, at: number) =>
    String.fromCharCode(...new Uint8Array(buf, at, 4));

describe('buildInfoChunk', () => {
    it('returns null when there is nothing to write', () => {
        expect(buildInfoChunk({})).toBeNull();
        expect(buildInfoChunk({ title: '   ' })).toBeNull();
    });

    it('produces a LIST/INFO chunk with an even length', () => {
        const chunk = buildInfoChunk({ title: 'Odd' })!;
        expect(String.fromCharCode(...chunk.subarray(0, 4))).toBe('LIST');
        expect(String.fromCharCode(...chunk.subarray(8, 12))).toBe('INFO');
        // RIFF chunks must be word-aligned.
        expect(chunk.length % 2).toBe(0);
    });
});

describe('withWavMetadata', () => {
    it('round-trips every supported tag', () => {
        const metadata = {
            title: 'Night Drive',
            artist: 'Me',
            album: 'Singles',
            year: '2026',
            isrc: 'USRC17607839',
            comment: 'Master v3',
        };

        const tagged = withWavMetadata(makeWav(), metadata);
        expect(readWavMetadata(tagged)).toEqual(metadata);
    });

    it('writes only the tags that were given', () => {
        const tagged = withWavMetadata(makeWav(), { isrc: 'USRC17607839' });
        expect(readWavMetadata(tagged)).toEqual({ isrc: 'USRC17607839' });
    });

    it('keeps the file a valid RIFF with a correct size field', () => {
        const original = makeWav();
        const tagged = withWavMetadata(original, { title: 'Night Drive' });

        expect(readId(tagged, 0)).toBe('RIFF');
        expect(readId(tagged, 8)).toBe('WAVE');
        expect(new DataView(tagged).getUint32(4, true)).toBe(tagged.byteLength - 8);
        expect(tagged.byteLength).toBeGreaterThan(original.byteLength);
    });

    it('leaves the audio data intact and still findable', () => {
        const tagged = withWavMetadata(makeWav(8), { artist: 'Me' });

        // Walk to `data` the way a decoder would.
        const view = new DataView(tagged);
        let cursor = 12;
        let found = -1;
        while (cursor + 8 <= tagged.byteLength) {
            const id = readId(tagged, cursor);
            const size = view.getUint32(cursor + 4, true);
            if (id === 'data') { found = cursor; break; }
            cursor += 8 + size + (size % 2);
        }

        expect(found).toBeGreaterThan(0);
        expect(view.getUint32(found + 4, true)).toBe(8);
        expect([...new Uint8Array(tagged, found + 8, 8)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('places the tags before the audio', () => {
        const tagged = withWavMetadata(makeWav(), { title: 'Night Drive' });
        const asString = String.fromCharCode(...new Uint8Array(tagged));
        expect(asString.indexOf('LIST')).toBeLessThan(asString.indexOf('data'));
    });

    it('returns the input untouched when there is nothing to add', () => {
        const original = makeWav();
        expect(withWavMetadata(original, undefined)).toBe(original);
        expect(withWavMetadata(original, {})).toBe(original);
    });

    it('never corrupts a buffer that is not a WAV', () => {
        const notWav = new ArrayBuffer(64);
        expect(withWavMetadata(notWav, { title: 'x' })).toBe(notWav);
        expect(withWavMetadata(new ArrayBuffer(4), { title: 'x' }).byteLength).toBe(4);
    });

    it('reads nothing out of an untagged file rather than throwing', () => {
        expect(readWavMetadata(makeWav())).toEqual({});
        expect(readWavMetadata(new ArrayBuffer(0))).toEqual({});
    });
});
