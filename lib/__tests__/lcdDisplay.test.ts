import {
    LCD_DISPLAY_MODES,
    DEFAULT_LCD_DISPLAY_MODE,
    isLcdDisplayMode,
    resolveLcdDisplayMode,
} from '@/lib/lcdDisplayModes';
import {
    loadFraction,
    activityTitle,
    VOICE_CEILING,
    CLIP_CEILING,
} from '@/lib/engineActivity';

/**
 * The mode list was written out three times and had already drifted: the
 * control bar customiser offered "Beats & Project (Large)" and
 * "Beats & Time (Large)", which are in no union and no switch — choosing
 * either passed an unhandled string through `as any` and the display quietly
 * fell back to its default.
 */
describe('display modes', () => {
    it('carries the modes the display can actually render', () => {
        expect(LCD_DISPLAY_MODES).toContain('Beats & Project');
        expect(LCD_DISPLAY_MODES).toContain('Timecode');
        expect(LCD_DISPLAY_MODES).toContain('Custom');
    });

    it('has no duplicates', () => {
        expect(new Set(LCD_DISPLAY_MODES).size).toBe(LCD_DISPLAY_MODES.length);
    });

    it('rejects the retired spellings the customiser used to offer', () => {
        expect(isLcdDisplayMode('Beats & Project (Large)')).toBe(false);
        expect(isLcdDisplayMode('Beats & Time (Large)')).toBe(false);
        expect(isLcdDisplayMode('Beats & Project')).toBe(true);
    });

    it('falls back for a value saved before the list was corrected', () => {
        expect(resolveLcdDisplayMode('Beats & Project (Large)')).toBe(DEFAULT_LCD_DISPLAY_MODE);
        expect(resolveLcdDisplayMode(undefined)).toBe(DEFAULT_LCD_DISPLAY_MODE);
        expect(resolveLcdDisplayMode('Timecode')).toBe('Timecode');
    });

    it('defaults to a mode that exists', () => {
        expect(isLcdDisplayMode(DEFAULT_LCD_DISPLAY_MODE)).toBe(true);
    });
});

/**
 * The two bars beside the LCD were fixed at 20% and 45%, one of them animated,
 * and the group brightened on hover so it read as a control.
 */
describe('engine activity', () => {
    it('is empty at zero and full at the ceiling', () => {
        expect(loadFraction(0, VOICE_CEILING)).toBe(0);
        expect(loadFraction(VOICE_CEILING, VOICE_CEILING)).toBe(1);
        expect(loadFraction(VOICE_CEILING / 2, VOICE_CEILING)).toBeCloseTo(0.5, 6);
    });

    it('never exceeds full, however many voices', () => {
        expect(loadFraction(VOICE_CEILING * 4, VOICE_CEILING)).toBe(1);
        expect(loadFraction(CLIP_CEILING * 10, CLIP_CEILING)).toBe(1);
    });

    it('survives nonsense rather than drawing a NaN-wide bar', () => {
        expect(loadFraction(NaN, VOICE_CEILING)).toBe(0);
        expect(loadFraction(-5, VOICE_CEILING)).toBe(0);
        expect(loadFraction(10, 0)).toBe(1);
    });

    /** Zero because nothing is playing, and zero because it is broken, looked identical. */
    it('says the transport is stopped rather than showing a bare zero', () => {
        expect(activityTitle({ activeSources: 0, scheduledClips: 0 }, false))
            .toMatch(/stopped/i);
    });

    it('counts in words while it is running', () => {
        const title = activityTitle({ activeSources: 1, scheduledClips: 3 }, true);
        expect(title).toContain('1 voice of');
        expect(title).toContain('3 clips scheduled');
        expect(activityTitle({ activeSources: 2, scheduledClips: 1 }, true))
            .toContain('2 voices');
    });
});
