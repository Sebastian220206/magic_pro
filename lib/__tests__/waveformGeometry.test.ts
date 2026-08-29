import { envelopePath, hasPeaks, type PeakSource } from '@/lib/waveformGeometry';

/**
 * The waveform drew 100 hairline strokes with `fill="none"` — a fixed count
 * whatever the clip's width — and point-sampled with `idx = floor(i * step)`,
 * keeping one bucket in ten. A transient between the kept buckets vanished,
 * and the shape changed as you zoomed because a different tenth survived.
 * It also read `channels[0]` only, so a stereo clip showed its left channel.
 */

const flat = (n: number, lo: number, hi: number) => ({
    min: new Float32Array(n).fill(lo),
    max: new Float32Array(n).fill(hi),
});

const src = (channels: PeakSource['channels']): PeakSource =>
    ({ channels, resolution: channels[0]?.min.length ?? 0, numChannels: channels.length });

/** Every vertex in a path, in order. */
function vertices(d: string): Array<{ x: number; y: number }> {
    return [...d.matchAll(/[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)/g)]
        .map(m => ({ x: Number(m[1]), y: Number(m[2]) }));
}

/** The top edge is the first half, the bottom edge the reversed second half. */
function edges(d: string, n: number) {
    const v = vertices(d);
    return { top: v.slice(0, n), bottom: v.slice(n).reverse() };
}

describe('the envelope is filled and closed', () => {
    it('opens with a move and closes the shape', () => {
        const d = envelopePath(src([flat(100, -0.5, 0.5)]), { width: 50, height: 40 });
        expect(d.startsWith('M')).toBe(true);
        expect(d.endsWith('Z')).toBe(true);
    });

    it('has one vertex pair per column', () => {
        const d = envelopePath(src([flat(200, -0.5, 0.5)]), { width: 40, height: 40 });
        expect(vertices(d)).toHaveLength(80);
    });

    it('spans the full width, corner to corner', () => {
        const d = envelopePath(src([flat(100, -0.5, 0.5)]), { width: 60, height: 40 });
        const xs = vertices(d).map(v => v.x);
        expect(Math.min(...xs)).toBe(0);
        expect(Math.max(...xs)).toBe(60);
    });
});

/**
 * The headline choice: the top edge follows the real maximum and the bottom
 * the real minimum. A mirrored renderer would make these two identical.
 */
describe('it is honest about asymmetry, not mirrored', () => {
    it('draws a mostly-positive signal mostly above the centre', () => {
        const n = 40;
        const d = envelopePath(src([flat(200, -0.1, 0.9)]), { width: n, height: 40 });
        const { top, bottom } = edges(d, n);
        const mid = 20;
        const above = mid - top[10].y;
        const below = bottom[10].y - mid;
        expect(above).toBeGreaterThan(below * 4);
    });

    it('and a symmetric signal symmetrically', () => {
        const n = 20;
        const d = envelopePath(src([flat(100, -0.8, 0.8)]), { width: n, height: 40 });
        const { top, bottom } = edges(d, n);
        expect(20 - top[5].y).toBeCloseTo(bottom[5].y - 20, 5);
    });
});

/**
 * The reason the old renderer's shape changed with zoom: it read one bucket
 * per column and discarded the rest.
 */
describe('downsampling aggregates rather than samples', () => {
    it('keeps a lone transient among two thousand quiet buckets', () => {
        const n = 2000;
        const min = new Float32Array(n).fill(-0.01);
        const max = new Float32Array(n).fill(0.01);
        min[1234] = -1;
        max[1234] = 1;

        // Ten columns over 2000 buckets: point-sampling would read buckets
        // 0, 200, 400 … and never see 1234.
        const d = envelopePath(src([{ min, max }]), { width: 10, height: 40, padding: 0 });
        const ys = vertices(d).map(v => v.y);
        expect(Math.min(...ys)).toBeCloseTo(0, 1);
        expect(Math.max(...ys)).toBeCloseTo(40, 1);
    });

    it('keeps the transient at every width', () => {
        const n = 1000;
        const min = new Float32Array(n).fill(-0.02);
        const max = new Float32Array(n).fill(0.02);
        min[500] = -1; max[500] = 1;
        const peaks = src([{ min, max }]);

        for (const width of [5, 17, 60, 250]) {
            const ys = vertices(envelopePath(peaks, { width, height: 40, padding: 0 }))
                .map(v => v.y);
            expect(Math.min(...ys)).toBeCloseTo(0, 1);
        }
    });
});

