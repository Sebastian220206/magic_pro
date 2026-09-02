/**
 * What every Session Player shares.
 *
 * The Drummer, the Bass Player and the Keyboard Player differ in what notes
 * they choose; they agree almost exactly on *when*. Complexity, Intensity,
 * Swing, Feel, Dynamics, Humanize, Fill Amount, Fill Complexity, Phrase
 * Variation and the Tempo mode behave identically across all three — the
 * manual says so outright ("settings common to all Session Players") — so they
 * live here rather than in three copies that drift apart.
 *
 * Pure arithmetic. No DOM, no store.
 */

/** How fast the rhythm is played against the project tempo. */
export type TempoMode = 'automatic' | 'standard' | 'half-time' | 'double-time';

/** The tempo these patterns are written around. */
export const SESSION_NATIVE_TEMPO = 110;

/**
 * A pattern typed in by hand, step by step, in Manual view.
 *
 * Rows are keyed by whatever the player calls its parts: kit pieces for the
 * Drummer, a single row for the Bass and Keyboard Players, which is what the
 * manual describes.
 */
export interface ManualPattern {
    /** Length in steps; 16 is one bar. */
    length: number;
    rows: Record<string, boolean[]>;
    /** Rows silenced without clearing them. */
    muted: Record<string, boolean>;
}

export const MANUAL_PAGE_STEPS = 16;

/** An empty grid of the given length for the named rows. */
export function emptyManualPattern(rows: readonly string[], length = MANUAL_PAGE_STEPS): ManualPattern {
    const grid: Record<string, boolean[]> = {};
    for (const row of rows) grid[row] = Array.from({ length }, () => false);
    return { length, rows: grid, muted: {} };
}

/** The settings every player has, whatever it plays. */
export interface SessionCommon {
    /** Which base pattern the rhythm is built on. 1-based, as the UI shows. */
    variation: number;
    /** 0..1 — how many of the optional subdivisions are played. */
    complexity: number;
    /** 0..1 — how hard, and how much of the part joins in. */
    intensity: number;
    /** 0..1 — how far every second subdivision is pushed late. */
    swing: number;
    swingGrid: '8th' | '16th';
    /** -1 (behind the beat) .. +1 (ahead of it). */
    feel: number;
    /** 0..1 — spread between the softest and hardest notes. */
    dynamics: number;
    /** 0..1 — how much the timing and velocity wander. */
    humanize: number;
    /** 0..1 — how often a phrase ends in a fill. */
    fillAmount: number;
    /** 0..1 — how busy those fills are. */
    fillComplexity: number;
    /** 0..1 — how much the pattern changes from bar to bar. */
    phraseVariation: number;
    tempoMode: TempoMode;
    /** A hand-typed pattern that replaces the generated one. */
    manual: ManualPattern | null;
    /** The track whose rhythm this player follows, if any. */
    followTrackId: string | null;
    /**
     * Place rhythmic emphasis where the chords change.
     *
     * On by default, as the manual has it. With no chords written anywhere it
     * has nothing to emphasise, which is why the switch dims rather than lies.
     */
    followChords: boolean;
    /** Fills and swing can be pinned so a change of preset leaves them alone. */
    lockFills: boolean;
    lockSwing: boolean;
    /** Anything that makes the same settings produce a different take. */
    seed: number;
}

export const DEFAULT_SESSION_COMMON: SessionCommon = {
    variation: 4,
    complexity: 0.5,
    intensity: 0.6,
    swing: 0,
    swingGrid: '16th',
    feel: 0,
    dynamics: 0.5,
    humanize: 0.2,
    fillAmount: 0.25,
    fillComplexity: 0.4,
    phraseVariation: 0.2,
    tempoMode: 'automatic',
    manual: null,
    followTrackId: null,
    followChords: true,
    lockFills: false,
    lockSwing: false,
    seed: 1,
};

/**
 * A step of a base pattern.
 *
 * `threshold` is what Complexity is compared against: a step plays when
 * `complexity >= threshold`. Encoding it this way makes the control monotonic —
 * turning Complexity up can only ever add notes, never move the ones already
 * there — which is both what a performance control should feel like and
 * something a test can state outright.
 */
export interface Step {
    /** 0..15, a sixteenth of the bar. */
    at: number;
    threshold: number;
    /** Relative loudness before dynamics and humanise. 0..1. */
    accent: number;
}

