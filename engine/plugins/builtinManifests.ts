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

const saturation: PluginManifest = {
    manifestVersion: 1,
    id: BUILTIN_PLUGIN_IDS.saturation,
    name: 'Saturation',
    version: '1.0.0',
    type: 'effect',
    category: 'distortion',
    description: 'Standalone waveshaper drive with tube, tape and fuzz characters.',
    parameters: [
        { id: 'drive', name: 'Drive', type: 'float', defaultValue: 0.5, minValue: 0, maxValue: 1, step: 0.01, automatable: true },
        { id: 'tone', name: 'Tone', type: 'float', defaultValue: 0.8, minValue: 0, maxValue: 1, step: 0.01, automatable: true },
        { id: 'mix', name: 'Mix', type: 'float', defaultValue: 1, minValue: 0, maxValue: 1, step: 0.01, automatable: true },
        { id: 'type', name: 'Character', type: 'enum', defaultValue: 0, enumValues: ['tube', 'tape', 'fuzz'], automatable: false },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
};

const widener: PluginManifest = {
    manifestVersion: 1,
    id: BUILTIN_PLUGIN_IDS.widener,
    name: 'Stereo Widener',
    version: '1.0.0',
    type: 'effect',
    category: 'stereo',
    description: 'Mid/side stereo width, mono-safe.',
    parameters: [
        { id: 'width', name: 'Width', type: 'float', defaultValue: 1, minValue: 0, maxValue: 2, step: 0.01, automatable: true },
        { id: 'mono', name: 'Mono', type: 'boolean', defaultValue: 0, automatable: false },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
};

const vintageEq: PluginManifest = {
    manifestVersion: 1,
    id: BUILTIN_PLUGIN_IDS.vintageEq,
    name: 'Vintage EQ',
    version: '1.0.0',
    type: 'effect',
    category: 'eq',
    description: 'Pultec, Neve and SSL-style colour EQ in one box.',
    parameters: [
        { id: 'type', name: 'Circuit', type: 'enum', defaultValue: 0, enumValues: ['pultec', 'neve', 'ssl'], automatable: false },
        { id: 'lowBoost', name: 'Low Boost', type: 'float', defaultValue: 0, minValue: 0, maxValue: 10, step: 0.5, unit: 'dB', automatable: true },
        { id: 'lowCut', name: 'Low Cut', type: 'float', defaultValue: 0, minValue: 0, maxValue: 10, step: 0.5, unit: 'dB', automatable: true },
        { id: 'lowFreq', name: 'Low Freq', type: 'float', defaultValue: 100, minValue: 20, maxValue: 200, step: 1, unit: 'Hz', automatable: true },
        { id: 'highBoost', name: 'High Boost', type: 'float', defaultValue: 0, minValue: 0, maxValue: 10, step: 0.5, unit: 'dB', automatable: true },
        { id: 'highCut', name: 'High Cut', type: 'float', defaultValue: 0, minValue: 0, maxValue: 10, step: 0.5, unit: 'dB', automatable: true },
        { id: 'highFreq', name: 'High Freq', type: 'float', defaultValue: 10, minValue: 3, maxValue: 16, step: 1, unit: 'kHz', automatable: true },
        { id: 'bandwidth', name: 'Bandwidth', type: 'float', defaultValue: 5, minValue: 0.5, maxValue: 10, step: 0.5, automatable: true },
        { id: 'highPassFreq', name: 'High-Pass', type: 'float', defaultValue: 20, minValue: 20, maxValue: 1000, step: 1, unit: 'Hz', automatable: true },
        { id: 'lowPassFreq', name: 'Low-Pass', type: 'float', defaultValue: 20000, minValue: 1000, maxValue: 20000, step: 100, unit: 'Hz', automatable: true },
        { id: 'bell1Freq', name: 'Bell 1 Freq', type: 'float', defaultValue: 1000, minValue: 20, maxValue: 20000, step: 1, unit: 'Hz', automatable: true },
        { id: 'bell1Gain', name: 'Bell 1 Gain', type: 'float', defaultValue: 0, minValue: -15, maxValue: 15, step: 0.5, unit: 'dB', automatable: true },
        { id: 'bell1Q', name: 'Bell 1 Q', type: 'float', defaultValue: 1, minValue: 0.1, maxValue: 10, step: 0.1, automatable: true },
        { id: 'bell2Freq', name: 'Bell 2 Freq', type: 'float', defaultValue: 500, minValue: 20, maxValue: 20000, step: 1, unit: 'Hz', automatable: true },
        { id: 'bell2Gain', name: 'Bell 2 Gain', type: 'float', defaultValue: 0, minValue: -15, maxValue: 15, step: 0.5, unit: 'dB', automatable: true },
        { id: 'bell2Q', name: 'Bell 2 Q', type: 'float', defaultValue: 1, minValue: 0.1, maxValue: 10, step: 0.1, automatable: true },
        { id: 'saturationDrive', name: 'Drive', type: 'float', defaultValue: 0, minValue: 0, maxValue: 1, step: 0.01, automatable: true },
        { id: 'transformerColor', name: 'Transformer', type: 'boolean', defaultValue: 0, automatable: false },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
};

const utility: PluginManifest = {
    manifestVersion: 1,
    id: BUILTIN_PLUGIN_IDS.utility,
    name: 'Utility',
    version: '1.0.0',
    type: 'effect',
    category: 'stereo',
    description: 'Trim gain, balance, mono check and polarity in one box.',
    parameters: [
        { id: 'gain', name: 'Gain', type: 'float', defaultValue: 0, minValue: -24, maxValue: 24, step: 0.5, unit: 'dB', automatable: true },
        { id: 'pan', name: 'Pan', type: 'float', defaultValue: 0, minValue: -1, maxValue: 1, step: 0.01, automatable: true },
        { id: 'mono', name: 'Mono', type: 'boolean', defaultValue: 0, automatable: false },
        { id: 'polarity', name: 'Polarity Invert', type: 'boolean', defaultValue: 0, automatable: false },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
};

const tremolo: PluginManifest = {
    manifestVersion: 1,
    id: BUILTIN_PLUGIN_IDS.tremolo,
    name: 'Tremolo',
    version: '1.0.0',
    type: 'effect',
    category: 'modulation',
    description: 'An LFO on a gain stage.',
    parameters: [
        { id: 'rate', name: 'Rate', type: 'float', defaultValue: 4, minValue: 0.1, maxValue: 20, step: 0.1, unit: 'Hz', automatable: true },
        { id: 'depth', name: 'Depth', type: 'float', defaultValue: 0.8, minValue: 0, maxValue: 1, step: 0.01, automatable: true },
        { id: 'waveform', name: 'Waveform', type: 'enum', defaultValue: 0, enumValues: ['sine', 'triangle'], automatable: false },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
};

const autoPan: PluginManifest = {
    manifestVersion: 1,
    id: BUILTIN_PLUGIN_IDS.autoPan,
    name: 'Auto Pan',
    version: '1.0.0',
    type: 'effect',
    category: 'creative',
    description: 'An LFO on a stereo panner.',
    parameters: [
        { id: 'rate', name: 'Rate', type: 'float', defaultValue: 1, minValue: 0.05, maxValue: 10, step: 0.05, unit: 'Hz', automatable: true },
        { id: 'depth', name: 'Depth', type: 'float', defaultValue: 1, minValue: 0, maxValue: 1, step: 0.01, automatable: true },
        { id: 'waveform', name: 'Waveform', type: 'enum', defaultValue: 0, enumValues: ['sine', 'triangle'], automatable: false },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
};

const ringMod: PluginManifest = {
    manifestVersion: 1,
    id: BUILTIN_PLUGIN_IDS.ringMod,
    name: 'Ring Mod',
    version: '1.0.0',
    type: 'effect',
    category: 'creative',
    description: 'A sine oscillator multiplying the signal.',
    parameters: [
        { id: 'freq', name: 'Frequency', type: 'float', defaultValue: 100, minValue: 1, maxValue: 2000, step: 1, unit: 'Hz', automatable: true },
        { id: 'depth', name: 'Depth', type: 'float', defaultValue: 1, minValue: 0, maxValue: 1, step: 0.01, automatable: true },
        { id: 'mix', name: 'Mix', type: 'float', defaultValue: 1, minValue: 0, maxValue: 1, step: 0.01, automatable: true },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
};

const phaser: PluginManifest = {
    manifestVersion: 1,
    id: BUILTIN_PLUGIN_IDS.phaser,
    name: 'Phaser',
    version: '1.0.0',
    type: 'effect',
    category: 'modulation',
    description: 'Four swept all-pass stages with feedback.',
    parameters: [
        { id: 'rate', name: 'Rate', type: 'float', defaultValue: 0.5, minValue: 0.05, maxValue: 5, step: 0.05, unit: 'Hz', automatable: true },
        { id: 'depth', name: 'Depth', type: 'float', defaultValue: 1, minValue: 0, maxValue: 1, step: 0.01, automatable: true },
        { id: 'feedback', name: 'Feedback', type: 'float', defaultValue: 0.5, minValue: 0, maxValue: 0.9, step: 0.01, automatable: true },
        { id: 'mix', name: 'Mix', type: 'float', defaultValue: 1, minValue: 0, maxValue: 1, step: 0.01, automatable: true },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
};

const graphicEq: PluginManifest = {
    manifestVersion: 1,
    id: BUILTIN_PLUGIN_IDS.graphicEq,
    name: 'Graphic EQ',
    version: '1.0.0',
    type: 'effect',
    category: 'eq',
    description: 'Ten fixed bands, 31 Hz to 16 kHz.',
    parameters: [
        { id: 'band1', name: '31 Hz', type: 'float', defaultValue: 0, minValue: -12, maxValue: 12, step: 0.5, unit: 'dB', automatable: true },
        { id: 'band2', name: '62 Hz', type: 'float', defaultValue: 0, minValue: -12, maxValue: 12, step: 0.5, unit: 'dB', automatable: true },
        { id: 'band3', name: '125 Hz', type: 'float', defaultValue: 0, minValue: -12, maxValue: 12, step: 0.5, unit: 'dB', automatable: true },
        { id: 'band4', name: '250 Hz', type: 'float', defaultValue: 0, minValue: -12, maxValue: 12, step: 0.5, unit: 'dB', automatable: true },
        { id: 'band5', name: '500 Hz', type: 'float', defaultValue: 0, minValue: -12, maxValue: 12, step: 0.5, unit: 'dB', automatable: true },
        { id: 'band6', name: '1 kHz', type: 'float', defaultValue: 0, minValue: -12, maxValue: 12, step: 0.5, unit: 'dB', automatable: true },
        { id: 'band7', name: '2 kHz', type: 'float', defaultValue: 0, minValue: -12, maxValue: 12, step: 0.5, unit: 'dB', automatable: true },
        { id: 'band8', name: '4 kHz', type: 'float', defaultValue: 0, minValue: -12, maxValue: 12, step: 0.5, unit: 'dB', automatable: true },
        { id: 'band9', name: '8 kHz', type: 'float', defaultValue: 0, minValue: -12, maxValue: 12, step: 0.5, unit: 'dB', automatable: true },
        { id: 'band10', name: '16 kHz', type: 'float', defaultValue: 0, minValue: -12, maxValue: 12, step: 0.5, unit: 'dB', automatable: true },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
};

const imager: PluginManifest = {
    manifestVersion: 1,
    id: BUILTIN_PLUGIN_IDS.imager,
    name: 'Stereo Imager',
    version: '1.0.0',
    type: 'effect',
    category: 'stereo',
    description: 'Independent width per band: low, mid and air.',
    parameters: [
        { id: 'lowWidth', name: 'Low Width', type: 'float', defaultValue: 1, minValue: 0, maxValue: 2, step: 0.01, automatable: true },
        { id: 'midWidth', name: 'Mid Width', type: 'float', defaultValue: 1, minValue: 0, maxValue: 2, step: 0.01, automatable: true },
        { id: 'highWidth', name: 'High Width', type: 'float', defaultValue: 1, minValue: 0, maxValue: 2, step: 0.01, automatable: true },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
};

/**
 * Worklet effect manifests name their AudioParams directly.
 *
 * The worklet branch of the factory hands `spec.params` to the node without
 * decoding, so an id here that is not an AudioParam name would be silently
 * skipped by `parameters.get`. Display names stay pretty regardless.
 */
const gate: PluginManifest = {
    manifestVersion: 1,
    id: BUILTIN_PLUGIN_IDS.gate,
    name: 'Gate',
    version: '1.0.0',
    type: 'effect',
    category: 'dynamics',
    description: 'Downward gate with hysteresis, hold and floor.',
    parameters: [
        { id: 'thresholdDb', name: 'Threshold', type: 'float', defaultValue: -24, minValue: -60, maxValue: 0, step: 0.5, unit: 'dB', automatable: true },
        { id: 'attackMs', name: 'Attack', type: 'float', defaultValue: 1, minValue: 0.01, maxValue: 100, step: 0.1, unit: 'ms', automatable: true },
        { id: 'holdMs', name: 'Hold', type: 'float', defaultValue: 50, minValue: 0, maxValue: 500, step: 1, unit: 'ms', automatable: false },
        { id: 'releaseMs', name: 'Release', type: 'float', defaultValue: 150, minValue: 10, maxValue: 1000, step: 1, unit: 'ms', automatable: true },
        { id: 'floorDb', name: 'Floor', type: 'float', defaultValue: -80, minValue: -80, maxValue: 0, step: 1, unit: 'dB', automatable: false },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
};

const expander: PluginManifest = {
    manifestVersion: 1,
    id: BUILTIN_PLUGIN_IDS.expander,
    name: 'Expander',
    version: '1.0.0',
    type: 'effect',
    category: 'dynamics',
    description: 'Downward expansion for breathing room tone.',
    parameters: [
        { id: 'thresholdDb', name: 'Threshold', type: 'float', defaultValue: -24, minValue: -60, maxValue: 0, step: 0.5, unit: 'dB', automatable: true },
        { id: 'ratio', name: 'Ratio', type: 'float', defaultValue: 2, minValue: 1, maxValue: 10, step: 0.1, unit: ':1', automatable: true },
        { id: 'attackMs', name: 'Attack', type: 'float', defaultValue: 5, minValue: 0.01, maxValue: 100, step: 0.1, unit: 'ms', automatable: true },
        { id: 'releaseMs', name: 'Release', type: 'float', defaultValue: 120, minValue: 10, maxValue: 1000, step: 1, unit: 'ms', automatable: true },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
};

const bitcrusher: PluginManifest = {
    manifestVersion: 1,
    id: BUILTIN_PLUGIN_IDS.bitcrusher,
    name: 'Bitcrusher',
    version: '1.0.0',
    type: 'effect',
    category: 'distortion',
    description: 'Sample-and-hold decimation plus amplitude quantisation.',
    parameters: [
        { id: 'bits', name: 'Bits', type: 'int', defaultValue: 12, minValue: 1, maxValue: 16, step: 1, automatable: true },
        { id: 'downsample', name: 'Downsample', type: 'int', defaultValue: 1, minValue: 1, maxValue: 32, step: 1, automatable: true },
        { id: 'mix', name: 'Mix', type: 'float', defaultValue: 1, minValue: 0, maxValue: 1, step: 0.01, automatable: true },
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

const retroSynth: PluginManifest = {
    manifestVersion: 1,
    id: BUILTIN_PLUGIN_IDS.retroSynth,
    name: 'Retro Synth',
    version: '1.0.0',
    type: 'instrument',
    category: 'synth',
    description: 'Analog, wavetable, and FM synthesizer with 16-slot modulation matrix.',
    parameters: [
        { id: 'osc1Shape', name: 'Osc 1 Shape', type: 'enum', defaultValue: 0, enumValues: ['sawtooth', 'square', 'triangle', 'sine', 'rich', 'gritty', 'smooth'], automatable: true },
        { id: 'osc1Detune', name: 'Osc 1 Detune', type: 'float', defaultValue: 0, minValue: -1200, maxValue: 1200, step: 1, unit: 'cents', automatable: true },
        { id: 'osc1Mix', name: 'Osc 1 Mix', type: 'float', defaultValue: 0.5, minValue: 0, maxValue: 1, step: 0.01, automatable: true },
        { id: 'osc2Shape', name: 'Osc 2 Shape', type: 'enum', defaultValue: 1, enumValues: ['sawtooth', 'square', 'triangle', 'sine', 'rich', 'gritty', 'smooth'], automatable: true },
        { id: 'osc2Detune', name: 'Osc 2 Detune', type: 'float', defaultValue: 7, minValue: -1200, maxValue: 1200, step: 1, unit: 'cents', automatable: true },
        { id: 'osc2Mix', name: 'Osc 2 Mix', type: 'float', defaultValue: 0.5, minValue: 0, maxValue: 1, step: 0.01, automatable: true },
        { id: 'filterCutoff', name: 'Filter Cutoff', type: 'float', defaultValue: 1200, minValue: 20, maxValue: 20000, step: 1, unit: 'Hz', automatable: true },
        { id: 'filterResonance', name: 'Filter Resonance', type: 'float', defaultValue: 2, minValue: 0.1, maxValue: 25, step: 0.1, automatable: true },
        { id: 'filterType', name: 'Filter Type', type: 'enum', defaultValue: 0, enumValues: ['lowpass', 'highpass', 'bandpass'], automatable: true },
        { id: 'attack', name: 'Attack', type: 'float', defaultValue: 0.01, minValue: 0.001, maxValue: 5, step: 0.001, unit: 's', automatable: true },
        { id: 'decay', name: 'Decay', type: 'float', defaultValue: 0.3, minValue: 0.01, maxValue: 5, step: 0.01, unit: 's', automatable: true },
        { id: 'sustain', name: 'Sustain', type: 'float', defaultValue: 0.7, minValue: 0, maxValue: 1, step: 0.01, automatable: true },
        { id: 'release', name: 'Release', type: 'float', defaultValue: 0.5, minValue: 0.01, maxValue: 10, step: 0.01, unit: 's', automatable: true },
        { id: 'lfoRate', name: 'LFO Rate', type: 'float', defaultValue: 2.0, minValue: 0.1, maxValue: 20, step: 0.1, unit: 'Hz', automatable: true },
        { id: 'lfoDepth', name: 'LFO Depth', type: 'float', defaultValue: 0.2, minValue: 0, maxValue: 1, step: 0.01, automatable: true },
        { id: 'lfoTarget', name: 'LFO Target', type: 'enum', defaultValue: 0, enumValues: ['filter', 'pitch', 'amplitude'], automatable: true },
        { id: 'glide', name: 'Glide / Portamento', type: 'float', defaultValue: 0, minValue: 0, maxValue: 1, step: 0.01, unit: 's', automatable: true },
    ],
    audioIO: { numInputs: 0, numOutputs: 2, supportsMidi: true },
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
    [BUILTIN_PLUGIN_IDS.saturation]: saturation,
    [BUILTIN_PLUGIN_IDS.widener]: widener,
    [BUILTIN_PLUGIN_IDS.vintageEq]: vintageEq,
    [BUILTIN_PLUGIN_IDS.utility]: utility,
    [BUILTIN_PLUGIN_IDS.tremolo]: tremolo,
    [BUILTIN_PLUGIN_IDS.autoPan]: autoPan,
    [BUILTIN_PLUGIN_IDS.ringMod]: ringMod,
    [BUILTIN_PLUGIN_IDS.phaser]: phaser,
    [BUILTIN_PLUGIN_IDS.graphicEq]: graphicEq,
    [BUILTIN_PLUGIN_IDS.imager]: imager,
    [BUILTIN_PLUGIN_IDS.gate]: gate,
    [BUILTIN_PLUGIN_IDS.expander]: expander,
    [BUILTIN_PLUGIN_IDS.bitcrusher]: bitcrusher,
    [BUILTIN_PLUGIN_IDS.sidechainCompressor]: sidechain,
    [BUILTIN_PLUGIN_IDS.retroSynth]: retroSynth,
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
