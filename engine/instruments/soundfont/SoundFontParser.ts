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

    private parseGenerators(offset: number, count: number): Sf2Generator[] {
        const generators: Sf2Generator[] = [];
        for (let i = 0; i < count; i++) {
            const genOper = this.readWord(offset + i * 4);
            const genValue = this.readWord(offset + i * 4 + 2);
            generators.push({ genOper, genValue });
            if (genOper === 0) break;
        }
        return generators;
    }

    private parseZones(
        zoneStartOffset: number,
        zoneCount: number,
        genStartOffset: number,
        modStartOffset: number,
        genSize: number,
        modSize: number
    ): Sf2Zone[] {
        const zones: Sf2Zone[] = [];
        for (let i = 0; i < zoneCount; i++) {
            const genIndex = this.readWord(zoneStartOffset + i * 4);
            const modIndex = this.readWord(zoneStartOffset + i * 4 + 2);
            const nextGenIndex = i < zoneCount - 1
                ? this.readWord(zoneStartOffset + (i + 1) * 4)
                : genSize / 4;
            const nextModIndex = i < zoneCount - 1
                ? this.readWord(zoneStartOffset + (i + 1) * 4 + 2)
                : modSize / 10;
            const genCount = nextGenIndex - genIndex;
            const modCount = nextModIndex - modIndex;
            const generators = this.parseGenerators(genStartOffset + genIndex * 4, genCount);
            const modulators: { srcOper: number; destOper: number; amount: number }[] = [];
            for (let m = 0; m < modCount; m++) {
                const mo = modStartOffset + (modIndex + m) * 10;
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
        const instrumentCount = Math.floor(instSize / 22);
        if (instrumentCount === 0) return [];

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
            const nextBagIndex = i < instrumentCount - 1
                ? this.readWord(instStart + (i + 1) * 22 + 20)
                : ibagSize / 4;
            const zoneCount = nextBagIndex - bagIndex;

            const zones = this.parseZones(
                ibagStart + bagIndex * 4,
                zoneCount,
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
            const zoneCount = nextBagIndex - bagIndex;

            const zones = this.parseZones(
                pbagStart + bagIndex * 4,
                zoneCount,
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

    private resolvePresetZones(
        presetZones: Sf2Zone[],
        instruments: Sf2Instrument[],
        sampleHeaders: Sf2SampleHeader[]
    ): Sf2Zone[] {
        const resolved: Sf2Zone[] = [];

        for (const pzone of presetZones) {
            const globalGens = [...pzone.generators];
            const instrumentGen = globalGens.find(g => g.genOper === GenOper.instrument);
            if (!instrumentGen) {
                resolved.push({ generators: globalGens, modulators: pzone.modulators });
                continue;
            }
            const instIndex = instrumentGen.genValue;
            if (instIndex >= instruments.length) {
                resolved.push({ generators: globalGens, modulators: [] });
                continue;
            }
            const inst = instruments[instIndex];
            for (const izone of inst.zones) {
                const mergedGens = [...globalGens.filter(g => g.genOper !== GenOper.instrument)];
                for (const ig of izone.generators) {
                    const existing = mergedGens.findIndex(mg => mg.genOper === ig.genOper);
                    if (existing >= 0) {
                        mergedGens[existing] = ig;
                    } else {
                        mergedGens.push(ig);
                    }
                }

                const sampleIdGen = mergedGens.find(g => g.genOper === GenOper.sampleID);
                if (sampleIdGen && sampleIdGen.genValue < sampleHeaders.length) {
                    resolved.push({
                        generators: mergedGens,
                        modulators: [...pzone.modulators, ...izone.modulators]
                    });
                }
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
