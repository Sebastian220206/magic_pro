export interface Sf2SampleHeader {
    name: string;
    start: number;
    end: number;
    startLoop: number;
    endLoop: number;
    sampleRate: number;
    originalPitch: number;
    pitchCorrection: number;
    sampleLink: number;
    sampleType: number;
}

export interface Sf2Generator {
    genOper: number;
    genValue: number;
}

export interface Sf2Zone {
    generators: Sf2Generator[];
    modulators: { srcOper: number; destOper: number; amount: number }[];
}

export interface Sf2Instrument {
    name: string;
    zones: Sf2Zone[];
}

export interface Sf2Preset {
    name: string;
    preset: number;
    bank: number;
    library: number;
    genre: number;
    zones: Sf2Zone[];
}

export interface Sf2ParsedData {
    presets: Sf2Preset[];
    instruments: Sf2Instrument[];
    sampleHeaders: Sf2SampleHeader[];
    sampleData: Float32Array;
    sampleRate: number;
}

const CHUNK_RIFF = 'RIFF';
const CHUNK_LIST = 'LIST';
const CHUNK_SDTA = 'sdta';
const CHUNK_PDTA = 'pdta';
const CHUNK_SMPL = 'smpl';
const CHUNK_INFO = 'INFO';
const CHUNK_PHDR = 'phdr';
const CHUNK_PBAG = 'pbag';
const CHUNK_PMOD = 'pmod';
const CHUNK_PGEN = 'pgen';
const CHUNK_INST = 'inst';
const CHUNK_IBAG = 'ibag';
const CHUNK_IMOD = 'imod';
const CHUNK_IGEN = 'igen';
const CHUNK_SHDR = 'shdr';

export enum GenOper {
    startAddrsOffset = 0,
    endAddrsOffset = 1,
    startloopAddrsOffset = 2,
    endloopAddrsOffset = 3,
    startAddrsCoarseOffset = 4,
    modLfoToPitch = 5,
    vibLfoToPitch = 6,
    modEnvToPitch = 7,
    initialFilterFc = 8,
    initialFilterQ = 9,
    modLfoToFilterFc = 10,
    modEnvToFilterFc = 11,
    endAddrsCoarseOffset = 12,
    modLfoToVolume = 13,
    chorusEffectsSend = 15,
    reverbEffectsSend = 16,
    pan = 17,
    delayModLFO = 21,
    freqModLFO = 22,
    delayVibLFO = 23,
    freqVibLFO = 24,
    delayModEnv = 25,
    attackModEnv = 26,
    holdModEnv = 27,
    decayModEnv = 28,
    sustainModEnv = 29,
    releaseModEnv = 30,
    keynumToModEnvHold = 31,
    keynumToModEnvDecay = 32,
    delayVolEnv = 33,
    attackVolEnv = 34,
    holdVolEnv = 35,
    decayVolEnv = 36,
    sustainVolEnv = 37,
    releaseVolEnv = 38,
    keynumToVolEnvHold = 39,
    keynumToVolEnvDecay = 40,
    instrument = 41,
    keyRange = 43,
    velRange = 44,
    startloopAddrsCoarseOffset = 45,
    keynum = 46,
    velocity = 47,
    initialAttenuation = 48,
    endloopAddrsCoarseOffset = 50,
    coarseTune = 51,
    fineTune = 52,
    sampleID = 53,
    sampleModes = 54,
    scaleTuning = 56,
    exclusiveClass = 57,
    overridingRootKey = 58,
    endAddrsCoarseOffset2 = 62,
}

/**
 * Generators whose `genValue` is an index or a packed pair of unsigned bytes.
 * Everything else is a signed 16-bit amount.
 */
const UNSIGNED_GENERATORS = new Set<number>([
    GenOper.instrument,
    GenOper.sampleID,
    GenOper.keyRange,
    GenOper.velRange,
]);

/**
 * Generators the SF2 spec (§8.1.2) marks as instrument-level only. A value for
 * one of these in a preset zone is not an offset and must be ignored rather
 * than added — adding a preset `sampleModes` to an instrument's, for instance,
 * would turn a looped sample into a one-shot.
 */
