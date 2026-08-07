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
    sidechainCompressor: 'magic.sidechain',
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
    [BUILTIN_PLUGIN_IDS.sidechainCompressor]: 'Sidechain Comp',
};
