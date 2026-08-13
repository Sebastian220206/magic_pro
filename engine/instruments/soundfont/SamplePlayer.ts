import { VoiceAllocator } from './VoiceAllocator';
import { SampleManager } from './SampleManager';
import { PresetManager } from './PresetManager';
import { Sf2ParsedData, Sf2Generator, GenOper, Sf2SampleHeader } from './SoundFontParser';
import { createDefaultADSR, adsrFromSF2Generators, ADSREnvelopeParams } from './ADSREnvelope';
import { Voice, VoiceState } from './Voice';

export interface PlayNoteOptions {
    note: number;
    velocity: number;
    time?: number;
    duration?: number;
}

interface ResolvedSampleZone {
    sampleIndex: number;
    keyRangeLo: number;
    keyRangeHi: number;
    velRangeLo: number;
    velRangeHi: number;
    rootKey: number;
    fineTune: number;
    coarseTune: number;
    attenuation: number;
    pan: number;
    adsr: ADSREnvelopeParams;
    /** Absolute indices into the font's sample pool, offsets already applied. */
    sampleStart: number;
    sampleEnd: number;
    loopStart: number;
    loopEnd: number;
    sampleModes: number;
    exclusiveClass: number;
    overrideRootKey: number;
    scaleTuning: number;
    /**
     * The rate this zone's sample was recorded at. Per sample, not per font:
     * GeneralUser GS mixes 90 different rates, and its Grand Piano is mostly
     * 31 kHz. Playing that as 44.1 kHz runs it ~610 cents sharp.
     */
    sampleRate: number;
}

export class SamplePlayer {
    private voiceAllocator: VoiceAllocator;
    private sampleManager: SampleManager;
    private presetManager: PresetManager;
    private destination: AudioNode;
    private resolvedZones: ResolvedSampleZone[] = [];

    constructor(
        voiceAllocator: VoiceAllocator,
        sampleManager: SampleManager,
        presetManager: PresetManager,
        destination: AudioNode
    ) {
        this.voiceAllocator = voiceAllocator;
        this.sampleManager = sampleManager;
        this.presetManager = presetManager;
        this.destination = destination;
    }

    setDestination(dest: AudioNode) {
        this.destination = dest;
    }