export const step = (at: number, threshold: number, accent: number): Step => ({ at, threshold, accent });

export const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/**
 * A small deterministic generator.
 *
 * `Math.random` would make every re-render a different take and every test
 * unwritable; this is seeded by the settings and the note's own position, so a
 * given note always wanders by the same amount.
 */
export function jitter(seed: number, salt: number): number {
    const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1; // -1..1
}

/** The steps of one row that survive the current Complexity. */
export function survivingSteps(steps: readonly Step[], complexity: number): Step[] {
    const c = clamp01(complexity);
    return steps.filter(s => c >= s.threshold);
}

/**
 * Where a sixteenth actually falls, once swing and feel are applied.
 *
 * Swing pushes every second subdivision later; feel shifts everything a little
 * early or late. Both are in beats.
 */
export function stepToBeats(
    at: number,
    { swing, swingGrid, feel }: Pick<SessionCommon, 'swing' | 'swingGrid' | 'feel'>,
): number {
    const beats = at / 4;
    const period = swingGrid === '8th' ? 2 : 1; // in sixteenths
    const isOffbeat = (at / period) % 2 >= 1;
    const swungBy = isOffbeat ? (clamp01(swing) * period * 0.5) / 4 : 0;
    /*
     * Feel: up is ahead of the beat, down is behind it.
     *
     * Ahead means *earlier*, so the sign is negated. Written without it, the
     * knob labelled Pull / Push moved the part the wrong way at both ends —
     * the drummer's own test had encoded the inversion as if it were correct.
     */
    const pushed = -(Number.isFinite(feel) ? Math.max(-1, Math.min(1, feel)) : 0) * 0.03;
    return beats + swungBy + pushed;
}

/** Velocity after dynamics, intensity and humanise. */
export function shapeVelocity(accent: number, settings: SessionCommon, salt: number): number {
    const intensity = clamp01(settings.intensity);
    const dynamics = clamp01(settings.dynamics);
    // Dynamics widens the gap between the accents and everything else; at 0
    // every note is the same weight, which is what a machine sounds like.
    const shaped = 1 - dynamics + accent * dynamics;
    const scaled = shaped * (0.35 + intensity * 0.65);
    const wander = jitter(settings.seed, salt) * clamp01(settings.humanize) * 0.15;
    return clamp01(scaled + wander);
}

/** How far a note's timing wanders under Humanize. */
export function timingWander(settings: SessionCommon, salt: number): number {
    return jitter(settings.seed, salt + 7.77) * clamp01(settings.humanize) * 0.02;
}

/**
 * How far the pattern drifts from bar to bar.
 *
 * Phrase Variation moves the Complexity threshold a little each bar, so a long
 * region does not repeat one bar verbatim — the manual's "amount of rhythmic
 * change over the course of several bars within a region".
 */
export function phraseDrift(settings: SessionCommon, bar: number): number {
    return jitter(settings.seed, bar * 3.14 + 1.5) * clamp01(settings.phraseVariation) * 0.35;
}

/**
 * What `automatic` resolves to at this tempo.
 *
 * The patterns are written around `SESSION_NATIVE_TEMPO`. Run the project far
 * above that and a player stops playing sixteenths and drops to half-time; far
 * below and they double up. Anything but `automatic` is taken literally.
 */
export function resolveTempoMode(mode: TempoMode, tempo: number): Exclude<TempoMode, 'automatic'> {
    if (mode !== 'automatic') return mode;
    if (!Number.isFinite(tempo) || tempo <= 0) return 'standard';
    if (tempo > SESSION_NATIVE_TEMPO * 1.5) return 'half-time';
    if (tempo < SESSION_NATIVE_TEMPO * 0.68) return 'double-time';
    return 'standard';
}

/** How many pattern bars fit in one project bar. */
export function tempoRate(mode: Exclude<TempoMode, 'automatic'>): number {
    return mode === 'half-time' ? 0.5 : mode === 'double-time' ? 2 : 1;
}

/**
 * The steps another track's notes fall on.
 *
 * "Follow Rhythm Of / Track": the onsets are quantised to sixteenths and become
 * accents the player places itself on, which is how one part locks to another
 * rather than playing over it.
 */
