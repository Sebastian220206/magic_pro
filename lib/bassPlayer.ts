/**
 * The Session Player's Bass Player.
 *
 * A bass line is a rhythm plus a rule for choosing notes from the chord under
 * it. The rhythm is the shared one in `lib/sessionRhythm`; the choosing is
 * here, along with the articulations the manual gives this player its own
 * controls for — dead notes, pickup hits, slides, muting.
 *
 * Deterministic: the same settings and seed give the same line, so nudging one
 * control does not reshuffle the rest and a test can assert an exact note list.
 */
import {
    type SessionCommon, type SessionNote, type ManualPattern,
    DEFAULT_SESSION_COMMON, RHYTHM_PATTERNS, rhythmIndex,
    survivingSteps, stepToBeats, shapeVelocity, timingWander, phraseDrift,
    jitter, clamp01, resolveTempoMode, tempoRate, onsetsToSteps, barHasFill,
    SESSION_NATIVE_TEMPO,
} from './sessionRhythm';
import { type Chord, chordTones, harmonyFor, chordAt, pitchAtOrAbove } from './chords';

/** Which notes of the chord the line is allowed to use. */
export type BassMelody =
    /** The root, and nothing else. */
    | 'root-only'
    /** Root and fifth. */
    | 'root-fifth'
    /** Any tone of the chord. */
    | 'chord-tones'
    /** Chord tones, with scale steps joining them up. */
    | 'passing';

/** How often the line jumps an octave. */
export type BassOctaves = 'off' | 'few' | 'some' | 'more';

/** The longest a note is allowed to be. */
export type BassPhrasing = 'short' | 'medium' | 'long';

/** The lowest note a four-string bass reaches. */
export const BASS_LOW_E = 28;
/** The tip in the manual: B0 emulates a five-string. */
export const BASS_LOW_B = 23;
/** The top of the range this player writes in. */
export const BASS_HIGH = 55;

export interface BassSettings extends SessionCommon {
    melody: BassMelody;
    octaves: BassOctaves;
    phrasing: BassPhrasing;
    /** MIDI note; the line never goes below it. */
    lowestNote: number;
    /**
     * 0..1 — how heavily notes are muted.
     *
     * The manual makes this an offset for the Studio Bass plug-in's own Mute
     * slider, and this project has no Studio Bass. Rather than a control that
     * does nothing, it shortens the notes and takes weight off them, which is
     * what muting a string with the palm actually does to the sound.
     */
    muteOffset: number;
    /** Mute according to what is around a note, rather than uniformly. */
    dynamicMute: boolean;
    /** 0..1 — percussive, near-pitchless notes between the real ones. */
    deadNotes: number;
    /** An open palm on the second and fourth beats. */
    pickupHits: boolean;
    /** 0..1 — how often the line slides into a note. */
    slides: number;
    /** Choose closer intervals for root notes across a progression. */
    alignRoot: boolean;
}

export const DEFAULT_BASS_SETTINGS: BassSettings = {
    ...DEFAULT_SESSION_COMMON,
    variation: 4,
    melody: 'chord-tones',
    octaves: 'few',
    phrasing: 'medium',
    lowestNote: BASS_LOW_E,
    muteOffset: 0,
    dynamicMute: false,
    deadNotes: 0,
    pickupHits: false,
    slides: 0,
    alignRoot: true,
};

/** How likely an octave jump is, per setting. */
const OCTAVE_CHANCE: Record<BassOctaves, number> = {
    off: 0, few: 0.12, some: 0.3, more: 0.55,
};

/** The longest note, in beats, per phrasing setting. */
const MAX_LENGTH: Record<BassPhrasing, number> = {
    short: 0.35, medium: 0.9, long: 2,
};

/** The scale steps a passing line may use between chord tones. */
function passingTones(chord: Chord): number[] {
    const tones = chordTones(chord);
    // A passing note sits a step below the next chord tone; taking the whole
    // major scale of the root would fight a minor chord, so this walks the
    // chord's own tones and fills the gaps.
    const extra: number[] = [];
    for (const pc of tones) extra.push((pc + 10) % 12, (pc + 11) % 12);
    return [...new Set([...tones, ...extra])];
}

