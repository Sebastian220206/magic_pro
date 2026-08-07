/**
 * @jest-environment jsdom
 *
 * End-to-end audit of the "make a simple beat" workflow.
 *
 * Drives the real project store through every step a user takes to write a
 * track — setup, drums, chords, bass, melody, arrangement, editing, mixing,
 * mastering, export — and asserts the state the DAW is left in. Only the audio
 * output layer is mocked; all sequencing, arrangement and mix logic is the real
 * implementation, so a regression in any of it fails here.
 */

import { collectMidiNoteEvents } from '@/engine/audioEngine/midiSequencer';

// ── audio output stubs ─────────────────────────────────────────────────────

const engineCalls: { method: string; args: unknown[] }[] = [];
const record = (method: string) => jest.fn((...args: unknown[]) => {
    engineCalls.push({ method, args });
});

jest.mock('@/engine/AudioEngineAdapter', () => {
    const methods = [
        'init', 'waitForReady', 'createTrack', 'removeTrack', 'updateTrackParams',
        'muteTrack', 'unmuteTrack', 'soloTrack', 'unsoloTrack', 'setTempo', 'play', 'stop',
        'pause', 'seek', 'updateFXChain', 'updatePluginParams', 'loadInstrument',
        'loadWamInstrument', 'triggerNote', 'releaseNote', 'scheduleNote', 'allNotesOff',
        'routeTrackToBus', 'routeTrackToTrack', 'setMasterVolume', 'setMasterPan',
        'configureAudioFormat', 'setMetronomeEnabled', 'updateMetronomeSettings',
        'getContext', 'dispose', 'updateTrackPlugins', 'setTrackSendLevel',
        'updateMasterFXChain', 'configureMetronome',
    ];
    const engine: Record<string, unknown> = {};
    for (const m of methods) {
        engine[m] = jest.fn((...args: unknown[]) => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            (global as never as { __engineCalls: typeof engineCalls }).__engineCalls?.push({ method: m, args });
            if (m === 'getContext') return null;
            return undefined;
        });
    }
    return { audioEngine: engine, default: engine };
});

jest.mock('@/engine/persistence/engineRebuilder', () => ({
    rebuildEngine: jest.fn().mockResolvedValue({
        success: true, tracksCreated: 0, instrumentsLoaded: 0, buffersRestored: 0, errors: [],
    }),
}));

jest.mock('@/engine/export/OfflineRenderer', () => ({
    renderSongOffline: jest.fn(async () => {
        const channels = [new Float32Array(4410), new Float32Array(4410)];
        return {
            numberOfChannels: 2, length: 4410, sampleRate: 44100, duration: 0.1,
            getChannelData: (i: number) => channels[i],
        } as unknown as AudioBuffer;
    }),
}));

(global as never as { __engineCalls: typeof engineCalls }).__engineCalls = engineCalls;

// ── helpers ────────────────────────────────────────────────────────────────

import { useProjectStore } from '@/store/projectStore';
import type { Clip, Note } from '@/models/Clip';
import { resolvePluginId } from '@/engine/plugins/pluginIds';

const store = () => useProjectStore.getState();

/** Beats per bar for the project's time signature. */
const BEATS_PER_BAR = 4;
const bars = (n: number) => n * BEATS_PER_BAR;

let idCounter = 0;
const uid = (prefix: string) => `${prefix}-${++idCounter}`;

function addMidiTrack(name: string, instrument?: string): string {
    const id = uid('track');
    store().addTrack({ id, name, type: 'software-instrument', instrument } as never);
    return id;
}

function addMidiClip(trackId: string, start: number, duration: number, name: string): string {
    const id = uid('clip');
    store().addClip({
        id, trackId, name, start, duration, type: 'midi', notes: [],
    } as unknown as Clip);
    return id;
}

function note(pitch: number, start: number, duration: number, velocity = 100): Note {
    return { id: uid('note'), pitch, start, duration, velocity } as unknown as Note;
}

const clip = (id: string) => store().clips.find(c => c.id === id);
const track = (id: string) => store().tracks.find(t => t.id === id);

// MIDI note numbers
const KICK = 36, SNARE = 38, HAT = 42;
const C3 = 48, E3 = 52, G3 = 55, A3 = 57;
const C2 = 36, A2 = 45, F2 = 41, G2 = 43;