export function onsetsToSteps(
    onsets: readonly number[],
    { beatsPerBar, bars }: { beatsPerBar: number; bars: number },
): Set<number> {
    const steps = new Set<number>();
    const total = Math.max(1, Math.round(bars * beatsPerBar * 4));
    for (const beat of onsets) {
        if (!Number.isFinite(beat) || beat < 0) continue;
        const s = Math.round(beat * 4);
        if (s >= total) continue;
        steps.add(s);
    }
    return steps;
}

/**
 * Whether the bar ending at `bar` carries a fill.
 *
 * Fills fall at the end of phrases: every four bars at low amounts, every two
 * at medium, every bar at the top. The last bar of a region never fills —
 * there is nothing to land on.
 */
export function barHasFill(bar: number, settings: SessionCommon, bars: number): boolean {
    const amount = clamp01(settings.fillAmount);
    if (amount <= 0) return false;
    if (bar >= bars - 1) return false;
    const every = amount >= 0.8 ? 1 : amount >= 0.45 ? 2 : 4;
    return (bar + 1) % every === 0;
}

/**
 * Eight rhythms for the pitched players, matching the eight rows the Patterns
 * dialog shows.
 *
 * The low-threshold steps are the skeleton that survives at Complexity 0; the
 * higher ones fill in as it comes up.
 */
export const RHYTHM_PATTERNS: ReadonlyArray<readonly Step[]> = [
    // 1 — whole notes: one chord, held
    [step(0, 0, 1)],
    // 2 — half notes
    [step(0, 0, 1), step(8, 0, 0.85)],
    // 3 — straight quarters
    [step(0, 0, 1), step(4, 0.15, 0.7), step(8, 0, 0.85), step(12, 0.15, 0.7)],
    // 4 — the default: quarters with a pushed eighth
    [step(0, 0, 1), step(4, 0.2, 0.7), step(6, 0.55, 0.55), step(8, 0, 0.85),
    step(12, 0.2, 0.7), step(14, 0.6, 0.5)],
    // 5 — eighths
    [step(0, 0, 1), step(2, 0.25, 0.55), step(4, 0.1, 0.75), step(6, 0.25, 0.55),
    step(8, 0, 0.85), step(10, 0.25, 0.55), step(12, 0.1, 0.75), step(14, 0.25, 0.55)],
    // 6 — syncopated, leans off the beat
    [step(0, 0, 1), step(3, 0.3, 0.6), step(6, 0.2, 0.7), step(8, 0, 0.85),
    step(11, 0.35, 0.6), step(14, 0.25, 0.65)],
    // 7 — shuffle, leans on the swing control
    [step(0, 0, 1), step(3, 0.25, 0.6), step(4, 0.15, 0.75), step(7, 0.35, 0.55),
    step(8, 0, 0.85), step(11, 0.25, 0.6), step(12, 0.15, 0.75), step(15, 0.35, 0.55)],
    // 8 — sixteenths, the busiest of the eight
    [step(0, 0, 1), step(1, 0.7, 0.4), step(2, 0.2, 0.6), step(3, 0.7, 0.4),
    step(4, 0.05, 0.8), step(5, 0.7, 0.4), step(6, 0.2, 0.6), step(7, 0.7, 0.4),
    step(8, 0, 0.9), step(9, 0.7, 0.4), step(10, 0.2, 0.6), step(11, 0.7, 0.4),
    step(12, 0.05, 0.8), step(13, 0.7, 0.4), step(14, 0.2, 0.6), step(15, 0.7, 0.4)],
];

export const RHYTHM_PATTERN_COUNT = RHYTHM_PATTERNS.length;

/** A pattern number as the UI shows it (1-based), clamped to what exists. */
export function rhythmIndex(variation: number): number {
    return Math.min(RHYTHM_PATTERNS.length, Math.max(1, Math.round(variation || 1))) - 1;
}

/** The row of dots the Patterns dialog draws for one pattern. */
export function rhythmPreview(variation: number, complexity: number): boolean[] {
    const on = new Set(survivingSteps(RHYTHM_PATTERNS[rhythmIndex(variation)], complexity).map(s => s.at));
    return Array.from({ length: 16 }, (_, i) => on.has(i));
}

/** A note any pitched Session Player produces. */
export interface SessionNote {
    pitch: number;
    /** Beats from the start of the region. */
    start: number;
    /** Length in beats. */
    duration: number;
    /** 0..1. */
    velocity: number;
}
