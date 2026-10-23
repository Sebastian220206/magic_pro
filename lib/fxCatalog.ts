/**
 * The Audio FX rack, by category.
 *
 * The menu was a flat list of seven entries with a category printed beside
 * each. This is the tree the rack is meant to have — and, more importantly, an
 * honest map of it: every entry either names an effect the engine can build,
 * with the settings that make it that effect, or carries the reason it cannot
 * be built yet.
 *
 * The alternative was a menu of thirty entries where twenty inserted a plugin
 * that produced nothing, which is the failure this codebase keeps finding.
 */

import { BUILTIN_PLUGIN_IDS } from '@/engine/plugins/pluginIds';

export interface FxEntry {
    /** Shown in the menu. */
    name: string;
    /**
     * The built-in this entry inserts, or null when nothing can build it.
     *
     * Several entries share a plugin and differ only in their settings — a
     * Hall and a Plate are the same reverb voiced differently, which is what
     * a preset is.
     */
    pluginId: string | null;
    /** Settings applied on insert, so the entry sounds like its name. */
    params?: Record<string, number>;
    /** Why it cannot be inserted. Shown on the dimmed row. */
    unavailable?: string;
}

export interface FxCategory {
    name: string;
    entries: FxEntry[];
}

const NEEDS_WORKLET = 'Needs an audio worklet for sample-level processing';
const NEEDS_PITCH = 'Needs pitch shifting, which this engine does not have yet';

