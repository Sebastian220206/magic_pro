/**
 * builtinManifests.ts
 * What each built-in effect's parameters actually are.
 *
 * The manifests in `registerBuiltins.ts` described a different set of plugins —
 * a WASM DSP core keyed `magic_wasm_*` whose EQ had one `freq/q/gain` band,
 * while the EQ the engine actually builds has three. Three faults stacked on
 * top of each other:
 *
 *   1. `registerBuiltinPlugins()` was never called, so the descriptor map was
 *      empty and every lookup missed.
 *   2. Descriptors were keyed `magic_wasm_eq` while plugin ids resolve to
 *      `magic.eq`, so lookups would have missed even after (1).
 *   3. The parameters named were not the ones the DSP takes.
 *
 * The result was that every plugin editor except the Channel EQ fell through to
 * a read-only key/value dump. These are plain exported data rather than a
 * registry that has to be initialised, so (1) cannot happen again.
 *
 * Values here mirror the `DEFAULT_PARAMS` in `engine/effects/plugins/`; the
 * consistency test asserts they stay in step.
 */

import type { PluginManifest } from './manifest';
import { BUILTIN_PLUGIN_IDS } from './pluginIds';

const compressor: PluginManifest = {
    manifestVersion: 1,
    id: BUILTIN_PLUGIN_IDS.compressor,
    name: 'Compressor',
    version: '1.0.0',
    type: 'effect',
    category: 'dynamics',
    description: 'Level control with VCA, FET and Opto characters.',
    parameters: [
        { id: 'threshold', name: 'Threshold', type: 'float', defaultValue: -24, minValue: -60, maxValue: 0, step: 0.5, unit: 'dB', automatable: true },
        { id: 'ratio', name: 'Ratio', type: 'float', defaultValue: 4, minValue: 1, maxValue: 20, step: 0.1, unit: ':1', automatable: true },
        { id: 'attack', name: 'Attack', type: 'float', defaultValue: 0.01, minValue: 0, maxValue: 0.5, step: 0.001, unit: 's', automatable: true },
        { id: 'release', name: 'Release', type: 'float', defaultValue: 0.1, minValue: 0.01, maxValue: 1, step: 0.01, unit: 's', automatable: true },
        { id: 'knee', name: 'Knee', type: 'float', defaultValue: 6, minValue: 0, maxValue: 40, step: 0.5, unit: 'dB', automatable: true },
        { id: 'makeupGain', name: 'Makeup Gain', type: 'float', defaultValue: 6, minValue: -20, maxValue: 20, step: 0.5, unit: 'dB', automatable: true },
        { id: 'mode', name: 'Character', type: 'enum', defaultValue: 0, enumValues: ['VCA', 'FET', 'Opto'], automatable: false },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
};

const reverb: PluginManifest = {
    manifestVersion: 1,
    id: BUILTIN_PLUGIN_IDS.reverb,
    name: 'Space Designer',
    version: '1.0.0',
    type: 'effect',
    category: 'reverb',
    description: 'Algorithmic reverb, or convolution when given an impulse response.',
    parameters: [
        { id: 'mix', name: 'Mix', type: 'float', defaultValue: 0.3, minValue: 0, maxValue: 1, step: 0.01, automatable: true },
        { id: 'decay', name: 'Decay', type: 'float', defaultValue: 2, minValue: 0.1, maxValue: 10, step: 0.1, unit: 's', automatable: true },
        { id: 'preDelay', name: 'Pre-Delay', type: 'float', defaultValue: 20, minValue: 0, maxValue: 100, step: 1, unit: 'ms', automatable: true },
        { id: 'damping', name: 'Damping', type: 'float', defaultValue: 0.5, minValue: 0, maxValue: 1, step: 0.01, automatable: true },
        // Decay, pre-delay and damping apply to the algorithmic mode only; in
        // IR mode the impulse response decides them.
        { id: 'mode', name: 'Mode', type: 'enum', defaultValue: 0, enumValues: ['algorithmic', 'ir'], automatable: false },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
};

const delay: PluginManifest = {
    manifestVersion: 1,
    id: BUILTIN_PLUGIN_IDS.delay,
    name: 'Delay Designer',
    version: '1.0.0',
    type: 'effect',
    category: 'delay',
    description: 'Stereo delay with independent times, ping-pong and modulation.',
    parameters: [
        { id: 'timeL', name: 'Time L', type: 'float', defaultValue: 0.375, minValue: 0, maxValue: 2, step: 0.001, unit: 's', automatable: true },
        { id: 'timeR', name: 'Time R', type: 'float', defaultValue: 0.375, minValue: 0, maxValue: 2, step: 0.001, unit: 's', automatable: true },
        { id: 'feedback', name: 'Feedback', type: 'float', defaultValue: 0.4, minValue: 0, maxValue: 0.95, step: 0.01, automatable: true },
        { id: 'mix', name: 'Mix', type: 'float', defaultValue: 0.3, minValue: 0, maxValue: 1, step: 0.01, automatable: true },
        { id: 'damping', name: 'Damping', type: 'float', defaultValue: 0.3, minValue: 0, maxValue: 1, step: 0.01, automatable: true },
        { id: 'modulation', name: 'Modulation', type: 'float', defaultValue: 0, minValue: 0, maxValue: 1, step: 0.01, automatable: true },
        { id: 'modRate', name: 'Mod Rate', type: 'float', defaultValue: 0.5, minValue: 0.01, maxValue: 10, step: 0.01, unit: 'Hz', automatable: true },
        { id: 'pingPong', name: 'Ping-Pong', type: 'boolean', defaultValue: 0, automatable: false },
        { id: 'sync', name: 'Sync', type: 'enum', defaultValue: 0, enumValues: ['none', 'quarter', 'eighth', 'dotted', 'triplet'], automatable: false },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
};

const limiter: PluginManifest = {
    manifestVersion: 1,
    id: BUILTIN_PLUGIN_IDS.limiter,
    name: 'Limiter',
    version: '1.0.0',
    type: 'effect',
    category: 'dynamics',
    description: 'Lookahead brickwall limiter for the end of a chain.',
    parameters: [
        { id: 'ceiling', name: 'Ceiling', type: 'float', defaultValue: -0.3, minValue: -12, maxValue: 0, step: 0.1, unit: 'dB', automatable: true },
        { id: 'release', name: 'Release', type: 'float', defaultValue: 0.1, minValue: 0.01, maxValue: 1, step: 0.01, unit: 's', automatable: true },
        { id: 'lookahead', name: 'Lookahead', type: 'float', defaultValue: 1, minValue: 0, maxValue: 5, step: 0.1, unit: 'ms', automatable: false },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
};

const sidechain: PluginManifest = {
    manifestVersion: 1,
    id: BUILTIN_PLUGIN_IDS.sidechainCompressor,
    name: 'Sidechain Comp',
    version: '1.0.0',
    type: 'effect',
    category: 'dynamics',
    description: 'Ducks this track against another track’s level.',
    parameters: [
        { id: 'threshold', name: 'Threshold', type: 'float', defaultValue: -24, minValue: -60, maxValue: 0, step: 0.5, unit: 'dB', automatable: true },
        { id: 'ratio', name: 'Ratio', type: 'float', defaultValue: 4, minValue: 1, maxValue: 20, step: 0.1, unit: ':1', automatable: true },
        { id: 'attack', name: 'Attack', type: 'float', defaultValue: 0.01, minValue: 0, maxValue: 0.5, step: 0.001, unit: 's', automatable: true },
        { id: 'release', name: 'Release', type: 'float', defaultValue: 0.1, minValue: 0.01, maxValue: 1, step: 0.01, unit: 's', automatable: true },
        { id: 'lookaheadMs', name: 'Lookahead', type: 'float', defaultValue: 0, minValue: 0, maxValue: 10, step: 0.1, unit: 'ms', automatable: false },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
};

/**
 * Manifests by canonical id.
 *
 * The Channel EQ is deliberately absent: its state is nested per band, which a
 * flat parameter list cannot express, and it has a purpose-built editor that
 * `PluginEditorWindow` reaches before it ever looks for a manifest.
 */
export const BUILTIN_MANIFESTS: Readonly<Record<string, PluginManifest>> = {
    [BUILTIN_PLUGIN_IDS.compressor]: compressor,
    [BUILTIN_PLUGIN_IDS.reverb]: reverb,
    [BUILTIN_PLUGIN_IDS.delay]: delay,
    [BUILTIN_PLUGIN_IDS.limiter]: limiter,
    [BUILTIN_PLUGIN_IDS.sidechainCompressor]: sidechain,
};

/**
 * Turn the flat numeric parameters the store holds into what the DSP takes.
 *
 * Everything is a number on the wire so it can be automated — an automation
 * lane has no way to carry the string `'Opto'`. The manifest says which of
 * those numbers are really enum indices or booleans, and this is where they are
 * turned back. Without it, choosing "FET" wrote `mode: 1` into a setter
 * expecting `'FET'`.
 */
export function decodeBuiltinParams(
    pluginId: string,
    params: Record<string, number> | undefined,
): Record<string, unknown> {
    if (!params) return {};
    const manifest = BUILTIN_MANIFESTS[pluginId];
    if (!manifest) return { ...params };

    const decoded: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
        const spec = manifest.parameters.find(p => p.id === key);
        if (!spec) {
            // Unknown keys pass through: a saved project may carry a parameter
            // this build no longer lists, and dropping it silently would be
            // worse than handing it to a setter that ignores it.
            decoded[key] = value;
            continue;
        }
        if (spec.type === 'boolean') {
            decoded[key] = typeof value === 'boolean' ? value : value !== 0;
        } else if (spec.type === 'enum' && spec.enumValues?.length) {
            // Tolerate a value already stored as its string, which is what
            // projects saved before the manifests existed contain.
            if (typeof value === 'string') decoded[key] = value;
            else decoded[key] = spec.enumValues[Math.round(value)] ?? spec.enumValues[0];
        } else {
            decoded[key] = value;
        }
    }
    return decoded;
}
