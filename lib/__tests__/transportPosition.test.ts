import {
    beatsPerBar,
    barBeatDivTick,
    formatPosition,
    beatsToSeconds,
    beatsToSecondsWithTempoMap,
    formatClock,
    normalizeFrameRate,
    formatTimecode,
    frameRateLabel,
    scrubBeats,
    clampTempo,
    DIVISIONS_PER_BEAT,
    TICKS_PER_DIVISION,
} from '@/lib/transportPosition';
import { secondsToTimecode, timecodeToSeconds } from '@/engine/midi/syncTypes';

/**
 * The transport display counted in 4/4 whatever the project was.
 *
 * `TransportBar.formatTime` did `Math.floor(beats / 4) + 1`, and the LCD is
 * itself where the time signature is set — so choosing 3/4 left the number
 * beside that control disagreeing with the ruler, the piano roll and the click.
 */
describe('bars and beats follow the time signature', () => {
    it('reads the numerator', () => {
        expect(beatsPerBar('4/4')).toBe(4);
        expect(beatsPerBar('3/4')).toBe(3);
        expect(beatsPerBar('7/8')).toBe(7);
        expect(beatsPerBar('12/8')).toBe(12);
    });

    it('falls back to four on anything unusable', () => {
        expect(beatsPerBar('')).toBe(4);
        expect(beatsPerBar('garbage')).toBe(4);
        expect(beatsPerBar(undefined)).toBe(4);
        expect(beatsPerBar(null)).toBe(4);
        expect(beatsPerBar('0/4')).toBe(4);
    });

    /** The headline case. Hard-coding 4 here gives bar 2 beat 3. */
    it('puts beat 6 of a 3/4 project at bar 3, beat 1', () => {
        expect(barBeatDivTick(6, 3)).toEqual({ bar: 3, beat: 1, division: 1, tick: 0 });
    });

    it('and at bar 2, beat 3 in 4/4 — the two must differ', () => {
        expect(barBeatDivTick(6, 4)).toEqual({ bar: 2, beat: 3, division: 1, tick: 0 });
    });

    it('starts at one one one, not zero', () => {
        expect(barBeatDivTick(0, 4)).toEqual({ bar: 1, beat: 1, division: 1, tick: 0 });
    });

    it('clamps a playhead behind the start rather than showing bar 0', () => {
        expect(barBeatDivTick(-3, 4)).toEqual({ bar: 1, beat: 1, division: 1, tick: 0 });
        expect(barBeatDivTick(NaN, 4)).toEqual({ bar: 1, beat: 1, division: 1, tick: 0 });
    });

    it('splits the beat into divisions and ticks', () => {
        expect(barBeatDivTick(0.5, 4).division).toBe(DIVISIONS_PER_BEAT / 2 + 1);
        expect(barBeatDivTick(0.5, 4).tick).toBe(0);
        const off = barBeatDivTick(0.3, 4);
        expect(off.tick).toBeGreaterThan(0);
        expect(off.tick).toBeLessThan(TICKS_PER_DIVISION);
    });

    it('pads the way a display expects', () => {
        expect(formatPosition(0, { beatsPerBar: 4 })).toEqual({
            bar: '1', beat: '1', div: '1', tick: '000',
        });
        // GiantDisplay pads the bar to four digits for its seven-segment look.
        expect(formatPosition(0, { beatsPerBar: 4, barDigits: 4 }).bar).toBe('0001');
    });
});

/**
 * The Giant Time window hard-coded 120 BPM.
 *
 * `const totalSeconds = (beats / 120) * 60`, with the comment "Mocking time for
 * display" — so it was wrong for every project not at 120.
 */
describe('the clock follows the tempo', () => {
    it('four beats at 120 is two seconds', () => {
        expect(beatsToSeconds(4, 120)).toBe(2);
    });

    /** Hard-coding 120 makes this return 2. */
    it('four beats at 60 is four seconds', () => {
        expect(beatsToSeconds(4, 60)).toBe(4);
    });

    it('refuses to divide by a nonsense tempo', () => {
        expect(beatsToSeconds(4, 0)).toBe(2);
        expect(beatsToSeconds(4, NaN)).toBe(2);
        expect(beatsToSeconds(-1, 120)).toBe(0);
    });

    it('integrates across a tempo change', () => {
        // Four beats at 120 (2s), then four at 60 (4s).
        const points = [{ time: 0, value: 120 }, { time: 4, value: 60 }];
        expect(beatsToSecondsWithTempoMap(8, points)).toBeCloseTo(6, 6);
    });

    it('agrees with the fixed-tempo form when there is one point', () => {
        expect(beatsToSecondsWithTempoMap(8, [{ time: 0, value: 90 }]))
            .toBeCloseTo(beatsToSeconds(8, 90), 6);
    });

    it('takes points out of order and ignores broken ones', () => {
        const messy = [
            { time: 4, value: 60 },
            { time: 0, value: 120 },
            { time: 2, value: NaN },
            { time: 6, value: 0 },
        ];
        expect(beatsToSecondsWithTempoMap(8, messy)).toBeCloseTo(6, 6);
    });

    it('falls back to 120 with no tempo track at all', () => {
        expect(beatsToSecondsWithTempoMap(4, [])).toBe(2);
        expect(beatsToSecondsWithTempoMap(4, undefined)).toBe(2);
    });

    it('formats hours, minutes, seconds and milliseconds', () => {
        expect(formatClock(3661.5)).toEqual({
            hours: '01', mins: '01', secs: '01', ms: '500',
        });
        expect(formatClock(0)).toEqual({ hours: '00', mins: '00', secs: '00', ms: '000' });
        expect(formatClock(-5).secs).toBe('00');
    });
});

