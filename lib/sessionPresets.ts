/**
 * Session Player presets.
 *
 * The panel's header said `PRESET <track name>`, which was not a preset — it
 * was the track's own name in a slot labelled something else. This is the
 * thing that label was promising: named settings you can browse, save, copy
 * between regions, and go back from.
 *
 * A preset is a *partial* set of settings on purpose. `manual`, `seed` and
 * `followTrackId` belong to the region rather than to a style: recalling a
 * preset must not throw away the pattern you typed in or the track you told
 * the drummer to lock to.
 */
import { DEFAULT_DRUMMER_SETTINGS, type DrummerSettings } from '@/lib/drummerPattern';
import { DEFAULT_BASS_SETTINGS, type BassSettings } from '@/lib/bassPlayer';
import { DEFAULT_KEYBOARD_SETTINGS, type KeyboardSettings } from '@/lib/keyboardPlayer';
import type { SessionPlayerKind } from '@/lib/sessionStyles';

/** Whichever player's settings are in hand. */
export type AnySessionSettings = DrummerSettings | BassSettings | KeyboardSettings;

export interface SessionPreset {
    name: string;
    /** Which player it belongs to - a drum preset means nothing to a bass. */
    kind: SessionPlayerKind;
    /** Included presets cannot be deleted; the manual is explicit about that. */
    builtIn: boolean;
    settings: Partial<AnySessionSettings>;
}

/** The settings every player's preset carries. */
const COMMON_KEYS = [
    'variation', 'complexity', 'intensity', 'swing', 'swingGrid',
    'feel', 'dynamics', 'humanize', 'fillAmount', 'fillComplexity',
    'tempoMode', 'phraseVariation', 'followChords',
] as const;

/** And what each adds to them. */
const KIND_KEYS: Record<SessionPlayerKind, readonly string[]> = {
    drummer: ['cymbalVariation', 'pieces', 'ghostNotes', 'snare', 'hiHat', 'percussion', 'cymbals', 'toms'],
    bass: ['melody', 'octaves', 'phrasing', 'lowestNote', 'muteOffset', 'dynamicMute',
        'deadNotes', 'pickupHits', 'slides', 'alignRoot'],
    keyboard: ['leftHand', 'rightHand', 'leftPosition', 'rightPosition', 'leftVoicing',
        'leftStyle', 'rightVoicing', 'rightMovement', 'graceNotes', 'phrasing'],
};

const keysFor = (kind: SessionPlayerKind): readonly string[] => [...COMMON_KEYS, ...KIND_KEYS[kind]];

/** The settings a fresh player of this kind starts from. */
export function defaultsFor(kind: SessionPlayerKind): AnySessionSettings {
    return kind === 'drummer' ? DEFAULT_DRUMMER_SETTINGS
        : kind === 'bass' ? DEFAULT_BASS_SETTINGS
            : DEFAULT_KEYBOARD_SETTINGS;
}

/**
 * What a preset leaves alone.
 *
 * `manual` is the pattern you typed in, `seed` is the take you settled on and
 * `followTrackId` is the part you told this drummer to lock to. None of those
 * is a style, so browsing styles must not silently discard them.
 */
export function presetPayload(
    settings: AnySessionSettings,
    kind: SessionPlayerKind,
): Partial<AnySessionSettings> {
    const out: Record<string, unknown> = {};
    for (const key of keysFor(kind)) {
        if (key in settings) out[key] = (settings as unknown as Record<string, unknown>)[key];
    }
    return out as Partial<AnySessionSettings>;
}

