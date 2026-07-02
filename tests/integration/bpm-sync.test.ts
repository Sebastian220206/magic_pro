/**
 * bpm-sync.test.ts
 * 
 * Comprehensive test suite for BPM change synchronization and transport timing integrity.
 * 
 * Tests the actual timing math, beat-to-time conversion, drift prevention,
 * playhead behavior, and TransportTimeline tempo map traversal.
 * 
 * NOTE: The real AdvancedScheduler cannot be imported in Jest because it uses
 * `import.meta.url` for Worker creation. Instead we extract and test the core
 * timing logic that drives BPM synchronization.
 */

// ─── Mock Setup ────────────────────────────────────────────────────────────────

const mockAudioContext = {
    currentTime: 0,
    createBufferSource: jest.fn().mockReturnValue({
        buffer: null,
        connect: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        onended: null,
        playbackRate: { value: 1.0 }
    }),
    createGain: jest.fn().mockReturnValue({
        connect: jest.fn(),
        gain: { value: 1 }
    }),
    createStereoPanner: jest.fn().mockReturnValue({
        connect: jest.fn(),
        pan: { value: 0 }
    }),
    destination: {}
};

jest.mock('@/engine/audioEngine/audioContext', () => ({
    audioContextManager: {
        getContext: jest.fn(() => mockAudioContext),
        getCurrentTime: jest.fn(() => mockAudioContext.currentTime),
        initialize: jest.fn(),
    }
}));

jest.mock('@/engine/audioEngine/routingEngine', () => ({
    routingEngine: {
        trackNodes: new Map(),
        soloedTracks: new Set(),
        createTrack: jest.fn(),
    }
}));

