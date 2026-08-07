/**
 * Pins the note-on/note-off contract for SoundFont voices.
 *
 * The bug these guard against: `Voice.start` reset `note` and `velocity` as
 * part of its teardown, *after* `SamplePlayer` had set them. Every voice then
 * reported note −1, `findVoicesForNote` matched nothing, note-off did nothing,
 * and notes rang until their buffer or loop ended. Separately, `when` was
 * treated as a delay added to `currentTime` even though callers pass absolute
 * AudioContext times, so a sequenced note-off landed hours in the future.
 */

import { Voice, VoiceState } from '../Voice';
import { VoiceAllocator } from '../VoiceAllocator';
import {
    createDefaultADSR, adsrFromSF2Generators, envelopeLevelAt, decayDuration, releaseLevelAfter,
} from '../ADSREnvelope';

interface Automation { kind: string; value: number; time: number }

function mockContext(currentTime = { value: 0 }) {
    const makeParam = (initial: number, log?: Automation[]) => ({
        value: initial,
        setValueAtTime: jest.fn((value: number, time: number) => {
            log?.push({ kind: 'set', value, time });
        }),
        linearRampToValueAtTime: jest.fn((value: number, time: number) => {
            log?.push({ kind: 'ramp', value, time });
        }),
        exponentialRampToValueAtTime: jest.fn((value: number, time: number) => {
            log?.push({ kind: 'expo', value, time });
        }),
        setTargetAtTime: jest.fn(),
        cancelScheduledValues: jest.fn(),
    });

    const gainLogs: Automation[][] = [];
    const stops: number[] = [];
    const starts: number[] = [];

    const ctx = {
        get currentTime() { return currentTime.value; },
        sampleRate: 44100,
        destination: { connect: jest.fn(), disconnect: jest.fn() },
        createGain: () => {
            const log: Automation[] = [];
            gainLogs.push(log);
            return { gain: makeParam(1, log), connect: jest.fn(), disconnect: jest.fn() };
        },
        createStereoPanner: () => ({
            pan: makeParam(0), connect: jest.fn(), disconnect: jest.fn(),
        }),
        createBufferSource: () => ({
            buffer: null as unknown, loop: false, loopStart: 0, loopEnd: 0,
            playbackRate: makeParam(1),
            connect: jest.fn(), disconnect: jest.fn(),
            onended: null,
            start: jest.fn((t: number) => starts.push(t)),
            stop: jest.fn((t?: number) => stops.push(t ?? -1)),
        }),
    } as unknown as AudioContext;

    return { ctx, gainLogs, stops, starts };
}

const buffer = { duration: 2, length: 88200, sampleRate: 44100 } as unknown as AudioBuffer;

const options = (over: Partial<Parameters<Voice['start']>[0]> = {}) => ({
    destination: { connect: jest.fn(), disconnect: jest.fn() } as unknown as AudioNode,
    sampleData: buffer,
    playbackRate: 1,
    gain: 1,
    adsr: { attack: 0.01, hold: 0, decay: 0.1, sustain: 1, release: 0.2 },
    ...over,
});

