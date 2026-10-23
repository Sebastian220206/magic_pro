/**
 * The six MIDI effects written to go with their editors, and the chain that
 * hosts every effect in the slot.
 *
 * The thing worth pinning hardest here is note-off. Three of these change the
 * pitch that sounds, so releasing the key you pressed releases nothing and the
 * transposed note rings forever — a fault with no visible symptom until a note
 * never stops. Every processor that moves a pitch therefore has a test that
 * presses and releases, and asserts the pitch that comes back is the one that
 * sounded.
 */

import { Modifier, modifierTransform } from '../modifier';
import { Modulator, modulatorValue } from '../modulator';
import { NoteRepeater, repeatVelocity } from '../noteRepeater';
import { Randomizer, randomizeValue, weightedSample } from '../randomizer';
import { Transposer, foldIntoScale, inScale } from '../transposer';
import { VelocityProcessor, shapeVelocity, VELOCITY_DEFAULTS } from '../velocityProcessor';
import { midiFxChain, hasProcessor } from '../chain';

describe('Transposer', () => {
    it('shifts by the interval when the scale is chromatic', () => {
        const t = new Transposer({ transpose: 7 });
        expect(t.noteOn(60, 100)).toEqual([{ pitch: 67, velocity: 100 }]);
    });

    it('releases the pitch it sounded, not the key that was pressed', () => {
        const t = new Transposer({ transpose: 5 });
        t.noteOn(60, 100);
        expect(t.noteOff(60)).toEqual([65]);
    });

    it('releases nothing for a key it never sounded', () => {
        expect(new Transposer().noteOff(60)).toEqual([]);
    });

    it('transposes before folding, so a scale tone stays put', () => {
        // +2 from C in C major is D, which is already in the scale. Folding
        // first would correct C to C, then shift to D — same answer here, but
        // for E (+1 -> F) the order is what decides between F and E.
        const t = new Transposer({ transpose: 1, root: 0, scale: 'major' });
        expect(t.noteOn(64, 100)).toEqual([{ pitch: 65, velocity: 100 }]);
    });

    it('folds a note that lands off the scale', () => {
        // C# is not in C major; the nearest member downward is C.
        expect(foldIntoScale(61, 0, 'major')).toBe(60);
    });

    it('leaves every note alone on a chromatic scale', () => {
        for (let pitch = 60; pitch < 72; pitch++) {
            expect(inScale(pitch, 0, 'chromatic')).toBe(true);
            expect(foldIntoScale(pitch, 0, 'chromatic')).toBe(pitch);
        }
    });

    it('drops a note transposed out of MIDI range rather than wrapping it', () => {
        expect(new Transposer({ transpose: 24 }).noteOn(120, 100)).toEqual([]);
    });
});

