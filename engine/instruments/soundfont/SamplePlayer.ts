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
    loopStart: number;
    loopEnd: number;
    sampleModes: number;
    exclusiveClass: number;
    overrideRootKey: number;
    scaleTuning: number;
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

            const keyRangeLo = (genMap.get(GenOper.keyRange) ?? 0) & 0xff;
            const keyRangeHi = ((genMap.get(GenOper.keyRange) ?? 0xff00) >> 8) & 0xff;
            const velRangeLo = (genMap.get(GenOper.velRange) ?? 0) & 0xff;
            const velRangeHi = ((genMap.get(GenOper.velRange) ?? 0xff00) >> 8) & 0xff;

            const rootKey = genMap.has(GenOper.overridingRootKey)
                ? genMap.get(GenOper.overridingRootKey)!
                : header.originalPitch;
            const fineTune = genMap.get(GenOper.fineTune) ?? header.pitchCorrection;
            const coarseTune = genMap.get(GenOper.coarseTune) ?? 0;
            const attenuation = (genMap.get(GenOper.initialAttenuation) ?? 0) / 10;
            const panValue = (genMap.get(GenOper.pan) ?? 0);
            const pan = panValue >= 500 ? (panValue - 500) / 500 : panValue / 500;
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

            const sampleModes = genMap.get(GenOper.sampleModes) ?? 1;
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
                loopStart,
                loopEnd,
                sampleModes,
                exclusiveClass,
                overrideRootKey,
                scaleTuning,
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

        // 3. Fallback: Find zones with the closest velocity range if no exact match
        if (matchingZones.length === 0) {
            let minDistance = Infinity;
            const zonesWithDistance = keyMatchingZones.map(z => {
                let dist = 0;
                if (clampedVel < z.velRangeLo) {
                    dist = z.velRangeLo - clampedVel;
                } else if (clampedVel > z.velRangeHi) {
                    dist = clampedVel - z.velRangeHi;
                }
                if (dist < minDistance) {
                    minDistance = dist;
                }
                return { zone: z, dist };
            });

            matchingZones = zonesWithDistance
                .filter(zd => zd.dist === minDistance)
                .map(zd => zd.zone);
        }

        if (matchingZones.length === 0) return;

        const sampleData = this.presetManager.getSampleData();
        const headers = this.presetManager.getSampleHeaders();

        for (const zone of matchingZones) {
            const header = headers[zone.sampleIndex];
            if (!header) continue;

            if (zone.exclusiveClass > 0) {
                const existing = this.voiceAllocator.findVoicesForNote(note);
                for (const v of existing) {
                    if ((v as any)._exclusiveClass === zone.exclusiveClass) {
                        v.stop();
                    }
                }
            }

            const voice = this.voiceAllocator.acquireVoice();
            if (!voice) continue;

            voice.note = note;
            voice.velocity = velocity;
            (voice as any)._exclusiveClass = zone.exclusiveClass;
            (voice as any)._order = Date.now();

            const sampleRate = this.presetManager.getSampleRate();
            const centsPerSemitone = 100;
            const noteDiff = note - zone.rootKey + zone.coarseTune * 1 + zone.fineTune / centsPerSemitone;
            const playbackRate = Math.pow(2, noteDiff / 12);

            const key = `sf2-${zone.sampleIndex}-${sampleRate}`;
            const sampleLen = header.end - header.start;
            if (sampleLen <= 0) continue;

            const sampleSlice = new Float32Array(sampleData.buffer, header.start * 4, sampleLen);
            const audioBuffer = this.sampleManager.getOrCreateBuffer(key, sampleSlice, sampleRate);

            const sampleOffsetSamples = zone.loopStart - header.start;
            const sampleOffsetTime = Math.max(0, sampleOffsetSamples / sampleRate);

            const attGain = Math.pow(10, -zone.attenuation / 20);
            const gain = attGain;

            const loopStartTime = zone.loopStart > 0 ? (zone.loopStart - header.start) / sampleRate : 0;
            const loopEndTime = zone.loopEnd > 0 ? (zone.loopEnd - header.start) / sampleRate : 0;
            const hasLoop = zone.sampleModes > 1 && loopEndTime > loopStartTime;

            voice.start({
                destination: this.destination,
                sampleData: audioBuffer,
                playbackRate: playbackRate * (sampleRate / audioBuffer.sampleRate),
                gain,
                pan: zone.pan,
                adsr: zone.adsr,
                loopStart: hasLoop ? loopStartTime : undefined,
                loopEnd: hasLoop ? loopEndTime : undefined,
                sampleOffset: sampleOffsetTime,
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
