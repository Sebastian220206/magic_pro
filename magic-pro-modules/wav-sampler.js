/**
 * WAV Sampler Engine
 * Loads and plays back WAV/MP3 samples mapped across a MIDI keyboard
 */
export class WavSampler {
    /**
     * @param {AudioContext} audioContext - Shared Web Audio API Context
     */
    constructor(audioContext) {
        if (!audioContext) throw new Error("AudioContext is required");
        this.ctx = audioContext;
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 1.0;
        
        // Active playing voices: map of midiNote -> array of active voice objects
        this.activeVoices = new Map();
        
        // Caching fetched buffers
        this.sampleCache = new Map();
        
        // The current instrument map
        this.instrumentDef = null;
        
        // Global tuning offset in cents
        this.tuningCents = 0;
    }

    /**
     * Get the master output node to connect to the router or mixer
     * @returns {GainNode}
     */
    getOutput() {
        return this.masterGain;
    }

    /**
     * Set master volume
     * @param {number} amount - 0.0 to 1.0
     */
    setVolume(amount) {
        // clamped between 0 and 2
        this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(2, amount)), this.ctx.currentTime, 0.01);
    }

    /**
     * Set global tuning in cents
     * @param {number} cents - Cents offset (e.g., -100 to +100)
     */
    setTuning(cents) {
        this.tuningCents = cents;
    }

    /**
     * Load an instrument definition from a JSON object
     * @param {Object} jsonDefinition - Instrument definition map
     * @returns {Promise<void>}
     */
    async loadInstrument(jsonDefinition) {
        this.instrumentDef = jsonDefinition;
        console.log(`[WavSampler] Loading instrument: ${this.instrumentDef.name}`);
        
        const loadPromises = this.instrumentDef.samples.map(async (sample) => {
            if (!this.sampleCache.has(sample.file)) {
                try {
                    const response = await fetch(sample.file);
                    if (!response.ok) throw new Error(`Failed to load ${sample.file}`);
                    const arrayBuffer = await response.arrayBuffer();
                    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                    this.sampleCache.set(sample.file, audioBuffer);
                } catch (e) {
                    console.error(`[WavSampler] Error loading sample ${sample.file}`, e);
                }
            }
        });
        
        await Promise.all(loadPromises);
        console.log(`[WavSampler] Instrument ${this.instrumentDef.name} loaded successfully.`);
    }

    /**
     * Trigger a note on event
     * @param {number} midiNote - MIDI note number (0-127)
     * @param {number} velocity - MIDI velocity (0-127)
     */
    noteOn(midiNote, velocity) {
        if (!this.instrumentDef) return;
        
        // Find the matching sample zone
        let zone = this.instrumentDef.samples.find(z => midiNote >= z.loNote && midiNote <= z.hiNote);
        
        // If exact match not found, find closest root note (fallback)
        if (!zone) {
            let closest = null;
            let minDiff = Infinity;
            for (let z of this.instrumentDef.samples) {
                let diff = Math.abs(z.note - midiNote);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = z;
                }
            }
            zone = closest;
        }

        if (!zone) return;

        const buffer = this.sampleCache.get(zone.file);
        if (!buffer) return;

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        
        // Handle looping for sustained instruments
        if (this.instrumentDef.loop) {
            source.loop = true;
            if (zone.loopStart) source.loopStart = zone.loopStart;
            if (zone.loopEnd) source.loopEnd = zone.loopEnd;
        }

        // Calculate pitch shift
        const rootNote = zone.note;
        const noteOffset = midiNote - rootNote;
        // 100 cents per semitone, plus global tuning
        const totalCents = (noteOffset * 100) + this.tuningCents;
        source.detune.value = totalCents;

        // Envelope
        const gainNode = this.ctx.createGain();
        const velLevel = velocity / 127.0;
        const attack = this.instrumentDef.attack || 0.01;
        
        gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(velLevel, this.ctx.currentTime + attack);

        // Routing
        source.connect(gainNode);
        gainNode.connect(this.masterGain);

        source.start(this.ctx.currentTime);

        // Register active voice
        if (!this.activeVoices.has(midiNote)) {
            this.activeVoices.set(midiNote, []);
        }
        
        const voice = { source, gainNode, isOneShot: !!this.instrumentDef.oneShot };
        this.activeVoices.get(midiNote).push(voice);
        
        // Auto-cleanup for one-shots or natural ends
        source.onended = () => {
            const voices = this.activeVoices.get(midiNote);
            if (voices) {
                const idx = voices.indexOf(voice);
                if (idx > -1) {
                    voices.splice(idx, 1);
                    if (voices.length === 0) this.activeVoices.delete(midiNote);
                }
            }
            try { source.disconnect(); } catch (e) {}
            try { gainNode.disconnect(); } catch (e) {}
        };
    }

    /**
     * Release a playing note
     * @param {number} midiNote - MIDI note number (0-127)
     */
    noteOff(midiNote) {
        if (!this.instrumentDef || this.instrumentDef.oneShot) return; // One-shots play till end

        const voices = this.activeVoices.get(midiNote);
        if (!voices) return;

        const release = this.instrumentDef.release || 0.5;
        const t = this.ctx.currentTime;

        voices.forEach(voice => {
            // Cancel any scheduled attack values and gracefully release
            voice.gainNode.gain.cancelScheduledValues(t);
            voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, t);
            voice.gainNode.gain.exponentialRampToValueAtTime(0.001, t + release);
            voice.source.stop(t + release + 0.1);
        });

        this.activeVoices.delete(midiNote);
    }
}

// Built-in presets to use in the demo
export const WAV_PRESETS = {
    tabla: {
        name: "Tabla",
        oneShot: true,
        samples: [
            { note: 60, file: "https://freewavesamples.com/files/Tabla-Bayan-1.wav", loNote: 0, hiNote: 61 },
            { note: 62, file: "https://freewavesamples.com/files/Tabla-Bayan-2.wav", loNote: 62, hiNote: 127 },
        ]
    },
    oud: {
        name: "Oud",
        attack: 0.02,
        release: 0.6,
        samples: [
            { note: 60, file: "https://freewavesamples.com/files/Alesis-Sanctuary-QCard-Acoustic-Guitar-C4.wav", loNote: 0, hiNote: 127 }
        ]
    }
};