const PRESET_IGNORED_GENERATORS = new Set<number>([
    GenOper.startAddrsOffset,
    GenOper.endAddrsOffset,
    GenOper.startloopAddrsOffset,
    GenOper.endloopAddrsOffset,
    GenOper.startAddrsCoarseOffset,
    GenOper.endAddrsCoarseOffset,
    GenOper.startloopAddrsCoarseOffset,
    GenOper.endloopAddrsCoarseOffset,
    GenOper.endAddrsCoarseOffset2,
    GenOper.keynum,
    GenOper.velocity,
    GenOper.sampleModes,
    GenOper.exclusiveClass,
    GenOper.overridingRootKey,
    GenOper.sampleID,
    GenOper.instrument,
]);

/**
 * SF2 defaults for generators whose default is not zero. A preset offset is
 * added on top of these when the instrument zone leaves the generator unset.
 */
const GENERATOR_DEFAULTS: Record<number, number> = {
    [GenOper.initialFilterFc]: 13500,
    [GenOper.delayModLFO]: -12000,
    [GenOper.delayVibLFO]: -12000,
    [GenOper.delayModEnv]: -12000,
    [GenOper.attackModEnv]: -12000,
    [GenOper.holdModEnv]: -12000,
    [GenOper.decayModEnv]: -12000,
    [GenOper.releaseModEnv]: -12000,
    [GenOper.delayVolEnv]: -12000,
    [GenOper.attackVolEnv]: -12000,
    [GenOper.holdVolEnv]: -12000,
    [GenOper.decayVolEnv]: -12000,
    [GenOper.releaseVolEnv]: -12000,
    [GenOper.scaleTuning]: 100,
};

/**
 * Separate a zone list's leading global zone from the real zones.
 *
 * SF2 §7.2/§7.6: a preset's or instrument's first zone is global when it lacks
 * the terminal generator (`instrument` / `sampleID`). Its generators are
 * defaults for its siblings. Every other zone missing that generator is
 * malformed and dropped.
 */
function splitGlobalZone(
    zones: Sf2Zone[],
    terminal: GenOper,
): { global: Map<number, number>; zones: Sf2Zone[] } {
    const hasTerminal = (z: Sf2Zone) => z.generators.some(g => g.genOper === terminal);

    if (zones.length > 0 && !hasTerminal(zones[0])) {
        const global = new Map<number, number>();
        for (const g of zones[0].generators) global.set(g.genOper, g.genValue);
        return { global, zones: zones.slice(1).filter(hasTerminal) };
    }
    return { global: new Map(), zones: zones.filter(hasTerminal) };
}

/** A zone's own generators layered over its global zone's, zone wins. */
function overlayGenerators(global: Map<number, number>, own: Sf2Generator[]): Map<number, number> {
    const out = new Map(global);
    for (const g of own) out.set(g.genOper, g.genValue);
    return out;
}

/** Intersect two packed SF2 ranges, or null when they do not overlap. */
function intersectRange(a: number | undefined, b: number | undefined): number | null {
    if (a === undefined) return b === undefined ? null : b;
    if (b === undefined) return a;
    const lo = Math.max(a & 0xff, b & 0xff);
    const hi = Math.min((a >> 8) & 0xff, (b >> 8) & 0xff);
    if (lo > hi) return null;
    return lo | (hi << 8);
}

/**
 * Apply preset generators to an instrument zone per §9.4.
 * Returns null when the preset's key/velocity filter excludes the zone.
 */
function combineZone(
    pgens: Map<number, number>,
    igens: Map<number, number>,
): Sf2Generator[] | null {
    const out = new Map(igens);

    for (const range of [GenOper.keyRange, GenOper.velRange]) {
        const merged = intersectRange(pgens.get(range), igens.get(range));
        if (merged === null && pgens.has(range) && igens.has(range)) return null;
        if (merged !== null) out.set(range, merged);
    }

    for (const [op, pValue] of pgens) {
        if (op === GenOper.keyRange || op === GenOper.velRange) continue;
        if (PRESET_IGNORED_GENERATORS.has(op)) continue;
        const base = igens.get(op) ?? GENERATOR_DEFAULTS[op] ?? 0;
        out.set(op, base + pValue);
    }

    return Array.from(out, ([genOper, genValue]) => ({ genOper, genValue }));
}