describe('Voice lifecycle', () => {
    it('keeps the note and velocity the caller assigned before start', () => {
        const { ctx } = mockContext();
        const voice = new Voice(ctx);

        voice.note = 60;
        voice.velocity = 100;
        voice.start(options());

        expect(voice.note).toBe(60);
        expect(voice.velocity).toBe(100);
        expect(voice.state).toBe(VoiceState.Playing);
    });

    it('treats start time as absolute, not as a delay from now', () => {
        const now = { value: 10 };
        const { ctx, starts } = mockContext(now);
        const voice = new Voice(ctx);

        voice.velocity = 100;
        voice.start(options(), 25);

        expect(starts).toEqual([25]);
    });

    it('starts immediately when given 0', () => {
        const now = { value: 7.5 };
        const { ctx, starts } = mockContext(now);
        const voice = new Voice(ctx);

        voice.velocity = 100;
        voice.start(options(), 0);

        expect(starts).toEqual([7.5]);
    });

    it('stops the source at the end of the release, not at an offset from now', () => {
        const now = { value: 10 };
        const { ctx, stops } = mockContext(now);
        const voice = new Voice(ctx);

        voice.velocity = 100;
        voice.start(options(), 10);
        voice.release(12);

        // 12 (absolute note-off) + 0.2s release. Treating 12 as a delay would
        // have produced 22.2.
        expect(stops).toEqual([12.2]);
    });

    it('silences a looping voice when released', () => {
        const now = { value: 0 };
        const { ctx, gainLogs, stops } = mockContext(now);
        const voice = new Voice(ctx);

        voice.velocity = 127;
        voice.start(options({ loopStart: 0.5, loopEnd: 1.5 }), 0);
        expect(voice.hasSustain).toBe(true);

        voice.release(1);

        const envelope = gainLogs[0];
        const silence = envelope.filter(a => a.value === 0 && a.time > 0);
        expect(silence).toHaveLength(1);
        expect(silence[0].time).toBeCloseTo(1.2);
        expect(stops).toEqual([1.2]);
    });

    it('scales the attack peak by velocity', () => {
        const { ctx, gainLogs } = mockContext();
        const voice = new Voice(ctx);

        voice.velocity = 64;
        voice.start(options({ gain: 1 }), 0);

        const peak = gainLogs[0].find(a => a.kind === 'ramp' && a.value > 0);
        expect(peak!.value).toBeCloseTo(64 / 127);
    });

    it('does not pre-schedule a release at note-on', () => {
        const { ctx, gainLogs } = mockContext();
        const voice = new Voice(ctx);

        voice.velocity = 100;
        voice.start(options({ adsr: { ...createDefaultADSR(), sustain: 1 } }), 0);

        // Sustain 1 means nothing should head toward zero until release.
        expect(gainLogs[0].filter(a => a.value === 0 && a.time > 0)).toHaveLength(0);
    });

    it('ignores a release for a voice that is not playing', () => {
        const { ctx, stops } = mockContext();
        const voice = new Voice(ctx);

        voice.velocity = 100;
        voice.start(options(), 0);
        voice.release(1);
        voice.release(5);   // second note-off for the same pitch

        expect(stops).toEqual([1.2]);
    });
});

describe('VoiceAllocator', () => {
    it('finds a sounding voice by note so note-off can reach it', () => {
        const { ctx } = mockContext();
        const allocator = new VoiceAllocator(ctx, 8);

        const voice = allocator.acquireVoice();
        voice.note = 60;
        voice.velocity = 100;
        voice.start(options(), 0);

        expect(allocator.findVoicesForNote(60)).toEqual([voice]);

        allocator.releaseNote(60, 1);
        expect(voice.state).toBe(VoiceState.Release);
    });

    it('reuses finished voices instead of stealing sounding ones', () => {
        const { ctx } = mockContext();
        const allocator = new VoiceAllocator(ctx, 8);

        const first = allocator.acquireVoice();
        first.note = 60;
        first.velocity = 100;
        first.start(options(), 0);
        first.stop();
        expect(first.state).toBe(VoiceState.Done);

        expect(allocator.acquireVoice()).toBe(first);
    });

    it('cancels not-yet-started voices on releaseAll instead of blipping them', () => {
        const now = { value: 10 };
        const { ctx } = mockContext(now);
        const allocator = new VoiceAllocator(ctx, 8);

        const sounding = allocator.acquireVoice();
        sounding.note = 60; sounding.velocity = 100;
        sounding.start(options(), 5);          // already started

        const queued = allocator.acquireVoice();
        queued.note = 64; queued.velocity = 100;
        queued.start(options(), 50);           // scheduled for later

        allocator.releaseAll(0);

        expect(sounding.state).toBe(VoiceState.Release);
        expect(queued.state).toBe(VoiceState.Done);
    });

    it('steals a releasing voice before one still held', () => {
        const { ctx } = mockContext();
        const allocator = new VoiceAllocator(ctx, 8);

        const voices = Array.from({ length: 8 }, (_, i) => {
            const v = allocator.acquireVoice();
            v.note = 60 + i;
            v.velocity = 100;
            v.start(options(), 0);
            (v as unknown as { _order: number })._order = i;
            return v;
        });

        voices[5].release(1);
        expect(allocator.acquireVoice()).toBe(voices[5]);
    });
});

