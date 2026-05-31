/**
 * midiSynth.ts
 * Minimal polyphonic MIDI synthesizer using Web Audio OscillatorNodes.
 *
 * Design:
 *  - Each note maps to an OscillatorNode + GainNode (ADSR envelope).
 *  - Notes are keyed by (trackId, pitch) so the same key can play on
 *    different tracks simultaneously.
 *  - Waveform is configurable per synth instance (default: 'triangle').
 *
 * Signal chain:
 *   OscillatorNode → note GainNode (envelope) → track GainNode → MasterGain → Destination
 */

import { audioEngine2 } from './AudioEngineAdapter';
import { useProjectStore } from '@/store/projectStore';
import { MultiSamplerEngine, createSamplerInstrument } from './instruments/multiSamplerEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WaveformType = OscillatorType; // 'sine' | 'square' | 'sawtooth' | 'triangle' | 'custom'

export interface SynthOptions {
    /** OscillatorNode waveform. Default: 'triangle'. */
    waveform?: WaveformType;
    /** Attack time in seconds. Default: 0.01 */
    attack?: number;
    /** Decay time in seconds. Default: 0.05 */
    decay?: number;
    /** Sustain level 0–1. Default: 0.7 */
    sustain?: number;
    /** Release time in seconds. Default: 0.15 */
    release?: number;
}

interface ActiveNote {
    osc: OscillatorNode;
    envGain: GainNode;
    releaseTime: number; // AudioContext time when release starts
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/** MIDI pitch (0–127) → frequency in Hz. Middle C = 60 = 261.63 Hz. */
export function midiPitchToHz(pitch: number): number {
    return 440 * Math.pow(2, (pitch - 69) / 12);
}

/** Scalar velocity (0–127) → linear gain (0–1). */
function velocityToGain(velocity: number): number {
    return Math.max(0, Math.min(1, velocity / 127));
}

// ─── MidiSynth ────────────────────────────────────────────────────────────────

export class MidiSynth {
    private opts: Required<SynthOptions>;

    /** Active note store: key = `${trackId}:${pitch}` */
    private notes = new Map<string, ActiveNote>();
    
    /** Active samplers per track, keyed by trackId */
    private samplers = new Map<string, MultiSamplerEngine>();

