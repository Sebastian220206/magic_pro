/**
 * Vocal editing DSP — Session 5's second half.
 *
 * Tested on synthesised signals with known properties: a sine of known
 * frequency, a deliberately flat note, two takes with a known offset, a passage
 * with noise where a breath would be, and a waveform with an injected click.
 */

import {
    detectPitch, analysePitchCurve, applyPitchCurve, tuneVocal,
    snapToScale, hzToMidi, midiToHz, SCALES,
    detectTransients, alignmentOffset, shiftSamples,
    detectBreaths, attenuateBreaths, detectClicks, repairClicks, cleanVocal,
} from '../vocalEditing';

const SR = 48000;

/** A sawtooth — harmonically rich, like a voice, unlike a pure sine. */
function saw(hz: number, seconds: number, amp = 0.5, sampleRate = SR): Float32Array {
    const out = new Float32Array(Math.round(seconds * sampleRate));
    for (let i = 0; i < out.length; i++) {
        const phase = (i * hz / sampleRate) % 1;
        out[i] = amp * (2 * phase - 1);
    }
    return out;
}

function noise(seconds: number, amp = 0.01, sampleRate = SR): Float32Array {
    const out = new Float32Array(Math.round(seconds * sampleRate));
    let seed = 12345;
    for (let i = 0; i < out.length; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        out[i] = amp * ((seed / 0x3fffffff) - 1);
    }
    return out;
}

const concat = (...parts: Float32Array[]) => {
    const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) { out.set(p, at); at += p.length; }
    return out;
};

const rms = (data: Float32Array, from = 0, to = data.length) => {
    let sum = 0;
    for (let i = from; i < to; i++) sum += data[i] * data[i];
    return Math.sqrt(sum / Math.max(1, to - from));
};

// ── Pitch detection ────────────────────────────────────────────────────────

describe('detectPitch', () => {
    it('finds the fundamental of a known tone', () => {
        const { hz, confidence } = detectPitch(saw(220, 0.05), SR);
        expect(hz).toBeCloseTo(220, 0);
        expect(confidence).toBeGreaterThan(0.5);
    });

    it('does not octave-error on a harmonically rich signal', () => {
        // Autocorrelation alone often reports 110 or 440 here.
        const { hz } = detectPitch(saw(220, 0.05), SR);
        expect(hz).toBeGreaterThan(200);
        expect(hz).toBeLessThan(240);
    });

    it('tracks across the vocal range', () => {
        for (const target of [98, 147, 330, 660]) {
            expect(detectPitch(saw(target, 0.06), SR).hz).toBeCloseTo(target, -1);
        }
    });

    it('calls noise unvoiced rather than inventing a pitch', () => {
        const { hz, confidence } = detectPitch(noise(0.05, 0.3), SR);
        expect(hz === 0 || confidence < 0.5).toBe(true);
    });

    it('reports nothing for silence or a frame too short to measure', () => {
        expect(detectPitch(new Float32Array(2048), SR).hz).toBe(0);
        expect(detectPitch(new Float32Array(4), SR).hz).toBe(0);
    });
});

// ── Scale snapping ─────────────────────────────────────────────────────────

describe('snapToScale', () => {
    it('pulls a flat note up to the nearest scale degree', () => {
        // A3 = 57. A quarter-tone flat should snap back to 57.
        expect(snapToScale(56.6, 9, SCALES.minor)).toBe(57);
    });

    it('keeps a note that is already in the scale', () => {
        expect(snapToScale(60, 0, SCALES.major)).toBe(60);
    });

    it('avoids notes outside the scale', () => {
        // C major has no C#; 61 should resolve to 60 or 62, never 61.
        expect([60, 62]).toContain(snapToScale(61.2, 0, SCALES.major));
    });

    it('snaps correctly across an octave boundary', () => {
        // Just below C5 in C major should go to C5 (72), not down to B4.
        expect(snapToScale(71.8, 0, SCALES.major)).toBe(72);
    });

    it('is a no-op for an empty scale', () => {
        expect(snapToScale(60.4, 0, [])).toBe(60.4);
    });

    it('round-trips through midi and hz', () => {
        expect(hzToMidi(440)).toBeCloseTo(69, 6);
        expect(midiToHz(69)).toBeCloseTo(440, 6);
        expect(midiToHz(hzToMidi(311.13))).toBeCloseTo(311.13, 4);
    });
});

// ── Pitch curve ────────────────────────────────────────────────────────────

