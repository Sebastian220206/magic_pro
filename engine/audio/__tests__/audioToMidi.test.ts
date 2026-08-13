import { AudioToMidi } from '../audioToMidi';

const SR = 44100;

/** A steady sine, the easiest possible input for monophonic pitch tracking. */
function tone(freq: number, seconds: number, sampleRate = SR): Float32Array {
    const out = new Float32Array(Math.floor(seconds * sampleRate));
    for (let i = 0; i < out.length; i++) {
        // A short fade in and out, so the onset detector sees an edge.
        const env = Math.min(1, i / 800, (out.length - i) / 800);
        out[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate) * 0.8 * env;
    }
    return out;
}

describe('AudioToMidi', () => {
    it('transcribes a 440 Hz tone as A4', () => {
        const t = new AudioToMidi(SR, { mode: 'monophonic' });
        const result = t.transcribe(tone(440, 1.5));

        expect(result.notes.length).toBeGreaterThan(0);
        // A4 is MIDI 69; allow a semitone either way.
        const pitches = result.notes.map(n => n.pitch);
        expect(Math.min(...pitches.map(p => Math.abs(p - 69)))).toBeLessThanOrEqual(1);
    });

    it('reports the octave, not a harmonic, for a low tone', () => {
        const t = new AudioToMidi(SR, { mode: 'monophonic' });
        // A2 = 110 Hz, MIDI 45.
        const result = t.transcribe(tone(110, 1.5));
        expect(result.notes.length).toBeGreaterThan(0);
        expect(Math.min(...result.notes.map(n => Math.abs(n.pitch - 45)))).toBeLessThanOrEqual(1);
    });

    it('finds nothing in silence rather than inventing notes', () => {
        const t = new AudioToMidi(SR, { mode: 'monophonic' });
        const result = t.transcribe(new Float32Array(SR));
        expect(result.notes).toHaveLength(0);
    });

    it('returns notes with a usable duration and velocity', () => {
        const t = new AudioToMidi(SR, { mode: 'monophonic' });
        const result = t.transcribe(tone(440, 1.5));
        for (const n of result.notes) {
            expect(n.duration).toBeGreaterThan(0);
            expect(n.velocity).toBeGreaterThan(0);
            expect(n.velocity).toBeLessThanOrEqual(127);
        }
    });
});