const DRUMMER_PRESETS: readonly SessionPreset[] = [
    {
        name: 'Straight Ahead',
        kind: 'drummer',
        builtIn: true,
        settings: presetPayload(DEFAULT_DRUMMER_SETTINGS, 'drummer'),
    },
    {
        name: 'Back Room',
        kind: 'drummer',
        builtIn: true,
        settings: {
            variation: 2, cymbalVariation: 2, complexity: 0.3, intensity: 0.45,
            swing: 0.15, swingGrid: '8th', ghostNotes: 0.35, feel: -0.3,
            dynamics: 0.7, humanize: 0.45, fillAmount: 0.2, fillComplexity: 0.25,
            snare: 'center', hiHat: 'closed', percussion: 'off',
            cymbals: 'crash', toms: 'low', tempoMode: 'automatic', phraseVariation: 0.3,
            pieces: { kick: true, snare: true, hat: true, ride: false, toms: true, percussion: false },
        },
    },
    {
        name: 'Quiet Verse',
        kind: 'drummer',
        builtIn: true,
        settings: {
            variation: 5, cymbalVariation: 5, complexity: 0.2, intensity: 0.25,
            swing: 0, swingGrid: '16th', ghostNotes: 0.15, feel: -0.15,
            dynamics: 0.8, humanize: 0.3, fillAmount: 0.1, fillComplexity: 0.2,
            snare: 'rim', hiHat: 'closed', percussion: 'off',
            cymbals: 'splash', toms: 'low', tempoMode: 'automatic', phraseVariation: 0.15,
            pieces: { kick: true, snare: true, hat: true, ride: false, toms: false, percussion: false },
        },
    },
    {
        name: 'Big Chorus',
        kind: 'drummer',
        builtIn: true,
        settings: {
            variation: 8, cymbalVariation: 6, complexity: 0.8, intensity: 0.9,
            swing: 0, swingGrid: '16th', ghostNotes: 0.1, feel: 0.2,
            dynamics: 0.35, humanize: 0.15, fillAmount: 0.7, fillComplexity: 0.75,
            snare: 'center', hiHat: 'open', percussion: 'off',
            cymbals: 'crash', toms: 'full', tempoMode: 'automatic', phraseVariation: 0.35,
            pieces: { kick: true, snare: true, hat: false, ride: true, toms: true, percussion: false },
        },
    },
    {
        name: 'Shuffle',
        kind: 'drummer',
        builtIn: true,
        settings: {
            variation: 7, cymbalVariation: 7, complexity: 0.55, intensity: 0.6,
            swing: 0.62, swingGrid: '8th', ghostNotes: 0.45, feel: -0.2,
            dynamics: 0.65, humanize: 0.35, fillAmount: 0.3, fillComplexity: 0.5,
            snare: 'center', hiHat: 'automatic', percussion: 'off',
            cymbals: 'crash', toms: 'full', tempoMode: 'automatic', phraseVariation: 0.4,
            pieces: { kick: true, snare: true, hat: true, ride: false, toms: true, percussion: false },
        },
    },
    {
        name: 'Four On The Floor',
        kind: 'drummer',
        builtIn: true,
        settings: {
            variation: 1, cymbalVariation: 2, complexity: 0.65, intensity: 0.75,
            swing: 0, swingGrid: '16th', ghostNotes: 0, feel: 0.1,
            dynamics: 0.2, humanize: 0.05, fillAmount: 0.15, fillComplexity: 0.3,
            snare: 'center', hiHat: 'open', percussion: 'shaker',
            cymbals: 'crash', toms: 'high', tempoMode: 'automatic', phraseVariation: 0.1,
            pieces: { kick: true, snare: true, hat: true, ride: false, toms: false, percussion: true },
        },
    },
];

/**
 * The Bass Player's included presets.
 *
 * Written as whole sounds rather than as one-setting nudges: a preset is the
 * quick way to reach somewhere, and something that only moved Complexity would
 * be a slider with a name.
 */
