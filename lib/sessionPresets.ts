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
import {
    DEFAULT_DRUMMER_SETTINGS,
    type DrummerSettings,
} from '@/lib/drummerPattern';

export interface SessionPreset {
    name: string;
    /** Included presets cannot be deleted; the manual is explicit about that. */
    builtIn: boolean;
    settings: Partial<DrummerSettings>;
}

/** The settings a preset is allowed to carry. */
const PRESET_KEYS = [
    'variation', 'cymbalVariation', 'complexity', 'intensity',
    'swing', 'swingGrid', 'pieces', 'ghostNotes', 'feel', 'dynamics',
    'humanize', 'fillAmount', 'fillComplexity', 'snare', 'hiHat',
    'percussion', 'cymbals', 'toms', 'tempoMode', 'phraseVariation',
] as const;

/**
 * What a preset leaves alone.
 *
 * `manual` is the pattern you typed in, `seed` is the take you settled on and
 * `followTrackId` is the part you told this drummer to lock to. None of those
 * is a style, so browsing styles must not silently discard them.
 */
export function presetPayload(settings: DrummerSettings): Partial<DrummerSettings> {
    const out: Partial<DrummerSettings> = {};
    for (const key of PRESET_KEYS) {
        (out as Record<string, unknown>)[key] = settings[key];
    }
    return out;
}

export const BUILT_IN_PRESETS: readonly SessionPreset[] = [
    {
        name: 'Straight Ahead',
        builtIn: true,
        settings: presetPayload(DEFAULT_DRUMMER_SETTINGS),
    },
    {
        name: 'Back Room',
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
 * Apply a preset to the settings a region already has.
 *
 * The locks are the point of the whole function. The manual describes pinning
 * Fill Amount and Swing so that browsing presets does not undo the two things
 * you most often dial in by hand — without that, a preset menu is a way to
 * lose work rather than to find a sound.
 */
export function applyPreset(
    current: DrummerSettings,
    preset: SessionPreset,
): DrummerSettings {
    const next: DrummerSettings = { ...current, ...preset.settings };

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

const STORAGE_KEY = 'magicPro.sessionPresets.drummer';

/**
 * Presets the user saved.
 *
 * Kept out of the project file deliberately: a preset is a thing you carry
 * between projects, the way a patch is. Every read is guarded — a private
 * window, cleared site data or a browser set to block storage all make this
 * throw rather than return null.
 */
export function loadUserPresets(): SessionPreset[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((p): p is SessionPreset =>
                !!p && typeof p.name === 'string' && !!p.settings && typeof p.settings === 'object')
            .map(p => ({ name: p.name, builtIn: false, settings: p.settings }));
    } catch {
        return [];
    }
}

function writeUserPresets(presets: SessionPreset[]): SessionPreset[] {
    if (typeof window === 'undefined') return presets;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    } catch {
        /* Storage is unavailable; the presets still work for this session. */
    }
    return presets;
}

/** Save, replacing any user preset of the same name. */
export function saveUserPreset(name: string, settings: DrummerSettings): SessionPreset[] {
    const trimmed = name.trim();
    if (!trimmed) return loadUserPresets();
    const kept = loadUserPresets().filter(p => p.name !== trimmed);
    return writeUserPresets([...kept, {
        name: trimmed, builtIn: false, settings: presetPayload(settings),
    }]);
}

/** Delete a user preset. Included presets are refused, as the manual says. */
export function deleteUserPreset(name: string): SessionPreset[] {
    if (BUILT_IN_PRESETS.some(p => p.name === name)) return loadUserPresets();
    return writeUserPresets(loadUserPresets().filter(p => p.name !== name));
}

/** Every preset on offer, included ones first. */
export function allPresets(): SessionPreset[] {
    return [...BUILT_IN_PRESETS, ...loadUserPresets()];
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
export function matchPreset(settings: DrummerSettings, presets: SessionPreset[]): string | null {
    const pinned = new Set<string>();
    if (settings.lockSwing) { pinned.add('swing'); pinned.add('swingGrid'); }
    if (settings.lockFills) { pinned.add('fillAmount'); pinned.add('fillComplexity'); }

    for (const preset of presets) {
        const same = PRESET_KEYS.every(key => {
            if (pinned.has(key)) return true;
            const want = preset.settings[key];
            if (want === undefined) return true;
            return JSON.stringify(want) === JSON.stringify(settings[key]);
        });
        if (same) return preset.name;
    }
    return null;
}