describe('the column count follows the rendered width', () => {
    it('gives one column per pixel', () => {
        expect(vertices(envelopePath(src([flat(500, -1, 1)]), { width: 40, height: 40 })))
            .toHaveLength(80);
        expect(vertices(envelopePath(src([flat(500, -1, 1)]), { width: 120, height: 40 })))
            .toHaveLength(240);
    });

    it('never invents more columns than there are buckets', () => {
        const d = envelopePath(src([flat(64, -1, 1)]), { width: 4000, height: 40 });
        expect(vertices(d)).toHaveLength(128);
    });

    it('respects the vertex ceiling on a very wide clip', () => {
        const d = envelopePath(src([flat(50000, -1, 1)]), { width: 40000, height: 40, maxPoints: 512 });
        expect(vertices(d)).toHaveLength(1024);
    });
});

/** A stereo clip showed only its left channel. */
describe('every channel counts', () => {
    it('shows content that is only in the right channel', () => {
        const n = 100;
        const left = { min: new Float32Array(n).fill(-0.02), max: new Float32Array(n).fill(0.02) };
        const right = { min: new Float32Array(n).fill(-0.02), max: new Float32Array(n).fill(0.02) };
        // Loud only on the right, only in the second half.
        for (let i = 50; i < n; i++) { right.min[i] = -1; right.max[i] = 1; }

        const cols = 20;
        const d = envelopePath(src([left, right]), { width: cols, height: 40, padding: 0 });
        const { top } = edges(d, cols);
        expect(top[2].y).toBeGreaterThan(15);   // quiet first half, near the centre
        expect(top[17].y).toBeCloseTo(0, 1);    // loud second half, at the top
    });

    it('handles more than two channels', () => {
        const quiet = () => flat(50, -0.01, 0.01);
        const loud = flat(50, -1, 1);
        const d = envelopePath(src([quiet(), quiet(), loud]), { width: 10, height: 40, padding: 0 });
        expect(Math.min(...vertices(d).map(v => v.y))).toBeCloseTo(0, 1);
    });
});

describe('silence, and the absence of data', () => {
    it('draws one hairline through silence rather than nothing', () => {
        const cols = 20;
        const d = envelopePath(src([flat(100, 0, 0)]),
            { width: cols, height: 40, minThickness: 1 });
        const { top, bottom } = edges(d, cols);
        expect(bottom[5].y - top[5].y).toBeCloseTo(1, 5);
        expect((top[5].y + bottom[5].y) / 2).toBeCloseTo(20, 5);
    });

    it('reports when there is nothing to draw', () => {
        expect(hasPeaks(undefined)).toBe(false);
        expect(hasPeaks({ channels: [] })).toBe(false);
        expect(hasPeaks(src([flat(0, 0, 0)]))).toBe(false);
        expect(hasPeaks(src([flat(4, -1, 1)]))).toBe(true);
    });
});

describe('it never produces a broken path', () => {
    /** `drawWaveform` reads past the end for exactly this reason. */
    it('ignores a resolution that disagrees with the array length', () => {
        const peaks: PeakSource = { channels: [flat(50, -1, 1)], resolution: 5000 };
        const d = envelopePath(peaks, { width: 30, height: 40 });
        expect(d).not.toMatch(/NaN/);
        expect(vertices(d)).toHaveLength(60);
    });

    it('survives ragged channels, holes and out-of-range values', () => {
        const ragged: PeakSource = {
            channels: [
                { min: new Float32Array([-0.5, -3, NaN, -0.2]), max: new Float32Array([0.5, 3, NaN, 0.2]) },
                { min: new Float32Array([-0.1, -0.1]), max: new Float32Array([0.1, 0.1]) },
            ],
        };
        const d = envelopePath(ragged, { width: 20, height: 40 });
        expect(d).not.toMatch(/NaN/);
        for (const v of vertices(d)) {
            expect(v.y).toBeGreaterThanOrEqual(0);
            expect(v.y).toBeLessThanOrEqual(40);
        }
    });

    it('returns nothing for a degenerate box', () => {
        const peaks = src([flat(100, -1, 1)]);
        expect(envelopePath(peaks, { width: 0, height: 40 })).toBe('');
        expect(envelopePath(peaks, { width: 40, height: 0 })).toBe('');
        expect(envelopePath({ channels: [] }, { width: 40, height: 40 })).toBe('');
    });
});

describe('windowing a trimmed clip', () => {
    it('draws only the requested span', () => {
        const n = 200;
        const min = new Float32Array(n).fill(0);
        const max = new Float32Array(n).fill(0);
        for (let i = n / 2; i < n; i++) { min[i] = -1; max[i] = 1; }

        const cols = 20;
        const d = envelopePath(src([{ min, max }]),
            { width: cols, height: 40, padding: 0, window: { from: 0.5, to: 1 } });
        const { top } = edges(d, cols);
        expect(top[2].y).toBeCloseTo(0, 1);
        expect(top[17].y).toBeCloseTo(0, 1);
    });

    it('defaults to the whole source', () => {
        const peaks = src([flat(100, -1, 1)]);
        expect(envelopePath(peaks, { width: 20, height: 40 }))
            .toBe(envelopePath(peaks, { width: 20, height: 40, window: { from: 0, to: 1 } }));
    });
});
