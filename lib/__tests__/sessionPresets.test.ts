/**
 * @jest-environment jsdom
 *
 * User presets live in localStorage — they are carried between projects the
 * way a patch is, not stored in the project file — so this suite needs a
 * browser-shaped environment. The rest of `lib` runs under node.
 */
import {
    allPresets as everyPreset,
    applyPreset,
    presetPayload,
    saveUserPreset,
    deleteUserPreset,
    loadUserPresets,
    allPresets,
    matchPreset,
    type SessionPreset,
} from '@/lib/sessionPresets';
import { DEFAULT_DRUMMER_SETTINGS, emptyManualPattern, type DrummerSettings } from '@/lib/drummerPattern';

/** The Drummer's included presets - the ones these tests were written for. */
const DRUM_PRESETS = everyPreset('drummer').filter(p => p.builtIn);

const settings = (over: Partial<DrummerSettings> = {}): DrummerSettings =>
    ({ ...DEFAULT_DRUMMER_SETTINGS, ...over });

const preset = (over: Partial<DrummerSettings>): SessionPreset =>
    ({ name: 'Test', kind: 'drummer' as const, builtIn: false, settings: over });

beforeEach(() => {
    try { window.localStorage.clear(); } catch { /* no storage in this env */ }
});

describe('the presets on offer', () => {
    it('ships several, all marked as included', () => {
        expect(DRUM_PRESETS.length).toBeGreaterThanOrEqual(4);
        for (const p of DRUM_PRESETS) expect(p.builtIn).toBe(true);
    });

    it('gives each one a distinct name', () => {
        const names = DRUM_PRESETS.map(p => p.name);
        expect(new Set(names).size).toBe(names.length);
    });

    it('and settings that actually differ from one another', () => {
        const shapes = DRUM_PRESETS.map(p => JSON.stringify(p.settings));
        expect(new Set(shapes).size).toBe(shapes.length);
    });
});

describe('applying a preset', () => {
    it('takes the preset’s settings', () => {
        const next = applyPreset(settings({ complexity: 0.1 }), preset({ complexity: 0.9 }));
        expect(next.complexity).toBe(0.9);
    });

    /*
     * The locks are the reason this function exists rather than a spread. The
     * manual describes pinning Fill Amount and Swing precisely so browsing
     * presets cannot undo the two things most often dialled in by hand.
     */
    it('leaves the fills alone when they are locked', () => {
        const next = applyPreset(
            settings({ fillAmount: 0.8, fillComplexity: 0.9, lockFills: true }),
            preset({ fillAmount: 0.1, fillComplexity: 0.1 }),
        );
        expect(next.fillAmount).toBe(0.8);
        expect(next.fillComplexity).toBe(0.9);
    });

    it('and changes them when they are not', () => {
        const next = applyPreset(
            settings({ fillAmount: 0.8, lockFills: false }),
            preset({ fillAmount: 0.1 }),
        );
        expect(next.fillAmount).toBe(0.1);
    });

    it('leaves the swing alone when it is locked', () => {
        const next = applyPreset(
            settings({ swing: 0.7, swingGrid: '8th', lockSwing: true }),
            preset({ swing: 0, swingGrid: '16th' }),
        );
        expect(next.swing).toBe(0.7);
        expect(next.swingGrid).toBe('8th');
    });

    it('never discards the pattern you typed in', () => {
        const manual = emptyManualPattern(16);
        const next = applyPreset(settings({ manual }), DRUM_PRESETS[1]);
        expect(next.manual).toBe(manual);
    });

    it('nor the track the drummer was told to follow', () => {
        const next = applyPreset(settings({ followTrackId: 'guitar' }), DRUM_PRESETS[1]);
        expect(next.followTrackId).toBe('guitar');
    });

    it('nor the take you settled on', () => {
        const next = applyPreset(settings({ seed: 42 }), DRUM_PRESETS[1]);
        expect(next.seed).toBe(42);
    });

    it('leaves the locks themselves set', () => {
        const next = applyPreset(settings({ lockFills: true, lockSwing: true }), DRUM_PRESETS[1]);
        expect(next.lockFills).toBe(true);
        expect(next.lockSwing).toBe(true);
    });
});

