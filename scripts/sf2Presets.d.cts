/**
 * Types for `sf2Presets.cjs`.
 *
 * The implementation is plain JavaScript because it runs from a build script
 * before any TypeScript is compiled. These declarations let the test that pins
 * it against `SoundFontParser` import it with the rest of the suite.
 */

export interface ManifestPreset {
    /** Position in `phdr` order — this is what `presetIndex` refers to. */
    index: number;
    name: string;
    bank: number;
    program: number;
}

export interface PdtaChunk {
    /** Offset of the chunk's data, not its header. */
    offset: number;
    size: number;
}

export function findPdtaChunk(view: DataView, wanted: string): PdtaChunk | null;

export function extractPresets(buffer: ArrayBuffer): ManifestPreset[];
