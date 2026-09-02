/**
 * The Session Player's drummer, as pure arithmetic.
 *
 * A `drummer` track was a track *type* and nothing else: the scheduler treated
 * it as a plain instrument, and the only drummer regions in the app had their
 * notes written out by hand in the templates. So a panel of knobs on top of it
 * would have been fifteen controls that turned and changed nothing.
 *
 * This is what they turn. Given the settings the panel shows, it produces the
 * notes for a region — at General MIDI drum pitches, which the `DrumMachine`
 * in `engine/instruments/drumMachine.ts` already maps to samples.
 *
 * Deterministic on purpose. The same settings and the same seed give the same
 * bar every time, so nudging Complexity does not reshuffle everything else,
 * and a test can assert an exact note list.
 */

/** General MIDI drum pitches, named. */
export const DRUM = {
    kick: 36,
    snare: 38,
    sideStick: 37,
    closedHat: 42,
    pedalHat: 44,
    openHat: 46,
    ride: 51,
    rideBell: 53,
    crash: 49,
    lowTom: 45,
    midTom: 47,
    highTom: 50,
    tambourine: 54,
    shaker: 70,
    cowbell: 56,
    splash: 55,
    china: 52,
} as const;

export type DrumPiece = 'kick' | 'snare' | 'hat' | 'ride' | 'toms' | 'percussion';

/**
 * How fast the rhythm is played against the project tempo.
 *
 * `automatic` is the manual's behaviour: the player drops to half-time when
 * the project runs far above the style's own tempo and doubles up when it runs
 * far below, which is what a drummer does rather than playing sixteenths at
 * 180bpm.
 */
export type TempoMode = 'automatic' | 'standard' | 'half-time' | 'double-time';

/** The tempo this drummer's patterns are written around. */
export const DRUMMER_NATIVE_TEMPO = 110;

/**
 * A pattern typed in by hand, step by step, in Manual view.
 *
 * When present it replaces the generated rows for the pieces it names. Its own
 * mute flags are separate from the Main view's kit-piece toggles: the manual
 * describes muting a row of the custom pattern, which is not the same act as
 * taking the piece out of the kit.
 */
export interface ManualPattern {
    /** Length in steps; 16 is one bar. */
    length: number;
    /** Which steps each piece plays. */
    rows: Partial<Record<DrumPiece, boolean[]>>;
    /** Rows silenced without clearing them. */
    muted: Partial<Record<DrumPiece, boolean>>;
}

export const MANUAL_PAGE_STEPS = 16;

/** An empty grid of the given length, for every piece that has a row. */
export function emptyManualPattern(length = MANUAL_PAGE_STEPS): ManualPattern {
    const row = () => Array.from({ length }, () => false);
    return {
        length,
        rows: { kick: row(), snare: row(), hat: row(), ride: row(), toms: row(), percussion: row() },
        muted: {},
    };
}

export interface DrummerNote {
    pitch: number;
    /** Beats from the start of the region. */
    start: number;
    /** Length in beats. */
    duration: number;
    /** 0..1. */
    velocity: number;
}