const BASS_PRESETS: readonly SessionPreset[] = [
    {
        name: 'Straight Talk',
        kind: 'bass',
        builtIn: true,
        settings: presetPayload(DEFAULT_BASS_SETTINGS, 'bass'),
    },
    {
        name: 'Locked In',
        kind: 'bass',
        builtIn: true,
        settings: {
            variation: 3, complexity: 0.3, intensity: 0.65, melody: 'root-only',
            octaves: 'off', phrasing: 'short', muteOffset: 0.3, deadNotes: 0.1,
            swing: 0, feel: 0, fillAmount: 0.1, alignRoot: true,
        },
    },
    {
        name: 'Walking',
        kind: 'bass',
        builtIn: true,
        settings: {
            variation: 5, complexity: 0.7, intensity: 0.55, melody: 'passing',
            octaves: 'few', phrasing: 'medium', swing: 0.45, swingGrid: '8th',
            feel: -0.2, humanize: 0.35, deadNotes: 0.05, fillAmount: 0.3,
        },
    },
    {
        name: 'Laid Back',
        kind: 'bass',
        builtIn: true,
        settings: {
            variation: 4, complexity: 0.45, intensity: 0.45, melody: 'chord-tones',
            octaves: 'few', phrasing: 'long', swing: 0.2, feel: -0.5,
            slides: 0.35, dynamics: 0.7, humanize: 0.4, fillAmount: 0.2,
        },
    },
    {
        name: 'Driving Eighths',
        kind: 'bass',
        builtIn: true,
        settings: {
            variation: 5, complexity: 0.6, intensity: 0.85, melody: 'root-fifth',
            octaves: 'some', phrasing: 'short', muteOffset: 0.2, pickupHits: true,
            feel: 0.15, fillAmount: 0.4, fillComplexity: 0.6,
        },
    },
    {
        name: 'Slap Happy',
        kind: 'bass',
        builtIn: true,
        settings: {
            variation: 8, complexity: 0.85, intensity: 0.8, melody: 'chord-tones',
            octaves: 'more', phrasing: 'short', deadNotes: 0.5, muteOffset: 0.55,
            pickupHits: true, slides: 0.3, fillAmount: 0.45, fillComplexity: 0.75,
        },
    },
];

/** The Keyboard Player's included presets. */
const KEYBOARD_PRESETS: readonly SessionPreset[] = [
    {
        name: 'Sweet Memories',
        kind: 'keyboard',
        builtIn: true,
        settings: presetPayload(DEFAULT_KEYBOARD_SETTINGS, 'keyboard'),
    },
    {
        name: 'Gentle Ballad',
        kind: 'keyboard',
        builtIn: true,
        settings: {
            variation: 2, complexity: 0.25, intensity: 0.4,
            leftVoicing: 'root-fifth', leftStyle: 'sustain-only',
            rightVoicing: 'four-voice', rightMovement: 'minimal',
            phrasing: 'legato', graceNotes: 0.2, humanize: 0.35,
            feel: -0.3, dynamics: 0.7, fillAmount: 0.1,
        },
    },
    {
        name: 'Big Chords',
        kind: 'keyboard',
        builtIn: true,
        settings: {
            variation: 3, complexity: 0.4, intensity: 0.85,
            leftVoicing: 'root-octave', leftStyle: 'steady-4ths',
            rightVoicing: 'full-chord', rightMovement: 'minimal',
            phrasing: 'mixed', graceNotes: 0, dynamics: 0.35, fillAmount: 0.35,
        },
    },
    {
        name: 'Carry On',
        kind: 'keyboard',
        builtIn: true,
        settings: {
            variation: 5, complexity: 0.6, intensity: 0.6,
            leftVoicing: 'broken', leftStyle: 'moderate',
            rightVoicing: 'triad', rightMovement: 'medium',
            phrasing: 'mixed', graceNotes: 0.1, fillAmount: 0.3,
        },
    },
    {
        name: 'Keep Moving',
        kind: 'keyboard',
        builtIn: true,
        settings: {
            variation: 8, complexity: 0.75, intensity: 0.7,
            leftVoicing: 'root-only', leftStyle: 'follow-right-hand',
            rightVoicing: 'extensions', rightMovement: 'wide',
            phrasing: 'staccato', graceNotes: 0.05, humanize: 0.1,
            fillAmount: 0.4, fillComplexity: 0.65,
        },
    },
    {
        name: 'Lullaby',
        kind: 'keyboard',
        builtIn: true,
        settings: {
            variation: 1, complexity: 0.15, intensity: 0.3,
            leftVoicing: 'root-fifth-octave', leftStyle: 'sustain-only',
            rightVoicing: 'triad', rightMovement: 'minimal',
            phrasing: 'legato', graceNotes: 0.05, humanize: 0.25,
            dynamics: 0.6, fillAmount: 0,
        },
    },
];

/** The included presets for one player. */
function builtInsFor(kind: SessionPlayerKind): readonly SessionPreset[] {
    return kind === 'drummer' ? DRUMMER_PRESETS
        : kind === 'bass' ? BASS_PRESETS
            : KEYBOARD_PRESETS;
}

