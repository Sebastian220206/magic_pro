import { neonTrackColor, neonTrackAlpha, neonTrackTextColor, neonTrackColorForIndex, NEON_TRACK_PALETTE } from '../trackColor';

/** Hue in degrees, so assertions read in the units the eye uses. */
function hueOf(hex: string): number {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (d === 0) return 0;
    let h: number;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = ((b - r) / d + 2);
    else h = ((r - g) / d + 4);
    return (h * 60 + 360) % 360;
}

function lightnessOf(hex: string): number {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}

describe('neonTrackColor', () => {
    it('preserves hue', () => {
        // Deep red, muddy green, navy — none of them neon, all keeping their hue.
        for (const input of ['#7f1d1d', '#14532d', '#1e3a8a', '#701a75']) {
            expect(hueOf(neonTrackColor(input))).toBeCloseTo(hueOf(input), 0);
        }
    });

    it('brings every hue to the same lightness', () => {
        const lightnesses = ['#7f1d1d', '#14532d', '#1e3a8a', '#fef08a', '#000080']
            .map(c => lightnessOf(neonTrackColor(c)));
        for (const l of lightnesses) expect(l).toBeCloseTo(lightnesses[0], 2);
    });

    it('brightens a dark colour and calms a blown-out one', () => {
        expect(lightnessOf(neonTrackColor('#7f1d1d'))).toBeGreaterThan(lightnessOf('#7f1d1d'));
        expect(lightnessOf(neonTrackColor('#fffacd'))).toBeLessThan(lightnessOf('#fffacd'));
    });

    /**
     * The reason this is a hue snap and not a lookup table: a user's deliberate
     * red must not come back green.
     */
    it('keeps a red track red and a green track green', () => {
        const red = hueOf(neonTrackColor('#ef4444'));
        const green = hueOf(neonTrackColor('#22c55e'));
        expect(red).toBeLessThan(30);
        expect(green).toBeGreaterThan(90);
        expect(green).toBeLessThan(180);
    });

    describe('colours with no hue', () => {
        it('sends greys, white and black to the accent', () => {
            for (const c of ['#808080', '#ffffff', '#000000', '#1a1a1a']) {
                expect(neonTrackColor(c)).toBe('#22d3ee');
            }
        });
    });

    describe('input tolerance', () => {
        it('accepts shorthand and 8-digit hex', () => {
            expect(neonTrackColor('#f00')).toBe(neonTrackColor('#ff0000'));
            expect(neonTrackColor('#ff0000ff')).toBe(neonTrackColor('#ff0000'));
        });

        it('accepts a missing leading hash and stray whitespace', () => {
            expect(neonTrackColor(' ff0000 ')).toBe(neonTrackColor('#ff0000'));
        });

        /** A bad colour in stored data must not blank the arrangement. */
        it('falls back to the accent rather than throwing', () => {
            for (const bad of [null, undefined, '', 'rebeccapurple', '#12345', 'not-a-colour']) {
                expect(neonTrackColor(bad as string)).toBe('#22d3ee');
            }
        });
    });

    it('is stable across repeated calls', () => {
        const once = neonTrackColor('#7f1d1d');
        for (let i = 0; i < 5; i++) expect(neonTrackColor('#7f1d1d')).toBe(once);
    });

    it('is idempotent — a normalised colour normalises to itself', () => {
        for (const c of NEON_TRACK_PALETTE) {
            expect(hueOf(neonTrackColor(neonTrackColor(c)))).toBeCloseTo(hueOf(neonTrackColor(c)), 1);
        }
    });

    it('always returns a parseable 6-digit hex', () => {
        for (const c of ['#7f1d1d', '#fff', 'garbage', '#22d3ee']) {
            expect(neonTrackColor(c)).toMatch(/^#[0-9a-f]{6}$/);
        }
    });
});

describe('neonTrackAlpha', () => {
    it('returns the normalised hue at the requested alpha', () => {
        expect(neonTrackAlpha('#808080', 0.3)).toBe('rgba(34, 211, 238, 0.3)');
    });

    it('handles a bad colour without throwing', () => {
        expect(neonTrackAlpha('garbage', 1)).toBe('rgba(34, 211, 238, 1)');
    });
});

describe('neonTrackColorForIndex', () => {
    it('cycles the palette', () => {
        expect(neonTrackColorForIndex(0)).toBe(NEON_TRACK_PALETTE[0]);
        expect(neonTrackColorForIndex(NEON_TRACK_PALETTE.length)).toBe(NEON_TRACK_PALETTE[0]);
    });

    it('handles a negative index', () => {
        expect(NEON_TRACK_PALETTE).toContain(neonTrackColorForIndex(-1));
    });
});

describe('neonTrackTextColor', () => {
    /** WCAG relative luminance against the studio ground, #04070b. */
    function contrastOnVoid(hex: string): number {
        const lum = (h: string) => {
            const n = parseInt(h.slice(1), 16);
            const f = (v: number) => {
                v /= 255;
                return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
            };
            return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
        };
        const a = lum(hex), b = lum('#04070b');
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }

    it('clears WCAG AA for every palette colour', () => {
        for (const c of NEON_TRACK_PALETTE) {
            expect(contrastOnVoid(neonTrackTextColor(c))).toBeGreaterThanOrEqual(4.5);
        }
    });

    it('clears AA for arbitrary hues, including the dark ones', () => {
        for (const c of ['#1e3a8a', '#7f1d1d', '#4c1d95', '#312e81', '#701a75']) {
            expect(contrastOnVoid(neonTrackTextColor(c))).toBeGreaterThanOrEqual(4.5);
        }
    });

    it('leaves a colour that already passes untouched', () => {
        // Amber clears AA comfortably at the base lightness.
        expect(neonTrackTextColor('#fb923c')).toBe(neonTrackColor('#fb923c'));
    });

    it('preserves hue while lifting', () => {
        const before = neonTrackColor('#4c1d95');
        const after = neonTrackTextColor('#4c1d95');
        expect(hueOf(after)).toBeCloseTo(hueOf(before), 0);
    });
});