export class SoundFontParser {
    private view!: DataView;
    private data!: ArrayBuffer;

    parse(buffer: ArrayBuffer): Sf2ParsedData {
        this.data = buffer;
        this.view = new DataView(buffer);

        let offset = 0;
        const riffId = this.readString(offset, 4);
        offset += 4;
        if (riffId !== CHUNK_RIFF) {
            throw new Error('Not a valid RIFF file');
        }
        offset += 4;
        const formType = this.readString(offset, 4);
        offset += 4;
        if (formType !== 'sfbk') {
            throw new Error('Not a valid SoundFont file');
        }

        let sdtaOffset = -1;
        let sdtaSize = 0;
        let pdtaOffset = -1;
        let pdtaSize = 0;

        while (offset < this.data.byteLength) {
            const chunkId = this.readString(offset, 4);
            const chunkSize = this.readInt(offset + 4);
            offset += 8;

            if (chunkId === CHUNK_LIST) {
                const listType = this.readString(offset, 4);
                offset += 4;
                const listDataSize = chunkSize - 4;
                if (listType === CHUNK_SDTA) {
                    sdtaOffset = offset;
                    sdtaSize = listDataSize;
                } else if (listType === CHUNK_PDTA) {
                    pdtaOffset = offset;
                    pdtaSize = listDataSize;
                }
                offset += listDataSize;
            } else {
                if (chunkSize > 0) {
                    offset += chunkSize;
                }
            }
        }

        if (sdtaOffset < 0 || pdtaOffset < 0) {
            throw new Error('Missing required chunks (sdta or pdta)');
        }

        const sampleData = this.parseSdta(sdtaOffset, sdtaSize);
        const sampleHeaders = this.parseShdr(pdtaOffset, pdtaSize);
        const instruments = this.parseInstruments(pdtaOffset, pdtaSize);
        const presets = this.parsePresets(pdtaOffset, pdtaSize, sampleHeaders, instruments);

        // Fallback for headers that declare no rate of their own. It is NOT the
        // font's rate -- there is no such thing. Every sample carries its own,
        // and GeneralUser GS alone mixes 90 distinct rates, so anything that
        // plays a sample must read the rate off that sample's header.
        const sampleRate = sampleHeaders.length > 0 ? sampleHeaders[0].sampleRate : 44100;

        return { presets, instruments, sampleHeaders, sampleData, sampleRate };
    }

    private parseSdta(offset: number, size: number): Float32Array {
        const smplId = this.readString(offset, 4);
        if (smplId !== CHUNK_SMPL) {
            return new Float32Array(0);
        }
        const smplSize = this.readInt(offset + 4);
        const smplData = this.readInt16Array(offset + 8, smplSize / 2);
        const floatData = new Float32Array(smplData.length);
        for (let i = 0; i < smplData.length; i++) {
            floatData[i] = smplData[i] / 32768;
        }
        return floatData;
    }

    private parseShdr(pdtaOffset: number, _pdtaSize: number): Sf2SampleHeader[] {
        let offset = this.findChunk(pdtaOffset, CHUNK_SHDR);
        if (offset < 0) return [];

        const size = this.readInt(offset + 4);
        const count = Math.floor(size / 46);
        offset += 8;

        const headers: Sf2SampleHeader[] = [];
        for (let i = 0; i < count; i++) {
            const name = this.readString(offset + i * 46, 20).replace(/\0/g, '').trim();
            const start = this.readInt(offset + i * 46 + 20);
            const end = this.readInt(offset + i * 46 + 24);
            const startLoop = this.readInt(offset + i * 46 + 28);
            const endLoop = this.readInt(offset + i * 46 + 32);
            const sampleRate = this.readInt(offset + i * 46 + 36);
            const originalPitch = this.readByte(offset + i * 46 + 40);
            const pitchCorrection = this.readSByte(offset + i * 46 + 41);
            const sampleLink = this.readWord(offset + i * 46 + 42);
            const sampleType = this.readWord(offset + i * 46 + 44);
            headers.push({ name, start, end, startLoop, endLoop, sampleRate, originalPitch, pitchCorrection, sampleLink, sampleType });
        }
        return headers;
    }

