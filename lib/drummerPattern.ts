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
} as const;

export type DrumPiece = 'kick' | 'snare' | 'hat' | 'ride' | 'toms' | 'percussion';

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
    const pushed = (Number.isFinite(feel) ? Math.max(-1, Math.min(1, feel)) : 0) * 0.03;
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
    const toms = [DRUM.highTom, DRUM.midTom, DRUM.lowTom];

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
        pitch: DRUM.crash,
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

/**
 * The notes for a drummer region.
 *
 * Sorted by time, so the scheduler and the piano roll see them in order.
 */
export function generateDrummerPattern(
    settings: DrummerSettings,
    { bars, beatsPerBar = 4 }: { bars: number; beatsPerBar?: number },
): DrummerNote[] {
    const notes: DrummerNote[] = [];
    if (!(bars > 0)) return notes;

    const index = Math.min(PATTERNS.length, Math.max(1, Math.round(settings.variation))) - 1;
    const pattern = PATTERNS[index];
    const stepsPerBar = Math.max(1, Math.round(beatsPerBar * 4));

    for (let bar = 0; bar < bars; bar++) {
        const filling = barHasFill(bar, settings, bars);

        if (settings.pieces.kick) {
            for (const step of survivingSteps(pattern.kick, settings.complexity)) {
                if (step.at >= stepsPerBar) continue;
                notes.push({
                    pitch: DRUM.kick,
                    start: timeOf(step.at, settings, bar, beatsPerBar, bar * 16 + step.at),
                    duration: 0.25,
                    velocity: shapeVelocity(step.accent, settings, bar * 16 + step.at),
                });
            }
        }

        if (settings.pieces.snare) {
            const pitch = settings.snare === 'rim' ? DRUM.sideStick : DRUM.snare;
            for (const step of survivingSteps(pattern.snare, settings.complexity)) {
                if (step.at >= stepsPerBar) continue;
                notes.push({
                    pitch,
                    start: timeOf(step.at, settings, bar, beatsPerBar, bar * 16 + step.at + 0.5),
                    duration: 0.25,
                    velocity: shapeVelocity(step.accent, settings, bar * 16 + step.at + 0.5),
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
                    const roll = (jitter(settings.seed, bar * 31 + at) + 1) / 2;
                    if (roll > ghost) continue;
                    notes.push({
                        pitch,
                        start: timeOf(at, settings, bar, beatsPerBar, bar * 16 + at + 0.25),
                        duration: 0.12,
                        velocity: clamp01(shapeVelocity(0.25, settings, bar * 16 + at + 0.25) * 0.45),
                    });
                }
            }
        }

        // The ride takes the hat's part when it is switched on — a drummer
        // plays one or the other, not both.
        const cymbal: DrumPiece | null = settings.pieces.ride ? 'ride'
            : settings.pieces.hat ? 'hat' : null;
        if (cymbal) {
            for (const step of survivingSteps(pattern.hat, settings.complexity)) {
                if (step.at >= stepsPerBar) continue;
                notes.push({
                    pitch: cymbal === 'ride'
                        ? (step.at % 8 === 0 ? DRUM.rideBell : DRUM.ride)
                        : hatPitch(step.at, settings),
                    start: timeOf(step.at, settings, bar, beatsPerBar, bar * 16 + step.at + 0.75),
                    duration: 0.15,
                    velocity: shapeVelocity(step.accent, settings, bar * 16 + step.at + 0.75),
                });
            }
        }

        if (settings.pieces.percussion && settings.percussion !== 'off') {
            const pitch = settings.percussion === 'tambourine' ? DRUM.tambourine : DRUM.shaker;
            for (let at = 2; at < stepsPerBar; at += 4) {
                notes.push({
                    pitch,
                    start: timeOf(at, settings, bar, beatsPerBar, bar * 16 + at + 0.9),
                    duration: 0.12,
                    velocity: shapeVelocity(0.5, settings, bar * 16 + at + 0.9),
                });
            }
        }

        if (filling) notes.push(...fillNotes(settings, bar, beatsPerBar));
    }

    return notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
}

/** The rows the variation popover draws: one 16-step outline per pattern. */
export function patternPreview(variation: number, complexity: number): boolean[] {
    const index = Math.min(PATTERNS.length, Math.max(1, Math.round(variation))) - 1;
    const p = PATTERNS[index];
    const on = new Set<number>();
    for (const row of [p.kick, p.snare, p.hat]) {
        for (const step of survivingSteps(row, complexity)) on.add(step.at);
    }
    return Array.from({ length: 16 }, (_, i) => on.has(i));
}
