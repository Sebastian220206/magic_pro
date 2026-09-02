/**
 * The Session Player types and their styles.
 *
 * The manual's Session Player dialog: a Type pop-up (Drummer, Bass Player,
 * Keyboard Player) and, under it, a list of styles grouped by genre. Choosing
 * one loads that style's settings and its instrument patch.
 *
 * Every style here is a real set of settings — a style that only changed a
 * label would be the decorative-control problem wearing a different hat. What
 * a style does *not* carry is anything the user has pinned: the locks on Fills
 * and Swing, and "Keep Settings when Changing Style", are honoured by the
 * caller.
 */
import type { DrummerSettings } from './drummerPattern';
import type { BassSettings } from './bassPlayer';
import type { KeyboardSettings } from './keyboardPlayer';

export type SessionPlayerKind = 'drummer' | 'bass' | 'keyboard';

export interface SessionStyle<S> {
    name: string;
    /** The heading it sits under in the dialog. */
    group: string;
    /** The instrument patch this style loads onto the track. */
    patch: string;
    /** What it changes. Anything absent keeps its current value. */
    settings: Partial<S>;
}

/** The one thing every kind can answer about itself. */
export const PLAYER_LABEL: Record<SessionPlayerKind, string> = {
    drummer: 'Drummer',
    bass: 'Bass Player',
    keyboard: 'Keyboard Player',
};

/** The track type each player lives on. */
export const PLAYER_TRACK_TYPE: Record<SessionPlayerKind, string> = {
    drummer: 'drummer',
    bass: 'bass-player',
    keyboard: 'keyboard-player',
};

/** Which player a track type carries, or null when it carries none. */
export function playerForTrackType(type: string | undefined | null): SessionPlayerKind | null {
    if (type === 'drummer') return 'drummer';
    if (type === 'bass-player') return 'bass';
    if (type === 'keyboard-player') return 'keyboard';
    return null;
}

export const DRUMMER_STYLES: ReadonlyArray<SessionStyle<DrummerSettings>> = [
    {
        name: 'Roots Songwriter', group: 'Acoustic', patch: 'Acoustic Kit',
        settings: {
            variation: 2, cymbalVariation: 2, complexity: 0.4, intensity: 0.55,
            swing: 0.1, swingGrid: '8th', ghostNotes: 0.25, feel: -0.15,
            fillAmount: 0.25, fillComplexity: 0.35, hiHat: 'automatic',
            pieces: { kick: true, snare: true, hat: true, ride: false, toms: true, percussion: false },
        },
    },
    {
        name: 'Pop Brush', group: 'Acoustic', patch: 'Brush Kit',
        settings: {
            variation: 5, cymbalVariation: 3, complexity: 0.35, intensity: 0.4,
            swing: 0.35, swingGrid: '8th', ghostNotes: 0.45, snare: 'rim',
            dynamics: 0.7, feel: -0.3, fillAmount: 0.15, hiHat: 'closed',
            pieces: { kick: true, snare: true, hat: true, ride: false, toms: true, percussion: false },
        },
    },
    {
        name: 'Smash', group: 'Rock', patch: 'Rock Kit',
        settings: {
            variation: 6, cymbalVariation: 6, complexity: 0.6, intensity: 0.85,
            swing: 0, ghostNotes: 0.1, dynamics: 0.35, feel: 0.1,
            fillAmount: 0.5, fillComplexity: 0.6, cymbals: 'crash',
            pieces: { kick: true, snare: true, hat: true, ride: false, toms: true, percussion: false },
        },
    },
    {
        name: 'Deep House', group: 'Electronic', patch: 'Electronic Kit',
        settings: {
            variation: 1, cymbalVariation: 5, complexity: 0.55, intensity: 0.7,
            swing: 0, ghostNotes: 0, dynamics: 0.2, humanize: 0.05, feel: 0,
            fillAmount: 0.15, percussion: 'shaker',
            pieces: { kick: true, snare: true, hat: true, ride: false, toms: false, percussion: true },
        },
    },
    {
        name: 'Dubstep', group: 'Electronic', patch: 'Electronic Kit',
        settings: {
            variation: 5, cymbalVariation: 8, complexity: 0.75, intensity: 0.8,
            swing: 0, ghostNotes: 0.15, dynamics: 0.6, humanize: 0.05,
            tempoMode: 'half-time', fillAmount: 0.45, fillComplexity: 0.8,
            pieces: { kick: true, snare: true, hat: true, ride: false, toms: true, percussion: false },
        },
    },
    {
        name: 'Latin Percussion', group: 'Percussion', patch: 'Percussion',
        settings: {
            variation: 3, cymbalVariation: 4, complexity: 0.7, intensity: 0.6,
            swing: 0.15, ghostNotes: 0.35, percussion: 'tambourine',
            fillAmount: 0.3, snare: 'rim',
            pieces: { kick: true, snare: true, hat: true, ride: false, toms: true, percussion: true },
        },
    },
];

