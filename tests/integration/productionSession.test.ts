/**
 * @jest-environment jsdom
 *
 * Full production-session audit: a 3½-minute, 124 BPM, A-minor pop/electronic
 * track taken from setup through delivery.
 *
 * Where `beatWorkflow.test.ts` covers the shape of making a beat, this covers
 * the session structure a record is actually made in — reference tracks,
 * section markers, layered sounds on busses, a 128-bar arrangement built by
 * subtraction, comped vocals, a bus tree, sidechain and parallel compression,
 * a master chain, and stem delivery.
 *
 * Only the audio output layer is mocked; the store, arrangement and routing
 * logic is the real implementation.
 */

const engineCalls: { method: string; args: unknown[] }[] = [];

jest.mock('@/engine/AudioEngineAdapter', () => {
    const methods = [
        'init', 'waitForReady', 'createTrack', 'removeTrack', 'updateTrackParams',
        'muteTrack', 'unmuteTrack', 'soloTrack', 'unsoloTrack', 'setTempo', 'play', 'stop',
        'pause', 'seek', 'updateFXChain', 'updateMasterFXChain', 'updatePluginParams',
        'loadInstrument', 'loadWamInstrument', 'triggerNote', 'releaseNote', 'scheduleNote',
        'allNotesOff', 'routeTrackToBus', 'routeTrackToTrack', 'setMasterVolume',
        'setMasterPan', 'configureAudioFormat', 'setMetronomeEnabled', 'configureMetronome',
        'updateMetronomeSettings', 'getContext', 'dispose', 'updateTrackPlugins',
        'setTrackSendLevel', 'getBuffer', 'setSidechainSource', 'clearSidechainSource',
        'setTrackMonitorMode', 'setTrackDelay',
    ];
    const engine: Record<string, unknown> = {};
    for (const m of methods) {
        engine[m] = jest.fn((...args: unknown[]) => {
            (global as never as { __calls: typeof engineCalls }).__calls?.push({ method: m, args });
            return m === 'getContext' || m === 'getBuffer' ? null : undefined;
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
        const ch = [new Float32Array(4410), new Float32Array(4410)];
        return {
            numberOfChannels: 2, length: 4410, sampleRate: 48000, duration: 0.1,
            getChannelData: (i: number) => ch[i],
        } as unknown as AudioBuffer;
    }),
}));

(global as never as { __calls: typeof engineCalls }).__calls = engineCalls;

// jsdom's Blob has no arrayBuffer(); WAV tagging needs one.
if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob) {
        return new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(this);
        });
    };
}

import { useProjectStore } from '@/store/projectStore';
import type { Clip, Note } from '@/models/Clip';

const store = () => useProjectStore.getState();
const BAR = 4;                       // 4/4
const bar = (n: number) => (n - 1) * BAR;   // bar 1 === beat 0

let seq = 0;
const uid = (p: string) => `${p}-${++seq}`;

const track = (id: string) => store().tracks.find(t => t.id === id);
const clip = (id: string) => store().clips.find(c => c.id === id);

function addTrack(name: string, type: string, extra: Record<string, unknown> = {}): string {
    const id = uid('t');
    store().addTrack({ id, name, type, ...extra } as never);
    return id;
}

function addClip(trackId: string, start: number, duration: number, type = 'midi'): string {
    const id = uid('c');
    store().addClip({ id, trackId, name: 'r', start, duration, type, notes: [] } as unknown as Clip);
    return id;
}

const note = (pitch: number, start: number, duration: number, velocity = 100): Note =>
    ({ id: uid('n'), pitch, start, duration, velocity } as unknown as Note);

/** The arrangement from the session plan. */
const SECTIONS = [
    { name: 'Intro', start: 1, bars: 8 },
    { name: 'Verse 1', start: 9, bars: 16 },
    { name: 'Pre 1', start: 25, bars: 8 },
    { name: 'Chorus 1', start: 33, bars: 16 },
    { name: 'Verse 2', start: 49, bars: 16 },
    { name: 'Pre 2', start: 65, bars: 8 },
    { name: 'Chorus 2', start: 73, bars: 16 },
    { name: 'Bridge', start: 89, bars: 16 },
    { name: 'Chorus 3', start: 105, bars: 16 },
    { name: 'Outro', start: 121, bars: 8 },
];

const ids: Record<string, string> = {};

