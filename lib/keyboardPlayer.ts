/**
 * The Session Player's Keyboard Player.
 *
 * Two hands that work together, which is the thing the manual is careful about:
 * "muting the left hand changes how the right hand plays voicings". So this is
 * not two independent generators run side by side — the right hand asks what
 * the left is doing before it decides how much of the chord to carry.
 *
 * Deterministic, like the other two players: the same settings and seed give
 * the same performance.
 */
import {
    type SessionCommon, type SessionNote, type ManualPattern,
    DEFAULT_SESSION_COMMON, RHYTHM_PATTERNS, rhythmIndex,
    survivingSteps, stepToBeats, shapeVelocity, timingWander, phraseDrift,
    jitter, clamp01, resolveTempoMode, tempoRate, onsetsToSteps, barHasFill,
    SESSION_NATIVE_TEMPO,
} from './sessionRhythm';
import { type Chord, chordTones, harmonyFor, chordAt, voiceChord, pitchAtOrAbove } from './chords';

/** What notes the left hand plays. */
export type LeftVoicing = 'root-only' | 'root-octave' | 'root-fifth' | 'root-fifth-octave' | 'broken';

/** How busy the left hand is. */
export type LeftStyle =
    | 'sustain-only' | 'simple' | 'moderate' | 'complex'
    | 'follow-right-hand' | 'steady-4ths' | 'steady-8ths';

/** How many notes the right hand carries, and which. */
export type RightVoicing = 'triad' | 'four-voice' | 'extensions' | 'full-chord';

/** How far the right hand is allowed to move between chords. */
export type RightMovement = 'minimal' | 'medium' | 'wide';

/** The range this player writes in. */
export const KEYS_LOW = 36;
export const KEYS_HIGH = 96;

export interface KeyboardSettings extends SessionCommon {
    leftHand: boolean;
    rightHand: boolean;
    /** Where each hand sits, as a MIDI note. */
    leftPosition: number;
    rightPosition: number;
    leftVoicing: LeftVoicing;
    leftStyle: LeftStyle;
    rightVoicing: RightVoicing;
    rightMovement: RightMovement;
    /** 0..1 — how often a note is preceded by a grace note. */
    graceNotes: number;
    /** How long the right hand's notes are held. */
    phrasing: 'staccato' | 'mixed' | 'legato';
}

export const DEFAULT_KEYBOARD_SETTINGS: KeyboardSettings = {
    ...DEFAULT_SESSION_COMMON,
    variation: 4,
    leftHand: true,
    rightHand: true,
    leftPosition: 45,
    rightPosition: 67,
    leftVoicing: 'root-only',
    leftStyle: 'simple',
    rightVoicing: 'four-voice',
    rightMovement: 'medium',
    graceNotes: 0,
    phrasing: 'mixed',
};

/** The intervals above the root the left hand plays, per voicing. */
const LEFT_INTERVALS: Record<LeftVoicing, number[]> = {
    'root-only': [0],
    'root-octave': [0, 12],
    'root-fifth': [0, 7],
    'root-fifth-octave': [0, 7, 12],
    broken: [0, 7, 12],
};

/** How many notes the right hand takes from the chord. */
const RIGHT_COUNT: Record<RightVoicing, number> = {
    triad: 3, 'four-voice': 4, extensions: 5, 'full-chord': 6,
};

/** How far the right hand may drift from its position, per movement setting. */
const MOVEMENT_SPAN: Record<RightMovement, number> = {
    minimal: 5, medium: 10, wide: 18,
};

/** Which steps of the bar the left hand plays, per style. */
function leftSteps(style: LeftStyle, rightAccents: number[], complexity: number): number[] {
    switch (style) {
        case 'sustain-only': return [0];
        case 'simple': return [0, 8];
        case 'moderate': return [0, 4, 8, 12];
        case 'complex': return [0, 3, 6, 8, 11, 14].filter((_, i) => i < 2 + Math.round(complexity * 4));
        case 'steady-4ths': return [0, 4, 8, 12];
        case 'steady-8ths': return [0, 2, 4, 6, 8, 10, 12, 14];
        case 'follow-right-hand': return rightAccents.length ? [...new Set(rightAccents)] : [0, 8];
        default: return [0, 8];
    }
}

export interface KeyboardContext {
    bars: number;
    beatsPerBar?: number;
    tempo?: number;
    regionStart?: number;
    regionChords?: readonly Chord[] | null;
    chordTrack?: readonly Chord[] | null;
    keySignature?: string | null;
    followOnsets?: readonly number[];
}

