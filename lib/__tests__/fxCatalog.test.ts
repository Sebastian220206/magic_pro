import { FX_CATALOG, fxCatalogCounts, availableFx, findFxEntry } from '../fxCatalog';
import { BUILTIN_PLUGIN_IDS, isBuiltinPluginId } from '@/engine/plugins/pluginIds';

describe('the FX rack', () => {
    it('has the nine categories the rack is organised into', () => {
        expect(FX_CATALOG.map(c => c.name)).toEqual([
            'EQ', 'Dynamics', 'Reverb', 'Delay', 'Distortion',
            'Modulation', 'Pitch', 'Stereo', 'Creative',
        ]);
    });

    it('names every entry exactly once', () => {
        const names = FX_CATALOG.flatMap(c => c.entries.map(e => e.name));
        expect(new Set(names).size).toBe(names.length);
    });

    it('every category has entries', () => {
        for (const category of FX_CATALOG) {
            expect(category.entries.length).toBeGreaterThan(0);
        }
    });
});

describe('what can actually be inserted', () => {
    it('every available entry names a plugin the engine can build', () => {
        for (const entry of availableFx()) {
            expect(`${entry.name}: ${isBuiltinPluginId(entry.pluginId!)}`)
                .toBe(`${entry.name}: true`);
        }
    });

    it('every unavailable entry says why, rather than failing silently', () => {
        // A menu row that inserts nothing and explains nothing is the failure
        // this catalogue exists to avoid.
        for (const category of FX_CATALOG) {
            for (const entry of category.entries) {
                if (entry.pluginId) continue;
                expect(`${entry.name} has a reason: ${(entry.unavailable ?? '').length > 10}`)
                    .toBe(`${entry.name} has a reason: true`);
            }
        }
    });

    it('never carries settings for an entry that cannot be built', () => {
        for (const category of FX_CATALOG) {
            for (const entry of category.entries) {
                if (!entry.pluginId) expect(entry.params).toBeUndefined();
            }
        }
    });

    it('counts what it offers against what it can deliver', () => {
        const { total, available } = fxCatalogCounts();
        expect(total).toBe(FX_CATALOG.flatMap(c => c.entries).length);
        expect(available).toBe(availableFx().length);
        expect(available).toBeLessThan(total);
    });
});

describe('the reverb and delay voicings', () => {
    const params = (name: string) => findFxEntry(name)?.params ?? {};

    it('voices one reverb four different ways', () => {
        for (const name of ['Room', 'Hall', 'Plate', 'Spring']) {
            expect(findFxEntry(name)?.pluginId).toBe(BUILTIN_PLUGIN_IDS.reverb);
        }
        // Four presets that shared settings would be four names for one sound.
        const shapes = ['Room', 'Hall', 'Plate', 'Spring'].map(n => JSON.stringify(params(n)));
        expect(new Set(shapes).size).toBe(4);
    });

    it('makes a hall longer than a room', () => {
        expect(params('Hall').decay).toBeGreaterThan(params('Room').decay);
        expect(params('Hall').preDelay).toBeGreaterThan(params('Room').preDelay);
    });

    it('makes a plate brighter than a room', () => {
        // Less damping is a brighter tail.
        expect(params('Plate').damping).toBeLessThan(params('Room').damping);
    });

    it('only Ping Pong alternates the sides', () => {
        expect(params('Ping Pong').pingPong).toBe(1);
        expect(params('Stereo Delay').pingPong).toBe(0);
    });

    it('gives a stereo delay different times per side', () => {
        expect(params('Stereo Delay').timeL).not.toBe(params('Stereo Delay').timeR);
    });

    it('makes a tape delay wobble and a stereo delay not', () => {
        expect(params('Tape Delay').modulation).toBeGreaterThan(0);
        expect(params('Stereo Delay').modulation ?? 0).toBe(0);
    });

    it('builds chorus and flanger from very short delays', () => {
        // Both are the delay plugin; what separates them is the time and the
        // feedback, not a different effect.
        expect(findFxEntry('Chorus')?.pluginId).toBe(BUILTIN_PLUGIN_IDS.delay);
        expect(findFxEntry('Flanger')?.pluginId).toBe(BUILTIN_PLUGIN_IDS.delay);
        expect(params('Chorus').timeL).toBeLessThan(0.05);
        expect(params('Flanger').timeL).toBeLessThan(params('Chorus').timeL);
        expect(params('Flanger').feedback).toBeGreaterThan(params('Chorus').feedback);
    });
});

describe('looking an entry up', () => {
    it('finds one by the name the menu shows', () => {
        expect(findFxEntry('Hall')?.category).toBe('Reverb');
        expect(findFxEntry('Limiter')?.category).toBe('Dynamics');
    });

    it('returns nothing for a name the rack does not have', () => {
        expect(findFxEntry('Nonexistent')).toBeUndefined();
    });
});
