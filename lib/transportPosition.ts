/**
 * Where the playhead is, in the units a transport display shows.
 *
 * This existed twice, wrongly, in two components:
 *
 *   `TransportBar.formatTime` hard-coded `Math.floor(beats / 4) + 1` for the
 *   bar. The LCD is itself where the time signature is chosen, so setting 3/4
 *   left the readout beside the control counting in 4 — the ruler, the piano
 *   roll and the metronome all disagreed with the number in the transport bar.
 *
 *   `GiantDisplay.formatTime` hard-coded the tempo: `(beats / 120) * 60`, with
 *   the comment "Mocking time for display". The Giant Time window was wrong for
 *   every project not at 120 BPM.
 *
 * One definition now, with tests, so the two displays cannot drift again.
 */

import {
    MTC_FRAME_RATES,
    secondsToTimecode,
    timecodeToString,
    type MTCFrameRate,
} from '@/engine/midi/syncTypes';

/** Ticks in a beat. Matches the 1/960 grid resolution used for snapping. */
export const TICKS_PER_BEAT = 960;

/** A division is a sixteenth note: four to the beat. */
export const DIVISIONS_PER_BEAT = 4;

/** 960 / 4 — the `* 240` that was inlined in both copies of the old helper. */
export const TICKS_PER_DIVISION = TICKS_PER_BEAT / DIVISIONS_PER_BEAT;

/** How far one pixel of horizontal drag moves the playhead. */
export const SCRUB_PIXELS_PER_BEAT = 8;

/** Tempo range, taken from the numeric input the LCD already offered. */
export const MIN_TEMPO = 20;
export const MAX_TEMPO = 300;

/** A point on the project's tempo track. Structurally the store's own shape. */
export interface TempoPoint {
    time: number;
    value: number | string;
    type?: 'jump' | 'ramp' | string;
}

/**
 * Beats in a bar, from a "4/4" style string.
 *
 * The numerator, deliberately — not `numerator * 4 / denominator`.
 *
 * This whole codebase treats a beat as a quarter note and a bar as `numerator`
 * of them: `Timeline.tsx`, `ListEditors.tsx`, `PianoRoll.tsx` and the store's
 * own recording path all derive it that way, and `metronome.ts` clicks
 * `bars * numerator` times at `60 / tempo` seconds apiece. So 6/8 is six
 * quarter notes here.
 *
 * That convention is arguably wrong, but it is consistent, and making this one
 * function "correct" in isolation would put the LCD out of step with the ruler
 * two pixels above it — a visible bug traded for an invisible one. Changing the
 * unit is a whole-app job and belongs in its own piece of work.
 */
export function beatsPerBar(timeSignature: string | undefined | null): number {
    const numerator = Number(String(timeSignature ?? '').split('/')[0]);
    return Number.isFinite(numerator) && numerator > 0 ? Math.floor(numerator) : 4;
}

/** Bar, beat and division are 1-based, the way a musician counts. Tick is 0-based. */
export interface BarBeatDivTick {
    bar: number;
    beat: number;
    division: number;
    tick: number;
}

export function barBeatDivTick(beats: number, perBar: number): BarBeatDivTick {
    const bpb = perBar > 0 ? perBar : 4;
    // Before the transport has moved, and anywhere behind the start of the
    // project, the honest answer is the first tick of the first bar.
    if (!Number.isFinite(beats) || beats < 0) {
        return { bar: 1, beat: 1, division: 1, tick: 0 };
    }

    const bar = Math.floor(beats / bpb) + 1;
    const beat = Math.floor(beats % bpb) + 1;
    const withinBeat = beats % 1;
    const division = Math.floor(withinBeat * DIVISIONS_PER_BEAT) + 1;
    const tick = Math.floor(((withinBeat * DIVISIONS_PER_BEAT) % 1) * TICKS_PER_DIVISION);

    return { bar, beat, division, tick };
}

export interface FormattedPosition {
    bar: string;
    beat: string;
    div: string;
    tick: string;
}

export function formatPosition(
    beats: number,
    { beatsPerBar: perBar, barDigits = 0 }: { beatsPerBar: number; barDigits?: number },
): FormattedPosition {
    const { bar, beat, division, tick } = barBeatDivTick(beats, perBar);
    return {
        bar: String(bar).padStart(barDigits, '0'),
        beat: String(beat),
        div: String(division),
        tick: String(tick).padStart(3, '0'),
    };
}

