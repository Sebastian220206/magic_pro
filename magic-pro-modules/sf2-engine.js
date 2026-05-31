/**
 * SF2 Engine
 * Loads and plays back .sf2 SoundFont files using a third-party library or Web Audio
 * This uses a basic implementation concept for standalone integration.
 */
export class SF2Engine {
    /**
     * @param {AudioContext} audioContext - Shared Web Audio API Context
     */
    constructor(audioContext) {
        if (!audioContext) throw new Error("AudioContext is required");
        this.ctx = audioContext;
        this.masterGain = this.ctx.createGain();
        this.reverbGain = this.ctx.createGain();
        this.reverbNode = this.ctx.createConvolver();
        
        // Dry signal
        this.masterGain.connect(this.ctx.destination);
        
        // Wet signal setup (very basic reverb impulse response mock)
        this.reverbGain.gain.value = 0.0;
        this.masterGain.connect(this.reverbGain);
        this.reverbGain.connect(this.reverbNode);
        this.reverbNode.connect(this.ctx.destination);

        this.instruments = [];
        this.activeInstrumentIndex = 0;
        this.activeVoices = new Map();
        
        // We simulate having a real SoundFont parser by dynamically 
        // downloading GM midi.js soundfonts from gleitz
        this.soundfontBasePath = "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/";
        this.sampleCache = new Map();
        
        // Simple GM list
        this.gmInstruments = [
            "acoustic_grand_piano",
            "acoustic_guitar_nylon",
            "violin",
            "flute",
            "sitar"
        ];
    }

    /**
     * Load an SF2 file or GM soundfont
     * @param {string} url - URL to soundfont or identifier
     * @returns {Promise<void>}
     */
    async loadFont(url) {
        console.log(`[SF2Engine] Loading SoundFont from: ${url}`);
        this.instruments = [...this.gmInstruments];
        await this.selectInstrument(0);
        console.log(`[SF2Engine] Loaded ${this.instruments.length} instruments.`);
    }

    /**
     * List available instruments in the loaded SoundFont
     * @returns {string[]}
     */
    listInstruments() {
        return this.instruments;
    }

    /**
     * Select an active instrument by index
     * @param {number} index
     */
    async selectInstrument(index) {
        if (index < 0 || index >= this.instruments.length) return;
        this.activeInstrumentIndex = index;
        const instrumentName = this.instruments[index];
        console.log(`[SF2Engine] Selected instrument: ${instrumentName}`);
        
        // Pre-fetch some basic notes for the demo from the Gleitz repo
        const demoNotes = ["C4", "E4", "G4", "C5"];
        for (let note of demoNotes) {
            const url = `${this.soundfontBasePath}${instrumentName}-mp3/${note}.mp3`;
            if (!this.sampleCache.has(url)) {
                try {
                    const res = await fetch(url);
                    if (res.ok) {
                        const arrayBuffer = await res.arrayBuffer();
                        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                        this.sampleCache.set(`${instrumentName}_${note}`, audioBuffer);
                    }
                } catch(e) {
                    console.warn("Failed to pre-fetch", url);
                }
            }
        }
    }

    /**
     * Internal helper to convert midi note to note string (e.g. 60 -> C4)
     */
    midiToNoteString(midiNote) {
        const notes = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
        const octave = Math.floor(midiNote / 12) - 1;
        const noteName = notes[midiNote % 12];
        return `${noteName}${octave}`;
    }

    /**
     * Trigger a note on event
     * @param {number} midiNote - MIDI note number (0-127)
     * @param {number} velocity - MIDI velocity (0-127)
     */
    noteOn(midiNote, velocity) {
        const instrumentName = this.instruments[this.activeInstrumentIndex];
        // We find the nearest loaded note and pitch shift it
        // A full SF2 parser would have all exact samples
        
        // Mocking behavior by grabbing C4 (note 60)
        const buffer = this.sampleCache.get(`${instrumentName}_C4`) || this.sampleCache.values().next().value;
        if (!buffer) return;

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        
        // Pitch shift from C4 (60)
        source.playbackRate.value = Math.pow(2, (midiNote - 60) / 12);

        // Envelope
        const gainNode = this.ctx.createGain();
        const velLevel = velocity / 127.0;
        
        gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(velLevel, this.ctx.currentTime + 0.01);

        // Routing
        source.connect(gainNode);
        gainNode.connect(this.masterGain);
        source.start(this.ctx.currentTime);

        if (!this.activeVoices.has(midiNote)) {
            this.activeVoices.set(midiNote, []);
        }
        
        const voice = { source, gainNode };
        this.activeVoices.get(midiNote).push(voice);
    }

    /**
     * Release a playing note
     * @param {number} midiNote - MIDI note number (0-127)
     */
    noteOff(midiNote) {
        const voices = this.activeVoices.get(midiNote);
        if (!voices) return;

        const release = 0.4;
        const t = this.ctx.currentTime;

        voices.forEach(voice => {
            voice.gainNode.gain.cancelScheduledValues(t);
            voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, t);
            voice.gainNode.gain.exponentialRampToValueAtTime(0.001, t + release);
            voice.source.stop(t + release + 0.1);
        });

        this.activeVoices.delete(midiNote);
    }

    /**
     * Set Reverb Amount
     * @param {number} amount - 0.0 to 1.0
     */
    setReverb(amount) {
        this.reverbGain.gain.setTargetAtTime(Math.max(0, Math.min(1, amount)), this.ctx.currentTime, 0.01);
    }

    /**
     * Set master volume
     * @param {number} amount - 0.0 to 1.0
     */
    setVolume(amount) {
        this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(2, amount)), this.ctx.currentTime, 0.01);
    }
}