describe('SF2 volume envelope', () => {
    it('reads sustain as centibels of attenuation, not a fraction', () => {
        // 0 cB is full level; the old `value / 1000` made it silent.
        expect(adsrFromSF2Generators(new Map([[37, 0]])).sustain).toBeCloseTo(1);
        // 60 cB = -6 dB ≈ half amplitude.
        expect(adsrFromSF2Generators(new Map([[37, 60]])).sustain).toBeCloseTo(0.501, 2);
        // 1000 cB = -100 dB, effectively silent.
        expect(adsrFromSF2Generators(new Map([[37, 1000]])).sustain).toBe(0);
    });

    it('treats 0 timecents as one second, not as instant', () => {
        expect(adsrFromSF2Generators(new Map([[34, 0]])).attack).toBeCloseTo(1);
        expect(adsrFromSF2Generators(new Map([[38, 0]])).release).toBeCloseTo(1);
    });

    it('defaults an unspecified stage to ~1 ms', () => {
        const adsr = adsrFromSF2Generators(new Map([[37, 0]]));
        expect(adsr.attack).toBeCloseTo(0.001);
        expect(adsr.release).toBeCloseTo(0.001);
    });

    it('reports the level along attack, decay and sustain', () => {
        // sustain 0 = −100 dB, so the decay stage runs its full nominal time.
        const adsr = { attack: 1, hold: 0, decay: 2, sustain: 0, release: 1 };

        expect(envelopeLevelAt(adsr, 1, 0, -1)).toBe(0);
        expect(envelopeLevelAt(adsr, 1, 0, 0.5)).toBeCloseTo(0.5);   // mid attack, linear
        expect(envelopeLevelAt(adsr, 1, 0, 1)).toBeCloseTo(1);       // peak

        // Decay falls 100 dB over 2 s, so 50 dB — a factor of 10^-2.5 — at 1 s in.
        expect(envelopeLevelAt(adsr, 1, 0, 2)).toBeCloseTo(10 ** -2.5, 5);
        expect(envelopeLevelAt(adsr, 1, 0, 3)).toBe(0);              // fully decayed
        expect(envelopeLevelAt(adsr, 1, 0, 30)).toBe(0);
    });

    it('decays in dB, not in a straight amplitude line', () => {
        // The reverb-sounding bug: GeneralUser gives its piano an 18.6 s decay
        // to silence. Ramped linearly in amplitude it is still near full volume
        // a second later; in dB it is already well down.
        const piano = { attack: 0.006, hold: 0, decay: 18.6, sustain: 0, release: 0.96 };

        const oneSecondIn = envelopeLevelAt(piano, 1, 0, 1);
        expect(oneSecondIn).toBeLessThan(0.6);          // linear would give ~0.95
        expect(envelopeLevelAt(piano, 1, 0, 5)).toBeLessThan(0.06);
        expect(envelopeLevelAt(piano, 1, 0, 12)).toBeLessThan(0.002);
    });

    it('reaches a shallow sustain long before the nominal decay time', () => {
        // 6 dB of the 100 dB span, so 6% of the decay time.
        const adsr = { attack: 0.001, hold: 0, decay: 10, sustain: 0.5, release: 1 };
        expect(decayDuration(adsr)).toBeCloseTo(0.602, 2);
        expect(envelopeLevelAt(adsr, 1, 0, 5)).toBeCloseTo(0.5);
    });

    it('releases in dB from wherever the envelope had reached', () => {
        const adsr = { attack: 0.001, hold: 0, decay: 1, sustain: 1, release: 2 };

        // 100 dB over 2 s: half a second in is 25 dB down.
        expect(releaseLevelAfter(adsr, 1, 0)).toBe(1);
        expect(releaseLevelAfter(adsr, 1, 0.5)).toBeCloseTo(10 ** -1.25, 5);
        expect(releaseLevelAfter(adsr, 1, 2)).toBe(0);
        expect(releaseLevelAfter(adsr, 1, 5)).toBe(0);
    });

    it('holds at peak through the hold stage', () => {
        const adsr = { attack: 0.1, hold: 0.5, decay: 1, sustain: 0, release: 1 };
        expect(envelopeLevelAt(adsr, 1, 0, 0.3)).toBeCloseTo(1);
        expect(envelopeLevelAt(adsr, 1, 0, 0.6)).toBeCloseTo(1);
        expect(envelopeLevelAt(adsr, 1, 0, 1.1)).toBeCloseTo(10 ** -2.5, 5);
    });
});