describe('analysePitchCurve', () => {
    const flatA = () => saw(214, 0.5);   // ~55 cents flat of A3 (220)

    it('measures the sung pitch', () => {
        const curve = analysePitchCurve(flatA(), { sampleRate: SR, tonic: 9, scale: SCALES.minor });
        const voiced = curve.filter(p => p.detectedHz > 0);

        expect(voiced.length).toBeGreaterThan(10);
        expect(voiced[voiced.length - 1].detectedHz).toBeCloseTo(214, -1);
    });

    it('corrects a flat note toward the scale', () => {
        const curve = analysePitchCurve(flatA(), { sampleRate: SR, tonic: 9, scale: SCALES.minor });
        const settled = curve.filter(p => p.detectedHz > 0).at(-1)!;

        // Flat, so the correction pushes up.
        expect(settled.correctionSemitones).toBeGreaterThan(0);
        expect(settled.targetHz).toBeGreaterThan(settled.detectedHz);
    });

    it('leaves the note alone at zero strength', () => {
        const curve = analysePitchCurve(flatA(), {
            sampleRate: SR, tonic: 9, scale: SCALES.minor, strength: 0,
        });
        expect(curve.every(p => Math.abs(p.correctionSemitones) < 1e-9)).toBe(true);
    });

    it('corrects harder at full strength than at partial', () => {
        const opts = { sampleRate: SR, tonic: 9, scale: SCALES.minor, retuneSeconds: 0 };
        const soft = analysePitchCurve(flatA(), { ...opts, strength: 0.5 }).filter(p => p.detectedHz > 0).at(-1)!;
        const hard = analysePitchCurve(flatA(), { ...opts, strength: 1 }).filter(p => p.detectedHz > 0).at(-1)!;

        expect(Math.abs(hard.correctionSemitones)).toBeGreaterThan(Math.abs(soft.correctionSemitones));
    });

    it('ramps in the correction so a scoop survives', () => {
        // With a retune time, the first voiced frames are barely corrected and
        // later ones fully — which is what keeps a slide into a note intact.
        const curve = analysePitchCurve(flatA(), {
            sampleRate: SR, tonic: 9, scale: SCALES.minor, retuneSeconds: 0.15,
        }).filter(p => p.detectedHz > 0);

        const first = Math.abs(curve[0].correctionSemitones);
        const last = Math.abs(curve.at(-1)!.correctionSemitones);
        expect(last).toBeGreaterThan(first);
    });

    it('leaves unvoiced frames uncorrected', () => {
        const curve = analysePitchCurve(noise(0.3, 0.2), { sampleRate: SR });
        expect(curve.every(p => p.correctionSemitones === 0 || p.detectedHz > 0)).toBe(true);
    });
});

describe('applyPitchCurve', () => {
    it('produces audio of the same length', () => {
        const input = saw(214, 0.4);
        const curve = analysePitchCurve(input, { sampleRate: SR, tonic: 9, scale: SCALES.minor });
        expect(applyPitchCurve(input, curve, SR).length).toBe(input.length);
    });

    it('moves the pitch toward the target', () => {
        const input = saw(214, 0.6);
        const tuned = tuneVocal(input, {
            sampleRate: SR, tonic: 9, scale: SCALES.minor, strength: 1, retuneSeconds: 0,
        });

        // Measure a settled frame away from the edges.
        const at = Math.round(SR * 0.35);
        const before = detectPitch(input.subarray(at, at + 2048), SR).hz;
        const after = detectPitch(tuned.subarray(at, at + 2048), SR).hz;

        expect(before).toBeCloseTo(214, -1);
        expect(after).toBeGreaterThan(before);
    });

    it('never clips', () => {
        const tuned = tuneVocal(saw(214, 0.3, 0.9), {
            sampleRate: SR, tonic: 9, scale: SCALES.minor, strength: 1,
        });
        expect(Math.max(...Array.from(tuned, Math.abs))).toBeLessThanOrEqual(1 + 1e-6);
    });

    it('passes audio through when there is no correction to make', () => {
        const input = saw(220, 0.2);
        const out = applyPitchCurve(input, [], SR);
        expect(out.length).toBe(input.length);
        expect(rms(out)).toBeGreaterThan(0);
    });
});

// ── Transients and alignment ───────────────────────────────────────────────

describe('detectTransients', () => {
    it('finds onsets after silence', () => {
        const signal = concat(
            new Float32Array(SR * 0.2), saw(220, 0.2),
            new Float32Array(SR * 0.2), saw(330, 0.2),
        );
        const onsets = detectTransients(signal, SR);

        expect(onsets.length).toBeGreaterThanOrEqual(2);
        expect(onsets[0] / SR).toBeCloseTo(0.2, 1);
    });

    it('finds nothing in silence', () => {
        expect(detectTransients(new Float32Array(SR), SR)).toEqual([]);
    });
});

describe('alignmentOffset', () => {
    it('measures a known lag between two takes', () => {
        const lead = concat(new Float32Array(SR * 0.1), saw(220, 0.3), new Float32Array(SR * 0.1));
        const lateBy = Math.round(0.012 * SR);
        const double = shiftSamples(lead, lateBy);

        const offset = alignmentOffset(lead, double, SR);
        // The double is late, so it must move earlier: a negative correction.
        expect(offset).toBeLessThan(0);
        expect(Math.abs(Math.abs(offset) - lateBy)).toBeLessThan(0.005 * SR);
    });

    it('reports ~0 for takes that already line up', () => {
        const lead = concat(new Float32Array(SR * 0.1), saw(220, 0.3));
        expect(Math.abs(alignmentOffset(lead, lead, SR))).toBeLessThan(0.004 * SR);
    });

    it('lines a shifted take back up', () => {
        const lead = concat(new Float32Array(SR * 0.1), saw(220, 0.3), new Float32Array(SR * 0.1));
        const double = shiftSamples(lead, Math.round(0.01 * SR));

        const corrected = shiftSamples(double, alignmentOffset(lead, double, SR));
        const residual = alignmentOffset(lead, corrected, SR);
        expect(Math.abs(residual)).toBeLessThan(0.005 * SR);
    });

    it('handles empty input without throwing', () => {
        expect(alignmentOffset(new Float32Array(0), new Float32Array(0), SR)).toBe(0);
    });
});

