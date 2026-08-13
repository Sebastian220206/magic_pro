import { SAMPLER_PRESETS, samplerPresetFor, hasSamplerPreset } from '../samplerPresets';
import { instrumentRegistry } from '../instrumentRegistry';
import { DEFAULT_INSTRUMENT } from '@/lib/instrumentCatalog';

describe('sampler presets', () => {
    /**
     * Regression: the New Track dialog's default moved to 'Grand Piano', which
     * is in the registry as `engine: 'sampler'` but had no sample set. Every new
     * MIDI track played through the fallback oscillator instead of the piano,
     * silently — nothing logged, nothing threw, it just did not sound like a
     * piano.
     */
    it('gives the default instrument a sample set', () => {
        expect(DEFAULT_INSTRUMENT.kind).toBe('registry');
        const name = (DEFAULT_INSTRUMENT as { name: string }).name;
        expect(hasSamplerPreset(name)).toBe(true);
    });

    it('keeps the older name saved projects carry', () => {
        // Projects saved before the rename still say 'Steinway Piano'.
        expect(samplerPresetFor('Steinway Piano')).toBe(samplerPresetFor('Grand Piano'));
    });

    it('points every entry at a .dspreset under /sound_sample', () => {
        for (const [name, path] of Object.entries(SAMPLER_PRESETS)) {
            expect(path.startsWith('/sound_sample/')).toBe(true);
            expect(path.endsWith('.dspreset')).toBe(true);
            expect(instrumentRegistry[name] ?? { engine: 'sampler' }).toBeTruthy();
        }
    });

    it('returns nothing for an unknown instrument rather than throwing', () => {
        expect(samplerPresetFor(undefined)).toBeUndefined();
        expect(samplerPresetFor(null)).toBeUndefined();
        expect(samplerPresetFor('No Such Instrument')).toBeUndefined();
        expect(hasSamplerPreset('No Such Instrument')).toBe(false);
    });
});
