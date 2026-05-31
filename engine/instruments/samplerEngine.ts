/**
 * Sampler Engine
 * Loads and plays back audio samples mapped to MIDI notes
 */

export interface SampleZone {
    note: number;      // Root MIDI note
    minNote: number;   // Range start
    maxNote: number;   // Range end
    minVel: number;    // Velocity range start
    maxVel: number;    // Velocity range end
    buffer?: AudioBuffer;
    url?: string;      // Path to sample file
    name?: string;
}

export interface SampleMap {
    name: string;
    samples: SampleZone[];
    envelope?: {
        attack: number;
        release: number;
    };
}

// Sample map definitions for built-in instruments
export const sampleMaps: Record<string, SampleMap> = {
    grand_piano: {
        name: 'Grand Piano',
        samples: [
            // Simplified piano mapping - in production, you'd have more zones
            { note: 36, minNote: 0, maxNote: 42, minVel: 0, maxVel: 127, name: 'C2' },
            { note: 48, minNote: 43, maxNote: 54, minVel: 0, maxVel: 127, name: 'C3' },
            { note: 60, minNote: 55, maxNote: 66, minVel: 0, maxVel: 127, name: 'C4' },
            { note: 72, minNote: 67, maxNote: 78, minVel: 0, maxVel: 127, name: 'C5' },
            { note: 84, minNote: 79, maxNote: 91, minVel: 0, maxVel: 127, name: 'C6' },
            { note: 96, minNote: 92, maxNote: 127, minVel: 0, maxVel: 127, name: 'C7' },
        ],
        envelope: { attack: 0.005, release: 0.5 },
    },
    electric_piano: {
        name: 'Electric Piano',
        samples: [
            { note: 36, minNote: 0, maxNote: 42, minVel: 0, maxVel: 127, name: 'C2' },
            { note: 48, minNote: 43, maxNote: 54, minVel: 0, maxVel: 127, name: 'C3' },
            { note: 60, minNote: 55, maxNote: 66, minVel: 0, maxVel: 127, name: 'C4' },
            { note: 72, minNote: 67, maxNote: 78, minVel: 0, maxVel: 127, name: 'C5' },
            { note: 84, minNote: 79, maxNote: 91, minVel: 0, maxVel: 127, name: 'C6' },
            { note: 96, minNote: 92, maxNote: 127, minVel: 0, maxVel: 127, name: 'C7' },
        ],
        envelope: { attack: 0.01, release: 0.3 },
    },
};

/**
 * Convert MIDI note to frequency for pitch adjustment
 */
export function midiToFrequency(note: number): number {
    return 440 * Math.pow(2, (note - 69) / 12);
}

/**
 * Individual sampler voice
 */
class SamplerVoice {
    private ctx: AudioContext;
    private source: AudioBufferSourceNode | null = null;
    private envelope: GainNode;
    private output: GainNode;
    private isActive = false;
    private currentNote = 0;
    private attackTime = 0;

    constructor(ctx: AudioContext) {
        this.ctx = ctx;

        // Create envelope gain
        this.envelope = ctx.createGain();
        this.envelope.gain.value = 0;

        // Create output gain
        this.output = ctx.createGain();
        this.output.gain.value = 0.5;

        // Connect: envelope -> output
        this.envelope.connect(this.output);
    }

    /**
     * Start playing a sample
     */
    noteOn(
        buffer: AudioBuffer,
        note: number,
        velocity: number,
        rootNote: number,
        attack: number,
        startTime?: number
    ): void {
        const time = startTime ?? this.ctx.currentTime;
        this.currentNote = note;
        this.isActive = true;
        this.attackTime = time + attack;

        // Calculate playback rate for pitch adjustment
        const rate = midiToFrequency(note) / midiToFrequency(rootNote);

        // Create buffer source
        this.source = this.ctx.createBufferSource();
        this.source.buffer = buffer;
        this.source.playbackRate.value = rate;
        this.source.connect(this.envelope);

        // Apply velocity scaling
        const velGain = velocity / 127;

        // Attack envelope
        this.envelope.gain.cancelScheduledValues(time);
        this.envelope.gain.setValueAtTime(0, time);
        this.envelope.gain.linearRampToValueAtTime(velGain, time + attack);

        // Start playback
        this.source.start(time);

        // Handle natural sample end
        this.source.onended = () => {
            this.cleanup();
            this.isActive = false;
        };
    }

