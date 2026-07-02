export interface ADSREnvelopeParams {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
}

export function createDefaultADSR(): ADSREnvelopeParams {
    return { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.3 };
}

export function adsrFromSF2Generators(generators: Map<number, number>): ADSREnvelopeParams {
    const timecentsToSeconds = (tc: number): number => {
        if (tc === 0) return 0;
        return Math.pow(2, tc / 1200);
    };

    const attack = timecentsToSeconds(generators.get(34) ?? -12000);
    const decay = timecentsToSeconds(generators.get(36) ?? -12000);
    const sustainGen = generators.get(37);
    const sustain = sustainGen !== undefined ? sustainGen / 1000 : 0.8;
    const release = timecentsToSeconds(generators.get(38) ?? -12000);

    return {
        attack: Math.max(0.001, Math.min(attack, 60)),
        decay: Math.max(0.001, Math.min(decay, 60)),
        sustain: Math.max(0, Math.min(sustain, 1)),
        release: Math.max(0.001, Math.min(release, 60)),
    };
}

export function scheduleADSR(
    gainNode: GainNode,
    params: ADSREnvelopeParams,
    noteOnTime: number,
    noteOffTime: number,
    audioCtx: AudioContext | OfflineAudioContext,
    totalDuration: number
) {
    const now = audioCtx.currentTime;

    const absNoteOn = now + Math.max(0, noteOnTime);
    const absNoteOff = noteOffTime > 0 ? now + noteOffTime : now + totalDuration;
    const relOff = absNoteOff - absNoteOn;

    gainNode.gain.cancelScheduledValues(absNoteOn);
    gainNode.gain.setValueAtTime(0, absNoteOn);

    if (params.attack > 0) {
        gainNode.gain.linearRampToValueAtTime(1, absNoteOn + params.attack);
    } else {
        gainNode.gain.setValueAtTime(1, absNoteOn);
    }

    const releaseStart = absNoteOn + params.attack + params.decay;
    const sustainEnd = Math.max(releaseStart, absNoteOff);

    if (params.decay > 0) {
        gainNode.gain.linearRampToValueAtTime(params.sustain, releaseStart);
    }
    gainNode.gain.setValueAtTime(params.sustain, sustainEnd);

    if (params.release > 0) {
        gainNode.gain.linearRampToValueAtTime(0, sustainEnd + params.release);
    } else {
        gainNode.gain.setValueAtTime(0, sustainEnd);
    }

    return sustainEnd + params.release;
}