describe('VelocityProcessor', () => {
    it('scales and offsets in value mode', () => {
        expect(shapeVelocity(64, { ...VELOCITY_DEFAULTS, scale: 50, add: 10 })).toBe(42);
    });

    it('leaves a velocity of zero alone, because zero is a note-off', () => {
        // Scaling a note-off up would turn a release into a note that never ends.
        expect(shapeVelocity(0, { ...VELOCITY_DEFAULTS, scale: 400, add: 100 })).toBe(0);
    });

    it('never returns zero for a note that was played', () => {
        expect(shapeVelocity(1, { ...VELOCITY_DEFAULTS, scale: 0, add: -100 })).toBe(1);
    });

    it('collapses onto the pivot at full compression', () => {
        const config = { ...VELOCITY_DEFAULTS, mode: 'compand' as const, compand: -100, pivot: 64 };
        expect(shapeVelocity(20, config)).toBe(64);
        expect(shapeVelocity(120, config)).toBe(64);
    });

    it('expands away from the pivot', () => {
        const config = { ...VELOCITY_DEFAULTS, mode: 'compand' as const, compand: 100, pivot: 64 };
        // 84 is 20 above the pivot; doubling that distance reaches 104.
        expect(shapeVelocity(84, config)).toBe(104);
    });

    it('clamps into the range whichever mode is selected', () => {
        for (const mode of ['value', 'compand', 'random'] as const) {
            const config = { ...VELOCITY_DEFAULTS, mode, scale: 400, rangeMin: 40, rangeMax: 80 };
            for (let v = 1; v <= 127; v++) {
                const out = shapeVelocity(v, config, () => 0.99);
                expect(out).toBeGreaterThanOrEqual(40);
                expect(out).toBeLessThanOrEqual(80);
            }
        }
    });

    it('reads a range given the wrong way round as a single held velocity', () => {
        const config = { ...VELOCITY_DEFAULTS, rangeMin: 90, rangeMax: 50 };
        expect(shapeVelocity(10, config)).toBe(50);
        expect(shapeVelocity(120, config)).toBe(90);
    });

    it('leaves the pitch untouched', () => {
        const p = new VelocityProcessor({ scale: 50 });
        expect(p.noteOn(60, 100)[0].pitch).toBe(60);
        expect(p.noteOff(60)).toEqual([60]);
    });
});

describe('Randomizer', () => {
    it('passes a value outside the input range through untouched', () => {
        const config = { target: 'velocity' as const, inputLow: 80, inputHigh: 127, amount: 64, weight: 0, offset: 20 };
        expect(randomizeValue(40, config)).toBe(40);
    });

    it('scatters a value inside the range', () => {
        const config = { target: 'velocity' as const, inputLow: 0, inputHigh: 127, amount: 40, weight: 0, offset: 0 };
        const results = new Set(Array.from({ length: 50 }, () => randomizeValue(64, config)));
        expect(results.size).toBeGreaterThan(1);
    });

    it('does nothing at an amount of zero', () => {
        const config = { target: 'velocity' as const, inputLow: 0, inputHigh: 127, amount: 0, weight: 0, offset: 0 };
        expect(randomizeValue(64, config)).toBe(64);
    });

    it('stays inside MIDI range however far the offset pushes', () => {
        const config = { target: 'velocity' as const, inputLow: 0, inputHigh: 127, amount: 127, weight: 0, offset: 127 };
        for (let i = 0; i < 200; i++) {
            const out = randomizeValue(64, config);
            expect(out).toBeGreaterThanOrEqual(0);
            expect(out).toBeLessThanOrEqual(127);
        }
    });

    it('biases the distribution toward the end the weight names', () => {
        const mean = (weight: number) => {
            let total = 0;
            for (let i = 0; i < 4000; i++) total += weightedSample(weight);
            return total / 4000;
        };
        expect(mean(90)).toBeGreaterThan(mean(0));
        expect(mean(-90)).toBeLessThan(mean(0));
    });

    it('stays within plus or minus a half whatever the weight', () => {
        for (const weight of [-100, -50, 0, 50, 100]) {
            for (let i = 0; i < 500; i++) {
                const sample = weightedSample(weight);
                expect(Math.abs(sample)).toBeLessThanOrEqual(0.5);
            }
        }
    });

    it('releases the pitch it sounded when randomising note numbers', () => {
        const r = new Randomizer({ target: 'noteNumber', amount: 24 });
        const [note] = r.noteOn(60, 100);
        expect(r.noteOff(60)).toEqual([note.pitch]);
    });

    it('never randomises a note-off into a sounding note', () => {
        const r = new Randomizer({ target: 'velocity', amount: 127, offset: 127 });
        expect(r.noteOn(60, 0)[0].velocity).toBe(0);
    });
});