    constructor(opts: SynthOptions = {}) {
        this.opts = {
            waveform: opts.waveform ?? 'triangle',
            attack: opts.attack ?? 0.01,
            decay: opts.decay ?? 0.05,
            sustain: opts.sustain ?? 0.7,
            release: opts.release ?? 0.15,
        };
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Trigger a note on.
     *
     * @param pitch     MIDI note number (0–127).
     * @param velocity  MIDI velocity (0–127).
     * @param trackId   Routes audio through the given track's gain/pan channel.
     */
    playNote(pitch: number, velocity: number, trackId: string): void {
        const track = useProjectStore.getState().tracks.find(t => t.id === trackId);
        const samplerInstruments = ['Nylon Guitar', 'Steinway Piano'];
        if (track && samplerInstruments.includes(track.instrument || '')) {
            this.playSamplerNote(pitch, velocity, trackId, track.instrument!);
            return;
        }

        const key = noteKey(trackId, pitch);

        // If already playing, stop the old note cleanly before re-triggering
        if (this.notes.has(key)) this.stopNote(pitch, trackId, true);

        const ctx = this.getCtx();
        const now = ctx.currentTime;

        // Ensure the track channel exists in the engine
        audioEngine2.createTrack(trackId);
        const channel = audioEngine2.getChannel(trackId);

        const osc = ctx.createOscillator();
        osc.type = this.opts.waveform;
        osc.frequency.setValueAtTime(midiPitchToHz(pitch), now);

        const envGain = ctx.createGain();
        const peak = velocityToGain(velocity);

        // ADSR — Attack
        envGain.gain.setValueAtTime(0, now);
        envGain.gain.linearRampToValueAtTime(peak, now + this.opts.attack);

        // Decay → Sustain
        envGain.gain.setTargetAtTime(
            peak * this.opts.sustain,
            now + this.opts.attack,
            this.opts.decay / 3,  // setTargetAtTime uses a time *constant*, not duration
        );

        osc.connect(envGain);

        // Route into the track's gain node if it exists, otherwise fall back to destination
        if (channel) {
            envGain.connect(channel.gain);
        } else {
            envGain.connect(ctx.destination);
        }

        osc.start(now);

        this.notes.set(key, { osc, envGain, releaseTime: -1 });
    }

    /**
     * Trigger a note off for a pitch on a track.
     *
     * @param pitch    MIDI note number.
     * @param trackId  Must match the trackId given to playNote.
     * @param immediate If true, the note is cut off without the release envelope.
     */
    stopNote(pitch: number, trackId: string, immediate = false): void {
        const track = useProjectStore.getState().tracks.find(t => t.id === trackId);
        const samplerInstruments = ['Nylon Guitar', 'Steinway Piano'];
        if (track && samplerInstruments.includes(track.instrument || '')) {
            const sampler = this.samplers.get(trackId);
            if (sampler) {
                sampler.noteOff(pitch);
            }
            return;
        }

        const key = noteKey(trackId, pitch);
        const note = this.notes.get(key);
        if (!note) return;

        const ctx = this.getCtx();
        const now = ctx.currentTime;
        const release = immediate ? 0.005 : this.opts.release;

        note.envGain.gain.cancelScheduledValues(now);
        note.envGain.gain.setValueAtTime(note.envGain.gain.value, now);
        note.envGain.gain.exponentialRampToValueAtTime(0.0001, now + release);

        note.osc.stop(now + release + 0.01);
        this.notes.delete(key);
    }

    /** Stop every note currently playing on all tracks. */
    stopAll(): void {
        const ctx = this.getCtx();
        const now = ctx.currentTime;
        Array.from(this.notes.values()).forEach(note => {
            note.envGain.gain.setValueAtTime(note.envGain.gain.value, now);
            note.envGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.01);
            note.osc.stop(now + 0.02);
        });
        this.notes.clear();

        Array.from(this.samplers.values()).forEach(sampler => {
            if (sampler && (sampler as any).dispose) (sampler as any).dispose();
        });
        this.samplers.clear();
    }


    /** Update synth options (takes effect on future notes only). */
    configure(opts: Partial<SynthOptions>): void {
        Object.assign(this.opts, opts);
    }

    // ── Private ───────────────────────────────────────────────────────────────

    private async initSampler(trackId: string, pitch: number, velocity: number, instrument: string) {
         const ctx = this.getCtx();
         const samplerPresets: Record<string, string> = {
            'Nylon Guitar': '/sound_sample/guitar/MG%20Soft%20Nylon%20Guitar%20(Lite).dspreset',
            'Steinway Piano': '/sound_sample/piano/Piano.dspreset'
         };
         
         try {
             const engine = await createSamplerInstrument(ctx, samplerPresets[instrument]);
             this.samplers.set(trackId, engine);
             
             audioEngine2.createTrack(trackId);
             const channel = audioEngine2.getChannel(trackId);
             if (channel) {
                 engine.getOutput().connect(channel.gain);
             } else {
                 engine.getOutput().connect(ctx.destination);
             }
             engine.playNote(pitch, velocity);
         } catch (e) {
             console.error(`Failed to load ${instrument} sampler`, e);
             this.samplers.delete(trackId);
         }
    }

    private playSamplerNote(pitch: number, velocity: number, trackId: string, instrument: string) {
        let sampler = this.samplers.get(trackId);
        
        if (!sampler) {
            // mark as loading by setting an empty entry or handling appropriately
            // To avoid multiple concurrent loads, we'd ideally have a 'loading' set
            this.initSampler(trackId, pitch, velocity, instrument);
            return;
        }

        if (sampler && sampler.playNote) {
            sampler.playNote(pitch, velocity);
        }
    }

    private getCtx(): AudioContext {
        // Ensure context is initialised, then return it.
        return audioEngine2.getContext() ?? (() => { throw new Error('[MidiSynth] AudioContext not yet created — trigger a user gesture first.'); })();
    }
}

function noteKey(trackId: string, pitch: number): string {
    return `${trackId}:${pitch}`;
}

// Default singleton synth — use this for quick notes or override per track.
export const midiSynth = new MidiSynth();