export const FX_CATALOG: readonly FxCategory[] = [
    {
        name: 'EQ',
        entries: [
            { name: 'Channel EQ', pluginId: BUILTIN_PLUGIN_IDS.eq },
            // One vintage box voiced three ways: the circuit selects which
            // filters the settings drive, the same preset idea as the reverb.
            {
                name: 'Pultec',
                pluginId: BUILTIN_PLUGIN_IDS.vintageEq,
                params: { type: 0, lowBoost: 3, lowFreq: 100, highBoost: 4, highFreq: 10 },
            },
            {
                name: 'Neve 1073',
                pluginId: BUILTIN_PLUGIN_IDS.vintageEq,
                params: { type: 1, highPassFreq: 50, bell1Freq: 3500, bell1Gain: 3, bell2Freq: 220, bell2Gain: 2 },
            },
            {
                name: 'SSL Channel',
                pluginId: BUILTIN_PLUGIN_IDS.vintageEq,
                params: { type: 2, highPassFreq: 40, bell1Freq: 8000, bell1Gain: 2, bell2Freq: 400, bell2Gain: 1.5 },
            },
            {
                name: 'Graphic EQ',
                pluginId: BUILTIN_PLUGIN_IDS.graphicEq,
                // Arrives flat, like the Channel EQ: a preset curve would
                // colour the track before a fader is touched.
                params: {},
            },
        ],
    },
    {
        name: 'Dynamics',
        entries: [
            { name: 'Compressor', pluginId: BUILTIN_PLUGIN_IDS.compressor },
            { name: 'Limiter', pluginId: BUILTIN_PLUGIN_IDS.limiter },
            { name: 'Sidechain Comp', pluginId: BUILTIN_PLUGIN_IDS.sidechainCompressor },
            {
                name: 'Gate',
                pluginId: BUILTIN_PLUGIN_IDS.gate,
                params: { thresholdDb: -24, attackMs: 1, holdMs: 50, releaseMs: 150, floorDb: -80 },
            },
            {
                name: 'Expander',
                pluginId: BUILTIN_PLUGIN_IDS.expander,
                params: { thresholdDb: -24, ratio: 2, attackMs: 5, releaseMs: 120 },
            },
        ],
    },
    {
        name: 'Reverb',
        /*
         * One reverb, voiced four ways. A room is short and damped, a hall is
         * long with pre-delay, a plate is bright and dense with none, and a
         * spring is short, bright and boingy.
         */
        entries: [
            {
                name: 'Room',
                pluginId: BUILTIN_PLUGIN_IDS.reverb,
                params: { decay: 0.8, preDelay: 8, damping: 0.6, mix: 0.22 },
            },
            {
                name: 'Hall',
                pluginId: BUILTIN_PLUGIN_IDS.reverb,
                params: { decay: 3.4, preDelay: 40, damping: 0.35, mix: 0.3 },
            },
            {
                name: 'Plate',
                pluginId: BUILTIN_PLUGIN_IDS.reverb,
                params: { decay: 2.0, preDelay: 0, damping: 0.15, mix: 0.28 },
            },
            {
                name: 'Spring',
                pluginId: BUILTIN_PLUGIN_IDS.reverb,
                params: { decay: 1.2, preDelay: 4, damping: 0.2, mix: 0.35 },
            },
        ],
    },
    {
        name: 'Delay',
        entries: [
            {
                name: 'Stereo Delay',
                pluginId: BUILTIN_PLUGIN_IDS.delay,
                // Different times per side is what makes it stereo.
                params: { timeL: 0.375, timeR: 0.5, feedback: 0.35, mix: 0.3, pingPong: 0 },
            },
            {
                name: 'Ping Pong',
                pluginId: BUILTIN_PLUGIN_IDS.delay,
                params: { timeL: 0.375, timeR: 0.375, feedback: 0.45, mix: 0.3, pingPong: 1 },
            },
            {
                name: 'Tape Delay',
                pluginId: BUILTIN_PLUGIN_IDS.delay,
                // Wow and flutter, and a dull repeat — what a tape machine does.
                params: {
                    timeL: 0.3, timeR: 0.3, feedback: 0.5, mix: 0.3,
                    damping: 0.6, modulation: 0.35, modRate: 0.6,
                },
            },
        ],
    },
    {
        name: 'Distortion',
        // One waveshaper voiced three ways; the character index selects the
        // curve the drive feeds. `decodeBuiltinParams` turns it back into the
        // string the DSP takes.
        entries: [
            {
                name: 'Saturation',
                pluginId: BUILTIN_PLUGIN_IDS.saturation,
                params: { type: 0, drive: 0.35, tone: 0.8, mix: 1 },
            },
            {
                name: 'Overdrive',
                pluginId: BUILTIN_PLUGIN_IDS.saturation,
                params: { type: 0, drive: 0.6, tone: 0.65, mix: 1 },
            },
            {
                name: 'Distortion',
                pluginId: BUILTIN_PLUGIN_IDS.saturation,
                params: { type: 2, drive: 0.8, tone: 0.6, mix: 1 },
            },
            { name: 'Bitcrusher', pluginId: null, unavailable: NEEDS_WORKLET },
        ],
    },
    {
        name: 'Modulation',
        entries: [
            {
                name: 'Chorus',
                pluginId: BUILTIN_PLUGIN_IDS.delay,
                // A chorus is a short modulated delay with no feedback.
                params: {
                    timeL: 0.018, timeR: 0.023, feedback: 0, mix: 0.4,
                    modulation: 0.5, modRate: 0.8, damping: 0.2,
                },
            },
            {
                name: 'Flanger',
                pluginId: BUILTIN_PLUGIN_IDS.delay,
                // Shorter still, and fed back — that is the jet sweep.
                params: {
                    timeL: 0.005, timeR: 0.006, feedback: 0.7, mix: 0.45,
                    modulation: 0.8, modRate: 0.25, damping: 0.1,
                },
            },
            { name: 'Phaser', pluginId: null, unavailable: 'Needs a cascade of all-pass filters' },
            { name: 'Tremolo', pluginId: null, unavailable: 'Needs an LFO on a gain stage' },
        ],
    },
    {
        name: 'Pitch',
        entries: [
            { name: 'Pitch Shifter', pluginId: null, unavailable: NEEDS_PITCH },
            { name: 'Octaver', pluginId: null, unavailable: NEEDS_PITCH },
            { name: 'Harmonizer', pluginId: null, unavailable: NEEDS_PITCH },
        ],
    },
    {
        name: 'Stereo',
        entries: [
            {
                name: 'Stereo Widener',
                pluginId: BUILTIN_PLUGIN_IDS.widener,
                params: { width: 1.4 },
            },
            { name: 'Stereo Imager', pluginId: null, unavailable: 'Needs per-band width control' },
            { name: 'Utility', pluginId: null, unavailable: 'Needs a gain, pan, mono and polarity plugin' },
        ],
    },
    {
        name: 'Creative',
        entries: [
            { name: 'Auto Pan', pluginId: null, unavailable: 'Needs an LFO on a panner' },
            { name: 'Ring Mod', pluginId: null, unavailable: 'Needs an oscillator multiplying the signal' },
            { name: 'Frequency Shifter', pluginId: null, unavailable: 'Needs a Hilbert transform' },
        ],
    },
];

/** How many entries the rack offers, and how many can actually be inserted. */
export function fxCatalogCounts(): { total: number; available: number } {
    let total = 0;
    let available = 0;
    for (const category of FX_CATALOG) {
        for (const entry of category.entries) {
            total++;
            if (entry.pluginId) available++;
        }
    }
    return { total, available };
}

/** Every entry that can be inserted, flattened. */
export function availableFx(): (FxEntry & { category: string })[] {
    return FX_CATALOG.flatMap(c =>
        c.entries.filter(e => e.pluginId).map(e => ({ ...e, category: c.name })));
}

/** Look an entry up by the name shown in the menu. */
export function findFxEntry(name: string): (FxEntry & { category: string }) | undefined {
    for (const category of FX_CATALOG) {
        const entry = category.entries.find(e => e.name === name);
        if (entry) return { ...entry, category: category.name };
    }
    return undefined;
}