    /**
     * Read one zone's generator list.
     *
     * `genValue` is a signed 16-bit amount for every generator except the four
     * that carry an index or a packed byte pair; reading those signed is
     * harmless for this font but reading the rest *unsigned* turned every
     * negative tuning, pan and envelope amount into a value near 65535.
     *
     * There is deliberately no "stop at genOper 0" sentinel: 0 is
     * `startAddrsOffset`, a real generator that sorts first, so breaking on it
     * truncated any zone that used one.
     */
    private parseGenerators(offset: number, count: number): Sf2Generator[] {
        const generators: Sf2Generator[] = [];
        for (let i = 0; i < count; i++) {
            const genOper = this.readWord(offset + i * 4);
            const genValue = UNSIGNED_GENERATORS.has(genOper)
                ? this.readWord(offset + i * 4 + 2)
                : this.readShort(offset + i * 4 + 2);
            generators.push({ genOper, genValue });
        }
        return generators;
    }

    /**
     * Read `zoneCount` zones starting at bag record `firstBagIndex`.
     *
     * A zone's generators run from its own bag record's index up to the *next
     * bag record's* index. The bag chunk always carries one terminal record
     * past the last zone, so that next record always exists.
     *
     * This used to bound the final zone of each preset/instrument with the end
     * of the whole gen chunk instead, so every last zone absorbed every
     * remaining generator in the file — hundreds of them, from unrelated
     * instruments. It was masked only by the bogus genOper-0 break above.
     */
    private parseZones(
        bagStart: number,
        firstBagIndex: number,
        zoneCount: number,
        bagCount: number,
        genStartOffset: number,
        modStartOffset: number,
        genSize: number,
        modSize: number
    ): Sf2Zone[] {
        const readBag = (index: number) => ({
            gen: this.readWord(bagStart + index * 4),
            mod: this.readWord(bagStart + index * 4 + 2),
        });

        const zones: Sf2Zone[] = [];
        for (let i = 0; i < zoneCount; i++) {
            const index = firstBagIndex + i;
            const here = readBag(index);
            const next = index + 1 < bagCount
                ? readBag(index + 1)
                : { gen: Math.floor(genSize / 4), mod: Math.floor(modSize / 10) };

            const genCount = Math.max(0, next.gen - here.gen);
            const modCount = Math.max(0, next.mod - here.mod);

            const generators = this.parseGenerators(genStartOffset + here.gen * 4, genCount);
            const modulators: { srcOper: number; destOper: number; amount: number }[] = [];
            for (let m = 0; m < modCount; m++) {
                const mo = modStartOffset + (here.mod + m) * 10;
                modulators.push({
                    srcOper: this.readWord(mo),
                    destOper: this.readWord(mo + 2),
                    amount: this.readShort(mo + 4)
                });
            }
            zones.push({ generators, modulators });
        }
        return zones;
    }

