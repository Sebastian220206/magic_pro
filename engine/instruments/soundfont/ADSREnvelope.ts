export interface ADSREnvelopeParams {
    attack: number;
    /** Time at full level between attack and decay (SF2 `holdVolEnv`). */
    hold: number;
    decay: number;
    /** Level held while the key is down, 0…1 linear gain. */
    sustain: number;
    release: number;
}

export function createDefaultADSR(): ADSREnvelopeParams {
    return { attack: 0.01, hold: 0, decay: 0.1, sustain: 0.8, release: 0.3 };
}


/**
 * Build a volume envelope from a zone's SF2 generators.
 *
 * Two conversions are easy to get backwards:
 *  - Times are **timecents**: `seconds = 2^(tc/1200)`. 0 timecents is one
 *    second, not zero — the "instant" value is the −12000 default (~1 ms).
 *  - `sustainVolEnv` (37) is **attenuation in centibels below peak**, so 0
 *    means full level and 1000 means −100 dB. Reading it as a 0…1 fraction
 *    (`value / 1000`) inverts it: full-sustain zones came out silent and
 *    fully-attenuated ones came out held wide open.
 */
export function adsrFromSF2Generators(generators: Map<number, number>): ADSREnvelopeParams {
    const timecentsToSeconds = (tc: number): number => Math.pow(2, tc / 1200);

    const attack = timecentsToSeconds(generators.get(34) ?? -12000);
    const hold = timecentsToSeconds(generators.get(35) ?? -12000);
    const decay = timecentsToSeconds(generators.get(36) ?? -12000);
    const release = timecentsToSeconds(generators.get(38) ?? -12000);

    const sustainCb = generators.get(37) ?? 0;
    const sustain = sustainCb <= 0 ? 1
        : sustainCb >= 1000 ? 0
            : Math.pow(10, -sustainCb / 200);

    return {
        attack: Math.max(0.001, Math.min(attack, 60)),
        hold: Math.max(0, Math.min(hold, 60)),
        decay: Math.max(0.001, Math.min(decay, 60)),
        sustain: Math.max(0, Math.min(sustain, 1)),
        release: Math.max(0.001, Math.min(release, 60)),
    };
}

/**
 * An SF2 volume envelope spans 100 dB, and its decay and release stages are
 * **linear in decibels** — `decayVolEnv` is the time to fall 100 dB, not the
 * time to fall to silence in a straight amplitude line (SF2 2.04 §8.1.2).
 *
 * The difference is not subtle. GeneralUser GS gives its Grand Piano a 18.6 s
 * decay to a −100 dB sustain, which is a natural piano tail in dB terms: −10 dB
 * after 1.9 s, inaudible by 11 s. Ramped linearly in amplitude, the same
 * envelope is still at 95% after a second and half volume after nine — every
 * note smearing into the next, which is exactly what "too much reverb" sounds
 * like.
 */
const ENVELOPE_DB = 100;

/** Linear gain at −100 dB. Exponential ramps cannot target 0, so they aim here. */
const SILENCE = 1e-5;

/** How far below peak a gain ratio sits, in dB, capped at the envelope span. */
function attenuationDb(ratio: number): number {
    if (ratio <= SILENCE) return ENVELOPE_DB;
    if (ratio >= 1) return 0;
    return Math.min(ENVELOPE_DB, -20 * Math.log10(ratio));
}

/**
 * How long the decay stage actually runs: it falls at `ENVELOPE_DB / decay`
 * dB per second and stops on reaching the sustain level, so a shallow sustain
 * is reached far sooner than the nominal decay time.
 */
export function decayDuration(params: ADSREnvelopeParams): number {
    return params.decay * (attenuationDb(params.sustain) / ENVELOPE_DB);
}

/**
 * Schedule attack → hold → decay → sustain on `gainNode`, starting at the
 * absolute AudioContext time `startTime`.
 *
 * Deliberately schedules no release: the note has no end until something calls
 * `Voice.release`. Pre-scheduling one at note-on (as this module used to, at
 * the sample buffer's duration) cut held notes off after one buffer length and
 * left looped instruments unable to sustain at all.
 */
export function scheduleAttack(
    gainNode: GainNode,
    params: ADSREnvelopeParams,
    peak: number,
    startTime: number,
): void {
    const gain = gainNode.gain;
    gain.cancelScheduledValues(startTime);
    gain.setValueAtTime(0, startTime);

    if (peak <= 0) return;

    // Attack is linear in amplitude; only decay and release are dB-linear.
    const attackEnd = startTime + params.attack;
    gain.linearRampToValueAtTime(peak, attackEnd);

    const holdEnd = attackEnd + params.hold;
    if (params.hold > 0) gain.setValueAtTime(peak, holdEnd);

    if (params.sustain >= 1) return;

    const decayEnd = holdEnd + decayDuration(params);
    const target = params.sustain > 0 ? peak * params.sustain : peak * SILENCE;
    gain.exponentialRampToValueAtTime(target, decayEnd);
    if (params.sustain <= 0) gain.setValueAtTime(0, decayEnd);
}

/**
 * The level `scheduleAttack` will have reached at absolute time `at`.
 *
 * Computed rather than read from `gain.value`, because a release can be
 * scheduled ahead of time — `gain.value` would report the level *now*, not the
 * level at `at`, and the release would start from the wrong place.
 */
export function envelopeLevelAt(
    params: ADSREnvelopeParams,
    peak: number,
    startTime: number,
    at: number,
): number {
    const t = at - startTime;
    if (t <= 0 || peak <= 0) return 0;
    if (t < params.attack) return peak * (t / params.attack);

    const holdEnd = params.attack + params.hold;
    if (t <= holdEnd) return peak;

    const sustainLevel = peak * params.sustain;
    const elapsed = t - holdEnd;
    if (elapsed >= decayDuration(params)) return sustainLevel;

    const fallen = ENVELOPE_DB * (elapsed / params.decay);
    return peak * Math.pow(10, -fallen / 20);
}

/** The level a release ramp has reached `elapsed` seconds after it started. */
export function releaseLevelAfter(
    params: ADSREnvelopeParams,
    startLevel: number,
    elapsed: number,
): number {
    if (elapsed <= 0) return startLevel;
    const fallen = ENVELOPE_DB * (elapsed / params.release);
    if (fallen >= ENVELOPE_DB) return 0;
    return startLevel * Math.pow(10, -fallen / 20);
}

/**
 * Ramp `gainNode` down to silence starting at the absolute time `releaseTime`.
 *
 * The fall is dB-linear at `ENVELOPE_DB / release` dB per second, so a voice
 * already part-way down its decay finishes proportionally sooner than the
 * nominal release time. Returns the absolute time the voice is silent.
 */
export function scheduleRelease(
    gainNode: GainNode,
    params: ADSREnvelopeParams,
    peak: number,
    startTime: number,
    releaseTime: number,
    currentTime: number,
): number {
    const at = Math.max(releaseTime, currentTime);
    const level = envelopeLevelAt(params, peak, startTime, at);
    const gain = gainNode.gain;

    gain.cancelScheduledValues(at);

    if (peak <= 0 || level <= peak * SILENCE) {
        gain.setValueAtTime(0, at);
        return at;
    }

    const remainingDb = ENVELOPE_DB - attenuationDb(level / peak);
    const end = at + params.release * (remainingDb / ENVELOPE_DB);

    gain.setValueAtTime(level, at);
    gain.exponentialRampToValueAtTime(peak * SILENCE, end);
    gain.setValueAtTime(0, end);
    return end;
}