/**
 * The pitch this note plays.
 *
 * Every choice is anchored to the chord under it, so the line follows the
 * harmony rather than repeating one shape transposed.
 */
function choosePitch(
    chord: Chord,
    settings: BassSettings,
    { isDownbeat, previous, salt }: { isDownbeat: boolean; previous: number | null; salt: number },
): number {
    const floor = Math.max(0, Math.round(settings.lowestNote));
    const root = chord.bass ?? chord.root;

    // A chord change lands on its own root — that is the bass player's job,
    // before it is anything else.
    if (isDownbeat || settings.melody === 'root-only') {
        return placeRoot(root, floor, settings, previous);
    }

    const roll = (jitter(settings.seed, salt) + 1) / 2;
    const tones = settings.melody === 'root-fifth'
        ? [chord.root, (chord.root + 7) % 12]
        : settings.melody === 'passing'
            ? passingTones(chord)
            : chordTones(chord);

    const pc = tones[Math.floor(roll * tones.length) % tones.length];
    let pitch = pitchAtOrAbove(pc, floor);

    // Keep it near the last note rather than leaping about the neck.
    if (previous !== null) {
        while (pitch - previous > 7 && pitch - 12 >= floor) pitch -= 12;
        while (previous - pitch > 7 && pitch + 12 <= BASS_HIGH) pitch += 12;
    }

    const octaveRoll = (jitter(settings.seed, salt + 3.3) + 1) / 2;
    if (octaveRoll < OCTAVE_CHANCE[settings.octaves] && pitch + 12 <= BASS_HIGH) pitch += 12;

    return Math.min(BASS_HIGH, Math.max(floor, pitch));
}

/**
 * Where the root of a chord sits.
 *
 * With Align Root on, it takes the octave nearest the previous note, so a
 * progression that moves by a fourth does not throw the line an octave. Off,
 * every root is played as low as the instrument allows, which is the blunter
 * and more traditional sound.
 */
function placeRoot(
    pc: number,
    floor: number,
    settings: BassSettings,
    previous: number | null,
): number {
    const low = pitchAtOrAbove(pc, floor);
    if (!settings.alignRoot || previous === null) return Math.min(BASS_HIGH, low);
    let pitch = low;
    while (Math.abs(pitch + 12 - previous) < Math.abs(pitch - previous) && pitch + 12 <= BASS_HIGH) {
        pitch += 12;
    }
    return pitch;
}

export interface BassContext {
    bars: number;
    beatsPerBar?: number;
    tempo?: number;
    /** Where the region sits in the project, for reading the Chord track. */
    regionStart?: number;
    regionChords?: readonly Chord[] | null;
    chordTrack?: readonly Chord[] | null;
    keySignature?: string | null;
    followOnsets?: readonly number[];
}

/** The steps a hand-typed pattern turns on, as a base pattern would give them. */
function manualSteps(manual: ManualPattern, bar: number): Array<{ at: number; accent: number }> {
    const row = manual.rows.bass ?? [];
    if (manual.muted.bass) return [];
    const length = Math.max(1, Math.round(manual.length));
    const out: Array<{ at: number; accent: number }> = [];
    for (let at = 0; at < 16; at++) {
        const index = (bar * 16 + at) % length;
        if (!row[index]) continue;
        out.push({ at, accent: at % 4 === 0 ? 0.95 : at % 2 === 0 ? 0.7 : 0.5 });
    }
    return out;
}

/**
 * The notes for a Bass Player region.
 *
 * Sorted by time, so the scheduler and the piano roll see them in order.
 */
