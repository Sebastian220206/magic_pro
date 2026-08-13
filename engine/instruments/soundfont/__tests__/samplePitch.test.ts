/**
 * Pins per-sample playback rate.
 *
 * The bug: `SamplePlayer` took the rate from `parsedData.sampleRate`, which the
 * parser set to `sampleHeaders[0].sampleRate` — the first sample in the whole
 * font. SF2 stores a rate per sample header, and fonts mix them freely:
 * GeneralUser GS contains 90 distinct rates, its first sample is a 44.1 kHz
 * accordion, and its Grand Piano is recorded at 31 kHz. Every piano sample was
 * therefore played as though it were 44.1 kHz — 1200·log2(44100/31000) ≈ 610
 * cents sharp.
 *
 * It surfaced as "the fourth octave sounds wrong" rather than "the piano is
 * transposed" because one zone, C#4–E4, genuinely is 44.1 kHz. That zone alone
 * played in tune, so octave 4 was the one octave whose internal intervals were
 * broken; everywhere else the error was constant and merely sounded like a
 * transposition.
 */

import { SamplePlayer } from '../SamplePlayer';
import { GenOper, Sf2SampleHeader } from '../SoundFontParser';

const CENTS_PER_OCTAVE = 1200;

function header(over: Partial<Sf2SampleHeader>): Sf2SampleHeader {
    return {
        name: 'sample', start: 0, end: 1000, startLoop: 0, endLoop: 0,
        sampleRate: 44100, originalPitch: 60, pitchCorrection: 0,
        sampleLink: 0, sampleType: 1, ...over,
    };
}

/** One zone per sample, each covering the key equal to its root. */
function harness(headers: Sf2SampleHeader[], fontRate: number) {
    const created: { rate: number }[] = [];
    const started: any[] = [];

    const sampleManager = {
        getOrCreateBuffer: (_k: string, data: Float32Array, rate: number) => {
            created.push({ rate });
            return { sampleRate: rate, length: data.length } as unknown as AudioBuffer;
        },
    };
    const presetManager = {
        getPreset: () => ({
            zones: headers.map((h, i) => ({
                generators: [
                    { genOper: GenOper.sampleID, genValue: i },
                    {
                        genOper: GenOper.keyRange,
                        genValue: h.originalPitch | (h.originalPitch << 8),
                    },
                ],
            })),
        }),
        getSampleHeaders: () => headers,
        getSampleRate: () => fontRate,
        getSampleData: () => new Float32Array(2000),
    };
    const voiceAllocator = {
        getVoices: () => [],
        acquireVoice: () => ({
            note: 0, velocity: 0,
            start: (opts: any) => started.push(opts),
        }),
        releaseNote: () => { },
    };

    const player = new SamplePlayer(
        voiceAllocator as any, sampleManager as any, presetManager as any,
        { connect: () => { } } as any,
    );
    player.loadPreset(0);
    return { player, created, started };
}

describe('SamplePlayer sample rate', () => {
    it('creates each buffer at its own header rate, not the font-wide one', () => {
        const headers = [
            header({ name: 'Grand Piano-C4', originalPitch: 60, sampleRate: 31000 }),
            header({ name: 'Grand Piano-D#4', originalPitch: 63, sampleRate: 44100 }),
            header({ name: 'Grand Piano-G4', originalPitch: 67, sampleRate: 32014 }),
        ];
        // The font-wide rate is a 44.1 kHz accordion, as in GeneralUser GS.
        const { player, created } = harness(headers, 44100);

        player.noteOn(60, 100, 0);
        player.noteOn(63, 100, 0);
        player.noteOn(67, 100, 0);

        expect(created.map(c => c.rate)).toEqual([31000, 44100, 32014]);
    });

    it('plays a sample at its recorded pitch when note equals root key', () => {
        const headers = [header({ originalPitch: 60, sampleRate: 31000 })];
        const { player, started } = harness(headers, 44100);

        player.noteOn(60, 100, 0);

        // A 31 kHz sample in a 31 kHz buffer plays at rate 1 — its own pitch.
        // Under the bug this was 44100/31000 = 1.4226, i.e. +610 cents.
        expect(started).toHaveLength(1);
        expect(started[0].playbackRate).toBeCloseTo(1, 6);
    });

    it('keeps a mixed-rate zone map in tune with itself across a boundary', () => {
        // The three zones straddling octave 4 in GeneralUser GS's Grand Piano.
        const headers = [
            header({ name: 'C4', originalPitch: 60, sampleRate: 31000 }),
            header({ name: 'D#4', originalPitch: 63, sampleRate: 44100 }),
            header({ name: 'G4', originalPitch: 67, sampleRate: 32014 }),
        ];
        const { player, started } = harness(headers, 44100);

        player.noteOn(60, 100, 0);
        player.noteOn(63, 100, 0);
        player.noteOn(67, 100, 0);

        // Each zone is played at its root, so every sounding pitch must be its
        // own root — no zone may drift relative to its neighbours.
        const cents = started.map(s => CENTS_PER_OCTAVE * Math.log2(s.playbackRate));
        for (const c of cents) expect(Math.abs(c)).toBeLessThan(1);

        // Specifically: the interval between adjacent zones is what a listener
        // hears as "out of tune". Under the bug C4->D#4 was 610 cents wrong.
        expect(Math.abs(cents[1] - cents[0])).toBeLessThan(1);
        expect(Math.abs(cents[2] - cents[1])).toBeLessThan(1);
    });

    it('falls back to the font rate when a header declares none', () => {
        const headers = [header({ originalPitch: 60, sampleRate: 0 })];
        const { player, created } = harness(headers, 22050);

        player.noteOn(60, 100, 0);

        expect(created[0].rate).toBe(22050);
    });
});