// ── Breaths and clicks ─────────────────────────────────────────────────────

describe('detectBreaths', () => {
    it('finds a quiet noisy stretch between phrases', () => {
        const signal = concat(saw(220, 0.4, 0.5), noise(0.25, 0.004), saw(220, 0.4, 0.5));
        const breaths = detectBreaths(signal, SR);

        expect(breaths.length).toBeGreaterThanOrEqual(1);
        const found = breaths[0];
        expect(found.start / SR).toBeGreaterThan(0.3);
        expect(found.end / SR).toBeLessThan(0.75);
    });

    it('does not treat a sung note as a breath', () => {
        // Quiet but periodic — a soft note, not breath.
        expect(detectBreaths(saw(220, 0.6, 0.006), SR)).toEqual([]);
    });

    it('finds nothing in digital silence', () => {
        expect(detectBreaths(new Float32Array(SR), SR)).toEqual([]);
    });
});

describe('attenuateBreaths', () => {
    it('ducks the breath and leaves the singing alone', () => {
        const signal = concat(saw(220, 0.4, 0.5), noise(0.25, 0.004), saw(220, 0.4, 0.5));
        const breaths = detectBreaths(signal, SR);
        const cleaned = attenuateBreaths(signal, breaths, -12, SR);

        const region = breaths[0];
        const beforeRms = rms(signal, region.start, region.end);
        const afterRms = rms(cleaned, region.start, region.end);
        expect(afterRms).toBeLessThan(beforeRms * 0.6);

        // The sung passage is untouched.
        expect(rms(cleaned, 0, Math.round(SR * 0.3)))
            .toBeCloseTo(rms(signal, 0, Math.round(SR * 0.3)), 4);
    });

    it('does not gate to silence — a hole sounds worse than a breath', () => {
        const signal = concat(saw(220, 0.3, 0.5), noise(0.25, 0.004), saw(220, 0.3, 0.5));
        const breaths = detectBreaths(signal, SR);
        const cleaned = attenuateBreaths(signal, breaths, -12, SR);

        expect(rms(cleaned, breaths[0].start, breaths[0].end)).toBeGreaterThan(0);
    });
});

describe('clicks', () => {
    it('finds an injected discontinuity', () => {
        const signal = saw(220, 0.3, 0.3);
        const at = Math.round(signal.length / 2);
        signal[at] = 0.95;

        expect(detectClicks(signal).some(c => Math.abs(c - at) <= 2)).toBe(true);
    });

    it('finds nothing in a clean waveform', () => {
        // A sine has no discontinuities; a saw's own wrap is periodic and
        // therefore not an outlier against the mean.
        const clean = new Float32Array(SR * 0.2);
        for (let i = 0; i < clean.length; i++) clean[i] = 0.5 * Math.sin(2 * Math.PI * 220 * i / SR);
        expect(detectClicks(clean)).toEqual([]);
    });

    it('repairs a click by bridging across it', () => {
        const signal = new Float32Array(SR * 0.2);
        for (let i = 0; i < signal.length; i++) signal[i] = 0.5 * Math.sin(2 * Math.PI * 220 * i / SR);

        const at = Math.round(signal.length / 2);
        const clicked = Float32Array.from(signal);
        clicked[at] = 0.95;

        const repaired = repairClicks(clicked, detectClicks(clicked));
        expect(Math.abs(repaired[at])).toBeLessThan(0.95);
        expect(Math.abs(repaired[at] - signal[at])).toBeLessThan(0.2);
    });

    it('handles input too short to analyse', () => {
        expect(detectClicks(new Float32Array(3))).toEqual([]);
    });
});

describe('cleanVocal', () => {
    it('de-breaths and de-clicks in one pass, preserving length', () => {
        const signal = concat(saw(220, 0.3, 0.5), noise(0.25, 0.004), saw(220, 0.3, 0.5));
        signal[Math.round(signal.length * 0.15)] = 0.99;

        const cleaned = cleanVocal(signal, SR);

        expect(cleaned.length).toBe(signal.length);
        // Singing survives.
        expect(rms(cleaned, 0, Math.round(SR * 0.25))).toBeGreaterThan(0.1);
        // The breath is quieter than it was.
        const mid = [Math.round(SR * 0.35), Math.round(SR * 0.5)];
        expect(rms(cleaned, mid[0], mid[1])).toBeLessThan(rms(signal, mid[0], mid[1]));
    });
});
