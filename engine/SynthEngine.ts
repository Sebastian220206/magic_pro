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
        const velScale = velocity / 127;

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

        // Cleanup after release
        setTimeout(() => {
            this.oscillators.forEach(osc => osc.disconnect());
            this.gain.disconnect();
            this.filter.disconnect();
        }, envelope.release * 1000 + 100);
    }
}

export class SynthEngine {
    private ctx: AudioContext;
    private activeVoices: Map<number, SynthVoice> = new Map();
    private targetNode: AudioNode;

    constructor(ctx: AudioContext, target: AudioNode) {
        this.ctx = ctx;
        this.targetNode = target;
    }

    noteOn(note: number, velocity: number, presetId: string = 'piano') {
        const preset = SYNTH_PRESETS[presetId] || SYNTH_PRESETS.piano;
        
        // Handle overlap (monophonic behavior per note number)
        if (this.activeVoices.has(note)) {
            this.noteOff(note);
        }

        const voice = new SynthVoice(this.ctx, preset, note, this.targetNode);
        voice.start(this.ctx.currentTime, velocity);
        this.activeVoices.set(note, voice);
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
        this.activeVoices.forEach(voice => voice.stop(this.ctx.currentTime));
        this.activeVoices.clear();
    }
}
