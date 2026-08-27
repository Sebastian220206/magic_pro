import {
    freqToX, xToFreq, dbToY, yToDb, bandAtPoint, spectrumColor,
    formatHz, formatDb, BAND_COLORS, EQ_MIN_HZ, EQ_MAX_HZ, EQ_DB_RANGE,
} from '../eqCurve';

describe('frequency axis', () => {
    it('puts the ends of the range at the ends of the display', () => {
        expect(freqToX(EQ_MIN_HZ, 800)).toBeCloseTo(0);
        expect(freqToX(EQ_MAX_HZ, 800)).toBeCloseTo(800);
    });

    it('is logarithmic, so each octave gets equal room', () => {
        // 100->200 and 5k->10k are both one octave and must span the same width.
        const lowOctave = freqToX(200, 1000) - freqToX(100, 1000);
        const highOctave = freqToX(10000, 1000) - freqToX(5000, 1000);
        expect(lowOctave).toBeCloseTo(highOctave, 5);
    });

    it('round-trips a position back to its frequency', () => {
        for (const hz of [20, 100, 440, 1000, 5000, 20000]) {
            expect(xToFreq(freqToX(hz, 900), 900)).toBeCloseTo(hz, 2);
        }
    });

    it('clamps rather than running off the display', () => {
        expect(freqToX(5, 800)).toBe(0);
        expect(freqToX(48000, 800)).toBeCloseTo(800);
        expect(xToFreq(-50, 800)).toBeCloseTo(EQ_MIN_HZ);
        expect(xToFreq(9999, 800)).toBeCloseTo(EQ_MAX_HZ);
    });
});

describe('gain axis', () => {
    it('puts flat in the middle', () => {
        expect(dbToY(0, 240)).toBe(120);
    });

    it('puts a boost above the middle and a cut below it', () => {
        expect(dbToY(EQ_DB_RANGE, 240)).toBe(0);
        expect(dbToY(-EQ_DB_RANGE, 240)).toBe(240);
    });

    it('round-trips a position back to its gain', () => {
        for (const db of [-18, -6, 0, 3.5, 12, 18]) {
            expect(yToDb(dbToY(db, 300), 300)).toBeCloseTo(db, 5);
        }
    });

    it('clamps beyond the display range', () => {
        expect(dbToY(40, 240)).toBe(0);
        expect(dbToY(-40, 240)).toBe(240);
    });

    it('says flat for a display with no height rather than dividing by zero', () => {
        expect(yToDb(10, 0)).toBe(0);
    });
});

describe('picking a band with the mouse', () => {
    const bands = [
        { frequency: 100, gain: 6, enabled: true },
        { frequency: 1000, gain: 0, enabled: true },
        { frequency: 8000, gain: -6, enabled: true },
    ];
    const W = 800;
    const H = 240;

    it('finds the node under the pointer', () => {
        const x = freqToX(1000, W);
        const y = dbToY(0, H);
        expect(bandAtPoint(bands, x, y, W, H)).toBe(1);
    });

    it('returns null when the pointer is on empty display', () => {
        expect(bandAtPoint(bands, 5, 5, W, H)).toBeNull();
    });

    it('picks the nearer of two candidates', () => {
        // Between bands 0 and 1, but closer to 0.
        const x = freqToX(100, W) + 4;
        const y = dbToY(6, H);
        expect(bandAtPoint(bands, x, y, W, H)).toBe(0);
    });

    it('measures in pixels, not in hertz', () => {
        // 100Hz and 1000Hz are 900 hertz apart but adjacent on a log display;
        // a hertz-based search would pick the wrong one near the middle.
        const x = freqToX(300, W);
        const y = dbToY(3, H);
        const picked = bandAtPoint(bands, x, y, W, H, 400);
        expect(picked).toBe(0);
    });
});

describe('display helpers', () => {
    it('writes frequencies the way an engineer says them', () => {
        expect(formatHz(65)).toBe('65Hz');
        expect(formatHz(1200)).toBe('1.2kHz');
        expect(formatHz(14000)).toBe('14kHz');
    });

    it('writes gains with their sign', () => {
        expect(formatDb(3.5)).toBe('+3.5dB');
        expect(formatDb(-1.8)).toBe('-1.8dB');
        expect(formatDb(0)).toBe('+0.0dB');
    });

    it('says so rather than printing NaN', () => {
        expect(formatHz(Number.NaN)).toBe('—');
        expect(formatDb(Number.NaN)).toBe('—');
    });

    it('tints the spectrum left to right across the band colours', () => {
        expect(spectrumColor(EQ_MIN_HZ)).toBe(BAND_COLORS[0]);
        expect(spectrumColor(EQ_MAX_HZ)).toBe(BAND_COLORS[BAND_COLORS.length - 1]);
        // And every frequency in between gets one of them.
        for (const hz of [50, 200, 800, 3000, 12000]) {
            expect(BAND_COLORS).toContain(spectrumColor(hz));
        }
    });
});