describe('making a simple beat, end to end', () => {
    // Track ids shared across the ordered steps below.
    const ids: Record<string, string> = {};

    beforeAll(() => {
        useProjectStore.setState({
            tracks: [], clips: [], markers: [], selectedTrackIds: [], selectedClipIds: [],
        } as never);
    });

    // ── Step 1: project setup ──────────────────────────────────────────────
    describe('1. project setup', () => {
        it('sets tempo, key and time signature', () => {
            store().setTempo(90);
            expect(store().tempo).toBe(90);

            store().setKeySignature('A minor');
            store().setTimeSignature('4/4');

            expect(store().keySignature).toBe('A minor');
            expect(store().timeSignature).toBe('4/4');
        });

        it('rejects a malformed time signature rather than corrupting the grid', () => {
            store().setTimeSignature('7/5');
            expect(store().timeSignature).toBe('4/4');
            store().setTimeSignature('6/8');
            expect(store().timeSignature).toBe('6/8');
            store().setTimeSignature('4/4');
        });

        it('sets the sample rate', () => {
            store().updateProjectSettings({ sampleRate: 48000 } as never);
            expect(store().settings.sampleRate).toBe(48000);
        });

        it('turns the metronome on', () => {
            if (!store().metronomeEnabled) store().toggleMetronome();
            expect(store().metronomeEnabled).toBe(true);
        });
    });

    // ── Step 2: drum foundation ────────────────────────────────────────────
    describe('2. drum foundation', () => {
        it('programs a 2-bar kick/snare/hat loop', () => {
            ids.drums = addMidiTrack('Drums', 'Drum Machine');
            ids.drumClip = addMidiClip(ids.drums, 0, bars(2), 'Beat');

            // Four-on-the-floor kick, backbeat snare, eighth-note hats.
            for (let beat = 0; beat < bars(2); beat++) {
                store().addNote(ids.drumClip, note(KICK, beat, 0.25));
                if (beat % 4 === 1 || beat % 4 === 3) {
                    store().addNote(ids.drumClip, note(SNARE, beat, 0.25));
                }
            }
            for (let eighth = 0; eighth < bars(2) * 2; eighth++) {
                store().addNote(ids.drumClip, note(HAT, eighth * 0.5, 0.125, 80));
            }

            const notes = clip(ids.drumClip)!.notes!;
            expect(notes.filter(n => n.pitch === KICK)).toHaveLength(8);
            expect(notes.filter(n => n.pitch === SNARE)).toHaveLength(4);
            expect(notes.filter(n => n.pitch === HAT)).toHaveLength(16);
        });

        it('loops the two bars with the cycle locators', () => {
            store().setLoop(0, bars(2), true);
            expect(store().cycleEnabled).toBe(true);
            expect(store().locatorLeft).toBe(0);
            expect(store().locatorRight).toBe(bars(2));
        });

        it('schedules the drum notes for playback', () => {
            const secondsPerBeat = 60 / store().tempo;
            const events = collectMidiNoteEvents(
                [clip(ids.drumClip) as never],
                {
                    transportStartTime: 0, currentTime: 0,
                    windowStartBeat: 0, windowEndBeat: bars(2),
                },
                {
                    beatsToSeconds: (b: number) => b * secondsPerBeat,
                    isTrackAudible: () => true,
                    alreadyScheduled: new Set<string>(),
                },
            );
            expect(events.length).toBeGreaterThanOrEqual(28);
            expect(events.every(e => e.stopTime > e.startTime)).toBe(true);
        });
    });

    // ── Step 3: chords ─────────────────────────────────────────────────────
    describe('3. chord progression', () => {
        it('lays a 4-chord progression over 8 bars', () => {
            ids.keys = addMidiTrack('Keys', 'Grand Piano');
            ids.keysClip = addMidiClip(ids.keys, 0, bars(8), 'Chords');

            // Am – F – C – G, two bars each.
            const progression = [[A3, C3 + 12, E3 + 12], [F2 + 12, A3, C3 + 12],
            [C3, E3, G3], [G2 + 12, C3 + 12, E3 + 12]];
            progression.forEach((chord, i) => {
                chord.forEach(pitch =>
                    store().addNote(ids.keysClip, note(pitch, bars(i * 2), bars(2))));
            });

            const notes = clip(ids.keysClip)!.notes!;
            expect(notes).toHaveLength(12);
            expect(new Set(notes.map(n => n.start)).size).toBe(4);
        });
    });

    // ── Step 4: bass ───────────────────────────────────────────────────────
    describe('4. bass', () => {
        it('follows the progression roots, locked to the kick', () => {
            ids.bass = addMidiTrack('Bass', 'Acoustic Bass');
            ids.bassClip = addMidiClip(ids.bass, 0, bars(8), 'Bass');

            const roots = [A2, F2, C2, G2];
            roots.forEach((root, i) => {
                // One root note per kick hit within the chord's two bars.
                for (let beat = 0; beat < bars(2); beat++) {
                    store().addNote(ids.bassClip, note(root, bars(i * 2) + beat, 0.9));
                }
            });

            const bassNotes = clip(ids.bassClip)!.notes!;
            expect(bassNotes).toHaveLength(32);

            // Every bass onset must coincide with a kick onset in the loop.
            const kickBeats = new Set(
                clip(ids.drumClip)!.notes!.filter(n => n.pitch === KICK).map(n => n.start % bars(2)));
            expect(bassNotes.every(n => kickBeats.has(n.start % bars(2)))).toBe(true);
        });
    });

    // ── Step 5: melody ─────────────────────────────────────────────────────
    describe('5. melody and audio', () => {
        it('writes a MIDI lead', () => {
            ids.lead = addMidiTrack('Lead', 'Square Lead');
            ids.leadClip = addMidiClip(ids.lead, bars(4), bars(4), 'Lead');

            [A3 + 12, C3 + 24, E3 + 12, G3 + 12, A3 + 12].forEach((pitch, i) =>
                store().addNote(ids.leadClip, note(pitch, bars(4) + i * 2, 1.5)));

            expect(clip(ids.leadClip)!.notes).toHaveLength(5);
        });

        it('creates an audio track for a vocal', () => {
            ids.vox = uid('track');
            store().addTrack({ id: ids.vox, name: 'Vocal', type: 'audio' } as never);
            expect(track(ids.vox)!.type).toBe('audio');
        });

        it('arms the audio track for recording', () => {
            store().toggleRecordEnable(ids.vox);
            expect(track(ids.vox)!.recordEnabled).toBe(true);
        });
    });

    // ── Step 6: arrangement ────────────────────────────────────────────────
    describe('6. arrangement', () => {
        it('duplicates a section', () => {
            const before = store().clips.length;
            store().duplicateClip(ids.drumClip);
            expect(store().clips.length).toBe(before + 1);
        });

        it('moves a clip to a new section', () => {
            const copy = store().clips[store().clips.length - 1];
            store().moveClip(copy.id, bars(8), ids.drums);
            expect(clip(copy.id)!.start).toBe(bars(8));
        });

        it('mutes an element to thin out a section', () => {
            store().toggleClipMute(ids.leadClip);
            expect(clip(ids.leadClip)!.muted).toBe(true);
            store().toggleClipMute(ids.leadClip);
            expect(clip(ids.leadClip)!.muted).toBe(false);
        });

        it('marks the song sections', () => {
            ['Intro', 'Verse', 'Chorus', 'Outro'].forEach((name, i) =>
                store().addMarker(bars(i * 8), name));
            expect(store().globalTracks.markers.length).toBeGreaterThanOrEqual(4);
        });
    });

    // ── Step 7: editing ────────────────────────────────────────────────────
    describe('7. editing', () => {
        it('quantizes MIDI to the grid', () => {
            const c = addMidiClip(ids.lead, bars(12), bars(2), 'Sloppy');
            store().addNote(c, note(C3, bars(12) + 0.07, 1));
            store().addNote(c, note(E3, bars(12) + 1.94, 1));

            store().quantizeClipNotes(c, 4);   // quarter-note grid

            const starts = clip(c)!.notes!.map(n => n.start);
            expect(starts).toEqual([bars(12), bars(12) + 2]);
        });

        it('splits and trims a clip', () => {
            const before = store().clips.length;
            store().splitClipAtTime(ids.keysClip, bars(4));
            expect(store().clips.length).toBe(before + 1);
        });

        it('crossfades between adjacent audio clips', () => {
            const a = uid('clip'), b = uid('clip');
            store().addClip({ id: a, trackId: ids.vox, name: 'Take A', start: 0, duration: 4, type: 'audio' } as never);
            store().addClip({ id: b, trackId: ids.vox, name: 'Take B', start: 3.5, duration: 4, type: 'audio' } as never);

            store().updateClipFade(a, 'out', { duration: 0.5, curve: 'equalPower' });
            store().updateClipFade(b, 'in', { duration: 0.5, curve: 'equalPower' });

            expect((clip(a) as never as Record<string, { duration: number }>).fadeOut.duration).toBe(0.5);
            expect((clip(b) as never as Record<string, { duration: number }>).fadeIn.duration).toBe(0.5);
        });
    });

    // ── Step 8: mixing ─────────────────────────────────────────────────────
    describe('8. mixing', () => {
        it('sets levels and panning', () => {
            store().updateTrack(ids.drums, { volume: 0.9, pan: 0 });
            store().updateTrack(ids.keys, { volume: 0.6, pan: -0.3 });
            store().updateTrack(ids.bass, { volume: 0.8, pan: 0 });
            store().updateTrack(ids.lead, { volume: 0.5, pan: 0.3 });

            expect(track(ids.keys)!.pan).toBeCloseTo(-0.3);
            expect(track(ids.lead)!.volume).toBeCloseTo(0.5);
        });

        it('adds EQ and compression to a track', () => {
            store().addPlugin(ids.bass, 'eq');
            store().addPlugin(ids.bass, 'comp');

            const plugins = track(ids.bass)!.plugins ?? [];
            expect(plugins).toHaveLength(2);
            expect(plugins.map(p => p.pluginId))
                .toEqual([resolvePluginId('eq'), resolvePluginId('comp')]);
        });

        it('changes a plugin parameter and keeps it', () => {
            const plugin = track(ids.bass)!.plugins![0];
            store().updatePluginParams(ids.bass, plugin.id, { lowGain: 3.5 });
            expect(track(ids.bass)!.plugins![0].params.lowGain).toBe(3.5);
        });

        it('sends a track to a reverb bus', () => {
            ids.reverbBus = uid('track');
            store().addTrack({ id: ids.reverbBus, name: 'Reverb Bus', type: 'bus' } as never);
            store().addPlugin(ids.reverbBus, 'reverb');

            store().setTrackSend(ids.keys, ids.reverbBus, 0.35);

            const sends = track(ids.keys)!.sends ?? [];
            expect(sends).toHaveLength(1);
            expect(sends[0].busId).toBe(ids.reverbBus);
            expect(sends[0].level).toBeCloseTo(0.35);
        });
    });

    // ── Step 9: mastering ──────────────────────────────────────────────────
    describe('9. mastering', () => {
        it('puts bus compression and limiting on the master', () => {
            store().addMasterPlugin('comp');
            store().addMasterPlugin('limiter');

            const master = store().masterPlugins ?? [];
            expect(master.map(p => p.pluginId))
                .toEqual([resolvePluginId('comp'), resolvePluginId('limiter')]);
        });

        it('keeps the master chain across a save and reload', () => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { serializeStoreState, deserializeState } = require('@/engine/persistence/projectPersistence');
            const restored = deserializeState(serializeStoreState(() => store()));
            expect(restored.masterPlugins.map((p: { pluginId: string }) => p.pluginId))
                .toEqual([resolvePluginId('comp'), resolvePluginId('limiter')]);
        });

        it('sets the master level', () => {
            store().updateProjectSettings({ masterVolume: 0.85 } as never);
            expect(store().settings.masterVolume).toBeCloseTo(0.85);
        });
    });

    // ── Step 10: export ────────────────────────────────────────────────────
    describe('10. export', () => {
        it('renders the project to an audio buffer', async () => {
            const result = await store().exportProject({
                format: 'wav', sampleRate: 48000, bitDepth: 24,
            });
            expect(result.buffer.numberOfChannels).toBe(2);
            expect(result.degradedTracks).toEqual([]);
        });

        it('produces a named, encoded file', async () => {
            const result = await store().exportProject({ fileName: 'My Beat' });
            expect(result.fileName).toBe('My Beat.wav');
            expect(result.blob.size).toBeGreaterThan(0);
        });

        it('reports that MP3 fell back to WAV rather than mislabelling the file', async () => {
            const result = await store().exportProject({ format: 'mp3' });
            expect(result.formatNotice).toMatch(/WAV/);
            expect(result.fileName.endsWith('.wav')).toBe(true);
        });

        it('refuses to export an empty range instead of writing silence', async () => {
            await expect(store().exportProject({ startBeat: 8, endBeat: 8 }))
                .rejects.toThrow(/no audible range/);
        });
    });
});