export const BASS_STYLES: ReadonlyArray<SessionStyle<BassSettings>> = [
    {
        name: 'Pop Songwriter', group: 'Electric', patch: 'Electric Bass',
        settings: {
            variation: 3, complexity: 0.4, intensity: 0.6, melody: 'root-fifth',
            octaves: 'few', phrasing: 'medium', alignRoot: true,
            deadNotes: 0.05, slides: 0.1, muteOffset: 0.1, fillAmount: 0.2,
        },
    },
    {
        name: 'Retro Rock', group: 'Electric', patch: 'Electric Bass',
        settings: {
            variation: 5, complexity: 0.55, intensity: 0.75, melody: 'chord-tones',
            octaves: 'some', phrasing: 'short', deadNotes: 0.15, pickupHits: true,
            slides: 0.2, muteOffset: 0.35, fillAmount: 0.35,
        },
    },
    {
        name: 'Modern R&B', group: 'Electric', patch: 'Electric Bass',
        settings: {
            variation: 6, complexity: 0.6, intensity: 0.55, melody: 'passing',
            octaves: 'some', phrasing: 'long', swing: 0.2, swingGrid: '16th',
            feel: -0.35, slides: 0.4, deadNotes: 0.25, dynamics: 0.7,
        },
    },
    {
        name: 'Disco Slap', group: 'Electric', patch: 'Electric Bass',
        settings: {
            variation: 8, complexity: 0.75, intensity: 0.8, melody: 'chord-tones',
            octaves: 'more', phrasing: 'short', deadNotes: 0.45, muteOffset: 0.5,
            pickupHits: true, fillAmount: 0.4, fillComplexity: 0.7,
        },
    },
    {
        name: 'Roots Upright', group: 'Acoustic', patch: 'Upright Bass',
        settings: {
            variation: 3, complexity: 0.45, intensity: 0.5, melody: 'passing',
            octaves: 'off', phrasing: 'medium', swing: 0.4, swingGrid: '8th',
            feel: -0.2, deadNotes: 0.1, slides: 0.25, alignRoot: true,
            lowestNote: 28, humanize: 0.35,
        },
    },
    {
        name: '808 Bass', group: 'Synth', patch: 'Synth Bass',
        settings: {
            variation: 2, complexity: 0.35, intensity: 0.9, melody: 'root-only',
            octaves: 'few', phrasing: 'long', humanize: 0.02, dynamics: 0.15,
            slides: 0.5, deadNotes: 0, muteOffset: 0, fillAmount: 0.15,
        },
    },
    {
        name: 'Pump Bass', group: 'Synth', patch: 'Synth Bass',
        settings: {
            variation: 5, complexity: 0.5, intensity: 0.85, melody: 'root-only',
            octaves: 'off', phrasing: 'short', humanize: 0.02, dynamics: 0.1,
            muteOffset: 0.2, fillAmount: 0.1,
        },
    },
    {
        name: 'Sequenced Bass', group: 'Synth', patch: 'Synth Bass',
        settings: {
            variation: 8, complexity: 0.8, intensity: 0.75, melody: 'chord-tones',
            octaves: 'some', phrasing: 'short', humanize: 0.02, dynamics: 0.5,
            deadNotes: 0.1, fillAmount: 0.25,
        },
    },
];