    /**
     * Stop playing (release envelope)
     */
    noteOff(release: number, stopTime?: number): void {
        if (!this.isActive || !this.source) return;

        const time = stopTime ?? this.ctx.currentTime;

        // Release envelope
        const currentGain = this.envelope.gain.value;
        this.envelope.gain.cancelScheduledValues(time);
        this.envelope.gain.setValueAtTime(currentGain, time);
        this.envelope.gain.exponentialRampToValueAtTime(0.001, time + release);

        // Schedule stop
        const stopAt = time + release + 0.01;
        try {
            this.source.stop(stopAt);
        } catch {
            // Already stopped
        }

        // Cleanup after release
        setTimeout(() => {
            this.cleanup();
            this.isActive = false;
        }, (release + 0.05) * 1000);
    }

    /**
     * Check if voice is currently playing
     */
    isPlaying(): boolean {
        return this.isActive;
    }

    /**
     * Get current note
     */
    getCurrentNote(): number {
        return this.currentNote;
    }

    /**
     * Get output node
     */
    getOutput(): AudioNode {
        return this.output;
    }

    /**
     * Check if voice can be stolen
     */
    canSteal(currentTime: number): boolean {
        return this.isActive && this.attackTime < currentTime - 0.1;
    }

    /**
     * Cleanup resources
     */
    private cleanup(): void {
        if (this.source) {
            try {
                this.source.disconnect();
                this.source.onended = null;
            } catch {
                // Already disconnected
            }
            this.source = null;
        }
    }

    /**
     * Dispose voice
     */
    dispose(): void {
        this.cleanup();
        try {
            this.envelope.disconnect();
            this.output.disconnect();
        } catch {
            // Already disconnected
        }
    }
}

/**
 * Sampler Instrument
 */
export class Sampler {
    private ctx: AudioContext;
    private sampleMap: SampleMap;
    private voices: SamplerVoice[] = [];
    private masterGain: GainNode;
    private voiceIndex = 0;
    private loadedSamples = new Map<string, AudioBuffer>();
    private isLoaded = false;

    constructor(ctx: AudioContext, presetName: string) {
        this.ctx = ctx;
        this.sampleMap = sampleMaps[presetName] ?? sampleMaps.grand_piano;

        // Create master output
        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 0.5;

        // Allocate voice pool
        this.allocateVoices();
    }

    /**
     * Allocate voice pool
     */
    private allocateVoices(): void {
        const polyphony = 16; // Samplers need more voices for overlapping
        for (let i = 0; i < polyphony; i++) {
            const voice = new SamplerVoice(this.ctx);
            voice.getOutput().connect(this.masterGain);
            this.voices.push(voice);
        }
    }

    /**
     * Load all samples for this sampler
     */
    async loadSamples(): Promise<void> {
        if (this.isLoaded) return;

        const loadPromises = this.sampleMap.samples.map(async (zone) => {
            if (!zone.url) {
                // Generate a simple waveform if no sample file
                const buffer = this.generateSample(zone.name ?? 'sample', zone.note);
                this.loadedSamples.set(zone.name ?? `note_${zone.note}`, buffer);
                return;
            }

            try {
                const response = await fetch(zone.url);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                this.loadedSamples.set(zone.name ?? `note_${zone.note}`, audioBuffer);
            } catch (error) {
                console.warn(`Failed to load sample: ${zone.url}`, error);
                // Generate fallback sample
                const buffer = this.generateSample(zone.name ?? 'sample', zone.note);
                this.loadedSamples.set(zone.name ?? `note_${zone.note}`, buffer);
            }
        });

        await Promise.all(loadPromises);
        this.isLoaded = true;
    }

    /**
     * Generate a simple sample as fallback
     * Creates a basic tone based on the instrument type
     */
    private generateSample(name: string, note: number): AudioBuffer {
        const sampleRate = this.ctx.sampleRate;
        const duration = 2.0; // 2 seconds
        const buffer = this.ctx.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);

        const freq = midiToFrequency(note);
        const isPiano = this.sampleMap.name.toLowerCase().includes('piano');

        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;