describe('Modulator', () => {
    it('samples the LFO at phase zero on the first note', () => {
        // Sine starts at zero, so the first note passes untouched.
        const m = new Modulator({ target: 'velocity', waveform: 'sine', depth: 20 });
        expect(m.noteOn(60, 100)).toEqual([{ pitch: 60, velocity: 100 }]);
    });

    it('advances one LFO step per note', () => {
        // Square is +1 for the first half of the cycle: with 4 steps per
        // cycle the first two notes read +depth and the next two -depth.
        const m = new Modulator({ target: 'velocity', waveform: 'square', depth: 10, stepsPerCycle: 4 });
        expect(m.noteOn(60, 100)[0].velocity).toBe(110);
        expect(m.noteOn(61, 100)[0].velocity).toBe(110);
        expect(m.noteOn(62, 100)[0].velocity).toBe(90);
        expect(m.noteOn(63, 100)[0].velocity).toBe(90);
    });

    it('wobbles pitch when that is the target', () => {
        const m = new Modulator({ target: 'noteNumber', waveform: 'square', depth: 2, stepsPerCycle: 4 });
        expect(m.noteOn(60, 100)).toEqual([{ pitch: 62, velocity: 100 }]);
    });

    it('releases the pitch it sounded, not the key that was pressed', () => {
        const m = new Modulator({ target: 'noteNumber', waveform: 'square', depth: 2, stepsPerCycle: 4 });
        m.noteOn(60, 100);
        expect(m.noteOff(60)).toEqual([62]);
    });

    it('floors a velocity the LFO drove to zero', () => {
        // Two steps per cycle: the first note reads the crest, the second
        // the trough, where 100 - 127 would be a note-off.
        const m = new Modulator({ target: 'velocity', waveform: 'square', depth: 127, stepsPerCycle: 2 });
        m.noteOn(60, 100);
        expect(m.noteOn(60, 100)[0].velocity).toBe(1);
    });

    it('leaves a note-off alone, because zero is a release', () => {
        const m = new Modulator({ target: 'velocity', waveform: 'square', depth: 40 });
        expect(m.noteOn(60, 0)).toEqual([{ pitch: 60, velocity: 0 }]);
    });

    it('draws every waveform inside minus one to one', () => {
        for (const waveform of ['sine', 'triangle', 'square', 'saw'] as const) {
            for (let i = 0; i < 64; i++) {
                const v = modulatorValue(i / 64, waveform);
                expect(v).toBeGreaterThanOrEqual(-1);
                expect(v).toBeLessThanOrEqual(1);
            }
        }
    });

    it('peaks the triangle at a quarter cycle and troughs it at three', () => {
        expect(modulatorValue(0.25, 'triangle')).toBeCloseTo(1);
        expect(modulatorValue(0.75, 'triangle')).toBeCloseTo(-1);
        expect(modulatorValue(0, 'triangle')).toBeCloseTo(0);
    });
});