export interface DrummerSettings {
    /** Which of the eight base patterns to build on. 1-based, as the UI shows. */
    variation: number;
    /** 0..1 — how many of the optional subdivisions are played. */
    complexity: number;
    /** 0..1 — how hard, and how much of the kit joins in. */
    intensity: number;
    /** 0..1 — how far every second subdivision is pushed late. */
    swing: number;
    /** Which subdivision the swing applies to. */
    swingGrid: '8th' | '16th';
    /** Pieces the player is allowed to use. */
    pieces: Record<DrumPiece, boolean>;
    /** 0..1 — quiet snare notes between the backbeats. */
    ghostNotes: number;
    /** -1 (behind the beat) .. +1 (ahead of it). */
    feel: number;
    /** 0..1 — spread between the softest and hardest hits. */
    dynamics: number;
    /** 0..1 — how much the timing and velocity wander. */
    humanize: number;
    /** 0..1 — how often a bar ends in a fill. */
    fillAmount: number;
    /** 0..1 — how busy those fills are. */
    fillComplexity: number;
    /** Which snare articulation the centre position uses. */
    snare: 'center' | 'rim';
    hiHat: 'automatic' | 'closed' | 'open';
    percussion: 'off' | 'tambourine' | 'shaker';
    /** Which cymbals a fill lands on. */
    cymbals: 'crash' | 'splash' | 'china';
    /** Which toms the fills run across. */
    toms: 'full' | 'low' | 'high';
    /** How fast the rhythm plays against the project tempo. */
    tempoMode: TempoMode;
    /**
     * The pattern the cymbal row plays.
     *
     * The manual is explicit that the Drummer has *several* Patterns buttons —
     * one per group of kit pieces — and the reference UI draws two rows each
     * with its own numbered button. A single `variation` for the whole kit made
     * the second row a copy of the first.
     */
    cymbalVariation: number;
    /** 0..1 — how much the pattern changes from bar to bar across the region. */
    phraseVariation: number;
    /** A hand-typed pattern that replaces the generated one, if there is one. */
    manual: ManualPattern | null;
    /**
     * The track whose rhythm this player follows, if any.
     *
     * The manual's "Follow Rhythm Of / Track": the kick and snare place their
     * accents where that track's notes fall, so a drummer can lock to a guitar
     * part through a chorus.
     */
    followTrackId: string | null;
    /** Place rhythmic emphasis where the chords change. */
    followChords: boolean;
    /** Fills and swing can be pinned so a change of preset leaves them alone. */
    lockFills: boolean;
    lockSwing: boolean;
    /** Anything that makes the same settings produce a different take. */
    seed: number;
}

