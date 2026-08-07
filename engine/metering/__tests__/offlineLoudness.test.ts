/**
 * Offline loudness measurement — the reading a mastering pass acts on.
 *
 * Checked against the properties BS.1770 guarantees rather than against
 * hand-computed LUFS figures: level ordering, gating behaviour, the
 * true-peak ≥ sample-peak relationship, and target compliance.
 */

import {
    analyseLoudness,
    gainToMatchRms,
    LOUDNESS_TARGETS,
} from '../offlineLoudness';

const SR = 48000;

/** A sine at `amp`, `seconds` long. */
function sine(amp: number, seconds: number, hz = 1000, sampleRate = SR): Float32Array {
    const out = new Float32Array(Math.round(seconds * sampleRate));
    for (let i = 0; i < out.length; i++) {
        out[i] = amp * Math.sin(2 * Math.PI * hz * (i / sampleRate));
    }
    return out;
}

const silence = (seconds: number) => new Float32Array(Math.round(seconds * SR));

describe('analyseLoudness', () => {
    it('reports a finite reading for a steady tone', () => {
        const tone = sine(0.5, 4);
        const { integratedLufs } = analyseLoudness([tone, tone], SR);

        expect(Number.isFinite(integratedLufs)).toBe(true);
        expect(integratedLufs).toBeLessThan(0);
        expect(integratedLufs).toBeGreaterThan(-30);
    });

    it('tracks level: a quieter programme reads lower', () => {
        const loud = sine(0.5, 4);
        const quiet = sine(0.05, 4);

        const a = analyseLoudness([loud, loud], SR).integratedLufs;
        const b = analyseLoudness([quiet, quiet], SR).integratedLufs;

        expect(b).toBeLessThan(a);
        // 20 dB down in amplitude is ~20 LU down.
        expect(a - b).toBeCloseTo(20, 0);
    });

    it('is scale-correct: halving amplitude drops it ~6 LU', () => {
        const a = analyseLoudness([sine(0.5, 4), sine(0.5, 4)], SR).integratedLufs;
        const b = analyseLoudness([sine(0.25, 4), sine(0.25, 4)], SR).integratedLufs;
        expect(a - b).toBeCloseTo(6, 0);
    });

    it('gates out silence rather than letting it drag the reading down', () => {
        const tone = sine(0.5, 4);
        const padded = new Float32Array(tone.length + silence(4).length);
        padded.set(tone, 0);

        const solid = analyseLoudness([tone, tone], SR).integratedLufs;
        const withSilence = analyseLoudness([padded, padded], SR).integratedLufs;

        // Without gating, four seconds of digital black would pull this far down.
        expect(Math.abs(withSilence - solid)).toBeLessThan(1.5);
    });

    it('returns -Infinity for digital silence', () => {
        const quiet = silence(2);
        const { integratedLufs, truePeakDb } = analyseLoudness([quiet, quiet], SR);
        expect(integratedLufs).toBe(-Infinity);
        expect(truePeakDb).toBe(-Infinity);
    });

    it('handles an empty or malformed buffer without throwing', () => {
        expect(analyseLoudness([], SR).integratedLufs).toBe(-Infinity);
        expect(analyseLoudness([new Float32Array(0)], SR).integratedLufs).toBe(-Infinity);
        expect(analyseLoudness([sine(0.5, 1)], 0).integratedLufs).toBe(-Infinity);
    });

    it('measures a buffer shorter than one 400 ms block', () => {
        const short = sine(0.5, 0.1);
        expect(Number.isFinite(analyseLoudness([short, short], SR).integratedLufs)).toBe(true);
    });

    it('reports true peak at or above sample peak', () => {
        // A sine off the sample grid overshoots between samples.
        const tone = sine(0.9, 1, 7777);
        const { truePeakDb, samplePeakDb } = analyseLoudness([tone, tone], SR);

        expect(truePeakDb).toBeGreaterThanOrEqual(samplePeakDb - 1e-6);
        expect(samplePeakDb).toBeLessThan(0);
    });

    it('detects an inter-sample peak above every sample value', () => {
        // A half-Nyquist sine landing between samples: each sample sits below
        // full scale, but the reconstructed waveform overshoots between them.
        // Linear interpolation cannot see this — a straight line between two
        // points never rises above the higher one — so it reads the sample
        // peak and calls a clipping master compliant.
        const n = 2048;
        const data = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            data[i] = 0.98 * Math.sin(2 * Math.PI * (SR / 4) * (i / SR) + Math.PI / 4);
        }

        const { truePeakDb, samplePeakDb } = analyseLoudness([data, data], SR);
        expect(truePeakDb).toBeGreaterThan(samplePeakDb);
    });

    it('does not inflate the peak of a signal with no inter-sample content', () => {
        // A steady level with faded edges. The fades matter: a hard-edged block
        // is a step, and a step genuinely *does* overshoot when reconstructed,
        // so measuring one would be testing Gibbs ringing rather than the
        // filter's steady-state accuracy.
        const n = 4096, fade = 256;
        const flat = new Float32Array(n).fill(0.5);
        for (let i = 0; i < fade; i++) {
            const w = i / fade;
            flat[i] *= w;
            flat[n - 1 - i] *= w;
        }

        const { truePeakDb, samplePeakDb } = analyseLoudness([flat, flat], SR);

        expect(truePeakDb).toBeGreaterThanOrEqual(samplePeakDb - 1e-6);
        expect(truePeakDb - samplePeakDb).toBeLessThan(0.5);
    });

    it('reports a loudness range of ~0 for an unvarying programme', () => {
        const tone = sine(0.5, 6);
        expect(analyseLoudness([tone, tone], SR).loudnessRangeLu).toBeLessThan(1);
    });

    it('reports a wider loudness range when the level moves', () => {
        const quiet = sine(0.05, 4);
        const loud = sine(0.5, 4);
        const varying = new Float32Array(quiet.length + loud.length);
        varying.set(quiet, 0);
        varying.set(loud, quiet.length);

        expect(analyseLoudness([varying, varying], SR).loudnessRangeLu)
            .toBeGreaterThan(3);
    });

    describe('compliance', () => {
        it('passes a programme sitting on target with headroom', () => {
            const tone = sine(0.5, 4);
            const analysis = analyseLoudness([tone, tone], SR);

            expect(analysis.compliesWith({
                lufsTarget: analysis.integratedLufs,
                truePeakCeiling: -1,
            })).toBe(true);
        });

        it('fails a programme over the true-peak ceiling', () => {
            const hot = new Float32Array(SR).fill(0.999);
            const analysis = analyseLoudness([hot, hot], SR);

            expect(analysis.compliesWith({ lufsTarget: -14, truePeakCeiling: -1 }))
                .toBe(false);
        });

        it('fails a programme far from the loudness target', () => {
            const quiet = sine(0.01, 4);
            const analysis = analyseLoudness([quiet, quiet], SR);

            expect(analysis.compliesWith(LOUDNESS_TARGETS.spotify)).toBe(false);
        });

        it('honours an explicit tolerance', () => {
            const tone = sine(0.5, 4);
            const analysis = analyseLoudness([tone, tone], SR);
            const target = analysis.integratedLufs - 2;

            expect(analysis.compliesWith({ lufsTarget: target, truePeakCeiling: -1 }))
                .toBe(false);
            expect(analysis.compliesWith({ lufsTarget: target, truePeakCeiling: -1, tolerance: 3 }))
                .toBe(true);
        });
    });
});

describe('gainToMatchRms', () => {
    it('attenuates a signal that is too hot', () => {
        const gain = gainToMatchRms(new Float32Array(4800).fill(0.5), -18);
        // 0.5 DC is -6 dBFS RMS, so matching -18 needs -12 dB.
        expect(20 * Math.log10(gain)).toBeCloseTo(-12, 1);
    });

    it('boosts a signal that is too quiet', () => {
        const gain = gainToMatchRms(new Float32Array(4800).fill(0.05), -18);
        expect(gain).toBeGreaterThan(1);
    });

    it('is unity when the signal already sits on target', () => {
        const target = -18;
        const level = Math.pow(10, target / 20);
        expect(gainToMatchRms(new Float32Array(4800).fill(level), target)).toBeCloseTo(1, 5);
    });

    it('leaves silence and empty input alone rather than dividing by zero', () => {
        expect(gainToMatchRms(new Float32Array(1000), -18)).toBe(1);
        expect(gainToMatchRms(new Float32Array(0), -18)).toBe(1);
    });
});
