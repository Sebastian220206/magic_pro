/**
 * The manifests describe the effects the engine actually builds.
 *
 * Three faults had stacked up here: a registry nothing initialised, keyed by
 * ids that no longer matched, holding parameters the DSP does not take. Each
 * was invisible on its own — the symptom was only that plugin editors showed a
 * read-only key/value dump instead of controls.
 *
 * These assertions tie the manifests to the real defaults, so a parameter
 * renamed in the DSP fails here rather than degrading an editor in silence.
 */

import { BUILTIN_MANIFESTS, decodeBuiltinParams } from '../builtinManifests';
import { BUILTIN_PLUGIN_IDS, resolvePluginId } from '../pluginIds';
import { getBuiltinManifest } from '../registerBuiltins';

// The shapes the effects actually accept, read off their DEFAULT_PARAMS.
const REAL_PARAMS: Record<string, Record<string, number | string | boolean>> = {
    [BUILTIN_PLUGIN_IDS.compressor]: {
        threshold: -24, ratio: 4, attack: 0.01, release: 0.1, knee: 6, makeupGain: 6, mode: 'VCA',
    },
    [BUILTIN_PLUGIN_IDS.reverb]: {
        mode: 'algorithmic', mix: 0.3, decay: 2.0, preDelay: 20, damping: 0.5,
    },
    [BUILTIN_PLUGIN_IDS.delay]: {
        timeL: 0.375, timeR: 0.375, feedback: 0.4, mix: 0.3, damping: 0.3,
        pingPong: false, sync: 'none', modulation: 0, modRate: 0.5,
    },
    [BUILTIN_PLUGIN_IDS.limiter]: {
        ceiling: -0.3, release: 0.1, lookahead: 1,
    },
};

describe('built-in plugin manifests', () => {
    it('names every parameter the effect actually takes', () => {
        for (const [pluginId, real] of Object.entries(REAL_PARAMS)) {
            const manifest = BUILTIN_MANIFESTS[pluginId];
            expect(manifest).toBeDefined();
            const declared = new Set(manifest.parameters.map(p => p.id));
            for (const key of Object.keys(real)) {
                expect(`${pluginId}.${key} declared: ${declared.has(key)}`)
                    .toBe(`${pluginId}.${key} declared: true`);
            }
        }
    });

    it('declares no parameter the effect does not take', () => {
        for (const [pluginId, real] of Object.entries(REAL_PARAMS)) {
            for (const param of BUILTIN_MANIFESTS[pluginId].parameters) {
                expect(`${pluginId}.${param.id} exists: ${param.id in real}`)
                    .toBe(`${pluginId}.${param.id} exists: true`);
            }
        }
    });

    it('defaults match the DSP defaults', () => {
        for (const [pluginId, real] of Object.entries(REAL_PARAMS)) {
            for (const param of BUILTIN_MANIFESTS[pluginId].parameters) {
                const expected = real[param.id];
                if (typeof expected === 'number') {
                    expect(`${pluginId}.${param.id}=${param.defaultValue}`)
                        .toBe(`${pluginId}.${param.id}=${expected}`);
                } else if (typeof expected === 'boolean') {
                    expect(param.type).toBe('boolean');
                    expect(param.defaultValue !== 0).toBe(expected);
                } else {
                    expect(param.type).toBe('enum');
                    expect(param.enumValues?.[param.defaultValue]).toBe(expected);
                }
            }
        }
    });

    it('every declared range contains its own default', () => {
        for (const manifest of Object.values(BUILTIN_MANIFESTS)) {
            for (const p of manifest.parameters) {
                if (p.type !== 'float' && p.type !== 'int') continue;
                expect(p.minValue).toBeLessThanOrEqual(p.defaultValue);
                expect(p.maxValue).toBeGreaterThanOrEqual(p.defaultValue);
            }
        }
    });

    it('is keyed by canonical ids, so lookups cannot miss', () => {
        for (const [key, manifest] of Object.entries(BUILTIN_MANIFESTS)) {
            expect(resolvePluginId(key)).toBe(key);
            expect(manifest.id).toBe(key);
        }
    });

    it('resolves every legacy spelling an editor might be opened with', () => {
        // The short ids the store writes, and the manifest ids that used to be
        // the descriptor keys, must both find the same manifest.
        expect(getBuiltinManifest('comp')?.id).toBe(BUILTIN_PLUGIN_IDS.compressor);
        expect(getBuiltinManifest('magic_wasm_comp')?.id).toBe(BUILTIN_PLUGIN_IDS.compressor);
        expect(getBuiltinManifest(BUILTIN_PLUGIN_IDS.reverb)?.id).toBe(BUILTIN_PLUGIN_IDS.reverb);
        expect(getBuiltinManifest('reverb')?.id).toBe(BUILTIN_PLUGIN_IDS.reverb);
    });

    it('has no manifest for an effect the engine cannot build', () => {
        // Manifests once existed for saturation, chorus and de-esser, which had
        // no builder — they would have been offered and produced nothing.
        for (const id of ['magic_wasm_saturation', 'magic_wasm_chorus', 'magic_wasm_deesser']) {
            expect(getBuiltinManifest(id)).toBeUndefined();
        }
    });

    it('leaves the Channel EQ to its own editor', () => {
        // Its state is nested per band, which a flat parameter list cannot
        // express; a generated UI here would be worse than the real one.
        expect(BUILTIN_MANIFESTS[BUILTIN_PLUGIN_IDS.eq]).toBeUndefined();
    });
});