describe('NoteRepeater', () => {
    it('emits nothing before the first tick, like the arpeggiator', () => {
        const r = new NoteRepeater({ rate: '1/16' });
        r.noteOn(60, 100);
        r.start();
        expect(r.processStep(0)).toEqual([]);
    });

    it('repeats the held pitch at the rate', () => {
        const r = new NoteRepeater({ rate: '1/4', repetitions: 0, velocityRamp: 0 });
        r.noteOn(60, 100);
        r.start();
        const events = r.processStep(4);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ type: 'note-on', pitch: 60, velocity: 100 });
    });

    it('decays the velocity by the ramp each repeat', () => {
        expect(repeatVelocity(100, 0, { rate: '1/16', repetitions: 0, velocityRamp: -10 })).toBe(100);
        expect(repeatVelocity(100, 1, { rate: '1/16', repetitions: 0, velocityRamp: -10 })).toBe(90);
        expect(repeatVelocity(100, 3, { rate: '1/16', repetitions: 0, velocityRamp: -10 })).toBe(70);
    });

    it('never decays into a note-off', () => {
        expect(repeatVelocity(10, 5, { rate: '1/16', repetitions: 0, velocityRamp: -10 })).toBe(1);
    });

    it('stops after the configured repetitions but still releases', () => {
        const r = new NoteRepeater({ rate: '1/16', repetitions: 2, velocityRamp: 0 });
        r.noteOn(60, 100);
        r.start();
        expect(r.processStep(4)).toHaveLength(1);
        // Step 5 triggers the second repeat, preceding it with note-off for the previous repeat
        const step2Events = r.processStep(5);
        expect(step2Events.filter(e => e.type === 'note-on')).toHaveLength(1);
        expect(step2Events.filter(e => e.type === 'note-off')).toHaveLength(1);
        // Two repeats done: further ticks are silent …
        expect(r.processStep(6)).toEqual([]);
        // … but the key still releases what it sounded.
        r.noteOff(60);
        expect(r.getState().activeNotes.size).toBe(0);
    });

    it('restarts the count when the key is re-struck', () => {
        const r = new NoteRepeater({ rate: '1/16', repetitions: 1, velocityRamp: 0 });
        r.noteOn(60, 100);
        r.start();
        expect(r.processStep(4)).toHaveLength(1);
        r.noteOn(62, 90);
        r.start();
        expect(r.processStep(8).filter(e => e.type === 'note-on')).toEqual([
            expect.objectContaining({ pitch: 62, velocity: 90 }),
        ]);
    });
});

describe('Modifier', () => {
    it('applies scale then add', () => {
        expect(modifierTransform(64, { source: 'noteNumber', target: 'velocity', scale: 150, add: -20, thru: false })).toBe(76);
    });

    it('clamps into MIDI range', () => {
        expect(modifierTransform(127, { source: 'velocity', target: 'velocity', scale: 200, add: 0, thru: false })).toBe(127);
        expect(modifierTransform(0, { source: 'velocity', target: 'velocity', scale: 100, add: -50, thru: false })).toBe(0);
    });

    it('writes the source onto the target', () => {
        // Note number 60 at 100% becomes the velocity.
        const m = new Modifier({ source: 'noteNumber', target: 'velocity', scale: 100, add: 0 });
        expect(m.noteOn(60, 20)).toEqual([{ pitch: 60, velocity: 60 }]);
    });

    it('floors a velocity the transform drove to zero', () => {
        const m = new Modifier({ source: 'velocity', target: 'velocity', scale: 0, add: 0 });
        expect(m.noteOn(60, 100)[0].velocity).toBe(1);
    });

    it('sounds the played note alongside the modified one when Thru is on', () => {
        const m = new Modifier({ source: 'velocity', target: 'noteNumber', scale: 100, add: 0, thru: true });
        // Velocity 72 becomes the note number, so the played 60 is a second note.
        expect(m.noteOn(60, 72).map(n => n.pitch).sort((a, b) => a - b)).toEqual([60, 72]);
    });

    it('suppresses Thru when both notes would land on the same pitch', () => {
        // Sounding one pitch twice retriggers it rather than layering.
        const m = new Modifier({ source: 'velocity', target: 'velocity', scale: 100, add: 0, thru: true });
        expect(m.noteOn(60, 100)).toHaveLength(1);
    });

    it('releases every pitch it sounded', () => {
        const m = new Modifier({ source: 'velocity', target: 'noteNumber', scale: 100, add: 0, thru: true });
        m.noteOn(60, 72);
        expect(m.noteOff(60).sort((a, b) => a - b)).toEqual([60, 72]);
    });
});

