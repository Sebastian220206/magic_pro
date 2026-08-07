/**
 * End-to-end audit of the installed General MIDI bank through the real
 * runtime path — `SoundFontInstrument.selectPreset` then `noteOn` — rather
 * than a re-implementation of the zone rules.
 *
 * Asserts, for every preset in the bank, that selecting it succeeds and that
 * playing it actually starts sample voices, with a sane voice count and a
 * buffer that isn't a degenerate slice.
 *
 * Skips itself when the font is not installed, so CI without the 30 MB asset
 * still passes.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { SoundFontParser } from '@/engine/instruments/soundfont/SoundFontParser';
import { SoundFontInstrument } from '@/engine/instruments/soundfont/SoundFontInstrument';

const FONT = path.join(process.cwd(), 'public', 'soundfonts', 'GeneralUser-GS.sf2');

/** Records every buffer source that gets started, so we can count voices. */
interface Started { duration: number; playbackRate: number; loop: boolean }

function mockContext(started: Started[]) {
    const param = (value: number) => ({
        value,
        setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(), setTargetAtTime: jest.fn(),
        cancelScheduledValues: jest.fn(),
    });
    const node = () => ({
        connect: jest.fn(), disconnect: jest.fn(),
        gain: param(1), pan: param(0),
    });

    return {
        currentTime: 0,
        sampleRate: 44100,
        destination: node(),
        createGain: () => node(),
        createStereoPanner: () => node(),
        createBuffer: (channels: number, length: number, sampleRate: number) => ({
            numberOfChannels: channels, length, sampleRate,
            duration: length / sampleRate,
            getChannelData: () => new Float32Array(length),
        }),
        createBufferSource: () => {
            const src: Record<string, unknown> = {
                buffer: null, loop: false, loopStart: 0, loopEnd: 0,
                playbackRate: param(1),
                connect: jest.fn(), disconnect: jest.fn(), stop: jest.fn(),
                onended: null,
                start: jest.fn(() => {
                    const b = src.buffer as { duration: number } | null;
                    started.push({
                        duration: b?.duration ?? 0,
                        playbackRate: (src.playbackRate as { value: number }).value,
                        loop: src.loop as boolean,
                    });
                }),
            };
            return src;
        },
    } as unknown as AudioContext;
}

describe('GeneralUser GS runtime audit', () => {
    test('every preset selects and sounds through the real instrument', async () => {
        let buffer: ArrayBuffer;
        try {
            const data = await fs.readFile(FONT);
            buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
        } catch {
            console.warn('[audit] GeneralUser-GS.sf2 not installed — skipping.');
            return;
        }

        const parsed = new SoundFontParser().parse(buffer);
        const started: Started[] = [];
        const instrument = new SoundFontInstrument(mockContext(started));
        await instrument.loadFromParsedData(FONT, parsed, new ArrayBuffer(0), FONT);

        const presets = instrument.getPresetList();
        expect(presets).toHaveLength(parsed.presets.length);

        const notSelectable: string[] = [];
        const silent: string[] = [];
        const emptyBuffer: string[] = [];
        const absurdRate: string[] = [];
        let maxVoices = 0;

        // Drum banks are mapped across the kit range; melodic presets are
        // played over the range a piano roll actually uses.
        const melodic = [36, 48, 60, 72, 84];
        const percussive = [35, 38, 42, 46, 49];

        for (const preset of presets) {
            const label = `#${preset.index} ${preset.name.trim()} (bank ${preset.bank}, prog ${preset.program})`;

            if (!instrument.selectPreset(preset.index)) {
                notSelectable.push(label);
                continue;
            }

            const notes = preset.bank === 128 || preset.bank === 120 ? percussive : melodic;
            let sounded = 0;

            for (const note of notes) {
                for (const velocity of [30, 100]) {
                    started.length = 0;
                    instrument.noteOn(note, velocity, 0);
                    instrument.noteOff(note, 0.5);

                    sounded += started.length;
                    maxVoices = Math.max(maxVoices, started.length);

                    for (const s of started) {
                        if (s.duration <= 0) emptyBuffer.push(`${label} @${note}`);
                        // ±7 octaves. Some banks legitimately stretch a single
                        // layer very far — GeneralUser's "Bell Tower" pads a
                        // root-108 wave across the whole keyboard — so this
                        // only catches a rate that is non-finite or nonsense.
                        if (!Number.isFinite(s.playbackRate)
                            || s.playbackRate < 1 / 128 || s.playbackRate > 128) {
                            absurdRate.push(`${label} @${note} rate ${s.playbackRate.toFixed(3)}`);
                        }
                    }
                }
            }

            if (sounded === 0) silent.push(label);
            instrument.allNotesOff(0);
        }

        console.log('\n──────── GM runtime audit ────────');
        console.log(`presets checked:      ${presets.length}`);
        console.log(`not selectable:       ${notSelectable.length}`);
        console.log(`silent:               ${silent.length}`);
        console.log(`zero-length buffers:  ${emptyBuffer.length}`);
        console.log(`absurd playback rate: ${absurdRate.length}`);
        console.log(`max voices per note:  ${maxVoices}`);
        for (const [name, list] of [['not selectable', notSelectable], ['silent', silent],
        ['empty buffer', emptyBuffer], ['bad rate', absurdRate]] as [string, string[]][]) {
            if (list.length) console.log(`\n${name}:\n  ` + list.slice(0, 15).join('\n  '));
        }
        console.log('──────────────────────────────────\n');

        expect(notSelectable).toEqual([]);
        expect(silent).toEqual([]);
        expect(emptyBuffer).toEqual([]);
        expect(absurdRate).toEqual([]);
        // One key must never swallow a meaningful share of the 64-voice pool.
        expect(maxVoices).toBeLessThanOrEqual(8);
    }, 300000);
});
