import {
    meterBandColor,
    applyMeterGradient,
    METER_NOMINAL,
    METER_WARNING,
    METER_CLIP,
    WARNING_AT,
    CLIP_AT,
} from '../meterPalette';

describe('meterBandColor', () => {
    it('is green through the nominal range', () => {
        for (const level of [0, 0.1, 0.5, 0.69, 0.7]) {
            expect(meterBandColor(level)).toBe(METER_NOMINAL);
        }
    });

    it('warns amber as it approaches full scale', () => {
        for (const level of [0.71, 0.8, 0.9]) {
            expect(meterBandColor(level)).toBe(METER_WARNING);
        }
    });

    it('goes red at the top of the scale', () => {
        for (const level of [0.91, 1, 1.4]) {
            expect(meterBandColor(level)).toBe(METER_CLIP);
        }
    });

    it('never reports clipping for silence', () => {
        expect(meterBandColor(0)).toBe(METER_NOMINAL);
    });

    it('keeps the three bands distinct', () => {
        expect(new Set([METER_NOMINAL, METER_WARNING, METER_CLIP]).size).toBe(3);
    });
});

describe('applyMeterGradient', () => {
    /** Minimal CanvasGradient stand-in; jsdom has no 2D context. */
    function fakeGradient() {
        const stops: [number, string][] = [];
        return {
            stops,
            gradient: { addColorStop: (o: number, c: string) => { stops.push([o, c]); } } as unknown as CanvasGradient,
        };
    }

    it('ramps green to amber to red, in order', () => {
        const { stops, gradient } = fakeGradient();
        applyMeterGradient(gradient);
        expect(stops).toEqual([
            [0, METER_NOMINAL],
            [WARNING_AT, METER_WARNING],
            [CLIP_AT, METER_CLIP],
        ]);
        expect(WARNING_AT).toBeLessThan(CLIP_AT);
    });

    it('lets a caller tint the quiet end without moving the warning bands', () => {
        const { stops, gradient } = fakeGradient();
        applyMeterGradient(gradient, '#22d3ee');
        expect(stops[0]).toEqual([0, '#22d3ee']);
        expect(stops[1]).toEqual([WARNING_AT, METER_WARNING]);
        expect(stops[2]).toEqual([CLIP_AT, METER_CLIP]);
    });
});