    loadPreset(presetIndex: number) {
        this.resolvedZones = [];
        const preset = this.presetManager.getPreset(presetIndex);
        if (!preset) return;

        for (const zone of preset.zones) {
            const gens = zone.generators;
            const genMap = new Map<number, number>();
            for (const g of gens) {
                genMap.set(g.genOper, g.genValue);
            }

            const sampleId = genMap.get(GenOper.sampleID) ?? -1;
            if (sampleId < 0) continue;

            const headers = this.presetManager.getSampleHeaders();
            if (sampleId >= headers.length) continue;

            const header = headers[sampleId];

            const keyRange = genMap.get(GenOper.keyRange) ?? 0x7f00;
            const velRange = genMap.get(GenOper.velRange) ?? 0x7f00;
            const keyRangeLo = keyRange & 0xff;
            const keyRangeHi = (keyRange >> 8) & 0xff;
            const velRangeLo = velRange & 0xff;
            const velRangeHi = (velRange >> 8) & 0xff;

            const rootKey = genMap.has(GenOper.overridingRootKey) && genMap.get(GenOper.overridingRootKey)! >= 0
                ? genMap.get(GenOper.overridingRootKey)!
                : header.originalPitch;
            // The sample header's own correction always applies; a zone's
            // fineTune is an additional offset, not a replacement for it.
            const fineTune = (genMap.get(GenOper.fineTune) ?? 0) + header.pitchCorrection;
            const coarseTune = genMap.get(GenOper.coarseTune) ?? 0;
            const attenuation = (genMap.get(GenOper.initialAttenuation) ?? 0) / 10;
            // SF2 pan is signed tenths of a percent: -500 hard left, +500 hard right.
            const pan = Math.max(-1, Math.min(1, (genMap.get(GenOper.pan) ?? 0) / 500));
            const scaleTuning = genMap.get(GenOper.scaleTuning) ?? 100;

            const adsrGenMap = new Map<number, number>();
            for (const [op, val] of genMap.entries()) {
                if (op >= 33 && op <= 40) {
                    adsrGenMap.set(op, val);
                }
                if (op >= 21 && op <= 32) {
                    adsrGenMap.set(op, val);
                }
            }
            const adsr = adsrGenMap.size > 0 ? adsrFromSF2Generators(adsrGenMap) : createDefaultADSR();

            const startAddrsOffset = genMap.get(GenOper.startAddrsOffset) ?? 0;
            const endAddrsOffset = genMap.get(GenOper.endAddrsOffset) ?? 0;
            const startLoopOffset = genMap.get(GenOper.startloopAddrsOffset) ?? 0;
            const endLoopOffset = genMap.get(GenOper.endloopAddrsOffset) ?? 0;
            const startCoarse = genMap.get(GenOper.startAddrsCoarseOffset) ?? 0;
            const endCoarse = genMap.get(GenOper.endAddrsCoarseOffset) ?? 0;
            const loopStartCoarse = genMap.get(GenOper.startloopAddrsCoarseOffset) ?? 0;
            const loopEndCoarse = genMap.get(GenOper.endloopAddrsCoarseOffset) ?? 0;

            const sampleStart = header.start + startAddrsOffset + startCoarse * 32768;
            const sampleEnd = header.end + endAddrsOffset + endCoarse * 32768;
            const loopStart = header.startLoop + startLoopOffset + loopStartCoarse * 32768;
            const loopEnd = header.endLoop + endLoopOffset + loopEndCoarse * 32768;

            const sampleModes = genMap.get(GenOper.sampleModes) ?? 0;
            const exclusiveClass = genMap.get(GenOper.exclusiveClass) ?? 0;
            const overrideRootKey = genMap.get(GenOper.overridingRootKey) ?? -1;

            this.resolvedZones.push({
                sampleIndex: sampleId,
                keyRangeLo: Math.min(keyRangeLo, keyRangeHi),
                keyRangeHi: Math.max(keyRangeLo, keyRangeHi),
                velRangeLo: Math.min(velRangeLo, velRangeHi),
                velRangeHi: Math.max(velRangeLo, velRangeHi),
                rootKey,
                fineTune,
                coarseTune,
                attenuation,
                pan,
                adsr,
                sampleStart,
                sampleEnd,
                loopStart,
                loopEnd,
                sampleModes,
                exclusiveClass,
                overrideRootKey,
                scaleTuning,
                sampleRate: header.sampleRate > 0
                    ? header.sampleRate
                    : this.presetManager.getSampleRate(),
            });
        }
    }

    isLoaded(): boolean {
        return this.resolvedZones.length > 0;
    }

