/**
 * Pins the SF2 zone-combination rules that the GeneralUser GS bank exposed.
 *
 * These are built from synthetic bytes rather than a real font so they run
 * without a 30 MB asset and fail loudly on the specific regressions:
 *   - a preset/instrument's last zone reading past its own bag range,
 *   - preset key/velocity ranges being overridden instead of intersected,
 *   - `genOper === 0` (startAddrsOffset) truncating a zone,
 *   - negative generator amounts read as ~65535.
 */

import { SoundFontParser, GenOper } from '../SoundFontParser';
import { buildSf2, range, type Bag } from '@/tests/fixtures/sf2Builder';

/** Two instruments, each with two key-split zones, addressed by one preset. */
function twoInstrumentFont(presetBags: Bag[]): ArrayBuffer {
    return buildSf2({
        presets: [{ name: 'Test', bank: 0, program: 0, bags: presetBags }],
        instruments: [
            {
                name: 'Low', bags: [
                    { gens: [[GenOper.keyRange, range(0, 59)], [GenOper.sampleID, 0]] },
                    { gens: [[GenOper.keyRange, range(60, 127)], [GenOper.sampleID, 1]] },
                ],
            },
            {
                name: 'High', bags: [
                    { gens: [[GenOper.keyRange, range(0, 59)], [GenOper.sampleID, 2]] },
                    { gens: [[GenOper.keyRange, range(60, 127)], [GenOper.sampleID, 3]] },
                ],
            },
        ],
        samples: [0, 1, 2, 3].map(i => ({
            name: `s${i}`, start: i * 100, end: i * 100 + 99, rootKey: 60,
        })),
        sampleCount: 400,
    });
}

const gen = (zone: { generators: { genOper: number; genValue: number }[] }, oper: number) =>
    zone.generators.find(g => g.genOper === oper)?.genValue;

// ── tests ──────────────────────────────────────────────────────────────────