    private parseInstruments(pdtaOffset: number, _pdtaSize: number): Sf2Instrument[] {
        const instOffset = this.findChunk(pdtaOffset, CHUNK_INST);
        const ibagOffset = this.findChunk(pdtaOffset, CHUNK_IBAG);
        const imodOffset = this.findChunk(pdtaOffset, CHUNK_IMOD);
        const igenOffset = this.findChunk(pdtaOffset, CHUNK_IGEN);

        if (instOffset < 0 || ibagOffset < 0 || igenOffset < 0) return [];

        const instSize = this.readInt(instOffset + 4);
        // The `inst` chunk ends with a terminal "EOI" record that only marks
        // where the last instrument's bags stop; it is not an instrument.
        const instrumentCount = Math.floor(instSize / 22) - 1;
        if (instrumentCount <= 0) return [];

        const ibagSize = this.readInt(ibagOffset + 4);
        const igenSize = this.readInt(igenOffset + 4);
        const modSize = imodOffset >= 0 ? this.readInt(imodOffset + 4) : 0;

        const instStart = instOffset + 8;
        const ibagStart = ibagOffset + 8;
        const igenStart = igenOffset + 8;
        const imodStart = imodOffset >= 0 ? imodOffset + 8 : 0;

        const instruments: Sf2Instrument[] = [];
        for (let i = 0; i < instrumentCount; i++) {
            const name = this.readString(instStart + i * 22, 20).replace(/\0/g, '').trim();
            const bagIndex = this.readWord(instStart + i * 22 + 20);
            const nextBagIndex = this.readWord(instStart + (i + 1) * 22 + 20);
            const zoneCount = Math.max(0, nextBagIndex - bagIndex);

            const zones = this.parseZones(
                ibagStart,
                bagIndex,
                zoneCount,
                Math.floor(ibagSize / 4),
                igenStart,
                imodStart,
                igenSize,
                modSize
            );

            instruments.push({ name, zones });
        }
        return instruments;
    }

    private parsePresets(
        pdtaOffset: number,
        _pdtaSize: number,
        sampleHeaders: Sf2SampleHeader[],
        instruments: Sf2Instrument[]
    ): Sf2Preset[] {
        const phdrOffset = this.findChunk(pdtaOffset, CHUNK_PHDR);
        const pbagOffset = this.findChunk(pdtaOffset, CHUNK_PBAG);
        const pmodOffset = this.findChunk(pdtaOffset, CHUNK_PMOD);
        const pgenOffset = this.findChunk(pdtaOffset, CHUNK_PGEN);

        if (phdrOffset < 0 || pbagOffset < 0 || pgenOffset < 0) return [];

        const phdrSize = this.readInt(phdrOffset + 4);
        const presetCount = Math.floor(phdrSize / 38) - 1;
        if (presetCount <= 0) return [];

        const pbagSize = this.readInt(pbagOffset + 4);
        const pgenSize = this.readInt(pgenOffset + 4);
        const pmodSize = pmodOffset >= 0 ? this.readInt(pmodOffset + 4) : 0;

        const phdrStart = phdrOffset + 8;
        const pbagStart = pbagOffset + 8;
        const pgenStart = pgenOffset + 8;
        const pmodStart = pmodOffset >= 0 ? pmodOffset + 8 : 0;

        const presets: Sf2Preset[] = [];
        for (let i = 0; i < presetCount; i++) {
            const name = this.readString(phdrStart + i * 38, 20).replace(/\0/g, '').trim();
            const preset = this.readWord(phdrStart + i * 38 + 20);
            const bank = this.readWord(phdrStart + i * 38 + 22);
            const bagIndex = this.readWord(phdrStart + i * 38 + 24);
            const library = this.readInt(phdrStart + i * 38 + 28);
            const genre = this.readInt(phdrStart + i * 38 + 32);
            const nextBagIndex = this.readWord(phdrStart + (i + 1) * 38 + 24);
            const zoneCount = Math.max(0, nextBagIndex - bagIndex);

            const zones = this.parseZones(
                pbagStart,
                bagIndex,
                zoneCount,
                Math.floor(pbagSize / 4),
                pgenStart,
                pmodStart,
                pgenSize,
                pmodSize
            );

            const resolvedZones = this.resolvePresetZones(zones, instruments, sampleHeaders);

            presets.push({ name, preset, bank, library, genre, zones: resolvedZones });
        }
        return presets;
    }