/**
 * Timecode.
 *
 * `settings.frameRate` is a free numeric input, so a project can hold 60 —
 * and `MTC_FRAME_RATES[60]` is undefined, which throws.
 */
describe('timecode', () => {
    it('snaps an arbitrary frame rate to one the app supports', () => {
        expect(normalizeFrameRate(60)).toBe(30);
        expect(normalizeFrameRate(29.97)).toBe(29.97);
        expect(normalizeFrameRate(23.976)).toBe(24);
        expect(normalizeFrameRate(0)).toBe(25);
        expect(normalizeFrameRate(NaN)).toBe(25);
        expect(normalizeFrameRate(undefined)).toBe(25);
    });

    it('does not throw on a frame rate no one supports', () => {
        expect(() => formatTimecode(10, 60)).not.toThrow();
        expect(formatTimecode(10, 60)).toMatch(/^\d{2}:\d{2}:\d{2}:\d{2}$/);
    });

    it('formats a known position', () => {
        expect(formatTimecode(3661.5, 25)).toBe('01:01:01:12');
    });

    /**
     * 29.97 counts thirty frames a second, 0-29. `% Math.floor(29.97)` rolled
     * at 29, so frame 29 never appeared and the count skipped once a second.
     */
    it('reaches frame 29 at 29.97 and rolls over at 30', () => {
        const nearlyOneSecond = secondsToTimecode(29.5 / 29.97, 29.97);
        expect(nearlyOneSecond.frames).toBe(29);
        const justPast = secondsToTimecode(30 / 29.97, 29.97);
        expect(justPast.frames).toBe(0);
        expect(justPast.seconds).toBe(1);
    });

    it('round-trips within a frame at the whole-number rates', () => {
        for (const rate of [24, 25, 30] as const) {
            const seconds = 137.4;
            const back = timecodeToSeconds(secondsToTimecode(seconds, rate));
            expect(Math.abs(back - seconds)).toBeLessThan(1 / rate);
        }
    });

    /**
     * 29.97 drifts, and that is not a bug in the formatting.
     *
     * `MTC_FRAME_RATES[29.97]` declares `dropFrame: true`, but nothing in
     * `syncTypes` implements drop-frame compensation — no frame numbers are
     * skipped at minute boundaries. So a 29.97 timecode runs about 0.1% fast
     * against the wall clock and the round trip loses roughly a frame every
     * thirty seconds. Asserted here rather than hidden, so the drift is a
     * recorded limitation instead of a surprise: implementing real drop-frame
     * means changing what `mtcSync` transmits, which is its own piece of work.
     */
    it('drifts at 29.97, because drop-frame is declared but not implemented', () => {
        const seconds = 137.4;
        const back = timecodeToSeconds(secondsToTimecode(seconds, 29.97));
        const drift = Math.abs(back - seconds);
        expect(drift).toBeGreaterThan(1 / 29.97);
        expect(drift).toBeLessThan(1);
    });

    it('names the rate for the display label', () => {
        expect(frameRateLabel(25)).toBe('25 fps');
        expect(frameRateLabel(60)).toBe('30 fps');
    });
});

describe('scrubbing and the tempo range', () => {
    it('moves a beat for every eight pixels', () => {
        expect(scrubBeats(10, 80)).toBeCloseTo(20, 6);
    });

    it('moves a quarter as far when held fine', () => {
        expect(scrubBeats(10, 80, { fine: true })).toBeCloseTo(12.5, 6);
    });

    it('never goes behind the start of the project', () => {
        expect(scrubBeats(0, -400)).toBe(0);
        expect(scrubBeats(2, -400)).toBe(0);
    });

    it('lands on bar lines when snapping', () => {
        expect(scrubBeats(0, 80, { snapBars: true, beatsPerBar: 3 }) % 3).toBe(0);
        expect(scrubBeats(0, 200, { snapBars: true, beatsPerBar: 4 }) % 4).toBe(0);
    });

    it('survives a nonsense delta', () => {
        expect(scrubBeats(5, NaN)).toBe(5);
    });

    /** The input said min 20 max 300 and then committed anything >= 1. */
    it('holds the tempo inside the range the control advertises', () => {
        expect(clampTempo(500)).toBe(300);
        expect(clampTempo(1)).toBe(20);
        expect(clampTempo(128.4)).toBe(128);
        expect(clampTempo(NaN, 90)).toBe(90);
    });
});