describe('decoding automation values back to DSP values', () => {
    it('turns an enum index into the string the setter expects', () => {
        const decoded = decodeBuiltinParams(BUILTIN_PLUGIN_IDS.compressor, { mode: 1 });
        expect(decoded.mode).toBe('FET');
        expect(decodeBuiltinParams(BUILTIN_PLUGIN_IDS.compressor, { mode: 2 }).mode).toBe('Opto');
    });

    it('turns a boolean parameter back into a boolean', () => {
        expect(decodeBuiltinParams(BUILTIN_PLUGIN_IDS.delay, { pingPong: 1 }).pingPong).toBe(true);
        expect(decodeBuiltinParams(BUILTIN_PLUGIN_IDS.delay, { pingPong: 0 }).pingPong).toBe(false);
    });

    it('leaves ordinary numbers alone', () => {
        const decoded = decodeBuiltinParams(BUILTIN_PLUGIN_IDS.compressor, { threshold: -18, ratio: 6 });
        expect(decoded).toEqual({ threshold: -18, ratio: 6 });
    });

    it('accepts a value already stored as its string', () => {
        // Projects saved before the manifests existed hold 'Opto', not 2.
        const decoded = decodeBuiltinParams(BUILTIN_PLUGIN_IDS.compressor, { mode: 'Opto' as never });
        expect(decoded.mode).toBe('Opto');
    });

    it('clamps an out-of-range enum index rather than handing over undefined', () => {
        expect(decodeBuiltinParams(BUILTIN_PLUGIN_IDS.compressor, { mode: 99 }).mode).toBe('VCA');
    });

    it('passes through a parameter this build no longer lists', () => {
        // A saved project may carry one; dropping it silently would be worse.
        const decoded = decodeBuiltinParams(BUILTIN_PLUGIN_IDS.limiter, { ceiling: -1, legacy: 5 });
        expect(decoded).toEqual({ ceiling: -1, legacy: 5 });
    });

    it('passes everything through for a plugin with no manifest', () => {
        expect(decodeBuiltinParams('some.third.party', { a: 1 })).toEqual({ a: 1 });
        expect(decodeBuiltinParams(BUILTIN_PLUGIN_IDS.compressor, undefined)).toEqual({});
    });
});
