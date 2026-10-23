/**
 * pluginIds.ts
 * Canonical plugin identifiers.
 *
 * Two id namespaces grew up independently: the store creates plugins with short
 * ids (`'comp'`, `'eq'`, …) while `registerBuiltins.ts` declares manifests keyed
 * `'magic_wasm_comp'`, `'magic_wasm_eq'`, …. The two never overlapped, so
 * manifest lookups always missed and every plugin editor fell back to a generic
 * key/value dump.
 *
 * Rather than migrate saved projects, both spellings are resolved to one
 * canonical id here. Saved projects keep whatever id they were written with.
 */

/** Canonical ids for the built-in effects. */
export const BUILTIN_PLUGIN_IDS = {
    compressor: 'magic.compressor',
    eq: 'magic.eq',
    reverb: 'magic.reverb',
    delay: 'magic.delay',
    limiter: 'magic.limiter',
    widener: 'magic.widener',
    saturation: 'magic.saturation',
    vintageEq: 'magic.vintageEq',
    utility: 'magic.utility',
    tremolo: 'magic.tremolo',
    autoPan: 'magic.autoPan',
    ringMod: 'magic.ringMod',
    phaser: 'magic.phaser',
    graphicEq: 'magic.graphicEq',
    imager: 'magic.imager',
    gate: 'magic.gate',
    expander: 'magic.expander',
    bitcrusher: 'magic.bitcrusher',
    sidechainCompressor: 'magic.sidechain',
    retroSynth: 'magic.retroSynth',
} as const;

export type BuiltinPluginId = typeof BUILTIN_PLUGIN_IDS[keyof typeof BUILTIN_PLUGIN_IDS];

/** Every spelling that has ever been written into a project, mapped forward. */
const ALIASES: Readonly<Record<string, string>> = {
    // Short ids created by store/projectStore.ts
    comp: BUILTIN_PLUGIN_IDS.compressor,
    compressor: BUILTIN_PLUGIN_IDS.compressor,
    eq: BUILTIN_PLUGIN_IDS.eq,
    reverb: BUILTIN_PLUGIN_IDS.reverb,
    delay: BUILTIN_PLUGIN_IDS.delay,
    limiter: BUILTIN_PLUGIN_IDS.limiter,
    sidechain: BUILTIN_PLUGIN_IDS.sidechainCompressor,
    sidechainComp: BUILTIN_PLUGIN_IDS.sidechainCompressor,
    duck: BUILTIN_PLUGIN_IDS.sidechainCompressor,
    widener: BUILTIN_PLUGIN_IDS.widener,
    stereoWidener: BUILTIN_PLUGIN_IDS.widener,
    saturation: BUILTIN_PLUGIN_IDS.saturation,
    overdrive: BUILTIN_PLUGIN_IDS.saturation,
    distortion: BUILTIN_PLUGIN_IDS.saturation,
    vintageEq: BUILTIN_PLUGIN_IDS.vintageEq,
    pultec: BUILTIN_PLUGIN_IDS.vintageEq,
    neve: BUILTIN_PLUGIN_IDS.vintageEq,
    sslEq: BUILTIN_PLUGIN_IDS.vintageEq,
    utility: BUILTIN_PLUGIN_IDS.utility,
    tremolo: BUILTIN_PLUGIN_IDS.tremolo,
    autoPan: BUILTIN_PLUGIN_IDS.autoPan,
    autopan: BUILTIN_PLUGIN_IDS.autoPan,
    ringMod: BUILTIN_PLUGIN_IDS.ringMod,
    ringmod: BUILTIN_PLUGIN_IDS.ringMod,
    phaser: BUILTIN_PLUGIN_IDS.phaser,
    graphicEq: BUILTIN_PLUGIN_IDS.graphicEq,
    graphiceq: BUILTIN_PLUGIN_IDS.graphicEq,
    imager: BUILTIN_PLUGIN_IDS.imager,
    stereoImager: BUILTIN_PLUGIN_IDS.imager,
    gate: BUILTIN_PLUGIN_IDS.gate,
    expander: BUILTIN_PLUGIN_IDS.expander,
    bitcrusher: BUILTIN_PLUGIN_IDS.bitcrusher,
    bitcrush: BUILTIN_PLUGIN_IDS.bitcrusher,
    retroSynth: BUILTIN_PLUGIN_IDS.retroSynth,
    retrosynth: BUILTIN_PLUGIN_IDS.retroSynth,
    synth: BUILTIN_PLUGIN_IDS.retroSynth,
    magic_retro_synth: BUILTIN_PLUGIN_IDS.retroSynth,

    // Manifest ids declared in registerBuiltins.ts
    magic_wasm_comp: BUILTIN_PLUGIN_IDS.compressor,
    magic_wasm_eq: BUILTIN_PLUGIN_IDS.eq,
    magic_wasm_reverb: BUILTIN_PLUGIN_IDS.reverb,
    magic_wasm_delay: BUILTIN_PLUGIN_IDS.delay,
    magic_wasm_limiter: BUILTIN_PLUGIN_IDS.limiter,
};

/**
 * Resolve any known spelling to its canonical id.
 *
 * Unknown ids pass through unchanged — a third-party WAM identifier is already
 * canonical and must not be rewritten.
 */
export function resolvePluginId(raw: string | undefined | null): string {
    if (!raw) return '';
    return ALIASES[raw] ?? raw;
}

/** True when the id names one of the built-in effects. */
export function isBuiltinPluginId(raw: string | undefined | null): boolean {
    const id = resolvePluginId(raw);
    return (Object.values(BUILTIN_PLUGIN_IDS) as string[]).includes(id);
}

/** Display names for the built-ins, used when creating a new instance. */
export const BUILTIN_PLUGIN_NAMES: Readonly<Record<string, string>> = {
    [BUILTIN_PLUGIN_IDS.compressor]: 'Compressor',
    [BUILTIN_PLUGIN_IDS.eq]: 'Channel EQ',
    [BUILTIN_PLUGIN_IDS.reverb]: 'Space Designer',
    [BUILTIN_PLUGIN_IDS.delay]: 'Delay Designer',
    [BUILTIN_PLUGIN_IDS.limiter]: 'Limiter',
    [BUILTIN_PLUGIN_IDS.widener]: 'Stereo Widener',
    [BUILTIN_PLUGIN_IDS.saturation]: 'Saturation',
    [BUILTIN_PLUGIN_IDS.vintageEq]: 'Vintage EQ',
    [BUILTIN_PLUGIN_IDS.utility]: 'Utility',
    [BUILTIN_PLUGIN_IDS.tremolo]: 'Tremolo',
    [BUILTIN_PLUGIN_IDS.autoPan]: 'Auto Pan',
    [BUILTIN_PLUGIN_IDS.ringMod]: 'Ring Mod',
    [BUILTIN_PLUGIN_IDS.phaser]: 'Phaser',
    [BUILTIN_PLUGIN_IDS.graphicEq]: 'Graphic EQ',
    [BUILTIN_PLUGIN_IDS.imager]: 'Stereo Imager',
    [BUILTIN_PLUGIN_IDS.gate]: 'Gate',
    [BUILTIN_PLUGIN_IDS.expander]: 'Expander',
    [BUILTIN_PLUGIN_IDS.bitcrusher]: 'Bitcrusher',
    [BUILTIN_PLUGIN_IDS.sidechainCompressor]: 'Sidechain Comp',
};