/** The steps a hand-typed pattern turns on for one hand. */
function manualSteps(manual: ManualPattern, row: string, bar: number): Array<{ at: number; accent: number }> {
    const grid = manual.rows[row] ?? [];
    if (manual.muted[row]) return [];
    const length = Math.max(1, Math.round(manual.length));
    const out: Array<{ at: number; accent: number }> = [];
    for (let at = 0; at < 16; at++) {
        if (!grid[(bar * 16 + at) % length]) continue;
        out.push({ at, accent: at % 4 === 0 ? 0.95 : at % 2 === 0 ? 0.7 : 0.5 });
    }
    return out;
}

/**
 * The notes for a Keyboard Player region.
 *
 * Sorted by time, so the scheduler and the piano roll see them in order.
 */
export function generateKeyboardPart(
    settings: KeyboardSettings,
    {
        bars, beatsPerBar = 4, tempo = SESSION_NATIVE_TEMPO, regionStart = 0,
        regionChords, chordTrack, keySignature, followOnsets,
    }: KeyboardContext,
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
    const follow = followOnsets && settings.followTrackId
        ? onsetsToSteps(followOnsets, { beatsPerBar, bars })
        : null;

    const patternBars = Math.max(1, Math.ceil(bars * rate));
    let lastCentre: number | null = null;

    for (let pb = 0; pb < patternBars; pb++) {
        const complexity = clamp01(settings.complexity + phraseDrift(settings, pb));
        const projectBar = Math.floor(pb / rate);
        const filling = barHasFill(projectBar, settings, bars);

        /* ── The right hand decides the rhythm; the left may follow it ──── */
        const right = settings.manual
            ? manualSteps(settings.manual, 'right', pb)
            : survivingSteps(pattern, complexity).map(s => ({ at: s.at, accent: s.accent }));

        /*
         * Follow Rhythm Of / Chords: put a chord on the change itself, rather
         * than letting the new harmony wait for the next step in the pattern.
         */
        if (settings.followChords && !settings.manual) {
            for (const c of harmony) {
                if (c.start <= 0) continue;
                const at = Math.round((c.start * rate - pb * beatsPerBar) * 4);
                if (at < 0 || at >= stepsPerBar) continue;
                if (right.some(x => x.at === at)) continue;
                right.push({ at, accent: 0.9 });
            }
        }

        if (follow) {
            for (let at = 0; at < stepsPerBar; at += 2) {
                const abs = Math.round(((pb * beatsPerBar + at / 4) / rate) * 4);
                if (!follow.has(abs) || right.some(s => s.at === at)) continue;
                right.push({ at, accent: 0.8 });
            }
        }
        right.sort((a, b) => a.at - b.at);

        const beatOf = (at: number) =>
            (pb * beatsPerBar + stepToBeats(at, settings)) / rate;

        /* ── Right hand ─────────────────────────────────────────────────── */
        if (settings.rightHand) {
            for (let i = 0; i < right.length; i++) {
                const s = right[i];
                if (s.at >= stepsPerBar) continue;
                /* Written position for the harmony, played position for the
                 * note itself — see the same split in `bassPlayer`. */
                const nominal = beatOf(s.at);
                if (nominal >= regionBeats) continue;
                const beat = Math.max(0, nominal + timingWander(settings, pb * 16 + s.at));

                const chord = chordAt(harmony, nominal) ?? harmony[0];
                const salt = pb * 16 + s.at;

                /*
                 * With the left hand muted the right carries the root itself —
                 * the manual's point that the hands are not independent. A
                 * right hand that keeps playing rootless voicings over silence
                 * sounds like a missing track, not like a pianist.
                 */
                const span = MOVEMENT_SPAN[settings.rightMovement];
                const centre = lastCentre ?? settings.rightPosition;
                const voiced = voiceChord(chord, {
                    low: Math.max(KEYS_LOW, settings.rightPosition - span),
                    high: Math.min(KEYS_HIGH, settings.rightPosition + span),
                    count: RIGHT_COUNT[settings.rightVoicing],
                    near: centre,
                });
                if (!voiced.length) continue;

                /*
                 * With no left hand, the right one takes the root under itself.
                 *
                 * Asking for one more chord tone would do nothing over a triad,
                 * which has only three to give — the part would keep floating
                 * rootless and sound like a track that failed to load. What is
                 * actually missing is the bass, so that is what it adds.
                 */
                if (!settings.leftHand) {
                    const root = pitchAtOrAbove(chord.bass ?? chord.root, KEYS_LOW);
                    let below = root;
                    while (below + 12 < voiced[0]) below += 12;
                    if (below < voiced[0] && !voiced.includes(below)) voiced.unshift(below);
                }

                const nextAt = right[i + 1]?.at ?? stepsPerBar;
                const gap = Math.max(0.1, (stepToBeats(nextAt, settings) - stepToBeats(s.at, settings)) / rate);
                const held = settings.phrasing === 'staccato' ? Math.min(0.2, gap * 0.4)
                    : settings.phrasing === 'legato' ? gap
                        : gap * 0.75;

                /*
                 * Strum: the notes of a chord are not struck at exactly the
                 * same instant. A few milliseconds apart is the difference
                 * between a pianist and a MIDI file.
                 */
                voiced.forEach((pitch, n) => {
                    notes.push({
                        pitch,
                        start: Math.max(0, beat + n * 0.008),
                        duration: Math.max(0.08, held),
                        velocity: clamp01(shapeVelocity(s.accent, settings, salt + n) * (1 - n * 0.04)),
                    });
                });

                /*
                 * A grace note: a step below the top voice, a breath early.
                 * The manual gives this its own knob because it is most of what
                 * separates a written-out part from a played one.
                 */
                const grace = clamp01(settings.graceNotes);
                if (grace > 0) {
                    const roll = (jitter(settings.seed, salt + 4.2) + 1) / 2;
                    if (roll < grace && beat > 0.1) {
                        const top = voiced[voiced.length - 1];
                        notes.push({
                            pitch: top - (roll < grace / 2 ? 1 : 2),
                            start: Math.max(0, beat - 0.09),
                            duration: 0.08,
                            velocity: clamp01(shapeVelocity(s.accent, settings, salt) * 0.55),
                        });
                    }
                }

                lastCentre = Math.round(voiced.reduce((a, b) => a + b, 0) / voiced.length);
            }
        }

        /* ── Left hand ──────────────────────────────────────────────────── */
        if (settings.leftHand) {
            const steps = settings.manual
                ? manualSteps(settings.manual, 'left', pb).map(s => s.at)
                : leftSteps(settings.leftStyle, right.map(s => s.at), complexity);

            for (let i = 0; i < steps.length; i++) {
                const at = steps[i];
                if (at >= stepsPerBar) continue;
                const nominal = beatOf(at);
                if (nominal >= regionBeats) continue;
                const beat = Math.max(0, nominal + timingWander(settings, pb * 16 + at + 0.5));

                const chord = chordAt(harmony, nominal) ?? harmony[0];
                const root = chord.bass ?? chord.root;
                const base = pitchAtOrAbove(root, Math.max(KEYS_LOW, settings.leftPosition - 6));
                const salt = pb * 16 + at + 0.5;

                const nextAt = steps[i + 1] ?? stepsPerBar;
                const gap = Math.max(0.1, (stepToBeats(nextAt, settings) - stepToBeats(at, settings)) / rate);
                const held = settings.leftStyle === 'sustain-only'
                    ? Math.min(beatsPerBar, regionBeats - beat)
                    : gap * 0.9;

                const intervals = LEFT_INTERVALS[settings.leftVoicing];
                /*
                 * Broken: the same notes, rhythmically separate. Played
                 * together it would be indistinguishable from Root, Fifth &
                 * Octave, which is what makes it a real option rather than a
                 * second name for one.
                 */
                intervals.forEach((interval, n) => {
                    const offset = settings.leftVoicing === 'broken' ? n * (gap / intervals.length) : 0;
                    const pitch = base + interval;
                    if (pitch > KEYS_HIGH) return;
                    const start = beat + offset;
                    if (start >= regionBeats) return;
                    notes.push({
                        pitch,
                        start: Math.max(0, start),
                        duration: Math.max(0.08, settings.leftVoicing === 'broken'
                            ? gap / intervals.length * 0.9
                            : held),
                        velocity: clamp01(shapeVelocity(at === 0 ? 0.9 : 0.65, settings, salt + n)),
                    });
                });
            }
        }

        /*
         * A fill: a run up into the next chord across the last beat, in the
         * right hand, so the phrase hands over.
         */
        if (filling && settings.rightHand && !settings.manual) {
            const next = harmony.find(c => c.start >= (projectBar + 1) * beatsPerBar) ?? harmony[0];
            const tones = chordTones(next);
            const hits = Math.max(2, Math.round(2 + clamp01(settings.fillComplexity) * 4));
            const from = (projectBar + 1) * beatsPerBar - 1;
            for (let i = 0; i < hits; i++) {
                const beat = from + i / hits;
                if (beat >= regionBeats) continue;
                const pc = tones[i % tones.length];
                const pitch = Math.min(KEYS_HIGH,
                    pitchAtOrAbove(pc, settings.rightPosition - 6) + Math.floor(i / tones.length) * 12);
                notes.push({
                    pitch,
                    start: beat,
                    duration: (1 / hits) * 0.9,
                    velocity: shapeVelocity(0.55 + (i / hits) * 0.4, settings, projectBar * 100 + i),
                });
            }
        }
    }

    return notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
}