/**
 * Apply a preset to the settings a region already has.
 *
 * The locks are the point of the whole function. The manual describes pinning
 * Fill Amount and Swing so that browsing presets does not undo the two things
 * you most often dial in by hand — without that, a preset menu is a way to
 * lose work rather than to find a sound.
 */
export function applyPreset<S extends AnySessionSettings>(
    current: S,
    preset: SessionPreset,
): S {
    const next = { ...current, ...preset.settings } as S;

    if (current.lockFills) {
        next.fillAmount = current.fillAmount;
        next.fillComplexity = current.fillComplexity;
    }
    if (current.lockSwing) {
        next.swing = current.swing;
        next.swingGrid = current.swingGrid;
    }

    // The region's own things, never a style's.
    next.manual = current.manual;
    next.followTrackId = current.followTrackId;
    next.lockFills = current.lockFills;
    next.lockSwing = current.lockSwing;
    next.seed = current.seed;
    return next;
}

/* ── User presets ───────────────────────────────────────────────────────── */

const storageKey = (kind: SessionPlayerKind) => 'magicPro.sessionPresets.' + kind;

/**
 * Presets the user saved.
 *
 * Kept out of the project file deliberately: a preset is a thing you carry
 * between projects, the way a patch is. Every read is guarded — a private
 * window, cleared site data or a browser set to block storage all make this
 * throw rather than return null.
 */
export function loadUserPresets(kind: SessionPlayerKind): SessionPreset[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(storageKey(kind));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((p): p is SessionPreset =>
                !!p && typeof p.name === 'string' && !!p.settings && typeof p.settings === 'object')
            .map(p => ({ name: p.name, kind, builtIn: false, settings: p.settings }));
    } catch {
        return [];
    }
}

function writeUserPresets(kind: SessionPlayerKind, presets: SessionPreset[]): SessionPreset[] {
    if (typeof window === 'undefined') return presets;
    try {
        window.localStorage.setItem(storageKey(kind), JSON.stringify(presets));
    } catch {
        /* Storage is unavailable; the presets still work for this session. */
    }
    return presets;
}

/** Save, replacing any user preset of the same name. */
export function saveUserPreset(
    name: string, settings: AnySessionSettings, kind: SessionPlayerKind,
): SessionPreset[] {
    const trimmed = name.trim();
    if (!trimmed) return loadUserPresets(kind);
    const kept = loadUserPresets(kind).filter(p => p.name !== trimmed);
    return writeUserPresets(kind, [...kept, {
        name: trimmed, kind, builtIn: false, settings: presetPayload(settings, kind),
    }]);
}

/** Delete a user preset. Included presets are refused, as the manual says. */
export function deleteUserPreset(name: string, kind: SessionPlayerKind): SessionPreset[] {
    if (builtInsFor(kind).some(p => p.name === name)) return loadUserPresets(kind);
    return writeUserPresets(kind, loadUserPresets(kind).filter(p => p.name !== name));
}

/** Every preset on offer for a kind, included ones first. */
export function allPresets(kind: SessionPlayerKind): SessionPreset[] {
    return [...builtInsFor(kind), ...loadUserPresets(kind)];
}

/**
 * Which preset a region's settings match, if any.
 *
 * Compared on the preset's own keys only, so a region that differs from
 * "Shuffle" solely in the take it is on still reads as Shuffle.
 *
 * A locked setting is skipped. Pinning the swing is a statement that the swing
 * is yours rather than the preset's — so a preset loaded over a locked swing is
 * still that preset, and reporting "Custom" the instant a lock is set made the
 * name useless exactly when it was needed.
 */
export function matchPreset(
    settings: AnySessionSettings,
    presets: SessionPreset[],
    kind: SessionPlayerKind,
): string | null {
    const pinned = new Set<string>();
    if (settings.lockSwing) { pinned.add('swing'); pinned.add('swingGrid'); }
    if (settings.lockFills) { pinned.add('fillAmount'); pinned.add('fillComplexity'); }

    for (const preset of presets) {
        const same = keysFor(kind).every(key => {
            if (pinned.has(key)) return true;
            const want = (preset.settings as Record<string, unknown>)[key];
            if (want === undefined) return true;
            return JSON.stringify(want) === JSON.stringify((settings as unknown as Record<string, unknown>)[key]);
        });
        if (same) return preset.name;
    }
    return null;
}