describe('what a preset carries', () => {
    it('does not capture the region’s own state', () => {
        const payload = presetPayload(settings({
            seed: 9, followTrackId: 'x', manual: emptyManualPattern(16), lockSwing: true,
        }), 'drummer');
        expect(payload).not.toHaveProperty('seed');
        expect(payload).not.toHaveProperty('manual');
        expect(payload).not.toHaveProperty('followTrackId');
        expect(payload).not.toHaveProperty('lockSwing');
    });

    it('does capture the sound', () => {
        const payload = presetPayload(settings({ complexity: 0.77, cymbals: 'china' }), 'drummer');
        expect(payload.complexity).toBe(0.77);
        expect((payload as { cymbals?: string }).cymbals).toBe('china');
    });
});

describe('user presets', () => {
    it('saves and reads back', () => {
        saveUserPreset('Mine', settings({ complexity: 0.42 }), 'drummer');
        const loaded = loadUserPresets('drummer');
        expect(loaded.map(p => p.name)).toEqual(['Mine']);
        expect(loaded[0].settings.complexity).toBe(0.42);
        expect(loaded[0].builtIn).toBe(false);
    });

    it('replaces rather than duplicating a name', () => {
        saveUserPreset('Mine', settings({ complexity: 0.2 }), 'drummer');
        saveUserPreset('Mine', settings({ complexity: 0.8 }), 'drummer');
        const loaded = loadUserPresets('drummer');
        expect(loaded).toHaveLength(1);
        expect(loaded[0].settings.complexity).toBe(0.8);
    });

    it('ignores an empty name rather than saving a nameless preset', () => {
        saveUserPreset('   ', settings(), 'drummer');
        expect(loadUserPresets('drummer')).toHaveLength(0);
    });

    it('deletes one', () => {
        saveUserPreset('Mine', settings(), 'drummer');
        expect(deleteUserPreset('Mine', 'drummer')).toHaveLength(0);
    });

    it('refuses to delete an included preset', () => {
        saveUserPreset('Mine', settings(), 'drummer');
        deleteUserPreset(DRUM_PRESETS[0].name, 'drummer');
        expect(DRUM_PRESETS.some(p => p.name === DRUM_PRESETS[0].name)).toBe(true);
        expect(loadUserPresets('drummer')).toHaveLength(1);
    });

    it('lists included presets before saved ones', () => {
        saveUserPreset('Mine', settings(), 'drummer');
        const all = allPresets('drummer');
        expect(all[0].builtIn).toBe(true);
        expect(all[all.length - 1].name).toBe('Mine');
    });

    it('survives corrupted storage rather than throwing', () => {
        try {
            window.localStorage.setItem('magicPro.sessionPresets.drummer', 'not json');
        } catch { return; }
        expect(loadUserPresets('drummer')).toEqual([]);
    });

    it('drops entries that are not presets', () => {
        try {
            window.localStorage.setItem('magicPro.sessionPresets.drummer',
                JSON.stringify([{ nope: 1 }, { name: 'Ok', settings: { complexity: 0.5 } }]));
        } catch { return; }
        expect(loadUserPresets('drummer').map(p => p.name)).toEqual(['Ok']);
    });
});

describe('naming the current settings', () => {
    it('recognises settings that came from a preset', () => {
        const applied = applyPreset(settings(), DRUM_PRESETS[3]);
        expect(matchPreset(applied, [...DRUM_PRESETS], 'drummer')).toBe(DRUM_PRESETS[3].name);
    });

    it('ignores the take, which is not part of the sound', () => {
        const applied = { ...applyPreset(settings(), DRUM_PRESETS[2]), seed: 512 };
        expect(matchPreset(applied, [...DRUM_PRESETS], 'drummer')).toBe(DRUM_PRESETS[2].name);
    });

    /*
     * A lock is a statement that this setting is yours, not the preset's. Left
     * in the comparison, setting one lock made every preset read as "Custom"
     * from then on — the name going blank exactly when it was most useful.
     */
    it('still names the preset when a locked setting differs', () => {
        const applied = {
            ...applyPreset(settings({ lockSwing: true }), DRUM_PRESETS[3]),
            swing: 0.9,
        };
        expect(matchPreset(applied, [...DRUM_PRESETS], 'drummer')).toBe(DRUM_PRESETS[3].name);
    });

    it('and does not when an unlocked one does', () => {
        const applied = { ...applyPreset(settings(), DRUM_PRESETS[3]), swing: 0.9 };
        expect(matchPreset(applied, [...DRUM_PRESETS], 'drummer')).toBeNull();
    });

    it('says nothing when the settings match none of them', () => {
        const odd = settings({ complexity: 0.123456, variation: 3, cymbalVariation: 6, intensity: 0.987 });
        expect(matchPreset(odd, [...DRUM_PRESETS], 'drummer')).toBeNull();
    });
});