            if (isPiano) {
                // Piano-like synthesis (multiple harmonics with decay)
                const fundamental = Math.sin(2 * Math.PI * freq * t);
                const harmonic2 = 0.5 * Math.sin(2 * Math.PI * freq * 2 * t);
                const harmonic3 = 0.25 * Math.sin(2 * Math.PI * freq * 3 * t);

                // Exponential decay
                const envelope = Math.exp(-t * 2);

                data[i] = (fundamental + harmonic2 + harmonic3) * envelope * 0.3;
            } else {
                // Electric piano (bell-like with inharmonicity)
                const fundamental = Math.sin(2 * Math.PI * freq * t);
                const bell = 0.3 * Math.sin(2 * Math.PI * freq * 2.1 * t);
                const click = t < 0.01 ? 0.5 : 0; // Attack click

                const envelope = Math.exp(-t * 3) + (t < 0.05 ? 0.2 : 0);

                data[i] = (fundamental + bell + click) * envelope * 0.25;
            }
        }

        return buffer;
    }

    /**
     * Find sample zone for a given note
     */
    private findSampleZone(note: number): SampleZone | null {
        const zone = this.sampleMap.samples.find(
            (z) => note >= z.minNote && note <= z.maxNote
        );
        return zone ?? null;
    }

    /**
     * Get available voice or steal one
     */
    private getVoice(): SamplerVoice {
        const inactiveVoice = this.voices.find((v) => !v.isPlaying());
        if (inactiveVoice) return inactiveVoice;

        const currentTime = this.ctx.currentTime;
        const stealableVoice = this.voices.find((v) => v.canSteal(currentTime));
        if (stealableVoice) {
            stealableVoice.noteOff(
                this.sampleMap.envelope?.release ?? 0.1,
                currentTime
            );
            return stealableVoice;
        }

        const voice = this.voices[this.voiceIndex];
        voice.noteOff(this.sampleMap.envelope?.release ?? 0.1, currentTime);
        this.voiceIndex = (this.voiceIndex + 1) % this.voices.length;
        return voice;
    }

    /**
     * Start playing a note
     */
    noteOn(note: number, velocity = 100, time?: number): void {
        if (!this.isLoaded) {
            console.warn('Sampler not loaded yet');
            return;
        }

        // Check if note is already playing
        const existingVoice = this.voices.find(
            (v) => v.isPlaying() && v.getCurrentNote() === note
        );
        if (existingVoice) {
            existingVoice.noteOff(this.sampleMap.envelope?.release ?? 0.1, time);
        }

        const zone = this.findSampleZone(note);
        if (!zone) {
            console.warn(`No sample zone for note ${note}`);
            return;
        }

        const buffer = this.loadedSamples.get(zone.name ?? `note_${zone.note}`);
        if (!buffer) {
            console.warn(`Sample not loaded for zone: ${zone.name}`);
            return;
        }

        const voice = this.getVoice();
        voice.noteOn(
            buffer,
            note,
            velocity,
            zone.note,
            this.sampleMap.envelope?.attack ?? 0.005,
            time
        );
    }

    /**
     * Stop playing a note
     */
    noteOff(note: number, time?: number): void {
        const voice = this.voices.find(
            (v) => v.isPlaying() && v.getCurrentNote() === note
        );
        if (voice) {
            voice.noteOff(this.sampleMap.envelope?.release ?? 0.5, time);
        }
    }

    /**
     * Stop all notes
     */
    allNotesOff(time?: number): void {
        const stopTime = time ?? this.ctx.currentTime;
        this.voices.forEach((voice) => {
            if (voice.isPlaying()) {
                voice.noteOff(this.sampleMap.envelope?.release ?? 0.5, stopTime);
            }
        });
    }

    /**
     * Get output node
     */
    getOutput(): AudioNode {
        return this.masterGain;
    }

    /**
     * Set master volume
     */
    setVolume(volume: number): void {
        this.masterGain.gain.value = volume;
    }

    /**
     * Check if samples are loaded
     */
    isReady(): boolean {
        return this.isLoaded;
    }

    /**
     * Get sample map name
     */
    getName(): string {
        return this.sampleMap.name;
    }

    /**
     * Dispose of all resources
     */
    dispose(): void {
        this.voices.forEach((v) => v.dispose());
        this.voices = [];
        this.loadedSamples.clear();
        try {
            this.masterGain.disconnect();
        } catch {
            // Already disconnected
        }
    }
}

export default Sampler;