    /**
     * Flatten preset zones → instrument zones → sample zones, following the
     * combination rules in SF2 2.04 §9.4.
     *
     * The rules are not "instrument overrides preset". They are:
     *
     *  - `keyRange`/`velRange` at preset level are *filters*: the playable
     *    range is the **intersection** with the instrument zone's range, and a
     *    zone whose intersection is empty never sounds and is dropped.
     *  - Every other preset generator is an **offset added** to the instrument
     *    value (or to the SF2 default when the instrument does not set it).
     *  - A handful of generators are meaningless at preset level and are
     *    ignored there entirely (sample addressing, `sampleModes`, and so on).
     *  - The first zone of a preset (no `instrument` gen) or of an instrument
     *    (no `sampleID` gen) is a **global zone** supplying defaults to its
     *    siblings, not a zone of its own.
     *
     * Treating preset generators as overrides — as this used to — silently
     * discards the preset's range filtering, so every instrument zone answers
     * every key. On GeneralUser GS that made one middle C on "Grand Piano"
     * fire 27 sample voices instead of one.
     */
    private resolvePresetZones(
        presetZones: Sf2Zone[],
        instruments: Sf2Instrument[],
        sampleHeaders: Sf2SampleHeader[]
    ): Sf2Zone[] {
        const resolved: Sf2Zone[] = [];

        const { global: presetGlobal, zones: realPresetZones } =
            splitGlobalZone(presetZones, GenOper.instrument);



        for (const pzone of realPresetZones) {
            const pgens = overlayGenerators(presetGlobal, pzone.generators);

            const instrumentGen = pgens.get(GenOper.instrument);
            if (instrumentGen === undefined) continue;
            const inst = instruments[instrumentGen];
            if (!inst) continue;

            const { global: instGlobal, zones: realInstZones } =
                splitGlobalZone(inst.zones, GenOper.sampleID);

            for (const izone of realInstZones) {
                const igens = overlayGenerators(instGlobal, izone.generators);

                const sampleId = igens.get(GenOper.sampleID);
                if (sampleId === undefined || sampleId >= sampleHeaders.length) continue;

                const combined = combineZone(pgens, igens);
                if (!combined) continue; // empty key/velocity intersection

                resolved.push({
                    generators: combined,
                    modulators: [...pzone.modulators, ...izone.modulators],
                });
            }
        }
        return resolved;
    }

    private findChunk(offset: number, chunkId: string): number {
        let pos = offset;
        while (pos < this.data.byteLength) {
            const id = this.readString(pos, 4);
            if (id === chunkId) return pos;
            const size = this.readInt(pos + 4);
            if (size <= 0) return -1;
            pos += 8 + (size % 2 !== 0 ? size + 1 : size);
        }
        return -1;
    }

    private readString(offset: number, length: number): string {
        let result = '';
        for (let i = 0; i < length; i++) {
            const char = this.view.getUint8(offset + i);
            if (char === 0) break;
            result += String.fromCharCode(char);
        }
        return result;
    }

    private readInt(offset: number): number {
        return this.view.getInt32(offset, true);
    }

    private readShort(offset: number): number {
        return this.view.getInt16(offset, true);
    }

    private readWord(offset: number): number {
        return this.view.getUint16(offset, true);
    }

    private readByte(offset: number): number {
        return this.view.getUint8(offset);
    }

    private readSByte(offset: number): number {
        return this.view.getInt8(offset);
    }

    private readInt16Array(offset: number, count: number): Int16Array {
        return new Int16Array(this.data.slice(offset, offset + count * 2));
    }

    getPresetGeneratorValue(generators: Sf2Generator[], genOper: GenOper, defaultValue: number): number {
        const gen = generators.find(g => g.genOper === genOper);
        return gen ? gen.genValue : defaultValue;
    }

    getKeyRange(generators: Sf2Generator[]): { lo: number; hi: number } {
        const gen = generators.find(g => g.genOper === GenOper.keyRange);
        if (gen) {
            return { lo: gen.genValue & 0xff, hi: (gen.genValue >> 8) & 0xff };
        }
        return { lo: 0, hi: 127 };
    }

    getVelRange(generators: Sf2Generator[]): { lo: number; hi: number } {
        const gen = generators.find(g => g.genOper === GenOper.velRange);
        if (gen) {
            return { lo: gen.genValue & 0xff, hi: (gen.genValue >> 8) & 0xff };
        }
        return { lo: 0, hi: 127 };
    }
}