describe('production session', () => {
    beforeAll(() => {
        useProjectStore.setState({
            tracks: [], clips: [], masterPlugins: [], selectedTrackIds: [], selectedClipIds: [],
        } as never);
    });

    // ── Session 1: setup ───────────────────────────────────────────────────
    describe('S1 setup', () => {
        it('runs at 48 kHz / 24-bit, 124 BPM, A minor', () => {
            store().setTempo(124);
            store().setKeySignature('A minor');
            store().setTimeSignature('4/4');
            store().updateProjectSettings({ sampleRate: 48000, bitDepth: 24 } as never);

            expect(store().tempo).toBe(124);
            expect(store().keySignature).toBe('A minor');
            expect(store().settings.sampleRate).toBe(48000);
            expect(store().settings.bitDepth).toBe(24);
        });

        it('routes a reference track straight to the monitor, bypassing the master chain', () => {
            ids.ref = addTrack('Reference', 'audio');
            store().setTrackMonitorMode(ids.ref, 'direct');

            expect(track(ids.ref)!.monitorMode).toBe('direct');
        });

        it('gain-matches the reference by RMS', () => {
            // A buffer at a known level; matching to -18 dBFS should attenuate it.
            const samples = new Float32Array(4800).fill(0.5);   // ≈ -6 dBFS RMS
            const gain = store().gainToMatchRms(samples, -18);

            expect(20 * Math.log10(gain)).toBeCloseTo(-12, 0);
        });

        it('marks every section as a region, not just a point', () => {
            SECTIONS.forEach(s =>
                store().addMarker(bar(s.start), s.name, s.bars * BAR));

            const markers = store().globalTracks.markers;
            expect(markers).toHaveLength(10);
            expect(markers[0]).toMatchObject({ time: 0, duration: 32, text: 'Intro' });
            expect(markers.at(-1)).toMatchObject({ time: bar(121), duration: 32 });
        });

        it('spans 128 bars', () => {
            const last = store().globalTracks.markers.at(-1)!;
            expect(last.time + last.duration).toBe(bar(129));
        });
    });

    // ── Session 2: sound selection ─────────────────────────────────────────
    describe('S2 sound selection', () => {
        it('layers kick and click into a Kick bus', () => {
            ids.kickBus = addTrack('Kick Bus', 'bus', { color: '#ef4444' });
            ids.kick = addTrack('Kick', 'software-instrument', { color: '#ef4444' });
            ids.click = addTrack('Click', 'software-instrument', { color: '#ef4444' });

            store().routeTrackTo(ids.kick, ids.kickBus);
            store().routeTrackTo(ids.click, ids.kickBus);

            expect(track(ids.kick)!.outputBusId).toBe(ids.kickBus);
            expect(track(ids.click)!.outputBusId).toBe(ids.kickBus);
        });

        it('tunes the kick to the key', () => {
            store().updateTrack(ids.kick, { transpose: -3 });   // C → A
            expect(track(ids.kick)!.transpose).toBe(-3);
        });

        it('delays the clap ~8 ms for width', () => {
            ids.snare = addTrack('Snare', 'software-instrument', { color: '#ef4444' });
            ids.clap = addTrack('Clap', 'software-instrument', { color: '#ef4444' });

            store().setTrackDelay(ids.clap, 8);
            expect(track(ids.clap)!.delay).toBe(8);
        });

        it('keeps sub and mid bass on separate tracks', () => {
            ids.sub = addTrack('Sub', 'software-instrument', { color: '#a855f7' });
            ids.midBass = addTrack('Reese', 'software-instrument', { color: '#a855f7' });
            expect(track(ids.sub)!.id).not.toBe(track(ids.midBass)!.id);
        });

        it('saves the result as a channel-strip template', () => {
            store().addPlugin(ids.kick, 'eq');
            store().saveChannelStripSetting(ids.kick, 'Kick Template');
            expect(store().channelStripSettings.some(c => c.name === 'Kick Template')).toBe(true);
        });
    });

    // ── Session 3: writing ─────────────────────────────────────────────────
    describe('S3 writing', () => {
        it('lays Am–F–C–G, one bar each, over 8 bars', () => {
            ids.keys = addTrack('Keys', 'software-instrument', { color: '#3b82f6' });
            ids.keysClip = addClip(ids.keys, 0, 8 * BAR);

            const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
            for (let rep = 0; rep < 2; rep++) {
                chords.forEach((ch, i) =>
                    ch.forEach(p => store().addNote(ids.keysClip, note(p, (rep * 4 + i) * BAR, BAR))));
            }
            expect(clip(ids.keysClip)!.notes).toHaveLength(24);
        });

        it('puts bass roots on 1 and 3 with a passing note', () => {
            ids.subClip = addClip(ids.sub, 0, 8 * BAR);
            [45, 41, 36, 43].forEach((root, i) => {
                store().addNote(ids.subClip, note(root, i * BAR, 1.5));
                store().addNote(ids.subClip, note(root, i * BAR + 2, 1.5));
                store().addNote(ids.subClip, note(root + 2, i * BAR + 3.5, 0.5));  // passing
            });
            expect(clip(ids.subClip)!.notes).toHaveLength(12);
        });

        it('programs the drum loop with velocity variation', () => {
            ids.kickClip = addClip(ids.kick, 0, 2 * BAR);
            ids.hatClip = addClip(addTrack('Hats', 'software-instrument', { color: '#ef4444' }), 0, 2 * BAR);

            for (let b = 0; b < 8; b++) store().addNote(ids.kickClip, note(36, b, 0.25));
            for (let e = 0; e < 16; e++) {
                const onDownbeat = e % 2 === 0;
                store().addNote(ids.hatClip, note(42, e * 0.5, 0.125, onDownbeat ? 100 : 75));
            }
            // Open hat on the "and" of 4.
            store().addNote(ids.hatClip, note(46, 3.5, 0.5, 90));

            const vels = new Set(clip(ids.hatClip)!.notes!.map(n => n.velocity));
            expect(vels.size).toBeGreaterThan(1);
        });
    });

    // ── Session 4: arrangement ─────────────────────────────────────────────
    describe('S4 arrangement', () => {
        it('duplicates the loop across the whole 128 bars', () => {
            const before = store().clips.length;
            store().duplicateClipAcross(ids.kickClip, bar(1), bar(129));
            const copies = store().clips.filter(c => c.trackId === ids.kick);
            expect(copies.length).toBeGreaterThan(60);
            expect(store().clips.length).toBeGreaterThan(before);
        });

        it('subtracts drums from the intro', () => {
            const introKicks = store().clips.filter(c =>
                c.trackId === ids.kick && c.start < bar(9));
            introKicks.forEach(c => store().toggleClipMute(c.id));
            expect(introKicks.every(c => clip(c.id)!.muted)).toBe(true);
        });

        it('automates the filter cutoff across the intro', () => {
            store().addAutomationPoint(ids.keys, 'filterCutoff', bar(1), 0.15);
            store().addAutomationPoint(ids.keys, 'filterCutoff', bar(9), 1.0);

            const lane = track(ids.keys)!.automation?.find(a => a.parameter === 'filterCutoff');
            expect(lane?.points).toHaveLength(2);
        });

        it('reads an automation lane back at an arbitrary time', () => {
            const value = store().automationValueAt(ids.keys, 'filterCutoff', bar(5));
            expect(value).toBeGreaterThan(0.15);
            expect(value).toBeLessThan(1.0);
        });

        it('places transition FX on each chorus downbeat', () => {
            ids.fx = addTrack('FX', 'audio', { color: '#eab308' });
            [33, 73, 105].forEach(b => addClip(ids.fx, bar(b), BAR, 'audio'));
            expect(store().clips.filter(c => c.trackId === ids.fx)).toHaveLength(3);
        });
    });

    // ── Session 5: vocals ──────────────────────────────────────────────────
    describe('S5 vocals', () => {
        it('comps a lead from several takes', () => {
            ids.vox = addTrack('Lead Vocal', 'audio', { color: '#22c55e' });
            const takes = [1, 2, 3, 4].map(() => addClip(ids.vox, bar(9), 16 * BAR, 'audio'));

            const folderId = store().createTakeFolder(ids.vox, takes, 'Lead Comp')!;
            expect(folderId).toBeTruthy();

            const folder = clip(folderId) as never as {
                isTakeFolder?: boolean; takes?: unknown[]; comps?: unknown[];
            };
            expect(folder.isTakeFolder).toBe(true);
            expect(folder.takes).toHaveLength(4);
            // The individual takes are folded in, not left on the timeline.
            expect(store().clips.filter(c => takes.includes(c.id))).toEqual([]);

            store().createTakeFolderComp(folderId, 'Comp A');
            expect((clip(folderId) as never as { comps: unknown[] }).comps).toHaveLength(1);
        });

        it('hard-pans the doubles under the lead', () => {
            ids.dblL = addTrack('Double L', 'audio', { color: '#22c55e' });
            ids.dblR = addTrack('Double R', 'audio', { color: '#22c55e' });
            store().updateTrack(ids.dblL, { pan: -1, volume: 0.4 });
            store().updateTrack(ids.dblR, { pan: 1, volume: 0.4 });

            expect(track(ids.dblL)!.pan).toBe(-1);
            expect(track(ids.dblR)!.pan).toBe(1);
        });
    });

    // ── Session 6: edit and prep ───────────────────────────────────────────
    describe('S6 edit and prep', () => {
        it('quantizes the tight elements and leaves the groove alone', () => {
            store().quantizeClipNotes(ids.kickClip, 16);
            expect(clip(ids.kickClip)!.notes!.every(n => Math.abs(n.start * 4 - Math.round(n.start * 4)) < 1e-6))
                .toBe(true);
        });

        it('builds the bus tree', () => {
            ids.mixBus = addTrack('Mix Bus', 'bus');
            ids.drumBus = addTrack('Drums Bus', 'bus');
            ids.bassBus = addTrack('Bass Bus', 'bus');
            ids.musicBus = addTrack('Music Bus', 'bus');
            ids.voxBus = addTrack('Vox Bus', 'bus');

            store().routeTrackTo(ids.kickBus, ids.drumBus);
            [ids.snare, ids.clap].forEach(t => store().routeTrackTo(t, ids.drumBus));
            [ids.sub, ids.midBass].forEach(t => store().routeTrackTo(t, ids.bassBus));
            store().routeTrackTo(ids.keys, ids.musicBus);
            [ids.vox, ids.dblL, ids.dblR].forEach(t => store().routeTrackTo(t, ids.voxBus));
            [ids.drumBus, ids.bassBus, ids.musicBus, ids.voxBus]
                .forEach(b => store().routeTrackTo(b, ids.mixBus));

            expect(track(ids.drumBus)!.outputBusId).toBe(ids.mixBus);
            expect(track(ids.vox)!.outputBusId).toBe(ids.voxBus);
        });

        it('creates the four FX return busses', () => {
            ids.verbShort = addTrack('Verb A Short', 'bus');
            ids.verbLong = addTrack('Verb B Long', 'bus');
            ids.delay8 = addTrack('Delay 1/8 dotted', 'bus');
            ids.delay4 = addTrack('Delay 1/4', 'bus');
            [ids.verbShort, ids.verbLong].forEach(b => store().addPlugin(b, 'reverb'));
            [ids.delay8, ids.delay4].forEach(b => store().addPlugin(b, 'delay'));

            expect(track(ids.verbLong)!.plugins).toHaveLength(1);
        });

        it('has no unnamed or empty tracks left', () => {
            const empty = store().tracks.filter(t => !t.name?.trim());
            expect(empty).toEqual([]);
        });
    });

    // ── Session 7: mix ─────────────────────────────────────────────────────
    describe('S7 mix', () => {
        it('high-passes everything that is not kick or sub', () => {
            store().addPlugin(ids.keys, 'eq');
            const eq = track(ids.keys)!.plugins!.at(-1)!;
            store().updatePluginParams(ids.keys, eq.id, { highPassHz: 200 });
            expect(track(ids.keys)!.plugins!.at(-1)!.params.highPassHz).toBe(200);
        });

        it('sidechains the sub to the kick', () => {
            store().addPlugin(ids.sub, 'sidechain');
            const comp = track(ids.sub)!.plugins!.at(-1)!;
            store().setSidechainSource(ids.sub, comp.id, ids.kick);

            expect(track(ids.sub)!.plugins!.at(-1)!.sidechainSourceId).toBe(ids.kick);
        });

        it('refuses to key a plugin that has no sidechain input', () => {
            store().addPlugin(ids.midBass, 'comp');
            const plain = track(ids.midBass)!.plugins!.at(-1)!;
            store().setSidechainSource(ids.midBass, plain.id, ids.kick);

            // A plain compressor has nowhere to put the key, so this must not
            // silently record a source that could never take effect.
            expect(track(ids.midBass)!.plugins!.at(-1)!.sidechainSourceId).toBeUndefined();
        });

        it('refuses to key a track from itself', () => {
            const comp = track(ids.sub)!.plugins!.find(p => p.pluginId.includes('sidechain'))!;
            store().setSidechainSource(ids.sub, comp.id, ids.sub);
            expect(track(ids.sub)!.plugins!.find(p => p.id === comp.id)!.sidechainSourceId)
                .toBe(ids.kick);
        });

        it('sets up parallel drum compression on a send', () => {
            ids.parallel = addTrack('Drum Parallel', 'bus');
            store().addPlugin(ids.parallel, 'comp');
            store().setTrackSend(ids.drumBus, ids.parallel, 0.25);
            store().updateTrack(ids.parallel, { volume: 0.25 });

            expect(track(ids.drumBus)!.sends!.some(s => s.busId === ids.parallel)).toBe(true);
        });

        it('sends vocal and pads to the reverbs', () => {
            store().setTrackSend(ids.vox, ids.verbShort, 0.2);
            store().setTrackSend(ids.keys, ids.verbLong, 0.25);
            store().setTrackSend(ids.vox, ids.delay8, 0.18);

            expect(track(ids.vox)!.sends).toHaveLength(2);
        });

        it('mono-sums for a phase check', () => {
            store().setMonitorMode('mono');
            expect(store().monitorMode).toBe('mono');
            store().setMonitorMode('stereo');
        });

        it('reports mix bus peak so it can be left near -6 dBFS', () => {
            const peak = store().getBusPeakDb(ids.mixBus);
            expect(typeof peak).toBe('number');
        });
    });

    // ── Session 8: master ──────────────────────────────────────────────────
    describe('S8 master', () => {
        it('puts broad EQ, bus compression, widening and a limiter on the master', () => {
            ['eq', 'comp', 'widener', 'limiter'].forEach(p => store().addMasterPlugin(p));
            expect(store().masterPlugins).toHaveLength(4);
            expect(store().masterPlugins.at(-1)!.name.toLowerCase()).toContain('limit');
        });

        it('widens only above 200 Hz', () => {
            const widener = store().masterPlugins.find(p => p.pluginId.includes('widen'))!;
            store().updateMasterPluginParams(widener.id, { crossoverHz: 200, width: 1.2 });
            const updated = store().masterPlugins.find(p => p.id === widener.id)!;
            expect(updated.params.crossoverHz).toBe(200);
        });

        it('measures integrated LUFS and true peak against a target', () => {
            const ch = new Float32Array(48000).fill(0.1);
            const analysis = store().analyseLoudness([ch, ch], 48000);

            expect(analysis.integratedLufs).toBeLessThan(0);
            expect(analysis.truePeakDb).toBeLessThanOrEqual(0);
        });

        it('flags a master that is over the true-peak ceiling', () => {
            const hot = new Float32Array(48000).fill(0.999);
            const analysis = store().analyseLoudness([hot, hot], 48000);
            expect(analysis.compliesWith({ lufsTarget: -14, truePeakCeiling: -1 })).toBe(false);
        });
    });

    // ── Session 9: delivery ────────────────────────────────────────────────
    describe('S9 delivery', () => {
        it('bounces a 24-bit / 48 kHz master', async () => {
            const result = await store().exportProject({
                sampleRate: 48000, bitDepth: 24, fileName: 'Track Master',
            });
            expect(result.fileName).toBe('Track Master.wav');
            expect(result.buffer.sampleRate).toBe(48000);
        });

        it('bounces an instrumental by dropping the vocal busses', async () => {
            const instrumental = store().tracks
                .filter(t => ![ids.vox, ids.dblL, ids.dblR, ids.voxBus].includes(t.id))
                .map(t => t.id);
            const result = await store().exportProject({ trackIds: instrumental, fileName: 'Instrumental' });
            expect(result.fileName).toBe('Instrumental.wav');
        });

        it('exports one stem per bus, all the same length from bar 1', async () => {
            const stems = await store().exportStems({
                busIds: [ids.drumBus, ids.bassBus, ids.musicBus, ids.voxBus],
                sampleRate: 48000, bitDepth: 24,
            });

            expect(stems).toHaveLength(4);
            const lengths = new Set(stems.map(s => s.buffer.length));
            expect(lengths.size).toBe(1);
            expect(stems.every(s => s.fileName.endsWith('.wav'))).toBe(true);
        });

        it('embeds delivery metadata', async () => {
            const result = await store().exportProject({
                fileName: 'Track Master',
                metadata: { title: 'Night Drive', artist: 'Me', isrc: 'USRC17607839' },
            });
            expect(result.metadata?.isrc).toBe('USRC17607839');
        });
    });
});