    noteOn(note: number, velocity: number, time: number = 0) {
        if (velocity <= 0 || note < 0 || note > 127) return;

        const clampedVel = Math.min(127, velocity);

        // 1. Filter zones by key range first
        const keyMatchingZones = this.resolvedZones.filter(z =>
            note >= z.keyRangeLo && note <= z.keyRangeHi
        );

        if (keyMatchingZones.length === 0) return;

        // 2. Find exact velocity matches
        let matchingZones = keyMatchingZones.filter(z =>
            clampedVel >= z.velRangeLo && clampedVel <= z.velRangeHi
        );

        // 3. Fallback for fonts with gaps in their velocity split: play the
        //    nearest layer rather than nothing. Ties are broken by keeping the
        //    lowest velocity floor, so a gap never stacks a whole velocity
        //    split's worth of samples onto one key.
        if (matchingZones.length === 0) {
            const distance = (z: ResolvedSampleZone) =>
                clampedVel < z.velRangeLo ? z.velRangeLo - clampedVel
                    : clampedVel > z.velRangeHi ? clampedVel - z.velRangeHi
                        : 0;

            const minDistance = Math.min(...keyMatchingZones.map(distance));
            const nearest = keyMatchingZones.filter(z => distance(z) === minDistance);
            const floor = Math.min(...nearest.map(z => z.velRangeLo));
            matchingZones = nearest.filter(z => z.velRangeLo === floor);
        }

        if (matchingZones.length === 0) return;

        const sampleData = this.presetManager.getSampleData();
        const headers = this.presetManager.getSampleHeaders();

        for (const zone of matchingZones) {
            const header = headers[zone.sampleIndex];
            if (!header) continue;

            // SF2 exclusive class: a new voice silences any sounding voice in
            // the same class, whatever its note — that is how a closed hi-hat
            // cuts the open one. This used to search only voices on the *same*
            // note, so nothing was ever choked.
            if (zone.exclusiveClass > 0) {
                for (const v of this.voiceAllocator.getVoices()) {
                    if ((v as any)._exclusiveClass === zone.exclusiveClass) {
                        v.choke(time);
                    }
                }
            }

            const voice = this.voiceAllocator.acquireVoice();
            if (!voice) continue;

            voice.note = note;
            voice.velocity = velocity;
            (voice as any)._exclusiveClass = zone.exclusiveClass;
            (voice as any)._order = Date.now();

            const sampleRate = zone.sampleRate;
            const centsPerSemitone = 100;
            // scaleTuning is cents of pitch change per semitone of key travel
            // (100 = normal, 0 = every key plays at the sample's own pitch,
            // which is how most drum kits are mapped).
            const keyTravel = (note - zone.rootKey) * (zone.scaleTuning / 100);
            const noteDiff = keyTravel + zone.coarseTune + zone.fineTune / centsPerSemitone;
            const playbackRate = Math.pow(2, noteDiff / 12);

            // Honour the zone's start/end address offsets, and slice via
            // subarray so a sample pool with a non-zero byteOffset still reads
            // correctly.
            const start = Math.max(0, Math.min(zone.sampleStart, sampleData.length));
            const end = Math.max(start, Math.min(zone.sampleEnd, sampleData.length));
            const sampleLen = end - start;
            if (sampleLen <= 0) continue;

            const key = `sf2-${zone.sampleIndex}-${start}-${end}-${sampleRate}`;
            const audioBuffer = this.sampleManager.getOrCreateBuffer(
                key, sampleData.subarray(start, end), sampleRate);

            const gain = Math.pow(10, -zone.attenuation / 20);

            // sampleModes: 1 = loop continuously, 3 = loop until release.
            // 0 and 2 are unlooped. This used to test `> 1`, which looped the
            // one unlooped mode and left the most common looped mode dry.
            // Seconds into the buffer, so measured against the buffer's own
            // rate rather than the nominal one -- SampleManager clamps rates
            // outside what createBuffer accepts and the two can differ.
            const bufferRate = audioBuffer.sampleRate;
            const loopStartTime = (zone.loopStart - start) / bufferRate;
            const loopEndTime = (zone.loopEnd - start) / bufferRate;
            const hasLoop = (zone.sampleModes === 1 || zone.sampleModes === 3)
                && loopEndTime > loopStartTime
                && loopStartTime >= 0;

            voice.start({
                destination: this.destination,
                sampleData: audioBuffer,
                playbackRate: playbackRate * (sampleRate / audioBuffer.sampleRate),
                gain,
                pan: zone.pan,
                adsr: zone.adsr,
                loopStart: hasLoop ? loopStartTime : undefined,
                loopEnd: hasLoop ? loopEndTime : undefined,
                // Playback starts at the top of the slice. It used to start at
                // the loop point, which skipped every sample's attack.
                sampleOffset: 0,
            }, time);
        }
    }

    noteOff(note: number, time: number = 0) {
        this.voiceAllocator.releaseNote(note, time);
    }

    allNotesOff(time: number = 0) {
        this.voiceAllocator.releaseAll(time);
    }

    sustainOn() {
    }

    sustainOff(time: number = 0) {
        for (const voice of this.voiceAllocator.getVoices()) {
            if (voice.hasSustain && voice.state === VoiceState.Playing) {
                voice.release(time);
            }
        }
    }

    cleanup() {
        this.voiceAllocator.cleanup();
    }
}