/** Seconds for a number of beats at one fixed tempo. */
export function beatsToSeconds(beats: number, tempoBpm: number): number {
    if (!Number.isFinite(beats) || beats <= 0) return 0;
    const bpm = Number.isFinite(tempoBpm) && tempoBpm > 0 ? tempoBpm : 120;
    return (beats / bpm) * 60;
}

/**
 * Seconds for a number of beats across the project's tempo track.
 *
 * A project with a tempo change had a wrong clock even after the hard-coded
 * 120 came out: the readout used the single top-level `tempo`, while playback
 * reads the point list. Integrated piecewise so the two agree.
 */
export function beatsToSecondsWithTempoMap(
    beats: number,
    points: TempoPoint[] | undefined,
): number {
    if (!Number.isFinite(beats) || beats <= 0) return 0;

    const sorted = (points ?? [])
        .map(p => ({ time: Number(p.time), value: Number(p.value) }))
        .filter(p => Number.isFinite(p.time) && Number.isFinite(p.value) && p.value > 0)
        .sort((a, b) => a.time - b.time);

    if (sorted.length === 0) return beatsToSeconds(beats, 120);

    let seconds = 0;
    let cursor = 0;
    // Anything before the first point runs at the first point's tempo.
    let tempo = sorted[0].value;

    for (const point of sorted) {
        if (point.time >= beats) break;
        const from = Math.max(cursor, 0);
        if (point.time > from) {
            seconds += ((point.time - from) / tempo) * 60;
            cursor = point.time;
        }
        tempo = point.value;
    }

    seconds += ((beats - cursor) / tempo) * 60;
    return seconds;
}

export interface FormattedClock {
    hours: string;
    mins: string;
    secs: string;
    ms: string;
}

export function formatClock(seconds: number): FormattedClock {
    const total = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
    return {
        hours: String(Math.floor(total / 3600)).padStart(2, '0'),
        mins: String(Math.floor(total / 60) % 60).padStart(2, '0'),
        secs: String(Math.floor(total % 60)).padStart(2, '0'),
        ms: String(Math.floor((total % 1) * 1000)).padStart(3, '0'),
    };
}

/**
 * The nearest frame rate the timecode machinery actually supports.
 *
 * `settings.frameRate` is typed `number` and Project Settings renders it as a
 * free numeric input, so a project can hold 60 — and `MTC_FRAME_RATES[60]` is
 * undefined, which makes `secondsToTimecode` throw on `.framesPerSecond`.
 */
export function normalizeFrameRate(value: number | undefined | null): MTCFrameRate {
    const rates: MTCFrameRate[] = [24, 25, 29.97, 30];
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 25;
    return rates.reduce(
        (best, rate) => (Math.abs(rate - n) < Math.abs(best - n) ? rate : best),
        rates[0],
    );
}

/** "01:01:01:12" for a position in seconds. */
export function formatTimecode(seconds: number, frameRate: number): string {
    const rate = normalizeFrameRate(frameRate);
    const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
    return timecodeToString(secondsToTimecode(safe, rate));
}

/** "25 fps", for the label beside a timecode readout. */
export function frameRateLabel(frameRate: number): string {
    return MTC_FRAME_RATES[normalizeFrameRate(frameRate)].name;
}

/**
 * Where a drag from `startBeats` lands.
 *
 * Kept out of the mouse handler so the arithmetic can be tested without a
 * browser: shift for fine control, alt to land on bar lines.
 */
export function scrubBeats(
    startBeats: number,
    deltaX: number,
    { fine = false, snapBars = false, beatsPerBar: perBar = 4 } = {},
): number {
    const ratio = SCRUB_PIXELS_PER_BEAT * (fine ? 4 : 1);
    const moved = (Number.isFinite(deltaX) ? deltaX : 0) / ratio;
    const next = Math.max(0, (Number.isFinite(startBeats) ? startBeats : 0) + moved);
    if (!snapBars) return next;
    const bpb = perBar > 0 ? perBar : 4;
    return Math.max(0, Math.round(next / bpb) * bpb);
}

/**
 * A tempo inside the range the control claims to accept.
 *
 * The LCD's own input carried `min={20} max={300}` and then committed anything
 * `>= 1`, so typing 5 set a tempo the field said was out of range.
 */
export function clampTempo(value: number, fallback = 120): number {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, Math.round(value)));
}