describe('the chain', () => {
    const track = (midiFx: string | null, settings?: Record<string, unknown>) => ({
        id: 'track-1',
        midiFx,
        midiFxSettings: settings as never,
    });

    afterEach(() => {
        midiFxChain.release('track-1');
        midiFxChain.setSink(null);
    });

    it('knows which catalogue entries it can build', () => {
        expect(hasProcessor('transposer')).toBe(true);
        expect(hasProcessor('scripter')).toBe(true);
        expect(hasProcessor('modulator')).toBe(true);
        expect(hasProcessor('noteRepeater')).toBe(true);
        expect(hasProcessor(null)).toBe(false);
    });

    it('passes the note through when the slot is empty', () => {
        expect(midiFxChain.noteOn(track(null), 60, 100)).toEqual([{ pitch: 60, velocity: 100 }]);
    });

    it('passes the note through for an unknown effect id', () => {
        expect(midiFxChain.noteOn(track('nope'), 60, 100)).toEqual([{ pitch: 60, velocity: 100 }]);
    });

    it('passes the note through when no track is given', () => {
        expect(midiFxChain.noteOn(undefined, 60, 100)).toEqual([{ pitch: 60, velocity: 100 }]);
        expect(midiFxChain.noteOff(undefined, 60)).toEqual([60]);
    });

    it('applies the track\'s settings rather than the processor\'s defaults', () => {
        // The fault this replaced: every processor was built with defaults and
        // there was nowhere to put a change.
        const t = track('transposer', { transposer: { transpose: 12 } });
        expect(midiFxChain.noteOn(t, 60, 100)).toEqual([{ pitch: 72, velocity: 100 }]);
    });

    it('picks up a settings change without being rebuilt', () => {
        midiFxChain.noteOn(track('transposer', { transposer: { transpose: 3 } }), 60, 100);
        const changed = track('transposer', { transposer: { transpose: 5 } });
        expect(midiFxChain.noteOn(changed, 61, 100)).toEqual([{ pitch: 66, velocity: 100 }]);
    });

    it('swallows the note for a generator, leaving it to the transport tick', () => {
        // An empty result here means the arpeggiator took the note. A caller
        // that reads it as "play nothing" and falls back to the raw pitch
        // would sound a drone under the pattern.
        expect(midiFxChain.noteOn(track('arpeggiator'), 60, 100)).toEqual([]);
    });

    it('sounds arpeggiator notes through the sink on a tick', () => {
        const sounded: number[] = [];
        midiFxChain.setSink({
            noteOn: (_id, pitch) => { sounded.push(pitch); },
            noteOff: () => { },
        });

        const t = track('arpeggiator', { arpeggiator: { rate: '1/4' } });
        midiFxChain.noteOn(t, 60, 100);
        midiFxChain.noteOn(t, 64, 100);
        // Far enough past the last step for the rate to have elapsed.
        midiFxChain.tick(4);

        expect(sounded.length).toBeGreaterThan(0);
    });

    it('sounds note-repeater repeats through the sink on a tick', () => {
        const sounded: number[] = [];
        midiFxChain.setSink({
            noteOn: (_id, pitch) => { sounded.push(pitch); },
            noteOff: () => { },
        });

        const t = track('noteRepeater', { noteRepeater: { rate: '1/4' } });
        midiFxChain.noteOn(t, 60, 100);
        // Far enough past the start for the rate to have elapsed.
        midiFxChain.tick(4);

        expect(sounded).toContain(60);
    });

    it('applies modulator settings rather than its defaults', () => {
        // Square at 4 steps per cycle reads +depth on the first note.
        const t = track('modulator', { modulator: { target: 'velocity', waveform: 'square', depth: 20, stepsPerCycle: 4 } });
        expect(midiFxChain.noteOn(t, 60, 100)).toEqual([{ pitch: 60, velocity: 120 }]);
    });

    it('releases the pitches an effect sounded when the slot changes', () => {
        const released: number[] = [];
        midiFxChain.setSink({ noteOn: () => { }, noteOff: (_id, pitch) => { released.push(pitch); } });

        midiFxChain.noteOn(track('transposer', { transposer: { transpose: 12 } }), 60, 100);
        // Switching the slot must not leave the transposed note ringing.
        midiFxChain.noteOn(track('velocityProcessor'), 62, 100);

        expect(released).toContain(72);
    });
});