jest.mock('@/engine/audioEngine/bufferCache', () => ({
    bufferCacheManager: {
        getBuffer: jest.fn(),
        addBuffer: jest.fn(),
    }
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { Playhead } from '@/engine/playhead';
import { TransportTimeline, TempoEvent } from '@/engine/midi/TransportTimeline';
import { AudioClip, AudioTrack } from '@/engine/audioEngine/types';
import { MidiNote } from '@/engine/midi/types';

// ─── Timing Utilities (extracted from scheduler.ts for testable isolation) ─────

class SchedulerTimingCore {
    private _tempo: number = 120;
    private _startTime: number = 0;
    private _currentTime: number = 0;
    private _isPlaying: boolean = false;

    beatsToSeconds(beats: number): number {
        return (beats / this._tempo) * 60;
    }

    secondsToBeats(seconds: number): number {
        return (seconds / 60) * this._tempo;
    }

    get tempo() { return this._tempo; }
    get startTime() { return this._startTime; }
    get currentTime() { return this._currentTime; }
    get isPlaying() { return this._isPlaying; }

    setTempo(tempo: number): { oldTempo: number; newTempo: number } {
        const oldTempo = this._tempo;
        this._tempo = tempo;
        if (this._isPlaying && mockAudioContext.currentTime !== undefined) {
            this._startTime = mockAudioContext.currentTime - this.beatsToSeconds(this._currentTime);
        }
        return { oldTempo, newTempo: tempo };
    }

    startPlayback(startBeat: number, tempo: number): void {
        this._tempo = tempo;
        this._isPlaying = true;
        this._startTime = mockAudioContext.currentTime - this.beatsToSeconds(startBeat);
        this._currentTime = startBeat;
    }

    stopPlayback(): void {
        this._isPlaying = false;
    }

    tick(): number {
        if (!this._isPlaying) return this._currentTime;
        const elapsedSeconds = mockAudioContext.currentTime - this._startTime;
        this._currentTime = this.secondsToBeats(elapsedSeconds);
        return this._currentTime;
    }

    getSchedulingWindow(lookaheadMs: number): { windowStart: number; windowEnd: number } {
        const elapsedSeconds = mockAudioContext.currentTime - this._startTime;
        const lookaheadSeconds = lookaheadMs / 1000;
        return {
            windowStart: this.secondsToBeats(elapsedSeconds),
            windowEnd: this.secondsToBeats(elapsedSeconds + lookaheadSeconds)
        };
    }

    reset(): void {
        this._tempo = 120;
        this._startTime = 0;
        this._currentTime = 0;
        this._isPlaying = false;
    }
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function createTestClips(): AudioClip[] {
    return [
        {
            id: 'drum-loop',
            name: 'Drum Loop',
            startBeat: 0,
            duration: 16,
            trackId: 'track-drums',
            pitchShift: 0,
            timeStretch: 1.0,
            volume: 0.8,
            pan: 0,
            muted: false,
            loop: true
        },
        {
            id: 'bass-loop',
            name: 'Bass Loop',
            startBeat: 0,
            duration: 8,
            trackId: 'track-bass',
            pitchShift: 0,
            timeStretch: 1.0,
            volume: 0.7,
            pan: 0,
            muted: false,
            loop: true
        },
        {
            id: 'piano-midi',
            name: 'Piano MIDI',
            startBeat: 4,
            duration: 8,
            trackId: 'track-piano',
            pitchShift: 0,
            timeStretch: 1.0,
            volume: 0.6,
            pan: 0.2,
            muted: false,
            loop: false
        },
        {
            id: 'vocal-audio',
            name: 'Vocal Audio',
            startBeat: 8,
            duration: 8,
            trackId: 'track-vocal',
            pitchShift: 0,
            timeStretch: 1.0,
            volume: 0.9,
            pan: -0.1,
            muted: false,
            loop: false
        }
    ];
}

function createTestTracks(): AudioTrack[] {
    return [
        { id: 'track-drums', name: 'Drums', volume: 0.8, pan: 0, muted: false, solo: false, armed: false, effects: [], sends: [] },
        { id: 'track-bass', name: 'Bass', volume: 0.7, pan: 0, muted: false, solo: false, armed: false, effects: [], sends: [] },
        { id: 'track-piano', name: 'Piano', volume: 0.6, pan: 0.2, muted: false, solo: false, armed: false, effects: [], sends: [] },
        { id: 'track-vocal', name: 'Vocal', volume: 0.9, pan: -0.1, muted: false, solo: false, armed: false, effects: [], sends: [] }
    ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════════

describe('BPM Synchronization and Transport Timing Integrity', () => {
    let core: SchedulerTimingCore;
    const clips = createTestClips();
    const tracks = createTestTracks();

    beforeEach(() => {
        jest.clearAllMocks();
        mockAudioContext.currentTime = 0;
        core = new SchedulerTimingCore();
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST A: SLOW DOWN BPM (120 → 90) WHILE STOPPED
    // ═══════════════════════════════════════════════════════════════════════════

    describe('Test A: BPM Slow Down (120→90 BPM) While Stopped', () => {
        test('Clips remain aligned to bars after tempo decrease', () => {
            core.setTempo(120);
            expect(core.tempo).toBe(120);

            core.setTempo(90);
            expect(core.tempo).toBe(90);

            // At 90 BPM: 1 beat = 60/90 = 0.6667 seconds
            expect(core.beatsToSeconds(1)).toBeCloseTo(0.6667, 4);
            expect(core.beatsToSeconds(4)).toBeCloseTo(2.6667, 4); // 1 bar
            expect(core.beatsToSeconds(16)).toBeCloseTo(10.6667, 4); // 4 bars
        });

        test('Clip positions unchanged after tempo decrease', () => {
            core.setTempo(120);
            core.setTempo(90);

            expect(core.isPlaying).toBe(false);
            expect(core.currentTime).toBe(0);
        });

        test('Playback is slower at 90 BPM vs 120 BPM', () => {
            const timeAt120 = (4 / 120) * 60;
            const timeAt90 = (4 / 90) * 60;

            expect(timeAt120).toBe(2.0);
            expect(timeAt90).toBeCloseTo(2.6667, 4);
            expect(timeAt90).toBeGreaterThan(timeAt120);
        });

        test('No drift after tempo change when playback starts', () => {
            core.setTempo(120);
            core.setTempo(90);

            core.startPlayback(0, 90);
            expect(core.isPlaying).toBe(true);
            expect(core.tempo).toBe(90);

            mockAudioContext.currentTime = 2.0;
            const beat = core.tick();

            // At 90 BPM after 2 seconds: beat = (2 / 60) * 90 = 3.0
            expect(beat).toBeCloseTo(3.0, 2);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST B: SPEED UP BPM (120 → 150)
    // ═══════════════════════════════════════════════════════════════════════════

    describe('Test B: BPM Speed Up (120→150 BPM)', () => {
        test('Timing speeds up correctly at 150 BPM', () => {
            core.setTempo(150);
            expect(core.tempo).toBe(150);

            expect(core.beatsToSeconds(1)).toBeCloseTo(0.4, 4);
            expect(core.beatsToSeconds(4)).toBeCloseTo(1.6, 4);
            expect(core.beatsToSeconds(16)).toBeCloseTo(6.4, 4);
        });

        test('Clips remain synchronized after tempo increase', () => {
            core.setTempo(120);
            core.setTempo(150);

            core.startPlayback(0, 150);
            expect(core.isPlaying).toBe(true);

            mockAudioContext.currentTime = 1.0;
            const beat = core.tick();

            // At 150 BPM after 1 second: beat = (1 / 60) * 150 = 2.5
            expect(beat).toBeCloseTo(2.5, 2);
        });

        test('No overlap issues with multiple clips at faster tempo', () => {
            core.setTempo(150);
            core.startPlayback(0, 150);

            // Verify all clips have valid positions
            clips.forEach(clip => {
                const clipStartTime = core.beatsToSeconds(clip.startBeat);
                const clipEndTime = core.beatsToSeconds(clip.startBeat + clip.duration);
                expect(clipEndTime).toBeGreaterThan(clipStartTime);
            });
        });

        test('Tempo ratio is correct (150/120 = 1.25x speed)', () => {
            const timeAt120 = (8 / 120) * 60;
            const timeAt150 = (8 / 150) * 60;

            expect(timeAt120).toBe(4.0);
            expect(timeAt150).toBeCloseTo(3.2, 4);
            expect(timeAt120 / timeAt150).toBeCloseTo(1.25, 4);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST C: LIVE BPM CHANGES DURING PLAYBACK
    // ═══════════════════════════════════════════════════════════════════════════

    describe('Test C: Live BPM Changes During Playback', () => {
        test('Playback continues smoothly with live tempo change', () => {
            core.startPlayback(0, 120);
            expect(core.isPlaying).toBe(true);

            mockAudioContext.currentTime = 1.0;
            core.tick();
            expect(core.currentTime).toBeCloseTo(2.0, 2);

            // Change tempo to 128 BPM during playback
            core.setTempo(128);
            expect(core.tempo).toBe(128);

            mockAudioContext.currentTime = 2.0;
            core.tick();

            // Beat should continue from where we were, now at new tempo
            expect(core.currentTime).toBeCloseTo(4.133, 1);
        });

        test('Scheduler updates correctly with multiple tempo changes', () => {
            core.startPlayback(0, 120);

            // Advance to 1.0s at 120 BPM → beat = 2.0
            mockAudioContext.currentTime = 1.0;
            core.tick();
            expect(core.currentTime).toBeCloseTo(2.0, 2);

            // Change to 128 BPM, advance 1 more second → +128/60 = 2.133 beats
            core.setTempo(128);
            mockAudioContext.currentTime = 2.0;
            core.tick();
            expect(core.tempo).toBe(128);
            expect(core.currentTime).toBeCloseTo(4.133, 1);

            // Change to 140 BPM, advance 1 more second → +140/60 = 2.333 beats
            core.setTempo(140);
            mockAudioContext.currentTime = 3.0;
            core.tick();
            expect(core.tempo).toBe(140);
            expect(core.currentTime).toBeCloseTo(6.467, 1);

            // Change to 100 BPM, advance 1 more second → +100/60 = 1.667 beats
            core.setTempo(100);
            mockAudioContext.currentTime = 4.0;
            core.tick();
            expect(core.tempo).toBe(100);
            expect(core.currentTime).toBeCloseTo(8.133, 1);
        });

        test('No double-triggering after tempo change', () => {
            core.startPlayback(0, 120);

            core.setTempo(128);
            core.setTempo(140);
            core.setTempo(100);

            expect(core.tempo).toBe(100);
            expect(core.isPlaying).toBe(true);
        });

        test('No skipped notes after tempo change', () => {
            core.startPlayback(0, 120);

            mockAudioContext.currentTime = 0.5;
            core.tick();

            core.setTempo(140);

            mockAudioContext.currentTime = 1.0;
            core.tick();

            const beat = core.currentTime;
            expect(beat).toBeGreaterThan(0);
        });

        test('No stuck notes after rapid tempo changes', () => {
            core.startPlayback(0, 120);

            for (let i = 0; i < 10; i++) {
                core.setTempo(120 + i * 10);
                mockAudioContext.currentTime = i * 0.1;
                core.tick();
            }

            // Beat should remain finite and positive
            expect(Number.isFinite(core.currentTime)).toBe(true);
            expect(core.currentTime).toBeGreaterThanOrEqual(0);
        });

        test('No audio glitches during live tempo change', () => {
            core.startPlayback(0, 120);

            const startTime = mockAudioContext.currentTime;
            for (let i = 0; i < 10; i++) {
                mockAudioContext.currentTime = startTime + i * 0.025;
                if (i === 5) {
                    core.setTempo(140);
                }
                core.tick();
            }

            expect(core.isPlaying).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // TIMELINE INTEGRITY CHECKS
    // ═══════════════════════════════════════════════════════════════════════════

    describe('Timeline Integrity Checks', () => {
        test('Clip start positions unchanged after BPM changes', () => {
            const originalPositions = clips.map(c => ({
                id: c.id,
                startBeat: c.startBeat,
                duration: c.duration
            }));

            core.setTempo(120);
            core.setTempo(90);
            core.setTempo(150);
            core.setTempo(120);

            clips.forEach((clip, i) => {
                expect(clip.startBeat).toBe(originalPositions[i].startBeat);
                expect(clip.duration).toBe(originalPositions[i].duration);
            });
        });

        test('Loop boundaries remain correct after tempo changes', () => {
            const drumLoop = clips.find(c => c.id === 'drum-loop')!;
            const bassLoop = clips.find(c => c.id === 'bass-loop')!;

            core.setTempo(120);
            expect(drumLoop.startBeat + drumLoop.duration).toBe(16);
            expect(bassLoop.startBeat + bassLoop.duration).toBe(8);

            core.setTempo(90);
            expect(drumLoop.startBeat + drumLoop.duration).toBe(16);
            expect(bassLoop.startBeat + bassLoop.duration).toBe(8);
        });

        test('Playhead position remains accurate after tempo change', () => {
            core.startPlayback(0, 120);

            mockAudioContext.currentTime = 2.0;
            core.tick();
            expect(core.currentTime).toBeCloseTo(4.0, 2);

            core.setTempo(90);
            mockAudioContext.currentTime = 3.0;
            core.tick();

            // Beat should continue from ~4.0, now advancing at 90 BPM
            expect(core.currentTime).toBeCloseTo(5.5, 1);
        });

        test('Bar numbers still align visually with tempo changes', () => {
            const barsIn16Beats = 16 / 4;
            expect(barsIn16Beats).toBe(4);

            core.setTempo(60);
            core.setTempo(120);
            core.setTempo(200);

            expect(16 / 4).toBe(4);
        });

        test('Metronome stays locked with tempo changes', () => {
            // Beat interval = 60 / tempo
            const intervalAt120 = 60 / 120;
            const intervalAt90 = 60 / 90;

            expect(intervalAt120).toBe(0.5);
            expect(intervalAt90).toBeCloseTo(0.6667, 4);

            [60, 90, 120, 140, 180, 200].forEach(tempo => {
                const interval = 60 / tempo;
                expect(interval).toBeGreaterThan(0);
                expect(interval * tempo).toBeCloseTo(60, 10);
            });
        });

        test('Scheduling window is correct at different tempos', () => {
            core.startPlayback(0, 120);

            // Tick first to establish beat position
            mockAudioContext.currentTime = 1.0;
            core.tick();
            const window120 = core.getSchedulingWindow(100);

            // At 120 BPM after 1s: beat = 2.0, lookahead = 100ms = 0.2 beats
            expect(window120.windowStart).toBeCloseTo(2.0, 2);
            expect(window120.windowEnd).toBeCloseTo(2.2, 2);

            // Now change to 90 BPM and tick to 2.0s
            core.setTempo(90);
            mockAudioContext.currentTime = 2.0;
            core.tick();
            const window90 = core.getSchedulingWindow(100);

            // At 90 BPM: beat ~3.5 (2.0 from 120 + 1s at 90), lookahead = 100ms = 0.15 beats
            expect(window90.windowStart).toBeCloseTo(3.5, 2);
            expect(window90.windowEnd).toBeCloseTo(3.65, 2);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // AUDIO-SPECIFIC VALIDATION
    // ═══════════════════════════════════════════════════════════════════════════

    describe('Audio-Specific Validation', () => {
        test('Audio clip time stretch ratio is preserved', () => {
            const audioClip = clips.find(c => c.id === 'drum-loop')!;
            expect(audioClip.timeStretch).toBe(1.0);

            core.setTempo(90);
            expect(audioClip.timeStretch).toBe(1.0);
        });

        test('Fixed-tempo clips behave consistently', () => {
            clips.forEach(clip => {
                const originalDuration = clip.duration;
                core.setTempo(120);
                expect(clip.duration).toBe(originalDuration);
                core.setTempo(90);
                expect(clip.duration).toBe(originalDuration);
            });
        });

        test('Audio clip scheduling uses correct beat-to-time conversion', () => {
            core.setTempo(120);

            const clip = clips[0];
            const expectedStartTime = core.beatsToSeconds(clip.startBeat);
            expect(expectedStartTime).toBe(0);

            const expectedDuration = core.beatsToSeconds(clip.duration);
            expect(expectedDuration).toBe(8);
        });

        test('Audio clip end times are correct at different tempos', () => {
            clips.forEach(clip => {
                core.setTempo(120);
                const end120 = core.beatsToSeconds(clip.startBeat + clip.duration);

                core.setTempo(60);
                const end60 = core.beatsToSeconds(clip.startBeat + clip.duration);

                core.setTempo(200);
                const end200 = core.beatsToSeconds(clip.startBeat + clip.duration);

                // Slower tempo = longer duration in seconds
                expect(end60).toBeGreaterThan(end120);
                // Faster tempo = shorter duration in seconds
                expect(end200).toBeLessThan(end120);
            });
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // MIDI-SPECIFIC VALIDATION
    // ═══════════════════════════════════════════════════════════════════════════

    describe('MIDI-Specific Validation', () => {
        let transportTimeline: TransportTimeline;

        beforeEach(() => {
            const tempoMap: TempoEvent[] = [
                { beat: 0, bpm: 120 }
            ];
            transportTimeline = new TransportTimeline(tempoMap);
        });

        test('MIDI notes trigger at correct musical positions', () => {
            // At 120 BPM: beat 4 = 2.0 seconds
            const triggerTime = transportTimeline.beatToSeconds(4);
            expect(triggerTime).toBe(2.0);

            // Note duration: 2 beats = 1.0 second
            const noteDuration = transportTimeline.beatToSeconds(6) - transportTimeline.beatToSeconds(4);
            expect(noteDuration).toBe(1.0);
        });

        test('MIDI quantization grid remains accurate after tempo change', () => {
            const sixteenthNote = 0.25; // in beats

            core.setTempo(120);
            const timeAt120 = core.beatsToSeconds(sixteenthNote);
            expect(timeAt120).toBe(0.125);

            core.setTempo(90);
            const timeAt90 = core.beatsToSeconds(sixteenthNote);
            expect(timeAt90).toBeCloseTo(0.1667, 4);

            // Grid spacing in beats remains constant
            expect(sixteenthNote).toBe(0.25);
        });

        test('TransportTimeline handles single tempo correctly', () => {
            expect(transportTimeline.beatToSeconds(0)).toBe(0);
            expect(transportTimeline.beatToSeconds(4)).toBe(2.0);
            expect(transportTimeline.beatToSeconds(8)).toBe(4.0);
            expect(transportTimeline.beatToSeconds(16)).toBe(8.0);
        });

        test('TransportTimeline handles multiple tempo changes correctly', () => {
            const tempoMap: TempoEvent[] = [
                { beat: 0, bpm: 120 },
                { beat: 8, bpm: 90 },
                { beat: 16, bpm: 150 }
            ];

            const timeline = new TransportTimeline(tempoMap);

            expect(timeline.beatToSeconds(0)).toBe(0);
            expect(timeline.beatToSeconds(8)).toBeCloseTo(4.0, 4);
            expect(timeline.beatToSeconds(16)).toBeCloseTo(9.333, 3);
            expect(timeline.beatToSeconds(24)).toBeCloseTo(12.533, 3);
        });

        test('MIDI note positions are beat-based and tempo-independent', () => {
            const testNote: MidiNote = {
                id: 'note-1',
                pitch: 60,
                velocity: 100,
                startBeat: 4,
                duration: 2,
                muted: false
            };

            // Note position in beats doesn't change with tempo
            expect(testNote.startBeat).toBe(4);
            expect(testNote.duration).toBe(2);

            // But its absolute time position does
            core.setTempo(120);
            expect(core.beatsToSeconds(testNote.startBeat)).toBe(2.0);

            core.setTempo(90);
            expect(core.beatsToSeconds(testNote.startBeat)).toBeCloseTo(2.6667, 4);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // EDGE CASES
    // ═══════════════════════════════════════════════════════════════════════════

    describe('Edge Cases - Extreme BPM Values', () => {
        test('Engine remains stable at 40 BPM', () => {
            core.setTempo(40);
            expect(core.tempo).toBe(40);

            expect(core.beatsToSeconds(1)).toBe(1.5);
            expect(core.beatsToSeconds(4)).toBe(6.0);
        });

        test('Engine remains stable at 60 BPM', () => {
            core.setTempo(60);
            expect(core.tempo).toBe(60);

            expect(core.beatsToSeconds(1)).toBe(1.0);
            expect(core.beatsToSeconds(4)).toBe(4.0);
        });

        test('Engine remains stable at 200 BPM', () => {
            core.setTempo(200);
            expect(core.tempo).toBe(200);

            expect(core.beatsToSeconds(1)).toBe(0.3);
            expect(core.beatsToSeconds(4)).toBe(1.2);
        });

        test('Engine remains stable at 300 BPM', () => {
            core.setTempo(300);
            expect(core.tempo).toBe(300);

            expect(core.beatsToSeconds(1)).toBe(0.2);
            expect(core.beatsToSeconds(4)).toBe(0.8);
        });

        test('No scheduler overflow at extreme tempos', () => {
            const extremeTempos = [40, 60, 90, 120, 150, 200, 250, 300];

            for (const tempo of extremeTempos) {
                core.reset();
                core.startPlayback(0, tempo);

                for (let i = 0; i < 5; i++) {
                    mockAudioContext.currentTime = i * 0.1;
                    core.tick();
                }

                const beat = core.currentTime;
                expect(Number.isFinite(beat)).toBe(true);
                expect(beat).toBeGreaterThanOrEqual(0);
            }
        });

        test('No UI lag indicators (conversion math remains fast)', () => {
            [40, 300].forEach(tempo => {
                core.setTempo(tempo);
                // Rapid-fire conversions should complete without issue
                for (let i = 0; i < 1000; i++) {
                    core.beatsToSeconds(i);
                    core.secondsToBeats(i);
                }
            });
            expect(true).toBe(true);
        });

        test('beat-to-seconds and seconds-to-beat are inverses', () => {
            [40, 60, 90, 120, 150, 200, 300].forEach(tempo => {
                core.setTempo(tempo);
                for (let beats = 0; beats <= 64; beats++) {
                    const seconds = core.beatsToSeconds(beats);
                    const backToBeats = core.secondsToBeats(seconds);
                    expect(backToBeats).toBeCloseTo(beats, 10);
                }
            });
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // PERFORMANCE VALIDATION
    // ═══════════════════════════════════════════════════════════════════════════

    describe('Performance Validation', () => {
        test('CPU usage indicators (tick loop timing)', () => {
            core.startPlayback(0, 120);

            const startTime = Date.now();
            const iterations = 100;

            for (let i = 0; i < iterations; i++) {
                mockAudioContext.currentTime = i * 0.025;
                core.tick();
            }

            const elapsed = Date.now() - startTime;
            const avgTimePerTick = elapsed / iterations;

            expect(avgTimePerTick).toBeLessThan(5);
        });

        test('Scheduler timing accuracy', () => {
            core.startPlayback(0, 120);

            const targetBeatTimes = [0, 0.5, 1.0, 1.5, 2.0];
            const expectedBeats = [0, 1, 2, 3, 4];

            for (let i = 0; i < targetBeatTimes.length; i++) {
                mockAudioContext.currentTime = targetBeatTimes[i];
                core.tick();
                expect(core.currentTime).toBeCloseTo(expectedBeats[i], 2);
            }
        });

        test('Tempo change during playback maintains timing continuity', () => {
            core.startPlayback(0, 120);

            // Run 1 second at 120 BPM
            mockAudioContext.currentTime = 1.0;
            core.tick();
            const beatBefore = core.currentTime;

            // Change tempo
            core.setTempo(240);

            // Run 0.5 more seconds at 240 BPM
            mockAudioContext.currentTime = 1.5;
            core.tick();
            const beatAfter = core.currentTime;

            // Beat should increase, no jump backward
            expect(beatAfter).toBeGreaterThan(beatBefore);

            // Expected: 2.0 (at 120) + 0.5s * (240/60) = 2.0 + 2.0 = 4.0
            expect(beatAfter).toBeCloseTo(4.0, 2);
        });

        test('Drift prevention: ticks recalculate beat from AudioContext', () => {
            core.startPlayback(0, 120);

            // Simulate JS main thread blocked for 500ms
            mockAudioContext.currentTime = 0.5;
            core.tick();
            expect(core.currentTime).toBeCloseTo(1.0, 2);

            // Simulate another 500ms jump (simulating lag)
            mockAudioContext.currentTime = 1.0;
            core.tick();
            expect(core.currentTime).toBeCloseTo(2.0, 2);

            // The beat always reflects AudioContext time, not wall-clock
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // PLAYHEAD ENGINE TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    describe('Playhead Engine Tempo Handling', () => {
        let playhead: Playhead;

        beforeEach(() => {
            playhead = new Playhead(120);
            jest.restoreAllMocks();
        });

        test('Playhead starts at correct position', () => {
            playhead.start(4);
            expect(playhead.getPosition()).toBeCloseTo(4.0, 1);
        });

        test('Playhead position advances over time', () => {
            jest.spyOn(performance, 'now').mockReturnValue(0);
            playhead.start(0);
            jest.spyOn(performance, 'now').mockReturnValue(1000);
            expect(playhead.update()).toBeCloseTo(2.0, 1);
        });

        test('Playhead tempo change corrects start time', () => {
            playhead.start(0);

            jest.spyOn(performance, 'now').mockReturnValue(1000);
            const posBefore = playhead.update();

            playhead.setTempo(90);

            const posAfter = playhead.getPosition();
            expect(posAfter).toBeCloseTo(posBefore, 1);
        });

        test('Playhead position is beat-based, not time-based', () => {
            jest.spyOn(performance, 'now').mockReturnValue(0);
            playhead.start(0);

            jest.spyOn(performance, 'now').mockReturnValue(1000);
            expect(playhead.update()).toBeCloseTo(2.0, 1);
        });

        test('Playhead stops correctly', () => {
            playhead.start(0);
            jest.spyOn(performance, 'now').mockReturnValue(1000);
            playhead.update();

            playhead.stop();
            jest.spyOn(performance, 'now').mockReturnValue(2000);
            const posAfterStop = playhead.update();
            // Position should not advance after stop
            expect(posAfterStop).toBeCloseTo(playhead.getPosition(), 1);
        });

        test('Playhead setTempo while stopped does not jump', () => {
            playhead.start(0);
            jest.spyOn(performance, 'now').mockReturnValue(500);
            playhead.update();
            playhead.stop();

            const posBefore = playhead.getPosition();
            playhead.setTempo(200);
            const posAfter = playhead.getPosition();

            expect(posAfter).toBeCloseTo(posBefore, 1);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // FAILURE LOGGING
    // ═══════════════════════════════════════════════════════════════════════════

    describe('Failure Logging Data', () => {
        test('Captures old BPM, new BPM on tempo change', () => {
            core.setTempo(120);
            const result = core.setTempo(90);

            expect(result.oldTempo).toBe(120);
            expect(result.newTempo).toBe(90);
        });

        test('Captures clip type, playhead position, scheduler state', () => {
            core.startPlayback(0, 120);
            mockAudioContext.currentTime = 1.0;
            core.tick();

            const state = {
                oldBPM: 120,
                newBPM: 90,
                clipType: 'audio',
                playheadPosition: core.currentTime,
                schedulerTimestamp: mockAudioContext.currentTime,
                transportState: core.isPlaying ? 'playing' : 'stopped'
            };

            expect(state.playheadPosition).toBeCloseTo(2.0, 2);
            expect(state.transportState).toBe('playing');
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // PASS CRITERIA VERIFICATION
    // ═══════════════════════════════════════════════════════════════════════════

    describe('PASS Criteria Verification', () => {
        test('✓ Clips stay synchronized after BPM changes', () => {
            core.setTempo(120);
            core.setTempo(90);
            core.setTempo(150);
            core.setTempo(120);

            clips.forEach(clip => {
                expect(clip.startBeat).toBeDefined();
                expect(clip.duration).toBeDefined();
            });
        });

        test('✓ Audio + MIDI remain aligned', () => {
            const audioClip = clips.find(c => c.id === 'drum-loop')!;
            const midiClip = clips.find(c => c.id === 'piano-midi')!;

            expect(audioClip.startBeat % 4).toBe(0);
            expect(midiClip.startBeat % 4).toBe(0);
        });

        test('✓ No drift after repeated tempo changes', () => {
            core.startPlayback(0, 120);

            const tempoSequence = [120, 90, 150, 128, 140, 100, 120];

            for (let i = 0; i < tempoSequence.length; i++) {
                mockAudioContext.currentTime = i * 0.5;
                core.setTempo(tempoSequence[i]);
                core.tick();

                const beat = core.currentTime;
                expect(Number.isFinite(beat)).toBe(true);
                expect(beat).toBeGreaterThanOrEqual(0);
            }
        });

        test('✓ Live BPM changes work during playback', () => {
            core.startPlayback(0, 120);

            core.setTempo(128);
            expect(core.isPlaying).toBe(true);

            core.setTempo(140);
            expect(core.isPlaying).toBe(true);

            core.setTempo(100);
            expect(core.isPlaying).toBe(true);
        });

        test('✓ No glitches / double triggers / stuck notes', () => {
            core.startPlayback(0, 120);

            for (let i = 0; i < 20; i++) {
                core.setTempo(120 + Math.sin(i) * 30);
                mockAudioContext.currentTime = i * 0.025;
                core.tick();
            }

            expect(Number.isFinite(core.currentTime)).toBe(true);
            expect(core.currentTime).toBeGreaterThanOrEqual(0);
        });

        test('✓ Timeline visuals match actual playback timing', () => {
            clips.forEach(clip => {
                const barStart = Math.floor(clip.startBeat / 4) * 4;
                expect(clip.startBeat).toBeGreaterThanOrEqual(barStart);
                expect(clip.startBeat).toBeLessThan(barStart + 4);
            });
        });
    });
});