export function generateBassLine(
    settings: BassSettings,
    {
        bars, beatsPerBar = 4, tempo = SESSION_NATIVE_TEMPO, regionStart = 0,
        regionChords, chordTrack, keySignature, followOnsets,
    }: BassContext,
): SessionNote[] {
    const notes: SessionNote[] = [];
    if (!(bars > 0)) return notes;

    const harmony = harmonyFor({
        regionChords, chordTrack, regionStart, bars, beatsPerBar, keySignature,
    });
    const rate = tempoRate(resolveTempoMode(settings.tempoMode, tempo));
    const pattern = RHYTHM_PATTERNS[rhythmIndex(settings.variation)];
    const stepsPerBar = Math.max(1, Math.round(beatsPerBar * 4));
    const regionBeats = bars * beatsPerBar;
    const maxLength = MAX_LENGTH[settings.phrasing];
    const follow = followOnsets && settings.followTrackId
        ? onsetsToSteps(followOnsets, { beatsPerBar, bars })
        : null;

    const patternBars = Math.max(1, Math.ceil(bars * rate));
    let previous: number | null = null;

    for (let pb = 0; pb < patternBars; pb++) {
        const complexity = clamp01(settings.complexity + phraseDrift(settings, pb));
        const projectBar = Math.floor(pb / rate);
        const filling = barHasFill(projectBar, settings, bars);

        const steps = settings.manual
            ? manualSteps(settings.manual, pb)
            : survivingSteps(pattern, complexity).map(s => ({ at: s.at, accent: s.accent }));

        const extra: Array<{ at: number; accent: number }> = [];

        /*
         * Follow Rhythm Of / Chords.
         *
         * A chord change that falls where the pattern happens to rest passes
         * unmarked, and the new harmony arrives late. With this on, the player
         * puts a note on the change itself — which is the whole point of the
         * switch, and the reason it is on by default.
         */
        // A hand-typed pattern replaces everything, chord marks included.
        if (settings.followChords && !settings.manual) {
            for (const c of harmony) {
                if (c.start <= 0) continue;
                const at = Math.round((c.start * rate - pb * beatsPerBar) * 4);
                if (at < 0 || at >= stepsPerBar) continue;
                if (steps.some(x => x.at === at)) continue;
                extra.push({ at, accent: 0.9 });
            }
        }

        /* Where the followed track lands, the bass lands with it. */
        if (follow) {
            for (let at = 0; at < stepsPerBar; at += 2) {
                const abs = Math.round(((pb * beatsPerBar + at / 4) / rate) * 4);
                if (!follow.has(abs)) continue;
                if (steps.some(s => s.at === at)) continue;
                extra.push({ at, accent: 0.8 });
            }
        }

        // Beats two and four, hit with an open palm. Percussive rather than
        // pitched, so they sit under the line without changing the harmony.
        const pickups = settings.pickupHits
            ? [4, 12].filter(at => at < stepsPerBar).map(at => ({ at, accent: 0.45, pickup: true }))
            : [];

        const all = [...steps, ...extra, ...pickups.map(p => ({ at: p.at, accent: p.accent }))]
            .sort((a, b) => a.at - b.at);

        for (let i = 0; i < all.length; i++) {
            const s = all[i];
            if (s.at >= stepsPerBar) continue;

            const within = stepToBeats(s.at, settings);
            /*
             * Two clocks, deliberately.
             *
             * `nominal` is where the note is written; `beat` is where it is
             * played, once Humanize has moved it. The harmony is read from the
             * written position: a note that wanders a few milliseconds early
             * across a chord change still belongs to the chord it is landing
             * on, and reading the played position instead makes the bass play
             * the *previous* chord on every downbeat it happens to rush.
             */
            const nominal = (pb * beatsPerBar + within) / rate;
            if (nominal >= regionBeats) continue;
            const beat = Math.max(0, nominal + timingWander(settings, pb * 16 + s.at));

            const chord = chordAt(harmony, nominal) ?? harmony[0];
            const isDownbeat = s.at === 0 || harmony.some(c => Math.abs(c.start - nominal) < 0.13);
            const salt = pb * 16 + s.at;
            const isPickup = pickups.some(p => p.at === s.at) && !steps.some(x => x.at === s.at);

            /*
             * A note runs to the next one, capped by Phrasing. Letting them run
             * to the next note unbounded turns "long" into one held note per
             * bar; capping without looking ahead leaves gaps a bass player
             * would have filled.
             */
            const nextAt = all[i + 1]?.at ?? stepsPerBar;
            const gap = Math.max(0.1, (stepToBeats(nextAt, settings) - within) / rate);
            const muted = clamp01(settings.muteOffset) *
                (settings.dynamicMute ? (i % 2 === 1 ? 1 : 0.35) : 1);
            const duration = Math.max(0.08, Math.min(maxLength, gap * 0.95) * (1 - muted * 0.6));

            const pitch: number = isPickup
                ? Math.max(settings.lowestNote, (chord.bass ?? chord.root) + 24)
                : choosePitch(chord, settings, { isDownbeat, previous, salt });

            const velocity = clamp01(
                shapeVelocity(s.accent, settings, salt) * (1 - muted * 0.35) * (isPickup ? 0.6 : 1));

            /*
             * A slide is a short note a step below, tied into the target. The
             * manual generates slides with pitch-bend automation, which needs a
             * per-note bend lane this project's MIDI model does not have — this
             * is the same gesture written as notes, so it is audible rather
             * than stored and ignored.
             */
            const slideRoll = (jitter(settings.seed, salt + 5.5) + 1) / 2;
            if (!isPickup && settings.slides > 0 && slideRoll < clamp01(settings.slides) && beat > 0.1) {
                const from = pitch - (slideRoll < clamp01(settings.slides) / 2 ? 1 : 2);
                if (from >= settings.lowestNote) {
                    notes.push({
                        pitch: from,
                        start: Math.max(0, beat - 0.12),
                        duration: 0.11,
                        velocity: clamp01(velocity * 0.7),
                    });
                }
            }

            notes.push({ pitch, start: Math.max(0, beat), duration, velocity });
            if (!isPickup) previous = pitch;

            /*
             * Dead notes: the percussive, near-pitchless sixteenths between the
             * real ones. Very short and very quiet at the same pitch, which is
             * what a damped string gives you on a sampled bass.
             */
            const dead = clamp01(settings.deadNotes);
            if (dead > 0 && !isPickup) {
                const at = s.at + 1;
                if (at < stepsPerBar && !all.some(x => x.at === at)) {
                    const roll = (jitter(settings.seed, salt + 11.1) + 1) / 2;
                    if (roll < dead) {
                        const deadBeat = (pb * beatsPerBar + stepToBeats(at, settings)) / rate;
                        if (deadBeat >= 0 && deadBeat < regionBeats) {
                            notes.push({
                                pitch,
                                start: Math.max(0, deadBeat),
                                duration: 0.06,
                                velocity: clamp01(velocity * 0.3),
                            });
                        }
                    }
                }
            }
        }

        /*
         * A fill: the line walks up to the next chord across the last beat, so
         * the bar hands over rather than stopping.
         */
        if (filling && !settings.manual) {
            const nextChord = harmony.find(c => c.start >= (projectBar + 1) * beatsPerBar) ?? harmony[0];
            const target = pitchAtOrAbove(nextChord.bass ?? nextChord.root, settings.lowestNote);
            const hits = Math.max(2, Math.round(2 + clamp01(settings.fillComplexity) * 3));
            const from = (projectBar + 1) * beatsPerBar - 1;
            for (let i = 0; i < hits; i++) {
                const beat = from + (i / hits);
                if (beat >= regionBeats) continue;
                const pitch = Math.max(settings.lowestNote, target - (hits - i) * 2);
                notes.push({
                    pitch,
                    start: beat,
                    duration: Math.min(maxLength, 1 / hits * 0.9),
                    velocity: shapeVelocity(0.6 + (i / hits) * 0.35, settings, projectBar * 100 + i),
                });
                previous = pitch;
            }
        }
    }

    return notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
}
