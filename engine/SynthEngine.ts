/**
 * SynthEngine.ts
 * A powerful, reusable Web Audio API Synth Engine for the DAW.
 * Core Architecture: Oscillator(s) -> Filter -> Gain (Envelope) -> Output (Track Nodes)
 */

export type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface SynthPreset {
    id: string;
    name: string;
    oscillators: {
        type: OscillatorType;
        detune: number; // in cents
        gain: number;   // relative volume
    }[];
    envelope: {
        attack: number;   // seconds
        decay: number;    // seconds
        sustain: number;  // level (0-1)
        release: number;  // seconds
    };
    filter: {
        type: BiquadFilterType;
        frequency: number;
        q: number;
    };
}

export const SYNTH_PRESETS: Record<string, SynthPreset> = {
    piano: {
        id: 'piano',
        name: 'Classical Piano',
        oscillators: [
            { type: 'triangle', detune: 0, gain: 0.8 },
            { type: 'sine', detune: 5, gain: 0.2 }
        ],
        envelope: {
            attack: 0.005,
            decay: 0.3,
            sustain: 0.1,
            release: 0.3
        },
        filter: {
            type: 'lowpass',
            frequency: 5000,
            q: 1
        }
    },
    subBass: {
        id: 'subBass',
        name: 'Deep Sub',
        oscillators: [
            { type: 'sine', detune: 0, gain: 1.0 }
        ],
        envelope: {
            attack: 0.02,
            decay: 0.1,
            sustain: 0.8,
            release: 0.2
        },
        filter: {
            type: 'lowpass',
            frequency: 150,
            q: 2
        }
    },
    lead: {
        id: 'lead',
        name: 'Synth Lead',
        oscillators: [
            { type: 'sawtooth', detune: -10, gain: 0.5 },
            { type: 'sawtooth', detune: 10, gain: 0.5 }
        ],
        envelope: {
            attack: 0.05,
            decay: 0.2,
            sustain: 0.6,
            release: 0.2
        },
        filter: {
            type: 'lowpass',
            frequency: 2500,
            q: 4
        }
    },
    pad: {
        id: 'pad',
        name: 'Atmospheric Pad',
        oscillators: [
            { type: 'sawtooth', detune: -15, gain: 0.4 },
            { type: 'sawtooth', detune: 15, gain: 0.4 },
            { type: 'sine', detune: 0, gain: 0.2 }
        ],
        envelope: {
            attack: 1.5,
            decay: 1.0,
            sustain: 0.7,
            release: 3.0
        },
        filter: {
            type: 'lowpass',
            frequency: 800,
            q: 1
        }
    },
    warmString: {
        id: 'warmString',
        name: 'Warm String',
        oscillators: [
            { type: 'sawtooth', detune: -8, gain: 0.5 },
            { type: 'sawtooth', detune: 8, gain: 0.5 },
            { type: 'sine', detune: 0, gain: 0.2 } // Add some body
        ],
        envelope: {
            attack: 0.8,
            decay: 0.5,
            sustain: 0.8,
            release: 1.5
        },
        filter: {
            type: 'lowpass',
            frequency: 1200, // slightly more open than pad
            q: 1.5
        }
    }
};

class SynthVoice {
    private ctx: AudioContext;
    private oscillators: OscillatorNode[] = [];
    private gain: GainNode;
    private filter: BiquadFilterNode;
    private preset: SynthPreset;
    private note: number;
    private targetNode: AudioNode;

    constructor(ctx: AudioContext, preset: SynthPreset, note: number, target: AudioNode) {
        this.ctx = ctx;
        this.preset = preset;
        this.note = note;
        this.targetNode = target;

        // 1. Create Nodes
        this.filter = ctx.createBiquadFilter();
        this.filter.type = preset.filter.type;
        this.filter.frequency.value = preset.filter.frequency;
        this.filter.Q.value = preset.filter.q;

        this.gain = ctx.createGain();
        this.gain.gain.value = 0; // Start at zero for envelope

        // 2. Routing
        this.filter.connect(this.gain);
        this.gain.connect(this.targetNode);

        // 3. Oscillators
        const freq = 440 * Math.pow(2, (note - 69) / 12);
        
        preset.oscillators.forEach(oscConfig => {
            const osc = ctx.createOscillator();
            const oscGain = ctx.createGain();
            
            osc.type = oscConfig.type;
            osc.frequency.value = freq;
            osc.detune.value = oscConfig.detune;
            oscGain.gain.value = oscConfig.gain * 0.2; // Gain scaling to prevent clipping

            osc.connect(oscGain);
            oscGain.connect(this.filter);
            
            this.oscillators.push(osc);
        });
    }