export const KEYBOARD_STYLES: ReadonlyArray<SessionStyle<KeyboardSettings>> = [
    {
        name: 'Freely', group: 'Piano', patch: 'Grand Piano',
        settings: {
            variation: 4, complexity: 0.45, intensity: 0.55,
            leftVoicing: 'root-fifth', leftStyle: 'simple',
            rightVoicing: 'four-voice', rightMovement: 'medium',
            phrasing: 'legato', graceNotes: 0.15, humanize: 0.3, feel: -0.1,
        },
    },
    {
        name: 'Broken Chords', group: 'Piano', patch: 'Grand Piano',
        settings: {
            variation: 5, complexity: 0.55, intensity: 0.5,
            leftVoicing: 'broken', leftStyle: 'moderate',
            rightVoicing: 'triad', rightMovement: 'minimal',
            phrasing: 'legato', graceNotes: 0.1,
        },
    },
    {
        name: 'Block Chords', group: 'Piano', patch: 'Grand Piano',
        settings: {
            variation: 3, complexity: 0.35, intensity: 0.7,
            leftVoicing: 'root-octave', leftStyle: 'steady-4ths',
            rightVoicing: 'full-chord', rightMovement: 'minimal',
            phrasing: 'mixed', graceNotes: 0,
        },
    },
    {
        name: 'Arpeggiated', group: 'Piano', patch: 'Grand Piano',
        settings: {
            variation: 8, complexity: 0.7, intensity: 0.5,
            leftVoicing: 'root-only', leftStyle: 'sustain-only',
            rightVoicing: 'extensions', rightMovement: 'wide',
            phrasing: 'staccato', graceNotes: 0.05, humanize: 0.15,
        },
    },
    {
        name: 'Rhythmic Chords', group: 'Synth', patch: 'Synth Pad',
        settings: {
            variation: 6, complexity: 0.65, intensity: 0.7,
            leftVoicing: 'root-only', leftStyle: 'follow-right-hand',
            rightVoicing: 'four-voice', rightMovement: 'minimal',
            phrasing: 'staccato', graceNotes: 0, humanize: 0.05, dynamics: 0.6,
        },
    },
    {
        name: 'Simple Pad', group: 'Synth', patch: 'Synth Pad',
        settings: {
            variation: 1, complexity: 0.2, intensity: 0.4,
            leftVoicing: 'root-octave', leftStyle: 'sustain-only',
            rightVoicing: 'four-voice', rightMovement: 'minimal',
            phrasing: 'legato', graceNotes: 0, humanize: 0.05, fillAmount: 0,
        },
    },
    {
        name: 'Modulated Pad', group: 'Synth', patch: 'Synth Pad',
        settings: {
            variation: 2, complexity: 0.3, intensity: 0.5,
            leftVoicing: 'root-fifth-octave', leftStyle: 'sustain-only',
            rightVoicing: 'extensions', rightMovement: 'medium',
            phrasing: 'legato', graceNotes: 0, dynamics: 0.7, fillAmount: 0,
        },
    },
];

/** Every style a kind offers. */
export function stylesFor(kind: SessionPlayerKind): ReadonlyArray<SessionStyle<never>> {
    const list = kind === 'drummer' ? DRUMMER_STYLES
        : kind === 'bass' ? BASS_STYLES
            : KEYBOARD_STYLES;
    return list as ReadonlyArray<SessionStyle<never>>;
}

/** The style a kind starts on. */
export function defaultStyle(kind: SessionPlayerKind): string {
    return stylesFor(kind)[0].name;
}

/** Styles grouped under their headings, in the order the dialog lists them. */
export function styleGroups(kind: SessionPlayerKind): Array<{ group: string; styles: SessionStyle<never>[] }> {
    const out: Array<{ group: string; styles: SessionStyle<never>[] }> = [];
    for (const style of stylesFor(kind)) {
        const found = out.find(g => g.group === style.group);
        if (found) found.styles.push(style);
        else out.push({ group: style.group, styles: [style] });
    }
    return out;
}

/** Find a style by name within a kind. */
export function findStyle(kind: SessionPlayerKind, name: string | undefined | null): SessionStyle<never> | undefined {
    if (!name) return undefined;
    return stylesFor(kind).find(s => s.name === name);
}
