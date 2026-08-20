/**
 * Channel-strip level arithmetic.
 *
 * The mixer had a fader and two meters and not one number: no dB value, no
 * peak readout, no clipping indicator, and no way to type a level in. These
 * pin the conversions those readouts are built on.
 */

import {
    gainToDb, dbToGain, formatDb, faderDbLabel, parseDb, clampGain,
    levelBand, initialPeak, updatePeak, formatPan, parsePan,
    MAX_GAIN, SILENCE_DB, CLIP_DB, HOT_DB,
} from '../mixerLevel';

describe('gain and decibels', () => {
    it('puts unity at 0 dB', () => {
        expect(gainToDb(1)).toBeCloseTo(0, 10);
        expect(dbToGain(0)).toBeCloseTo(1, 10);
    });

    it('halving the gain is about -6 dB', () => {
        expect(gainToDb(0.5)).toBeCloseTo(-6.02, 2);
        expect(dbToGain(-6.02)).toBeCloseTo(0.5, 3);
    });

    it('round-trips', () => {
        for (const gain of [0.05, 0.25, 0.5, 0.8, 1, 1.2]) {
            expect(dbToGain(gainToDb(gain))).toBeCloseTo(gain, 6);
        }
    });

    it('treats zero and negative gain as silence', () => {
        expect(gainToDb(0)).toBe(-Infinity);
        expect(gainToDb(-1)).toBe(-Infinity);
    });
});

describe('writing a level', () => {
    it('always shows the sign, so a boost cannot read as a cut', () => {
        expect(formatDb(2)).toBe('+2.0');
        expect(formatDb(-2)).toBe('-2.0');
    });

    it('shows silence as a symbol, not a huge negative number', () => {
        expect(formatDb(-Infinity)).toBe('-∞');
        expect(formatDb(SILENCE_DB - 1)).toBe('-∞');
    });

    it('never prints negative zero', () => {
        expect(formatDb(-0.001)).toBe('0.0');
        expect(formatDb(0)).toBe('0.0');
    });

    it('labels a fader straight from its gain', () => {
        expect(faderDbLabel(1)).toBe('0.0');
        expect(faderDbLabel(0)).toBe('-∞');
    });
});

describe('typing a level', () => {
    it.each([
        ['-6', -6],
        ['-6.0 dB', -6],
        ['+2', 2],
        ['0', 0],
        ['  3.5  ', 3.5],
    ])('reads %s', (input, expected) => {
        expect(parseDb(input)).toBe(expected);
    });

    it('accepts silence written out', () => {
        expect(parseDb('-inf')).toBe(-Infinity);
        expect(parseDb('-∞')).toBe(-Infinity);
    });

    it('returns null for nonsense, so the fader is left alone', () => {
        // Jumping to zero because someone fat-fingered a letter would be worse
        // than ignoring the edit.
        expect(parseDb('')).toBeNull();
        expect(parseDb('loud')).toBeNull();
        expect(parseDb('--3')).toBeNull();
    });

    it('clamps a typed value to what the fader can reach', () => {
        expect(clampGain(dbToGain(20))).toBe(MAX_GAIN);
        expect(clampGain(-5)).toBe(0);
        expect(clampGain(dbToGain(-Infinity))).toBe(0);
    });
});

describe('level bands', () => {
    it('calls 0 dB and above clipping', () => {
        expect(levelBand(CLIP_DB)).toBe('clip');
        expect(levelBand(3)).toBe('clip');
    });

    it('calls the last few dB hot but not clipping', () => {
        expect(levelBand(HOT_DB)).toBe('hot');
        expect(levelBand(-1)).toBe('hot');
    });

    it('calls everything below that safe', () => {
        expect(levelBand(-12)).toBe('safe');
        expect(levelBand(-Infinity)).toBe('safe');
    });
});

describe('peak hold', () => {
    it('keeps the loudest reading', () => {
        let peak = initialPeak;
        for (const db of [-20, -8, -14, -3, -30]) peak = updatePeak(peak, db);
        expect(peak.peakDb).toBe(-3);
    });

    it('latches a single overload', () => {
        let peak = updatePeak(initialPeak, 0.5);
        // One clip during a take is exactly what the indicator is for; a flag
        // that followed the current level would hide it a frame later.
        peak = updatePeak(peak, -40);
        expect(peak.clipped).toBe(true);
        expect(peak.peakDb).toBeCloseTo(0.5, 6);
    });

    it('does not latch below 0 dB', () => {
        const peak = updatePeak(initialPeak, -0.1);
        expect(peak.clipped).toBe(false);
    });

    it('ignores a non-finite reading', () => {
        expect(updatePeak(initialPeak, -Infinity)).toBe(initialPeak);
        expect(updatePeak(initialPeak, NaN)).toBe(initialPeak);
    });

    it('returns the same object when nothing changed, so React can skip', () => {
        const peak = updatePeak(initialPeak, -10);
        expect(updatePeak(peak, -20)).toBe(peak);
    });
});

describe('pan', () => {
    it('writes centre as C and the sides as L/R', () => {
        expect(formatPan(0)).toBe('C');
        expect(formatPan(-0.5)).toBe('L32');
        expect(formatPan(0.5)).toBe('R32');
    });

    it('treats a hair off centre as centre', () => {
        expect(formatPan(0.001)).toBe('C');
    });

    it('does not print R64, which the field would reject', () => {
        expect(formatPan(1)).toBe('R63');
    });

    it.each([
        ['C', 0],
        ['L32', -0.5],
        ['R32', 0.5],
        ['-32', -0.5],
        ['32', 0.5],
    ])('reads %s', (input, expected) => {
        expect(parsePan(input)).toBeCloseTo(expected, 6);
    });

    it('clamps a typed pan to the hard edges', () => {
        expect(parsePan('L200')).toBe(-1);
        expect(parsePan('R200')).toBe(1);
    });

    it('returns null for nonsense', () => {
        expect(parsePan('hard left')).toBeNull();
        expect(parsePan('')).toBeNull();
    });
});