    start(time: number, velocity: number) {
        const { envelope } = this.preset;
        // Clamp velocity to MIDI range (0-127) to prevent
        // gain > 1.0 that could clip or silence the output
        const clampedVel = Math.max(0, Math.min(127, velocity));
        const velScale = clampedVel / 127;

        // Apply Envelope - Attack and Decay
        this.gain.gain.cancelScheduledValues(time);
        this.gain.gain.setValueAtTime(0, time);
        this.gain.gain.linearRampToValueAtTime(1.0 * velScale, time + envelope.attack);
        this.gain.gain.linearRampToValueAtTime(envelope.sustain * velScale, time + envelope.attack + envelope.decay);

        // Start Oscillators
        this.oscillators.forEach(osc => osc.start(time));
    }

    setPitchBend(cents: number) {
        this.oscillators.forEach((osc, idx) => {
            const baseDetune = this.preset.oscillators[idx].detune;
            osc.detune.setTargetAtTime(baseDetune + cents, this.ctx.currentTime, 0.05);
        });
    }

    stop(time: number) {
        const { envelope } = this.preset;
        
        this.gain.gain.cancelScheduledValues(time);
        this.gain.gain.setValueAtTime(this.gain.gain.value, time);
        this.gain.gain.exponentialRampToValueAtTime(0.001, time + envelope.release);
        
        this.oscillators.forEach(osc => {
            osc.stop(time + envelope.release);
        });

        // Cleanup after the release tail. The delay is measured from `time`,
        // not from now: a sequenced note may be scheduled to stop seconds in
        // the future, and disconnecting relative to now would cut it short.
        const cleanupDelayMs = Math.max(
            0,
            (time - this.ctx.currentTime + envelope.release) * 1000 + 100,
        );
        setTimeout(() => {
            this.oscillators.forEach(osc => osc.disconnect());
            this.gain.disconnect();
            this.filter.disconnect();
        }, cleanupDelayMs);
    }
}

export class SynthEngine {
    private ctx: AudioContext;
    private activeVoices: Map<number, SynthVoice> = new Map();
    /**
     * Voices created by `scheduleNote`. Held separately from `activeVoices`
     * because sequenced notes are keyed by time rather than pitch and several
     * may overlap on the same note number.
     */
    private scheduledVoices: Set<SynthVoice> = new Set();
    private targetNode: AudioNode;
    /** Master gain for real-time volume control (between voices and target) */
    private masterGain: GainNode;

    constructor(ctx: AudioContext, target: AudioNode) {
        this.ctx = ctx;
        this.targetNode = target;

        // Insert a master gain node so the Volume slider works in real-time
        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 1.0;
        this.masterGain.connect(target);
    }

    /** Set master volume in real-time (0.0 - 1.0, clamped) */
    setVolume(volume: number): void {
        const clamped = Math.max(0, Math.min(1, volume));
        this.masterGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.05);
    }

    /** Get the master gain input node (voices connect here instead of targetNode) */
    getInput(): AudioNode {
        return this.masterGain;
    }

    noteOn(note: number, velocity: number, presetId: string = 'piano') {
        const preset = SYNTH_PRESETS[presetId] || SYNTH_PRESETS.piano;

        // Handle overlap (monophonic behavior per note number)
        if (this.activeVoices.has(note)) {
            this.noteOff(note);
        }

        const voice = new SynthVoice(this.ctx, preset, note, this.masterGain);
        voice.start(this.ctx.currentTime, velocity);
        this.activeVoices.set(note, voice);
    }

    /**
     * Play a note between two absolute AudioContext times.
     *
     * Used for sequenced playback, where the note's length is known up front.
     * Unlike `noteOn`/`noteOff` these voices are not keyed by note number, so
     * the same pitch can be scheduled repeatedly inside one lookahead window
     * (a fast repeated note) without each occurrence cancelling the last.
     */
    scheduleNote(
        note: number,
        velocity: number,
        presetId: string = 'piano',
        startTime: number,
        stopTime: number,
    ): void {
        const preset = SYNTH_PRESETS[presetId] || SYNTH_PRESETS.piano;
        const voice = new SynthVoice(this.ctx, preset, note, this.masterGain);

        voice.start(startTime, velocity);
        voice.stop(Math.max(stopTime, startTime + 0.01));

        this.scheduledVoices.add(voice);
        // Release the reference once the voice has finished its release tail.
        const lifetimeMs = (stopTime - this.ctx.currentTime + preset.envelope.release) * 1000 + 200;
        setTimeout(() => this.scheduledVoices.delete(voice), Math.max(lifetimeMs, 0));
    }

    setPitchBend(cents: number) {
        this.activeVoices.forEach(voice => voice.setPitchBend(cents));
    }

    noteOff(note: number) {
        const voice = this.activeVoices.get(note);
        if (voice) {
            voice.stop(this.ctx.currentTime);
            this.activeVoices.delete(note);
        }
    }

    stopAll() {
        const now = this.ctx.currentTime;
        this.activeVoices.forEach(voice => voice.stop(now));
        this.activeVoices.clear();
        // Sequenced voices may be mid-note or still pending; stopping at `now`
        // cancels both cases so transport stop leaves nothing ringing.
        this.scheduledVoices.forEach(voice => {
            try {
                voice.stop(now);
            } catch {
                // Voice already stopped — its oscillators are done.
            }
        });
        this.scheduledVoices.clear();
    }
}
