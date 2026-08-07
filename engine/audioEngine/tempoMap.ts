/**
 * tempoMap.ts
 * Beat <-> seconds conversion across a tempo track.
 *
 * The scheduler previously held a single scalar BPM, so a project's tempo track
 * could change the *displayed* tempo but had no effect on when audio or MIDI was
 * actually scheduled. Everything downstream of playback assumed one constant
 * tempo for the whole timeline.
 *
 * This module integrates tempo over beats so both conversions stay exact across
 * jumps and ramps. It is deliberately dependency-free so the arithmetic can be
 * tested directly.
 */

export interface TempoPoint {
    /** Position on the timeline, in beats. */
    time: number;
    /** Beats per minute from this point onward. */
    value: number;
    /**
     * `jump` holds the tempo until the next point (a step change).
     * `ramp` interpolates linearly in BPM towards the next point.
     */
    type?: 'jump' | 'ramp';
}

export const DEFAULT_TEMPO = 120;

const MIN_TEMPO = 1;
const MAX_TEMPO = 1000;

const clampTempo = (bpm: number) =>
    Number.isFinite(bpm) ? Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, bpm)) : DEFAULT_TEMPO;

/**
 * A normalised, sorted tempo track with cumulative time at each point, so
 * lookups are a binary search plus one segment integration rather than a walk
 * from the start of the timeline.
 */
export class TempoMap {
    private readonly points: Required<TempoPoint>[];
    /** Seconds elapsed at the start of each point, from beat 0. */
    private readonly secondsAt: number[];

    constructor(points: TempoPoint[] = []) {
        const cleaned = points
            .filter(p => p && Number.isFinite(p.time) && Number.isFinite(Number(p.value)))
            .map(p => ({
                time: Math.max(0, p.time),
                value: clampTempo(Number(p.value)),
                type: p.type === 'ramp' ? ('ramp' as const) : ('jump' as const),
            }))
            .sort((a, b) => a.time - b.time);

        // The timeline must have a tempo from beat 0 onward.
        if (cleaned.length === 0 || cleaned[0].time > 0) {
            cleaned.unshift({
                time: 0,
                value: cleaned[0]?.value ?? DEFAULT_TEMPO,
                type: 'jump',
            });
        }

        // Collapse duplicate positions, keeping the last definition.
        this.points = cleaned.filter(
            (p, i) => i === cleaned.length - 1 || p.time !== cleaned[i + 1].time,
        );

        this.secondsAt = new Array(this.points.length);
        this.secondsAt[0] = 0;
        for (let i = 1; i < this.points.length; i++) {
            const prev = this.points[i - 1];
            const beats = this.points[i].time - prev.time;
            this.secondsAt[i] = this.secondsAt[i - 1] +
                segmentSeconds(beats, prev.value, this.tempoEnteringSegment(i - 1));
        }
    }

    /** BPM at the end of segment `i` — equal to its own tempo unless it ramps. */
    private tempoEnteringSegment(i: number): number {
        const point = this.points[i];
        const next = this.points[i + 1];
        return point.type === 'ramp' && next ? next.value : point.value;
    }

    /** Index of the segment containing `beat`. */
    private segmentAtBeat(beat: number): number {
        let lo = 0;
        let hi = this.points.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (this.points[mid].time <= beat) lo = mid;
            else hi = mid - 1;
        }
        return lo;
    }

    /** Index of the segment containing `seconds`. */
    private segmentAtSeconds(seconds: number): number {
        let lo = 0;
        let hi = this.secondsAt.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (this.secondsAt[mid] <= seconds) lo = mid;
            else hi = mid - 1;
        }
        return lo;
    }

    /** Instantaneous tempo at a beat position. */
    tempoAt(beat: number): number {
        const position = Math.max(0, beat);
        const i = this.segmentAtBeat(position);
        const point = this.points[i];
        const next = this.points[i + 1];

        if (point.type !== 'ramp' || !next) return point.value;

        const span = next.time - point.time;
        if (span <= 0) return next.value;
        const t = (position - point.time) / span;
        return point.value + (next.value - point.value) * t;
    }

    /** Seconds elapsed from beat 0 to `beat`. */
    beatToSeconds(beat: number): number {
        if (!Number.isFinite(beat)) return 0;
        const position = Math.max(0, beat);
        const i = this.segmentAtBeat(position);
        const point = this.points[i];

        return this.secondsAt[i] + segmentSeconds(
            position - point.time,
            point.value,
            this.tempoAt(position),
        );
    }

    /** Beat reached after `seconds` from beat 0. */
    secondsToBeat(seconds: number): number {
        if (!Number.isFinite(seconds) || seconds <= 0) return 0;
        const i = this.segmentAtSeconds(seconds);
        const point = this.points[i];
        const elapsed = seconds - this.secondsAt[i];
        const endTempo = this.tempoEnteringSegment(i);
        const next = this.points[i + 1];
        const segmentBeats = next ? next.time - point.time : Infinity;

        return point.time + segmentBeats_forSeconds(elapsed, point.value, endTempo, segmentBeats);
    }

    /** The normalised points backing this map. */
    getPoints(): Required<TempoPoint>[] {
        return this.points;
    }

    /** True when the whole timeline runs at one tempo. */
    isConstant(): boolean {
        return this.points.length === 1;
    }
}

/**
 * Seconds taken to travel `beats` while tempo moves linearly from
 * `startTempo` to `endTempo`.
 *
 * At constant tempo this is beats / bpm * 60. For a linear ramp the exact
 * integral of 60/bpm(b) db is 60 * beats * ln(end/start) / (end - start).
 */
function segmentSeconds(beats: number, startTempo: number, endTempo: number): number {
    if (beats <= 0) return 0;
    if (Math.abs(endTempo - startTempo) < 1e-9) {
        return (beats / startTempo) * 60;
    }
    return (60 * beats * Math.log(endTempo / startTempo)) / (endTempo - startTempo);
}

/**
 * Inverse of `segmentSeconds`: beats travelled in `seconds`, given a segment
 * that ramps from `startTempo` to `endTempo` over `segmentBeats`.
 */
function segmentBeats_forSeconds(
    seconds: number,
    startTempo: number,
    endTempo: number,
    segmentBeats: number,
): number {
    if (seconds <= 0) return 0;

    if (!Number.isFinite(segmentBeats) || Math.abs(endTempo - startTempo) < 1e-9) {
        return (seconds / 60) * startTempo;
    }

    // Invert s(b) = 60*B*ln(r)/(Δ) evaluated with tempo(b) = start + Δ*b/B.
    const delta = endTempo - startTempo;
    const k = delta / segmentBeats;
    return (startTempo / k) * (Math.exp((k * seconds) / 60) - 1);
}