export const DEFAULT_DRUMMER_SETTINGS: DrummerSettings = {
    variation: 4,
    complexity: 0.5,
    intensity: 0.6,
    swing: 0,
    swingGrid: '16th',
    pieces: { kick: true, snare: true, hat: true, ride: false, toms: true, percussion: false },
    ghostNotes: 0.2,
    feel: 0,
    dynamics: 0.5,
    humanize: 0.2,
    fillAmount: 0.25,
    fillComplexity: 0.4,
    snare: 'center',
    hiHat: 'automatic',
    percussion: 'off',
    cymbals: 'crash',
    toms: 'full',
    tempoMode: 'automatic',
    cymbalVariation: 4,
    phraseVariation: 0.2,
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
 * there — which is both what a drummer control should feel like and something
 * a test can state outright.
 */
interface Step {
    /** 0..15, a sixteenth of the bar. */
    at: number;
    threshold: number;
    /** Relative loudness before dynamics and humanise. 0..1. */
    accent: number;
}

interface BasePattern {
    kick: Step[];
    snare: Step[];
    hat: Step[];
}

const s = (at: number, threshold: number, accent: number): Step => ({ at, threshold, accent });

/**
 * Eight patterns, matching the eight rows the variation popover shows.
 *
 * Each is a bar of sixteenths. The low-threshold steps are the skeleton that
 * survives at Complexity 0; the higher ones fill in as it comes up.
 */
const PATTERNS: BasePattern[] = [
    // 1 — four on the floor, nothing else
    {
        kick: [s(0, 0, 1), s(4, 0.35, 0.85), s(8, 0, 0.95), s(12, 0.35, 0.85)],
        snare: [s(4, 0, 0.9), s(12, 0, 0.9)],
        hat: [s(0, 0, 0.7), s(4, 0, 0.6), s(8, 0, 0.7), s(12, 0, 0.6)],
    },
    // 2 — straight eights on the hat
    {
        kick: [s(0, 0, 1), s(8, 0, 0.95), s(10, 0.5, 0.8)],
        snare: [s(4, 0, 0.9), s(12, 0, 0.9)],
        hat: [s(0, 0, 0.75), s(2, 0.2, 0.55), s(4, 0, 0.65), s(6, 0.2, 0.55),
        s(8, 0, 0.75), s(10, 0.2, 0.55), s(12, 0, 0.65), s(14, 0.2, 0.55)],
    },
    // 3 — pushed kick
    {
        kick: [s(0, 0, 1), s(6, 0.3, 0.85), s(8, 0, 0.9), s(14, 0.55, 0.75)],
        snare: [s(4, 0, 0.9), s(12, 0, 0.9), s(15, 0.7, 0.5)],
        hat: [s(0, 0, 0.75), s(2, 0.25, 0.5), s(4, 0, 0.65), s(6, 0.25, 0.5),
        s(8, 0, 0.75), s(10, 0.25, 0.5), s(12, 0, 0.65), s(14, 0.25, 0.5)],
    },
    // 4 — the default: sixteenth hats
    {
        kick: [s(0, 0, 1), s(3, 0.45, 0.7), s(8, 0, 0.95), s(10, 0.4, 0.8)],
        snare: [s(4, 0, 0.9), s(12, 0, 0.9)],
        hat: [s(0, 0, 0.8), s(1, 0.6, 0.4), s(2, 0.15, 0.55), s(3, 0.6, 0.4),
        s(4, 0, 0.7), s(5, 0.6, 0.4), s(6, 0.15, 0.55), s(7, 0.6, 0.4),
        s(8, 0, 0.8), s(9, 0.6, 0.4), s(10, 0.15, 0.55), s(11, 0.6, 0.4),
        s(12, 0, 0.7), s(13, 0.6, 0.4), s(14, 0.15, 0.55), s(15, 0.6, 0.4)],
    },
    // 5 — half-time
    {
        kick: [s(0, 0, 1), s(6, 0.4, 0.8), s(10, 0.55, 0.75)],
        snare: [s(8, 0, 0.95)],
        hat: [s(0, 0, 0.75), s(2, 0.2, 0.5), s(4, 0, 0.65), s(6, 0.2, 0.5),
        s(8, 0, 0.75), s(10, 0.2, 0.5), s(12, 0, 0.65), s(14, 0.2, 0.5)],
    },
    // 6 — busy kick
    {
        kick: [s(0, 0, 1), s(2, 0.5, 0.7), s(6, 0.3, 0.85), s(8, 0, 0.9),
        s(11, 0.6, 0.7), s(14, 0.45, 0.8)],
        snare: [s(4, 0, 0.9), s(12, 0, 0.9), s(14, 0.75, 0.45)],
        hat: [s(0, 0, 0.8), s(2, 0.15, 0.55), s(4, 0, 0.7), s(6, 0.15, 0.55),
        s(8, 0, 0.8), s(10, 0.15, 0.55), s(12, 0, 0.7), s(14, 0.15, 0.55)],
    },
    // 7 — shuffled, leans on the swing control
    {
        kick: [s(0, 0, 1), s(3, 0.4, 0.75), s(8, 0, 0.95), s(11, 0.5, 0.75)],
        snare: [s(4, 0, 0.9), s(12, 0, 0.9), s(7, 0.65, 0.45)],
        hat: [s(0, 0, 0.75), s(3, 0.2, 0.5), s(4, 0, 0.65), s(7, 0.2, 0.5),
        s(8, 0, 0.75), s(11, 0.2, 0.5), s(12, 0, 0.65), s(15, 0.2, 0.5)],
    },
    // 8 — driving, the densest of the eight
    {
        kick: [s(0, 0, 1), s(2, 0.4, 0.75), s(4, 0.7, 0.6), s(8, 0, 0.95),
        s(10, 0.35, 0.8), s(12, 0.7, 0.6), s(14, 0.5, 0.7)],
        snare: [s(4, 0, 0.95), s(12, 0, 0.95), s(10, 0.8, 0.45), s(15, 0.6, 0.5)],
        hat: [s(0, 0, 0.85), s(1, 0.5, 0.45), s(2, 0.1, 0.6), s(3, 0.5, 0.45),
        s(4, 0, 0.75), s(5, 0.5, 0.45), s(6, 0.1, 0.6), s(7, 0.5, 0.45),
        s(8, 0, 0.85), s(9, 0.5, 0.45), s(10, 0.1, 0.6), s(11, 0.5, 0.45),
        s(12, 0, 0.75), s(13, 0.5, 0.45), s(14, 0.1, 0.6), s(15, 0.5, 0.45)],
    },
];

export const PATTERN_COUNT = PATTERNS.length;

/** A pattern number as the UI shows it (1-based), clamped to what exists. */
function patternIndex(variation: number): number {
    return Math.min(PATTERNS.length, Math.max(1, Math.round(variation || 1))) - 1;
}

/**
 * A small deterministic generator.
 *
 * `Math.random` would make every re-render a different take and every test
 * unwritable; this is seeded by the settings and the note's own position, so a
 * given hit always wanders by the same amount.
 */
function jitter(seed: number, salt: number): number {
    const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1; // -1..1
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** The steps of one row that survive the current Complexity. */
function survivingSteps(steps: Step[], complexity: number): Step[] {
    const c = clamp01(complexity);
    return steps.filter(step => c >= step.threshold);
}

/**
 * Where a sixteenth actually falls, once swing and feel are applied.
 *
 * Swing pushes every second subdivision later; feel shifts everything a little
 * early or late. Both are in beats.
 */
function stepToBeats(
    step: number,
    { swing, swingGrid, feel }: Pick<DrummerSettings, 'swing' | 'swingGrid' | 'feel'>,
): number {
    const beats = step / 4;
    const period = swingGrid === '8th' ? 2 : 1; // in sixteenths
    const isOffbeat = (step / period) % 2 >= 1;
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
function shapeVelocity(
    accent: number,
    settings: DrummerSettings,
    salt: number,
): number {
    const intensity = clamp01(settings.intensity);
    const dynamics = clamp01(settings.dynamics);
    // Dynamics widens the gap between the accents and everything else; at 0
    // every hit is the same weight, which is what a machine sounds like.
    const shaped = 1 - dynamics + accent * dynamics;
    const scaled = shaped * (0.35 + intensity * 0.65);
    const wander = jitter(settings.seed, salt) * clamp01(settings.humanize) * 0.15;
    return clamp01(scaled + wander);
}

function timeOf(step: number, settings: DrummerSettings, bar: number, beatsPerBar: number, salt: number): number {
    const within = stepToBeats(step, settings);
    const wander = jitter(settings.seed, salt + 7.77) * clamp01(settings.humanize) * 0.02;
    return Math.max(0, bar * beatsPerBar + within + wander);
}

/** Which hi-hat pitch a step uses. */
function hatPitch(step: number, settings: DrummerSettings): number {
    if (settings.hiHat === 'closed') return DRUM.closedHat;
    if (settings.hiHat === 'open') return step % 4 === 2 ? DRUM.openHat : DRUM.closedHat;
    // Automatic: the last sixteenth of the bar opens, which is how a drummer
    // signals the turnaround.
    return step === 14 ? DRUM.openHat : DRUM.closedHat;
}


/**
 * What `automatic` resolves to at this tempo.
 *
 * The patterns are written around `DRUMMER_NATIVE_TEMPO`. Run the project far
 * above that and a drummer stops playing sixteenths and drops to half-time;
 * far below and they double up. Anything but `automatic` is taken literally.
 */
export function resolveTempoMode(mode: TempoMode, tempo: number): Exclude<TempoMode, 'automatic'> {
    if (mode !== 'automatic') return mode;
    if (!Number.isFinite(tempo) || tempo <= 0) return 'standard';
    if (tempo > DRUMMER_NATIVE_TEMPO * 1.5) return 'half-time';
    if (tempo < DRUMMER_NATIVE_TEMPO * 0.68) return 'double-time';
    return 'standard';
}

/** How many pattern bars fit in one project bar. */
function tempoRate(mode: Exclude<TempoMode, 'automatic'>): number {
    return mode === 'half-time' ? 0.5 : mode === 'double-time' ? 2 : 1;
}

/**
 * The steps another track's notes fall on.
 *
 * "Follow Rhythm Of / Track": the onsets are quantised to sixteenths and become
 * accents the kick and snare place themselves on, which is how a drummer locks
 * to a guitar part rather than playing over it.
 */
export function onsetsToSteps(
    onsets: readonly number[],
    { beatsPerBar, bars }: { beatsPerBar: number; bars: number },
): Set<number> {
    const steps = new Set<number>();
    const total = Math.max(1, Math.round(bars * beatsPerBar * 4));
    for (const beat of onsets) {
        if (!Number.isFinite(beat) || beat < 0) continue;
        const step = Math.round(beat * 4);
        if (step >= total) continue;
        steps.add(step);
    }
    return steps;
}

/** The tom pitches a fill runs across, for the current Toms setting. */
function tomRun(setting: DrummerSettings['toms']): number[] {
    if (setting === 'low') return [DRUM.midTom, DRUM.lowTom, DRUM.lowTom];
    if (setting === 'high') return [DRUM.highTom, DRUM.highTom, DRUM.midTom];
    return [DRUM.highTom, DRUM.midTom, DRUM.lowTom];
}

/** The cymbal a fill lands on. */
function crashPitch(setting: DrummerSettings['cymbals']): number {
    return setting === 'splash' ? DRUM.splash : setting === 'china' ? DRUM.china : DRUM.crash;
}

/** The tom run that ends a bar when a fill lands there. */
function fillNotes(
    settings: DrummerSettings,
    bar: number,
    beatsPerBar: number,
): DrummerNote[] {
    const complexity = clamp01(settings.fillComplexity);
    // A sparse fill is three hits on the last beat; a busy one is eight
    // sixteenths across the last two.
    const hits = Math.max(2, Math.round(2 + complexity * 6));
    const spanBeats = 1 + complexity;
    const start = beatsPerBar - spanBeats;
    const toms = tomRun(settings.toms);

    const notes: DrummerNote[] = [];
    for (let i = 0; i < hits; i++) {
        const at = start + (i * spanBeats) / hits;
        const pitch = settings.pieces.toms
            ? toms[Math.floor((i / hits) * toms.length)] ?? DRUM.lowTom
            : DRUM.snare;
        notes.push({
            pitch,
            start: bar * beatsPerBar + at,
            duration: 0.2,
            velocity: shapeVelocity(0.7 + (i / hits) * 0.3, settings, bar * 100 + i),
        });
    }
    // Fills land on a crash, if there is a bar after this one to land into.
    notes.push({
        pitch: crashPitch(settings.cymbals),
        start: (bar + 1) * beatsPerBar,
        duration: 1,
        velocity: shapeVelocity(1, settings, bar * 100 + 99),
    });
    return notes;
}

/** Whether the bar ending at `bar` carries a fill. */
export function barHasFill(bar: number, settings: DrummerSettings, bars: number): boolean {
    const amount = clamp01(settings.fillAmount);
    if (amount <= 0) return false;
    // The last bar of the region never fills — there is nothing to land on.
    if (bar >= bars - 1) return false;
    // Fills fall at the end of phrases: every 4 bars at low amounts, every
    // 2 at medium, every bar at the top.
    const every = amount >= 0.8 ? 1 : amount >= 0.45 ? 2 : 4;
    return (bar + 1) % every === 0;
}

/** Options the generator needs from the project around it. */
export interface DrummerContext {
    bars: number;
    beatsPerBar?: number;
    /** The project tempo, for `tempoMode: 'automatic'`. */
    tempo?: number;
    /** Beat positions of the followed track's notes, relative to the region. */
    followOnsets?: readonly number[];
    /**
     * Beat positions where the harmony changes.
     *
     * The Drummer has no chords of its own — it is told where they change so
     * `followChords` can mark them, which is the manual's "place rhythmic
     * emphasis on chord changes".
     */
    chordChanges?: readonly number[];
}

/**
 * The notes a hand-typed pattern produces.
 *
 * The grid repeats across the region: a 32-step pattern is two bars long and
 * plays twice in a four-bar region, which is what the manual's page overview
 * shows. Manual view replaces the generated rows entirely - it is a pattern
 * typed in rather than one asked for.
 */
function manualNotes(
    manual: ManualPattern,
    settings: DrummerSettings,
    { bars, beatsPerBar, rate }: { bars: number; beatsPerBar: number; rate: number },
): DrummerNote[] {
    const notes: DrummerNote[] = [];
    const length = Math.max(1, Math.round(manual.length));
    const totalSteps = Math.max(1, Math.round(bars * beatsPerBar * 4 * rate));
    const regionBeats = bars * beatsPerBar;
    const ORDER: DrumPiece[] = ['kick', 'snare', 'hat', 'ride', 'toms', 'percussion'];

    for (let i = 0; i < totalSteps; i++) {
        const at = i % length;
        for (const piece of ORDER) {
            if (!settings.pieces[piece]) continue;
            if (manual.muted[piece]) continue;
            if (!manual.rows[piece]?.[at]) continue;
            if (piece === 'percussion' && settings.percussion === 'off') continue;

            const pitch = piece === 'kick' ? DRUM.kick
                : piece === 'snare' ? (settings.snare === 'rim' ? DRUM.sideStick : DRUM.snare)
                    : piece === 'hat' ? hatPitch(at % 16, settings)
                        : piece === 'ride' ? (at % 8 === 0 ? DRUM.rideBell : DRUM.ride)
                            : piece === 'toms' ? tomRun(settings.toms)[at % 3]
                                : settings.percussion === 'tambourine' ? DRUM.tambourine : DRUM.shaker;

            // Downbeats of the grid carry the accent, as the brighter dots do.
            const accent = at % 4 === 0 ? 0.95 : at % 2 === 0 ? 0.7 : 0.5;
            const salt = i * 16 + at;
            const swung = stepToBeats(at % 16, settings) - (at % 16) / 4;
            const beat = (i / 4 + swung) / rate
                + jitter(settings.seed, salt + 7.77) * clamp01(settings.humanize) * 0.02;
            if (beat >= regionBeats) continue;

            notes.push({
                pitch,
                start: Math.max(0, beat),
                duration: piece === 'kick' || piece === 'snare' ? 0.25 : 0.15,
                velocity: shapeVelocity(accent, settings, salt),
            });
        }
    }
    return notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
}

/**
 * The notes for a drummer region.
 *
 * Sorted by time, so the scheduler and the piano roll see them in order.
 */
export function generateDrummerPattern(
    settings: DrummerSettings,
    { bars, beatsPerBar = 4, tempo = DRUMMER_NATIVE_TEMPO, followOnsets, chordChanges }: DrummerContext,
): DrummerNote[] {
    const notes: DrummerNote[] = [];
    if (!(bars > 0)) return notes;

    const rate = tempoRate(resolveTempoMode(settings.tempoMode, tempo));

    // A hand-typed pattern replaces the generated one outright.
    if (settings.manual) return manualNotes(settings.manual, settings, { bars, beatsPerBar, rate });

    const pattern = PATTERNS[patternIndex(settings.variation)];
    const cymbalPattern = PATTERNS[patternIndex(settings.cymbalVariation)];
    const stepsPerBar = Math.max(1, Math.round(beatsPerBar * 4));
    const regionBeats = bars * beatsPerBar;

    /*
     * How far the pattern is allowed to drift from bar to bar.
     *
     * Phrase Variation moves the Complexity threshold a little each bar, so a
     * long region does not repeat one bar verbatim - the manual's "amount of
     * rhythmic change over the course of several bars".
     */
    const drift = (bar: number) =>
        jitter(settings.seed, bar * 3.14 + 1.5) * clamp01(settings.phraseVariation) * 0.35;

    const follow = followOnsets && settings.followTrackId
        ? onsetsToSteps(followOnsets, { beatsPerBar, bars })
        : null;

    // Pattern bars, not project bars: at double-time two fit in each project
    // bar, at half-time one spans two.
    const patternBars = Math.max(1, Math.ceil(bars * rate));

    /** Where a step of pattern bar `pb` lands in project beats. */
    const place = (pb: number, step: number, salt: number) => {
        const within = stepToBeats(step, settings);
        const wander = jitter(settings.seed, salt + 7.77) * clamp01(settings.humanize) * 0.02;
        return Math.max(0, (pb * beatsPerBar + within) / rate + wander);
    };
    const push = (n: DrummerNote) => { if (n.start < regionBeats) notes.push(n); };

    for (let pb = 0; pb < patternBars; pb++) {
        const complexity = clamp01(settings.complexity + drift(pb));
        const projectBar = Math.floor(pb / rate);
        const filling = barHasFill(projectBar, settings, bars) && (pb * rate) % Math.max(1, rate) === 0;

        /** Whether the followed track puts a note on this step of this bar. */
        const followedHere = (step: number) =>
            !!follow && follow.has(Math.round(((pb * beatsPerBar + step / 4) / rate) * 4));

        /*
         * A chord change the drummer marks: a crash on the change itself, the
         * gesture a drummer actually uses to point at one.
         */
        if (settings.followChords && chordChanges?.length && settings.pieces.hat) {
            for (const change of chordChanges) {
                if (change <= 0 || change >= regionBeats) continue;
                const at = Math.round((change * rate - pb * beatsPerBar) * 4);
                if (at < 0 || at >= stepsPerBar) continue;
                push({
                    pitch: crashPitch(settings.cymbals),
                    start: place(pb, at, pb * 16 + at + 0.42),
                    duration: 1,
                    velocity: shapeVelocity(0.85, settings, pb * 16 + at + 0.42),
                });
            }
        }

        if (settings.pieces.kick) {
            const played = survivingSteps(pattern.kick, complexity);
            for (const step of played) {
                if (step.at >= stepsPerBar) continue;
                push({
                    pitch: DRUM.kick,
                    start: place(pb, step.at, pb * 16 + step.at),
                    duration: 0.25,
                    velocity: shapeVelocity(
                        followedHere(step.at) ? Math.min(1, step.accent + 0.15) : step.accent,
                        settings, pb * 16 + step.at),
                });
            }
            /*
             * Where the followed track lands and the pattern does not, the kick
             * goes with it. Eighths only: matching every sixteenth of a busy
             * part turns the kick into a machine gun rather than a drummer
             * locking to it.
             */
            if (follow) {
                for (let at = 0; at < stepsPerBar; at += 2) {
                    if (!followedHere(at)) continue;
                    if (played.some(x => x.at === at)) continue;
                    push({
                        pitch: DRUM.kick,
                        start: place(pb, at, pb * 16 + at + 0.05),
                        duration: 0.25,
                        velocity: shapeVelocity(0.8, settings, pb * 16 + at + 0.05),
                    });
                }
            }
        }

        if (settings.pieces.snare) {
            const pitch = settings.snare === 'rim' ? DRUM.sideStick : DRUM.snare;
            for (const step of survivingSteps(pattern.snare, complexity)) {
                if (step.at >= stepsPerBar) continue;
                push({
                    pitch,
                    start: place(pb, step.at, pb * 16 + step.at + 0.5),
                    duration: 0.25,
                    velocity: shapeVelocity(
                        followedHere(step.at) ? Math.min(1, step.accent + 0.15) : step.accent,
                        settings, pb * 16 + step.at + 0.5),
                });
            }

            /*
             * Ghost notes: the quiet sixteenths a drummer fills between the
             * backbeats. Their own control, because they are what separates a
             * pattern that breathes from one that does not.
             */
            const ghost = clamp01(settings.ghostNotes);
            if (ghost > 0) {
                for (const at of [2, 6, 10, 14]) {
                    if (at >= stepsPerBar) continue;
                    if (pattern.snare.some(x => x.at === at)) continue;
                    const roll = (jitter(settings.seed, pb * 31 + at) + 1) / 2;
                    if (roll > ghost) continue;
                    push({
                        pitch,
                        start: place(pb, at, pb * 16 + at + 0.25),
                        duration: 0.12,
                        velocity: clamp01(shapeVelocity(0.25, settings, pb * 16 + at + 0.25) * 0.45),
                    });
                }
            }
        }

        // The ride takes the hat's part when it is switched on - a drummer
        // plays one or the other, not both.
        const cymbal: DrumPiece | null = settings.pieces.ride ? 'ride'
            : settings.pieces.hat ? 'hat' : null;
        if (cymbal) {
            for (const step of survivingSteps(cymbalPattern.hat, complexity)) {
                if (step.at >= stepsPerBar) continue;
                push({
                    pitch: cymbal === 'ride'
                        ? (step.at % 8 === 0 ? DRUM.rideBell : DRUM.ride)
                        : hatPitch(step.at, settings),
                    start: place(pb, step.at, pb * 16 + step.at + 0.75),
                    duration: 0.15,
                    velocity: shapeVelocity(step.accent, settings, pb * 16 + step.at + 0.75),
                });
            }
        }

        if (settings.pieces.percussion && settings.percussion !== 'off') {
            const pitch = settings.percussion === 'tambourine' ? DRUM.tambourine : DRUM.shaker;
            for (let at = 2; at < stepsPerBar; at += 4) {
                push({
                    pitch,
                    start: place(pb, at, pb * 16 + at + 0.9),
                    duration: 0.12,
                    velocity: shapeVelocity(0.5, settings, pb * 16 + at + 0.9),
                });
            }
        }

        if (filling) {
            for (const n of fillNotes(settings, projectBar, beatsPerBar)) push(n);
        }
    }

    return notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
}

/** The rows the variation popover draws: one 16-step outline per pattern. */
export function patternPreview(variation: number, complexity: number): boolean[] {
    const p = PATTERNS[patternIndex(variation)];
    const on = new Set<number>();
    for (const row of [p.kick, p.snare, p.hat]) {
        for (const step of survivingSteps(row, complexity)) on.add(step.at);
    }
    return Array.from({ length: 16 }, (_, i) => on.has(i));
}