describe('SoundFontParser zone resolution', () => {
    it('bounds the last zone of an instrument by its own bag range', () => {
        // "Low" is followed by "High" in igen. Its final zone must stop at
        // High's first generator, not run to the end of the chunk.
        const parsed = new SoundFontParser().parse(twoInstrumentFont([
            { gens: [[GenOper.instrument, 0]] },
        ]));

        expect(parsed.instruments).toHaveLength(2);
        expect(parsed.instruments[0].zones).toHaveLength(2);
        expect(parsed.instruments[0].zones[1].generators).toHaveLength(2);
        expect(gen(parsed.instruments[0].zones[1], GenOper.sampleID)).toBe(1);
    });

    it('intersects a preset key range with the instrument key range', () => {
        // Preset restricts to 0-59, so only the instrument's low zone survives.
        const parsed = new SoundFontParser().parse(twoInstrumentFont([
            { gens: [[GenOper.keyRange, range(0, 59)], [GenOper.instrument, 0]] },
        ]));

        const zones = parsed.presets[0].zones;
        expect(zones).toHaveLength(1);
        expect(gen(zones[0], GenOper.sampleID)).toBe(0);
        expect(gen(zones[0], GenOper.keyRange)).toBe(range(0, 59));
    });

    it('narrows to the overlap when both ranges are partial', () => {
        const parsed = new SoundFontParser().parse(twoInstrumentFont([
            { gens: [[GenOper.keyRange, range(50, 70)], [GenOper.instrument, 0]] },
        ]));

        const zones = parsed.presets[0].zones;
        expect(zones).toHaveLength(2);
        expect(gen(zones[0], GenOper.keyRange)).toBe(range(50, 59));
        expect(gen(zones[1], GenOper.keyRange)).toBe(range(60, 70));
    });

    it('keeps two layers separate instead of letting both answer every key', () => {
        // The regression: with override semantics, both preset zones' key
        // filters were discarded and all four sample zones answered every note.
        const parsed = new SoundFontParser().parse(twoInstrumentFont([
            { gens: [[GenOper.keyRange, range(0, 59)], [GenOper.instrument, 0]] },
            { gens: [[GenOper.keyRange, range(60, 127)], [GenOper.instrument, 1]] },
        ]));

        const zones = parsed.presets[0].zones;
        expect(zones).toHaveLength(2);

        const covering = (note: number) => zones.filter(z => {
            const kr = gen(z, GenOper.keyRange)!;
            return note >= (kr & 0xff) && note <= (kr >> 8);
        });
        expect(covering(48)).toHaveLength(1);
        expect(covering(72)).toHaveLength(1);
        expect(gen(covering(48)[0], GenOper.sampleID)).toBe(0);
        expect(gen(covering(72)[0], GenOper.sampleID)).toBe(3);
    });

    it('applies a preset global zone to every sibling preset zone', () => {
        const parsed = new SoundFontParser().parse(twoInstrumentFont([
            { gens: [[GenOper.initialAttenuation, 60]] },   // global, no instrument gen
            { gens: [[GenOper.keyRange, range(0, 59)], [GenOper.instrument, 0]] },
        ]));

        const zones = parsed.presets[0].zones;
        expect(zones).toHaveLength(1);
        expect(gen(zones[0], GenOper.initialAttenuation)).toBe(60);
    });

    it('adds preset generator amounts to the instrument value', () => {
        const parsed = new SoundFontParser().parse(buildSf2({
            presets: [{
                name: 'Test', bank: 0, program: 0, bags: [
                    { gens: [[GenOper.initialAttenuation, 50], [GenOper.instrument, 0]] },
                ],
            }],
            instruments: [{
                name: 'I', bags: [
                    { gens: [[GenOper.initialAttenuation, 30], [GenOper.sampleID, 0]] },
                ],
            }],
            samples: [{ name: 's', start: 0, end: 99, rootKey: 60 }],
            sampleCount: 100,
        }));

        expect(gen(parsed.presets[0].zones[0], GenOper.initialAttenuation)).toBe(80);
    });

    it('ignores instrument-only generators supplied at preset level', () => {
        const parsed = new SoundFontParser().parse(buildSf2({
            presets: [{
                name: 'Test', bank: 0, program: 0, bags: [
                    { gens: [[GenOper.sampleModes, 1], [GenOper.instrument, 0]] },
                ],
            }],
            instruments: [{
                name: 'I', bags: [
                    { gens: [[GenOper.sampleModes, 1], [GenOper.sampleID, 0]] },
                ],
            }],
            samples: [{ name: 's', start: 0, end: 99, rootKey: 60 }],
            sampleCount: 100,
        }));

        // Added it would read 2 (an unlooped mode) and silence the loop.
        expect(gen(parsed.presets[0].zones[0], GenOper.sampleModes)).toBe(1);
    });

    it('does not truncate a zone at startAddrsOffset (genOper 0)', () => {
        const parsed = new SoundFontParser().parse(buildSf2({
            presets: [{
                name: 'Test', bank: 0, program: 0, bags: [
                    { gens: [[GenOper.instrument, 0]] },
                ],
            }],
            instruments: [{
                name: 'I', bags: [
                    {
                        gens: [
                            [GenOper.startAddrsOffset, 8],
                            [GenOper.keyRange, range(0, 127)],
                            [GenOper.sampleID, 0],
                        ],
                    },
                ],
            }],
            samples: [{ name: 's', start: 0, end: 99, rootKey: 60 }],
            sampleCount: 100,
        }));

        const zone = parsed.presets[0].zones[0];
        expect(gen(zone, GenOper.startAddrsOffset)).toBe(8);
        expect(gen(zone, GenOper.sampleID)).toBe(0);
    });

    it('reads negative generator amounts as signed', () => {
        const parsed = new SoundFontParser().parse(buildSf2({
            presets: [{
                name: 'Test', bank: 0, program: 0, bags: [
                    { gens: [[GenOper.instrument, 0]] },
                ],
            }],
            instruments: [{
                name: 'I', bags: [
                    { gens: [[GenOper.fineTune, -35], [GenOper.pan, -500], [GenOper.sampleID, 0]] },
                ],
            }],
            samples: [{ name: 's', start: 0, end: 99, rootKey: 60 }],
            sampleCount: 100,
        }));

        const zone = parsed.presets[0].zones[0];
        expect(gen(zone, GenOper.fineTune)).toBe(-35);
        expect(gen(zone, GenOper.pan)).toBe(-500);
    });

    it('drops a preset zone whose range cannot overlap the instrument', () => {
        const parsed = new SoundFontParser().parse(twoInstrumentFont([
            { gens: [[GenOper.keyRange, range(0, 10)], [GenOper.instrument, 0]] },
        ]));

        // Only the instrument's 0-59 zone can overlap 0-10; the 60-127 one is gone.
        expect(parsed.presets[0].zones).toHaveLength(1);
        expect(gen(parsed.presets[0].zones[0], GenOper.keyRange)).toBe(range(0, 10));
    });

    it('excludes the terminal EOP/EOI records from the parsed lists', () => {
        const parsed = new SoundFontParser().parse(twoInstrumentFont([
            { gens: [[GenOper.instrument, 0]] },
        ]));

        expect(parsed.presets.map(p => p.name)).toEqual(['Test']);
        expect(parsed.instruments.map(i => i.name)).toEqual(['Low', 'High']);
    });
});
